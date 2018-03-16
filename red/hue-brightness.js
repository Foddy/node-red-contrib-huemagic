module.exports = function(RED)
{
	"use strict";

	function HueBrightness(config)
	{
		RED.nodes.createNode(this, config);
		var bridge = RED.nodes.getNode(config.bridge);
		let huejay = require('huejay');
		var moment = require('moment');
		var context = this.context();
		var scope = this;

		//
		// CHECK CONFIG
		if(!config.sensorid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "not configured"});
			return false;
		}

		//
		// INITIALIZE CLIENT
		var luxSensorID = parseInt(config.sensorid);
		let client = new huejay.Client({
			host: (bridge.config.bridge).toString(),
			port: 80,
			username: bridge.config.key
		});

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "initializing…"});
		this.recheck = setInterval(function()
		{
			client.sensors.getById(luxSensorID)
			.then(sensor => {
				var lastUpdated = context.get('lastUpdated') || false;

				if(sensor.config.reachable == false)
				{
					scope.status({fill: "red", shape: "ring", text: "not reachable"});
				}
				else if(sensor.state.lastUpdated != lastUpdated)
				{
					context.set('lastUpdated', sensor.state.lastUpdated);

					var message = {};
					message.payload = {lightLevel: sensor.state.lightLevel, dark: sensor.state.dark, daylight: sensor.state.daylight, updated: moment.utc(sensor.state.lastUpdated).local().format()};

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

					if(sensor.state.dark)
					{
						scope.status({fill: "blue", shape: "dot", text: sensor.state.lightLevel+" Lux (dark)"});
					}
					else if(sensor.state.daylight)
					{
						scope.status({fill: "yellow", shape: "dot", text: sensor.state.lightLevel+" Lux (daylight)"});
					}
					else
					{
						scope.status({fill: "grey", shape: "dot", text: sensor.state.lightLevel+" Lux"});
					}
				}
			})
			.catch(error => {
				scope.error(error);
				scope.status({fill: "red", shape: "ring", text: "connection error"});
			});
		}, parseInt(bridge.config.interval));

		//
		// CLOSE NDOE / REMOVE RECHECK INTERVAL
		this.on('close', function()
		{
			clearInterval(scope.recheck);
		});
	}

	RED.nodes.registerType("hue-brightness", HueBrightness);
}
