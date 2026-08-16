const test = require('node:test');
const assert = require('node:assert');

const { parseEventStream } = require('../huemagic/utils/sse');
const API = require('../huemagic/utils/api');
const merge = require('../huemagic/utils/merge');
const { HueGroupMessage,
		HueLightMessage,
		HueMotionMessage,
		HueContactMessage,
		HueTemperatureMessage,
		HueBrightnessMessage,
		HueButtonsMessage
	} = require('../huemagic/utils/messages');


//
// EVENT STREAM PARSER
test('sse: parses a complete frame and keeps the incomplete rest', function()
{
	const parsed = parseEventStream("id: 1770343753:0\ndata: [{\"type\":\"update\"}]\n\ndata: par");

	assert.strictEqual(parsed.events.length, 1);
	assert.strictEqual(parsed.events[0].id, "1770343753:0");
	assert.strictEqual(parsed.events[0].data, "[{\"type\":\"update\"}]");
	assert.strictEqual(parsed.rest, "data: par");
});

test('sse: reassembles a frame split across two chunks', function()
{
	const first = parseEventStream("data: [1,");
	assert.strictEqual(first.events.length, 0);

	const second = parseEventStream(first.rest + "2]\n\n");
	assert.strictEqual(second.events.length, 1);
	assert.strictEqual(second.events[0].data, "[1,2]");
});

test('sse: ignores keep-alive comments and handles multiple frames at once', function()
{
	const parsed = parseEventStream(": hi\n\ndata: a\n\ndata: b\n\n");

	assert.strictEqual(parsed.events.length, 2);
	assert.strictEqual(parsed.events[0].data, "a");
	assert.strictEqual(parsed.events[1].data, "b");
	assert.strictEqual(parsed.rest, "");
});

test('sse: concatenates multiple data lines and accepts CRLF', function()
{
	const parsed = parseEventStream("event: update\r\ndata: one\r\ndata: two\r\n\r\n");

	assert.strictEqual(parsed.events[0].event, "update");
	assert.strictEqual(parsed.events[0].data, "one\ntwo");
});


//
// RESOURCE PROCESSING
test('api: resolves services and survives a missing owner', async function()
{
	const resources = [
		{ id: "dev", type: "device", metadata: { name: "Lamp" }, services: [ { rid: "svc", rtype: "light" } ] },
		{ id: "svc", type: "light", owner: { rid: "dev", rtype: "device" }, on: { on: true } },
		{ id: "orphan", type: "light", owner: { rid: "gone", rtype: "device" }, on: { on: false } },
		{ id: "room", type: "room", metadata: { name: "Hall" }, services: [ { rid: "grp", rtype: "grouped_light" } ] },
		{ id: "grp", type: "grouped_light", owner: { rid: "room", rtype: "room" }, on: { on: true } }
	];

	const processed = await API.processResources(resources);

	assert.strictEqual(processed["dev"].services.light["svc"].on.on, true);
	assert.deepStrictEqual(processed["dev"].types, ["device", "light"]);
	assert.deepStrictEqual(processed["_groupsOf"]["svc"], ["dev"]);
	assert.strictEqual(processed["orphan"].type, "light", "an unresolvable owner must not throw");
	assert.strictEqual(processed["room"].services.grouped_light["grp"].on.on, true);
});

test('api: a service that is not part of the collection is skipped', async function()
{
	const processed = await API.processResources([
		{ id: "dev", type: "device", services: [ { rid: "missing", rtype: "light" } ] }
	]);

	assert.deepStrictEqual(processed["dev"].services, {});
});

test('api: unsubscribing an unknown bridge does not throw', function()
{
	assert.doesNotThrow(function() { API.unsubscribe({ id: "never-subscribed" }); });
	assert.strictEqual(API.connected({ id: "never-subscribed" }), false);
});


//
// MESSAGES
const device = function(type, service, extra = {})
{
	let services = {};
	services[type] = { "s1": Object.assign({ id: "s1", enabled: true }, service) };
	services["zigbee_connectivity"] = { "z1": { id: "z1", status: "connected" } };

	return Object.assign({
		id: "d1",
		type: "device",
		id_v1: "/sensors/1",
		updated: "2026-08-16T12:00:00+02:00",
		metadata: { name: "Sensor" },
		product_data: { model_id: "SML001", manufacturer_name: "Signify", product_name: "Hue motion sensor", product_archetype: "unknown_archetype", certified: true, software_version: "1.0" },
		services: services
	}, extra);
};

