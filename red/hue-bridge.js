module.exports = function(RED)
{
	"use strict";

	function HueBridgeNode(config)
	{
		RED.nodes.createNode(this, config);

		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let moment = require('moment');

		//
		// INTERVAL
		this.nodeActive = true;

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "not configured"});
			return false;
		}

		//
		// UPDATE STATE
		this.status({fill: "grey", shape: "dot", text: "connecting…"});

		//
		// GET INFORMATION
		this.getBridgeInformation = function()
		{
			bridge.client.bridge.get()
			.then(bridgeInformation => {
				var message = {};
				message.payload = {};
				message.payload.id = bridgeInformation.id;
				message.payload.name = bridgeInformation.name;
				message.payload.factoryNew = bridgeInformation.factoryNew;
				message.payload.replacesBridgeId = bridgeInformation.replacesBridgeId;
				message.payload.dataStoreVersion = bridgeInformation.dataStoreVersion;
				message.payload.starterKitId = bridgeInformation.starterKitId;
				message.payload.softwareVersion = bridgeInformation.softwareVersion;
				message.payload.apiVersion = bridgeInformation.apiVersion;
				message.payload.zigbeeChannel = bridgeInformation.zigbeeChannel;
				message.payload.macAddress = bridgeInformation.macAddress;
				message.payload.ipAddress = bridgeInformation.ipAddress;
				message.payload.dhcpEnabled = bridgeInformation.dhcpEnabled;
				message.payload.netmask = bridgeInformation.netmask;
				message.payload.gateway = bridgeInformation.gateway;
				message.payload.proxyAddress = bridgeInformation.proxyAddress;
				message.payload.proxyPort = bridgeInformation.proxyPort;
				message.payload.utcTime = bridgeInformation.utcTime;
				message.payload.timeZone = bridgeInformation.timeZone;
				message.payload.localTime = bridgeInformation.localTime;
				message.payload.portalServicesEnabled = bridgeInformation.portalServicesEnabled;
				message.payload.portalConnected = bridgeInformation.portalConnected;
				message.payload.linkButtonEnabled = bridgeInformation.linkButtonEnabled;
				message.payload.touchlinkEnabled = bridgeInformation.touchlinkEnabled;
				message.payload.autoUpdatesEnabled = config.autoupdates;

				message.payload.model = {};
				message.payload.model.id = bridgeInformation.model.id;
				message.payload.model.manufacturer = bridgeInformation.model.manufacturer;
				message.payload.model.name = bridgeInformation.model.name;

				scope.send(message);
				scope.status({fill: "grey", shape: "dot", text: "connected" });
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
					console.log("Checking for Hue Bridge updates…");
					return bridge.client.softwareUpdate.get();
				})
				.then(softwareUpdate => {
					console.log(softwareUpdate);
					return bridge.client.softwareUpdate.install();
				})
				.then(() => {
					// UPDATING // CHECK STATUS IN 5 MINUTES
					if(scope.nodeActive == true)
					{
						console.log("Updating Hue Bridge Firmware and Lights…");
						setTimeout(function(){ scope.getBridgeInformation(); }, 60000 * 5);
					}
				})
				.catch(error => {
					// NO UPDATES AVAILABLE // TRY AGAIN IN 1H
					if(scope.nodeActive == true)
					{
						console.log("No Hue Bridge updates available. Checking again in an hour…");
						setTimeout(function(){ scope.autoUpdateHueBridge(); }, 60000 * 60);
					}
				});
			}
		}

		this.autoUpdateHueBridge();

		//
		// COMMANDS
		this.on('input', function(msg)
		{
			var commandSent = false;
			
			// STARTING TOUCHLINK
			if(typeof msg.payload.touchLink != 'undefined')
			{
				scope.status({fill: "grey", shape: "dot", text: "starting TouchLink…" });
				bridge.client.bridge.touchlink()
				.then(() => {
					scope.status({fill: "blue", shape: "ring", text: "TouchLink started…" });
					setTimeout(function(){ scope.getBridgeInformation(); }, 30000);
				})
				.catch(error => {
					scope.error(error);
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
					scope.status({fill: "grey", shape: "dot", text: "fetching users…" });
					bridge.client.users.getAll()
					.then(users => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "connected" }); }, 2000);

						var message = {};
						message.users = users;
						scope.send(message);
					})
					.catch(error => {
						scope.error(error);
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "lights")
				{
					scope.status({fill: "grey", shape: "dot", text: "fetching lights…" });
					bridge.client.lights.getAll()
					.then(lights => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "connected" }); }, 2000);

						var message = {};
						message.lights = lights;
						scope.send(message);
					})
					.catch(error => {
						scope.error(error);
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "groups")
				{
					scope.status({fill: "grey", shape: "dot", text: "fetching groups…" });
					bridge.client.groups.getAll()
					.then(groups => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "connected" }); }, 2000);
						
						var message = {};
						message.groups = groups;
						scope.send(message);
					})
					.catch(error => {
						scope.error(error);
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "sensors")
				{
					scope.status({fill: "grey", shape: "dot", text: "fetching sensors…" });
					bridge.client.sensors.getAll()
					.then(sensors => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "connected" }); }, 2000);
						
						var message = {};
						message.sensors = sensors;
						scope.send(message);
					})
					.catch(error => {
						scope.error(error);
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "scenes")
				{
					scope.status({fill: "grey", shape: "dot", text: "fetching scenes…" });
					bridge.client.scenes.getAll()
					.then(scenes => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "connected" }); }, 2000);
						
						var message = {};
						message.scenes = scenes;
						scope.send(message);
					})
					.catch(error => {
						scope.error(error);
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "rules")
				{
					scope.status({fill: "grey", shape: "dot", text: "fetching rules…" });
					bridge.client.rules.getAll()
					.then(rules => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "connected" }); }, 2000);
						
						var message = {};
						message.rules = rules;
						scope.send(message);
					})
					.catch(error => {
						scope.error(error);
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "schedules")
				{
					scope.status({fill: "grey", shape: "dot", text: "fetching schedules…" });
					bridge.client.schedules.getAll()
					.then(schedules => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "connected" }); }, 2000);
						
						var message = {};
						message.schedules = schedules;
						scope.send(message);
					})
					.catch(error => {
						scope.error(error);
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "resourceLinks")
				{
					scope.status({fill: "grey", shape: "dot", text: "fetching resource links…" });
					bridge.client.resourceLinks.getAll()
					.then(resourceLinks => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "connected" }); }, 2000);
						
						var message = {};
						message.resourceLinks = resourceLinks;
						scope.send(message);
					})
					.catch(error => {
						scope.error(error);
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}
				else if(msg.payload.fetch == "timeZones")
				{
					scope.status({fill: "grey", shape: "dot", text: "fetching timezones…" });
					bridge.client.timeZones.getAll()
					.then(timeZones => {
						setTimeout(function(){ scope.status({fill: "grey", shape: "dot", text: "connected" }); }, 2000);
						
						var message = {};
						message.timeZones = timeZones;
						scope.send(message);
					})
					.catch(error => {
						scope.error(error);
						setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
					});
				}

				commandSent = true;
			}

			// UPDATING SETTINGS
			if(typeof msg.payload.settings != 'undefined')
			{
				scope.status({fill: "grey", shape: "dot", text: "updating settings…" });
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
					scope.status({fill: "green", shape: "dot", text: "config updated" });
					setTimeout(function(){ scope.getBridgeInformation(); }, 2000);
				})
				.catch(error => {
					scope.error(error);
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
		// CLOSE NDOE / REMOVE RECHECK INTERVAL
		this.on('close', function()
		{
			scope.nodeActive = false;
		});
	}

	RED.nodes.registerType("hue-bridge-node", HueBridgeNode);
}
