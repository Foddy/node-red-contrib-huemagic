module.exports = function(RED)
{
	"use strict";

	function HueSwitch(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let moment = require('moment');

		//
		// MEMORY
		this.lastUpdated = false;

		//
		// CHECK CONFIG
		if(!config.sensorid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-switch.node.not-configured"});
			return false;
		}

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "hue-switch.node.waiting"});

		//
		// ON UPDATE
		bridge.events.on('sensor' + config.sensorid, function(sensor)
		{
			var lastUpdated = scope.lastUpdated || false;
			if(sensor.state.lastUpdated != lastUpdated)
			{
				scope.lastUpdated = sensor.state.lastUpdated;

				// RETURN ON FIRST DEPLOY
				if (lastUpdated === false) {
					return;
				}

				// DEFINE HUMAN READABLE BUTTON NAME
				var buttonName = "";
				var buttonNameLocalized = "";
				if(sensor.state.buttonEvent < 2000)
				{
					buttonName = "On";
					buttonNameLocalized = RED._("hue-switch.node.button-on");
				}
				else if(sensor.state.buttonEvent < 3000)
				{
					buttonName = "Dim Up";
					buttonNameLocalized = RED._("hue-switch.node.button-dimup");
				}
				else if(sensor.state.buttonEvent < 4000)
				{
					buttonName = "Dim Down";
					buttonNameLocalized = RED._("hue-switch.node.button-dimdown");
				}
				else
				{
					buttonName = "Off";
					buttonNameLocalized = RED._("hue-switch.node.button-off");
				}

				// DEFINE HUMAN READABLE BUTTON ACTION
				var buttonAction = "";
				var buttonActionLocalized = "";
				var buttonActionRaw = parseInt(sensor.state.buttonEvent.toString().substring(3));

				if(buttonActionRaw == 0)
				{
					buttonAction = "pressed";
					buttonActionLocalized = RED._("hue-switch.node.action-pressed");
				}
				else if(buttonActionRaw == 1)
				{
					buttonAction = "holded";
					buttonActionLocalized = RED._("hue-switch.node.action-holded");
				}
				else if(buttonActionRaw == 2)
				{
					buttonAction = "short released";
					buttonActionLocalized = RED._("hue-switch.node.action-shortreleased");
				}
				else
				{
					buttonAction = "long released";
					buttonActionLocalized = RED._("hue-switch.node.action-longreleased");
				}

				var message = {};
				message.payload = {};
				message.payload.button = sensor.state.buttonEvent;
				message.payload.name = buttonName;
				message.payload.action = buttonAction;
				message.payload.updated = moment.utc(sensor.state.lastUpdated).local().format();

				message.info = {};
				message.info.id = sensor.id;
				message.info.uniqueId = sensor.uniqueId;
				message.info.name = sensor.name;
				message.info.type = sensor.type;
				message.info.softwareVersion = sensor.softwareVersion;
				message.info.battery = sensor.config.battery;

				message.info.model = {};
				message.info.model.id = sensor.model.id;
				message.info.model.manufacturer = sensor.model.manufacturer;
				message.info.model.name = sensor.model.name;
				message.info.model.type = sensor.model.type;

				if(!config.skipevents) { scope.send(message); }
				scope.status({fill: "green", shape: "dot", text: buttonNameLocalized + " " + buttonActionLocalized});
			}
			else
			{
				scope.status({fill: "grey", shape: "dot", text: "hue-switch.node.waiting"});
			}
		});

		//
		// CLOSE NODE / REMOVE EVENT LISTENER
		this.on('close', function()
		{
			bridge.events.removeAllListeners('sensor' + config.sensorid);
		});
	}

	RED.nodes.registerType("hue-switch", HueSwitch);
}
