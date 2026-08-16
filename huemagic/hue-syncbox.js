module.exports = function(RED)
{
	"use strict";

	function HueSyncBoxNode(config)
	{
		RED.nodes.createNode(this, config);

		const scope = this;
		const syncbox = RED.nodes.getNode(config.syncbox);
		const async = require('async');

		// SAVE LAST COMMAND
		this.lastCommand = null;

		//
		// CHECK CONFIG
		if(syncbox == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-syncbox.node.not-configured"});
			return false;
		}

		//
		// UPDATE STATE
		this.status({fill: "grey", shape: "dot", text: "hue-syncbox.node.connecting"});

		//
		// SUBSCRIBE TO UPDATES FROM THE SYNC BOX
		this.unsubscribe = syncbox.subscribe(function(info)
		{
			let currentState = syncbox.get();
			if(currentState === false) { return false; }

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

			// CHANGE UI STATE
			if(currentState.payload.on === false)
			{
				scope.status({fill: "grey", shape: "dot", text: "hue-syncbox.node.powersave"});
			}
			else if(currentState.payload.syncing === true)
			{
				scope.status({fill: "green", shape: "dot", text: RED._("hue-syncbox.node.syncing", { mode: currentState.payload.mode, intensity: currentState.payload.intensity })});
			}
			else
			{
				scope.status({fill: "blue", shape: "dot", text: "hue-syncbox.node.passthrough"});
			}
		});

		//
		// CONTROL THE SYNC BOX
		this.on('input', function(msg, send, done)
		{
			// REDEFINE SEND AND DONE IF NOT AVAILABLE
			send = send || function() { scope.send.apply(scope,arguments); }
			done = done || function() { scope.done.apply(scope,arguments); }

			// SAVE LAST COMMAND
			scope.lastCommand = RED.util.cloneMessage(msg);

			// GET CURRENT STATE
			let currentState = syncbox.get();
			if(currentState === false)
			{
				scope.error(RED._("hue-syncbox.node.error-not-available"), msg);
				return false;
			}

			// JUST GIVE BACK THE CURRENT STATE
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

			// CREATE PATCH
			let patchObject = {};

			// TURN THE BOX ON OR OFF (SIMPLE MODE)
			if(msg.payload === true || msg.payload === false)
			{
				patchObject["mode"] = (msg.payload === true) ? (currentState.payload.lastSyncMode || "video") : "powersave";
			}

			// SET THE MODE
			if(typeof msg.payload != 'undefined' && typeof msg.payload.mode != 'undefined')
			{
				const modes = ["powersave", "passthrough", "video", "game", "music", "ambient"];

				if(modes.indexOf(msg.payload.mode) === -1)
				{
					scope.error(RED._("hue-syncbox.node.error-invalid-mode", { modes: modes.join(", ") }), msg);
					return false;
				}

				patchObject["mode"] = msg.payload.mode;
			}

			// START / STOP SYNCING
			if(typeof msg.payload != 'undefined' && typeof msg.payload.sync != 'undefined')
			{
				patchObject["syncActive"] = (msg.payload.sync === true);
			}

			// TOGGLE SYNCING
			if(typeof msg.payload != 'undefined' && typeof msg.payload.toggle != 'undefined')
			{
				patchObject["toggleSyncActive"] = true;
			}

			// PASS THE PICTURE THROUGH WITHOUT SYNCING
			if(typeof msg.payload != 'undefined' && typeof msg.payload.passthrough != 'undefined')
			{
				patchObject["hdmiActive"] = (msg.payload.passthrough === true);
			}

			// HOW STRONG THE LIGHTS FOLLOW THE PICTURE
			if(typeof msg.payload != 'undefined' && typeof msg.payload.intensity != 'undefined')
			{
				const intensities = ["subtle", "moderate", "high", "intense"];

				if(intensities.indexOf(msg.payload.intensity) === -1)
				{
					scope.error(RED._("hue-syncbox.node.error-invalid-intensity", { intensities: intensities.join(", ") }), msg);
					return false;
				}

				patchObject["intensity"] = msg.payload.intensity;
			}

			// BRIGHTNESS / THE BOX COUNTS TO 200, HUEMAGIC COUNTS IN PERCENT
			if(typeof msg.payload != 'undefined' && typeof msg.payload.brightness != 'undefined')
			{
				const brightness = parseFloat(msg.payload.brightness);

				if(isNaN(brightness) || brightness < 0 || brightness > 100)
				{
					scope.error(RED._("hue-syncbox.node.error-invalid-brightness"), msg);
					return false;
				}

				patchObject["brightness"] = Math.round((200/100)*brightness);
			}
			else if(typeof msg.payload != 'undefined' && typeof msg.payload.brightnessLevel != 'undefined')
			{
				const level = parseInt(msg.payload.brightnessLevel);

				if(isNaN(level) || level < 0 || level > 200)
				{
					scope.error(RED._("hue-syncbox.node.error-invalid-brightness-level"), msg);
					return false;
				}

				patchObject["brightness"] = level;
			}
			else if(typeof msg.payload != 'undefined' && typeof msg.payload.incrementBrightness != 'undefined')
			{
				const step = (isNaN(msg.payload.incrementBrightness)) ? 10 : parseFloat(msg.payload.incrementBrightness);
				patchObject["incrementBrightness"] = Math.round((200/100)*step);
			}
			else if(typeof msg.payload != 'undefined' && typeof msg.payload.decrementBrightness != 'undefined')
			{
				const step = (isNaN(msg.payload.decrementBrightness)) ? 10 : parseFloat(msg.payload.decrementBrightness);
				patchObject["incrementBrightness"] = Math.round((-200/100)*step);
			}

			// WHICH HDMI INPUT THE BOX SHOWS
			if(typeof msg.payload != 'undefined' && typeof msg.payload.input != 'undefined')
			{
				const input = (!isNaN(msg.payload.input)) ? ("input" + parseInt(msg.payload.input)) : (msg.payload.input + "");

				if(["input1", "input2", "input3", "input4"].indexOf(input) === -1)
				{
					scope.error(RED._("hue-syncbox.node.error-invalid-input"), msg);
					return false;
				}

				patchObject["hdmiSource"] = input;
			}

			// WHICH ENTERTAINMENT AREA THE BOX DRIVES
			if(typeof msg.payload != 'undefined' && typeof msg.payload.entertainmentArea != 'undefined')
			{
				patchObject["hueTarget"] = msg.payload.entertainmentArea;
			}

			//
			// SHOULD PATCH?
			if(Object.values(patchObject).length > 0)
			{
				scope.status({fill: "grey", shape: "ring", text: "hue-syncbox.node.command"});

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
					syncbox.execute(patchObject)
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
		});

		//
		// CLOSE NODE / DETACH FROM THE SYNC BOX
		this.on('close', function()
		{
			if(scope.unsubscribe) { scope.unsubscribe(); }
		});
	}

	RED.nodes.registerType("hue-syncbox", HueSyncBoxNode);
}
