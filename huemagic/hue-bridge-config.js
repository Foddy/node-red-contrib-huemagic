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

	// READABLE RESSOURCE MESSAGES
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
		this.ressources = {};
		this.ressourcesInGroups = {};
		this.lastStates = {};
		this.events = new events.EventEmitter();

		// CREATE NODE
		RED.nodes.createNode(scope, config);

		// INITIALIZE
		this.start = function()
		{
			scope.log("Initializing the bridge…");
			API.init({ ip: config.bridge, key: config.key })
			.then(function(bridge) {
				scope.log("Connected to bridge");
				return scope.getAllRessources();
			})
			.then(function(allRessources)
			{
				scope.log("Process ressources…");
				return API.processRessources(allRessources);
			})
			.then(function(allRessources)
			{
				// SAVE CURRENT RESSOURCES
				scope.ressources = allRessources;

				// EMIT INITIAL STATES -> NODES
				scope.log("Initial emit of ressource states…");
				return scope.emitInitialStates();
			})
			.then(function(emitted)
			{
				// START REFRESHING STATES
				scope.keepUpdated();

				// START LOOKING FOR FIRMWARE-UPDATES
				scope.autoUpdateFirmware();
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
		this.getBridgeInformation = function(replaceRessources = false)
		{
			return new Promise(function(resolve, reject)
			{
				API.request({ ressource: "/config", version: 1 })
				.then(function(bridgeInformation)
				{
					// PREPARE TO MATCH V2 RESSOURCES
					bridgeInformation.id = "bridge";
					bridgeInformation.id_v1 = "/config";
					bridgeInformation.updated = dayjs().format();

					// ALSO REPLACE CURRENT RESSOURCE?
					if(replaceRessources === true)
					{
						scope.ressources[bridgeInformation.id] = bridgeInformation;
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

		// GET ALL RESSOURCES + RULES
		this.getAllRessources = function()
		{
			return new Promise(function(resolve, reject)
			{
				var allRessources = [];

				// GET BRIDGE INFORMATION
				scope.getBridgeInformation()
				.then(function(bridgeInformation)
				{
					// PUSH TO RESSOURCES
					allRessources.push(bridgeInformation);

					// CONTINUE WITH ALL RESSOURCES
					return API.request({ ressource: "all" });
				})
				.then(function(v2Ressources)
				{
					// MERGE RESSOURCES
					allRessources = allRessources.concat(v2Ressources);

					// GET RULES (LEGACY API)
					return API.request({ ressource: "/rules", version: 1 });
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
						allRessources.push(rule);
					}

					resolve(allRessources);
				})
				.catch(function(error) { reject(error); });
			});
		}

		// EMIT INITIAL STATES -> NODES
		this.emitInitialStates = function(ressources = false)
		{
			return new Promise(function(resolve, reject)
			{
				// PUSH STATES
				setTimeout(function()
				{
					// PUSH ALL STATES
					for (const [id, ressource] of Object.entries(scope.ressources))
					{
						scope.pushUpdatedState(ressource, ressource.type, true);
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
			API.subscribe(function(updates)
			{
				const currentDateTime = dayjs().format();

				for(let ressource of updates)
				{
					let id = ressource.id;
					let type = ressource.type;

					let previousState = false;

					// HAS OWNER?
					if(ressource["owner"])
					{
						let targetId = ressource["owner"]["rid"];

						if(scope.ressources[targetId])
						{
							// GET PREVIOUS STATE
							previousState = scope.ressources[targetId]["services"][type][id];

							// IS BUTTON? -> REMOVE PREVIOUS STATES
							if(type === "button")
							{
								for (const [oneButtonID, oneButton] of Object.entries(scope.ressources[targetId]["services"]["button"]))
								{
									delete scope.ressources[targetId]["services"]["button"][oneButtonID]["button"];
								}
							}
						}
					}
					else if(scope.ressources[id])
					{
						// GET PREVIOUS STATE
						previousState = scope.ressources[id];
					}

					// NO PREVIOUS STATE?
					if(!previousState) { return false; }

					// CHECK DIFFERENCES
					const mergedState = merge.deep(previousState, ressource);
					const updatedRessources = diff(previousState, mergedState);

					if(Object.values(updatedRessources).length > 0)
					{
						if(ressource["owner"])
						{
							let targetId = ressource["owner"]["rid"];

							scope.ressources[targetId]["services"][type][id] = mergedState;
							scope.ressources[targetId]["updated"] = currentDateTime;

							// PUSH STATE
							scope.pushUpdatedState(scope.ressources[targetId], ressource.type);
						}
						else
						{
							scope.ressources[id] = mergedState;
							scope.ressources[id]["updated"] = currentDateTime;

							// PUSH STATE
							scope.pushUpdatedState(scope.ressources[id], ressource.type);
						}
					}
				}
			});
		}

		// PUSH UPDATED STATE
		this.pushUpdatedState = function(ressource, updatedType, suppressMessage = false)
		{
			const msg = { id: ressource.id, type: ressource.type, updatedType: updatedType, services: ressource["services"] ? Object.keys(ressource["services"]) : [], suppressMessage: suppressMessage };
			this.events.emit(ressource.id, msg);
			this.events.emit("globalRessourceUpdates", msg);

			// RESSOURCE CONTAINS SERVICES? -> SERVICE IN GROUP? -> EMIT CHANGES TO GROUPS ALSO
			if(this.ressources["_groupsOf"][ressource.id])
			{
				for (var g = this.ressources["_groupsOf"][ressource.id].length - 1; g >= 0; g--)
				{
					const groupID = this.ressources["_groupsOf"][ressource.id][g];
					const groupMessage = { id: groupID, type: "group", updatedType: updatedType, services: [], suppressMessage: suppressMessage };

					this.events.emit(groupID, groupMessage);
					this.events.emit("globalRessourceUpdates", groupMessage);
				}
			}
		}

		// GET RESSOURCE (FROM NODES)
		this.get = function(type, id = false, options = {})
		{
			// GET SPECIFIC RESSOURCE
			if(id)
			{
				// RESSOURCE EXISTS? -> PROCEED
				if(scope.ressources[id])
				{
					// RESOLVE LINKS
					const targetRessource = scope.ressources[id];
					const lastState = scope.lastStates[type+targetRessource.id] ? Object.assign({}, scope.lastStates[type+targetRessource.id]) : false;

					if(type == "bridge")
					{
						const message = new HueBridgeMessage(targetRessource, options);

						// GET CURRENT STATE MESSAGE
						let currentState = message.msg;
						return currentState;
					}
					else if(type == "light")
					{
						const message = new HueLightMessage(targetRessource, options);

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetRessource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
					}
					else if(type == "group")
					{
						// GET MESSAGE
						const message = new HueGroupMessage(targetRessource, { ressources: scope.ressources, ...options});

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetRessource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
					}
					else if(type == "button")
					{
						const message = new HueButtonsMessage(targetRessource, options);

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetRessource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
					}
					else if(type == "motion")
					{
						const message = new HueMotionMessage(targetRessource, options);

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetRessource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
					}
					else if(type == "temperature")
					{
						const message = new HueTemperatureMessage(targetRessource, options);

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetRessource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
					}
					else if(type == "light_level")
					{
						const message = new HueBrightnessMessage(targetRessource, options);

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetRessource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
					}
					else if(type == "rule")
					{
						const message = new HueRulesMessage(targetRessource, options);

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetRessource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
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
				// FILTER RESSOURCES BY TYPE
				let allFilteredRessources = {};

				for (const [rootID, ressource] of Object.entries(scope.ressources))
				{
					const isGroup = (ressource["type"] == "room" || ressource["type"] == "zone" || ressource["type"] == "bridge_home");

					// NORMAL DEVICES
					if(!isGroup && ressource["services"] && ressource["services"][type])
					{
						for (const [serviceID, targetDevice] of Object.entries(ressource["services"][type]))
						{
							allFilteredRessources[rootID] = scope.get(type, rootID);
						}
					}
					// GROUPED RESSOURCES
					else if(isGroup && type === "group")
					{
						allFilteredRessources[rootID] = scope.get(type, rootID);
					}
				}

				return Object.values(allFilteredRessources);
			}
		}

		// PATCH RESSOURCE (FROM NODES)
		this.patch = function(type, id, patch, version = 2)
		{
			return new Promise(function(resolve, reject)
			{
				// GET SERVICE ID
				if(version !== 1 && scope.ressources[id] && scope.ressources[id]["services"] && scope.ressources[id]["services"][type])
				{
					const targetRessource = Object.values(scope.ressources[id]["services"][type])[0];
					id = targetRessource.id;
				}

				// ACTION!
				API.request({ method: "PUT", ressource: (version === 2) ? (type+"/"+id) : id, data: patch, version: version })
				.then(function(response) {
					resolve(response);
				})
				.catch(function(error) {
					reject(error);
				});
			});
		}

		// RE-FETCH RULE (RECEIVES NO UPDATES VIA SSE)
		this.refetchRule = function(id)
		{
			return new Promise(function(resolve, reject)
			{
				API.request({ ressource: "/rules/" + id, version: 1 })
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

					// ADD BACK TO RESSOURCES
					scope.ressources[rule["id"]] = rule;

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
				this.events.on("globalRessourceUpdates", function(info)
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
				// SPECIFIC RESSOURCE MODE
				this.events.on(id, function(info)
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
				scope.log("Checking for Hue Bridge firmware updates…");
				API.request({
					method: "PUT",
					ressource: "/config",
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
						setTimeout(function(){ scope.autoUpdateFirmware(); }, 60000 * 5);
					}
				})
				.catch(function(error)
				{
					// NO UPDATES AVAILABLE // TRY AGAIN IN 3H
					if(scope.nodeActive == true)
					{
						setTimeout(function(){ scope.autoUpdateFirmware(); }, 60000 * 180);
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
			API.unsubscribe();

			// UNSUBSCRIBE FROM "READY" EVENTS
			scope.events.removeAllListeners();
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
			API.init({ ip: req.query.ip })
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
					"devicetype": "huemagic_" + Math.floor((Math.random() * 100) + 1)
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
	// DISCOVER RESSOURCES
	RED.httpAdmin.get('/hue/ressources', function(req, res, next)
	{
		const targetType = req.query.type;

		// GET ALL RULES
		if(targetType == "rule")
		{
			API.init({ ip: req.query.bridge, key: req.query.key })
			.then(function(bridge) {
				return API.request({ ressource: "/rules", version: 1 });
			})
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
		// GET ALL OTHER RESSOURCES
		else
		{
			API.init({ ip: req.query.bridge, key: req.query.key })
			.then(function(bridge) {
				return API.request({ ressource: "all" });
			})
			.then(function(allRessources)
			{
				return API.processRessources(allRessources);
			})
			.then(function(processedRessources)
			{
				let targetDevices = {};

				for (const [id, ressource] of Object.entries(processedRessources))
				{
					const isGroup = (ressource["type"] == "room" || ressource["type"] == "zone" || ressource["type"] == "bridge_home");

					// NORMAL DEVICES
					if(!isGroup && ressource["services"] && ressource["services"][targetType])
					{
						for (const [deviceID, targetDevice] of Object.entries(ressource["services"][targetType]))
						{
							var oneDevice = {};
							oneDevice.id = id;
							oneDevice.name = ressource.metadata ? ressource.metadata.name : false;
							oneDevice.model = ressource.product_data ? ressource.product_data.product_name : false;

							targetDevices[id] = oneDevice;
						}
					}
					// GROUPED (LIGHT) RESSOURCES
					else if(isGroup && targetType === "group")
					{
						if(ressource["services"] && ressource["services"]["grouped_light"])
						{
							var oneDevice = {};
							oneDevice.id = id;
							oneDevice.name = ressource.metadata ? ressource.metadata.name : false;
							oneDevice.model = ressource["type"];

							targetDevices[id] = oneDevice;
						}
					}
					// SCENES
					else if(targetType === "scene" && ressource["type"] == "scene")
					{
						var oneDevice = {};
						oneDevice.id = id;
						oneDevice.name = ressource.metadata ? ressource.metadata.name : false;
						oneDevice.group = processedRessources[ressource["group"]["rid"]].metadata.name;

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