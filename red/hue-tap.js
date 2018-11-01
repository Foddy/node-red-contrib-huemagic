module.exports = function(RED)
{
	"use strict";

	function HueTap(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		var bridge = RED.nodes.getNode(config.bridge);
		let moment = require('moment');
		
		//
		// MEMORY
		this.lastUpdated = false;
		
		//
		// CHECK CONFIG
		if(!config.sensorid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "not configured"});
			return false;
		}

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "waiting…"});

		//
		// ON UPDATE
		bridge.events.on('sensor' + config.sensorid, function(sensor)
		{
			var lastUpdated = scope.lastUpdated || false;

			if(sensor.state.lastUpdated != lastUpdated)
			{
				scope.lastUpdated = sensor.state.lastUpdated;

				// RETURN ON FIRST DEPLOY
				if (lastUpdated === false) {
					return;
				}

				var buttonNum = 0;

				if(sensor.state.buttonEvent == 34)
				{
					buttonNum = 1;
				}
				else if(sensor.state.buttonEvent == 16)
				{
					buttonNum = 2;
				}
				else if(sensor.state.buttonEvent == 17)
				{
					buttonNum = 3;
				}
				else if(sensor.state.buttonEvent == 18)
				{
					buttonNum = 4;
				}

				var message = {};
				message.payload = {button: buttonNum, updated: moment.utc(sensor.state.lastUpdated).local().format()};

				message.info = {};
				message.info.id = sensor.id;
				message.info.uniqueId = sensor.uniqueId;
				message.info.name = sensor.name;
				message.info.type = sensor.type;

				message.info.model = {};
				message.info.model.id = sensor.model.id;
				message.info.model.manufacturer = sensor.model.manufacturer;
				message.info.model.name = sensor.model.name;
				message.info.model.type = sensor.model.type;

				scope.send(message);
				scope.status({fill: "green", shape: "dot", text: "Button #" + buttonNum + " pressed"});
			}
			else
			{
				scope.status({fill: "grey", shape: "dot", text: "waiting…"});
			}
		});


		//
		// CLOSE NDOE / REMOVE RECHECK INTERVAL
		this.on('close', function()
		{
			bridge.events.removeAllListeners('sensor' + config.sensorid);
		});
	}

	RED.nodes.registerType("hue-tap", HueTap);
}
