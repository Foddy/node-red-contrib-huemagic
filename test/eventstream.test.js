const test = require('node:test');
const assert = require('node:assert');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const API = require('../huemagic/utils/api');

const tls = {
	key: fs.readFileSync(path.join(__dirname, 'fixtures', 'key.pem')),
	cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'cert.pem'))
};

//
// A BRIDGE THAT SPEAKS THE EVENT STREAM
function fakeBridge(onConnection)
{
	return new Promise(function(resolve)
	{
		const server = https.createServer(tls, function(req, res)
		{
			res.writeHead(200, { "Content-Type": "text/event-stream", "Connection": "keep-alive" });
			res.flushHeaders();
			onConnection(req, res, server);
		});

		server.listen(0, "127.0.0.1", function() { resolve(server); });
	});
}

function waitFor(check, timeout = 5000)
{
	return new Promise(function(resolve, reject)
	{
		const started = Date.now();
		const poll = setInterval(function()
		{
			if(check()) { clearInterval(poll); return resolve(true); }
			if(Date.now() - started > timeout) { clearInterval(poll); reject(new Error("timed out")); }
		}, 10);
	});
}

test('eventstream: receives updates and passes on the event type', async function(t)
{
	let seenKey = false;
	let seenAccept = false;

	const server = await fakeBridge(function(req, res)
	{
		seenKey = req.headers["hue-application-key"];
		seenAccept = req.headers["accept"];

		// SPLIT ON PURPOSE, THE CLIENT HAS TO REASSEMBLE IT
		res.write(": hi\n\nid: 100:0\ndata: [{\"type\":\"update\",\"data\":[{\"id\":\"a\",");
		setTimeout(function() { res.write("\"type\":\"light\"}]}]\n\n"); }, 20);
	});

	const config = { id: "stream-1", bridge: "127.0.0.1:" + server.address().port, key: "secret" };
	let received = [];

	t.after(function() { API.unsubscribe(config); server.close(); });

	await API.subscribe(config, function(data, type) { received.push({ data: data, type: type }); });
	await waitFor(function() { return received.length > 0; });

	assert.strictEqual(seenKey, "secret");
	assert.strictEqual(seenAccept, "text/event-stream");
	assert.strictEqual(received[0].type, "update");
	assert.deepStrictEqual(received[0].data, [{ id: "a", type: "light" }]);
	assert.strictEqual(API.connected(config), true);
});

test('eventstream: reconnects after the bridge drops the connection', async function(t)
{
	let connections = 0;
	let resumedFrom = null;

	const server = await fakeBridge(function(req, res)
	{
		connections += 1;

		if(connections === 1)
		{
			res.write("id: 42:0\ndata: [{\"type\":\"update\",\"data\":[{\"id\":\"a\"}]}]\n\n");
			setTimeout(function() { res.destroy(); }, 20);
		}
		else
		{
			resumedFrom = req.headers["last-event-id"];
		}
	});

	const config = { id: "stream-2", bridge: "127.0.0.1:" + server.address().port, key: "secret" };
	let events = [];

	t.after(function() { API.unsubscribe(config); server.close(); });

	await API.subscribe(config, function(data, type) { events.push(type); });
	await waitFor(function() { return events.includes("reconnect"); }, 8000);

	assert.strictEqual(resumedFrom, "42:0", "the client has to resume where it left off");
	assert.ok(events.includes("reconnect"), "a reconnect has to be announced so state can be re-read");
});

test('eventstream: unsubscribing stops the reconnect loop', async function(t)
{
	let connections = 0;

	const server = await fakeBridge(function(req, res)
	{
		connections += 1;
		res.destroy();
	});

	const config = { id: "stream-3", bridge: "127.0.0.1:" + server.address().port, key: "secret" };
	t.after(function() { server.close(); });

	await API.subscribe(config, function() {});
	await waitFor(function() { return connections >= 1; });

	API.unsubscribe(config);
	const seen = connections;

	await new Promise(function(resolve) { setTimeout(resolve, 1500); });

	assert.strictEqual(connections, seen, "no further connection attempts after unsubscribe");
	assert.strictEqual(API.connected(config), false);
});
