module.exports = function(RED)
{
	"use strict";

	function HueTemperature(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let moment = require('moment');

		//
		// MEMORY
		this.temperature = -1000;
		
		//
		// CHECK CONFIG
		if(!config.sensorid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "not configured"});
			return false;
		}

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "initializing…"});

		//
		// ON UPDATE
		bridge.events.on('sensor' + config.sensorid, function(sensor)
		{
			if(sensor.config.reachable == false)
			{
				scope.status({fill: "red", shape: "ring", text: "not reachable"});
			}
			else if(scope.temperature != sensor.state.temperature)
			{
				scope.temperature = sensor.state.temperature;
				var celsius = Math.round(sensor.state.temperature * 100) / 100;
				var fahrenheit = Math.round(((celsius * 1.8)+32) * 100) / 100;

				var message = {};
				message.payload = {celsius: celsius, fahrenheit: fahrenheit, updated: moment.utc(sensor.state.lastUpdated).local().format()};

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

				scope.send(message);
				scope.status({fill: "yellow", shape: "dot", text: celsius+" °C / "+fahrenheit+" °F"});
			}
		});

		//
		// CLOSE NDOE / REMOVE RECHECK INTERVAL
		this.on('close', function()
		{
			bridge.events.removeAllListeners('sensor' + config.sensorid);
		});
	}

	RED.nodes.registerType("hue-temperature", HueTemperature);
}
