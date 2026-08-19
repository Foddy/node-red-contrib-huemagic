const test = require('node:test');
const assert = require('node:assert');

//
// THE SMALLEST NODE-RED THAT hue-buttons NEEDS, WIRED TO A FAKE BRIDGE
function newButtonsNode(config, buttonResource)
{
	let statusHistory = [];
	let sendHistory = [];
	let subscribedCallback = null;

	const bridge = {
		subscribe: function(type, id, cb) { subscribedCallback = cb; return function() {}; },
		get: function(type, id) { return (typeof buttonResource === "function") ? buttonResource(id) : buttonResource; },
		resources: {}
	};

	let registeredCtor = null;
	const RED = {
		nodes: {
			createNode: function(node)
			{
				node.on = function() {};
				node.status = function(s) { statusHistory.push(s); };
				node.send = function(msg) { sendHistory.push(msg); };
			},
			getNode: function() { return bridge; },
			registerType: function(type, ctor) { registeredCtor = ctor; }
		},
		_: function(key) { return key; },
		util: { cloneMessage: function(m) { return JSON.parse(JSON.stringify(m)); } }
	};

	require('../huemagic/hue-buttons.js')(RED);

	const instance = {};
	registeredCtor.call(instance, config);

	return {
		fire: function(info) { subscribedCallback(info || { id: config.sensorid, suppressMessage: false }); },
		sendHistory: sendHistory,
		statusHistory: statusHistory
	};
}

function baseConfig(rules)
{
	return {
		bridge: "bridge-1",
		sensorid: "sensor-1",
		skipevents: false,
		initevents: true,
		onlycommands: false,
		rules: rules
	};
}

function universalConfig(rules)
{
	const config = baseConfig(rules);
	config.sensorid = "";
	return config;
}

const RULE_1_TO_4 = { buttonFrom: 1, buttonTo: 4, onStartPress: false, onEndShortPress: true, onEndLongPress: true, onDuringLongPress: false, minLongPressDuration: 1000 };
const RULE_5_TO_8 = { buttonFrom: 5, buttonTo: 8, onStartPress: false, onEndShortPress: true, onEndLongPress: true, onDuringLongPress: false, minLongPressDuration: 1000 };

test('hue-buttons additional outputs: a short press only reaches the output whose button range matches', function()
{
	const resource = { payload: { button: 2, rotation: false, action: "short_release" } };
	const node = newButtonsNode(baseConfig([RULE_1_TO_4, RULE_5_TO_8]), resource);

	node.fire();

	assert.strictEqual(node.sendHistory.length, 1, "one send() call expected");
	const multiOutput = node.sendHistory[0];
	assert.strictEqual(multiOutput.length, 3, "expected [main, rule 1-4, rule 5-8]");
	assert.ok(multiOutput[0], "output 1 (main) must always get the message");
	assert.ok(multiOutput[1], "output 2 (rule 1-4) must get the short-press message for button 2");
	assert.strictEqual(multiOutput[2], null, "output 3 (rule 5-8) must stay empty for button 2");
});

test('hue-buttons additional outputs: the same press routes to a different output for a button in another range', function()
{
	const resource = { payload: { button: 6, rotation: false, action: "short_release" } };
	const node = newButtonsNode(baseConfig([RULE_1_TO_4, RULE_5_TO_8]), resource);

	node.fire();

	const multiOutput = node.sendHistory[0];
	assert.ok(multiOutput[0], "output 1 (main) must always get the message");
	assert.strictEqual(multiOutput[1], null, "output 2 (rule 1-4) must stay empty for button 6");
	assert.ok(multiOutput[2], "output 3 (rule 5-8) must get the message for button 6");
});

