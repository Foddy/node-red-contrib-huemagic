module.exports = function(RED)
{
	"use strict";

	function HueScene(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let { HueSceneMessage } = require('../utils/messages');

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-scene.node.not-configured"});
			return false;
		}

		//
		// ENABLE SCENE
		this.on('input', function(msg, send, done)
		{
			// Node-RED < 1.0
			send = send || function() { scope.send.apply(scope,arguments); }

			var groupID = config.groupid;
			var sceneDef = config.sceneid;

			// PASSED SCENE NAME?
			if(typeof msg.payload === 'string' || msg.payload instanceof String)
			{
				sceneDef = msg.payload;
			}
			else
			{
				groupID = (typeof msg.payload != 'undefined' && typeof msg.payload.group != 'undefined') ? msg.payload.group : groupID;
				sceneDef = (typeof msg.payload != 'undefined' && typeof msg.payload.scene != 'undefined') ? msg.payload.scene : sceneDef;
			}

			if(config.sceneid)
			{
				bridge.client.scenes.getById(config.sceneid)
				.then(scene => {
					scope.proceedSceneAction(scene, groupID, send, done);
				});
			}
			else if(sceneDef)
			{
				bridge.client.scenes.getAll()
				.then(scenes => {
					for (var scene of scenes)
					{
						if(scene.id == sceneDef)
						{
							scope.proceedSceneAction(scene, groupID, send, done);
							break;
						}
						else if(scene.name == sceneDef)
						{
							scope.proceedSceneAction(scene, groupID, send, done);
							break;
						}
					}
				});
			}
			else
			{
				// ERROR
				this.status({fill: "red", shape: "ring", text: "hue-scene.node.no-id"});
			}
		});


		//
		// PROCEED SCENE ACTION
		this.proceedSceneAction = function(scene, applyOnGroup = false, send, done)
		{
			// CHECK IF SCENE SHOULD BE APPLIED TO A GROUP
			if(applyOnGroup)
			{
				var groupID = parseInt(applyOnGroup);
				bridge.client.groups.getById(groupID)
				.then(group =>
				{
					group.on = true;
					group.scene = scene;
					return bridge.client.groups.save(group);
				})
				.then(groupInfo =>
				{
					// SEND STATUS
					scope.status({fill: "blue", shape: "dot", text: "hue-scene.node.recalled-on-group"});

					// SEND MESSAGE
					if(!config.skipevents)
					{
						var hueScene = new HueSceneMessage(scene);
						send(hueScene.msg);
					}
					if(done) { done(); }

					// RESET STATUS AFTER 3 SEC
					setTimeout(function() {
						scope.status({});
					}, 3000);
				})
				.catch(error => {
					scope.error(error, msg);
					if(done) { done(error); }
				});
			}
			else
			{
				// RECALL A SCENE
				bridge.client.scenes.recall(scene)
				.then(recalledScene => {
					// SEND STATUS
					scope.status({fill: "blue", shape: "dot", text: "hue-scene.node.recalled"});

					// SEND MESSAGE
					if(!config.skipevents)
					{
						var hueScene = new HueSceneMessage(scene);
						send(hueScene.msg);
					}
					if(done) { done(); }

					// RESET STATUS AFTER 3 SEC
					setTimeout(function() {
						scope.status({});
					}, 3000);
				})
				.catch(error => {
					scope.error(error, msg);
					if(done) { done(error); }
				});
			}
		}
	}

	RED.nodes.registerType("hue-scene", HueScene);
}