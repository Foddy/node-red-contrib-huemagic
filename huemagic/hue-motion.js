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
			this.status({fill: "red", shape: "ring", text: "hue-motion.node.not-configured"});
			return false;
		}

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "hue-motion.node.no-motion"});

		//
		// ON UPDATE
		bridge.events.on('sensor' + config.sensorid, function(sensor)
		{
			if(sensor.config.reachable == false)
			{
				scope.status({fill: "red", shape: "ring", text: "hue-motion.node.not-reachable"});
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

					if(!config.skipevents) { scope.send(message); }
					scope.status({fill: "green", shape: "dot", text: "hue-motion.node.motion"});
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

					if(!config.skipevents) { scope.send(message); }
					scope.status({fill: "grey", shape: "dot", text: "hue-motion.node.activated"});
				}
			}
			else if(sensor.config.on == false)
			{
				scope.status({fill: "red", shape: "ring", text: "hue-motion.node.deactivated"});
			}
		});


		//
		// DISABLE / ENABLE SENSOR
		this.on('input', function(msg, send, done)
		{
			// Node-RED < 1.0
			send = send || function() { scope.send.apply(scope,arguments); }

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

					if(!config.skipevents) { send(message); }
					if(done) { done(); }

					if(msg.payload == false)
					{
						scope.status({fill: "red", shape: "ring", text: "hue-motion.node.deactivated"});
					}
					else
					{
						scope.status({fill: "green", shape: "dot", text: "hue-motion.node.activated"});
					}
				})
				.catch(error => {
					scope.error(error, msg);
					if(done) { done(error); }
				});
			}
		});


		//
		// CLOSE NODE / REMOVE EVENT LISTENER
		this.on('close', function()
		{
			bridge.events.removeAllListeners('sensor' + config.sensorid);
		});
	}

	RED.nodes.registerType("hue-motion", HueMotion);
}
