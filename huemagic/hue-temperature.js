module.exports = function(RED)
{
	"use strict";

	function HueTemperature(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let { HueTemperatureMessage } = require('../utils/messages');
		let moment = require('moment');
		var universalMode = false;

		// SAVE LAST STATE
		var lastState = false;

		//
		// MEMORY
		this.temperature = -1000;

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-temperature.node.not-configured"});
			return false;
		}

		//
		// UNIVERSAL MODE?
		if(!config.sensorid)
		{
			universalMode = true;
			this.status({fill: "grey", shape: "dot", text: "hue-temperature.node.universal"});
		}

		//
		// UPDATE STATE
		if(typeof bridge.disableupdates != 'undefined'||bridge.disableupdates == false)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-temperature.node.init"});
		}

		//
		// ON UPDATE
		if(config.sensorid) { bridge.events.on('sensor' + config.sensorid, function(sensor) { scope.receivedUpdates(sensor) }); }
		if(!config.sensorid && config.universalevents && config.universalevents == true) { bridge.events.on('sensor', function(sensor) { scope.receivedUpdates(sensor) }); }

		//
		// RECEIVED UPDATES
		this.receivedUpdates = function(sensor)
		{
			if(sensor.config.reachable == false)
			{
				// SEND STATUS
				if(universalMode == false)
				{
					scope.status({fill: "red", shape: "ring", text: "hue-temperature.node.not-reachable"});
				}
			}
			else if(scope.temperature != sensor.state.temperature)
			{
				// STORE CURRENT TEMPERATURE
				var hueTemperature = new HueTemperatureMessage(sensor, (universalMode == false) ? lastState : false);
				scope.temperature = sensor.state.temperature;

				// SEND STATUS
				if(universalMode == false)
				{
					scope.status({fill: "yellow", shape: "dot", text: hueTemperature.msg.payload.celsius+" °C / "+hueTemperature.msg.payload.fahrenheit+" °F"});
				}

				// SEND MESSAGE
				if(!config.skipevents) { scope.send(hueTemperature.msg); }

				// SAVE LAST STATE
				lastState = sensor;
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
					var hueTemperature = new HueTemperatureMessage(sensor, (universalMode == false) ? lastState : false);
					send(hueTemperature.msg);

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

	RED.nodes.registerType("hue-temperature", HueTemperature);
}