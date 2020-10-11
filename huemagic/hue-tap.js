module.exports = function(RED)
{
	"use strict";

	function HueTap(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		var bridge = RED.nodes.getNode(config.bridge);
		let { HueTapMessage } = require('../utils/messages');
		var universalMode = false;

		// SAVE LAST STATE
		var lastState = false;

		//
		// MEMORY
		this.lastUpdated = false;

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-tap.node.not-configured"});
			return false;
		}

		//
		// UNIVERSAL MODE?
		if(!config.sensorid)
		{
			universalMode = true;
			this.status({fill: "grey", shape: "dot", text: "hue-tap.node.universal"});
		}

		//
		// UPDATE STATE
		if(config.sensorid)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-tap.node.waiting"});
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
				if (lastUpdated === false)
				{
					return;
				}

				// SEND MESSAGE
				var hueTap = new HueTapMessage(sensor, (universalMode == false) ? lastState : false);
				if(!config.skipevents) { scope.send(hueTap.msg); }

				// SAVE LAST STATE
				lastState = sensor;

				// SEND STATUS
				if(universalMode == false)
				{
					scope.status({fill: "green", shape: "dot", text: RED._("hue-tap.node.pressed-button",{button: hueTap.msg.payload.button}) });
				}

			}
			else
			{
				if(universalMode == false)
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-tap.node.waiting"});
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
					var hueTap = new HueTapMessage(sensor, (universalMode == false) ? lastState : false);
					send(hueTap.msg);

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

	RED.nodes.registerType("hue-tap", HueTap);
}