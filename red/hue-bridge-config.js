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
		this.events = new events.EventEmitter();

		// CREATE NODE
		RED.nodes.createNode(scope, config);

		// DEFINE CLIENT
		let ipHostArray = (config.bridge).toString().split(":");
		this.client = new huejay.Client({
			host: ipHostArray[0],
			port: (ipHostArray > 1) ? parseInt(ipHostArray[1]) : 80,
			username: config.key
		});

		// RECHECK DEVICES
		this.recheck = function()
		{
			Promise.all([
				scope.client.lights.getAll(),
				scope.client.sensors.getAll(),
				scope.client.groups.getAll()
			])
			.then(results => {
				let lights = results[0];
				let sensors = results[1];
				let groups = results[2];

				// GET UPDATES
				let lightUpdates = scope.getUpdates("light", lights);
				let sensorUpdates = scope.getUpdates("sensor", sensors);
				let groupUpdates = scope.getUpdates("group", groups);

				// RETURN UPDATES
				return [lightUpdates, sensorUpdates, groupUpdates];
			})
			.then(updates => {
				// EMIT UPDATES
				scope.emitUpdates("light", updates[0]);
				scope.emitUpdates("sensor", updates[1]);
				scope.emitUpdates("group", updates[2]);

				// RECHECK
				if(scope.nodeActive == true) { setTimeout(function(){ scope.recheck(); }, config.interval); }
				return true;
			})
			.catch(error => {
				scope.debug(error.stack);

				if(scope.nodeActive == true)
				{
					setTimeout(function(){ scope.recheck(); }, 500);
				}
			});
		}

		// START FIRST CHECK
		this.recheck();

		// DETERMINE UPDATES
		this.getUpdates = function(deviceMode, devices)
		{
			var updates = [];			
			for (var i = devices.length - 1; i >= 0; i--)
			{
				let device = devices[i];
				var updated = false;
				var uniqueStatus = "";

				if(deviceMode == "light")
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
				else if(deviceMode == "sensor")
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
				else if(deviceMode == "group")
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
			for (let deviceUpdate of updates)
			{
				let eventName = device + deviceUpdate.id;
				scope.events.emit(eventName, deviceUpdate);
			}
		}
		
		//
		// CLOSE NDOE / REMOVE RECHECK INTERVAL
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
			return res.status(500).send("Missing Hue Bridge IP…");
	    }
	    else
	    {
		let huejay = require('huejay');

		var bridgeIP = (req.query.ip).toString();
		let client = new huejay.Client({host: bridgeIP, username: 'default'});

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
			return rescope.status(500).send("Missing Hue Bridge IP…");
		}
		else
		{
			var request = require('request');
			let bridgeIP = (req.query.ip).toString();

			request.post('http://'+bridgeIP+'/api', {body: JSON.stringify({"devicetype": "nodered_" + Math.floor((Math.random() * 100) + 1)}) }, function(err,httpResponse,body) {
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
			var motionSensors = [];

			for (let sensor of sensors)
			{
				if(sensor.type == type)
				{
					var motionSensor = {};
					motionSensor.id = sensor.id;
					motionSensor.name = sensor.name;

					motionSensors.push(motionSensor);
				}
			}

			res.end(JSON.stringify(motionSensors));
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
};
