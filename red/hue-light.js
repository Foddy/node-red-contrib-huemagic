module.exports = function(RED)
{
	"use strict";

	function HueLight(config)
	{
		RED.nodes.createNode(this, config);
		var bridge = RED.nodes.getNode(config.bridge);
		let huejay = require('huejay');
		var moment = require('moment');
		let rgb = require('../utils/rgb');
		let rgbHex = require('rgb-hex');
		let hexRGB = require('hex-rgb');
		var context = this.context();
		var scope = this;

		//
		// CHECK CONFIG
		if(!config.lightid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "not configured"});
			return false;
		}

		//
		// INITIALIZE CLIENT
		var lightID = parseInt(config.lightid);
		let client = new huejay.Client({
			host: (bridge.config.bridge).toString(),
			port: 80,
			username: bridge.config.key
		});

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "initializing…"});
		this.recheck = setInterval(function()
		{
			client.lights.getById(lightID)
			.then(light => {
				if(light.reachable == false)
				{
					scope.status({fill: "red", shape: "ring", text: "not reachable"});
				}
				else
				{
					var state = context.get('status') || false;
					var uniqueStatus = ((light.on) ? "1" : "0") + light.brightness + light.hue + light.saturation + light.colorTemp;
					var brightnessPercent = 0;

					if(state != uniqueStatus)
					{
						context.set('status', uniqueStatus);

						if(light.on)
						{
							brightnessPercent = Math.round((100/254)*light.brightness);
							scope.status({fill: "yellow", shape: "dot", text: "turned on ("+ brightnessPercent +"%)"});
						}
						else
						{
							scope.status({fill: "grey", shape: "dot", text: "turned off"});
						}

						// DETERMINE TYPE AND SEND STATUS
						var message = {};
						message.payload = {};
						message.payload.on = light.on;
						message.payload.brightness = brightnessPercent;

						message.info = {};
						message.info.id = light.id;
						message.info.uniqueId = light.uniqueId;
						message.info.name = light.name;
						message.info.type = light.type;
						message.info.softwareVersion = light.softwareVersion;

						message.info.model = {};;
						message.info.model.id = light.model.id;
						message.info.model.manufacturer = light.model.manufacturer;
						message.info.model.name = light.model.name;
						message.info.model.type = light.model.type;
						message.info.model.colorGamut = light.model.colorGamut;
						message.info.model.friendsOfHue = light.model.friendsOfHue;

						if(light.xy)
						{
							var rgbColor = rgb.convertXYtoRGB(light.xy[0], light.xy[1], light.brightness);

							message.payload.rgb = rgbColor;
							message.payload.hex = rgbHex(rgbColor[0], rgbColor[1], rgbColor[2]);
						}

						message.payload.updated = moment().format();

						scope.send(message);
					}
				}
			})
			.catch(error => {
				scope.status({fill: "red", shape: "ring", text: "connection error"});
				clearInterval(scope.recheck);
			});
		}, parseInt(bridge.config.interval));

		//
		// TURN ON / OFF LIGHT
		this.on('input', function(msg)
		{
			// SIMPLE TURN ON / OFF LIGHT
			if(msg.payload == true || msg.payload == false)
			{
				client.lights.getById(lightID)
				.then(light => {
					if(light.reachable)
					{
						light.on = msg.payload;
						return client.lights.save(light);
					}
					else
					{
						scope.status({fill: "red", shape: "ring", text: "not reachable"});
						return false;
					}
				})
				.then(light => {
					if(light != false)
					{
						scope.sendLightStatus(light);
					}
				})
				.catch(error => {
					scope.error(error);
					scope.status({fill: "red", shape: "ring", text: "input error"});
					clearInterval(scope.recheck);
				});
			}
			// EXTENDED TURN ON / OFF LIGHT
			else if(typeof msg.payload.on != 'undefined')
			{
				client.lights.getById(lightID)
				.then(light => {
					if(light.reachable)
					{
						light.on = msg.payload.on;

						// SET BRIGHTNESS
						if(msg.payload.brightness)
						{
							light.brightness = Math.round((254/100)*parseInt(msg.payload.brightness));
						}

						// SET RGB COLOR
						if(msg.payload.rgb && light.xy)
						{
							light.xy = rgb.convertRGBtoXY(msg.payload.rgb, light.modelid);
						}

						// SET HEX COLOR
						if(msg.payload.hex && light.xy)
						{
							light.xy = rgb.convertRGBtoXY(hexRGB((msg.payload.hex).toString()), light.modelid);
						}

						// SET TRANSITION TIME
						if(msg.payload.transitionTime)
						{
							light.transitionTime = parseInt(msg.payload.transitionTime);
						}

						// SET COLORLOOP EFFECT
						if(msg.payload.colorloop && msg.payload.colorloop > 0 && light.xy)
						{
							light.effect = 'colorloop';

							// DISABLE AFTER
							setTimeout(function() {
								light.effect = 'none';
								client.lights.save(light);
							}, parseInt(msg.payload.colorloop)*1000);
						}

						return client.lights.save(light);
					}
					else
					{
						scope.status({fill: "red", shape: "ring", text: "not reachable"});
						return false;
					}
				})
				.then(light => {
					if(light != false)
					{
						scope.sendLightStatus(light);
					}
				})
				.catch(error => {
					scope.error(error);
					scope.status({fill: "red", shape: "ring", text: "input error"});
					clearInterval(scope.recheck);
				});
			}
			// ALERT EFFECT
			else if(typeof msg.payload.alert != 'undefined' && msg.payload.alert > 0)
			{
				client.lights.getById(lightID)
				.then(light => {
					if(light.reachable)
					{
						var lightPreviousState = light;

						// SET RGB COLOR
						if(msg.payload.rgb && light.xy)
						{
							light.xy = rgb.convertRGBtoXY(msg.payload.rgb, light.modelid);
						}

						// SET HEX COLOR
						if(msg.payload.hex && light.xy)
						{
							light.xy = rgb.convertRGBtoXY(hexRGB((msg.payload.hex).toString()), light.modelid);
						}

						// SET TO RED IF NO COLOR SET
						if(!msg.payload.rgb && !msg.payload.hex && light.xy)
						{
							light.xy = rgb.convertRGBtoXY([255,0,0], light.modelid);
						}

						// REPEAT ALERT
						scope.repeatAlert(client, lightPreviousState, light, (parseInt(msg.payload.alert)-1));
					}
					else
					{
						scope.status({fill: "red", shape: "ring", text: "not reachable"});
						return false;
					}
				})
				.catch(error => {
					scope.error(error);
					scope.status({fill: "red", shape: "ring", text: "input error"});
					clearInterval(scope.recheck);
				});
			}
		});

		//
		// REPEAT ALERT
		this.repeatAlert = function(client, previousLight, alertLight, repeat)
		{
			var scope = this;

			setTimeout(function() {
				alertLight.on = true;
				alertLight.alert = 'select';
				client.lights.save(alertLight);

				if(repeat > 0)
				{
					repeat -= 1;
					scope.repeatAlert(client, previousLight, alertLight, repeat);
				}
				else
				{
					client.lights.save(previousLight);
				}
			}, 1000);
		}

		//
		// SEND LIGHT STATUS
		this.sendLightStatus = function(light)
		{
			var scope = this;

			var state = scope.context().get('status') || false;
			var uniqueStatus = ((light.on) ? "1" : "0") + light.brightness + light.hue + light.saturation + light.colorTemp;
			var brightnessPercent = 0;

			if(light.on)
			{
				brightnessPercent = Math.round((100/254)*light.brightness);
				scope.status({fill: "yellow", shape: "dot", text: "turned on ("+ brightnessPercent +"%)"});
			}
			else
			{
				scope.status({fill: "grey", shape: "dot", text: "turned off"});
			}

			// DETERMINE TYPE AND SEND STATUS
			var message = {};
			message.payload = {};
			message.payload.on = light.on;
			message.payload.brightness = brightnessPercent;

			message.info = {};
			message.info.id = light.id;
			message.info.uniqueId = light.uniqueId;
			message.info.name = light.name;
			message.info.type = light.type;
			message.info.softwareVersion = light.softwareVersion;

			message.info.model = {};;
			message.info.model.id = light.model.id;
			message.info.model.manufacturer = light.model.manufacturer;
			message.info.model.name = light.model.name;
			message.info.model.type = light.model.type;
			message.info.model.colorGamut = light.model.colorGamut;
			message.info.model.friendsOfHue = light.model.friendsOfHue;

			if(light.xy)
			{
				var rgbColor = rgb.convertXYtoRGB(light.xy[0], light.xy[1], light.brightness);

				message.payload.rgb = rgbColor;
				message.payload.hex = rgbHex(rgbColor[0], rgbColor[1], rgbColor[2]);
			}

			message.payload.updated = moment().format();

			scope.send(message);
			scope.context().set('status', uniqueStatus);
		}

		//
		// CLOSE NDOE / REMOVE RECHECK INTERVAL
		this.on('close', function()
		{
			clearInterval(scope.recheck);
		});
	}

	RED.nodes.registerType("hue-light", HueLight);
}