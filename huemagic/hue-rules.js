module.exports = function(RED)
{
	"use strict";

	function HueRules(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let { HueRulesMessage } = require('../utils/messages');

		//
		// CHECK CONFIG
		if(!config.ruleid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-rules.node.no-rule"});
			return false;
		}

		//
		// UPDATE STATE
		if(typeof bridge.disableupdates != 'undefined'||bridge.disableupdates == false)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-rules.node.init"});
		}

		//
		// ON UPDATE
		bridge.events.on('rule' + config.ruleid, function(rule)
		{
			// SEND STATUS
			if(rule.status == "enabled")
			{
				scope.status({fill: "green", shape: "dot", text: "hue-rules.node.enabled"});
			}
			else
			{
				scope.status({fill: "red", shape: "ring", text: "hue-rules.node.disabled"});
			}

			// SEND MESSAGE
			if(!config.skipevents)
			{
				var hueRule = new HueRulesMessage(rule);
				scope.send(hueRule.msg);
			}
		});


		//
		// DISABLE / ENABLE RULE
		this.on('input', function(msg, send, done)
		{
			// Node-RED < 1.0
			send = send || function() { scope.send.apply(scope,arguments); }

			if(msg.payload == true || msg.payload == false)
			{
				bridge.client.rules.getById(config.ruleid)
				.then(rule => {
					rule.status = (msg.payload == true) ? 'enabled' : 'disabled';
					return bridge.client.rules.save(rule);
				})
				.then(rule => {
					// SEND STATUS
					if(msg.payload == false)
					{
						scope.status({fill: "red", shape: "ring", text: "hue-rules.node.disabled"});
					}
					else
					{
						scope.status({fill: "green", shape: "dot", text: "hue-rules.node.enabled"});
					}

					// SEND MESSAGE
					if(!config.skipevents)
					{
						var hueRule = new HueRulesMessage(rule);
						send(hueRule.msg);
					}
					if(done) { done(); }
				})
				.catch(error => {
					scope.error(error, msg);
					if(done) { done(error); }
				});
			}
		});

		//
		// CLOSE NODE / REMOVE EVENT LISTENER
		this.on('close', function()
		{
			bridge.events.removeAllListeners('rule' + config.ruleid);
		});
	}

	RED.nodes.registerType("hue-rules", HueRules);
}
