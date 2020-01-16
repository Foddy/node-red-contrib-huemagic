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
			this.status({fill: "red", shape: "ring", text: "not configured"});
			return false;
		}

		//
		// ENABLE SCENE
		this.on('input', function(msg)
		{
			var groupID = (typeof msg.payload.group != 'undefined') ? msg.payload.group : config.groupid;

			if(config.sceneid)
			{
				bridge.client.scenes.getById(config.sceneid)
				.then(scene => {
					scope.proceedSceneAction(scene, groupID);
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
							scope.proceedSceneAction(scene, groupID);
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
							scope.proceedSceneAction(scene, groupID);
							break;
						}
					}
				});
			}
			else
			{
				// ERROR
				this.status({fill: "red", shape: "ring", text: "No scene Id."});
			}
		});


		//
		// PROCEED SCENE ACTION
		this.proceedSceneAction = function(scene, applyOnGroup = false)
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
					scope.status({fill: "blue", shape: "dot", text: "scene recalled on group"});

					var sendSceneInfo = {payload: {}};

					sendSceneInfo.payload.id = scene.id;
					sendSceneInfo.payload.name = scene.name;
					sendSceneInfo.payload.lightIds = scene.lightIds.join(', ');
					sendSceneInfo.payload.owner = scene.owner;
					sendSceneInfo.payload.appData = scene.appData;
					sendSceneInfo.payload.lastUpdated = scene.lastUpdated;
					sendSceneInfo.payload.version = scene.version;

					if(!config.skipevents) { scope.send(sendSceneInfo); }

					setTimeout(function() {
						scope.status({});
					}, 3000);
				})
				.catch(error => {
					scope.error(error, msg);
				});
			}
			else
			{
				// RECALL A SCENE
				bridge.client.scenes.recall(scene)
				.then(recalledScebe => {
					scope.status({fill: "blue", shape: "dot", text: "scene recalled"});

					var sendSceneInfo = {payload: {}};

					sendSceneInfo.payload.id = scene.id;
					sendSceneInfo.payload.name = scene.name;
					sendSceneInfo.payload.lightIds = scene.lightIds.join(', ');
					sendSceneInfo.payload.owner = scene.owner;
					sendSceneInfo.payload.appData = scene.appData;
					sendSceneInfo.payload.lastUpdated = scene.lastUpdated;
					sendSceneInfo.payload.version = scene.version;

					if(!config.skipevents) { scope.send(sendSceneInfo); }

					setTimeout(function() {
						scope.status({});
					}, 3000);
				})
				.catch(error => {
					scope.error(error, msg);
				});
			}
		}
	}

	RED.nodes.registerType("hue-scene", HueScene);
}
