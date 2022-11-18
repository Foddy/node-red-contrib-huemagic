module.exports = function(RED)
{
	"use strict";

	function HueBridgeNode(config)
	{
		RED.nodes.createNode(this, config);

		const scope = this;
		const bridge = RED.nodes.getNode(config.bridge);

		// IS CONNECTED?
		this.connected = false;

		// GET BRIDGE INFORMATION INITIALLY
		this.lastBridgeInformation = null;

		// SAVE LAST COMMAND
		this.lastCommand = null;

		// NODE UI STATUS TIMEOUT
		this.timeout = null;

		//
		// ACTIVE STATE
		this.nodeActive = true;

		//
		// CHECK CONFIG
		if(bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-bridge.node.not-configured"});
			return false;
		}

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connecting"});

		this.setInitialState = function()
		{
			scope.status({fill: "green", shape: "dot", text: "hue-bridge.node.connected"});
		}


		//
		// GET BRIDGE INFORMATION
		this.getBridgeInformation = async function(forceReload = false)
		{
			return new Promise(function(resolve, reject)
			{
				if(forceReload === true)
				{
					// REFRESH INFORMATION
					bridge.getBridgeInformation(true)
					.then(function(updated)
					{
						return scope.getBridgeInformation();
					})
					.then(function(bridgeInformation)
					{
						resolve(bridgeInformation);
					});
				}
				else if(scope.lastBridgeInformation !== null)
				{
					let bridgeInformationCopy = Object.assign({}, scope.lastBridgeInformation);
					resolve(bridgeInformationCopy);
				}
				else
				{
					let bridgeInformation = bridge.get("bridge", "bridge", { autoupdate: ((bridge.config.autoupdates && bridge.config.autoupdates == true) || typeof bridge.config.autoupdates == 'undefined') });
					scope.lastBridgeInformation = Object.assign({}, bridgeInformation);

					resolve(bridgeInformation);
				}
			});
		}

		//
		// SUBSCRIBE TO UPDATES FROM THE BRIDGE
		bridge.subscribe(scope, "bridge", "globalResourceUpdates", async function(info)
		{
			let currentState = bridge.get(info.updatedType, info.id);

			// RESOURCE FOUND?
			if(currentState !== false)
			{
				// UPDATE COUNTER
				if(info.suppressMessage === false)
				{
					scope.status({fill: "blue", shape: "dot", text: "hue-bridge.node.connected"});

					if(scope.timeout !== null) { clearTimeout(scope.timeout); }
					scope.timeout = setTimeout(function() {
						scope.setInitialState();
					}, 1000);
				}

				// SEND MESSAGE
				if(!config.skipglobalevents && (config.initevents || info.suppressMessage == false))
				{
					scope.getBridgeInformation()
					.then(function(info)
					{
						// ADD DEVICE UPDATE TO RESPONSE
						info.updated = currentState;

						// SET LAST COMMAND
						if(scope.lastCommand !== null)
						{
							info.command = scope.lastCommand;
						}

						// SEND MESSAGE
						scope.send(info);

						// RESET LAST COMMAND
						scope.lastCommand = null;
					});
				}
			}

			// CONNECTED?
			if(scope.connected == false)
			{
				scope.connected = true;
				scope.setInitialState();
			}
		});

		//
		// ON COMMAND
		this.on('input', function(msg, send, done)
		{
			// REDEFINE SEND AND DONE IF NOT AVAILABLE
			send = send || function() { scope.send.apply(scope,arguments); }
			done = done || function() { scope.done.apply(scope,arguments); }

			// SET LAST COMMAND
			scope.lastCommand = RED.util.cloneMessage(msg);

			// GET BRIDGE INFORMATION
			scope.getBridgeInformation()
			.then(function(bridgeInformation)
			{
				// START TOUCHLINK
				if(typeof msg.payload != 'undefined' && typeof msg.payload.touchLink != 'undefined')
				{
					// SET STATUS
					scope.status({fill: "yellow", shape: "dot", text: "hue-bridge.node.starting-tl" });

					// ENABLE TOUCHLINK
					bridge.patch("bridge", "/config", { touchlink: true }, 1)
					.then(function(status)
					{
						// SET STATUS
						scope.status({fill: "blue", shape: "ring", text: "hue-bridge.node.started-tl" });
						if(done) { done(); }

						// RESET STATUS AFTER 30 SECONDS
						setTimeout(function()
						{
							scope.setInitialState();
							scope.getBridgeInformation(true);
						}, 30000);
					})
					.catch(function(error)
					{
						scope.error(error);
						if(done) { done(error); }
					});
				}
				// FETCH RESOURCES
				else if(typeof msg.payload != 'undefined' && typeof msg.payload.fetch != 'undefined')
				{
					let fetchTypes = [];
					if(typeof msg.payload.fetch == 'string') { fetchTypes.push(msg.payload.fetch); }
					else if(typeof msg.payload.fetch == 'object') { fetchTypes = msg.payload.fetch; }
					else { return false; }

					scope.status({fill: "blue", shape: "dot", text: "hue-bridge.node.f-resources" });

					// FETCH
					bridgeInformation.results = {};
					fetchTypes.forEach(function(fetch)
					{
						bridgeInformation.results[fetch] = bridge.get(fetch);
					});

					// SEND RESULTS
					if(scope.lastCommand !== null)
					{
						bridgeInformation.command = scope.lastCommand;
					}

					send(bridgeInformation);

					// RESET LAST COMMAND
					scope.lastCommand = null;
					if(done) { done(); }

					// RESET STATUS
					setTimeout(function(){ scope.setInitialState(); }, 2000);
				}
				// UPDATE SETTINGS
				else if(typeof msg.payload != 'undefined' && typeof msg.payload.settings != 'undefined')
				{
					let patchObject = {};

					if(typeof msg.payload.settings.name != 'undefined')
					{
						patchObject.name = msg.payload.settings.name;
					}
					if(typeof msg.payload.settings.zigbeeChannel != 'undefined')
					{
						patchObject.zigbeechannel = msg.payload.settings.zigbeeChannel;
					}
					if(typeof msg.payload.settings.ipAddress != 'undefined')
					{
						patchObject.ipaddress = msg.payload.settings.ipAddress;
					}
					if(typeof msg.payload.settings.dhcpEnabled != 'undefined')
					{
						patchObject.dhcp = msg.payload.settings.dhcpEnabled;
					}
					if(typeof msg.payload.settings.netmask != 'undefined')
					{
						patchObject.netmask = msg.payload.settings.netmask;
					}
					if(typeof msg.payload.settings.gateway != 'undefined')
					{
						patchObject.gateway = msg.payload.settings.gateway;
					}
					if(typeof msg.payload.settings.proxyPort != 'undefined')
					{
						patchObject.proxyport = msg.payload.settings.proxyPort;
					}
					if(typeof msg.payload.settings.proxyAddress != 'undefined')
					{
						patchObject.proxyaddress = msg.payload.settings.proxyAddress;
					}
					if(typeof msg.payload.settings.timeZone != 'undefined')
					{
						patchObject.timezone = msg.payload.settings.timeZone;
					}

					// PATCH BRIDGE!
					if(Object.values(patchObject).length > 0)
					{
						// SET UPDATING STATUS
						scope.status({fill: "yellow", shape: "dot", text: "hue-bridge.node.updating-settings" });

						// PATCH BRIDGE
						bridge.patch("bridge", "/config", patchObject, 1)
						.then(function(patched)
						{
							// GET RELOADED BRIDGE INFORMATION
							return scope.getBridgeInformation(true);
						})
						.then(function(bridgeInformation)
						{
							scope.status({fill: "blue", shape: "dot", text: "hue-bridge.node.settings-updated" });

							// SET LAST COMMAND
							if(scope.lastCommand !== null)
							{
								bridgeInformation.command = scope.lastCommand;
							}

							scope.send(bridgeInformation);

							// RESET LAST COMMAND
							scope.lastCommand = null;

							if(done) { done(); }
							setTimeout(function(){ scope.setInitialState(); }, 3000);
						})
						.catch(function(error) {
							scope.error(error);
							if(done) { done(error); }
						});
					}
				}
				// GIVE BACK CURRENT STATE
				else
				{
					// SEND MESSAGE
					if(scope.lastCommand !== null)
					{
						bridgeInformation.command = scope.lastCommand;
					}

					scope.send(bridgeInformation);

					// RESET LAST COMMAND
					scope.lastCommand = null;
				}
			});
		});

		// ON NODE UNLOAD : UNSUBSCRIBE FROM BRIDGE
		this.on ('close', function (done)
		{
			bridge.unsubscribe(scope);
			done();
		});
	}

	RED.nodes.registerType("hue-bridge-node", HueBridgeNode);
}