test('messages: motion prefers the report over the deprecated flat value', function()
{
	const withReport = new HueMotionMessage(device("motion", { motion: { motion: false, motion_valid: false, motion_report: { changed: "x", motion: true } } })).msg;
	assert.strictEqual(withReport.payload.motion, true);

	const legacy = new HueMotionMessage(device("motion", { motion: { motion: true, motion_valid: true } })).msg;
	assert.strictEqual(legacy.payload.motion, true);
});

test('messages: a sensor without device_power reports no battery instead of throwing', function()
{
	const msg = new HueMotionMessage(device("motion", { motion: { motion_report: { changed: "x", motion: false } } })).msg;

	assert.strictEqual(msg.info.battery, false);
	assert.strictEqual(msg.info.batteryState, false);
	assert.strictEqual(msg.payload.reachable, true);
});

test('messages: temperature and light level prefer their reports', function()
{
	const temperature = new HueTemperatureMessage(device("temperature", { temperature: { temperature: 0, temperature_valid: false, temperature_report: { changed: "x", temperature: 21.5 } } })).msg;
	assert.strictEqual(temperature.payload.celsius, 21.5);
	assert.strictEqual(temperature.payload.temperatureIs, "comfortable");

	const brightness = new HueBrightnessMessage(device("light_level", { light: { light_level: 1, light_level_report: { changed: "x", light_level: 20080 } } })).msg;
	assert.strictEqual(brightness.payload.lightLevel, 20080);
	assert.strictEqual(brightness.payload.dark, false);
	assert.strictEqual(brightness.payload.daylight, true);
});

test('messages: a contact sensor without a report yet does not throw', function()
{
	const msg = new HueContactMessage(device("contact", {})).msg;
	assert.strictEqual(msg.payload.contact, false);

	const reported = new HueContactMessage(device("contact", { contact_report: { changed: "x", state: "no_contact" } })).msg;
	assert.strictEqual(reported.payload.contact, "no_contact");
});

test('messages: buttons prefer button_report and expose the tap dial rotation', function()
{
	let resource = device("button", { metadata: { control_id: 2 }, button: { last_event: "initial_press", button_report: { updated: "x", event: "long_release" } } });
	assert.strictEqual(new HueButtonsMessage(resource).msg.payload.action, "long_release");

	resource.services["relative_rotary"] = { "r1": { id: "r1", relative_rotary: { rotary_report: { updated: "x", action: "start", rotation: { direction: "clock_wise", steps: 500, duration: 400 } } } } };

	const rotation = new HueButtonsMessage(resource).msg.payload.rotation;
	assert.strictEqual(rotation.clockwise, true);
	assert.strictEqual(rotation.degrees, 180);
	assert.strictEqual(rotation.steps, 500);
});

test('messages: a device without any button event reports false', function()
{
	const msg = new HueButtonsMessage(device("button", { metadata: { control_id: 1 } })).msg;

	assert.strictEqual(msg.payload.button, false);
	assert.strictEqual(msg.payload.action, false);
	assert.strictEqual(msg.payload.rotation, false);
});

test('messages: a group without a grouped light service throws instead of returning junk', function()
{
	assert.throws(function()
	{
		new HueGroupMessage({ id: "room", type: "room", metadata: { name: "Hall" }, services: { light: {} } });
	});
});

test('messages: a group reports brightness and colour', function()
{
	const msg = new HueGroupMessage({
		id: "room",
		type: "room",
		id_v1: "/groups/1",
		updated: "2026-08-16T12:00:00+02:00",
		metadata: { name: "Hall" },
		services: { grouped_light: { "g1": { id: "g1", on: { on: true }, dimming: { brightness: 50 }, color_temperature: { mirek: 300 } } } }
	}).msg;

	assert.strictEqual(msg.payload.on, true);
	assert.strictEqual(msg.payload.brightness, 50);
	assert.strictEqual(msg.payload.brightnessLevel, 127);
	assert.strictEqual(msg.payload.colorTemp, 300);
	assert.strictEqual(msg.info.name, "Hall");
});

test('messages: a light without dimming or connectivity still builds', function()
{
	const msg = new HueLightMessage({
		id: "d1",
		type: "device",
		updated: "2026-08-16T12:00:00+02:00",
		metadata: { name: "Plug" },
		services: { light: { "s1": { id: "s1", on: { on: false }, metadata: { name: "Plug" } } } }
	}).msg;

	assert.strictEqual(msg.payload.on, false);
	assert.strictEqual(msg.payload.brightness, false);
	assert.strictEqual(msg.payload.reachable, "unknown");
	assert.strictEqual(msg.info.model.manufacturer, false);
});


//
// DEEP MERGE
test('merge: a partial event update keeps untouched properties', function()
{
	const previous = { on: { on: true }, dimming: { brightness: 40 }, color: { xy: { x: 0.1, y: 0.2 } } };
	const merged = merge.deep(previous, { dimming: { brightness: 80 } });

	assert.strictEqual(merged.dimming.brightness, 80);
	assert.strictEqual(merged.on.on, true);
	assert.strictEqual(merged.color.xy.x, 0.1);
});

