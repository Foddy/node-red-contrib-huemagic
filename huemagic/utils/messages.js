const dayjs = require('dayjs');
const colorUtils = require("./color");

//
// ONE NODE TYPE CAN BE FED BY SEVERAL SERVICES OF THE BRIDGE
const serviceTypes = {
	"light": ["light"],
	"group": ["grouped_light"],
	"motion": ["motion", "camera_motion", "grouped_motion", "convenience_area_motion", "security_area_motion"],
	"button": ["button", "bell_button", "relative_rotary"],
	"contact": ["contact"],
	"temperature": ["temperature"],
	"light_level": ["light_level", "grouped_light_level"],
	"speaker": ["speaker"]
};

//
// GET THE FIRST SERVICE OF A TYPE BEHIND A RESOURCE
function service(resource, type)
{
	const wanted = serviceTypes[type] ? serviceTypes[type] : [type];

	for (const one of wanted)
	{
		const services = resource["services"] ? resource["services"][one] : false;
		if(services && Object.values(services).length > 0) { return Object.values(services)[0]; }
	}

	return false;
}

//
// DOES A RESOURCE OFFER ANYTHING THIS NODE TYPE CAN USE?
function servesType(resource, type)
{
	const wanted = serviceTypes[type] ? serviceTypes[type] : [type];
	return !!resource["services"] && wanted.some(function(one) { return !!resource["services"][one]; });
}

//
// GET THE CONNECTION STATE OF A DEVICE
function connectivity(resource)
{
	return service(resource, "zigbee_connectivity") || service(resource, "zgp_connectivity");
}

//
// GET THE BATTERY STATE OF A DEVICE (MAINS POWERED DEVICES HAVE NONE)
function battery(resource)
{
	const power = service(resource, "device_power");
	return (power && power.power_state) ? power.power_state : { battery_level: false, battery_state: false };
}

//
// DESCRIBE THE DEVICE BEHIND A RESOURCE
function model(resource)
{
	const productData = resource.product_data ? resource.product_data : {};

	return {
		id: productData.model_id ? productData.model_id : false,
		manufacturer: productData.manufacturer_name ? productData.manufacturer_name : false,
		name: productData.product_name ? productData.product_name : false,
		type: productData.product_archetype ? productData.product_archetype : false,
		certified: productData.certified ? productData.certified : false
	};
}

