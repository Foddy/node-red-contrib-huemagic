module.exports = function(RED)
{
	"use strict";

	function HueScene(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let huejay = require('huejay');

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

			var groupID = (typeof msg.payload.group != 'undefined') ? msg.payload.group : config.groupid;

			if(config.sceneid)
			{
				bridge.client.scenes.getById(config.sceneid)
				.then(scene => {
					scope.proceedSceneAction(scene, groupID, send, done);
				});
			}
			else if (typeof msg.payload === 'string')
			{
				bridge.client.scenes.getAll()
				.then(scenes => {
					for (var scene of scenes)
					{
						if (scene.name === msg.payload || scene.id === msg.payload)
						{
							scope.proceedSceneAction(scene, groupID, send, done);
							break;
						}
					}
				});
			}
			else if (typeof msg.payload != 'undefined' && typeof msg.payload.scene != 'undefined')
			{
				bridge.client.scenes.getAll()
				.then(scenes => {
					for (var scene of scenes)
					{
						if (scene.name === msg.payload || scene.id === msg.payload)
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
					scope.status({fill: "blue", shape: "dot", text: "hue-scene.node.recalled-on-group"});

					var sendSceneInfo = {payload: {}};

					sendSceneInfo.payload.id = scene.id;
					sendSceneInfo.payload.name = scene.name;
					sendSceneInfo.payload.lightIds = scene.lightIds.join(', ');
					sendSceneInfo.payload.owner = scene.owner;
					sendSceneInfo.payload.appData = scene.appData;
					sendSceneInfo.payload.lastUpdated = scene.lastUpdated;
					sendSceneInfo.payload.version = scene.version;

					if(!config.skipevents) { send(sendSceneInfo); }
					if(done) { done(); }

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
				.then(recalledScebe => {
					scope.status({fill: "blue", shape: "dot", text: "hue-scene.node.recalled"});

					var sendSceneInfo = {payload: {}};

					sendSceneInfo.payload.id = scene.id;
					sendSceneInfo.payload.name = scene.name;
					sendSceneInfo.payload.lightIds = scene.lightIds.join(', ');
					sendSceneInfo.payload.owner = scene.owner;
					sendSceneInfo.payload.appData = scene.appData;
					sendSceneInfo.payload.lastUpdated = scene.lastUpdated;
					sendSceneInfo.payload.version = scene.version;

					if(!config.skipevents) { send(sendSceneInfo); }
					if(done) { done(); }

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
