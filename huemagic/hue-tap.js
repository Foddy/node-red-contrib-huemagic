module.exports = function(RED)
{
	"use strict";

	function HueTap(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		var bridge = RED.nodes.getNode(config.bridge);
		let { HueTapMessage } = require('../utils/messages');

		//
		// MEMORY
		this.lastUpdated = false;

		//
		// CHECK CONFIG
		if(!config.sensorid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-tap.node.not-configured"});
			return false;
		}

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "hue-tap.node.waiting"});

		//
		// ON UPDATE
		bridge.events.on('sensor' + config.sensorid, function(sensor)
		{
			var lastUpdated = scope.lastUpdated || false;

			if(sensor.state.lastUpdated != lastUpdated)
			{
				scope.lastUpdated = sensor.state.lastUpdated;

				// RETURN ON FIRST DEPLOY
				if (lastUpdated === false)
				{
					return;
				}

				// SEND MESSAGE
				var hueTap = new HueTapMessage(sensor);
				if(!config.skipevents) { scope.send(hueTap.msg); }

				// SEND STATUS
				scope.status({fill: "green", shape: "dot", text: RED._("hue-tap.node.pressed-button",{button: hueTap.msg.payload.button}) });
			}
			else
			{
				scope.status({fill: "grey", shape: "dot", text: "hue-tap.node.waiting"});
			}
		});


		//
		// CLOSE NODE / REMOVE EVENT LISTENER
		this.on('close', function()
		{
			bridge.events.removeAllListeners('sensor' + config.sensorid);
		});
	}

	RED.nodes.registerType("hue-tap", HueTap);
}
