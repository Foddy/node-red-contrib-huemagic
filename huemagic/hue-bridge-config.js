module.exports = function(RED)
{
	"use strict";

	const API = require('./utils/api');
	const merge = require('./utils/merge');
	const events = require('events');
	const dayjs = require('dayjs');
	const diff = require("deep-object-diff").diff;
	const axios = require('axios');
	const https = require('https');
	const fastq = require('fastq');

	// READABLE RESOURCE MESSAGES
	const { HueBridgeMessage,
			HueLightMessage,
			HueGroupMessage,
			HueMotionMessage,
			HueTemperatureMessage,
			HueBrightnessMessage,
			HueButtonsMessage,
			HueRulesMessage
		} = require('./utils/messages');

	function HueBridge(config)
	{
		const scope = this;

		// STATES
		this.nodeActive = true;
		this.config = config;
		this.resources = {};
		this.resourcesInGroups = {};
		this.lastStates = {};
		this.events = new events.EventEmitter();
		this.patchQueue = null;
		this.timerWatchDog = null;

		// RESOURCE ID PATTERN
		this.validResourceID = /[a-zA-Z0-9]/gi;

		// FIRMWARE UPDATE TIMEOUT
		this.firmwareUpdateTimeout = null;

		// CREATE NODE
		RED.nodes.createNode(scope, config);

		// PERIODICALLY CHECK WETHER BRIDGE IS CONNECTED
		this.startWatchdog = function()
		{
			if (this.timerWatchDog !== null) clearTimeout(this.timerWatchDog);
			this.timerWatchDog = setTimeout(function()
			{
				try
				{
					API.request({ config: config, resource: "/config", version: 1 })
					.then(function(bridgeInformation)
					{
						scope.startWatchdog();
					})
					.catch(function(error)
					{
						// scope.log("Error requesting info from the bridge. Reconnect in some secs. " + error.message);
						// debug
						if (error.status !== 429) {
							scope.log("Error requesting info from the bridge. Reconnect in some secs. " + ((typeof(error.message) == 'undefined') ? JSON.stringify(error) : error.message));
							// end debug
							scope.start();
						} else {
							// Bridge did not respond because it is currently overloaded (=error 429), but it is still alive, so nothing to do / restart, just keep monitoring as normal
							// scope.log("Bridge responded but was overloaded for now (ERR:429), no reconnection required for now.");
							scope.startWatchdog();
						}
					});
				} catch (error) {
					// scope.log("Lost connection with the bridge. Reconnect in some secs. " + error.message);
					// debug
					scope.log("Lost connection with the bridge. Reconnect in some secs. " + ((typeof(error.message) == 'undefined') ? JSON.stringify(error) : error.message));
					// end debug
					scope.start();
				}
			}, 10000);
		}

		// INITIALIZE
		this.start = function()
		{
			scope.log("Initializing the bridge ("+config.bridge+")…");
			API.init({ config: config })
			.then(function(bridge) {
				scope.log("Connected to bridge");
				return scope.getAllResources();
			})
			.then(function(allResources)
			{
				scope.log("Processing bridge resources…");
				return API.processResources(allResources);
			})
			.then(function(allResources)
			{
				// SAVE CURRENT RESOURCES
				scope.resources = allResources;

				// EMIT INITIAL STATES -> NODES
				scope.log("Initial emit of resource states…");
				return scope.emitInitialStates();
			})
			.then(function(emitted)
			{
				// START REFRESHING STATES
				scope.keepUpdated();

				// START LOOKING FOR FIRMWARE-UPDATES
				scope.autoUpdateFirmware();

				// START WATCHDOG
				scope.startWatchdog();
				return true;
			})
			.catch(function(error)
			{
				// RETRY AFTER 30 SECONDS
				scope.log(error);
				if(scope.nodeActive == true) { setTimeout(function(){ scope.start(); }, 30000); }
			});
		}

		// FETCH BRIDGE INFORMATION
		this.getBridgeInformation = function(replaceResources = false)
		{
			return new Promise(function(resolve, reject)
			{
				API.request({ config: config, resource: "/config", version: 1 })
				.then(function(bridgeInformation)
				{
					// PREPARE TO MATCH V2 RESOURCES
					bridgeInformation.id = "bridge";
					bridgeInformation.id_v1 = "/config";
					bridgeInformation.updated = dayjs().format();

					// ALSO REPLACE CURRENT RESOURCE?
					if(replaceResources === true)
					{
						scope.resources[bridgeInformation.id] = bridgeInformation;
					}

					// GIVE BACK
					resolve(bridgeInformation);
				})
				.catch(function(error)
				{
					reject(error);
				});
			});
		}

		// GET ALL RESOURCES + RULES
		this.getAllResources = function()
		{
			return new Promise(function(resolve, reject)
			{
				var allResources = [];

				// GET BRIDGE INFORMATION
				scope.getBridgeInformation()
				.then(function(bridgeInformation)
				{
					// PUSH TO RESOURCES
					allResources.push(bridgeInformation);

					// CONTINUE WITH ALL RESOURCES
					return API.request({ config: config, resource: "all" });
				})
				.then(function(v2Resources)
				{
					// MERGE RESOURCES
					allResources = allResources.concat(v2Resources);

					// GET RULES (LEGACY API)
					return API.request({ config: config, resource: "/rules", version: 1 });
				})
				.then(function(rules)
				{
					for (var [id, rule] of Object.entries(rules))
					{
						// "RENAME" OWNER
						rule["_owner"] = rule["owner"];
						delete rule["owner"];

						// ADD RULE ID(S)
						rule["id"] = "rule_" + id;
						rule["id_v1"] = "/rules/" + id;

						// ADD RULE TYPE
						rule["type"] = "rule";

						// PUSH RULES
						allResources.push(rule);
					}

					resolve(allResources);
				})
				.catch(function(error) { reject(error); });
			});
		}

		// EMIT INITIAL STATES -> NODES
		this.emitInitialStates = function(resources = false)
		{
			return new Promise(function(resolve, reject)
			{
				// PUSH STATES
				setTimeout(function()
				{
					// PUSH ALL STATES
					for (const [id, resource] of Object.entries(scope.resources))
					{
						scope.pushUpdatedState(resource, resource.type, true);
					}

					resolve(true);
				}, 500);
			});
		}

		// KEEEP STATES UP-TO-DATE
		this.keepUpdated = function()
		{
			if(!config.disableupdates)
			{
				scope.log("Keeping nodes up-to-date…");

				// REFRESH STATES (SSE)
				this.refreshStatesSSE();
			}
		}

		// GET UPDATED STATES (SSE)
		this.refreshStatesSSE = function()
		{
			scope.log("Subscribing to bridge events…");
			API.subscribe(config, function(updates)
			{
				const currentDateTime = dayjs().format();

				for(let resource of updates)
				{
					let id = resource.id;
					let type = resource.type;

					let previousState = false;

					// HAS OWNER?
					if(resource["owner"])
					{
						let targetId = resource["owner"]["rid"];

						if(scope.resources[targetId])
						{
							// GET PREVIOUS STATE
							previousState = scope.resources[targetId]["services"][type][id];

							// IS BUTTON? -> REMOVE PREVIOUS STATES
							if(type === "button")
							{
								for (const [oneButtonID, oneButton] of Object.entries(scope.resources[targetId]["services"]["button"]))
								{
									delete scope.resources[targetId]["services"]["button"][oneButtonID]["button"];
								}
							}
						}
					}
					else if(scope.resources[id])
					{
						// GET PREVIOUS STATE
						previousState = scope.resources[id];
					}

					// NO PREVIOUS STATE?
					if(!previousState) { return false; }

					// CHECK DIFFERENCES
					const mergedState = merge.deep(previousState, resource);
					const updatedResources = diff(previousState, mergedState);

					if(Object.values(updatedResources).length > 0)
					{
						if(resource["owner"])
						{
							let targetId = resource["owner"]["rid"];

							scope.resources[targetId]["services"][type][id] = mergedState;
							scope.resources[targetId]["updated"] = currentDateTime;

							// PUSH STATE
							scope.pushUpdatedState(scope.resources[targetId], resource.type);
						}
						else
						{
							scope.resources[id] = mergedState;
							scope.resources[id]["updated"] = currentDateTime;

							// PUSH STATE
							scope.pushUpdatedState(scope.resources[id], resource.type);
						}
					}
				}
			});
		}

		// PUSH UPDATED STATE
		this.pushUpdatedState = function(resource, updatedType, suppressMessage = false)
		{
			const msg = { id: resource.id, type: resource.type, updatedType: updatedType, services: resource["services"] ? Object.keys(resource["services"]) : [], suppressMessage: suppressMessage };
			this.events.emit(config.id + "_" + resource.id, msg);
			this.events.emit(config.id + "_" + "globalResourceUpdates", msg);

			// RESOURCE CONTAINS SERVICES? -> SERVICE IN GROUP? -> EMIT CHANGES TO GROUPS ALSO
			if(this.resources["_groupsOf"][resource.id])
			{
				for (var g = this.resources["_groupsOf"][resource.id].length - 1; g >= 0; g--)
				{
					const groupID = this.resources["_groupsOf"][resource.id][g];
					const groupMessage = { id: groupID, type: "group", updatedType: updatedType, services: [], suppressMessage: suppressMessage };

					this.events.emit(config.id + "_" + groupID, groupMessage);
					this.events.emit(config.id + "_" + "globalResourceUpdates", groupMessage);
				}
			}
		}

		// GET RESOURCE (FROM NODES)
		this.get = function(type, id = false, options = {})
		{
			// GET SPECIFIC RESOURCE
			if(id)
			{
				// RESOURCE EXISTS? -> PROCEED
				if(scope.resources[id])
				{
					// RESOLVE LINKS
					const targetResource = scope.resources[id];
					const lastState = scope.lastStates[type+targetResource.id] ? Object.assign({}, scope.lastStates[type+targetResource.id]) : false;

					if(type == "bridge")
					{
						try {
							const message = new HueBridgeMessage(targetResource, options);

							// GET CURRENT STATE MESSAGE
							let currentState = message.msg;
							return currentState;
						} catch (error) {
							return false;
						}

					}
					else if(type == "light")
					{
						try {
							const message = new HueLightMessage(targetResource, options);

							// GET & SAVE LAST STATE AND DIFFERENCES
							let currentState = message.msg;
							scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
							currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
							currentState.lastState = lastState;

							return currentState;
						} catch (error) {
							return false;
						}
					}
					else if(type == "group")
					{
						try {
							// GET MESSAGE
							const message = new HueGroupMessage(targetResource, { resources: scope.resources, ...options});

							// GET & SAVE LAST STATE AND DIFFERENCES
							let currentState = message.msg;
							scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
							currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
							currentState.lastState = lastState;

							return currentState;
						} catch (error) {
							return false;
						}
					}
					else if(type == "button")
					{
						try {
							const message = new HueButtonsMessage(targetResource, options);

							// GET & SAVE LAST STATE AND DIFFERENCES
							let currentState = message.msg;
							scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
							currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
							currentState.lastState = lastState;

							return currentState;
						} catch (error) {
							return false;
						}
					}
					else if(type == "motion")
					{
						try {
							const message = new HueMotionMessage(targetResource, options);

							// GET & SAVE LAST STATE AND DIFFERENCES
							let currentState = message.msg;
							scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
							currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
							currentState.lastState = lastState;

							return currentState;
						} catch (error) {
							return false;
						}
					}
					else if(type == "temperature")
					{
						try {
							const message = new HueTemperatureMessage(targetResource, options);

							// GET & SAVE LAST STATE AND DIFFERENCES
							let currentState = message.msg;
							scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
							currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
							currentState.lastState = lastState;

							return currentState;
						} catch (error) {
							return false;
						}
					}
					else if(type == "light_level")
					{
						try {
							const message = new HueBrightnessMessage(targetResource, options);

							// GET & SAVE LAST STATE AND DIFFERENCES
							let currentState = message.msg;
							scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
							currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
							currentState.lastState = lastState;

							return currentState;
						} catch (error) {
							return false;
						}
					}
					else if(type == "rule")
					{
						try {
							const message = new HueRulesMessage(targetResource, options);

							// GET & SAVE LAST STATE AND DIFFERENCES
							let currentState = message.msg;
							scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
							currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
							currentState.lastState = lastState;

							return currentState;
						} catch (error) {
							return false;
						}
					}
					else
					{
						return false;
					}
				}
				else
				{
					return false;
				}
			}
			else
			{
				// FILTER RESOURCES BY TYPE
				let allFilteredResources = {};

				for (const [rootID, resource] of Object.entries(scope.resources))
				{
					const isGroup = (resource["type"] == "room" || resource["type"] == "zone" || resource["type"] == "bridge_home");

					// NORMAL DEVICES
					if(!isGroup && resource["services"] && resource["services"][type])
					{
						for (const [serviceID, targetDevice] of Object.entries(resource["services"][type]))
						{
							allFilteredResources[rootID] = scope.get(type, rootID);
						}
					}
					// GROUPED RESOURCES
					else if(isGroup && type === "group")
					{
						allFilteredResources[rootID] = scope.get(type, rootID);
					}
				}

				return Object.values(allFilteredResources);
			}
		}

		// PATCH RESOURCE (FROM NODES)
		this.patch = function(type, id, patch, version = 2)
		{
			return new Promise(function(resolve, reject)
			{
				if(!scope.patchQueue) { return false; }
				scope.patchQueue.push({ type: type, id: id, patch: patch, version: version }, function (error, response)
				{
					if(error)
					{
						reject(error);
					}
					else
					{
						resolve(response);
					}
				});
			});
		}

		// PATCH RESOURCE (WORKER) / 7 PROCESSES IN PARALLEL
		this.patchQueue = fastq(function({ type, id, patch, version }, callback)
		{
			// GET SERVICE ID
			if(version !== 1 && scope.resources[id] && scope.resources[id]["services"] && scope.resources[id]["services"][type])
			{
				const targetResource = Object.values(scope.resources[id]["services"][type])[0];
				id = targetResource.id;
			}

			// ACTION!
			API.request({ config: config, method: "PUT", resource: (version === 2) ? (type+"/"+id) : id, data: patch, version: version })
			.then(function(response) {
				callback(null, response);
			})
			.catch(function(error) {
				callback(error, null);
			});
		}, config.worker ? parseInt(config.worker) : 10);

		// RE-FETCH RULE (RECEIVES NO UPDATES VIA SSE)
		this.refetchRule = function(id)
		{
			return new Promise(function(resolve, reject)
			{
				API.request({ config: config, resource: "/rules/" + id, version: 1 })
				.then(function(rule)
				{
					// "RENAME" OWNER
					rule["_owner"] = rule["owner"];
					delete rule["owner"];

					// ADD RULE ID(S)
					rule["id"] = "rule_" + id;
					rule["id_v1"] = "/rules/" + id;

					// ADD RULE TYPE
					rule["type"] = "rule";

					// UPDATED TIME
					rule["updated"] = dayjs().format();

					// ADD BACK TO RESOURCES
					scope.resources[rule["id"]] = rule;

					// PUSH UPDATED STATE
					scope.pushUpdatedState(rule, "rule");
					resolve(resolve);
				})
				.catch(function(error) {
					reject(error);
				});
			});
		}

		// SUBSCRIBE (FROM NODES)
		this.subscribe = function(type, id = null, callback = null)
		{
			// IS RULE?
			if(type == "rule" && !!id)
			{
				id = "rule_" + id;
			}

			// PUSH WHITELIST
			const messageWhitelist = {
				"light": ["light", "zigbee_connectivity", "zgp_connectivity", "device"],
				"motion": ["motion", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"temperature": ["temperature", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"light_level": ["light_level", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"button": ["button", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"group": ["group", "light", "grouped_light"],
				"rule": ["rule"]
			};

			if(!id)
			{
				// UNIVERSAL MODE
				this.events.on(config.id + "_" + "globalResourceUpdates", function(info)
				{
					if(type === "bridge")
					{
						callback(info);
					}
					else if(info.services.includes(type) && messageWhitelist[type].includes(info.updatedType))
					{
						callback(info);
					}
					else if(type == "rule" && messageWhitelist[type].includes(info.updatedType))
					{
						callback(info);
					}
				});
			}
			else
			{
				// SPECIFIC RESOURCE MODE
				this.events.on(config.id + "_" + id, function(info)
				{
					if(type === "bridge" || messageWhitelist[type].includes(info.updatedType))
					{
						callback(info);
					}
				});
			}
		}

		// AUTO UPDATES?
		this.autoUpdateFirmware = function()
		{
			if((config.autoupdates && config.autoupdates == true) || typeof config.autoupdates == 'undefined')
			{
				if(scope.firmwareUpdateTimeout !== null) { clearTimeout(scope.firmwareUpdateTimeout); };
				API.request({
					config: config,
					method: "PUT",
					resource: "/config",
					version: 1,
					data: {
						swupdate2: {
							checkforupdate: true,
							install: true
						}
					}
				})
				.then(function(status)
				{
					if(scope.nodeActive == true)
					{
						scope.firmwareUpdateTimeout = setTimeout(function(){ scope.autoUpdateFirmware(); }, 60000 * 720);
					}
				})
				.catch(function(error)
				{
					// NO UPDATES AVAILABLE // TRY AGAIN IN 12H
					if(scope.nodeActive == true)
					{
						scope.firmwareUpdateTimeout = setTimeout(function(){ scope.autoUpdateFirmware(); }, 60000 * 720);
					}
				});
			}
		}

		//
		// START THE MAGIC
		this.start();

		//
		// CLOSE NODE / REMOVE EVENT LISTENER
		this.on('close', function()
		{
			scope.nodeActive = false;

			// UNSUBSCRIBE FROM BRIDGE EVENTS
			scope.log("Unsubscribing from bridge events…");
			API.unsubscribe(config);

			// UNSUBSCRIBE FROM "READY" EVENTS
			scope.events.removeAllListeners();

			// REMOVE FIRMWARE UPDATE TIMEOUT
			if(scope.firmwareUpdateTimeout !== null) { clearTimeout(scope.firmwareUpdateTimeout); }

			// KILL QUEUE
			scope.patchQueue.kill();
		});
	}

	RED.nodes.registerType("hue-bridge", HueBridge);

	//
	// DISCOVER HUE BRIDGES ON LOCAL NETWORK
	RED.httpAdmin.get('/hue/bridges', async function(req, res, next)
	{
		axios({
			"method": "GET",
			"url": "https://discovery.meethue.com",
			"headers": {
				"Content-Type": "application/json; charset=utf-8"
			},
		})
		.then(function(response)
		{
			// PREPARE BRIDGES OUTPUT
			var bridges = {};
			for (var i = response.data.length - 1; i >= 0; i--)
			{
				var ipAddress = response.data[i].internalipaddress;
				bridges[ipAddress] = { ip: ipAddress, name: ipAddress };
			}

			res.end(JSON.stringify(Object.values(bridges)));
		})
		.catch(function(error) {
			res.send(error);
		});
	});

	//
	// GET BRIDGE NAME
	RED.httpAdmin.get('/hue/name', function(req, res, next)
	{
		if(!req.query.ip)
		{
			return res.status(500).send(RED._("hue-bridge-config.config.missing-ip"));
	    }
	    else
	    {
			API.init({ config: { bridge: req.query.ip, key: "huemagic" } })
			.then(function(bridge) {
				res.end(bridge.name);
			})
			.catch(function(error) {
				res.send(error);
			});
	    }
	});

	//
	// REGISTER A HUE BRIDGE
	RED.httpAdmin.get('/hue/register', function(req, rescope, next)
	{
		if(!req.query.ip)
		{
			return rescope.status(500).send(RED._("hue-bridge-config.config.missing-ip"));
		}
		else
		{
			axios({
				"method": "POST",
				"url": "http://"+req.query.ip+"/api",
				"httpsAgent": new https.Agent({ rejectUnauthorized: false }),
				"headers": {
					"Content-Type": "application/json; charset=utf-8"
				},
				"data": {
					"devicetype": "HueMagic for Node-RED (" + Math.floor((Math.random() * 100) + 1) + ")"
				}
			})
			.then(function(response)
			{
				var bridge = response.data;
				if(bridge[0].error)
				{
					rescope.end("error");
				}
				else
				{
					rescope.end(JSON.stringify(bridge));
				}
			})
			.catch(function(error) {
				rescope.status(500).send(error);
			});
		}
	});

	//
	// DISCOVER RESOURCES
	RED.httpAdmin.get('/hue/resources', function(req, res, next)
	{
		const targetType = req.query.type;

		// GET ALL RULES
		if(targetType == "rule")
		{
			API.request({ config: { bridge: req.query.bridge, key: req.query.key }, resource: "/rules", version: 1 })
			.then(function(rules)
			{
				let targetRules = {};

				for (var [id, rule] of Object.entries(rules))
				{
					var oneDevice = {};
					oneDevice.id = id;
					oneDevice.name = rule.name;
					oneDevice.model = false;

					targetRules[id] = oneDevice;
				}

				// CONVERT TO ARRAY
				targetRules = Object.values(targetRules);

				// GIVE BACK
				res.end(JSON.stringify(targetRules));
			})
			.catch(function(error) {
				res.status(500).send(JSON.stringify(error));
			});
		}
		// GET ALL OTHER RESOURCES
		else
		{
			API.request({ config: { bridge: req.query.bridge, key: req.query.key }, resource: "all" })
			.then(function(allResources)
			{
				return API.processResources(allResources);
			})
			.then(function(processedResources)
			{
				let targetDevices = {};

				for (const [id, resource] of Object.entries(processedResources))
				{
					const isGroup = (resource["type"] == "room" || resource["type"] == "zone" || resource["type"] == "bridge_home");

					// NORMAL DEVICES
					if(!isGroup && resource["services"] && resource["services"][targetType])
					{
						for (const [deviceID, targetDevice] of Object.entries(resource["services"][targetType]))
						{
							var oneDevice = {};
							oneDevice.id = id;
							oneDevice.name = resource.metadata ? resource.metadata.name : false;
							oneDevice.model = resource.product_data ? resource.product_data.product_name : false;

							targetDevices[id] = oneDevice;
						}
					}
					// GROUPED (LIGHT) RESOURCES
					else if(isGroup && targetType === "group")
					{
						if(resource["services"] && resource["services"]["grouped_light"])
						{
							var oneDevice = {};
							oneDevice.id = id;
							oneDevice.name = resource.metadata ? resource.metadata.name : false;
							oneDevice.model = resource["type"];

							targetDevices[id] = oneDevice;
						}
					}
					// SCENES
					else if(targetType === "scene" && resource["type"] == "scene")
					{
						var oneDevice = {};
						oneDevice.id = id;
						oneDevice.name = resource.metadata ? resource.metadata.name : false;
						oneDevice.group = processedResources[resource["group"]["rid"]].metadata.name;

						targetDevices[id] = oneDevice;
					}
				}

				// CONVERT TO ARRAY
				targetDevices = Object.values(targetDevices);

				// GIVE BACK
				res.end(JSON.stringify(targetDevices));
			})
			.catch(function(error) {
				res.status(500).send(JSON.stringify(error));
			});
		}
	});
};
