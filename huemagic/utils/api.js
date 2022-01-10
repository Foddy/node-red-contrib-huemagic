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
	this.request = function({ method = 'GET', resource = null, data = null, version = 2 })
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

			// HAS RESOURCE? -> APPEND
			if(resource !== null)
			{
				if(version === 2)
				{
					resource = (resource !== "all") ? "/"+resource : "";
					request['url'] += "/clip/v2/resource" + resource;
				}
				else if(version === 1)
				{
					request['url'] += "/api/" + scope.accessKey + resource;
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
	// GET FULL/ROOT RESOURCE
	this.fullResource = function(resource, allResources = {})
	{
		const scope = this;
		var fullResource = Object.assign({}, resource);

		if(resource["owner"])
		{
			fullResource = scope.fullResource(allResources[fullResource["owner"]["rid"]], allResources);
		}
		else if(resource["type"] === "device" || resource["type"] === "room" || resource["type"] === "zone" || resource["type"] === "bridge_home")
		{
			// RESOLVE SERVICES
			var allServices = {};

			for (var i = resource["services"].length - 1; i >= 0; i--)
			{
				const targetService = resource["services"][i];
				const targetType = targetService["rtype"];
				const targetID = targetService["rid"];

				if(!allServices[targetType]) { allServices[targetType] = {}; }
				allServices[targetType][targetID] = Object.assign({}, allResources[targetID]);
			}

			// REPLACE SERVICES
			fullResource["services"] = allServices;
		}

		return fullResource;
	}

	//
	// PROCESS RESOURCES
	this.processResources = function(resources)
	{
		const scope = this;

		// SET CURRENT DATE/TIME
		const currentDateTime = dayjs().format();

		// ACTION!
		return new Promise(function(resolve, reject)
		{
			let resourceList = {};
			let processedResources = {
				_groupsOf: {}
			};

			// CREATE ID BASED OBJECT OF ALL RESOURCES
			resources.forEach(function(resource, index)
			{
				// IS BUTTON? -> REMOVE PREVIOUS STATE
				if(resource.type === "button")
				{
					delete resource["button"];
				}

				resourceList[resource.id] = resource;
			});

			// GET FULL RESOURCES OF EACH OBJECT
			resources.forEach(function(resource, index)
			{
				// GET FULL RESOURCE
				let fullResource = scope.fullResource(resource, resourceList);

				// ADD CURRENT DATE/TIME
				fullResource["updated"] = currentDateTime;

				// ALL ALL TYPES BEHIND RESOURCE
				fullResource["types"] = [ fullResource["type"] ];

				// RESOURCE HAS SERVICES?
				if(fullResource["services"])
				{
					let additionalServiceTypes = Object.keys(fullResource["services"]);

					// SET ADDITIONAL TYPES BEHIND RECCOURCE
					fullResource["types"] = fullResource["types"].concat(additionalServiceTypes);
				}

				// RESOURCE HAS GROUPED SERVICES?
				if(fullResource["grouped_services"])
				{
					for (var g = fullResource["grouped_services"].length - 1; g >= 0; g--)
					{
						const groupedService = fullResource["grouped_services"][g];
						const groupedServiceID = groupedService["rid"];

						if(!processedResources["_groupsOf"][groupedServiceID]) { processedResources["_groupsOf"][groupedServiceID] = []; }
						processedResources["_groupsOf"][groupedServiceID].push(fullResource.id);
					}
				}

				// GIVE FULL RESOURCE BACK TO COLLECTION
				processedResources[fullResource.id] = fullResource;
			});

			resolve(processedResources);
		});
	}
}

// EXPORT
module.exports = new API;