module.exports = function(RED)
{
	"use strict";

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

				// SEND MESSAGE
				if(!config.skipevents && hasEvent && (config.initevents || info.suppressMessage == false) && (!config.onlycommands || scope.lastCommand !== null))
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

							statusText = RED._("hue-buttons.node.button-status", { button: currentState.payload.button, action: RED._("hue-buttons.node." + action) });
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