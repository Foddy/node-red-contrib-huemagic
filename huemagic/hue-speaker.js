module.exports = function(RED)
{
	"use strict";

	function HueSpeaker(config)
	{
		RED.nodes.createNode(this, config);

		const scope = this;
		const bridge = RED.nodes.getNode(config.bridge);
		const async = require('async');

		// SAVE LAST COMMAND
		this.lastCommand = null;

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-speaker.node.not-configured"});
			return false;
		}

		//
		// UNIVERSAL MODE?
		if(!config.speakerid)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-speaker.node.universal"});
		}

		//
		// UPDATE STATE
		if(config.speakerid)
		{
			this.status({fill: "grey", shape: "dot", text: "hue-speaker.node.silent"});
		}

		//
		// SUBSCRIBE TO UPDATES FROM THE BRIDGE
		this.unsubscribe = bridge.subscribe("speaker", config.speakerid, function(info)
		{
			let currentState = bridge.get("speaker", info.id);

			// RESOURCE FOUND?
			if(currentState !== false)
			{
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

				// NOT IN UNIVERAL MODE? -> CHANGE UI STATES
				if(config.speakerid)
				{
					if(currentState.payload.reachable == false)
					{
						scope.status({fill: "red", shape: "ring", text: "hue-speaker.node.not-reachable"});
					}
					else if(currentState.payload.muted === true)
					{
						scope.status({fill: "grey", shape: "ring", text: "hue-speaker.node.muted"});
					}
					else if(currentState.payload.alarm !== false)
					{
						scope.status({fill: "red", shape: "dot", text: RED._("hue-speaker.node.playing-alarm", { sound: currentState.payload.alarm })});
					}
					else if(currentState.payload.chime !== false)
					{
						scope.status({fill: "blue", shape: "dot", text: RED._("hue-speaker.node.playing-chime", { sound: currentState.payload.chime })});
					}
					else if(currentState.payload.alert !== false)
					{
						scope.status({fill: "yellow", shape: "dot", text: RED._("hue-speaker.node.playing-alert", { sound: currentState.payload.alert })});
					}
					else
					{
						scope.status({fill: "grey", shape: "dot", text: "hue-speaker.node.silent"});
					}
				}
			}
		});

		//
		// CONTROL THE SPEAKER
		this.on('input', function(msg, send, done)
		{
			// REDEFINE SEND AND DONE IF NOT AVAILABLE
			send = send || function() { scope.send.apply(scope,arguments); }
			done = done || function() { scope.done.apply(scope,arguments); }

			// SAVE LAST COMMAND
			scope.lastCommand = RED.util.cloneMessage(msg);

			// CREATE PATCH
			let patchObject = {};

			// DEFINE SPEAKER ID
			const tempSpeakerID = (!config.speakerid && typeof msg.topic != 'undefined' && bridge.validResourceID.test(msg.topic) === true) ? msg.topic : config.speakerid;
			if(!tempSpeakerID)
			{
				scope.error(RED._("hue-speaker.node.error-no-id"), msg);
				return false;
			}

			// GET CURRENT STATE
			let currentState = bridge.get("speaker", tempSpeakerID);
			if(!currentState)
			{
				scope.error(RED._("hue-speaker.node.error-not-available"), msg);
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

			// MUTE / UNMUTE
			if(typeof msg.payload != 'undefined' && typeof msg.payload.mute != 'undefined')
			{
				patchObject["mute"] = { mute: (msg.payload.mute === true) ? "mute" : "unmute" };
			}

			// PLAY A SOUND / STOP IT AGAIN
			for(const channel of ["alarm", "chime", "alert"])
			{
				if(typeof msg.payload == 'undefined' || typeof msg.payload[channel] == 'undefined') { continue; }

				const supported = currentState.info.sounds[channel];
				if(!supported)
				{
					scope.error(RED._("hue-speaker.node.error-no-channel", { channel: channel }), msg);
					return false;
				}

				// A PLAIN "false" STOPS WHATEVER IS PLAYING
				const request = (msg.payload[channel] === false) ? { sound: "no_sound" } : ((typeof msg.payload[channel] == 'string') ? { sound: msg.payload[channel] } : msg.payload[channel]);

				if(!request.sound || (request.sound !== "no_sound" && supported.indexOf(request.sound) === -1))
				{
					scope.error(RED._("hue-speaker.node.error-invalid-sound", { channel: channel, sounds: supported.join(", ") }), msg);
					return false;
				}

				patchObject[channel] = { sound: request.sound };

				// HOW LOUD AND HOW LONG
				if(typeof request.volume != 'undefined')
				{
					const volume = parseInt(request.volume);
					if(isNaN(volume) || volume < 0 || volume > 100)
					{
						scope.error(RED._("hue-speaker.node.error-invalid-volume"), msg);
						return false;
					}

					patchObject[channel]["volume"] = { level: volume };
				}

				if(typeof request.duration != 'undefined')
				{
					let duration = Math.round(parseFloat(request.duration) * 1000);
					duration = (duration < 0) ? 0 : duration;

					patchObject[channel]["duration"] = duration;
				}
			}

			//
			// SHOULD PATCH?
			if(Object.values(patchObject).length > 0)
			{
				// CHANGE NODE UI STATE
				if(config.speakerid)
				{
					scope.status({fill: "grey", shape: "ring", text: "hue-speaker.node.command"});
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
					bridge.patch("speaker", tempSpeakerID, patchObject)
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
		// CLOSE NODE / DETACH FROM THE BRIDGE
		this.on('close', function()
		{
			if(scope.unsubscribe) { scope.unsubscribe(); }
		});
	}

	RED.nodes.registerType("hue-speaker", HueSpeaker);
}
