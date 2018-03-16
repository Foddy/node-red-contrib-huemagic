module.exports = function(RED)
{
	"use strict";

	function HueBridge(config)
	{
		RED.nodes.createNode(this, config);

		this.config = {
			name: config.name,
			key: config.key,
			bridge: config.bridge,
			interval: config.interval
		};
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
