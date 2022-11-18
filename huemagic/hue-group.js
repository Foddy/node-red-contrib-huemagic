module.exports = function(RED)
{
	"use strict";

	function HueGroup(config)
	{
		RED.nodes.createNode(this, config);

		const scope = this;
		const bridge = RED.nodes.getNode(config.bridge);
		const async = require('async');

		// EXPORT CONFIG
		this.exportedConfig = config;

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
			this.status({fill: "red", shape: "ring", text: "hue-group.node.not-configured"});
			return false;
		}

		//
		// UNIVERSAL MODE?
		if(!config.groupid)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-group.node.universal"});
		}

		//
		// UPDATE STATE
		if(typeof bridge.disableupdates != 'undefined'||bridge.disableupdates == false)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-group.node.init"});
		}

		//
		// SUBSCRIBE TO UPDATES FROM THE BRIDGE
		bridge.subscribe(scope, "group", config.groupid, function(info)
		{
			let currentState = bridge.get("group", info.id, { colornames: config.colornamer ? true : false });

			// RESOURCE FOUND?
			if(currentState !== false)
			{
				// NOT IN UNIVERAL MODE? -> CHANGE UI STATES
				if(config.groupid)
				{
					// APPLY FUTURE STATE COMMANDS
					if(Object.values(scope.futurePatchState).length > 0)
					{
						scope.applyCommands({}, null, null);
					}

					if(currentState.payload.on === true)
					{
						scope.status({fill: "yellow", shape: "dot", text: "hue-group.node.turned-on"});
					}
					else
					{
						scope.status({fill: "grey", shape: "dot", text: "hue-group.node.all-off"});
					}
				}

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
			}
		});

		//
		// CONTROL GROUP
		this.on('input', function(msg, send, done) { scope.applyCommands(msg, send, done); });

		//
		// APPLY COMMANDS (API v1 because CLIP/v2 does not yet support all features)
		this.applyCommands = async function(msg, send = null, done = null)
		{
			// SET SEND
			send = send || function() { scope.send.apply(scope,arguments); }

			// SAVE LAST COMMAND
			scope.lastCommand = RED.util.cloneMessage(msg);

			// CREATE PATCH
			let patchObject = {};

			// DEFINE SENSOR ID & CURRENT STATE
			const tempGroupID = (!config.groupid && typeof msg.topic != 'undefined' && bridge.validResourceID.test(msg.topic) === true) ? msg.topic : config.groupid;
			let currentState = bridge.get("group", tempGroupID, { colornames: config.colornamer ? true : false });
			if(!currentState)
			{
				scope.error("The group in not yet available. Please wait until HueMagic has established a connection with the bridge or check whether the resource ID in the configuration is valid.");
				return false;
			}

			// CHECK IF LIGHT ID IS SET
			if(!tempGroupID)
			{
				scope.error(RED._("hue-group.node.error-no-id"));
				return false;
			}

			// GET FUTURE STATE
			if(Object.values(scope.futurePatchState).length > 0)
			{
				patchObject = Object.assign({}, scope.futurePatchState);
				scope.futurePatchState = {};
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

			// COLORLOOP EFFECT
			if(typeof msg.payload != 'undefined' && typeof msg.payload.colorloop != 'undefined' && msg.payload.colorloop > 0)
			{
				patchObject = {
					"on": true,
					"effect": "colorloop",
					"bri": msg.payload.brightness ? Math.round((254/100)*msg.payload.brightness) : 254
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
					bridge.patch("group", currentState.info.idV1 + "/action", patchObject, 1)
					.then(function(status) {
						// RESET COLORLOOP ANIMATION AFTER X SECONDS
						setTimeout(function()
						{
							bridge.patch("group", currentState.info.idV1 + "/action", { "effect": "none" }, 1)
							.then(function() { if(done) { done(); }});
						}, parseInt(msg.payload.colorloop) * 1000);
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
						scope.status({fill: "red", shape: "ring", text: "hue-group.node.error-input"});
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
				scope.context().set('groupPreviousState', currentState);

				// TURN ON LIGHT
				if(currentState.payload.on === false)
				{
					patchObject["on"] = true;
				}

				// SET BRIGHTNESS
				if(!msg.payload.brightness && currentState.payload.brightness != 100)
				{
					patchObject["bri"] = 254;
				}
				else if(msg.payload.brightness)
				{
					patchObject["bri"] = Math.round((254/100)*msg.payload.brightness);
				}

				// SET TRANSITION
				patchObject["transitiontime"] = 0;

				// CAN CHANGE COLOR?
				let XYAlertColor = {};

				if(typeof msg.payload.rgb != 'undefined')
				{
					XYAlertColor = colorUtils.rgbToXy(msg.payload.rgb[0], msg.payload.rgb[1], msg.payload.rgb[2] );
				}
				else if(typeof msg.payload.hex != 'undefined')
				{
					let rgbFromHex = colorUtils.hexRgb((msg.payload.hex).toString());
					XYAlertColor = colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2] );
				}
				else if(typeof msg.payload.color != 'undefined')
				{
					if(new RegExp("random|any|whatever").test(msg.payload.color))
					{
						const randomColor = colorUtils.randomHexColor();
						let rgbFromHex = colorUtils.hexRgb(rgbFromHex);
						XYAlertColor = colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2] );
					}
					else
					{
						var colorHex = colorUtils.colornames(msg.payload.color);
						if(colorHex)
						{
							let rgbFromHex = colorUtils.hexRgb(colorHex);
							XYAlertColor = colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2] );
						}
					}
				}
				else
				{
					XYAlertColor = colorUtils.rgbToXy(255, 0, 0 );
				}

				patchObject["xy"] = [XYAlertColor.x, XYAlertColor.y];

				// SET ALERT EFFECT
				patchObject["alert"] = "lselect";

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
					// 1. TURN ON THE LIGHT BULB
					bridge.patch("group", currentState.info.idV1 + "/action", patchObject, 1)
					.then(function(status)
					{
						setTimeout(function()
						{
							const tempPreviousState = scope.context().get('groupPreviousState');
							var tempPreviousStatePatch = {};

							tempPreviousStatePatch.dimming = { brightness: tempPreviousState.payload.brightness };
							if(tempPreviousState.payload.xyColor)
							{
								tempPreviousStatePatch.xy = [tempPreviousState.payload.xyColor.x, tempPreviousState.payload.xyColor.y];
							}
							else if(tempPreviousState.payload.colorTemp)
							{
								tempPreviousStatePatch.ct = tempPreviousState.payload.colorTemp;
							}

							bridge.patch("group", currentState.info.idV1 + "/action", tempPreviousStatePatch, 1)
							.then(function(status)
							{
								return bridge.patch("group", currentState.info.idV1 + "/action", { on: false }, 1);
							})
							.then(function(status) {
								if(tempPreviousState.payload.on === true)
								{
									bridge.patch("group", currentState.info.idV1, { on: true }, 1);
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
						scope.status({fill: "red", shape: "ring", text: "hue-group.node.error-input"});
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
				scope.context().set('groupPreviousState', currentState);
			}
			// ANIMATION STOPPED AND RESTORE ACTIVE?
			else if(typeof msg.animation != 'undefined' && msg.animation.status == false && msg.animation.restore == true)
			{
				const tempPreviousState = scope.context().get('groupPreviousState');
				var tempPreviousStatePatch = {};

				tempPreviousStatePatch.dimming = { brightness: tempPreviousState.payload.brightness };
				if(tempPreviousState.payload.xyColor)
				{
					tempPreviousStatePatch.xy = [tempPreviousState.payload.xyColor.x, tempPreviousState.payload.xyColor.y];
				}
				else if(tempPreviousState.payload.colorTemp)
				{
					tempPreviousStatePatch.ct = tempPreviousState.payload.colorTemp;
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
					bridge.patch("light", currentState.info.lightIds[l], tempPreviousStatePatch).
					then(function(status)
					{
						if(tempPreviousState.payload.on === false)
						{
							bridge.patch("light", currentState.info.lightIds[l], { on: { on: false } })
							.then(function() { callback(null, true); });
						}
						else
						{
							bridge.patch("light", currentState.info.lightIds[l], { on: { on: false } })
							.then(function(status) {
								callback(null, true);
								return bridge.patch("light", currentState.info.lightIds[l], { on: { on: true } });
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
					if(msg.payload !== currentState.payload.on)
					{
						patchObject["on"] = msg.payload;
					}
				}

				// SET LIGHT STATE
				if(typeof msg.payload != 'undefined' && typeof msg.payload.on != 'undefined' && (msg.payload.on === true || msg.payload.on === false))
				{
					if(msg.payload.on !== currentState.payload.on)
					{
						patchObject["on"] = msg.payload.on;
					}
				}

				// TOGGLE ON / OFF
				if(typeof msg.payload != 'undefined' && typeof msg.payload.toggle != 'undefined')
				{
					patchObject["on"] = !currentState.payload.on;
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
						patchObject["bri"] = Math.round((254/100)*autoBrightness);
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
							patchObject["on"] = false;
						}
						else
						{
							patchObject["bri"] = Math.round((254/100)*msg.payload.brightness);
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
						patchObject["on"] = false;
					}
					else
					{
						patchObject["bri"] = msg.payload.brightnessLevel;
					}
				}

				// SET HUMAN READABLE COLOR OR RANDOM
				if(typeof msg.payload != 'undefined' && typeof msg.payload.color != 'undefined')
				{
					let XYAlertColor = {};

					if(new RegExp("random|any|whatever").test(msg.payload.color))
					{
						const randomColor = colorUtils.randomHexColor();
						let rgbFromHex = colorUtils.hexRgb(randomColor);
						XYAlertColor = colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2] );
					}
					else
					{
						var colorHex = colorUtils.colornames(msg.payload.color);
						if(colorHex)
						{
							let rgbFromHex = colorUtils.hexRgb(colorHex);
							XYAlertColor = colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2] );
						}
					}

					patchObject["xy"] = [XYAlertColor.x, XYAlertColor.y];
				}

				// SET HEX COLOR
				if(typeof msg.payload != 'undefined' && typeof msg.payload.hex != 'undefined')
				{
					let rgbFromHex = colorUtils.hexRgb((msg.payload.hex).toString());
					let xyColor = colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2])

					patchObject["xy"] = [xyColor.x, xyColor.y];
				}

				// SET RGB COLOR
				if(typeof msg.payload != 'undefined' && typeof msg.payload.rgb != 'undefined' && msg.payload.rgb.length === 3)
				{
					let xyColor = colorUtils.rgbToXy(msg.payload.rgb[0], msg.payload.rgb[1], msg.payload.rgb[2] )
					patchObject["xy"] = [xyColor.x, xyColor.y];
				}

				// SET XY COLOR
				if(typeof msg.payload != 'undefined' && typeof msg.payload.xyColor != 'undefined')
				{
					patchObject["xy"] = [msg.payload.xyColor.x, msg.payload.xyColor.y];
				}

				// SET COLOR TEMPERATURE
				if(typeof msg.payload != 'undefined' && typeof msg.payload.colorTemp != 'undefined')
				{
					// DETERMINE IF AUTOMATIC, WARM, COLD, INT
					if(!isNaN(msg.payload.colorTemp))
					{
						let colorTemp = parseInt(msg.payload.colorTemp);
						if(colorTemp >= 153 && colorTemp <= 500)
						{
							patchObject["ct"] = colorTemp;
						}
						else
						{
							scope.error("Invalid color temprature. Only 153 - 500 allowed");
							return false;
						}
					}
					else if(msg.payload.colorTemp == "cold")
					{
						patchObject["ct"] = 153;
					}
					else if(msg.payload.colorTemp == "normal")
					{
						patchObject["ct"] = 240;
					}
					else if(msg.payload.colorTemp == "warm")
					{
						patchObject["ct"] = 400;
					}
					else if(msg.payload.colorTemp == "hot")
					{
						patchObject["ct"] = 500;
					}
					else
					{
						// SET TEMPERATURE
						patchObject["ct"] = colorUtils.colorTemperature();
					}
				}

				// SET TRANSITION TIME
				if(typeof msg.payload != 'undefined' && typeof msg.payload.transitionTime != 'undefined')
				{
					let targetTransitionTime = parseFloat(msg.payload.transitionTime)*1000;
					targetTransitionTime = (targetTransitionTime > 6000000) ? 6000000 : targetTransitionTime;
					targetTransitionTime = (targetTransitionTime < 0) ? 0 : targetTransitionTime;

					patchObject["transitiontime"] = targetTransitionTime/100;
				}

				// SET DOMINANT COLORS FROM IMAGE
				if(typeof msg.payload != 'undefined' && typeof msg.payload.image != 'undefined')
				{
					var colors = await colorUtils.getColors(msg.payload.image);
					if(colors.length > 0)
					{
						var colorsHEX = colors.map(color => color.hex());
						let rgbFromHex = colorUtils.hexRgb(colorsHEX[0]);
						let xyColor = colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2]);

						patchObject["xy"] = [xyColor.x, xyColor.y];
					}
				}

				//
				// SHOULD PATCH?
				if(Object.values(patchObject).length > 0)
				{
					// IS FOR LATER?
					if(currentState.payload.on === false)
					{
						if(!patchObject["on"])
						{
							scope.futurePatchState = merge.deep(scope.futurePatchState, patchObject);
							return false;
						}
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
						bridge.patch("group", currentState.info.idV1 + "/action", patchObject, 1)
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

	RED.nodes.registerType("hue-group", HueGroup);
}