test('merge: a list is replaced, never appended to', function()
{
	const previous = { gradient: { points: [1, 2, 3] }, tamper_reports: [{ state: "not_tampered" }] };
	const merged = merge.deep(previous, { gradient: { points: [9] } });

	assert.deepStrictEqual(merged.gradient.points, [9]);
	assert.strictEqual(merged.tamper_reports.length, 1);
});


//
// COLOR CONVERSION
const colorUtils = require('../huemagic/utils/color');

test('color: every conversion stays inside the color space the bridge accepts', function()
{
	const gamutC = { red: {x:0.6915,y:0.3083}, green: {x:0.17,y:0.7}, blue: {x:0.1532,y:0.0475} };
	const gamutA = { red: {x:0.704,y:0.296}, green: {x:0.2151,y:0.7106}, blue: {x:0.138,y:0.08} };

	const samples = [[0,0,0], [255,255,255], [179,135,255], [255,0,0], [0,255,0], [0,0,255], [1,0,2], [12,240,7]];

	for(const gamut of [null, gamutC, gamutA])
	{
		for(const [r, g, b] of samples)
		{
			const xy = colorUtils.rgbToXy(r, g, b, gamut);

			assert.ok(Number.isFinite(xy.x) && Number.isFinite(xy.y), "rgb(" + [r,g,b] + ") produced " + JSON.stringify(xy));
			assert.ok(xy.x >= 0 && xy.x <= 1, "x out of range for rgb(" + [r,g,b] + "): " + xy.x);
			assert.ok(xy.y >= 0 && xy.y <= 1, "y out of range for rgb(" + [r,g,b] + "): " + xy.y);
		}
	}
});

test('color: a hex value survives the round trip', function()
{
	const rgb = colorUtils.hexRgb("b387ff");
	assert.deepStrictEqual(rgb, [179, 135, 255]);

	const xy = colorUtils.rgbToXy(rgb[0], rgb[1], rgb[2]);
	assert.ok(xy.x > 0 && xy.y > 0);
});


//
// NEW DEVICE TYPES AND FEATURES
const { HueSpeakerMessage, HueAutomationMessage, servesType, serviceTypes } = require('../huemagic/utils/messages');

test('types: one node type is fed by every service the bridge offers for it', function()
{
	assert.deepStrictEqual(serviceTypes["motion"], ["motion", "camera_motion", "grouped_motion", "convenience_area_motion", "security_area_motion"]);
	assert.ok(serviceTypes["button"].includes("bell_button"));

	const camera = { services: { camera_motion: { s1: {} } } };
	const doorbell = { services: { bell_button: { s1: {} } } };

	assert.strictEqual(servesType(camera, "motion"), true, "a camera has to be found by the motion node");
	assert.strictEqual(servesType(doorbell, "button"), true, "a doorbell has to be found by the buttons node");
	assert.strictEqual(servesType(camera, "button"), false);
});

test('messages: a MotionAware area reports motion and its sensitivity', function()
{
	const msg = new HueMotionMessage({
		id: "area", type: "device", updated: "x", name: "Hallway",
		services: { convenience_area_motion: { s1: { id: "s1", type: "convenience_area_motion", enabled: true,
			motion: { motion_report: { changed: "x", motion: true } },
			sensitivity: { sensitivity: 2, sensitivity_max: 4, status: "set" } } } }
	}).msg;

	assert.strictEqual(msg.payload.motion, true);
	assert.strictEqual(msg.payload.sensitivity, 2);
	assert.strictEqual(msg.payload.sensitivityMax, 4);
	assert.strictEqual(msg.info.type, "convenience_area_motion");
	assert.strictEqual(msg.info.name, "Hallway", "an area carries a plain name, not metadata");
});

test('messages: a speaker reports what it is playing and what it knows', function()
{
	const build = function(chime, mute)
	{
		return new HueSpeakerMessage({
			id: "d1", type: "device", updated: "x", metadata: { name: "Chime" }, product_data: {},
			services: { speaker: { s1: { id: "s1",
				chime: { sound_values: ["ding_dong_classic", "westminster_classic"], status: { sound: chime, sound_values: [] } },
				alarm: { sound_values: ["siren"], status: { sound: "no_sound", sound_values: [] } },
				mute: { mute: mute } } } }
		}).msg;
	};

	const idle = build("no_sound", "unmute");
	assert.strictEqual(idle.payload.chime, false);
	assert.strictEqual(idle.payload.playing, false);
	assert.strictEqual(idle.payload.muted, false);
	assert.deepStrictEqual(idle.info.sounds.chime, ["ding_dong_classic", "westminster_classic"]);
	assert.strictEqual(idle.info.sounds.alert, false, "a device without an alert channel reports false");

	const ringing = build("ding_dong_classic", "mute");
	assert.strictEqual(ringing.payload.chime, "ding_dong_classic");
	assert.strictEqual(ringing.payload.playing, true);
	assert.strictEqual(ringing.payload.muted, true);
});

