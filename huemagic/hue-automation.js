module.exports = function(RED)
{
	"use strict";

	function HueAutomation(config)
	{
		RED.nodes.createNode(this, config);

		const scope = this;
		const bridge = RED.nodes.getNode(config.bridge);
		const async = require('async');

		// SAVE LAST COMMAND
		this.lastCommand = null;

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-automation.node.not-configured"});
			return false;
		}

		//
		// UNIVERSAL MODE?
		if(!config.automationid)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-automation.node.universal"});
		}
		else
		{
			this.status({fill: "grey", shape: "dot", text: "hue-automation.node.init"});
		}

		//
		// SUBSCRIBE TO UPDATES FROM THE BRIDGE
		this.unsubscribe = bridge.subscribe("automation", config.automationid, function(info)
		{
			let currentState = bridge.get("automation", info.id);

			// RESOURCE FOUND?
			if(currentState !== false)
			{
				// NOT IN UNIVERAL MODE? -> CHANGE UI STATES
				if(config.automationid)
				{
					if(currentState.payload.status === "errored")
					{
						scope.status({fill: "red", shape: "ring", text: "hue-automation.node.errored"});
					}
					else if(currentState.payload.enabled === true)
					{
						scope.status({fill: "green", shape: "dot", text: "hue-automation.node.enabled"});
					}
					else
					{
						scope.status({fill: "grey", shape: "ring", text: "hue-automation.node.disabled"});
					}
				}

				// SEND MESSAGE
				if(!config.skipevents && (config.initevents || info.suppressMessage == false) && (!config.onlycommands || scope.lastCommand !== null))
				{
					// SET LAST COMMAND
					if(scope.lastCommand !== null)
					{
						currentState.command = scope.lastCommand;
					}

					// SEND STATE
					scope.send(currentState);

					// RESET LAST COMMAND
					scope.lastCommand = null;
				}
			}
		});

		//
		// ENABLE / DISABLE THE AUTOMATION
		this.on('input', function(msg, send, done)
		{
			// REDEFINE SEND AND DONE IF NOT AVAILABLE
			send = send || function() { scope.send.apply(scope,arguments); }
			done = done || function() { scope.done.apply(scope,arguments); }

			// SAVE LAST COMMAND
			scope.lastCommand = RED.util.cloneMessage(msg);

			// DEFINE AUTOMATION ID
			const tempAutomationID = (!config.automationid && typeof msg.topic != 'undefined' && bridge.validResourceID.test(msg.topic) === true) ? msg.topic : config.automationid;
			if(!tempAutomationID)
			{
				scope.error(RED._("hue-automation.node.error-no-id"), msg);
				return false;
			}

			// GET CURRENT STATE
			let currentState = bridge.get("automation", tempAutomationID);
			if(!currentState)
			{
				scope.error(RED._("hue-automation.node.error-not-available"), msg);
				return false;
			}

			// CONTROL THE AUTOMATION
			const enable = (msg.payload === true || msg.payload === false) ? msg.payload : ((typeof msg.payload != 'undefined' && typeof msg.payload.enabled != 'undefined') ? (msg.payload.enabled === true) : null);
			const toggle = (typeof msg.payload != 'undefined' && typeof msg.payload.toggle != 'undefined');

			if(enable !== null || toggle)
			{
				const target = toggle ? !currentState.payload.enabled : enable;

				// CHANGE NODE UI STATE
				if(config.automationid)
				{
					scope.status({fill: "grey", shape: "ring", text: "hue-automation.node.command"});
				}

				// PATCH!
				async.retry({
					times: 5,
					errorFilter: function(err) {
						return (err.status == 503 || err.status == 429);
					},
					interval: function(retryCount) { return 750*retryCount; }
				},
				function(callback, results)
				{
					bridge.patch("behavior_instance", tempAutomationID, { enabled: target })
					.then(function() { callback(null, true); })
					.catch(function(errors) { callback(errors, null); });
				},
				function(errors, success)
				{
					if(errors)
					{
						scope.error(errors, msg);
					}
					else if(done)
					{
						done();
					}
				});
			}
			else
			{
				// SET LAST COMMAND
				if(scope.lastCommand !== null)
				{
					currentState.command = scope.lastCommand;
				}

				// SEND STATE
				scope.send(currentState);

				// RESET LAST COMMAND
				scope.lastCommand = null;

				if(done) { done(); }
			}
		});

		//
		// CLOSE NODE / DETACH FROM THE BRIDGE
		this.on('close', function()
		{
			if(scope.unsubscribe) { scope.unsubscribe(); }
		});
	}

	RED.nodes.registerType("hue-automation", HueAutomation);
}
