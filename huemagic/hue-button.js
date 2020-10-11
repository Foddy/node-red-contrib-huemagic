module.exports = function(RED)
{
	"use strict";

	function HueButton(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let { HueButtonMessage } = require('../utils/messages');
		var universalMode = false;

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
		// UNIVERSAL MODE?
		if(!config.sensorid)
		{
			universalMode = true;
			this.status({fill: "grey", shape: "dot", text: "hue-button.node.universal"});
		}

		//
		// UPDATE STATE
		if(config.sensorid)
		{
			scope.status({fill: "grey", shape: "dot", text: "hue-button.node.waiting"});
		}

		//
		// ON UPDATE
		if(config.sensorid) { bridge.events.on('sensor' + config.sensorid, function(sensor) { scope.receivedUpdates(sensor) }); }
		if(!config.sensorid && config.universalevents && config.universalevents == true) { bridge.events.on('sensor', function(sensor) { scope.receivedUpdates(sensor) }); }

		//
		// RECEIVED UPDATES
		this.receivedUpdates = function(sensor)
		{
			var lastUpdated = scope.lastUpdated || false;
			if(sensor.state.lastUpdated != lastUpdated)
			{
				scope.lastUpdated = sensor.state.lastUpdated;

				// RETURN ON FIRST DEPLOY
				if (lastUpdated === false) {
					return;
				}

				// DEFINE HUMAN READABLE BUTTON ACTION
				if(universalMode == false)
				{
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
					scope.status({fill: "green", shape: "dot", text: buttonActionLocalized});
				}

				// SEND MESSAGE
				if(!config.skipevents)
				{
					var hueButton = new HueButtonMessage(sensor, (universalMode == false) ? lastState : false);
					scope.send(hueButton.msg);
				}

				// SAVE LAST STATE
				lastState = sensor;
			}
			else
			{
				if(universalMode == false)
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-button.node.waiting"});
				}
			}
		}

		//
		// ON COMMAND
		this.on('input', function(msg, send, done)
		{
			// Node-RED < 1.0
			send = send || function() { scope.send.apply(scope,arguments); }

			// DEFINE SENSOR ID
			var tempSensorID = (msg.topic != null && isNaN(msg.topic) == false && msg.topic.length > 0) ? parseInt(msg.topic) : config.sensorid;

			// GET CURRENT STATE
			if(typeof msg.payload != 'undefined' && typeof msg.payload.status != 'undefined')
			{
				bridge.client.sensors.getById(tempSensorID)
				.then(sensor => {
					var hueButton = new HueButtonMessage(sensor, lastState);
					send(hueButton.msg);

					return true;
				});

				return true;
			}
		});

		//
		// CLOSE NODE / REMOVE EVENT LISTENER
		this.on('close', function()
		{
			bridge.events.removeAllListeners('sensor' + config.sensorid);
			bridge.events.removeAllListeners('sensor');
		});
	}

	RED.nodes.registerType("hue-button", HueButton);
}