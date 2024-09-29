/*jshint esversion: 8, strict: implied, node: true */
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
		scope.buttonLastStates = {};

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
		bridge.subscribe(scope, "button", config.sensorid, function(info)
		{
			let currentState = bridge.get("button", info.id);

			// RESOURCE FOUND?
			if(currentState !== false)
			{
				let nodeStatusText = "";
				let curActionType = currentState.payload.action;
				let curButtonID = currentState.payload.button;
				let curButtonLastState = scope.buttonLastStates[curButtonID] || {};
				switch (curActionType)
				{
					case "initial_press":
						// Start of (short or extended) pressure
						curButtonLastState = {};
						curButtonLastState.actionType = 'PRESS_START';
						curButtonLastState.actionStart = Date.now();
						nodeStatusText = RED._('hue-buttons.node.status-action-startpress');
						break;
					case "long_press":
					case "repeat":
						// Extended pressure (sent every 0.5s as long as button is pressed)
						// Note : 'long_press' is returned, after 'initial_press', as first repeat, to indicate a long press begins
						curButtonLastState.actionType = 'LONG_ONGOING';
						curButtonLastState.actionEnd = Date.now();
						curButtonLastState.countExtPressures = (curButtonLastState.countExtPressures||0) + 1;
						nodeStatusText = RED._('hue-buttons.node.status-action-longpress-ongoing');
						break;
					case "short_release":
					case "double_short_release":
						// Short pressure (<0.5s)
						curButtonLastState.actionType = 'SHORT';
						curButtonLastState.actionStart = Date.now();
						curButtonLastState.actionEnd = Date.now();
						nodeStatusText = RED._((curActionType === 'short_release') ? 'hue-buttons.node.status-action-endpress-short' : 'hue-buttons.node.status-action-doublepress');
						break;
					case "long_release":
						// Release after an extended pressure
						curButtonLastState.actionType = 'LONG';
						curButtonLastState.actionEnd = Date.now();
						nodeStatusText = RED._('hue-buttons.node.status-action-endpress-long');
						break;
					default:
						nodeStatusText = RED._('hue-buttons.node.status-action-pressed');
				}
				// Append info which are common to all states
        curButtonLastState.buttonID = curButtonID;
        curButtonLastState.actionDuration = (curButtonLastState.actionEnd - curButtonLastState.actionStart) || 0;
        curButtonLastState.state = curButtonID + ':' + curButtonLastState.actionType + ((curButtonLastState.actionDuration > 0) ? ':' + curButtonLastState.actionDuration.toString() : '');
        nodeStatusText = RED._('hue-buttons.node.status-action-button') + curButtonLastState.buttonID + ': '+ nodeStatusText + ((curButtonLastState.actionDuration > 0) ? ' (' + (curButtonLastState.actionDuration/1000).toFixed(1).toString() + 's)': '');
				scope.buttonLastStates[curButtonID] = curButtonLastState;

				// SEND MESSAGE
				if(!config.skipevents && currentState.payload.button !== false && (config.initevents || info.suppressMessage == false))
				{
					// SET LAST COMMAND
					if(scope.lastCommand !== null)
					{
						currentState.command = scope.lastCommand;
					}
					// See if such action is monitored for a defined rule to be sent to a secondary output
					let multiOutput = [];
					let buttonRules = config.rules || [];
					multiOutput[0] = currentState;
					for (let i = 0; i < buttonRules.length; i++) {
						multiOutput[i+1] = null;
						let curRule = buttonRules[i];
						// Check whether pressed button is within a range this rule must monitor
						if (curButtonLastState.buttonID < parseInt(curRule.buttonFrom) || curButtonLastState.buttonID > parseInt(curRule.buttonTo)) {
							continue;
						}
						// Check whether action is a monitored one
						let toMonitor = false;
						if (curButtonLastState.actionType == 'SHORT' && curRule.onEndShortPress) {
							toMonitor = true;
						} else if ((curButtonLastState.actionType == 'PRESS_START') && curRule.onStartPress) {
							toMonitor = true;
						} else if (curButtonLastState.actionType == 'LONG_ONGOING' && curRule.onDuringLongPress) {
							toMonitor = true;
						} else if (curButtonLastState.actionType == 'LONG' && curRule.onEndLongPress) {
							if (curButtonLastState.actionDuration >= curRule.minLongPressDuration) {
								toMonitor = true;
							}
						}
						// Reached here : monitored action, build payload (which is actually simply th current button state with all collected info)
						if (toMonitor) {
							multiOutput[i+1] = RED.util.cloneMessage(currentState);
						}
					}

					// SEND STATE
					scope.send(multiOutput);

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
						scope.status({fill: "blue", shape: "dot", text: nodeStatusText});

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

		// ON NODE UNLOAD : UNSUBSCRIBE FROM BRIDGE
		this.on ('close', function (done)
		{
			bridge.unsubscribe(scope);
			done();
		});
	}

	RED.nodes.registerType("hue-buttons", HueButtons);
}
