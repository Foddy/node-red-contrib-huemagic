const axios = require('axios');
const dayjs = require('dayjs');
const https = require('https');
const EventSource = require('eventsource');

function API()
{
	// STORAGE
	this.bridge = null;
	this.ipAddress = null;
	this.accessKey = null;
	this.events = null;

	//
	// INITIALIZE
	this.init = function({ ip, key = 'default' })
	{
		const scope = this;

		// FORCE RELOAD?
		const forceReload = (this.ipAddress != ip.toString().trim());

		// STORE ACCESS INFORMATION
		this.ipAddress = ip.toString().trim();
		this.accessKey = key.toString().trim();

		// GET BRIDGE
		return new Promise(function(resolve, reject)
		{
			if(scope.bridge !== null && forceReload === false)
			{
				resolve(scope.bridge);
			}
			else
			{
				// GET BRIDGE INFORMATION
				axios({
					"method": "GET",
					"url": "https://" + ip + "/api/config",
					"headers": { "Content-Type": "application/json; charset=utf-8" },
					"httpsAgent": new https.Agent({ rejectUnauthorized: false }),
				})
				.then(function(response)
				{
					scope.bridge = response.data;
					resolve(scope.bridge);
				})
				.catch(function(error)
				{
					reject(error);
				});
			}
		});
	}

	//
	// MAKE A REQUEST
	this.request = function({ method = 'GET', ressource = null, data = null, version = 2 })
	{
		const scope = this;
		return new Promise(function(resolve, reject)
		{
			// BUILD REQUEST OBJECT
			var request = {
				"method": method,
				"url": "https://" + scope.ipAddress,
				"headers": {
					"Content-Type": "application/json; charset=utf-8",
					"hue-application-key": scope.accessKey
				},
				"httpsAgent": new https.Agent({ rejectUnauthorized: false }), // Node is somehow not able to parse the official Philips Hue PEM
			};

			// HAS RESSOURCE? -> APPEND
			if(ressource !== null)
			{
				if(version === 2)
				{
					ressource = (ressource !== "all") ? "/"+ressource : "";
					request['url'] += "/clip/v2/resource" + ressource;
				}
				else if(version === 1)
				{
					request['url'] += "/api/" + scope.accessKey + ressource;
				}
			}

			// HAS DATA? -> INSERT
			if(data !== null) {
				request['data'] = data;
			}

			// RUN REQUEST
			axios(request)
			.then(function(response)
			{
				if(version === 2)
				{
					if(response.data.errors.length > 0)
					{
						reject(response.data.errors);
					}
					else
					{
						resolve(response.data.data);
					}
				}
				else if(version === 1)
				{
					resolve(response.data);
				}
			})
			.catch(function(error)
			{
				reject(error);
			});
		});
	}

	//
	// SUBSCRIBE TO BRIDGE EVENTS
	this.subscribe = function(callback)
	{
		const scope = this;
		return new Promise(function(resolve, reject)
		{
			if(scope.events === null)
			{
				var sseURL = "https://" + scope.ipAddress + "/eventstream/clip/v2";

				// INITIALIZE EVENT SOURCE
				scope.events = new EventSource(sseURL, {
					headers: { 'hue-application-key': scope.accessKey },
					https: { rejectUnauthorized: false },
				});

				// PIPE MESSAGE TO TARGET FUNCTION
				scope.events.onmessage = function(event)
				{
					if(event && event.type === 'message' && event.data)
					{
						const messages = JSON.parse(event.data);
						for (var i = messages.length - 1; i >= 0; i--)
						{
							const message = messages[i];
							if(message.type === "update")
							{
								callback(message.data);
							}
						}
					}
				};

				// CONNECTED?
				scope.events.onopen = function()
				{
					resolve(true);
				}

				// ERROR? -> RETRY?
				scope.events.onerror = function(error)
				{
					console.log("HueMagic:", "Connection to bridge lost. Trying to reconnect again in 30 seconds…", err);
					setTimeout(function(){ scope.subscribe(callback); }, 30000);
					resolve(true);
				}
			}
			else
			{
				scope.unsubscribe();
				scope.subscribe(callback);
			}
		});
	}

	//
	// UNSUBSCRIBE
	this.unsubscribe = function()
	{
		if(this.events !== null) { this.events.close(); }
		this.events = null;
	}

	//
	// GET FULL/ROOT RESSOURCE
	this.fullRessource = function(ressource, allRessources = {})
	{
		const scope = this;
		var fullRessource = Object.assign({}, ressource);

		if(ressource["owner"])
		{
			fullRessource = scope.fullRessource(allRessources[fullRessource["owner"]["rid"]], allRessources);
		}
		else if(ressource["type"] === "device" || ressource["type"] === "room" || ressource["type"] === "zone" || ressource["type"] === "bridge_home")
		{
			// RESOLVE SERVICES
			var allServices = {};

			for (var i = ressource["services"].length - 1; i >= 0; i--)
			{
				const targetService = ressource["services"][i];
				const targetType = targetService["rtype"];
				const targetID = targetService["rid"];

				if(!allServices[targetType]) { allServices[targetType] = {}; }
				allServices[targetType][targetID] = Object.assign({}, allRessources[targetID]);
			}

			// REPLACE SERVICES
			fullRessource["services"] = allServices;
		}

		return fullRessource;
	}

	//
	// PROCESS RESSOURCES
	this.processRessources = function(ressources)
	{
		const scope = this;

		// SET CURRENT DATE/TIME
		const currentDateTime = dayjs().format();

		// ACTION!
		return new Promise(function(resolve, reject)
		{
			let ressourceList = {};
			let processedRessources = {
				_groupsOf: {}
			};

			// CREATE ID BASED OBJECT OF ALL RESSOURCES
			ressources.forEach(function(ressource, index)
			{
				// IS BUTTON? -> REMOVE PREVIOUS STATE
				if(ressource.type === "button")
				{
					delete ressource["button"];
				}

				ressourceList[ressource.id] = ressource;
			});

			// GET FULL RESSOURCES OF EACH OBJECT
			ressources.forEach(function(ressource, index)
			{
				// GET FULL RESSOURCE
				let fullRessource = scope.fullRessource(ressource, ressourceList);

				// ADD CURRENT DATE/TIME
				fullRessource["updated"] = currentDateTime;

				// ALL ALL TYPES BEHIND RESSOURCE
				fullRessource["types"] = [ fullRessource["type"] ];

				// RESSOURCE HAS SERVICES?
				if(fullRessource["services"])
				{
					let additionalServiceTypes = Object.keys(fullRessource["services"]);

					// SET ADDITIONAL TYPES BEHIND RECCOURCE
					fullRessource["types"] = fullRessource["types"].concat(additionalServiceTypes);
				}

				// RESOURCE HAS GROUPED SERVICES?
				if(fullRessource["grouped_services"])
				{
					for (var g = fullRessource["grouped_services"].length - 1; g >= 0; g--)
					{
						const groupedService = fullRessource["grouped_services"][g];
						const groupedServiceID = groupedService["rid"];

						if(!processedRessources["_groupsOf"][groupedServiceID]) { processedRessources["_groupsOf"][groupedServiceID] = []; }
						processedRessources["_groupsOf"][groupedServiceID].push(fullRessource.id);
					}
				}

				// GIVE FULL RESSOURCE BACK TO COLLECTION
				processedRessources[fullRessource.id] = fullRessource;
			});

			resolve(processedRessources);
		});
	}
}

// EXPORT
module.exports = new API;