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
		var colornames = require("colornames");
		var colornamer = require('color-namer');
		var context = this.context();
		var scope = this;

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "not configured"});
			return false;
		}

		//
		// INITIALIZE CLIENT
		var lightID = (config.lightid) ? parseInt(config.lightid) : false;
		let client = new huejay.Client({
			host: (bridge.config.bridge).toString(),
			port: 80,
			username: bridge.config.key
		});

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "initializing…"});

		if(lightID != false)
		{
			this.recheck = setInterval(function()
			{
				client.lights.getById(lightID)
				.then(light => {
					var state = context.get('status') || false;
					var uniqueStatus = ((light.on) ? "1" : "0") + light.brightness + light.hue + light.saturation + light.colorTemp + light.reachable;
					var brightnessPercent = 0;

					if(state != uniqueStatus)
					{
						context.set('status', uniqueStatus);

						if(light.reachable){
							if(light.on)
							{
								brightnessPercent = Math.round((100/254)*light.brightness);
								scope.status({fill: "yellow", shape: "dot", text: "turned on ("+ brightnessPercent +"%)"});
							}
							else
							{
								scope.status({fill: "grey", shape: "dot", text: "turned off"});
							}
						}
						else
						{
							scope.status({fill: "red", shape: "ring", text: "not reachable"});
						}

						// DETERMINE TYPE AND SEND STATUS
						var message = {};
						message.payload = {};
						message.payload.on = light.on;
						message.payload.brightness = brightnessPercent;
						message.payload.reachable = light.reachable;

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

							if(config.colornamer == true)
							{
								var cNamesArray = colornamer(rgbHex(rgbColor[0], rgbColor[1], rgbColor[2]));
								message.payload.color = cNamesArray.basic[0]["name"];
							}
						}

						message.payload.updated = moment().format();
						scope.send(message);
					}
				})
				.catch(error => {
					scope.error(error);
					scope.status({fill: "red", shape: "ring", text: "connection error"});
					clearInterval(scope.recheck);
				});
			}, parseInt(bridge.config.interval));
		}
		else
		{
			scope.status({fill: "grey", shape: "dot", text: "universal mode"});
		}


		//
		// TURN ON / OFF LIGHT
		this.on('input', function(msg)
		{
			var context = this.context();
			var tempLightID = (typeof msg.topic != 'undefined' && isNaN(msg.topic) == false && msg.topic.length > 0) ? parseInt(msg.topic) : lightID;

			// CHECK IF LIGHT ID IS SET
			if(tempLightID == false)
			{
				scope.error("No light Id defined. Please check the docs.");
				return false;
			}

			// SIMPLE TURN ON / OFF LIGHT
			if(msg.payload == true || msg.payload == false)
			{
				if(tempLightID != false)
				{
					client.lights.getById(tempLightID)
					.then(light => {
						light.on = msg.payload;
						return client.lights.save(light);
					})
					.then(light => {
						if(light != false)
						{
							scope.sendLightStatus(light);
						}
					})
					.catch(error => {
						scope.error(error, msg);
						scope.status({fill: "red", shape: "ring", text: "input error"});
						clearInterval(scope.recheck);
					});
				}
			}
			// ALERT EFFECT
			else if(typeof msg.payload.alert != 'undefined' && msg.payload.alert > 0)
			{
				client.lights.getById(tempLightID)
				.then(light => {
					context.set('lightPreviousState', [light.on ? true : false, light.brightness, light.xy ? light.xy : false]);

					// SET ALERT COLOR
					if(light.xy)
					{
						if(typeof msg.payload.rgb != 'undefined')
						{
							light.xy = rgb.convertRGBtoXY(msg.payload.rgb, light.model.id);
						}
						else if(typeof msg.payload.hex != 'undefined')
						{
							var rgbResult = hexRGB((msg.payload.hex).toString());
							light.xy = rgb.convertRGBtoXY([rgbResult.red, rgbResult.green, rgbResult.blue], light.model.id);
						}
						else if(typeof msg.payload.color != 'undefined')
						{
							var colorHex = colornames(msg.payload.color);
							if(colorHex)
							{
								light.xy = rgb.convertRGBtoXY(hexRGB(colorHex), light.model.id);
							}
						}
						else
						{
							light.xy = rgb.convertRGBtoXY([255,0,0], light.model.id);
						}
					}

					// ACTIVATE
					light.on = true;
					light.brightness = 254;
					light.transitionTime = 0;
					return client.lights.save(light);
				})
				.then(light => {
					// ACTIVATE ALERT
					if(light != false)
					{
						light.alert = 'lselect';
						return client.lights.save(light);
					}
					else
					{
						return false;
					}
				})
				.then(light => {
					// TURN OFF ALERT
					if(light != false)
					{
						var lightPreviousState = context.get('lightPreviousState');
						var alertSeconds = parseInt(msg.payload.alert);

						setTimeout(function() {
							light.on = lightPreviousState[0];
							light.alert = 'none';
							light.brightness = lightPreviousState[1];
							light.transitionTime = 2;

							if(lightPreviousState[2] != false)
							{
								light.xy = lightPreviousState[2];
							}

							client.lights.save(light);
						}, alertSeconds * 1000);
					}
				})
				.catch(error => {
					scope.error(error, msg);
					scope.status({fill: "red", shape: "ring", text: "input error"});
				});
			}
			// EXTENDED TURN ON / OFF LIGHT
			else
			{
				client.lights.getById(tempLightID)
				.then(light => {
					// SET LIGHT STATE
					if(typeof msg.payload.on != 'undefined')
					{
						light.on = msg.payload.on;
					}

					// SET BRIGHTNESS
					if(typeof msg.payload.brightness != 'undefined')
					{
						if(msg.payload.brightness > 100 || msg.payload.brightness < 0)
						{
							scope.error("Invalid brightness setting. Only 0 - 100 percent allowed");
							return false;
						}
						else if(msg.payload.brightness == 0)
						{
							light.on = false;
						}
						else
						{
							light.on = true;
							light.brightness = Math.round((254/100)*parseInt(msg.payload.brightness));
						}
					}

					// SET HUMAN READABLE COLOR
					if(msg.payload.color && light.xy)
					{
						var colorHex = colornames(msg.payload.color);
						if(colorHex)
						{
							light.xy = rgb.convertRGBtoXY(hexRGB(colorHex), light.model.id);
						}
					}

					// SET RGB COLOR
					if(msg.payload.rgb && light.xy)
					{
						light.xy = rgb.convertRGBtoXY(msg.payload.rgb, light.model.id);
					}

					// SET HEX COLOR
					if(msg.payload.hex && light.xy)
					{
						var rgbResult = hexRGB((msg.payload.hex).toString());
						light.xy = rgb.convertRGBtoXY([rgbResult.red, rgbResult.green, rgbResult.blue], light.model.id);
					}

					// SET COLOR TEMPERATURE
					if(msg.payload.colorTemp && light.colorTemp)
					{
						let colorTemp = parseInt(msg.payload.colorTemp);
						if(colorTemp >= 153 && colorTemp <= 500)
						{
							light.colorTemp = parseInt(msg.payload.colorTemp);
						}
						else
						{
							scope.error("Invalid color temprature. Only 153 - 500 allowed");
							return false;
						}
					}

					// SET SATURATION
					if(msg.payload.saturation && light.saturation)
					{
						if(msg.payload.saturation > 100 || msg.payload.saturation < 0)
						{
							scope.error("Invalid saturation setting. Only 0 - 254 allowed");
							return false;
						}
						else
						{
							light.saturation = Math.round((254/100)*parseInt(msg.payload.saturation));
						}
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
				})
				.then(light => {
					if(light != false)
					{
						// TRANSITION TIME? WAIT…
						if(msg.payload.transitionTime)
						{
							setTimeout(function() {
								scope.sendLightStatus(light);
							}, parseInt(msg.payload.transitionTime)*1010);
						}
						else
						{
							scope.sendLightStatus(light);
						}
					}
				})
				.catch(error => {
					scope.error(error, msg);
					scope.status({fill: "red", shape: "ring", text: "input error"});
				});
			}
		});


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

				if(config.colornamer == true)
				{
					var cNamesArray = colornamer(rgbHex(rgbColor[0], rgbColor[1], rgbColor[2]));
					message.payload.color = cNamesArray.basic[0]["name"];
				}
			}

			if(light.colorTemp)
			{
				message.payload.colorTemp = light.colorTemp;
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