test('messages: an automation reports its status', function()
{
	const msg = new HueAutomationMessage({
		id: "a1", enabled: false, status: "disabled", script_id: "wake-up",
		metadata: { name: "Wake up" }, configuration: { when: "07:00" }, updated: "x"
	}).msg;

	assert.strictEqual(msg.payload.enabled, false);
	assert.strictEqual(msg.payload.running, false);
	assert.strictEqual(msg.payload.status, "disabled");
	assert.strictEqual(msg.info.name, "Wake up");
	assert.deepStrictEqual(msg.configuration, { when: "07:00" });
});

test('messages: a light reports the effects it supports', function()
{
	const light = function(services)
	{
		return new HueLightMessage({ id: "d1", type: "device", updated: "x", metadata: { name: "L" },
			services: { light: { s1: Object.assign({ id: "s1", on: { on: true }, metadata: { name: "L" } }, services) } } }).msg;
	};

	// THE OLDER "effects" FEATURE
	const legacy = light({ effects: { status: "candle", effect_values: ["no_effect", "candle"] } });
	assert.strictEqual(legacy.payload.effect, "candle");
	assert.strictEqual(legacy.info.model.effectsV2, false);

	// A LIGHT WITHOUT ANY EFFECT MUST NOT GROW THE PROPERTY
	const plain = light({});
	assert.strictEqual(typeof plain.payload.effect, "undefined");
	assert.strictEqual(typeof plain.payload.timedEffect, "undefined");
	assert.strictEqual(typeof plain.payload.powerUp, "undefined");
});

const { HueSyncBoxMessage } = require('../huemagic/utils/messages');

test('messages: a sync box reports its mode, brightness and inputs', function()
{
	const box = function(execution)
	{
		return new HueSyncBoxMessage({
			updated: "x",
			device: { uniqueId: "SB1", name: "Living room", ipAddress: "192.168.0.10", firmwareVersion: "1.0.0", deviceType: "HSB1", wifi: { ssid: "home", strength: 3 } },
			execution: execution,
			hdmi: { input1: { name: "Apple TV", type: "player", status: "linked" }, input3: { name: "Console", type: "game", status: "unplugged" } }
		}).msg;
	};

	const syncing = box({ mode: "video", syncActive: true, hdmiActive: true, lastSyncMode: "video", brightness: 150, hdmiSource: "input1", hueTarget: "groups/13", video: { intensity: "high" } });
	assert.strictEqual(syncing.payload.on, true);
	assert.strictEqual(syncing.payload.syncing, true);
	assert.strictEqual(syncing.payload.intensity, "high", "the intensity is stored per mode, not next to it");
	assert.strictEqual(syncing.payload.brightness, 75, "the box counts to 200, HueMagic counts in percent");
	assert.strictEqual(syncing.payload.brightnessLevel, 150);
	assert.strictEqual(syncing.payload.inputs.input1.active, true);
	assert.strictEqual(syncing.payload.inputs.input3.active, false);
	assert.strictEqual(typeof syncing.payload.inputs.input2, "undefined", "an input the box does not report must not be invented");
	assert.strictEqual(syncing.info.model.name, "Hue Play HDMI Sync Box");

	// POWER SAVE STILL REMEMBERS THE LAST SYNC MODE
	const sleeping = box({ mode: "powersave", syncActive: false, hdmiActive: false, lastSyncMode: "music", brightness: 0 });
	assert.strictEqual(sleeping.payload.on, false);
	assert.strictEqual(sleeping.payload.intensity, false);
	assert.strictEqual(sleeping.payload.lastSyncMode, "music");
	assert.strictEqual(sleeping.payload.brightness, 0, "a brightness of zero is a value, not a missing one");
});

test('messages: a sync box that answers with almost nothing does not throw', function()
{
	const msg = new HueSyncBoxMessage({}).msg;

	assert.strictEqual(msg.payload.on, false, "a box that reports no mode is not running");
	assert.strictEqual(msg.payload.mode, false);
	assert.strictEqual(msg.payload.brightness, false);
	assert.deepStrictEqual(msg.payload.inputs, {});
	assert.strictEqual(msg.info.type, "syncbox");
});
