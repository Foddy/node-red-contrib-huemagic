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

		//
		// MEMORY
		this.temperature = -1000;

		//
		// CHECK CONFIG
		if(!config.sensorid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-temperature.node.not-configured"});
			return false;
		}

		//
		// UPDATE STATE
		if(typeof bridge.disableupdates != 'undefined'||bridge.disableupdates == false)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-temperature.node.init"});
		}

		//
		// ON UPDATE
		bridge.events.on('sensor' + config.sensorid, function(sensor)
		{
			if(sensor.config.reachable == false)
			{
				// SEND STATUS
				scope.status({fill: "red", shape: "ring", text: "hue-temperature.node.not-reachable"});
			}
			else if(scope.temperature != sensor.state.temperature)
			{
				// STORE CURRENT TEMPERATURE
				var hueTemperature = new HueTemperatureMessage(sensor);
				scope.temperature = sensor.state.temperature;

				// SEND STATUS
				scope.status({fill: "yellow", shape: "dot", text: hueTemperature.msg.payload.celsius+" °C / "+hueTemperature.msg.payload.fahrenheit+" °F"});

				// SEND MESSAGE
				if(!config.skipevents) { scope.send(hueTemperature.msg); }
			}
		});

		//
		// CLOSE NODE / REMOVE EVENT LISTENER
		this.on('close', function()
		{
			bridge.events.removeAllListeners('sensor' + config.sensorid);
		});
	}

	RED.nodes.registerType("hue-temperature", HueTemperature);
}
