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
			this.status({fill: "red", shape: "ring", text: "no rule selected"});
			return false;
		}

		//
		// UPDATE STATE
		if(typeof bridge.disableupdates != 'undefined'||bridge.disableupdates == false)
		{
			this.status({fill: "grey", shape: "dot", text: "initializing…"});
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

			if(typeof config.skipevents != 'undefined'||config.skipevents == false) { scope.send(message); }

			if(rule.status == "enabled")
			{
				scope.status({fill: "green", shape: "dot", text: "enabled"});
			}
			else
			{
				scope.status({fill: "red", shape: "ring", text: "disabled"});
			}
		});


		//
		// DISABLE / ENABLE RULE
		this.on('input', function(msg)
		{
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

					if(typeof config.skipevents != 'undefined'||config.skipevents == false) { scope.send(message); }

					if(msg.payload == false)
					{
						scope.status({fill: "red", shape: "ring", text: "disabled"});
					}
					else
					{
						scope.status({fill: "green", shape: "dot", text: "enabled"});
					}
				})
				.catch(error => {
					scope.error(error, msg);
				});
			}
		});

		//
		// CLOSE NDOE / REMOVE RECHECK INTERVAL
		this.on('close', function()
		{
			bridge.events.removeAllListeners('rule' + config.ruleid);
		});
	}

	RED.nodes.registerType("hue-rules", HueRules);
}
