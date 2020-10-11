module.exports = function(RED)
{
	"use strict";

	function HueBrightness(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let { HueBrightnessMessage } = require('../utils/messages');
		var universalMode = false;

		// SAVE LAST STATE
		var lastState = false;

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-brightness.node.not-configured"});
			return false;
		}

		//
		// UNIVERSAL MODE?
		if(!config.sensorid)
		{
			universalMode = true;
			this.status({fill: "grey", shape: "dot", text: "hue-brightness.node.universal"});
		}

		//
		// UPDATE STATE
		if(typeof bridge.disableupdates != 'undefined'||bridge.disableupdates == false)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-brightness.node.init"});
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
				if(universalMode == false)
				{
					scope.status({fill: "red", shape: "ring", text: "hue-brightness.node.not-reachable"});
				}
			}
			else
			{
				var hueBrightness = new HueBrightnessMessage(sensor, (universalMode == false) ? lastState : false);
				var realLUX = hueBrightness.msg.payload.lux;
				if(!config.skipevents) { scope.send(hueBrightness.msg); }

				// SAVE LAST STATE
				lastState = sensor;

				if(universalMode == false)
				{
					if(sensor.state.dark)
					{
						var statusMessage = RED._("hue-brightness.node.lux-dark",{lux: realLUX});
						scope.status({fill: "blue", shape: "dot", text: statusMessage });
					}
					else if(sensor.state.daylight)
					{
						var statusMessage = RED._("hue-brightness.node.lux-daylight",{lux: realLUX});
						scope.status({fill: "yellow", shape: "dot", text: statusMessage });
					}
					else
					{
						var statusMessage = RED._("hue-brightness.node.lux",{lux: realLUX});
						scope.status({fill: "grey", shape: "dot", text: statusMessage });
					}
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
					var hueBrightness = new HueBrightnessMessage(sensor, lastState);
					send(hueBrightness.msg);

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

	RED.nodes.registerType("hue-brightness", HueBrightness);
}