test('hue-buttons additional outputs: a long press below the configured minimum duration is not routed', function()
{
	const resource = { payload: { button: 1, rotation: false, action: "initial_press" } };
	const node = newButtonsNode(baseConfig([RULE_1_TO_4]), resource);

	// START OF THE PRESS, THEN RELEASE IMMEDIATELY (SHORTER THAN minLongPressDuration)
	node.fire();
	resource.payload.action = "long_release";
	node.fire();

	const multiOutput = node.sendHistory[node.sendHistory.length - 1];
	assert.ok(multiOutput[0], "output 1 (main) must always get the message");
	assert.strictEqual(multiOutput[1], null, "a long press shorter than minLongPressDuration must not reach the rule output");
});

test('hue-buttons additional outputs: dial rotation events are not matched against button-range rules', function()
{
	const resource = { payload: { button: false, rotation: { clockwise: true, degrees: 30 }, action: null } };
	const node = newButtonsNode(baseConfig([RULE_1_TO_4]), resource);

	node.fire();

	assert.strictEqual(node.sendHistory[0].length, 1, "dial rotation must not populate any rule output");
	assert.strictEqual(node.statusHistory[node.statusHistory.length - 1].text, "hue-buttons.node.dial-clockwise");
});

test('hue-buttons additional outputs: an empty rule list still sends a single-output message', function()
{
	const resource = { payload: { button: 3, rotation: false, action: "short_release" } };
	const node = newButtonsNode(baseConfig([]), resource);

	node.fire();

	assert.deepStrictEqual(node.sendHistory[0].length, 1, "no rules configured means no extra outputs");
});

test('hue-buttons additional outputs: two devices do not share the press state of the same button number', async function()
{
	const resources = {
		"device-a": { payload: { button: 1, rotation: false, action: "initial_press" } },
		"device-b": { payload: { button: 1, rotation: false, action: "initial_press" } }
	};

	const rule = Object.assign({}, RULE_1_TO_4, { minLongPressDuration: 300 });
	const node = newButtonsNode(universalConfig([rule]), function(id) { return resources[id]; });

	// BUTTON 1 OF DEVICE A IS PRESSED AND KEPT DOWN
	node.fire({ id: "device-a", suppressMessage: false });
	await new Promise(function(resolve) { setTimeout(resolve, 350); });

	// WHILE IT IS STILL HELD, BUTTON 1 OF DEVICE B IS PRESSED AS WELL
	node.fire({ id: "device-b", suppressMessage: false });

	// ONLY NOW DEVICE A IS RELEASED, WHICH IS A LONG PRESS OF ITS OWN
	resources["device-a"].payload.action = "long_release";
	node.fire({ id: "device-a", suppressMessage: false });

	const multiOutput = node.sendHistory[node.sendHistory.length - 1];
	assert.ok(multiOutput[1], "the long press of device A must be measured against its own start, not against the press of device B");
});

test('hue-buttons additional outputs: an unknown action is not routed like the one before it', function()
{
	const resource = { payload: { button: 1, rotation: false, action: "short_release" } };
	const node = newButtonsNode(baseConfig([RULE_1_TO_4]), resource);

	node.fire();
	assert.ok(node.sendHistory[0][1], "the short press must reach the rule output");

	resource.payload.action = "an_action_the_bridge_did_not_have_yet";
	node.fire();
	assert.strictEqual(node.sendHistory[1][1], null, "an unknown action must not inherit the type of the previous one");
});

test('hue-buttons status: a held button is reported with its duration', async function()
{
	const resource = { payload: { button: 2, rotation: false, action: "initial_press" } };
	const node = newButtonsNode(baseConfig([]), resource);

	node.fire();
	await new Promise(function(resolve) { setTimeout(resolve, 25); });

	resource.payload.action = "long_release";
	node.fire();

	assert.strictEqual(node.statusHistory[node.statusHistory.length - 1].text, "hue-buttons.node.button-status-duration");
});

test('hue-buttons status: a short press is reported without a duration', function()
{
	const resource = { payload: { button: 2, rotation: false, action: "short_release" } };
	const node = newButtonsNode(baseConfig([]), resource);

	node.fire();

	assert.strictEqual(node.statusHistory[node.statusHistory.length - 1].text, "hue-buttons.node.button-status");
});
