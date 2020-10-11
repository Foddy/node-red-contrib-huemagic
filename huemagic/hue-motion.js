module.exports = function(RED)
{
	"use strict";

	function HueMotion(config)
	{
		RED.nodes.createNode(this, config);
		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let { HueMotionMessage } = require('../utils/messages');
		var universalMode = false;

		// SAVE LAST STATE
		var lastState = false;

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-motion.node.not-configured"});
			return false;
		}

		//
		// UNIVERSAL MODE?
		if(!config.sensorid)
		{
			universalMode = true;
			this.status({fill: "grey", shape: "dot", text: "hue-motion.node.universal"});
		}

		//
		// UPDATE STATE
		if(config.sensorid)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-motion.node.no-motion"});
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
					scope.status({fill: "red", shape: "ring", text: "hue-motion.node.not-reachable"});
				}
			}
			else if(sensor.config.on == true)
			{
				// SEND STATUS
				if(universalMode == false)
				{
					if(sensor.state.presence)
					{
						scope.status({fill: "green", shape: "dot", text: "hue-motion.node.motion"});
					}
					else
					{
						scope.status({fill: "grey", shape: "dot", text: "hue-motion.node.activated"});
					}
				}

				// SEND MESSAGE
				var hueMotion = new HueMotionMessage(sensor, true, (universalMode == false) ? lastState : false);
				if(!config.skipevents) { scope.send(hueMotion.msg); }

				// SAVE LAST STATE
				lastState = sensor;
			}
			else if(sensor.config.on == false)
			{
				// SEND STATUS
				if(universalMode == false)
				{
					scope.status({fill: "red", shape: "ring", text: "hue-motion.node.deactivated"});
				}

				// SEND MESSAGE
				var hueMotion = new HueMotionMessage(sensor, false, (universalMode == false) ? lastState : false);
				if(!config.skipevents) { scope.send(hueMotion.msg); }

				// SAVE LAST STATE
				lastState = sensor;
			}
		}

		//
		// DISABLE / ENABLE SENSOR
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
					var hueMotion = new HueMotionMessage(sensor, (sensor.config.on) ? true : false, (universalMode == false) ? lastState : false);

					// SAVE LAST STATE
					lastState = sensor;

					return send(hueMotion.msg);
				});

				return true;
			}

			// CONTROL
			if(msg.payload == true || msg.payload == false)
			{
				bridge.client.sensors.getById(tempSensorID)
				.then(sensor => {
					sensor.config.on = msg.payload;
					return bridge.client.sensors.save(sensor);
				})
				.then(sensor => {
					var hueMotion = new HueMotionMessage(sensor, msg.payload, lastState);

					// SEND STATUS
					if(universalMode == false)
					{
						if(msg.payload == false)
						{
							scope.status({fill: "red", shape: "ring", text: "hue-motion.node.deactivated"});
						}
						else
						{
							scope.status({fill: "green", shape: "dot", text: "hue-motion.node.activated"});
						}
					}

					// SEND MESSAGE
					if(!config.skipevents) { send(hueMotion.msg); }
					if(done) { done(); }

					// SAVE LAST STATE
					lastState = sensor;
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