//
// HUE BRIDGE
class HueBridgeMessage
{
	constructor(resource, options = {})
	{
		this.message = {};
		this.message.payload = {};
		this.message.payload.id = resource.bridgeid;
		this.message.payload.name = resource.name;
		this.message.payload.factoryNew = resource.factorynew;
		this.message.payload.replacesBridgeId = resource.replacesbridgeid ? resource.replacesbridgeid : false;
		this.message.payload.dataStoreVersion = resource.datastoreversion;
		this.message.payload.starterKitId = resource.starterkitid && resource.starterkitid.length > 0 ? resource.starterkitid : false;
		this.message.payload.softwareVersion = resource.swversion;
		this.message.payload.apiVersion = resource.apiversion;
		this.message.payload.zigbeeChannel = resource.zigbeechannel;
		this.message.payload.macAddress = resource.mac;
		this.message.payload.ipAddress = resource.ipaddress;
		this.message.payload.dhcpEnabled = resource.dhcp;
		this.message.payload.netmask = resource.netmask;
		this.message.payload.gateway = resource.gateway;
		this.message.payload.proxyAddress = resource.proxyaddress == "none" ? false : resource.proxyaddress;
		this.message.payload.proxyPort = resource.proxyport;
		this.message.payload.utcTime = resource.UTC;
		this.message.payload.timeZone = resource.timezone;
		this.message.payload.localTime = resource.localtime;
		this.message.payload.portalServicesEnabled = resource.portalservices;
		this.message.payload.portalConnected = resource.portalconnection;
		this.message.payload.linkButtonEnabled = resource.linkbutton;
		this.message.payload.touchlinkEnabled = (resource["touchlink"] && resource["touchlink"] == true) ? true : false;
		this.message.payload.autoUpdatesEnabled = options["autoupdate"] ? options["autoupdate"] : false;
		this.message.payload.users = [];
		this.message.payload.updated = resource.updated;

		this.message.payload.model = {};
		this.message.payload.model.id = resource.modelid;
		this.message.payload.model.manufacturer = "Philips";
		this.message.payload.model.name = "Hue v2";

		// GET USERS
		if (resource["whitelist"]) {
			for (const [userID, user] of Object.entries(resource["whitelist"]))
			{
				this.message.payload.users.push({
					user: userID,
					name: user["name"],
					created: user["create date"],
					lastAccess: user["last use date"]
				});
			}
		}
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE BRIGHTNESS
class HueBrightnessMessage
{
	constructor(resource, options = {})
	{
		const lightLevelService = service(resource, "light_level");
		if(!lightLevelService || !lightLevelService.light) { throw new Error("The light level sensor is not available."); }

		const connection = connectivity(resource);
		const power = battery(resource);

		// NEWER FIRMWARES REPORT THE VALUE, THE FLAT PROPERTY IS DEPRECATED
		const light = lightLevelService.light;
		const lightLevel = light.light_level_report ? light.light_level_report.light_level : light.light_level;

		var realLUX = lightLevel - 1;
		realLUX = realLUX / 10000;
		realLUX = Math.round(Math.pow(10, realLUX));

		this.message = {};
		this.message.payload = {};
		this.message.payload.active = lightLevelService.enabled;
		this.message.payload.reachable = connection ? (connection.status === "connected") : "unknown";
		this.message.payload.connectionStatus = connection ? connection.status : "unknown";
		this.message.payload.lux = realLUX;
		this.message.payload.lightLevel = lightLevel;
		// WHERE "DARK" ENDS CAN BE SET PER NODE
		const darkThreshold = (options.darkThreshold && !isNaN(options.darkThreshold)) ? parseInt(options.darkThreshold) : 90;

		this.message.payload.dark = (realLUX < darkThreshold);
		this.message.payload.daylight = (realLUX >= darkThreshold);
		this.message.payload.darkThreshold = darkThreshold;
		this.message.payload.updated = resource.updated;

		this.message.info = {};
		this.message.info.id = lightLevelService.id;
		this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false;
		this.message.info.uniqueId = resource.id + "-" + lightLevelService.id;
		this.message.info.deviceId = resource.id;
		this.message.info.name = resource.metadata ? resource.metadata.name : false;
		this.message.info.type = "light_level";
		this.message.info.softwareVersion = resource.product_data ? resource.product_data.software_version : false;
		this.message.info.battery = power.battery_level;
		this.message.info.batteryState = power.battery_state;

		this.message.info.model = model(resource);
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE GROUP
class HueGroupMessage
{
	constructor(resource, options = {})
	{
		const groupedLight = service(resource, "grouped_light");
		if(!groupedLight) { throw new Error("The group has no grouped light service."); }

		// GET ALL RESOURCES
		let allResourcesInsideGroup = {};
		for (const [type, resources] of Object.entries(resource["services"]))
		{
			allResourcesInsideGroup[type] = Object.keys(resource["services"][type]);
		}

		this.message = {};
		this.message.payload = {};
		this.message.payload.on = groupedLight.on ? groupedLight.on.on : false;
		this.message.payload.brightness = groupedLight.dimming ? groupedLight.dimming.brightness : false;
		this.message.payload.brightnessLevel = groupedLight.dimming ? Math.round((254/100)*groupedLight.dimming.brightness) : false;
		this.message.payload.updated = resource.updated;

		this.message.info = {};
		this.message.info.id = resource.id;
		this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false;
		this.message.info.name = resource.metadata ? resource.metadata.name : "all";
		this.message.info.resources = allResourcesInsideGroup;
		this.message.info.type = "group";

		// HAS COLOR CAPABILITIES?
		if(groupedLight["color"] && groupedLight["color"]["xy"])
		{
			let RGB = colorUtils.xyBriToRgb(groupedLight.color.xy.x, groupedLight.color.xy.y, (groupedLight.dimming ? groupedLight.dimming.brightness : 100));
			this.message.payload.rgb = [RGB.r, RGB.g, RGB.b];
			this.message.payload.hex = colorUtils.rgbHex(RGB.r, RGB.g, RGB.b);
			this.message.payload.xyColor = groupedLight.color.xy;

			if(options.colornames == true)
			{
				var cNamesArray = colorUtils.colornamer(colorUtils.rgbHex(RGB.r, RGB.g, RGB.b));
				this.message.payload.color = cNamesArray.basic[0]["name"];
			}
		}

		// HAS COLOR TEMPERATURE CAPABILITIES?
		if(groupedLight["color_temperature"] && groupedLight["color_temperature"]["mirek"])
		{
			this.message.payload.colorTemp = groupedLight.color_temperature.mirek;
		}
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE LIGHT
class HueLightMessage
{
	constructor(resource, options = {})
	{
		const lightService = service(resource, "light");
		if(!lightService) { throw new Error("The light is not available."); }

		const connection = connectivity(resource);

		this.message = {};
		this.message.payload = {};
		this.message.payload.on = lightService.on ? lightService.on.on : false;
		this.message.payload.brightness = lightService.dimming ? lightService.dimming.brightness : false;
		this.message.payload.brightnessLevel = lightService.dimming ? Math.round((254/100)*this.message.payload.brightness) : false;
		this.message.payload.reachable = connection ? (connection.status === "connected") : "unknown";
		this.message.payload.connectionStatus = connection ? connection.status : "unknown";
		this.message.payload.updated = resource.updated;

		this.message.info = {};
		this.message.info.id = lightService.id;
		this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false;
		this.message.info.uniqueId = resource.id + "-" + lightService.id;
		this.message.info.deviceId = resource.id;
		this.message.info.name = lightService.metadata ? lightService.metadata.name : (resource.metadata ? resource.metadata.name : false);
		this.message.info.type = "light";
		this.message.info.softwareVersion = resource.product_data ? resource.product_data.software_version : false;

		this.message.info.model = model(resource);
		this.message.info.model.friendsOfHue = true;

		// HAS COLOR CAPABILITIES?
		if(lightService["color"] && lightService["color"]["xy"])
		{
			let RGB = colorUtils.xyBriToRgb(lightService.color.xy.x, lightService.color.xy.y, (lightService.dimming ? lightService.dimming.brightness : 100));
			this.message.payload.rgb = [RGB.r, RGB.g, RGB.b];
			this.message.payload.hex = colorUtils.rgbHex(RGB.r, RGB.g, RGB.b);
			this.message.payload.xyColor = lightService.color.xy;

			if(options.colornames == true)
			{
				var cNamesArray = colorUtils.colornamer(colorUtils.rgbHex(RGB.r, RGB.g, RGB.b));
				this.message.payload.color = cNamesArray.basic[0]["name"];
			}

			this.message.info.model.colorGamut = lightService.color.gamut;
			this.message.info.model.colorGamutType = lightService.color.gamut_type;
		}

		// HAS COLOR TEMPERATURE CAPABILITIES?
		if(lightService["color_temperature"])
		{
			this.message.payload.colorTemp = lightService.color_temperature.mirek ? lightService.color_temperature.mirek : false;

			if(!this.message.payload.colorTemp) { this.message.payload.colorTempName = "unknown"; }
			else if(this.message.payload.colorTemp < 200) { this.message.payload.colorTempName = "cold"; }
			else if(this.message.payload.colorTemp < 350) { this.message.payload.colorTempName = "normal"; }
			else if(this.message.payload.colorTemp < 410) { this.message.payload.colorTempName = "warm"; }
			else { this.message.payload.colorTempName = "hot"; }
		}

		// HAS EFFECT CAPABILITIES? "effects_v2" SUPERSEDES "effects" AND NESTS ITS VALUES DIFFERENTLY
		if(lightService["effects_v2"])
		{
			const effects = lightService["effects_v2"];

			this.message.payload.effect = (effects.status && effects.status.effect) ? effects.status.effect : "no_effect";
			this.message.info.model.effectsV2 = true;
			this.message.info.model.effects = (effects.action && effects.action.effect_values) ? effects.action.effect_values : [];
		}
		else if(lightService["effects"])
		{
			const effects = lightService["effects"];

			this.message.payload.effect = effects.status ? effects.status : "no_effect";
			this.message.info.model.effectsV2 = false;
			this.message.info.model.effects = effects.effect_values ? effects.effect_values : [];
		}

		// HAS TIMED EFFECT CAPABILITIES? (SUNRISE / SUNSET)
		if(lightService["timed_effects"])
		{
			this.message.payload.timedEffect = lightService.timed_effects.status ? lightService.timed_effects.status : "no_effect";
			this.message.info.model.timedEffects = lightService.timed_effects.effect_values ? lightService.timed_effects.effect_values : [];
		}

		// HOW THE LIGHT COMES BACK AFTER A POWER CUT
		if(lightService["powerup"])
		{
			this.message.payload.powerUp = lightService.powerup.preset ? lightService.powerup.preset : false;
		}

		// HAS GRADIENT COLOR CAPABILITIES?
		if(lightService["gradient"])
		{
			const points = lightService["gradient"]["points"] ? lightService["gradient"]["points"] : [];

			this.message.payload.gradient = {};
			this.message.payload.gradient.colors = [];

			for(let gradientColor of points)
			{
				let gradientColorRGB = colorUtils.xyBriToRgb(gradientColor.color.xy.x, gradientColor.color.xy.y, (lightService.dimming ? lightService.dimming.brightness : 100));

				let oneColorPack = {};
				oneColorPack.rgb = [gradientColorRGB.r, gradientColorRGB.g, gradientColorRGB.b];
				oneColorPack.hex = colorUtils.rgbHex(gradientColorRGB.r, gradientColorRGB.g, gradientColorRGB.b);
				oneColorPack.xyColor = gradientColor.color.xy;

				this.message.payload.gradient.colors.push(oneColorPack);
			}

			this.message.payload.gradient.numColors = points.length;
			this.message.payload.gradient.totalColors = lightService["gradient"]["points_capable"];
			this.message.payload.gradient.mode = lightService["gradient"]["mode"] ? lightService["gradient"]["mode"] : false;
		}
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE MOTION
class HueMotionMessage
{
	constructor(resource, options = {})
	{
		const motionService = service(resource, "motion");
		if(!motionService || !motionService.motion) { throw new Error("The motion sensor is not available."); }

		const connection = connectivity(resource);
		const power = battery(resource);

		// NEWER FIRMWARES REPORT THE VALUE, THE FLAT PROPERTIES ARE DEPRECATED
		const motion = motionService.motion;
		const detected = motion.motion_report ? motion.motion_report.motion : (motion.motion && motion.motion_valid);

		this.message = {};
		this.message.payload = {
			active: motionService.enabled,
			reachable: connection ? (connection.status === "connected") : "unknown",
			connectionStatus: connection ? connection.status : "unknown",
			motion: (detected === true),
			updated: resource.updated
		};

		// CAMERAS AND MOTIONAWARE AREAS CAN BE TUNED
		if(motionService.sensitivity)
		{
			this.message.payload.sensitivity = motionService.sensitivity.sensitivity;
			this.message.payload.sensitivityMax = motionService.sensitivity.sensitivity_max;
		}

		this.message.info = {};
		this.message.info.id = motionService.id;
		this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false;
		this.message.info.uniqueId = resource.id + "-" + motionService.id;
		this.message.info.deviceId = resource.id;
		this.message.info.name = resource.metadata ? resource.metadata.name : (resource.name ? resource.name : false);
		this.message.info.type = motionService.type ? motionService.type : "motion";
		this.message.info.softwareVersion = resource.product_data ? resource.product_data.software_version : false;
		this.message.info.battery = power.battery_level;
		this.message.info.batteryState = power.battery_state;

		this.message.info.model = model(resource);
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE CONTACT
class HueContactMessage
{
	constructor(resource, options = {})
	{
		const contactService = service(resource, "contact");
		if(!contactService) { throw new Error("The contact sensor is not available."); }

		const connection = connectivity(resource);
		const power = battery(resource);
		const tamperService = service(resource, "tamper");

		// THE SENSOR ONLY REPORTS AFTER THE FIRST STATE CHANGE
		const report = contactService.contact_report ? contactService.contact_report : { state: false, changed: false };

		this.message = {};
		this.message.payload = {
			active: contactService.enabled,
			reachable: connection ? (connection.status === "connected") : "unknown",
			connectionStatus: connection ? connection.status : "unknown",
			contact: report.state,
			changed: report.changed,
			updated: resource.updated
		};

		// HAS TAMPER DETECTION? (HUE SECURE)
		if(tamperService && Array.isArray(tamperService.tamper_reports))
		{
			this.message.payload.tampered = tamperService.tamper_reports.some(function(oneReport) { return oneReport.state === "tampered"; });
		}

		this.message.info = {};
		this.message.info.id = contactService.id;
		this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false;
		this.message.info.uniqueId = resource.id + "-" + contactService.id;
		this.message.info.deviceId = resource.id;
		this.message.info.name = resource.metadata ? resource.metadata.name : false;
		this.message.info.type = "contact";
		this.message.info.softwareVersion = resource.product_data ? resource.product_data.software_version : false;
		this.message.info.battery = power.battery_level;
		this.message.info.batteryState = power.battery_state;

		this.message.info.model = model(resource);
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE RULES
class HueRulesMessage
{
	constructor(resource, options = {})
	{
		this.message = {};
		this.message.payload = {};
		this.message.payload.enabled = (resource["status"] == "enabled");
		this.message.payload.triggered = (resource["lasttriggered"] != null) ? dayjs(resource["lasttriggered"]).format() : false;

		this.message.info = {};
		this.message.info.id = resource["id"];
		this.message.info.created = dayjs(resource["created"]).format();
		this.message.info.name = resource["name"];
		this.message.info.timesTriggered = resource["timestriggered"];
		this.message.info.owner = resource["_owner"];
		this.message.info.status = resource["status"];

		this.message.conditions = resource["conditions"];
		this.message.actions = resource["actions"];
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE BUTTONS
class HueButtonsMessage
{
	constructor(resource, options = {})
	{
		const connection = connectivity(resource);
		const power = battery(resource);

		// FIND PRESSED BUTTON (A DOORBELL BEHAVES EXACTLY LIKE ONE)
		var pressedButton = false;
		var isDoorbell = false;

		for (const oneType of ["button", "bell_button"])
		{
			const allButtons = resource.services[oneType] ? Object.values(resource.services[oneType]) : [];

			for (var i = allButtons.length - 1; i >= 0; i--)
			{
				if(allButtons[i]["button"])
				{
					pressedButton = allButtons[i];
					isDoorbell = (oneType === "bell_button");
					break;
				}
			}

			if(pressedButton) { break; }
		}

		// FIND ROTATION (HUE TAP DIAL, LUTRON AURORA)
		var rotaryDial = false;
		const allRotaries = resource.services.relative_rotary ? Object.values(resource.services.relative_rotary) : [];

		for (var r = allRotaries.length - 1; r >= 0; r--)
		{
			if(allRotaries[r]["relative_rotary"])
			{
				rotaryDial = allRotaries[r];
				break;
			}
		}

		// NEWER FIRMWARES REPORT THE EVENT, "last_event" IS DEPRECATED
		const buttonEvent = pressedButton ? (pressedButton.button.button_report ? pressedButton.button.button_report.event : pressedButton.button.last_event) : false;
		const rotaryEvent = rotaryDial ? (rotaryDial.relative_rotary.rotary_report ? rotaryDial.relative_rotary.rotary_report : rotaryDial.relative_rotary.last_event) : false;

		this.message = {};
		this.message.payload = {
			reachable: connection ? (connection.status === "connected") : "unknown",
			connectionStatus: connection ? connection.status : "unknown",
			button: pressedButton ? pressedButton.metadata.control_id : false,
			action: buttonEvent ? buttonEvent : false,
			updated: resource.updated
		};

		// IS A DOORBELL?
		this.message.payload.doorbell = isDoorbell;

		// HAS BEEN ROTATED?
		this.message.payload.rotation = (rotaryEvent && rotaryEvent.rotation) ? {
			action: rotaryEvent.action,
			direction: rotaryEvent.rotation.direction,
			clockwise: (rotaryEvent.rotation.direction === "clock_wise"),
			steps: rotaryEvent.rotation.steps,
			degrees: Math.round((360/1000)*rotaryEvent.rotation.steps),
			duration: rotaryEvent.rotation.duration
		} : false;

		this.message.info = {};
		this.message.info.id = pressedButton ? pressedButton.id : (rotaryDial ? rotaryDial.id : resource.id);
		this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false;
		this.message.info.uniqueId = resource.id + "-" + (pressedButton ? pressedButton.id : (rotaryDial ? rotaryDial.id : ""));
		this.message.info.deviceId = resource.id;
		this.message.info.name = resource.metadata ? resource.metadata.name : false;
		this.message.info.type = "button";
		this.message.info.softwareVersion = resource.product_data ? resource.product_data.software_version : false;
		this.message.info.battery = power.battery_level;
		this.message.info.batteryState = power.battery_state;

		// WALL SWITCH MODULES CAN RUN AS ROCKERS OR AS PUSHBUTTONS
		const switchConfig = service(resource, "switch_input_configuration");
		this.message.info.switchMode = (switchConfig && switchConfig.switch_mode) ? switchConfig.switch_mode.mode : false;
		this.message.info.switchModes = (switchConfig && switchConfig.switch_mode) ? switchConfig.switch_mode.mode_values : false;

		this.message.info.model = model(resource);
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE TEMPERATURE
class HueTemperatureMessage
{
	constructor(resource, options = {})
	{
		const temperatureService = service(resource, "temperature");
		if(!temperatureService || !temperatureService.temperature) { throw new Error("The temperature sensor is not available."); }

		const connection = connectivity(resource);
		const power = battery(resource);

		// NEWER FIRMWARES REPORT THE VALUE, THE FLAT PROPERTY IS DEPRECATED
		const temperature = temperatureService.temperature;
		var deviceValue = temperature.temperature_report ? temperature.temperature_report.temperature : temperature.temperature;

		// SENSORS SIT NEXT TO WARM ELECTRONICS, SO THE READING CAN BE CALIBRATED PER NODE
		const offset = (options.offset && !isNaN(options.offset)) ? parseFloat(options.offset) : 0;
		var celsius = Math.round((deviceValue + offset) * 100) / 100;
		var fahrenheit = Math.round(((celsius * 1.8)+32) * 100) / 100;

		// TEMPERATURE MESSAGE
		let temperatureMessage = "comfortable";

		if(celsius < 0) {
			temperatureMessage = "very cold";
		}
		else if(celsius < 11) {
			temperatureMessage = "cold";
		}
		else if(celsius < 16) {
			temperatureMessage = "slightly cold";
		}
		else if(celsius < 22) {
			temperatureMessage = "comfortable";
		}
		else if(celsius < 27) {
			temperatureMessage = "slightly warm";
		}
		else if(celsius < 33) {
			temperatureMessage = "warm";
		}
		else if(celsius < 39) {
			temperatureMessage = "hot";
		}
		else {
			temperatureMessage = "very hot";
		}

		this.message = {};
		this.message.payload = {
			active: temperatureService.enabled,
			reachable: connection ? (connection.status === "connected") : "unknown",
			connectionStatus: connection ? connection.status : "unknown",
			celsius: celsius,
			fahrenheit: fahrenheit,
			temperatureIs: temperatureMessage,
			deviceValue: deviceValue,
			offset: offset,
			updated: resource.updated
		};

		this.message.info = {};
		this.message.info.id = temperatureService.id;
		this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false;
		this.message.info.uniqueId = resource.id + "-" + temperatureService.id;
		this.message.info.deviceId = resource.id;
		this.message.info.name = resource.metadata ? resource.metadata.name : false;
		this.message.info.type = "temperature";
		this.message.info.softwareVersion = resource.product_data ? resource.product_data.software_version : false;
		this.message.info.battery = power.battery_level;
		this.message.info.batteryState = power.battery_state;

		this.message.info.model = model(resource);
	}

	get msg()
	{
		return this.message;
	}
}

//
// HUE SPEAKER (HUE SECURE CHIME / SIREN)
class HueSpeakerMessage
{
	constructor(resource, options = {})
	{
		const speaker = service(resource, "speaker");
		if(!speaker) { throw new Error("The speaker is not available."); }

		const connection = connectivity(resource);
		const power = battery(resource);

		// THE BRIDGE REPORTS THE SOUND THAT WAS PLAYED LAST AND CLEARS IT LATE
		const playing = function(sound)
		{
			return (sound && sound.status && sound.status.sound && sound.status.sound !== "no_sound") ? sound.status.sound : false;
		};

		this.message = {};
		this.message.payload = {
			reachable: connection ? (connection.status === "connected") : "unknown",
			connectionStatus: connection ? connection.status : "unknown",
			muted: (speaker.mute && speaker.mute.mute === "mute"),
			alarm: playing(speaker.alarm),
			chime: playing(speaker.chime),
			alert: playing(speaker.alert),
			updated: resource.updated
		};

		this.message.payload.playing = !!(this.message.payload.alarm || this.message.payload.chime || this.message.payload.alert);

		this.message.info = {};
		this.message.info.id = speaker.id;
		this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false;
		this.message.info.uniqueId = resource.id + "-" + speaker.id;
		this.message.info.deviceId = resource.id;
		this.message.info.name = resource.metadata ? resource.metadata.name : false;
		this.message.info.type = "speaker";
		this.message.info.softwareVersion = resource.product_data ? resource.product_data.software_version : false;
		this.message.info.battery = power.battery_level;
		this.message.info.batteryState = power.battery_state;

		// WHICH SOUNDS THIS DEVICE ACTUALLY KNOWS
		this.message.info.sounds = {
			alarm: speaker.alarm ? speaker.alarm.sound_values : false,
			chime: speaker.chime ? speaker.chime.sound_values : false,
			alert: speaker.alert ? speaker.alert.sound_values : false
		};

		this.message.info.model = model(resource);
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE AUTOMATION (BEHAVIOR INSTANCE)
class HueAutomationMessage
{
	constructor(resource, options = {})
	{
		this.message = {};
		this.message.payload = {
			enabled: (resource["enabled"] === true),
			status: resource["status"] ? resource["status"] : false,
			running: (resource["status"] === "running"),
			lastError: resource["last_error"] ? resource["last_error"] : false,
			updated: resource.updated
		};

		this.message.info = {};
		this.message.info.id = resource["id"];
		this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false;
		this.message.info.name = (resource["metadata"] && resource["metadata"]["name"]) ? resource["metadata"]["name"] : false;
		this.message.info.type = "automation";
		this.message.info.script = resource["script_id"] ? resource["script_id"] : false;

		this.message.configuration = resource["configuration"] ? resource["configuration"] : {};
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE PLAY HDMI SYNC BOX
class HueSyncBoxMessage
{
	constructor(resource, options = {})
	{
		const device = resource["device"] ? resource["device"] : {};
		const execution = resource["execution"] ? resource["execution"] : {};
		const hdmi = resource["hdmi"] ? resource["hdmi"] : {};

		// THE INTENSITY IS STORED PER SYNC MODE
		const activeMode = execution[execution.mode] ? execution[execution.mode] : false;

		this.message = {};
		this.message.payload = {
			on: (execution.mode ? (execution.mode !== "powersave") : false),
			syncing: (execution.syncActive === true),
			passthrough: (execution.hdmiActive === true),
			mode: execution.mode ? execution.mode : false,
			lastSyncMode: execution.lastSyncMode ? execution.lastSyncMode : false,
			intensity: activeMode ? activeMode.intensity : false,
			brightness: (typeof execution.brightness != 'undefined') ? Math.round((100/200)*execution.brightness) : false,
			brightnessLevel: (typeof execution.brightness != 'undefined') ? execution.brightness : false,
			input: execution.hdmiSource ? execution.hdmiSource : false,
			entertainmentArea: execution.hueTarget ? execution.hueTarget : false,
			updated: resource.updated
		};

		// WHAT IS PLUGGED INTO THE FOUR INPUTS
		this.message.payload.inputs = {};
		for (const one of ["input1", "input2", "input3", "input4"])
		{
			if(!hdmi[one]) { continue; }
			this.message.payload.inputs[one] = {
				name: hdmi[one].name ? hdmi[one].name : one,
				type: hdmi[one].type ? hdmi[one].type : false,
				status: hdmi[one].status ? hdmi[one].status : "unknown",
				active: (execution.hdmiSource === one)
			};
		}

		this.message.info = {};
		this.message.info.id = device.uniqueId ? device.uniqueId : false;
		this.message.info.name = device.name ? device.name : false;
		this.message.info.type = "syncbox";
		this.message.info.ipAddress = device.ipAddress ? device.ipAddress : false;
		this.message.info.softwareVersion = device.firmwareVersion ? device.firmwareVersion : false;
		this.message.info.apiLevel = device.apiLevel ? device.apiLevel : false;
		this.message.info.ledMode = (typeof device.ledMode != 'undefined') ? device.ledMode : false;
		this.message.info.wifi = device.wifi ? { ssid: device.wifi.ssid, strength: device.wifi.strength } : false;

		this.message.info.model = {
			id: device.deviceType ? device.deviceType : false,
			manufacturer: "Signify",
			name: "Hue Play HDMI Sync Box"
		};
	}

	get msg()
	{
		return this.message;
	}
}


//
// EXPORT
module.exports = { HueBridgeMessage, HueBrightnessMessage, HueGroupMessage, HueLightMessage, HueMotionMessage, HueContactMessage, HueRulesMessage, HueButtonsMessage, HueTemperatureMessage, HueSpeakerMessage, HueAutomationMessage, HueSyncBoxMessage, serviceTypes, servesType }
