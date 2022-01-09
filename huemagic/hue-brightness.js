module.exports = function(RED)
{
	"use strict";

	function HueBrightness(config)
	{
		RED.nodes.createNode(this, config);

		const scope = this;
		const bridge = RED.nodes.getNode(config.bridge);

		// SAVE LAST COMMAND
		this.lastCommand = null;

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-brightness.node.not-configured"});
			return false;
		}

		//
		// UNIVERSAL MODE?
		if(!config.sensorid)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-brightness.node.universal"});
		}

		//
		// UPDATE STATE
		if(typeof bridge.disableupdates != 'undefined' || bridge.disableupdates == false)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-brightness.node.init"});
		}

		//
		// SUBSCRIBE TO UPDATES FROM THE BRIDGE
		bridge.subscribe("light_level", config.sensorid, function(info)
		{
			let currentState = bridge.get("light_level", info.id);

			// RESSOURCE FOUND?
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

					scope.send(currentState);

					// RESET LAST COMMAND
					scope.lastCommand = null;
				}

				// NOT IN UNIVERAL MODE? -> CHANGE UI STATES
				if(config.sensorid)
				{
					if(currentState.payload.reachable == false)
					{
						scope.status({fill: "red", shape: "ring", text: "hue-brightness.node.not-reachable"});
					}
					else if(currentState.payload.active == true)
					{
						if(currentState.payload.dark)
						{
							var statusMessage = RED._("hue-brightness.node.lux-dark", { lux: currentState.payload.lux });
							scope.status({fill: "blue", shape: "dot", text: statusMessage });
						}
						else if(currentState.payload.daylight)
						{
							var statusMessage = RED._("hue-brightness.node.lux-daylight", { lux: currentState.payload.lux });
							scope.status({fill: "yellow", shape: "dot", text: statusMessage });
						}
						else
						{
							var statusMessage = RED._("hue-brightness.node.lux", { lux: currentState.payload.lux });
							scope.status({fill: "grey", shape: "dot", text: statusMessage });
						}
					}
					else if(currentState.payload.active == false)
					{
						scope.status({fill: "red", shape: "ring", text: "hue-brightness.node.deactivated"});
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

			// SET LAST COMMAND
			scope.lastCommand = msg;

			// CREATE PATCH
			let patchObject = {};

			// DEFINE SENSOR ID & CURRENT STATE
			const tempSensorID = (msg.topic != null) ? msg.topic : config.sensorid;
			let currentState = bridge.get("light_level", tempSensorID);

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

			// TURN ON / OFF
			if((msg.payload === true || msg.payload === false) && (msg.payload !== currentState.payload.active))
			{
				// PREPARE PATCH
				patchObject.enabled = msg.payload;
			}

			//
			// SHOULD PATCH?
			if(Object.values(patchObject).length > 0)
			{
				// CHANGE NODE UI STATE
				if(config.sensorid)
				{
					scope.status({fill: "grey", shape: "ring", text: "hue-brightness.node.command"});
				}

				// PATCH!
				bridge.patch("light_level", tempSensorID, patchObject)
				.then(function() { if(done) { done(); }})
				.catch(function(errors) { scope.error(errors); });
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
			}
		});
	}

	RED.nodes.registerType("hue-brightness", HueBrightness);
}