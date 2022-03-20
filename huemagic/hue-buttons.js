module.exports = function(RED)
{
	"use strict";

	function HueButtons(config)
	{
		RED.nodes.createNode(this, config);

		const scope = this;
		const bridge = RED.nodes.getNode(config.bridge);

		// NODE UI STATUS TIMEOUT
		this.timeout = null;

		// SAVE LAST COMMAND
		this.lastCommand = null;

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
		bridge.subscribe("button", config.sensorid, function(info)
		{
			let currentState = bridge.get("button", info.id);

			// RESOURCE FOUND?
			if(currentState !== false)
			{
				// SEND MESSAGE
				if(!config.skipevents && currentState.payload.button !== false && (config.initevents || info.suppressMessage == false))
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
					if(currentState.payload.button === false)
					{
						scope.status({fill: "grey", shape: "dot", text: "hue-buttons.node.waiting"});
					}
					else
					{
						var action = "";
						switch (currentState.payload.action)
						{
						  case "initial_press":
						    action = "(pressed)";
						    break;
						  case "repeat":
						    action = "(repeated)";
						    break;
						  case "short_release":
						    action = "(short press)";
						    break;
						  case "long_release":
						    action = "(long press)";
						    break;
						  case "double_short_release":
						  	action = "(double pressed)";
						  	break;
						  default:
						    action = "(pressed)";
						}

						scope.status({fill: "blue", shape: "dot", text: "Button #"+ currentState.payload.button + " " + action });

						// RESET TO WAITING AFTER 3 SECONDS
						if(scope.timeout !== null) { clearTimeout(scope.timeout); };
						scope.timeout = setTimeout(function()
						{
							scope.status({fill: "grey", shape: "dot", text: "hue-buttons.node.waiting"});

							// REMOVE OLD BUTTON STATES
							for (const [oneButtonID, oneButton] of Object.entries(bridge.resources[config.sensorid]["services"]["button"]))
							{
								delete bridge.resources[config.sensorid]["services"]["button"][oneButtonID]["button"];
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
				scope.error("Please submit a valid button ID.");
				return false;
			}

			let currentState = bridge.get("button", tempSensorID);
			if(!currentState)
			{
				scope.error("The button/switch in not yet available. Please wait until HueMagic has established a connection with the bridge or check whether the resource ID in the configuration is valid.");
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
		});
	}

	RED.nodes.registerType("hue-buttons", HueButtons);
}