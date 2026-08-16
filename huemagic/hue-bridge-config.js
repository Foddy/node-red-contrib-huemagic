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
			HueContactMessage,
			HueTemperatureMessage,
			HueBrightnessMessage,
			HueButtonsMessage,
			HueRulesMessage,
			HueSpeakerMessage,
			HueAutomationMessage,
			servesType
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
		this.events.setMaxListeners(0);
		this.patchQueue = null;
		this.timerWatchDog = null;
		this.watchdogFailures = 0;
		this.starting = false;
		this.refetchTimeout = null;

		// RESOURCE ID PATTERN (NEVER GLOBAL, "test" WOULD BECOME STATEFUL)
		this.validResourceID = /^[a-zA-Z0-9-]+$/i;

		// FIRMWARE UPDATE TIMEOUT
		this.firmwareUpdateTimeout = null;

		// CREATE NODE
		RED.nodes.createNode(scope, config);

		// PERIODICALLY CHECK WETHER BRIDGE IS CONNECTED
		this.startWatchdog = function()
		{
			if(scope.timerWatchDog !== null) { clearTimeout(scope.timerWatchDog); }
			if(scope.nodeActive === false) { return false; }

			// THE BRIDGE SENDS NO KEEP-ALIVE ON THE EVENT STREAM, SO KEEP ASKING - JUST RARELY
			scope.timerWatchDog = setTimeout(function()
			{
				API.request({ config: config, resource: "bridge" })
				.then(function(bridgeInformation)
				{
					scope.watchdogFailures = 0;
					scope.startWatchdog();
				})
				.catch(function(error)
				{
					// BRIDGE IS OVERLOADED (429) OR BUSY (503) BUT STILL ALIVE
					if(error.status === 429 || error.status === 503)
					{
						return scope.startWatchdog();
					}

					scope.watchdogFailures += 1;
					scope.log(RED._("hue-bridge-config.node.request-error", { error: JSON.stringify(error.errors ? error.errors : error) }));

					// ONLY RECONNECT AFTER THREE FAILED ATTEMPTS IN A ROW
					if(scope.watchdogFailures >= 3) { scope.start(); }
					else { scope.startWatchdog(); }
				});
			}, API.connected(config) ? 60000 : 15000);
		}

		// INITIALIZE
		this.start = function()
		{
			if(scope.starting === true || scope.nodeActive === false) { return false; }
			scope.starting = true;
			scope.watchdogFailures = 0;

			scope.log(RED._("hue-bridge-config.node.initializing", { bridge: config.bridge }));
			API.init({ config: config })
			.then(function(bridge) {
				scope.log(RED._("hue-bridge-config.node.connected"));
				return scope.getAllResources();
			})
			.then(function(allResources)
			{
				scope.log(RED._("hue-bridge-config.node.processing"));
				return API.processResources(allResources);
			})
			.then(function(allResources)
			{
				// SAVE CURRENT RESOURCES
				scope.resources = allResources;

				// EMIT INITIAL STATES -> NODES
				scope.log(RED._("hue-bridge-config.node.initial-emit"));
				return scope.emitInitialStates();
			})
			.then(function(emitted)
			{
				scope.starting = false;

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
				scope.starting = false;
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

				// GET BRIDGE INFORMATION (LEGACY API / MAY BE UNAVAILABLE)
				scope.getBridgeInformation()
				.catch(function(error)
				{
					scope.log(RED._("hue-bridge-config.node.no-legacy-api"));
					return { id: "bridge", id_v1: "/config", updated: dayjs().format() };
				})
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

					// GET RULES (LEGACY API / MAY BE UNAVAILABLE)
					return API.request({ config: config, resource: "/rules", version: 1 }).catch(function(error) { return {}; });
				})
				.then(function(rules)
				{
					for (var [id, rule] of Object.entries(rules))
					{
						// SKIP ERROR RESPONSES OF THE LEGACY API
						if(!rule || typeof rule !== 'object' || rule["error"]) { continue; }

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
						if(id === "_groupsOf") { continue; }
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
				scope.log(RED._("hue-bridge-config.node.keep-updated"));

				// REFRESH STATES (SSE)
				this.refreshStatesSSE();
			}
		}

		// GET UPDATED STATES (SSE)
		this.refreshStatesSSE = function()
		{
			scope.log(RED._("hue-bridge-config.node.subscribing"));
			API.subscribe(config, function(updates, eventType)
			{
				const currentDateTime = dayjs().format();

				// DEVICE ADDED/REMOVED OR EVENTS MISSED? -> RE-READ ALL RESOURCES
				if(eventType === "add" || eventType === "delete" || eventType === "reconnect")
				{
					return scope.refetchResources();
				}

				for(let resource of updates)
				{
					let id = resource.id;
					let type = resource.type;

					let previousState = false;

					// HAS OWNER?
					if(resource["owner"])
					{
						let targetId = resource["owner"]["rid"];
						const services = scope.resources[targetId] ? scope.resources[targetId]["services"] : false;

						if(services && services[type])
						{
							// GET PREVIOUS STATE
							previousState = services[type][id];

							// IS BUTTON OR DIAL? -> REMOVE PREVIOUS STATES
							if(type === "button" || type === "relative_rotary")
							{
								for (const [oneServiceID, oneService] of Object.entries(services[type]))
								{
									delete services[type][oneServiceID][type];
								}
							}
						}
					}
					else if(scope.resources[id])
					{
						// GET PREVIOUS STATE
						previousState = scope.resources[id];
					}

					// NO PREVIOUS STATE? -> UNKNOWN RESOURCE, CONTINUE WITH THE NEXT ONE
					if(!previousState) { continue; }

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
			},
			function(reason, seconds)
			{
				scope.log(RED._("hue-bridge-config.node.connection-lost", { reason: reason, seconds: seconds }));
			});
		}

		// RE-READ ALL RESOURCES (DEVICE ADDED / REMOVED ON THE BRIDGE)
		this.refetchResources = function()
		{
			if(scope.refetchTimeout !== null) { clearTimeout(scope.refetchTimeout); }
			scope.refetchTimeout = setTimeout(function()
			{
				scope.refetchTimeout = null;
				scope.log(RED._("hue-bridge-config.node.resources-changed"));

				scope.getAllResources()
				.then(function(allResources)
				{
					return API.processResources(allResources);
				})
				.then(function(allResources)
				{
					scope.resources = allResources;
					return scope.emitInitialStates();
				})
				.catch(function(error) { scope.log(error); });
			}, 5000);
		}

		// PUSH UPDATED STATE
		this.pushUpdatedState = function(resource, updatedType, suppressMessage = false)
		{
			if(!resource || !resource.id) { return false; }

			let services = resource["services"] ? Object.keys(resource["services"]) : [];

			// ROOMS, ZONES AND THE BRIDGE HOME ARE ADDRESSED AS GROUPS
			if(resource["type"] === "room" || resource["type"] === "zone" || resource["type"] === "bridge_home") { services.push("group"); }

			const msg = { id: resource.id, type: resource.type, updatedType: updatedType, services: services, suppressMessage: suppressMessage };
			this.events.emit(config.id + "_" + resource.id, msg);
			this.events.emit(config.id + "_" + "globalResourceUpdates", msg);

			// RESOURCE CONTAINS SERVICES? -> SERVICE IN GROUP? -> EMIT CHANGES TO GROUPS ALSO
			const groupsOfResource = this.resources["_groupsOf"] ? this.resources["_groupsOf"][resource.id] : false;

			if(groupsOfResource)
			{
				for (var g = groupsOfResource.length - 1; g >= 0; g--)
				{
					const groupID = groupsOfResource[g];
					const groupMessage = { id: groupID, type: "group", updatedType: updatedType, services: ["group"], suppressMessage: suppressMessage };

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
					const lastState = scope.lastStates[type+targetResource.id] ? structuredClone(scope.lastStates[type+targetResource.id]) : false;

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
							scope.lastStates[type+targetResource.id] = structuredClone(currentState);
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
							scope.lastStates[type+targetResource.id] = structuredClone(currentState);
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
							scope.lastStates[type+targetResource.id] = structuredClone(currentState);
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
							scope.lastStates[type+targetResource.id] = structuredClone(currentState);
							currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
							currentState.lastState = lastState;

							return currentState;
						} catch (error) {
							return false;
						}
					}
					else if(type == "contact")
					{
						try {
							const message = new HueContactMessage(targetResource, options);

							// GET & SAVE LAST STATE AND DIFFERENCES
							let currentState = message.msg;
							scope.lastStates[type+targetResource.id] = structuredClone(currentState);
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
							scope.lastStates[type+targetResource.id] = structuredClone(currentState);
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
							scope.lastStates[type+targetResource.id] = structuredClone(currentState);
							currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
							currentState.lastState = lastState;

							return currentState;
						} catch (error) {
							return false;
						}
					}
					else if(type == "speaker")
					{
						try {
							const message = new HueSpeakerMessage(targetResource, options);

							// GET & SAVE LAST STATE AND DIFFERENCES
							let currentState = message.msg;
							scope.lastStates[type+targetResource.id] = structuredClone(currentState);
							currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
							currentState.lastState = lastState;

							return currentState;
						} catch (error) {
							return false;
						}
					}
					else if(type == "automation")
					{
						try {
							const message = new HueAutomationMessage(targetResource, options);

							// GET & SAVE LAST STATE AND DIFFERENCES
							let currentState = message.msg;
							scope.lastStates[type+targetResource.id] = structuredClone(currentState);
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
							scope.lastStates[type+targetResource.id] = structuredClone(currentState);
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

					// AUTOMATIONS ARE NOT DEVICES
					if(type === "automation")
					{
						if(resource["type"] === "behavior_instance") { allFilteredResources[rootID] = scope.get(type, rootID); }
					}
					// NORMAL DEVICES
					else if(!isGroup && servesType(resource, type))
					{
						allFilteredResources[rootID] = scope.get(type, rootID);
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
				if(!scope.patchQueue) { return reject({ status: "ECONNRESET", errors: RED._("hue-bridge-config.node.not-connected") }); }
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

		// THE BRIDGE ACCEPTS ABOUT 10 LIGHT COMMANDS BUT ONLY 1 GROUP COMMAND PER SECOND
		this.rateLimits = { light: 100, group: 1000 };
		this.nextSlot = { light: 0, group: 0 };

		// RESERVE THE NEXT FREE TIME SLOT / GIVE BACK HOW LONG TO WAIT FOR IT
		this.reserveSlot = function(type)
		{
			const channel = (type === "group" || type === "grouped_light" || type === "scene" || type === "smart_scene") ? "group" : "light";
			const now = Date.now();
			const slot = Math.max(now, scope.nextSlot[channel]);

			scope.nextSlot[channel] = slot + scope.rateLimits[channel];
			return slot - now;
		}

		// PATCH RESOURCE (WORKER)
		this.patchQueue = fastq(function({ type, id, patch, version }, callback)
		{
			// GET SERVICE ID
			if(version !== 1 && scope.resources[id] && scope.resources[id]["services"] && scope.resources[id]["services"][type])
			{
				const targetResource = Object.values(scope.resources[id]["services"][type])[0];
				id = targetResource.id;
			}

			// ACTION! (BUT NEVER FASTER THAN THE BRIDGE CAN TAKE IT)
			setTimeout(function()
			{
				API.request({ config: config, method: "PUT", resource: (version === 2) ? (type+"/"+id) : id, data: patch, version: version })
				.then(function(response) {
					callback(null, response);
				})
				.catch(function(error) {
					callback(error, null);
				});
			}, scope.reserveSlot(type));
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
				"motion": ["motion", "camera_motion", "grouped_motion", "convenience_area_motion", "security_area_motion", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"contact": ["contact", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"temperature": ["temperature", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"light_level": ["light_level", "grouped_light_level", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"button": ["button", "bell_button", "relative_rotary", "switch_input_configuration", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"group": ["group", "light", "grouped_light"],
				"speaker": ["speaker", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"automation": ["behavior_instance"],
				"rule": ["rule"]
			};

			let eventName;
			let listener;

			if(!id)
			{
				// UNIVERSAL MODE
				eventName = config.id + "_" + "globalResourceUpdates";
				listener = function(info)
				{
					if(type === "bridge")
					{
						callback(info);
					}
					else if(!messageWhitelist[type])
					{
						return false;
					}
					else if(info.services.includes(type) && messageWhitelist[type].includes(info.updatedType))
					{
						callback(info);
					}
					else if(type == "rule" && messageWhitelist[type].includes(info.updatedType))
					{
						callback(info);
					}
				};
			}
			else
			{
				// SPECIFIC RESOURCE MODE
				eventName = config.id + "_" + id;
				listener = function(info)
				{
					if(type !== "bridge" && !messageWhitelist[type]) { return false; }

					if(type === "bridge" || messageWhitelist[type].includes(info.updatedType))
					{
						callback(info);
					}
				};
			}

			scope.events.on(eventName, listener);

			// THE CONFIG NODE OUTLIVES A REDEPLOY, SO EVERY NODE HAS TO DETACH ITSELF AGAIN
			return function() { scope.events.removeListener(eventName, listener); };
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
			scope.log(RED._("hue-bridge-config.node.unsubscribing"));
			API.unsubscribe(config);

			// UNSUBSCRIBE FROM "READY" EVENTS
			scope.events.removeAllListeners();

			// REMOVE ALL TIMEOUTS
			if(scope.firmwareUpdateTimeout !== null) { clearTimeout(scope.firmwareUpdateTimeout); }
			if(scope.timerWatchDog !== null) { clearTimeout(scope.timerWatchDog); }
			if(scope.refetchTimeout !== null) { clearTimeout(scope.refetchTimeout); }

			// KILL QUEUE
			scope.patchQueue.kill();
		});
	}

	RED.nodes.registerType("hue-bridge", HueBridge);

	//
	// DISCOVER HUE BRIDGES ON LOCAL NETWORK
	RED.httpAdmin.get('/hue/bridges', RED.auth.needsPermission('hue-bridge.read'), async function(req, res, next)
	{
		axios({
			"method": "GET",
			"url": "https://discovery.meethue.com",
			"headers": {
				"Content-Type": "application/json; charset=utf-8"
			},
			"timeout": 10000,
		})
		.then(function(response)
		{
			// PREPARE BRIDGES OUTPUT
			var bridges = {};
			for (var i = response.data.length - 1; i >= 0; i--)
			{
				// THE DISCOVERY SERVICE ALSO ANSWERS WITH A PORT SINCE THE BRIDGE PRO
				const ipAddress = response.data[i].internalipaddress;
				const port = response.data[i].port;
				const target = (port && port !== 443) ? (ipAddress + ":" + port) : ipAddress;

				bridges[target] = { ip: target, name: target };
			}

			res.end(JSON.stringify(Object.values(bridges)));
		})
		.catch(function(error) {
			res.status(500).send(JSON.stringify({ error: error.message }));
		});
	});

	//
	// GET BRIDGE NAME
	RED.httpAdmin.get('/hue/name', RED.auth.needsPermission('hue-bridge.read'), function(req, res, next)
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
				res.status(500).send(error.message ? error.message : JSON.stringify(error));
			});
	    }
	});

	//
	// REGISTER A HUE BRIDGE
	RED.httpAdmin.get('/hue/register', RED.auth.needsPermission('hue-bridge.read'), function(req, rescope, next)
	{
		if(!req.query.ip)
		{
			return rescope.status(500).send(RED._("hue-bridge-config.config.missing-ip"));
		}
		else
		{
			// MODERN BRIDGES (AND THE BRIDGE PRO) NO LONGER ANSWER ON PLAIN HTTP
			axios({
				"method": "POST",
				"url": "https://"+req.query.ip+"/api",
				"httpsAgent": new https.Agent({ rejectUnauthorized: false }),
				"proxy": false, // THE BRIDGE IS ON THE LOCAL NETWORK, NEVER GO THROUGH A PROXY
				"headers": {
					"Content-Type": "application/json; charset=utf-8"
				},
				"timeout": 10000,
				"data": {
					"devicetype": "huemagic#node-red " + Math.floor((Math.random() * 100) + 1),
					"generateclientkey": true
				}
			})
			.then(function(response)
			{
				var bridge = response.data;

				// LINK BUTTON NOT PRESSED (ERROR TYPE 101) OR ANYTHING ELSE WENT WRONG
				if(!Array.isArray(bridge) || !bridge[0] || bridge[0].error || !bridge[0].success)
				{
					rescope.end("error");
				}
				else
				{
					rescope.end(JSON.stringify(bridge));
				}
			})
			.catch(function(error) {
				rescope.status(500).send(error.message ? error.message : JSON.stringify(error));
			});
		}
	});

	//
	// DISCOVER RESOURCES
	RED.httpAdmin.get('/hue/resources', RED.auth.needsPermission('hue-bridge.read'), function(req, res, next)
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
					// SKIP ERROR RESPONSES OF THE LEGACY API
					if(!rule || typeof rule !== 'object' || rule["error"]) { continue; }

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

					// AUTOMATIONS OF THE HUE APP
					if(targetType === "automation")
					{
						if(resource["type"] === "behavior_instance")
						{
							var oneDevice = {};
							oneDevice.id = id;
							oneDevice.name = (resource.metadata && resource.metadata.name) ? resource.metadata.name : id;
							oneDevice.model = resource.script_id ? resource.script_id : false;

							targetDevices[id] = oneDevice;
						}
					}
					// NORMAL DEVICES
					else if(!isGroup && servesType(resource, targetType))
					{
						var oneDevice = {};
						oneDevice.id = id;
						oneDevice.name = resource.metadata ? resource.metadata.name : (resource.name ? resource.name : false);
						oneDevice.model = resource.product_data ? resource.product_data.product_name : false;

						targetDevices[id] = oneDevice;
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
					else if(targetType === "scene" && (resource["type"] == "scene" || resource["type"] == "smart_scene"))
					{
						// THE GROUP OF A SCENE MAY BE UNKNOWN OR ALREADY DELETED
						const sceneGroup = (resource["group"] && processedResources[resource["group"]["rid"]]) ? processedResources[resource["group"]["rid"]] : false;

						var oneDevice = {};
						oneDevice.id = id;
						oneDevice.name = resource.metadata ? resource.metadata.name : false;
						oneDevice.group = (sceneGroup && sceneGroup.metadata) ? sceneGroup.metadata.name : "–";

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
