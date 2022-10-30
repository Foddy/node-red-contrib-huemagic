module.exports = function(RED)
{
	"use strict";

	function HueScene(config)
	{
		RED.nodes.createNode(this, config);

		const scope = this;
		const bridge = RED.nodes.getNode(config.bridge);
		const async = require('async');

		// GET TARGET WIRED GROUPS
		this.targetGroups = {};
		for (var w = scope.wires[0].length - 1; w >= 0; w--)
		{
			let oneWiredNode = RED.nodes.getNode(scope.wires[0][w]);
			if(oneWiredNode && oneWiredNode.type == "hue-group" && oneWiredNode.exportedConfig && oneWiredNode.exportedConfig.groupid && oneWiredNode.exportedConfig.groupid.length > 1)
			{
				this.targetGroups[oneWiredNode.exportedConfig.groupid] = true;
			}
		}

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
			// REDEFINE SEND AND DONE IF NOT AVAILABLE
			done = done || function() { scope.done.apply(scope,arguments); }

			// TARGET GROUP & SCENE
			const groupIDS = (typeof msg.payload != 'undefined' && typeof msg.payload.group != 'undefined') ? msg.payload.group : [];
			const sceneDef = (typeof msg.payload != 'undefined' && typeof msg.payload.scene != 'undefined') ? msg.payload.scene : config.sceneid;

			// PREPARE TARGET GROUPS
			let copyOfTargetGroups = Object.keys(scope.targetGroups);
			if(typeof groupIDS == 'string') { copyOfTargetGroups.push(groupIDS); }
			else if(typeof groupIDS == 'object') { copyOfTargetGroups.concat(groupIDS); }
			else { return false; }

			// CREATE PATCH
			let patchObject = {};

			// NO SCENE?
			if(!sceneDef)
			{
				// ERROR
				this.status({fill: "red", shape: "ring", text: "hue-scene.node.no-id"});
				scope.error("Scene ID not found");
				return false;
			}

			// RECALL ON GROUP? -> USE API v1
			if(copyOfTargetGroups.length > 0)
			{
				let targetSceneID = bridge.resources[sceneDef].id_v1.replace("/scenes/", "");

				// SEND STATUS
				scope.status({fill: "blue", shape: "dot", text: "hue-scene.node.recalled-on-group"})

				// FIND GROUP AND RECALL SCENE
				for (var g = copyOfTargetGroups.length - 1; g >= 0; g--)
				{
					let targetGroup = bridge.get("group", copyOfTargetGroups[g]);

					if(targetGroup)
					{
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
							bridge.patch("group", targetGroup.info.idV1 + "/action", { "scene": targetSceneID }, 1)
							.then(function() { callback(null, true); })
							.catch(function(errors) {
								callback(errors, null);
							});
						},
						function(errors, success)
						{
							if(errors)
							{
								scope.error(errors);
							}
							else if(done)
							{
								done();
							}
						});
					}
				}

				// RESET STATUS AFTER 2 SECONDS
				setTimeout(function() {
					scope.status({});
				}, 2000);
			}
			else
			{
				// RECALL SCENE
				patchObject["recall"] = { action: "active" };

				// CHANGE NODE UI STATE
				scope.status({fill: "grey", shape: "ring", text: "hue-scene.node.command"});

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
					bridge.patch("scene", sceneDef, patchObject)
					.then(function()
					{
						scope.status({fill: "blue", shape: "dot", text: "hue-scene.node.recalled"});

						// RESET STATUS AFTER 1 SECOND
						setTimeout(function() {
							scope.status({});
						}, 1000);

						callback(null, true);
					})
					.catch(function(errors) { callback(errors, null); });
				},
				function(errors, success)
				{
					if(errors)
					{
						scope.error(errors);
					}
					else if(done)
					{
						done();
					}
				});
			}
		});
	}

	RED.nodes.registerType("hue-scene", HueScene);
}
