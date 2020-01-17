module.exports = function(RED)
{
	"use strict";

	function HueBrightness(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let moment = require('moment');

		//
		// CHECK CONFIG
		if(!config.sensorid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-brightness.node.not-configured"});
			return false;
		}

		//
		// UPDATE STATE
		if(typeof bridge.disableupdates != 'undefined'||bridge.disableupdates == false)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-brightness.node.init"});
		}

		//
		// ON UPDATE
		bridge.events.on('sensor' + config.sensorid, function(sensor)
		{
			if(sensor.config.reachable == false)
			{
				scope.status({fill: "red", shape: "ring", text: "hue-brightness.node.not-reachable"});
			}
			else
			{
				var realLUX = sensor.state.lightLevel - 1;
				realLUX = realLUX / 10000;
				realLUX = Math.round(Math.pow(10, realLUX));

				var message = {};
				message.payload = {};
				message.payload.lux = realLUX;
				message.payload.lightLevel = sensor.state.lightLevel;
				message.payload.dark = sensor.state.dark;
				message.payload.daylight = sensor.state.daylight;
				message.payload.updated = moment.utc(sensor.state.lastUpdated).local().format();

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

				if(sensor.state.dark)
				{
					var statusMessage = RED._("hue-brightness.node.lux-dark",{lux:realLUX});
					scope.status({fill: "blue", shape: "dot", text: statusMessage });
				}
				else if(sensor.state.daylight)
				{
					var statusMessage = RED._("hue-brightness.node.lux-daylight",{lux:realLUX});
					scope.status({fill: "yellow", shape: "dot", text: statusMessage });
				}
				else
				{
					var statusMessage = RED._("hue-brightness.node.lux",{lux:realLUX});
					scope.status({fill: "grey", shape: "dot", text: statusMessage });
				}
			}
		});

		//
		// CLOSE NODE / REMOVE EVENT LISTENER
		this.on('close', function()
		{
			bridge.events.removeAllListeners('sensor' + config.sensorid);
		});
	}

	RED.nodes.registerType("hue-brightness", HueBrightness);
}
