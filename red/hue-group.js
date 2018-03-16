module.exports = function(RED)
{
	"use strict";

	function HueGroup(config)
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
		var groupID = (config.groupid) ? parseInt(config.groupid) : false;
		let client = new huejay.Client({
			host: (bridge.config.bridge).toString(),
			port: 80,
			username: bridge.config.key
		});

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "initializing…"});

		if(groupID != false)
		{
			this.recheck = setInterval(function()
			{
				client.groups.getById(groupID)
				.then(group => {
					var state = context.get('gstatus') || false;
					var uniqueStatus = ((group.on) ? "1" : "0") + group.brightness + group.hue + group.saturation + group.colorTemp + ((group.anyOn) ? "1" : "0") + ((group.allOn) ? "1" : "0");
					var brightnessPercent = 0;

					if(state != uniqueStatus)
					{
						context.set('gstatus', uniqueStatus);
						brightnessPercent = Math.round((100/254)*group.brightness);

						if(group.allOn)
						{
							scope.status({fill: "yellow", shape: "dot", text: "all lights on ("+ brightnessPercent +"%)"});
						}
						else if(group.anyOn)
						{
							scope.status({fill: "yellow", shape: "ring", text: "some lights on ("+ brightnessPercent +"%)"});
						}
						else if(group.on)
						{
							scope.status({fill: "yellow", shape: "dot", text: "turned on ("+ brightnessPercent +"%)"});
						}
						else
						{
							scope.status({fill: "grey", shape: "dot", text: "all lights off"});
						}

						// SEND STATUS
						var message = {};
						message.payload = {};
						message.payload.on = group.on;
						message.payload.allOn = group.allOn;
						message.payload.anyOn = group.anyOn;
						message.payload.brightness = brightnessPercent;

						message.info = {};
						message.info.id = group.id;
						message.info.lightIds = group.lightIds.join(', ');
						message.info.name = group.name;
						message.info.type = group.type;

						if(group.modelId !== undefined)
						{
							message.info.model = {};
							message.info.model.id = group.model.id;
							message.info.model.uniqueId = group.uniqueId;
							message.info.model.manufacturer = group.model.manufacturer;
							message.info.model.name = group.model.name;
							message.info.model.type = group.model.type;
						}

						if(group.xy)
						{
							var rgbColor = rgb.convertXYtoRGB(group.xy[0], group.xy[1], group.brightness);

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
				});
			}, parseInt(bridge.config.interval));
		}
		else
		{
			scope.status({fill: "grey", shape: "dot", text: "universal mode"});
		}


		//
		// TURN ON / OFF GROUP
		this.on('input', function(msg)
		{
			var context = this.context();
			var tempGroupID = (typeof msg.topic != 'undefined' && isNaN(msg.topic) == false && msg.topic.length > 0) ? parseInt(msg.topic) : groupID;

			// CHECK IF GROUP ID IS SET
			if(tempGroupID == false)
			{
				scope.error("No group Id defined. Please check the docs.");
				return false;
			}

			// SIMPLE TURN ON / OFF GROUP
			if(msg.payload == true || msg.payload == false)
			{
				client.groups.getById(tempGroupID)
				.then(group => {
					group.on = msg.payload;
					return client.groups.save(group);
				})
				.then(group => {
					scope.sendGroupStatus(group);
				})
				.catch(error => {
					scope.error(error, msg);
					scope.status({fill: "red", shape: "ring", text: "input error"});
					clearInterval(scope.recheck);
				});
			}
			// ALERT EFFECT
			else if(typeof msg.payload.alert != 'undefined' && msg.payload.alert > 0)
			{
				client.groups.getById(tempGroupID)
				.then(group => {
					context.set('groupPreviousState', [group.on ? true : false, group.brightness, group.xy ? group.xy : false]);

					// SET ALERT COLOR
					if(group.xy)
					{
						if(typeof msg.payload.rgb != 'undefined')
						{
							group.xy = rgb.convertRGBtoXY(msg.payload.rgb, false);
						}
						else if(typeof msg.payload.hex != 'undefined')
						{
							var rgbResult = hexRGB((msg.payload.hex).toString());
							group.xy = rgb.convertRGBtoXY([rgbResult.red, rgbResult.green, rgbResult.blue], false);
						}
						else if(typeof msg.payload.color != 'undefined')
						{
							var colorHex = colornames(msg.payload.color);
							if(colorHex)
							{
								group.xy = rgb.convertRGBtoXY(hexRGB(colorHex), false);
							}
						}
						else
						{
							group.xy = rgb.convertRGBtoXY([255,0,0], false);
						}
					}

					// ACTIVATE
					group.on = true;
					group.brightness = 254;
					group.transitionTime = 0;
					return client.groups.save(group);
				})
				.then(group => {
					// ACTIVATE ALERT
					group.alert = 'lselect';
					return client.groups.save(group);
				})
				.then(group => {
					// TURN OFF ALERT
					var groupPreviousState = context.get('groupPreviousState');
					var alertSeconds = parseInt(msg.payload.alert);

					setTimeout(function() {
						group.on = groupPreviousState[0];
						group.alert = 'none';
						group.brightness = groupPreviousState[1];
						group.transitionTime = 2;

						if(groupPreviousState[2] != false)
						{
							group.xy = groupPreviousState[2];
						}

						client.groups.save(group);
					}, alertSeconds * 1000);
				})
				.catch(error => {
					scope.error(error, msg);
					scope.status({fill: "red", shape: "ring", text: "input error"});
				});
			}
			// EXTENDED TURN ON / OFF GROUP
			else
			{
				client.groups.getById(tempGroupID)
				.then(group => {

					// SET GROUP STATE
					if(typeof msg.payload.on != 'undefined')
					{
						group.on = msg.payload.on;
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
							group.on = false;
						}
						else
						{
							group.on = true;
							group.brightness = Math.round((254/100)*parseInt(msg.payload.brightness));
						}
					}

					// SET HUMAN READABLE COLOR
					if(msg.payload.color && light.xy)
					{
						var colorHex = colornames(msg.payload.color);
						if(colorHex)
						{
							group.xy = rgb.convertRGBtoXY(hexRGB(colorHex), false);
						}
					}

					// SET RGB COLOR
					if(msg.payload.rgb && group.xy)
					{
						group.xy = rgb.convertRGBtoXY(msg.payload.rgb, false);
					}

					// SET HEX COLOR
					if(msg.payload.hex && group.xy)
					{
						var rgbResult = hexRGB((msg.payload.hex).toString());
						group.xy = rgb.convertRGBtoXY([rgbResult.red, rgbResult.green, rgbResult.blue], false);
					}

					// SET SATURATION
					if(msg.payload.saturation && group.saturation)
					{
						if(msg.payload.saturation > 100 || msg.payload.saturation < 0)
						{
							scope.error("Invalid saturation setting. Only 0 - 254 allowed", msg);
							return false;
						}
						else
						{
							group.saturation = Math.round((254/100)*parseInt(msg.payload.saturation));
						}
					}

					// SET COLOR TEMPERATURE
					if(msg.payload.colorTemp && group.colorTemp)
					{
						let colorTemp = parseInt(msg.payload.colorTemp);
						if(colorTemp >= 153 && colorTemp <= 500)
						{
							group.colorTemp = parseInt(msg.payload.colorTemp);
						}
						else
						{
							scope.error("Invalid color temprature. Only 153 - 500 allowed", msg);
							return false;
						}
					}

					// SET TRANSITION TIME
					if(msg.payload.transitionTime)
					{
						group.transitionTime = parseInt(msg.payload.transitionTime);
					}

					// SET COLORLOOP EFFECT
					if(msg.payload.colorloop && msg.payload.colorloop > 0 && group.xy)
					{
						group.effect = 'colorloop';

						// DISABLE AFTER
						setTimeout(function() {
							group.effect = 'none';
							client.groups.save(group)
						}, parseInt(msg.payload.colorloop)*1000);
					}

					return client.groups.save(group);
				})
				.then(group => {
					// TRANSITION TIME? WAIT…
					if(msg.payload.transitionTime)
					{
						setTimeout(function() {
							scope.sendGroupStatus(group);
						}, parseInt(msg.payload.transitionTime)*1010);
					}
					else
					{
						scope.sendGroupStatus(group);
					}
				})
				.catch(error => {
					scope.error(error, msg);
					scope.status({fill: "red", shape: "ring", text: "input error"});
				});
			}
		});


		//
		// SEND GROUP STATUS
		this.sendGroupStatus = function(group)
		{
			var scope = this;

			var state = scope.context().get('gstatus') || false;
			var uniqueStatus = ((group.on) ? "1" : "0") + group.brightness + group.hue + group.saturation + group.colorTemp + ((group.anyOn) ? "1" : "0") + ((group.allOn) ? "1" : "0");
			var brightnessPercent = Math.round((100/254)*group.brightness);

			if(group.allOn)
			{
				scope.status({fill: "yellow", shape: "dot", text: "all lights on ("+ brightnessPercent +"%)"});
			}
			else if(group.anyOn)
			{
				scope.status({fill: "yellow", shape: "ring", text: "some lights on ("+ brightnessPercent +"%)"});
			}
			else if(group.on)
			{
				scope.status({fill: "yellow", shape: "dot", text: "turned on ("+ brightnessPercent +"%)"});
			}
			else
			{
				scope.status({fill: "grey", shape: "dot", text: "all lights off"});
			}

			// SEND STATUS
			var message = {};
			message.payload = {};
			message.payload.on = group.on;
			message.payload.allOn = group.allOn;
			message.payload.anyOn = group.anyOn;
			message.payload.brightness = brightnessPercent;

			message.info = {};
			message.info.id = group.id;
			message.info.lightIds = group.lightIds.join(', ');
			message.info.name = group.name;
			message.info.type = group.type;
			message.info.class = group.class;

			if(group.modelId !== undefined)
			{
				message.info.model = {};
				message.info.model.id = group.model.id;
				message.info.model.uniqueId = group.uniqueId;
				message.info.model.manufacturer = group.model.manufacturer;
				message.info.model.name = group.model.name;
				message.info.model.type = group.model.type;
			}

			if(group.xy)
			{
				var rgbColor = rgb.convertXYtoRGB(group.xy[0], group.xy[1], group.brightness);

				message.payload.rgb = rgbColor;
				message.payload.hex = rgbHex(rgbColor[0], rgbColor[1], rgbColor[2]);

				if(config.colornamer == true)
				{
					var cNamesArray = colornamer(rgbHex(rgbColor[0], rgbColor[1], rgbColor[2]));
					message.payload.color = cNamesArray.basic[0]["name"];
				}
			}

			if(group.colorTemp)
			{
				message.payload.colorTemp = group.colorTemp;
			}

			message.payload.updated = moment().format();

			scope.send(message);
			scope.context().set('gstatus', uniqueStatus);
		}

		//
		// CLOSE NDOE / REMOVE RECHECK INTERVAL
		this.on('close', function()
		{
			clearInterval(scope.recheck);
		});
	}

	RED.nodes.registerType("hue-group", HueGroup);
}
