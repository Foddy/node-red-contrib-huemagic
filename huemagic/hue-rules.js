module.exports = function(RED)
{
	"use strict";

	function HueRules(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let moment = require('moment');

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
			var lastTriggered = moment.utc(rule.lastTriggered).local().format();

			var message = {};
			message.payload = {};
			message.payload.triggered = (rule.lastTriggered != null) ? lastTriggered : false;

			message.info = {};
			message.info.id = rule.id;
			message.info.created = moment.utc(rule.created).local().format();
			message.info.name = rule.name;
			message.info.timesTriggered = rule.timesTriggered;
			message.info.owner = rule.owner;
			message.info.status = rule.status;

			message.conditions = [];
			for (let condition of rule.conditions)
			{
				var conditionValues = {};
				conditionValues.address = condition.address;
				conditionValues.operator = condition.operator;
				conditionValues.value = condition.value;

				message.conditions.push(conditionValues);
			}

			message.actions = [];
			for (let action of rule.actions)
			{
				var actionValues = {};
				actionValues.address = action.address;
				actionValues.method = action.method;
				actionValues.body = action.body;

				message.actions.push(actionValues);
			}

			if(!config.skipevents) { scope.send(message); }

			if(rule.status == "enabled")
			{
				scope.status({fill: "green", shape: "dot", text: "hue-rules.node.enabled"});
			}
			else
			{
				scope.status({fill: "red", shape: "ring", text: "hue-rules.node.disabled"});
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
					var lastTriggered = moment.utc(rule.lastTriggered).local().format();

					var message = {};
					message.payload = {};
					message.payload.triggered = (rule.lastTriggered != null) ? lastTriggered : false;

					message.info = {};
					message.info.id = rule.id;
					message.info.created = moment.utc(rule.created).local().format();
					message.info.name = rule.name;
					message.info.timesTriggered = rule.timesTriggered;
					message.info.owner = rule.owner;
					message.info.status = rule.status;

					message.conditions = [];
					for (let condition of rule.conditions)
					{
						var conditionValues = {};
						conditionValues.address = condition.address;
						conditionValues.operator = condition.operator;
						conditionValues.value = condition.value;

						message.conditions.push(conditionValues);
					}

					message.actions = [];
					for (let action of rule.actions)
					{
						var actionValues = {};
						actionValues.address = action.address;
						actionValues.method = action.method;
						actionValues.body = action.body;

						message.actions.push(actionValues);
					}

					if(!config.skipevents) { send(message); }
					if(done) { done(); }

					if(msg.payload == false)
					{
						scope.status({fill: "red", shape: "ring", text: "hue-rules.node.disabled"});
					}
					else
					{
						scope.status({fill: "green", shape: "dot", text: "hue-rules.node.enabled"});
					}
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
