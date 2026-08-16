module.exports = function(RED)
{
	"use strict";

	const API = require('./utils/syncbox');
	const events = require('events');
	const dayjs = require('dayjs');
	const diff = require("deep-object-diff").diff;

	const { HueSyncBoxMessage } = require('./utils/messages');

	function HueSyncBox(config)
	{
		const scope = this;

		// STATES
		this.nodeActive = true;
		this.config = config;
		this.state = false;
		this.lastState = false;
		this.events = new events.EventEmitter();
		this.events.setMaxListeners(0);
		this.pollTimeout = null;
		this.failures = 0;

		// RESOURCE ID PATTERN (NEVER GLOBAL, "test" WOULD BECOME STATEFUL)
		this.validResourceID = /^[a-zA-Z0-9-]+$/i;

		// CREATE NODE
		RED.nodes.createNode(scope, config);

		// THE BOX HAS NO EVENT STREAM, SO IT HAS TO BE ASKED
		this.pollInterval = config.pollinterval ? parseInt(config.pollinterval) * 1000 : 10000;

		//
		// KEEP THE STATE UP-TO-DATE
		this.poll = function(immediately = false)
		{
			if(scope.pollTimeout !== null) { clearTimeout(scope.pollTimeout); }
			if(scope.nodeActive === false) { return false; }

			scope.pollTimeout = setTimeout(function()
			{
				API.state(config)
				.then(function(state)
				{
					if(scope.failures > 0) { scope.log(RED._("hue-syncbox-config.node.connected")); }
					scope.failures = 0;

					state.updated = dayjs().format();
					scope.state = state;

					scope.pushUpdatedState();
					scope.poll();
				})
				.catch(function(error)
				{
					scope.failures += 1;

					// ONLY COMPLAIN ONCE PER OUTAGE
					if(scope.failures === 1)
					{
						scope.log(RED._("hue-syncbox-config.node.request-error", { error: JSON.stringify(error.errors ? error.errors : error) }));
					}

					scope.events.emit(config.id + "_unreachable", true);
					scope.poll();
				});
			}, immediately ? 100 : scope.pollInterval);
		}

		//
		// PUSH THE STATE TO THE NODES
		this.pushUpdatedState = function()
		{
			const suppressMessage = (scope.lastState === false);
			scope.events.emit(config.id + "_syncbox", { suppressMessage: suppressMessage });
		}

		//
		// GET THE CURRENT STATE (FROM NODES)
		this.get = function()
		{
			if(!scope.state) { return false; }

			try {
				const message = new HueSyncBoxMessage(scope.state);
				const previous = scope.lastState ? structuredClone(scope.lastState) : false;

				let currentState = message.msg;
				scope.lastState = structuredClone(currentState);

				currentState.updated = (previous === false) ? {} : diff(previous, currentState);
				currentState.lastState = previous;

				return currentState;
			} catch (error) {
				return false;
			}
		}

		//
		// CHANGE WHAT THE BOX IS DOING (FROM NODES)
		this.execute = function(patch)
		{
			return API.execute(config, patch).then(function(response)
			{
				// THE BOX ANSWERS WITHOUT A BODY, SO ASK IT AGAIN RIGHT AWAY
				scope.poll(true);
				return response;
			});
		}

		//
		// SUBSCRIBE (FROM NODES)
		this.subscribe = function(callback)
		{
			const eventName = config.id + "_syncbox";
			scope.events.on(eventName, callback);

			// THE CONFIG NODE OUTLIVES A REDEPLOY, SO EVERY NODE HAS TO DETACH ITSELF AGAIN
			return function() { scope.events.removeListener(eventName, callback); };
		}

		//
		// START POLLING
		this.log(RED._("hue-syncbox-config.node.initializing", { syncbox: config.syncbox }));
		this.poll(true);

		//
		// CLOSE NODE
		this.on('close', function()
		{
			scope.nodeActive = false;
			if(scope.pollTimeout !== null) { clearTimeout(scope.pollTimeout); }
			scope.events.removeAllListeners();
		});
	}

	RED.nodes.registerType("hue-syncbox-config", HueSyncBox);

	//
	// GET THE NAME OF A SYNC BOX
	RED.httpAdmin.get('/hue/syncbox/name', RED.auth.needsPermission('hue-syncbox-config.read'), function(req, res, next)
	{
		if(!req.query.ip)
		{
			return res.status(500).send(RED._("hue-syncbox-config.config.missing-ip"));
		}

		// THE DEVICE ENDPOINT ANSWERS THE NAME EVEN WITHOUT A TOKEN
		API.request({ config: { syncbox: req.query.ip }, resource: "/device", token: false })
		.then(function(device) { res.end(device.name ? device.name : "Hue Sync Box"); })
		.catch(function(error) { res.status(500).send(error.errors ? JSON.stringify(error.errors) : "error"); });
	});

	//
	// REGISTER WITH A SYNC BOX
	RED.httpAdmin.get('/hue/syncbox/register', RED.auth.needsPermission('hue-syncbox-config.read'), function(req, res, next)
	{
		if(!req.query.ip)
		{
			return res.status(500).send(RED._("hue-syncbox-config.config.missing-ip"));
		}

		API.register({ syncbox: req.query.ip })
		.then(function(registration)
		{
			if(!registration || !registration.accessToken) { return res.end("error"); }
			res.end(JSON.stringify(registration));
		})
		.catch(function(error)
		{
			// CODE 16 MEANS THE BUTTON ON THE BOX HAS NOT BEEN PRESSED YET
			if(error.code === 16) { return res.end("error"); }
			res.status(500).send(error.errors ? JSON.stringify(error.errors) : "error");
		});
	});
};
