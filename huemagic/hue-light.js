module.exports = function(RED)
{
	"use strict";

	function HueLight(config)
	{
		RED.nodes.createNode(this, config);

		const scope = this;
		const bridge = RED.nodes.getNode(config.bridge);
		const async = require('async');

		// SAVE FUTURE PATCH
		this.futurePatchState = {};

		// SAVE LAST COMMAND
		this.lastCommand = null;

		// HELPER
		const colorUtils = require('./utils/color');
		const merge = require('./utils/merge');

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-light.node.not-configured"});
			return false;
		}

		//
		// UNIVERSAL MODE?
		if(!config.lightid)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-light.node.universal"});
		}

		//
		// UPDATE STATE
		if(typeof bridge.disableupdates != 'undefined' || bridge.disableupdates == false)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-light.node.init"});
		}

		//
		// SUBSCRIBE TO UPDATES FROM THE BRIDGE
		bridge.subscribe(scope, "light", config.lightid, function(info)
		{
			let currentState = bridge.get("light", info.id, { colornames: config.colornamer ? true : false });

			// RESOURCE FOUND?
			if(currentState !== false)
			{
				// SEND MESSAGE
				if(!config.skipevents && (config.initevents || info.suppressMessage == false))
				{
					// SET LAST COMMAND
					if(scope.lastCommand !== null)
					{
						currentState.command = scope.lastCommand;
					}

					// SEND STATE
					scope.send(currentState);

					// RESET LAST COMMAND
					scope.lastCommand = null;
				}

				// NOT IN UNIVERAL MODE? -> CHANGE UI STATES
				if(config.lightid)
				{
					if(currentState.payload.reachable === true)
					{
						if(currentState.payload.on === true)
						{
							// APPLY FUTURE STATE COMMANDS
							if(Object.values(scope.futurePatchState).length > 0)
							{
								scope.applyCommands({}, null, null);
							}

							if(currentState.payload.brightness !== false)
							{
								scope.status({fill: "yellow", shape: "dot", text: RED._("hue-light.node.turned-on-percent",{ percent: currentState.payload.brightness })});
							}
							else
							{
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
						var offNotReachableStatus = RED._("hue-light.node.turned-off") + " (" + RED._("hue-light.node.not-reachable") + ")";
						scope.status({fill: "red", shape: "ring", text: offNotReachableStatus});
					}
				}
			}
		});

		//
		// CONTROL LIGHT
		this.on('input', function(msg, send, done) { scope.applyCommands(msg, send, done); });

		//
		// APPLY COMMANDS
		this.applyCommands = async function(msg, send = null, done = null)
		{
			// REDEFINE SEND AND DONE IF NOT AVAILABLE
			send = send || function() { scope.send.apply(scope,arguments); }
			done = done || function() { scope.done.apply(scope,arguments); }

			// SAVE LAST COMMAND
			scope.lastCommand = RED.util.cloneMessage(msg);

			// CREATE PATCH
			let patchObject = {};

			// DEFINE SENSOR ID & CURRENT STATE
			const tempLightID = (!config.lightid && typeof msg.topic != 'undefined' && bridge.validResourceID.test(msg.topic) === true) ? msg.topic : config.lightid;
			let currentState = bridge.get("light", tempLightID, { colornames: config.colornamer ? true : false });
			if(!currentState)
			{
				scope.error("The light in not yet available. Please wait until HueMagic has established a connection with the bridge or check whether the resource ID in the configuration is valid.");
				return false;
			}

			// CHECK IF LIGHT ID IS SET
			if(!tempLightID)
			{
				scope.error(RED._("hue-light.node.error-no-id"));
				return false;
			}

			// GET CURRENT STATE
			if( (typeof msg.payload != 'undefined' && typeof msg.payload.status != 'undefined') || (typeof msg.__user_inject_props__ != 'undefined' && msg.__user_inject_props__ == "status") )
			{
				// SET LAST COMMAND
				if(scope.lastCommand !== null)
				{
					currentState.command = scope.lastCommand;
				}

				// SEND STATE
				scope.send(currentState);

				// RESET LAST COMMAND
				scope.lastCommand = null;

				if(done) { done(); }
				return true;
			}

			// GET FUTURE STATE
			if(Object.values(scope.futurePatchState).length > 0)
			{
				patchObject = Object.assign({}, scope.futurePatchState);
				scope.futurePatchState = {};
			}

			// COLORLOOP EFFECT
			if(typeof msg.payload != 'undefined' && typeof msg.payload.colorloop != 'undefined' && msg.payload.colorloop > 0)
			{
				patchObject = {
					"on": true,
					"effect": "colorloop",
					"bri": msg.payload.brightness ? Math.round((254/100)*msg.payload.brightness) : currentState.brightnessLevel
				};

				// PATCH!
				async.retry({
					times: 5,
					errorFilter: function(err) {
						return (err.status == 503 || err.status == 429);
					},
					interval: function(retryCount) { return 750*retryCount; }
				},
				function(callback, results)
				{
					bridge.patch("light", currentState.info.idV1 + "/state", patchObject, 1)
					.then(function(status)
					{
						// RESET COLORLOOP ANIMATION AFTER X SECONDS
						setTimeout(function()
						{
							bridge.patch("light", currentState.info.idV1 + "/state", { "effect": "none" }, 1);
						}, parseInt(msg.payload.colorloop) * 1000);

						callback(null, true);
					})
					.catch(function(errors)
					{
						callback(errors, null);
					});
				},
				function(errors, success)
				{
					if(errors)
					{
						scope.error(errors);
						scope.status({fill: "red", shape: "ring", text: "hue-light.node.error-input"});
					}
					else if(done)
					{
						done();
					}
				});

				return false;
			}

			// ALERT EFFECT
			if(typeof msg.payload != 'undefined' && typeof msg.payload.alert != 'undefined' && msg.payload.alert > 0)
			{
				// SAVE PREVIOUS STATE
				scope.context().set('lightPreviousState', currentState);

				// TURN ON LIGHT
				if(currentState.payload.on === false)
				{
					patchObject["on"] = { on: true };
				}

				// SET BRIGHTNESS
				if(!msg.payload.brightness && currentState.payload.brightness != 100)
				{
					patchObject["dimming"] = { brightness: 100 };
				}
				else if(msg.payload.brightness)
				{
					patchObject["dimming"] = { brightness: parseInt(msg.payload.brightness) };
				}

				// SET TRANSITION
				patchObject["dynamics"] = { duration: 0 };

				// CAN CHANGE COLOR?
				if(currentState.payload.xyColor)
				{
					let XYAlertColor = {};

					if(typeof msg.payload.rgb != 'undefined')
					{
						XYAlertColor = colorUtils.rgbToXy(msg.payload.rgb[0], msg.payload.rgb[1], msg.payload.rgb[2], currentState.info.model.colorGamut);
					}
					else if(typeof msg.payload.hex != 'undefined')
					{
						let rgbFromHex = colorUtils.hexRgb((msg.payload.hex).toString());
						XYAlertColor = colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2], currentState.info.model.colorGamut);
					}
					else if(typeof msg.payload.color != 'undefined')
					{
						if(new RegExp("random|any|whatever").test(msg.payload.color))
						{
							const randomColor = colorUtils.randomHexColor();
							let rgbFromHex = colorUtils.hexRgb(rgbFromHex);
							XYAlertColor = colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2], currentState.info.model.colorGamut);
						}
						else
						{
							var colorHex = colorUtils.colornames(msg.payload.color);
							if(colorHex)
							{
								let rgbFromHex = colorUtils.hexRgb(colorHex);
								XYAlertColor = colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2], currentState.info.model.colorGamut);
							}
						}
					}
					else
					{
						XYAlertColor = colorUtils.rgbToXy(255, 0, 0, currentState.info.model.colorGamut);
					}

					patchObject["color"] = {
						xy: XYAlertColor
					};
				}

				// CHANGE NODE UI STATE
				if(config.lightid)
				{
					scope.status({fill: "grey", shape: "ring", text: "hue-light.node.command"});
				}


				// APPLY THE EFFECT
				async.retry({
					times: 5,
					errorFilter: function(err) {
						return (err.status == 503 || err.status == 429);
					},
					interval: function(retryCount) { return 750*retryCount; }
				},
				function(callback, results)
				{
					// 1. TURN ON THE LIGHT BULB
					bridge.patch("light", tempLightID, patchObject)
					.then(function(status) {
						// 2. APPLY ALERT EFFECT
						const alertEffect = { alert: { action: "breathe" }};
						return bridge.patch("light", tempLightID, alertEffect);
					})
					.then(function(status) {
						// 3. RESET PREVIOUS STATE (AFTER X SECONDS)
						setTimeout(function()
						{
							const tempPreviousState = scope.context().get('lightPreviousState');
							var tempPreviousStatePatch = {};

							tempPreviousStatePatch.dimming = { brightness: tempPreviousState.payload.brightness };
							if(tempPreviousState.payload.xyColor)
							{
								tempPreviousStatePatch.color = { xy: tempPreviousState.payload.xyColor };
							}
							else if(tempPreviousState.payload.colorTemp)
							{
								tempPreviousStatePatch.color_temperature = { mirek: tempPreviousState.payload.colorTemp };
							}

							bridge.patch("light", tempLightID, tempPreviousStatePatch).
							then(function(status)
							{
								return bridge.patch("light", tempLightID, { on: { on: false } })
								.then(function() { if(done) { done(); }});
							})
							.then(function(status) {
								if(tempPreviousState.payload.on === true)
								{
									bridge.patch("light", tempLightID, { on: { on: true } })
									.then(function() { if(done) { done(); }});
								}
							});
						}, parseInt(msg.payload.alert) * 1000);
						callback(null, true);
					})
					.catch(function(errors) {
						callback(errors, null);
					});
				},
				function(errors, success)
				{
					if(errors)
					{
						scope.error(errors);
						scope.status({fill: "red", shape: "ring", text: "hue-light.node.error-input"});
					}
					else if(done)
					{
						done();
					}
				});
			}
			// ANIMATION STARTED?
			else if(typeof msg.animation != 'undefined' && msg.animation.status == true && msg.animation.restore == true)
			{
				// SAVE PREVIOUS STATE
				scope.context().set('lightPreviousState', currentState);
			}
			// ANIMATION STOPPED AND RESTORE ACTIVE?
			else if(typeof msg.animation != 'undefined' && msg.animation.status == false && msg.animation.restore == true)
			{
				const tempPreviousState = scope.context().get('lightPreviousState');
				var tempPreviousStatePatch = {};

				tempPreviousStatePatch.dimming = { brightness: tempPreviousState.payload.brightness };
				if(tempPreviousState.payload.xyColor)
				{
					tempPreviousStatePatch.color = { xy: tempPreviousState.payload.xyColor };
				}
				else if(tempPreviousState.payload.colorTemp)
				{
					tempPreviousStatePatch.color_temperature = { mirek: tempPreviousState.payload.colorTemp };
				}

				// PATCH!
				async.retry({
					times: 5,
					errorFilter: function(err) {
						return (err.status == 503 || err.status == 429);
					},
					interval: function(retryCount) { return 750*retryCount; }
				},
				function(callback, results)
				{
					bridge.patch("light", tempLightID, tempPreviousStatePatch)
					.then(function(status)
					{
						if(tempPreviousState.payload.on === false)
						{
							bridge.patch("light", tempLightID, { on: { on: false } })
							.then(function() { callback(null, true); });
						}
						else
						{
							bridge.patch("light", tempLightID, { on: { on: false } })
							.then(function(status) {
								callback(null, true);
								return bridge.patch("light", tempLightID, { on: { on: true } });
							});
						}
					})
					.catch(function(errors) { callback(errors, null); });
				},
				function(errors, success)
				{
					if(errors)
					{
						scope.error(errors);
					}
					else if(done)
					{
						done();
					}
				});
			}
			// EXTENDED COMMANDS
			else
			{
				// SET LIGHT STATE SIMPLE MODE
				if(msg.payload === true||msg.payload === false)
				{
					if(msg.payload !== currentState.payload.on) { patchObject["on"] = { on: msg.payload }; }
				}

				// SET LIGHT STATE
				if(typeof msg.payload != 'undefined' && typeof msg.payload.on != 'undefined' && (msg.payload.on === true || msg.payload.on === false))
				{
					if(msg.payload.on !== currentState.payload.on) { patchObject["on"] = { on: msg.payload.on }; }
				}

				// TOGGLE ON / OFF
				if(typeof msg.payload != 'undefined' && typeof msg.payload.toggle != 'undefined')
				{
					patchObject["on"] = { on: !currentState.payload.on };
				}

				// SET BRIGHTNESS
				if(typeof msg.payload != 'undefined' && typeof msg.payload.brightness != 'undefined')
				{
					// AUTO BRIGHTNESS BASED ON DAY TIME
					if(new RegExp("auto|automatic").test(msg.payload.brightness))
					{
						let ct = colorUtils.colorTemperature();
						let autoBrightness = ((300-ct)/2)+100;
						autoBrightness = (autoBrightness > 100) ? 100 : autoBrightness;
						autoBrightness = (autoBrightness < 20) ? 20 : autoBrightness;

						// SET CALCULATED BRIGHTNESS
						patchObject["dimming"] = { brightness: autoBrightness };
					}
					else
					{
						if(msg.payload.brightness > 100 || msg.payload.brightness < 0)
						{
							scope.error("Invalid brightness setting. Only 0 - 100 percent allowed");
							return false;
						}
						else if(msg.payload.brightness == 0)
						{
							if(currentState.payload.on !== false) { patchObject["on"] = { on: false }; }
						}
						else
						{
							patchObject["dimming"] = { brightness: msg.payload.brightness };
						}
					}
				}
				else if(typeof msg.payload != 'undefined' && typeof msg.payload.brightnessLevel != 'undefined')
				{
					if(msg.payload.brightnessLevel > 254 || msg.payload.brightnessLevel < 0)
					{
						scope.error("Invalid brightness setting. Only 0 - 254 allowed");
						return false;
					}
					else if(msg.payload.brightness == 0)
					{
						if(currentState.payload.on !== false) { patchObject["on"] = { on: false }; }
					}
					else
					{
						patchObject["dimming"] = { brightness: Math.round((100/254)*msg.payload.brightnessLevel) };
					}
				}
				else if(typeof msg.payload != 'undefined' && typeof msg.payload.incrementBrightness != 'undefined')
				{
					let incrementBy = (isNaN(msg.payload.incrementBrightness)) ? 10 : msg.payload.incrementBrightness;
					let targetBrightness = Math.round(currentState.payload.brightness + incrementBy);
					targetBrightness = (targetBrightness > 100) ? 100 : targetBrightness;

					patchObject["dimming"] = { brightness: targetBrightness };
				}
				else if(typeof msg.payload != 'undefined' && typeof msg.payload.decrementBrightness != 'undefined')
				{
					let decrementBy = (isNaN(msg.payload.decrementBrightness)) ? 10 : msg.payload.decrementBrightness;
					let targetBrightness = Math.round(currentState.payload.brightness - decrementBy);
					targetBrightness = (targetBrightness < 0) ? 0 : targetBrightness;

					if(targetBrightness < 1)
					{
						if(currentState.payload.on !== false) { patchObject["on"] = { on: false }; }
					}

					patchObject["dimming"] = { brightness: targetBrightness };
				}

				// SET HUMAN READABLE COLOR OR RANDOM
				if(typeof msg.payload != 'undefined' && typeof msg.payload.color != 'undefined' && typeof currentState.payload.xyColor != 'undefined')
				{
					let XYAlertColor = {};

					if(new RegExp("random|any|whatever").test(msg.payload.color))
					{
						const randomColor = colorUtils.randomHexColor();
						let rgbFromHex = colorUtils.hexRgb(randomColor);
						XYAlertColor = colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2], currentState.info.model.colorGamut);
					}
					else
					{
						var colorHex = colorUtils.colornames(msg.payload.color);
						if(colorHex)
						{
							let rgbFromHex = colorUtils.hexRgb(colorHex);
							XYAlertColor = colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2], currentState.info.model.colorGamut);
						}
					}

					patchObject["color"] = {
						xy: XYAlertColor
					};
				}

				// SET HEX COLOR
				if(typeof msg.payload != 'undefined' && typeof msg.payload.hex != 'undefined' && typeof currentState.payload.xyColor != 'undefined')
				{
					let rgbFromHex = colorUtils.hexRgb((msg.payload.hex).toString());
					patchObject["color"] = {
						xy: colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2], currentState.info.model.colorGamut)
					};
				}

				// SET RGB COLOR
				if(typeof msg.payload != 'undefined' && typeof msg.payload.rgb != 'undefined' && typeof currentState.payload.xyColor != 'undefined' && msg.payload.rgb.length === 3)
				{
					patchObject["color"] = {
						xy: colorUtils.rgbToXy(msg.payload.rgb[0], msg.payload.rgb[1], msg.payload.rgb[2], currentState.info.model.colorGamut)
					};
				}

				// SET XY COLOR
				if(typeof msg.payload != 'undefined' && typeof msg.payload.xyColor != 'undefined' && typeof currentState.payload.xyColor != 'undefined')
				{
					patchObject["color"] = {
						xy: msg.payload.xyColor
					};
				}

				// MIX CURRENT COLOR WITH NEW COLOR
				if(typeof msg.payload != 'undefined' && typeof msg.payload.mixColor != 'undefined' && typeof currentState.payload.xyColor != 'undefined')
				{
					let RGBColor = [];

					if(typeof msg.payload.mixColor.color != 'undefined')
					{
						if(new RegExp("random|any|whatever").test(msg.payload.mixColor.color))
						{
							RGBColor = colorUtils.hexRgb(colorUtils.randomHexColor());
						}
						else
						{
							var colorHex = colorUtils.colornames(msg.payload.mixColor.color);
							if(colorHex)
							{
								RGBColor = colorUtils.hexRgb(colorHex);
							}
						}
					}
					else if(typeof msg.payload.mixColor.rgb != 'undefined')
					{
						RGBColor = msg.payload.mixColor.rgb;
					}
					else if(typeof msg.payload.mixColor.hex != 'undefined')
					{
						RGBColor = colorUtils.hexRgb((msg.payload.mixColor.hex).toString());
					}
					else if(typeof msg.payload.mixColor.xyColor != 'undefined')
					{
						RGBColor = colorUtils.xyBriToRgb(msg.payload.mixColor.xyColor.x, msg.payload.mixColor.xyColor.y, 100);
					}

					// GET MIXING AMOUNT
					let mixingAmount = 0.5;
					if(typeof msg.payload.mixColor.amount != 'undefined' && msg.payload.mixColor.amount > 0 && msg.payload.mixColor.amount <= 100)
					{
						mixingAmount = msg.payload.mixColor.amount/100;
					}

					// HAS CURRENT COLOR SETTING?
					if(currentState.payload.rgb !== false)
					{
						let mixedRGBColor = colorUtils.mixColors(currentState.payload.rgb, RGBColor, mixingAmount);
						patchObject["color"] = {
							xy: colorUtils.rgbToXy(mixedRGBColor[0], mixedRGBColor[1], mixedRGBColor[2], currentState.info.model.colorGamut)
						};
					}
					else
					{
						patchObject["color"] = {
							xy: colorUtils.rgbToXy(RGBColor[0], RGBColor[1], RGBColor[2], currentState.info.model.colorGamut)
						};
					}
				}

				// SET COLOR TEMPERATURE
				if(typeof msg.payload != 'undefined' && typeof msg.payload.colorTemp != 'undefined' && typeof currentState.payload.colorTemp != 'undefined')
				{
					// DETERMINE IF AUTOMATIC, WARM, COLD, INT
					if(!isNaN(msg.payload.colorTemp))
					{
						let colorTemp = parseInt(msg.payload.colorTemp);
						if(colorTemp >= 153 && colorTemp <= 500)
						{
							patchObject["color_temperature"] = { mirek: colorTemp };
						}
						else
						{
							scope.error("Invalid color temprature. Only 153 - 500 allowed");
							return false;
						}
					}
					else if(msg.payload.colorTemp == "cold")
					{
						patchObject["color_temperature"] = { mirek: 153 };
					}
					else if(msg.payload.colorTemp == "normal")
					{
						patchObject["color_temperature"] = { mirek: 240 };
					}
					else if(msg.payload.colorTemp == "warm")
					{
						patchObject["color_temperature"] = { mirek: 400 };
					}
					else if(msg.payload.colorTemp == "hot")
					{
						patchObject["color_temperature"] = { mirek: 500 };
					}
					else
					{
						// SET TEMPERATURE
						patchObject["color_temperature"] = { mirek: colorUtils.colorTemperature() };
					}
				}
				else if(typeof msg.payload != 'undefined' && typeof msg.payload.incrementColorTemp != 'undefined' && typeof currentState.payload.colorTemp != 'undefined')
				{
					let incrementBy = (isNaN(msg.payload.incrementColorTemp)) ? 50 : msg.payload.incrementColorTemp;
					let targetColorTemperature = currentState.payload.colorTemp + parseInt(incrementBy);
					targetColorTemperature = (targetColorTemperature > 500) ? 500 : targetColorTemperature;
					targetColorTemperature = (targetColorTemperature < 153) ? 153 : targetColorTemperature;

					// SET TEMPERATURE
					patchObject["color_temperature"] = { mirek: targetColorTemperature };
				}
				else if(typeof msg.payload != 'undefined' && typeof msg.payload.decrementColorTemp != 'undefined' && typeof currentState.payload.colorTemp != 'undefined')
				{
					let decrementBy = (isNaN(msg.payload.decrementColorTemp)) ? 50 : msg.payload.decrementColorTemp;
					let targetColorTemperature = currentState.payload.colorTemp - parseInt(decrementBy);
					targetColorTemperature = (targetColorTemperature > 500) ? 500 : targetColorTemperature;
					targetColorTemperature = (targetColorTemperature < 153) ? 153 : targetColorTemperature;

					// SET TEMPERATURE
					patchObject["color_temperature"] = { mirek: targetColorTemperature };
				}

				// SET TRANSITION TIME
				if(typeof msg.payload != 'undefined' && typeof msg.payload.transitionTime != 'undefined')
				{
					let targetTransitionTime = parseFloat(msg.payload.transitionTime)*1000;
					targetTransitionTime = (targetTransitionTime > 6000000) ? 6000000 : targetTransitionTime;
					targetTransitionTime = (targetTransitionTime < 0) ? 0 : targetTransitionTime;

					patchObject["dynamics"] = { duration: targetTransitionTime };
				}

				// SET DOMINANT COLORS FROM IMAGE
				if(typeof msg.payload != 'undefined' && typeof msg.payload.image != 'undefined' && (typeof currentState.payload.xyColor != 'undefined' || typeof currentState.payload.gradient != 'undefined'))
				{
					let colors = await colorUtils.getColors(msg.payload.image);
					if(colors.length > 0)
					{
						let colorsHEX = colors.map(color => color.hex());

						// SET MULTIPLE COLORS ON SUPPORTED LIGHTS
						if(typeof currentState.payload.gradient != 'undefined')
						{
							let XYColorSet = [];

							for (var i = 0; i < currentState.payload.gradient.totalColors; i++)
							{
								if(typeof colorsHEX[i] != 'undefined')
								{
									let rgbFromHex = colorUtils.hexRgb(colorsHEX[i]);
									XYColorSet.push({
										color: { xy: colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2], currentState.info.model.colorGamut) }
									});
								}
							}

							if(XYColorSet.length > 0)
							{
								patchObject["gradient"] = { points: XYColorSet };
							}
						}
						// SET SINGLE COLOR
						else
						{
							let rgbFromHex = colorUtils.hexRgb(colorsHEX[0]);
							patchObject["color"] = {
								xy: colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2], currentState.info.model.colorGamut)
							};
						}
					}
				}

				// SET SATURATION
				if(typeof msg.payload != 'undefined' && typeof msg.payload.saturation != 'undefined' && typeof currentState.payload.xyColor != 'undefined')
				{
					if(msg.payload.saturation > 100 || msg.payload.saturation < 0)
					{
						scope.error("Invalid saturation setting. Only 0 - 100 allowed");
						return false;
					}
					else
					{
						let currentColor = patchObject["color"] ? colorUtils.xyBriToRgb(patchObject["color"].xy.x, patchObject["color"].xy.y, 100) : currentState.payload.rgb;
						let currentColorInHSL = colorUtils.rgbToHsl(currentColor[0], currentColor[1], currentColor[2]);
						let saturationFactor = (msg.payload.saturation/100);

						// CHANGE SATURATION
						currentColorInHSL[1] = currentColorInHSL[1]*saturationFactor;

						// CONVERT BACK TO RGB
						let saturatedRGBColor = colorUtils.hslToRgb(currentColorInHSL[0], currentColorInHSL[1], currentColorInHSL[2]);

						patchObject["color"] = {
							xy: colorUtils.rgbToXy(saturatedRGBColor[0], saturatedRGBColor[1], saturatedRGBColor[2], currentState.info.model.colorGamut)
						};
					}
				}

				// SET GRADIENT
				if(typeof msg.payload != 'undefined' && typeof msg.payload.gradient != 'undefined' && typeof currentState.payload.gradient != 'undefined')
				{
					let XYColorSet = [];

					if(typeof msg.payload.gradient.hex != 'undefined' && Array.isArray(msg.payload.gradient.hex) == true)
					{
						XYColorSet = [];

						for(let oneColor in msg.payload.gradient.hex)
						{
							let rgbFromHex = colorUtils.hexRgb(oneColor);
							XYColorSet.push({
								color: { xy: colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2], currentState.info.model.colorGamut) }
							});
						}
					}

					if(typeof msg.payload.gradient.rgb != 'undefined' && Array.isArray(msg.payload.gradient.rgb) == true)
					{
						XYColorSet = [];

						for(let oneColor in msg.payload.gradient.rgb)
						{
							XYColorSet.push({
								color: { xy: colorUtils.rgbToXy(oneColor[0], oneColor[1], oneColor[2], currentState.info.model.colorGamut) }
							});
						}
					}

					if(typeof msg.payload.gradient.xyColor != 'undefined' && Array.isArray(msg.payload.gradient.xyColor) == true)
					{
						XYColorSet = [];

						for(let oneColor in msg.payload.gradient.xyColor)
						{
							XYColorSet.push({
								color: { xy: oneColor }
							});
						}
					}

					patchObject["gradient"] = { points: XYColorSet };
				}

				//
				// SHOULD PATCH?
				if(Object.values(patchObject).length > 0)
				{
					// IS FOR LATER?
					if(currentState.payload.on === false || currentState.payload.reachable === false)
					{
						if(!patchObject["on"] || !patchObject["on"]["on"])
						{
							scope.futurePatchState = merge.deep(scope.futurePatchState, patchObject);
							return false;
						}
					}

					// CHANGE NODE UI STATE
					if(config.lightid)
					{
						scope.status({fill: "grey", shape: "ring", text: "hue-light.node.command"});
					}

					// PATCH!
					async.retry({
						times: 5,
						errorFilter: function(err) {
							return (err.status == 503 || err.status == 429);
						},
						interval: function(retryCount) { return 750*retryCount; }
					},
					function(callback, results)
					{
						bridge.patch("light", tempLightID, patchObject)
						.then(function() { callback(null, true); })
						.catch(function(errors) { callback(errors, null); });
					},
					function(errors, success)
					{
						if(errors)
						{
							scope.error(errors);
						}
						else if(done)
						{
							done();
						}
					});
				}
				else
				{
					// JUST SEND CURRENT STATE
					if(scope.lastCommand !== null)
					{
						currentState.command = scope.lastCommand;
					}

					// SEND STATE
					scope.send(currentState);

					// RESET LAST COMMAND
					scope.lastCommand = null;

					if(done) { done(); }
				}
			}
		};

		// ON NODE UNLOAD : UNSUBSCRIBE FROM BRIDGE
		this.on ('close', function (done)
		{
			bridge.unsubscribe(scope);
			done();
		});
	}

	RED.nodes.registerType("hue-light", HueLight);
}
