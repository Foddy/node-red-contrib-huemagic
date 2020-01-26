module.exports = function(RED)
{
	"use strict";

	function HueBrightness(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let { HueBrightnessMessage } = require('../utils/messages');

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
				var hueBrightness = new HueBrightnessMessage(sensor);
				var realLUX = hueBrightness.msg.payload.lux;
				if(!config.skipevents) { scope.send(hueBrightness.msg); }

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
