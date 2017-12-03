module.exports = function(RED)
{
	"use strict";

	function HueTap(config)
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
		var sensorid = parseInt(config.sensorid);
		let client = new huejay.Client({
			host: (bridge.config.bridge).toString(),
			port: 80,
			username: bridge.config.key
		});

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "waiting…"});
		this.recheck = setInterval(function()
		{
			client.sensors.getById(sensorid)
			.then(sensor => {
				var buttonEvent = context.get('buttonevent') || false;

				if(buttonEvent != sensor.state.buttonEvent)
				{
					context.set('buttonevent', sensor.state.buttonEvent);

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
					message.payload = {button: buttonNum, updated: moment().format()};

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
			})
			.catch(error => {
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

	RED.nodes.registerType("hue-tap", HueTap);
}