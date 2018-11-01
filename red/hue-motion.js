module.exports = function(RED)
{
	"use strict";

	function HueMotion(config)
	{
		RED.nodes.createNode(this, config);
		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let moment = require('moment');

		//
		// CHECK CONFIG
		if(!config.sensorid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "not configured"});
			return false;
		}

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "no motion"});

		//
		// ON UPDATE
		bridge.events.on('sensor' + config.sensorid, function(sensor)
		{
			if(sensor.config.reachable == false)
			{
				scope.status({fill: "red", shape: "ring", text: "not reachable"});
			}
			else if(sensor.config.on == true)
			{
				if(sensor.state.presence)
				{
					var message = {};
					message.payload = {active: true, motion: true, updated: moment.utc(sensor.state.lastUpdated).local().format()};

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
					scope.status({fill: "green", shape: "dot", text: "motion detected"});
				}
				else
				{
					var message = {};
					message.payload = {active: true, motion: false, updated: moment.utc(sensor.state.lastUpdated).local().format()};

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
					scope.status({fill: "grey", shape: "dot", text: "activated"});
				}
			}
			else if(sensor.config.on == false)
			{
				scope.status({fill: "red", shape: "ring", text: "deactivated"});
			}
		});


		//
		// DISABLE / ENABLE SENSOR
		this.on('input', function(msg)
		{
			if(msg.payload == true || msg.payload == false)
			{
				bridge.client.sensors.getById(config.sensorid)
				.then(sensor => {
					sensor.config.on = msg.payload;
					return bridge.client.sensors.save(sensor);
				})
				.then(sensor => {
					var message = {};
					message.payload = {active: msg.payload, motion: false, updated: moment.utc(sensor.state.lastUpdated).local().format()};
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

					if(msg.payload == false)
					{
						scope.status({fill: "red", shape: "ring", text: "deactivated"});
					}
					else
					{
						scope.status({fill: "green", shape: "dot", text: "activated"});
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
			bridge.events.removeAllListeners('sensor' + config.sensorid);
		});
	}

	RED.nodes.registerType("hue-motion", HueMotion);
}
