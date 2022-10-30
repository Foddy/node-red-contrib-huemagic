module.exports = function(RED)
{
	"use strict";

	function HueRules(config)
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
			this.status({fill: "red", shape: "ring", text: "hue-rules.node.no-rule"});
			return false;
		}

		//
		// UNIVERSAL MODE?
		if(!config.ruleid)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-rules.node.universal"});
		}

		//
		// UPDATE STATE
		if(typeof bridge.disableupdates != 'undefined' || bridge.disableupdates == false)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-rules.node.init"});
		}

		//
		// SUBSCRIBE TO UPDATES FROM THE BRIDGE
		bridge.subscribe("rule", config.ruleid, function(info)
		{
			let currentState = bridge.get("rule", info.id);

			// RESOURCE FOUND?
			if(currentState !== false)
			{
				// NOT IN UNIVERAL MODE? -> CHANGE UI STATES
				if(config.ruleid)
				{
					if(currentState.payload.enabled == true)
					{
						scope.status({fill: "green", shape: "dot", text: "hue-rules.node.enabled"});
					}
					else
					{
						scope.status({fill: "red", shape: "ring", text: "hue-rules.node.disabled"});
					}
				}

				// SEND MESSAGE
				if(!config.skipevents && (config.initevents || info.suppressMessage == false))
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
		// DISABLE / ENABLE RULE
		this.on('input', function(msg, send, done)
		{
			// REDEFINE SEND AND DONE IF NOT AVAILABLE
			send = send || function() { scope.send.apply(scope,arguments); }
			done = done || function() { scope.done.apply(scope,arguments); }

			// SAVE LAST COMMAND
			scope.lastCommand = RED.util.cloneMessage(msg);

			// CREATE PATCH
			let patchObject = {};

			// DEFINE SENSOR ID & CURRENT STATE
			const tempRuleID = (!config.ruleid && typeof msg.topic != 'undefined' && isNaN(msg.topic) == false) ? msg.topic : config.ruleid;
			if(!tempRuleID)
			{
				scope.error("Please submit a valid rule ID.");
				return false;
			}

			let currentState = bridge.get("rule", "rule_" + tempRuleID);
			if(!currentState)
			{
				scope.error("The rule in not yet available. Please wait until HueMagic has established a connection with the bridge or check whether the resource ID in the configuration is valid.");
				return false;
			}

			// CONTROL RULE
			if(msg.payload === true || msg.payload === false)
			{
				if(msg.payload === currentState.payload.enabled) { return false; }
				patchObject["status"] = (msg.payload == true) ? 'enabled' : 'disabled';

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
					bridge.patch("rules", "/rules/"+tempRuleID, patchObject, 1)
					.then(function(response) { bridge.refetchRule(tempRuleID); callback(null, true); })
					.catch(function(errors) { callback(errors, null); });
				},
				function(errors, success)
				{
					if(errors)
					{
						scope.error(errors);
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

				if(done) {done();}
			}
		});
	}

	RED.nodes.registerType("hue-rules", HueRules);
}
