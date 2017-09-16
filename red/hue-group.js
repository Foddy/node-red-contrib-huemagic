module.exports = function(RED)
{
	function HueGroup(config)
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
		if(!config.groupid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "not configured"});
			return false;
		}

		//
		// INITIALIZE CLIENT
		var groupID = parseInt(config.groupid);
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
					}

					message.payload.updated = moment().format();

					scope.send(message);
				}
			})
			.catch(error => {
				scope.status({fill: "red", shape: "ring", text: "connection error"});
				clearInterval(scope.recheck);
			});
		}, parseInt(bridge.config.interval));

		//
		// TURN ON / OFF GROUP
		this.on('input', function(msg)
		{
			// SIMPLE TURN ON / OFF GROUP
			if(msg.payload == true || msg.payload == false)
			{
				client.groups.getById(groupID)
				.then(group => {
					group.on = msg.payload;
					return client.groups.save(group);
				})
				.then(group => {
					scope.sendGroupStatus(group);
				})
				.catch(error => {
					scope.error(error);
					scope.status({fill: "red", shape: "ring", text: "input error"});
					clearInterval(scope.recheck);
				});
			}
			// EXTENDED TURN ON / OFF GROUP
			else if(msg.payload.on)
			{
				client.groups.getById(groupID)
				.then(group => {
					group.on = msg.payload.on;

					// SET BRIGHTNESS
					if(msg.payload.brightness)
					{
						group.brightness = Math.round((254/100)*parseInt(msg.payload.brightness));
					}

					// SET RGB COLOR
					if(msg.payload.rgb && group.xy)
					{
						group.xy = rgb.convertRGBtoXY(msg.payload.rgb, false);
					}

					// SET HEX COLOR
					if(msg.payload.hex && group.xy)
					{
						group.xy = rgb.convertRGBtoXY(hexRGB((msg.payload.hex).toString()), false);
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
					scope.sendGroupStatus(group);
				})
				.catch(error => {
					scope.error(error);
					scope.status({fill: "red", shape: "ring", text: "input error"});
					clearInterval(scope.recheck);
				});
			}
			// ALERT EFFECT
			else if(msg.payload.alert && msg.payload.alert > 0)
			{
				client.groups.getById(groupID)
				.then(group => {
					var groupPreviousState = group;

					// SET RGB COLOR
					if(msg.payload.rgb && group.xy)
					{
						group.xy = rgb.convertRGBtoXY(msg.payload.rgb, false);
					}

					// SET HEX COLOR
					if(msg.payload.hex && group.xy)
					{
						group.xy = rgb.convertRGBtoXY(hexRGB((msg.payload.hex).toString()), false);
					}

					// SET TO RED IF NO COLOR SET
					if(!msg.payload.rgb && !msg.payload.hex && group.xy)
					{
						group.xy = rgb.convertRGBtoXY([255,0,0], false);
					}

					// REPEAT ALERT
					scope.repeatAlert(client, groupPreviousState, group, (parseInt(msg.payload.alert)-1));
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
		this.repeatAlert = function(client, previousGroup, alertGroup, repeat)
		{
			var scope = this;

			setTimeout(function() {
				alertGroup.on = true;
				alertGroup.alert = 'select';
				client.groups.save(alertGroup);

				if(repeat > 0)
				{
					repeat -= 1;
					scope.repeatAlert(client, previousGroup, alertGroup, repeat);
				}
				else
				{
					client.groups.save(previousGroup);
				}
			}, 1000);
		}

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