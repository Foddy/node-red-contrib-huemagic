module.exports = function(RED)
{
	"use strict";

	function HueBridge(config)
	{
		var scope = this;
		var events = require('events');
		let huejay = require('huejay');

		// INTERVAL AND EVENT EMITTER
		this.nodeActive = true;
		this.lights = [];
		this.sensors = [];
		this.groups = [];
		this.rules = [];
		this.events = new events.EventEmitter();

		// CREATE NODE
		RED.nodes.createNode(scope, config);

		// DEFINE CLIENT
		let ipHostArray = (config.bridge).toString().trim().split(":");
		this.client = new huejay.Client({
			host: ipHostArray[0],
			port: (ipHostArray > 1) ? parseInt(ipHostArray[1]) : 80,
			username: config.key
		});

		// DELAY
		this.delay = function(ms)
		{
			return new Promise(resolve => setTimeout(resolve, ms));
		}

		// RECHECK DEVICES
		this.recheckAll = function()
		{
			scope.client.sensors.getAll().then(sensors => {
				let sensorUpdates = scope.getUpdates("sensor", sensors);
				scope.emitUpdates("sensor", sensorUpdates);

				return true;
			})
			scope.delay(500).then(() => { return "next"; })
			scope.client.lights.getAll().then(lights => {
				let lightUpdates = scope.getUpdates("light", lights);
				scope.emitUpdates("light", lightUpdates);

				return true;
			})
			scope.delay(500).then(() => { return "next"; })
			scope.client.groups.getAll().then(groups => {
				let groupUpdates = scope.getUpdates("group", groups);
				scope.emitUpdates("group", groupUpdates);

				return true;
			})
			scope.delay(500).then(() => { return "next"; })
			scope.client.rules.getAll().then(rules => {
				let ruleUpdates = scope.getUpdates("rule", rules);
				scope.emitUpdates("rule", ruleUpdates);

				return true;
			})
			.then(proceed => {
				// RECHECK
				if(scope.nodeActive == true && proceed == true) { setTimeout(function(){ scope.recheckAll(); }, config.interval); }
				return true;
			})
			.catch(error => {
				scope.debug(error.stack);

				if(scope.nodeActive == true)
				{
					setTimeout(function(){ scope.recheckAll(); }, 5000);
				}
			});
		}

		// RECHECK ONLY SENSORS
		this.recheckSensors = function()
		{
			scope.client.sensors.getAll().then(sensors => {
				let sensorUpdates = scope.getUpdates("sensor", sensors);
				scope.emitUpdates("sensor", sensorUpdates);

				return true;
			})
			.then(proceed => {
				// RECHECK
				if(scope.nodeActive == true && proceed == true) { setTimeout(function(){ scope.recheckSensors(); }, config.interval); }
				return true;
			})
			.catch(error => {
				scope.debug(error.stack);

				if(scope.nodeActive == true)
				{
					setTimeout(function(){ scope.recheckSensors(); }, 5000);
				}
			});
		}

		// START FIRST CHECK
		if(!config.disableupdates)
		{
			this.recheckAll();
		}
		else
		{
			this.recheckSensors();
		}


		// DETERMINE UPDATES
		this.getUpdates = function(mode, content)
		{
			var updates = [];
			for (var i = content.length - 1; i >= 0; i--)
			{
				let device = content[i];
				var updated = false;
				var uniqueStatus = "";

				if(mode == "light")
				{
					uniqueStatus = ((device.on) ? "1" : "0") + device.brightness + device.hue + device.saturation + device.colorTemp + device.reachable;

					if(device.id in this.lights)
					{
						if(this.lights[device.id] != uniqueStatus)
						{
							this.lights[device.id] = uniqueStatus;
							updated = true;
						}
					}
					else
					{
						this.lights[device.id] = uniqueStatus;
						updated = true;
					}
				}
				else if(mode == "sensor")
				{
					uniqueStatus = device.state.lastUpdated;
					if(device.id in this.sensors)
					{
						if(this.sensors[device.id] != uniqueStatus)
						{
							this.sensors[device.id] = uniqueStatus;
							updated = true;
						}
					}
					else
					{
						this.sensors[device.id] = uniqueStatus;
						updated = true;
					}
				}
				else if(mode == "group")
				{
					uniqueStatus = ((device.on) ? "1" : "0") + device.brightness + device.hue + device.saturation + device.colorTemp + ((device.anyOn) ? "1" : "0") + ((device.allOn) ? "1" : "0");
					if(device.id in this.groups)
					{
						if(this.groups[device.id] != uniqueStatus)
						{
							this.groups[device.id] = uniqueStatus;
							updated = true;
						}
					}
					else
					{
						this.groups[device.id] = uniqueStatus;
						updated = true;
					}
				}
				else if(mode == "rule")
				{
					let rule = device;
					uniqueStatus = rule.lastTriggered + rule.status;

					if(rule.id in this.rules)
					{
						if(this.rules[rule.id] != uniqueStatus)
						{
							this.rules[rule.id] = uniqueStatus;
							updated = true;
						}
					}
					else
					{
						this.rules[rule.id] = uniqueStatus;
						updated = true;
					}
				}

				// IS UPDATED?
				if(updated == true)
				{
					updates.push(device);
				}
			}

			// RETURN UPDATES
			return updates;
		}

		// EMIT UPDATES
		this.emitUpdates = function(device, updates)
		{
			for(let deviceUpdate of updates)
			{
				let eventName = device + deviceUpdate.id;
				scope.events.emit(eventName, deviceUpdate);
				scope.events.emit("globalDeviceUpdates", {type: device, payload: deviceUpdate});
			}
		}

		//
		// CLOSE NODE / REMOVE EVENT LISTENER
		this.on('close', function()
		{
			scope.nodeActive = false;
		});
	}

	RED.nodes.registerType("hue-bridge", HueBridge);

	//
	// DISCOVER HUE BRIDGES ON LOCAL NETWORK
	RED.httpAdmin.get('/hue/bridges', function(req, res, next)
	{
		let huejay = require('huejay');

		huejay.discover()
		.then(bridges => {
			res.end(JSON.stringify(bridges));
		})
		.catch(error => {
			res.send(500).send(error.message);
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
			var huejay = require('huejay');

			var bridgeIP = (req.query.ip).toString();
			var client = new huejay.Client({host: bridgeIP, username: 'default'});

			client.bridge.get()
			.then(bridge => {
				res.end(bridge.name);
			})
			.catch(error => {
				res.send(500).send(error.message);
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
			var request = require('request');
			let bridgeIP = (req.query.ip).toString();

			request.post('http://'+bridgeIP+'/api', {body: JSON.stringify({"devicetype": "nodered_" + Math.floor((Math.random() * 100) + 1)}) }, function(err,httpResponse,body)
			{
				if(err)
				{
					rescope.end("error");
				}
				else
				{
					var bridge = JSON.parse(body);

					if(bridge[0].error)
					{
						rescope.end("error");
					}
					else
					{
						rescope.end(JSON.stringify(bridge));
					}
				}
			});
		}
	});

	//
	// DISCOVER SENSORS
	RED.httpAdmin.get('/hue/sensors', function(req, res, next)
	{
		let huejay = require('huejay');
		var bridge = (req.query.bridge).toString();
		var username = req.query.key;
		var type = req.query.type;

		let client = new huejay.Client({
			host: bridge,
			username: username
		});

		client.sensors.getAll()
		.then(sensors => {
			var allSensorDevices = [];

			for (let sensor of sensors)
			{
				if(sensor.type == type)
				{
					var oneSensor = {};
					oneSensor.id = sensor.id;
					oneSensor.name = sensor.name;
					oneSensor.model = sensor.model.name;

					allSensorDevices.push(oneSensor);
				}
			}

			res.end(JSON.stringify(allSensorDevices));
		})
		.catch(error => {
			res.send(500).send(error.stack);
		});
	});

	//
	// DISCOVER LIGHTS
	RED.httpAdmin.get('/hue/lights', function(req, res, next)
	{
		let huejay = require('huejay');
		var bridge = (req.query.bridge).toString();
		var username = req.query.key;

		let client = new huejay.Client({
			host: bridge,
			username: username
		});

		client.lights.getAll()
		.then(lights => {
			var allLights = [];

			for (let light of lights)
			{
				var oneLightBulb = {};
				oneLightBulb.id = light.id;
				oneLightBulb.name = light.name;

				allLights.push(oneLightBulb);
			}

			res.end(JSON.stringify(allLights));
		})
		.catch(error => {
			res.send(500).send(error.stack);
		});
	});

	//
	// DISCOVER GROUPS
	RED.httpAdmin.get('/hue/groups', function(req, res, next)
	{
		let huejay = require('huejay');
		var bridge = (req.query.bridge).toString();
		var username = req.query.key;

		let client = new huejay.Client({
			host: bridge,
			username: username
		});

		client.groups.getAll()
		.then(groups => {
			var allGroups = [];

			for (let group of groups)
			{
				var oneGroup = {};
				oneGroup.id = group.id;
				oneGroup.name = group.name;

				allGroups.push(oneGroup);
			}

			res.end(JSON.stringify(allGroups));
		})
		.catch(error => {
			res.send(500).send(error.stack);
		});
	});

	//
	// DISCOVER SCENES
	RED.httpAdmin.get('/hue/scenes', function(req, res, next)
	{
		let huejay = require('huejay');
		var bridge = (req.query.bridge).toString();
		var username = req.query.key;

		let client = new huejay.Client({
			host: bridge,
			username: username
		});

		client.scenes.getAll()
		.then(scenes => {
			var allScenes = [];

			for (let scene of scenes)
			{
				var oneScene = {};
				oneScene.id = scene.id;
				oneScene.name = scene.name;

				allScenes.push(oneScene);
			}

			res.end(JSON.stringify(allScenes));
		})
		.catch(error => {
			res.send(500).send(error.stack);
		});
	});

	//
	// DISCOVER RULES
	RED.httpAdmin.get('/hue/rules', function(req, res, next)
	{
		let huejay = require('huejay');
		var bridge = (req.query.bridge).toString();
		var username = req.query.key;

		let client = new huejay.Client({
			host: bridge,
			username: username
		});

		client.rules.getAll()
		.then(rules => {
			var allRules = [];

			for (let rule of rules)
			{
				var oneRule = {};
				oneRule.id = rule.id;
				oneRule.name = rule.name;

				allRules.push(oneRule);
			}

			res.end(JSON.stringify(allRules));
		})
		.catch(error => {
			res.send(500).send(error.stack);
		});
	});
};
