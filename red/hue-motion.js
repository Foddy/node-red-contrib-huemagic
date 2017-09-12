module.exports = function(RED)
{
	function HueMotion(config)
	{
		RED.nodes.createNode(this, config);
		var bridge = RED.nodes.getNode(config.bridge);
		let huejay = require('huejay');
		var context = this.context();
		var scope = this;


		//
		// CHECK CONFIG
		if(!config.sensorid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "not configured"});
			return false;
		}

		//
		// INITIALIZE CLIENT
		var motionSensorID = parseInt(config.sensorid);
		let client = new huejay.Client({
			host: (bridge.config.bridge).toString(),
			port: 80,
			username: bridge.config.key
		});

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "no motion"});
		this.recheck = setInterval(function()
		{
			client.sensors.getById(motionSensorID)
			.then(sensor => {
				if(sensor.config.reachable == false)
				{
					scope.status({fill: "red", shape: "ring", text: "not reachable"});
				}
				else if(sensor.config.on == true)
				{
					var presence = context.get('presence') || false;
					if(presence != sensor.state.presence)
					{
						if(sensor.state.presence)
						{
							context.set('presence', true);

							var message = {};
							message.payload = {id: motionSensorID, active: true, motion: true, updated: sensor.state.lastUpdated, battery: sensor.config.battery};
							scope.send(message);

							scope.status({fill: "green", shape: "dot", text: "motion detected"});
						}
						else
						{
							var message = {};
							message.payload = {id: motionSensorID, active: true, motion: false, updated: sensor.state.lastUpdated, battery: sensor.config.battery};
							scope.send(message);

							context.set('presence', false);
							scope.status({fill: "grey", shape: "dot", text: "no motion"});
						}
					}
				}
				else if(sensor.config.on == false)
				{
					scope.status({fill: "red", shape: "ring", text: "deactivated"});
				}
			})
			.catch(error => {
				scope.status({fill: "red", shape: "ring", text: "connection error"});
				clearInterval(scope.recheck);
			});
		}, parseInt(bridge.config.interval));


		//
		// DISABLE / ENABLE SENSOR
		this.on('input', function(msg)
		{
			if(msg.payload == true || msg.payload == false)
			{
				client.sensors.getById(motionSensorID)
				.then(sensor => {
					sensor.config.on = msg.payload;
					return client.sensors.save(sensor);
				})
				.then(sensor => {
					var notify = {};
					notify.payload = {id: motionSensorID, active: msg.payload, motion: false, updated: sensor.state.lastUpdated, battery: sensor.config.battery};
					scope.send(notify);

					if(msg.payload == false)
					{
						scope.status({fill: "red", shape: "ring", text: "deactivated"});
					}
					else
					{
						scope.status({fill: "grey", shape: "dot", text: "no motion"});
					}
				})
				.catch(error => {
					var notify = {};
					notify.payload = error;
					scope.send(notify);
				});
			}
		});


		//
		// CLOSE NDOE / REMOVE RECHECK INTERVAL
		this.on('close', function()
		{
			clearInterval(scope.recheck);
		});
	}

	RED.nodes.registerType("hue-motion", HueMotion);
}