module.exports = function(RED)
{
	"use strict";

	//
	// DOES A BUTTON EVENT MATCH THE RULE OF AN ADDITIONAL OUTPUT?
	function matchesRule(buttonState, rule)
	{
		// BUTTON OUTSIDE THE RANGE THE RULE WATCHES?
		if(buttonState.button < parseInt(rule.buttonFrom) || buttonState.button > parseInt(rule.buttonTo)) { return false; }

		switch (buttonState.actionType)
		{
			case "PRESS_START":
				return !!rule.onStartPress;
			case "SHORT":
				return !!rule.onEndShortPress;
			case "LONG_ONGOING":
				return !!rule.onDuringLongPress;
			case "LONG":
				return (!!rule.onEndLongPress && buttonState.actionDuration >= (parseInt(rule.minLongPressDuration) || 0));
			default:
				return false;
		}
	}

	function HueButtons(config)
	{
		RED.nodes.createNode(this, config);

		const scope = this;
		const bridge = RED.nodes.getNode(config.bridge);
		const async = require('async');

		// NODE UI STATUS TIMEOUT
		this.timeout = null;

		// SAVE LAST COMMAND
		this.lastCommand = null;

		// SAVE THE LAST STATE OF EVERY DEVICE AND BUTTON
		scope.buttonLastStates = {};

		//
		// CLOSE NODE
		this.on('close', function()
		{
			if(scope.timeout !== null) { clearTimeout(scope.timeout); }
			if(scope.unsubscribe) { scope.unsubscribe(); }
		});

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-buttons.node.not-configured"});
			return false;
		}

		//
		// UNIVERSAL MODE?
		if(!config.sensorid)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-buttons.node.universal"});
		}

		//
		// UPDATE STATE
		if(config.sensorid)
		{
			scope.status({fill: "grey", shape: "dot", text: "hue-buttons.node.waiting"});
		}

		//
		// SUBSCRIBE TO UPDATES FROM THE BRIDGE
		this.unsubscribe = bridge.subscribe("button", config.sensorid, function(info)
		{
			let currentState = bridge.get("button", info.id);

			// RESOURCE FOUND?
			if(currentState !== false)
			{
				const hasEvent = (currentState.payload.button !== false || currentState.payload.rotation !== false);

				// TRACK THE STATE OF THE PRESSED BUTTON, WHICH GIVES THE ADDITIONAL OUTPUTS THEIR PRESS DURATION
				let buttonState = {};

				if(currentState.payload.button !== false)
				{
					// EVERY DEVICE NUMBERS ITS BUTTONS FROM 1, SO THE STATE HAS TO BE KEPT PER DEVICE AND BUTTON
					const buttonKey = info.id + ":" + currentState.payload.button;
					buttonState = scope.buttonLastStates[buttonKey] || {};

					switch (currentState.payload.action)
					{
						case "initial_press":
							// START OF A SHORT OR A LONG PRESS
							buttonState = { actionType: "PRESS_START", actionStart: Date.now() };
							break;

						case "long_press":
						case "repeat":
							// THE BRIDGE SENDS THIS EVENT EVERY 0.5 SECONDS WHILE THE BUTTON IS STILL HELD DOWN
							buttonState.actionType = "LONG_ONGOING";
							buttonState.actionEnd = Date.now();
							break;

						case "short_release":
						case "double_short_release":
							// PRESS SHORTER THAN 0.5 SECONDS
							buttonState.actionType = "SHORT";
							buttonState.actionStart = Date.now();
							buttonState.actionEnd = Date.now();
							break;

						case "long_release":
							// RELEASE AFTER A LONG PRESS
							buttonState.actionType = "LONG";
							buttonState.actionEnd = Date.now();
							break;

						default:
							// UNKNOWN ACTION, MUST NOT INHERIT THE TYPE OF THE PREVIOUS ONE
							buttonState.actionType = false;
					}

					buttonState.button = currentState.payload.button;
					buttonState.actionDuration = (buttonState.actionEnd - buttonState.actionStart) || 0;

					scope.buttonLastStates[buttonKey] = buttonState;
				}

				// SEND MESSAGE
				if(!config.skipevents && hasEvent && (config.initevents || info.suppressMessage == false) && (!config.onlycommands || scope.lastCommand !== null))
				{
					// SET LAST COMMAND
					if(scope.lastCommand !== null)
					{
						currentState.command = scope.lastCommand;
					}

					// COPY THE EVENT TO EVERY ADDITIONAL OUTPUT THAT ASKED FOR IT
					let outputs = [currentState];

					if(currentState.payload.button !== false)
					{
						const rules = Array.isArray(config.rules) ? config.rules : [];

						for (let i = 0; i < rules.length; i++)
						{
							outputs[i+1] = matchesRule(buttonState, rules[i]) ? RED.util.cloneMessage(currentState) : null;
						}
					}

					// SEND STATE
					scope.send(outputs);

					// RESET LAST COMMAND
					scope.lastCommand = null;
				}

				// NOT IN UNIVERAL MODE? -> CHANGE UI STATES
				if(config.sensorid)
				{
					if(!hasEvent)
					{
						scope.status({fill: "grey", shape: "dot", text: "hue-buttons.node.waiting"});
					}
					else
					{
						var statusText = "";

						if(currentState.payload.button === false)
						{
							const rotation = currentState.payload.rotation;
							statusText = RED._(rotation.clockwise ? "hue-buttons.node.dial-clockwise" : "hue-buttons.node.dial-counterclockwise", { degrees: rotation.degrees });
						}
						else
						{
							var action = "";
							switch (currentState.payload.action)
							{
							  case "initial_press":
							    action = "action-started";
							    break;
							  case "repeat":
							    action = "action-repeated";
							    break;
							  case "short_release":
							    action = "action-shortreleased";
							    break;
							  case "long_press":
							    action = "action-holded";
							    break;
							  case "long_release":
							    action = "action-longreleased";
							    break;
							  case "double_short_release":
							  	action = "action-doublepressed";
							  	break;
							  default:
							    action = "action-pressed";
							}

							// THE DURATION IS ONLY KNOWN WHILE AND AFTER A BUTTON WAS HELD DOWN
							statusText = (buttonState.actionDuration > 0)
								? RED._("hue-buttons.node.button-status-duration", { button: currentState.payload.button, action: RED._("hue-buttons.node." + action), duration: (buttonState.actionDuration / 1000).toFixed(1) })
								: RED._("hue-buttons.node.button-status", { button: currentState.payload.button, action: RED._("hue-buttons.node." + action) });
						}

						scope.status({fill: "blue", shape: "dot", text: statusText });

						// RESET TO WAITING AFTER 3 SECONDS
						if(scope.timeout !== null) { clearTimeout(scope.timeout); };
						scope.timeout = setTimeout(function()
						{
							scope.status({fill: "grey", shape: "dot", text: "hue-buttons.node.waiting"});

							// REMOVE OLD BUTTON STATES
							const buttons = (bridge.resources[config.sensorid] && bridge.resources[config.sensorid]["services"]) ? bridge.resources[config.sensorid]["services"]["button"] : false;
							if(!buttons) { return false; }

							for (const [oneButtonID, oneButton] of Object.entries(buttons))
							{
								delete buttons[oneButtonID]["button"];
							}
						}, 3000);
					}
				}
			}
		});

		//
		// ON COMMAND
		this.on('input', function(msg, send, done)
		{
			// REDEFINE SEND AND DONE IF NOT AVAILABLE
			send = send || function() { scope.send.apply(scope,arguments); }
			done = done || function() { scope.done.apply(scope,arguments); }

			// SAVE LAST COMMAND
			scope.lastCommand = RED.util.cloneMessage(msg);

			// DEFINE SENSOR ID
			const tempSensorID = (!config.sensorid && typeof msg.topic != 'undefined' && bridge.validResourceID.test(msg.topic) === true) ? msg.topic : config.sensorid;
			if(!tempSensorID)
			{
				scope.error(RED._("hue-buttons.node.error-no-id"), msg);
				return false;
			}

			let currentState = bridge.get("button", tempSensorID);
			if(!currentState)
			{
				scope.error(RED._("hue-buttons.node.error-not-available"), msg);
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

			// SWITCH BETWEEN ROCKER AND PUSHBUTTON MODE (WALL SWITCH MODULE)
			if(typeof msg.payload != 'undefined' && typeof msg.payload.switchMode != 'undefined')
			{
				if(!currentState.info.switchModes)
                {
					scope.error(RED._("hue-buttons.node.error-no-switchmode"), msg);
					return false;
				}

				if(currentState.info.switchModes.indexOf(msg.payload.switchMode) === -1)
				{
					scope.error(RED._("hue-buttons.node.error-invalid-switchmode", { modes: currentState.info.switchModes.join(", ") }), msg);
					return false;
				}

				async.retry({
					times: 5,
					errorFilter: function(err) {
						return (err.status == 503 || err.status == 429);
					},
					interval: function(retryCount) { return 750*retryCount; }
				},
				function(callback, results)
				{
					bridge.patch("switch_input_configuration", tempSensorID, { switch_mode: { mode: msg.payload.switchMode } })
					.then(function() { callback(null, true); })
					.catch(function(errors) { callback(errors, null); });
				},
				function(errors, success)
				{
					if(errors) { scope.error(errors, msg); }
					else if(done) { done(); }
				});

				return true;
			}
		});
	}

	RED.nodes.registerType("hue-buttons", HueButtons);
}