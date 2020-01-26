module.exports = function(RED)
{
	"use strict";

	function HueBridgeNode(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let { HueBridgeMessage, HueBrightnessMessage, HueGroupMessage, HueLightMessage, HueMotionMessage, HueRulesMessage, HueSwitchMessage, HueTapMessage, HueTemperatureMessage } = require('../utils/messages');

		// PREVENT DEVICE MESSAGES IN FIRST 5 SECONDS
		this.deviceUpdates = false;
		setTimeout(function(){ scope.deviceUpdates = true; }, 5000);

		//
		// ACTIVE STATE
		this.nodeActive = true;

		//
		// BRIDGE INFORMATION
		this.bridgeInformation = {};


		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-bridge.node.not-configured"});
			return false;
		}

		//
		// UPDATE STATE
		this.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connecting"});

		//
		// GET INFORMATION
		this.getBridgeInformation = function()
		{
			bridge.client.bridge.get()
			.then(bridgeInformation => {
				var hueBridge = new HueBridgeMessage(bridgeInformation, config);
				scope.send(hueBridge.msg);
				scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connected" });

				// SAVE BRIDGE INFORMATION
				scope.bridgeInformation = hueBridge.msg.payload;
			})
			.catch(error => {
				scope.error(error);
				if(scope.nodeActive == true)
				{
					setTimeout(function(){ scope.getBridgeInformation(); }, 3000);
				}
			});
		}

		//
		// INITIAL START
		this.getBridgeInformation();

		//
		// AUTO UPDATES?
		this.autoUpdateHueBridge = function()
		{
			if(config.autoupdates == true)
			{
				bridge.client.softwareUpdate.check()
				.then(() => {
					return bridge.client.softwareUpdate.get();
				})
				.then(softwareUpdate => {
					return bridge.client.softwareUpdate.install();
				})
				.then(() => {
					// UPDATING // CHECK STATUS IN 5 MINUTES
					if(scope.nodeActive == true)
					{
						setTimeout(function(){ scope.getBridgeInformation(); }, 60000 * 5);
					}
				})
				.catch(error => {
					// NO UPDATES AVAILABLE // TRY AGAIN IN 3H
					if(scope.nodeActive == true)
					{
						setTimeout(function(){ scope.autoUpdateHueBridge(); }, 60000 * 180);
					}
				});
			}
		}

		this.autoUpdateHueBridge();

		//
		// DEVICE UPDATES
		if(!config.skipglobalevents)
		{
			bridge.events.on('globalDeviceUpdates', function(message)
			{
				if(scope.deviceUpdates == false) { return; }

				let type = message.type;
				let payload = message.payload;
				var detType = type;

				// CONSTRUCT MESSAGE
				var message = {};
				message.updated = {};

				// ADD PAYLOAD
				if(type == "light")
				{
					let hueLight = new HueLightMessage(payload, {colornamer: true});
					message.updated = hueLight.msg;
				}
				else if(type == "group")
				{
					let hueGroup = new HueGroupMessage(payload, {colornamer: true});
					message.updated = hueGroup.msg;
				}
				else if(type == "rule")
				{
					let hueRules = new HueRulesMessage(payload);
					message.updated = hueRules.msg;
				}
				else if(type == "sensor")
				{
					// DETERMINE TYPE
					if(payload.type == "ZLLPresence")
					{
						let hueMotion = new HueMotionMessage(payload);
						message.updated = hueMotion.msg;

						detType = "motion";
					}
					else if(payload.type == "ZLLLightLevel")
					{
						let hueBrightness = new HueBrightnessMessage(payload);
						message.updated = hueBrightness.msg;

						detType = "brightness";
					}
					else if(payload.type == "ZLLTemperature")
					{
						let hueTemperature = new HueTemperatureMessage(payload);
						message.updated = hueTemperature.msg;

						detType = "temperature";
					}
					else if(payload.type == "ZLLSwitch")
					{
						let hueSwitch = new HueSwitchMessage(payload);
						message.updated = hueSwitch.msg;

						detType = "switch";
					}
					else if(payload.type == "ZGPSwitch")
					{
						let hueTap = new HueTapMessage(sensor);
						message.updated = hueTap.msg;

						detType = "tap";
					}
				}

				// ADD TYPE
				message.updated.type = detType;

				// ADD BRIDGE INFORMATION
				message.info = scope.bridgeInformation;

				// SEND MESSAGE
				scope.send(message);
			});
		}


		//
		// COMMANDS
		this.on('input', function(msg, send, done)
		{
			// Node-RED < 1.0
			send = send || function() { scope.send.apply(scope,arguments); }

			var commandSent = false;

			// STARTING TOUCHLINK
			if(typeof msg.payload.touchLink != 'undefined')
			{
				scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.starting-tl" });
				bridge.client.bridge.touchlink()
				.then(() => {
					scope.status({fill: "blue", shape: "ring", text: "hue-bridge.node.started-tl" });
					if(done) { done(); }
					setTimeout(function(){ scope.getBridgeInformation(); }, 30000);
				})
				.catch(error => {
					scope.error(error);
					if(done) { done(error); }
					setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
				});

				// COMMAND SENT
				commandSent = true;
			}

			// GET DEVICES
			if(typeof msg.payload.fetch != 'undefined')
			{
				if(msg.payload.fetch == "users")
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.f-users" });
					bridge.client.users.getAll()
					.then(users => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connected" }); }, 2000);

						var message = {};
						message.users = users;
						message.info = scope.bridgeInformation;

						send(message);
						if(done) { done(); }
					})
					.catch(error => {
						scope.error(error);
						if(done) { done(error); }
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "lights")
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.f-lights" });
					bridge.client.lights.getAll()
					.then(lights => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connected" }); }, 2000);

						var message = {};
						message.lights = lights;
						message.info = scope.bridgeInformation;

						send(message);
						if(done) { done(); }
					})
					.catch(error => {
						scope.error(error);
						if(done) { done(error); }
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "groups")
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.f-groups" });
					bridge.client.groups.getAll()
					.then(groups => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connected" }); }, 2000);

						var message = {};
						message.groups = groups;
						message.info = scope.bridgeInformation;

						send(message);
						if(done) { done(); }
					})
					.catch(error => {
						scope.error(error);
						if(done) { done(error); }
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "sensors")
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.f-sensors" });
					bridge.client.sensors.getAll()
					.then(sensors => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connected" }); }, 2000);

						var message = {};
						message.sensors = sensors;
						message.info = scope.bridgeInformation;

						send(message);
						if(done) { done(); }
					})
					.catch(error => {
						scope.error(error);
						if(done) { done(error); }
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "scenes")
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.f-scenes" });
					bridge.client.scenes.getAll()
					.then(scenes => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connected" }); }, 2000);

						var message = {};
						message.scenes = scenes;
						message.info = scope.bridgeInformation;

						send(message);
						if(done) { done(); }
					})
					.catch(error => {
						scope.error(error);
						if(done) { done(error); }
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "rules")
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.f-rules" });
					bridge.client.rules.getAll()
					.then(rules => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connected" }); }, 2000);

						var message = {};
						message.rules = rules;
						message.info = scope.bridgeInformation;

						send(message);
						if(done) { done(); }
					})
					.catch(error => {
						scope.error(error);
						if(done) { done(error); }
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "schedules")
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.f-schedules" });
					bridge.client.schedules.getAll()
					.then(schedules => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connected" }); }, 2000);

						var message = {};
						message.schedules = schedules;
						message.info = scope.bridgeInformation;

						send(message);
						if(done) { done(); }
					})
					.catch(error => {
						scope.error(error);
						if(done) { done(error); }
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "resourceLinks")
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.f-rlinks" });
					bridge.client.resourceLinks.getAll()
					.then(resourceLinks => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connected" }); }, 2000);

						var message = {};
						message.resourceLinks = resourceLinks;
						message.info = scope.bridgeInformation;

						send(message);
						if(done) { done(); }
					})
					.catch(error => {
						scope.error(error);
						if(done) { done(error); }
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "timeZones")
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.f-timezones" });
					bridge.client.timeZones.getAll()
					.then(timeZones => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connected" }); }, 2000);

						var message = {};
						message.timeZones = timeZones;
						message.info = scope.bridgeInformation;

						send(message);
						if(done) { done(); }
					})
					.catch(error => {
						scope.error(error);
						if(done) { done(error); }
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "internetServices")
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.f-internet" });
					bridge.client.internetServices.get()
					.then(internetServices => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connected" }); }, 2000);

						var message = {};
						message.internetServices = internetServices;
						message.info = scope.bridgeInformation;

						send(message);
						if(done) { done(); }
					})
					.catch(error => {
						scope.error(error);
						if(done) { done(error); }
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "portal")
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.f-portal" });
					bridge.client.portal.get()
					.then(portal => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connected" }); }, 2000);

						var message = {};
						message.portal = portal;
						message.info = scope.bridgeInformation;

						send(message);
						if(done) { done(); }
					})
					.catch(error => {
						scope.error(error);
						if(done) { done(error); }
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}

				commandSent = true;
			}

			// UPDATING SETTINGS
			if(typeof msg.payload.settings != 'undefined')
			{
				scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.updating-settings" });
				bridge.client.bridge.get()
				.then(bridgeConfig => {
					if(typeof msg.payload.settings.name != 'undefined')
					{
						bridgeConfig.name = msg.payload.settings.name;
					}
					if(typeof msg.payload.settings.zigbeeChannel != 'undefined')
					{
						bridgeConfig.zigbeeChannel = msg.payload.settings.zigbeeChannel;
					}
					if(typeof msg.payload.settings.ipAddress != 'undefined')
					{
						bridgeConfig.ipAddress = msg.payload.settings.ipAddress;
					}
					if(typeof msg.payload.settings.dhcpEnabled != 'undefined')
					{
						bridgeConfig.dhcpEnabled = msg.payload.settings.dhcpEnabled;
					}
					if(typeof msg.payload.settings.netmask != 'undefined')
					{
						bridgeConfig.netmask = msg.payload.settings.netmask;
					}
					if(typeof msg.payload.settings.gateway != 'undefined')
					{
						bridgeConfig.gateway = msg.payload.settings.gateway;
					}
					if(typeof msg.payload.settings.proxyPort != 'undefined')
					{
						bridgeConfig.proxyPort = msg.payload.settings.proxyPort;
					}
					if(typeof msg.payload.settings.proxyAddress != 'undefined')
					{
						bridgeConfig.proxyAddress = msg.payload.settings.proxyAddress;
					}
					if(typeof msg.payload.settings.timeZone != 'undefined')
					{
						bridgeConfig.timeZone = msg.payload.settings.timeZone;
					}
					return bridge.client.bridge.save(bridgeConfig);
				})
				.then(bridgeInformation => {
					scope.status({fill: "green", shape: "dot", text: "hue-bridge.node.settings-updated" });
					if(done) { done(); }
					setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
				})
				.catch(error => {
					scope.error(error);
					if(done) { done(error); }
					setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
				});

				// COMMAND SENT
				commandSent = true;
			}

			// GET INFORMATION // FALLBACK
			if(commandSent == false)
			{
				scope.getBridgeInformation();
			}
		});

		//
		// CLOSE NODE
		this.on('close', function()
		{
			scope.nodeActive = false;
		});
	}

	RED.nodes.registerType("hue-bridge-node", HueBridgeNode);
}
