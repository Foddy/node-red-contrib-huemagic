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
		this.unsubscribe = bridge.subscribe("group", config.groupid, function(info)
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

					if(currentState.payload.on !== true)
					{
						scope.status({fill: "grey", shape: "dot", text: "hue-group.node.all-off"});
					}
					else if(currentState.payload.brightness !== false)
					{
						scope.status({fill: "yellow", shape: "dot", text: RED._("hue-group.node.turned-on") + RED._("hue-group.node.brightness", { percent: Math.round(currentState.payload.brightness) })});
					}
					else
					{
						scope.status({fill: "yellow", shape: "dot", text: "hue-group.node.turned-on"});
					}
				}

				// SEND MESSAGE
				if(!config.skipevents && (config.initevents || info.suppressMessage == false) && (!config.onlycommands || scope.lastCommand !== null))
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
		// APPLY COMMANDS (CLIP/v2, only the colorloop effect still needs the legacy API)
		this.applyCommands = async function(msg, send = null, done = null)
		{
			// SET SEND
			send = send || function() { scope.send.apply(scope,arguments); }

			// SAVE LAST COMMAND
			scope.lastCommand = RED.util.cloneMessage(msg);

			// CREATE PATCH
			let patchObject = {};

			// DEFINE GROUP ID
			const tempGroupID = (!config.groupid && typeof msg.topic != 'undefined' && bridge.validResourceID.test(msg.topic) === true) ? msg.topic : config.groupid;
			if(!tempGroupID)
			{
				scope.error(RED._("hue-group.node.error-no-id"), msg);
				return false;
			}

			// GET CURRENT STATE
			let currentState = bridge.get("group", tempGroupID, { colornames: config.colornamer ? true : false });
			if(!currentState)
			{
				scope.error(RED._("hue-group.node.error-not-available"), msg);
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

			// COLORLOOP EFFECT (CLIP/v2 HAS NO EQUIVALENT, SO THIS STAYS ON THE LEGACY API)
			if(typeof msg.payload != 'undefined' && typeof msg.payload.colorloop != 'undefined' && msg.payload.colorloop > 0)
			{
				if(!currentState.info.idV1)
				{
					scope.error(RED._("hue-group.node.error-no-colorloop"), msg);
					return false;
				}

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
				// THE BRIDGE BLINKS AND RESTORES THE PREVIOUS STATE ON ITS OWN
				let duration = Math.round(parseFloat(msg.payload.alert)) * 1000;
				duration = (duration > 65534000) ? 65534000 : duration;

				let signaling = { signal: "on_off", duration: duration };
				let XYAlertColor = false;

				// BLINK IN A SPECIFIC COLOR?
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
					const colorHex = new RegExp("random|any|whatever").test(msg.payload.color) ? colorUtils.randomHexColor() : colorUtils.colornames(msg.payload.color);
					if(colorHex)
					{
						let rgbFromHex = colorUtils.hexRgb(colorHex);
						XYAlertColor = colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2] );
					}
				}

				if(XYAlertColor)
				{
					signaling = { signal: "on_off_color", duration: duration, colors: [{ xy: XYAlertColor }] };
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
					bridge.patch("grouped_light", tempGroupID, { signaling: signaling })
					.catch(function(errors)
					{
						// OLDER BRIDGES ONLY KNOW THE (15 SECONDS LONG) BREATHE EFFECT
						if(errors.status !== 400) { throw errors; }
						return bridge.patch("grouped_light", tempGroupID, { alert: { action: "breathe" } });
					})
					.then(function() { callback(null, true); })
					.catch(function(errors) { callback(errors, null); });
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
				if(!tempPreviousState)
				{
					if(done) { done(); }
					return false;
				}

				// RESTORE IN ONE SINGLE PATCH ON THE GROUP, OTHERWISE THE LIGHTS FLICKER
				var tempPreviousStatePatch = { on: { on: tempPreviousState.payload.on } };

				if(typeof tempPreviousState.payload.brightness != 'undefined' && tempPreviousState.payload.brightness !== false)
				{
					tempPreviousStatePatch.dimming = { brightness: tempPreviousState.payload.brightness };
				}

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
					bridge.patch("grouped_light", tempGroupID, tempPreviousStatePatch)
					.then(function() { callback(null, true); })
					.catch(function(errors) { callback(errors, null); });
				},
				function(errors, success)
				{
					if(errors)
					{
						scope.error(errors, msg);
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
				// SET LIGHT STATE SIMPLE MODE (ALWAYS SENT, THE CACHED STATE MAY BE OUTDATED)
				if(msg.payload === true||msg.payload === false)
				{
					patchObject["on"] = { on: msg.payload };
				}

				// SET LIGHT STATE
				if(typeof msg.payload != 'undefined' && typeof msg.payload.on != 'undefined' && (msg.payload.on === true || msg.payload.on === false))
				{
					patchObject["on"] = { on: msg.payload.on };
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
							scope.error(RED._("hue-group.node.error-invalid-brightness"), msg);
							return false;
						}
						else if(msg.payload.brightness == 0)
						{
							patchObject["on"] = { on: false };
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
						scope.error(RED._("hue-group.node.error-invalid-brightness-level"), msg);
						return false;
					}
					else if(msg.payload.brightnessLevel == 0)
					{
						patchObject["on"] = { on: false };
					}
					else
					{
						patchObject["dimming"] = { brightness: Math.round((100/254)*msg.payload.brightnessLevel) };
					}
				}
				else if(typeof msg.payload != 'undefined' && typeof msg.payload.incrementBrightness != 'undefined')
				{
					let incrementBy = (isNaN(msg.payload.incrementBrightness)) ? 10 : parseFloat(msg.payload.incrementBrightness);

					if ((incrementBy > 100) || (incrementBy < -100))
					{
						scope.error(RED._("hue-group.node.error-invalid-increment"), msg);
						return false;
					}

					patchObject["dimming_delta"] = { action: (incrementBy < 0) ? "down" : "up", brightness_delta: Math.abs(incrementBy) };
				}
				else if(typeof msg.payload != 'undefined' && typeof msg.payload.decrementBrightness != 'undefined')
				{
					let decrementBy = (isNaN(msg.payload.decrementBrightness)) ? 10 : parseFloat(msg.payload.decrementBrightness);

					if ((decrementBy > 100) || (decrementBy < -100))
					{
						scope.error(RED._("hue-group.node.error-invalid-decrement"), msg);
						return false;
					}

					patchObject["dimming_delta"] = { action: (decrementBy < 0) ? "up" : "down", brightness_delta: Math.abs(decrementBy) };
				}

				// SET HUMAN READABLE COLOR OR RANDOM
				if(typeof msg.payload != 'undefined' && typeof msg.payload.color != 'undefined')
				{
					const colorHex = new RegExp("random|any|whatever").test(msg.payload.color) ? colorUtils.randomHexColor() : colorUtils.colornames(msg.payload.color);

					if(colorHex)
					{
						let rgbFromHex = colorUtils.hexRgb(colorHex);
						patchObject["color"] = { xy: colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2]) };
					}
				}

				// SET HEX COLOR
				if(typeof msg.payload != 'undefined' && typeof msg.payload.hex != 'undefined')
				{
					let rgbFromHex = colorUtils.hexRgb((msg.payload.hex).toString());
					patchObject["color"] = { xy: colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2]) };
				}

				// SET RGB COLOR
				if(typeof msg.payload != 'undefined' && typeof msg.payload.rgb != 'undefined' && msg.payload.rgb.length === 3)
				{
					patchObject["color"] = { xy: colorUtils.rgbToXy(msg.payload.rgb[0], msg.payload.rgb[1], msg.payload.rgb[2]) };
				}

				// SET XY COLOR
				if(typeof msg.payload != 'undefined' && typeof msg.payload.xyColor != 'undefined')
				{
					patchObject["color"] = { xy: { x: msg.payload.xyColor.x, y: msg.payload.xyColor.y } };
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
							patchObject["color_temperature"] = { mirek: colorTemp };
						}
						else
						{
							scope.error(RED._("hue-group.node.error-invalid-temp"), msg);
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

				// SET TRANSITION TIME
				if(typeof msg.payload != 'undefined' && typeof msg.payload.transitionTime != 'undefined')
				{
					let targetTransitionTime = parseFloat(msg.payload.transitionTime)*1000;
					targetTransitionTime = (targetTransitionTime > 6000000) ? 6000000 : targetTransitionTime;
					targetTransitionTime = (targetTransitionTime < 0) ? 0 : targetTransitionTime;

					patchObject["dynamics"] = { duration: targetTransitionTime };
				}

				// SET DOMINANT COLORS FROM IMAGE
				if(typeof msg.payload != 'undefined' && typeof msg.payload.image != 'undefined')
				{
					var colors = await colorUtils.getColors(msg.payload.image);
					if(colors.length > 0)
					{
						var colorsHEX = colors.map(color => color.hex());
						let rgbFromHex = colorUtils.hexRgb(colorsHEX[0]);

						patchObject["color"] = { xy: colorUtils.rgbToXy(rgbFromHex[0], rgbFromHex[1], rgbFromHex[2]) };
					}
				}

				// THE BRIDGE ONLY ACCEPTS ONE OF BOTH
				if(patchObject["color"] && patchObject["color_temperature"]) { delete patchObject["color_temperature"]; }

				//
				// SHOULD PATCH?
				if(Object.values(patchObject).length > 0)
				{
					// IS FOR LATER? (ONLY IF THE COMMAND ITSELF DOES NOT SWITCH THE GROUP)
					if(currentState.payload.on === false)
					{
						if(typeof patchObject["on"] == 'undefined')
						{
							scope.futurePatchState = merge.deep(scope.futurePatchState, patchObject);
							if(done) { done(); }
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
						bridge.patch("grouped_light", tempGroupID, patchObject)
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
		}

		//
		// CLOSE NODE / DETACH FROM THE BRIDGE
		this.on('close', function()
		{
			if(scope.unsubscribe) { scope.unsubscribe(); }
		});

	}

	RED.nodes.registerType("hue-group", HueGroup);
}
