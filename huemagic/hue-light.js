module.exports = function(RED)
{
	"use strict";

	function HueLight(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let path = require('path');
		let { HueLightMessage } = require('../utils/messages');

		// HELPER
		let rgb = require('../utils/rgb');
		let hexRGB = require('hex-rgb');
		let colornames = require("colornames");
		let getColors = require('get-image-colors');

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-light.node.not-configured"});
			return false;
		}

		//
		// UPDATE STATE
		if(typeof bridge.disableupdates != 'undefined'||bridge.disableupdates == false)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-light.node.init"});
		}

		//
		// ON UPDATE
		if(config.lightid)
		{
			bridge.events.on('light' + config.lightid, function(light)
			{
				var hueLight = new HueLightMessage(light, config);
				var brightnessPercent = 0;

				// SEND STATUS
				if(light.reachable)
				{
					if(light.on)
					{
						// IS LIGHT?
						if(light.brightness)
						{
							brightnessPercent = hueLight.msg.payload.brightness;
							scope.status({fill: "yellow", shape: "dot", text: RED._("hue-light.node.turned-on-percent",{percent: brightnessPercent}) });
						}
						// IS SMART PLUG
						else
						{
							brightnessPercent = -1;
							scope.status({fill: "yellow", shape: "dot", text: "hue-light.node.turned-on"});
						}
					}
					else
					{
						scope.status({fill: "grey", shape: "dot", text: "hue-light.node.turned-off"});
					}
				}
				else
				{
					scope.status({fill: "red", shape: "ring", text: "hue-light.node.not-reachable"});
				}

				// SEND MESSAGE
				if(!config.skipevents) { scope.send(hueLight.msg); }
			});
		}
		else
		{
			scope.status({fill: "grey", shape: "dot", text: "hue-light.node.universal"});
		}


		//
		// TURN ON / OFF LIGHT
		this.on('input', function(msg, send, done)
		{
			// Node-RED < 1.0
			send = send || function() { scope.send.apply(scope,arguments); }

			var tempLightID = (typeof msg.topic != 'undefined' && isNaN(msg.topic) == false && msg.topic.length > 0) ? parseInt(msg.topic) : config.lightid;

			// CHECK IF LIGHT ID IS SET
			if(tempLightID == false)
			{
				scope.error(RED._("hue-light.node.error-no-id"));
				return false;
			}

			// SIMPLE TURN ON / OFF LIGHT
			if(msg.payload === true||msg.payload === false)
			{
				if(tempLightID != false)
				{
					bridge.client.lights.getById(tempLightID)
					.then(light => {
						light.on = msg.payload;
						return bridge.client.lights.save(light);
					})
					.then(light => {
						if(light != false)
						{
							scope.sendLightStatus(light, send, done);
						}
					})
					.catch(error => {
						scope.error(error, msg);
						scope.status({fill: "red", shape: "ring", text: "hue-light.node.error-input"});
						if(done) { done(error); }
					});
				}
			}
			// TOGGLE ON / OFF
			else if(typeof msg.payload != 'undefined' && typeof msg.payload.toggle != 'undefined')
			{
				if(tempLightID != false)
				{
					bridge.client.lights.getById(tempLightID)
					.then(light => {
						light.on = (light.on) ? false : true;
						return bridge.client.lights.save(light);
					})
					.then(light => {
						if(light != false)
						{
							scope.sendLightStatus(light, send, done);
						}
					})
					.catch(error => {
						scope.error(error, msg);
						scope.status({fill: "red", shape: "ring", text: "hue-light.node.error-input"});
						if(done) { done(error); }
					});
				}
			}
			// ALERT EFFECT
			else if(typeof msg.payload != 'undefined' && typeof msg.payload.alert != 'undefined' && msg.payload.alert > 0)
			{
				bridge.client.lights.getById(tempLightID)
				.then(light => {
					scope.context().set('lightPreviousState', [light.on ? true : false, light.brightness, light.xy ? light.xy : false]);

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
							if(msg.payload.color == "random"||msg.payload.color == "any")
							{
								var randomColor = '#'+(Math.random()*0xFFFFFF<<0).toString(16);
								var rgbResult = hexRGB(randomColor);
								light.xy = rgb.convertRGBtoXY([rgbResult.red, rgbResult.green, rgbResult.blue], light.model.id);
							}
							else
							{
								var colorHex = colornames(msg.payload.color);
								if(colorHex)
								{
									var rgbResult = hexRGB(colorHex);
									light.xy = rgb.convertRGBtoXY([rgbResult.red, rgbResult.green, rgbResult.blue], light.model.id);
								}
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
					return bridge.client.lights.save(light);
				})
				.then(light => {
					// ACTIVATE ALERT
					if(light != false)
					{
						light.alert = 'lselect';
						return bridge.client.lights.save(light);
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
						var lightPreviousState = scope.context().get('lightPreviousState');
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

							bridge.client.lights.save(light);
						}, alertSeconds * 1000);
					}
				})
				.catch(error => {
					scope.error(error, msg);
					scope.status({fill: "red", shape: "ring", text: "hue-light.node.error-input"});
					if(done) { done(error); }
				});
			}
			// ANIMATION STARTED?
			else if(typeof msg.animation != 'undefined' && msg.animation.status == true && msg.animation.restore == true)
			{
				bridge.client.lights.getById(tempLightID)
				.then(light => {
					scope.context().set('lightPreviousState', [(light.on) ? true : false, light.brightness, light.xy ? light.xy : false]);
				})
				.catch(error => {
					scope.error(error, msg);
					scope.status({fill: "red", shape: "ring", text: "hue-light.node.error-input"});
					if(done) { done(error); }
				});
			}
			// ANIMATION STOPPED AND RESTORE ACTIVE?
			else if(typeof msg.animation != 'undefined' && msg.animation.status == false && msg.animation.restore == true)
			{
				bridge.client.lights.getById(tempLightID)
				.then(light => {
					var lightPreviousState = scope.context().get('lightPreviousState');
					light.on = lightPreviousState[0];
					light.alert = 'none';
					light.brightness = lightPreviousState[1];
					light.transitionTime = 2;

					if(lightPreviousState[2] != false)
					{
						light.xy = lightPreviousState[2];
					}

					bridge.client.lights.save(light);
				})
				.catch(error => {
					scope.error(error, msg);
					scope.status({fill: "red", shape: "ring", text: "hue-light.node.error-input"});
					if(done) { done(error); }
				});
			}
			// EXTENDED TURN ON / OFF LIGHT
			else
			{
				bridge.client.lights.getById(tempLightID)
				.then(async (light) => {
					// SET LIGHT STATE
					if(typeof msg.payload != 'undefined' && typeof msg.payload.on != 'undefined')
					{
						light.on = msg.payload.on;
					}

					// SET BRIGHTNESS
					if(typeof msg.payload != 'undefined' && typeof msg.payload.brightness != 'undefined')
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
					else if(typeof msg.payload != 'undefined' && typeof msg.payload.brightnessLevel != 'undefined')
					{
						if(msg.payload.brightnessLevel > 254 || msg.payload.brightnessLevel < 0)
						{
							scope.error("Invalid brightness setting. Only 0 - 254 allowed");
							return false;
						}
						else if(msg.payload.brightness == 0)
						{
							light.on = false;
						}
						else
						{
							light.on = true;
							light.brightness = parseInt(msg.payload.brightnessLevel);
						}
					}
					else if(typeof msg.payload != 'undefined' && typeof msg.payload.incrementBrightness != 'undefined')
					{
						if (msg.payload.incrementBrightness > 0)
						{
							light.on = true;
						}
						light.incrementBrightness = Math.round((254/100)*parseInt(msg.payload.incrementBrightness));
					}
					else if(typeof msg.payload != 'undefined' && typeof msg.payload.decrementBrightness != 'undefined')
					{
						if (msg.payload.decrementBrightness > 0)
						{
							light.on = true;
						}
						light.incrementBrightness = Math.round((254/100)*parseInt(msg.payload.decrementBrightness))*-1;
					}

					// SET HUMAN READABLE COLOR OR RANDOM
					if(typeof msg.payload != 'undefined' && typeof msg.payload.color != 'undefined' && typeof light.xy != 'undefined')
					{
						if(msg.payload.color == "random"||msg.payload.color == "any")
						{
							var randomColor = '#'+(Math.random()*0xFFFFFF<<0).toString(16);
							var rgbResult = hexRGB(randomColor);
							light.xy = rgb.convertRGBtoXY([rgbResult.red, rgbResult.green, rgbResult.blue], light.model.id);
						}
						else
						{
							var colorHex = colornames(msg.payload.color);
							if(colorHex)
							{
								var rgbResult = hexRGB(colorHex);
								light.xy = rgb.convertRGBtoXY([rgbResult.red, rgbResult.green, rgbResult.blue], light.model.id);
							}
						}
					}

					// SET RGB COLOR
					if(typeof msg.payload != 'undefined' && typeof msg.payload.rgb != 'undefined' && typeof light.xy != 'undefined')
					{
						light.xy = rgb.convertRGBtoXY(msg.payload.rgb, light.model.id);
					}

					// SET HEX COLOR
					if(typeof msg.payload != 'undefined' && typeof msg.payload.hex != 'undefined' && typeof light.xy != 'undefined')
					{
						var rgbResult = hexRGB((msg.payload.hex).toString());
						light.xy = rgb.convertRGBtoXY([rgbResult.red, rgbResult.green, rgbResult.blue], light.model.id);
					}

					// SET COLOR TEMPERATURE
					if(typeof msg.payload != 'undefined' && typeof msg.payload.colorTemp != 'undefined' && typeof light.colorTemp != 'undefined')
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
                    else if(typeof msg.payload != 'undefined' && typeof msg.payload.incrementColorTemp != 'undefined')
                    {
                        light.incrementColorTemp = parseInt(msg.payload.incrementColorTemp, 10) || 0;
                    }

					// SET SATURATION
					if(typeof msg.payload != 'undefined' && typeof msg.payload.saturation != 'undefined' && typeof light.saturation != 'undefined')
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
					if(typeof msg.payload != 'undefined' && typeof msg.payload.transitionTime != 'undefined')
					{
						light.transitionTime = parseFloat(msg.payload.transitionTime);
					}

					// SET COLORLOOP EFFECT
					if(typeof msg.payload != 'undefined' && typeof msg.payload.colorloop != 'undefined' && msg.payload.colorloop > 0 && typeof light.xy != 'undefined')
					{
						light.effect = 'colorloop';

						// DISABLE AFTER
						setTimeout(function() {
							light.effect = 'none';
							bridge.client.lights.save(light);
						}, parseFloat(msg.payload.colorloop)*1000);
					}

					// SET DOMINANT COLORS FROM IMAGE
					if(typeof msg.payload != 'undefined' && typeof msg.payload.image != 'undefined' && typeof light.xy != 'undefined')
					{
						var colors = await getColors(msg.payload.image);
						if(colors.length > 0)
						{
							var colorsHEX = colors.map(color => color.hex());
							var rgbResult = hexRGB(colorsHEX[0]);
							light.xy = rgb.convertRGBtoXY([rgbResult.red, rgbResult.green, rgbResult.blue], light.model.id);
						}
					}

					return bridge.client.lights.save(light);
				})
				.then(light => {
					if(light != false)
					{
						// TRANSITION TIME? WAIT…
						if(typeof msg.payload != 'undefined' && typeof msg.payload.transitionTime != 'undefined')
						{
							setTimeout(function() {
								scope.sendLightStatus(light, send, done);
							}, parseFloat(msg.payload.transitionTime)*1010);
						}
						else
						{
							scope.sendLightStatus(light, send, done);
						}
					}
				})
				.catch(error => {
					scope.error(error, msg);
					scope.status({fill: "red", shape: "ring", text: "hue-light.node.error-input"});
					if(done) { done(error); }
				});
			}
		});


		//
		// SEND LIGHT STATUS
		this.sendLightStatus = function(light, send, done)
		{
			var hueLight = new HueLightMessage(light, config);

			// SEND STATUS
			if(light.on)
			{
				scope.status({fill: "yellow", shape: "dot", text: RED._("hue-light.node.turned-on-percent",{percent: hueLight.msg.payload.brightness}) });
			}
			else
			{
				scope.status({fill: "grey", shape: "dot", text: "hue-light.node.turned-off"});
			}

			// SEND MESSAGE
			if(!config.skipevents) { send(hueLight.msg); }
			if(done) { done(); }
		}

		//
		// CLOSE NODE / REMOVE EVENT LISTENER
		this.on('close', function()
		{
			bridge.events.removeAllListeners('light' + config.lightid);
		});
	}

	RED.nodes.registerType("hue-light", HueLight);
}
