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
			var getScene;
			if (config.sceneid) {
				getScene = bridge.client.scenes.getById(config.sceneid);
			} else if (typeof msg.payload === 'string') {
				getScene = bridge.client.scenes.getAll()
					.then(scenes => {
						let fallback;
						for (const scene of scenes) {
							if (scene.name === msg.payload || scene.id === msg.payload) {
								return scene;
							}
						}

						throw new Error('Scene with name or id ' + msg.payload + ' does not exist.');
					});
			} else {
				getScene = Promise.reject(new Error('No scene provided'));
			}

			getScene
			.then(scene => {
				scope.status({fill: "blue", shape: "dot", text: "scene recalled"});
				bridge.client.scenes.recall(scene);
				return scene;
			})
			.then(scene => {
				var sendSceneInfo = {payload: {}};

				sendSceneInfo.payload.id = scene.id;
				sendSceneInfo.payload.name = scene.name;
				sendSceneInfo.payload.lightIds = scene.lightIds.join(', ');
				sendSceneInfo.payload.owner = scene.owner;
				sendSceneInfo.payload.appData = scene.appData;
				sendSceneInfo.payload.lastUpdated = scene.lastUpdated;
				sendSceneInfo.payload.version = scene.version;

				scope.send(sendSceneInfo);

				setTimeout(function() {
					scope.status({});
				}, 1000);
			})
			.catch(error => {
				scope.error(error, msg);
			});
		});
	}

	RED.nodes.registerType("hue-scene", HueScene);
}
