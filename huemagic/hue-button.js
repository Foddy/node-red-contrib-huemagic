module.exports = function(RED)
{
	"use strict";

	function HueButton(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let { HueSwitchMessage } = require('../utils/messages');

		// SAVE LAST STATE
		var lastState = false;

		//
		// MEMORY
		this.lastUpdated = false;

		//
		// CHECK CONFIG
		if(!config.sensorid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-button.node.not-configured"});
			return false;
		}

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "hue-button.node.waiting"});

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
				var buttonNameLocalized = "";
				if(sensor.state.buttonEvent < 2000)
				{
					buttonNameLocalized = RED._("hue-button.node.button-on");
				}
				else if(sensor.state.buttonEvent < 3000)
				{
					buttonNameLocalized = RED._("hue-button.node.button-dimup");
				}
				else if(sensor.state.buttonEvent < 4000)
				{
					buttonNameLocalized = RED._("hue-button.node.button-dimdown");
				}
				else
				{
					buttonNameLocalized = RED._("hue-button.node.button-off");
				}

				// DEFINE HUMAN READABLE BUTTON ACTION
				var buttonActionLocalized = "";
				var buttonActionRaw = parseInt(sensor.state.buttonEvent.toString().substring(3));
				if(buttonActionRaw == 0)
				{
					buttonActionLocalized = RED._("hue-button.node.action-pressed");
				}
				else if(buttonActionRaw == 1)
				{
					buttonActionLocalized = RED._("hue-button.node.action-holded");
				}
				else if(buttonActionRaw == 2)
				{
					buttonActionLocalized = RED._("hue-button.node.action-shortreleased");
				}
				else
				{
					buttonActionLocalized = RED._("hue-button.node.action-longreleased");
				}

				// SEND STATUS
				scope.status({fill: "green", shape: "dot", text: buttonNameLocalized + " " + buttonActionLocalized});

				// SEND MESSAGE
				if(!config.skipevents)
				{
					var hueButton = new HueSwitchMessage(sensor, lastState);
					scope.send(hueButton.msg);
				}

				// SAVE LAST STATE
				lastState = sensor;
			}
			else
			{
				scope.status({fill: "grey", shape: "dot", text: "hue-button.node.waiting"});
			}
		});

		//
		// CLOSE NODE / REMOVE EVENT LISTENER
		this.on('close', function()
		{
			bridge.events.removeAllListeners('sensor' + config.sensorid);
		});
	}

	RED.nodes.registerType("hue-button", HueButton);
}
