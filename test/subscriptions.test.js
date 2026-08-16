const test = require('node:test');
const assert = require('node:assert');
const events = require('node:events');
const fs = require('node:fs');
const path = require('node:path');

const API = require('../huemagic/utils/api');

// KEEP THE BRIDGE OFF THE NETWORK: start() WAITS ON A PROMISE THAT NEVER SETTLES
API.init = function() { return new Promise(function() {}); };

//
// THE SMALLEST NODE-RED THAT hue-bridge-config NEEDS
function stubRED()
{
	let registered = {};

	return {
		nodes: {
			createNode: function(node, config)
			{
				Object.assign(node, events.EventEmitter.prototype);
				events.EventEmitter.call(node);
				node.log = function() {};
				node.error = function() {};
			},
			registerType: function(type, constructor) { registered[type] = constructor; },
			getNode: function() { return null; }
		},
		httpAdmin: { get: function() {} },
		auth: { needsPermission: function() { return function() {}; } },
		_: function(key) { return key; },
		util: { cloneMessage: function(m) { return m; } },
		registered: registered
	};
}

function newBridge()
{
	const RED = stubRED();
	require('../huemagic/hue-bridge-config.js')(RED);

	const bridge = Object.create(null);
	const HueBridge = RED.registered["hue-bridge"];

	// CALL THE CONSTRUCTOR THE WAY NODE-RED DOES
	const instance = {};
	HueBridge.call(instance, { id: "bridge-1", bridge: "127.0.0.1", key: "x" });

	return instance;
}

test('subscriptions: subscribe gives back a working disposer', function()
{
	const bridge = newBridge();
	let received = 0;

	const off = bridge.subscribe("light", "light-1", function() { received += 1; });
	assert.strictEqual(typeof off, "function", "subscribe has to return the disposer");

	bridge.events.emit("bridge-1_light-1", { updatedType: "light", services: ["light"], suppressMessage: false });
	assert.strictEqual(received, 1);

	off();

	bridge.events.emit("bridge-1_light-1", { updatedType: "light", services: ["light"], suppressMessage: false });
	assert.strictEqual(received, 1, "no more messages after detaching");
});

test('subscriptions: a redeploy does not stack listeners on the surviving config node', function()
{
	const bridge = newBridge();
	const eventName = "bridge-1_light-1";
	let calls = 0;

	// THREE DEPLOYS OF THE SAME NODE, EACH ONE DETACHING BEFORE THE NEXT
	for(let deploy = 0; deploy < 3; deploy++)
	{
		const off = bridge.subscribe("light", "light-1", function() { calls += 1; });
		assert.strictEqual(bridge.events.listenerCount(eventName), 1, "deploy " + deploy + " must not stack listeners");
		off();
	}

	assert.strictEqual(bridge.events.listenerCount(eventName), 0);

	bridge.events.emit(eventName, { updatedType: "light", services: ["light"], suppressMessage: false });
	assert.strictEqual(calls, 0);
});

test('subscriptions: universal mode detaches from the global channel too', function()
{
	const bridge = newBridge();
	const eventName = "bridge-1_globalResourceUpdates";

	const off = bridge.subscribe("motion", null, function() {});
	assert.strictEqual(bridge.events.listenerCount(eventName), 1);

	off();
	assert.strictEqual(bridge.events.listenerCount(eventName), 0);
});

test('subscriptions: every node detaches from the bridge when it is closed', function()
{
	const nodes = path.join(__dirname, '..', 'huemagic');
	let offenders = [];

	for(const file of fs.readdirSync(nodes).filter(function(f) { return f.endsWith('.js') && f !== 'hue-bridge-config.js'; }))
	{
		const source = fs.readFileSync(path.join(nodes, file), 'utf8');
		if(!source.includes('bridge.subscribe(')) { continue; }

		if(!/this\.unsubscribe = bridge\.subscribe\(/.test(source)) { offenders.push(file + ": does not keep the disposer"); }
		if(!/scope\.unsubscribe\(\)/.test(source)) { offenders.push(file + ": never calls the disposer on close"); }
	}

	assert.deepStrictEqual(offenders, [], "nodes that would leak listeners on redeploy");
});

//
// EVERY EVENT-CAPABLE NODE GATES ITS OUTPUT THE SAME WAY
test('events: the output gate honours skipevents, initevents and onlycommands', function()
{
	const nodes = ["hue-light","hue-group","hue-motion","hue-contact","hue-temperature",
	               "hue-brightness","hue-buttons","hue-rules","hue-speaker","hue-automation","hue-syncbox"];

	// THE GUARD AS IT IS WRITTEN IN THE NODES
	const gate = function(config, info, lastCommand, hasEvent)
	{
		return (!config.skipevents && (hasEvent !== false) && (config.initevents || info.suppressMessage == false) && (!config.onlycommands || lastCommand !== null));
	};

	const update = { suppressMessage: false };
	const init = { suppressMessage: true };

	// DEFAULT: EVERY UPDATE IS REPORTED, THE INITIALIZATION IS NOT
	assert.strictEqual(gate({}, update, null), true);
	assert.strictEqual(gate({}, init, null), false);
	assert.strictEqual(gate({ initevents: true }, init, null), true);
	assert.strictEqual(gate({ skipevents: true }, update, {}), false, "skipevents wins over everything");

	// ONLYCOMMANDS: SILENT UNTIL A COMMAND CAME IN
	assert.strictEqual(gate({ onlycommands: true }, update, null), false, "a change from the app stays silent");
	assert.strictEqual(gate({ onlycommands: true }, update, { payload: true }), true, "the answer to a command is reported");
	assert.strictEqual(gate({ onlycommands: true, initevents: true }, init, null), false);

	// AND EVERY NODE REALLY CARRIES THAT GUARD
	for(const node of nodes)
	{
		const source = fs.readFileSync(path.join(__dirname, '..', 'huemagic', node + '.js'), 'utf8');
		assert.ok(source.includes("!config.onlycommands || scope.lastCommand !== null"), node + " has to gate on onlycommands");
		assert.ok(source.includes("scope.lastCommand = null"), node + " has to reset the last command after sending");
	}
});
