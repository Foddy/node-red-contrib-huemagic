module.exports = function(RED)
{
	"use strict";

	function HueSwitch(config)
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
				var lastUpdated = context.get('lastUpdated') || false;

				if(sensor.state.lastUpdated != lastUpdated)
				{
					context.set('lastUpdated', sensor.state.lastUpdated);

					// Return on first deploy to purge old state
					if (lastUpdated === false) {
						return;
					}

					// DEFINE HUMAN READABLE BUTTON NAME
					var buttonName = "";
					if(sensor.state.buttonEvent < 2000)
					{
						buttonName = "On";
					}
					else if(sensor.state.buttonEvent < 3000)
					{
						buttonName = "Dim Up";
					}
					else if(sensor.state.buttonEvent < 4000)
					{
						buttonName = "Dim Down";
					}
					else
					{
						buttonName = "Off";
					}

					// DEFINE HUMAN READABLE BUTTON ACTION
					var buttonAction = "";
					var buttonActionRaw = parseInt(sensor.state.buttonEvent.toString().substring(3));

					if(buttonActionRaw == 0)
					{
						buttonAction = "pressed";
					}
					else if(buttonActionRaw == 1)
					{
						buttonAction = "holded";
					}
					else if(buttonActionRaw == 2)
					{
						buttonAction = "short released";
					}
					else
					{
						buttonAction = "long released";
					}

					var message = {};
					message.payload = {};
					message.payload.button = sensor.state.buttonEvent;
					message.payload.name = buttonName;
					message.payload.action = buttonAction;
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

					scope.send(message);
					scope.status({fill: "green", shape: "dot", text: buttonName + " " + buttonAction});
				}
				else
				{
					scope.status({fill: "grey", shape: "dot", text: "waiting…"});
				}
			})
			.catch(error => {
				scope.error(error);
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

	RED.nodes.registerType("hue-switch", HueSwitch);
}
