module.exports = function(RED)
{
	"use strict";

	function HueMotion(config)
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
		var motionSensorID = parseInt(config.sensorid);
		let client = new huejay.Client({
			host: (bridge.config.bridge).toString(),
			port: 80,
			username: bridge.config.key
		});

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "no motion"});
		this.recheck = setInterval(function()
		{
			client.sensors.getById(motionSensorID)
			.then(sensor => {
				if(sensor.config.reachable == false)
				{
					scope.status({fill: "red", shape: "ring", text: "not reachable"});
				}
				else if(sensor.config.on == true)
				{
					var presence = context.get('presence') || false;
					if(presence != sensor.state.presence)
					{
						if(sensor.state.presence)
						{
							context.set('presence', true);

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

							context.set('presence', false);
							scope.status({fill: "grey", shape: "dot", text: "activated"});
						}
					}
				}
				else if(sensor.config.on == false)
				{
					scope.status({fill: "red", shape: "ring", text: "deactivated"});
				}
			})
			.catch(error => {
				score.error(error);
				scope.status({fill: "red", shape: "ring", text: "connection error"});
			});
		}, parseInt(bridge.config.interval));


		//
		// DISABLE / ENABLE SENSOR
		this.on('input', function(msg)
		{
			if(msg.payload == true || msg.payload == false)
			{
				client.sensors.getById(motionSensorID)
				.then(sensor => {
					sensor.config.on = msg.payload;
					return client.sensors.save(sensor);
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
			clearInterval(scope.recheck);
		});
	}

	RED.nodes.registerType("hue-motion", HueMotion);
}
