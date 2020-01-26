let moment = require('moment');
let rgb = require('./rgb');
let rgbHex = require('rgb-hex');
let hexRGB = require('hex-rgb');
let colornames = require("colornames");
let colornamer = require('color-namer');


//
// HUE BRIDGE
class HueBridgeMessage
{
	constructor(bridgeInformation, config)
	{
		this.message = {};
		this.message.payload = {};
		this.message.payload.id = bridgeInformation.id;
		this.message.payload.name = bridgeInformation.name;
		this.message.payload.factoryNew = bridgeInformation.factoryNew;
		this.message.payload.replacesBridgeId = bridgeInformation.replacesBridgeId;
		this.message.payload.dataStoreVersion = bridgeInformation.dataStoreVersion;
		this.message.payload.starterKitId = bridgeInformation.starterKitId;
		this.message.payload.softwareVersion = bridgeInformation.softwareVersion;
		this.message.payload.apiVersion = bridgeInformation.apiVersion;
		this.message.payload.zigbeeChannel = bridgeInformation.zigbeeChannel;
		this.message.payload.macAddress = bridgeInformation.macAddress;
		this.message.payload.ipAddress = bridgeInformation.ipAddress;
		this.message.payload.dhcpEnabled = bridgeInformation.dhcpEnabled;
		this.message.payload.netmask = bridgeInformation.netmask;
		this.message.payload.gateway = bridgeInformation.gateway;
		this.message.payload.proxyAddress = bridgeInformation.proxyAddress;
		this.message.payload.proxyPort = bridgeInformation.proxyPort;
		this.message.payload.utcTime = bridgeInformation.utcTime;
		this.message.payload.timeZone = bridgeInformation.timeZone;
		this.message.payload.localTime = bridgeInformation.localTime;
		this.message.payload.portalServicesEnabled = bridgeInformation.portalServicesEnabled;
		this.message.payload.portalConnected = bridgeInformation.portalConnected;
		this.message.payload.linkButtonEnabled = bridgeInformation.linkButtonEnabled;
		this.message.payload.touchlinkEnabled = bridgeInformation.touchlinkEnabled;
		this.message.payload.autoUpdatesEnabled = config.autoupdates;

		this.message.payload.model = {};
		this.message.payload.model.id = bridgeInformation.model.id;
		this.message.payload.model.manufacturer = bridgeInformation.model.manufacturer;
		this.message.payload.model.name = bridgeInformation.model.name;
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE BRIGHTNESS
class HueBrightnessMessage
{
	constructor(sensor)
	{
		var realLUX = sensor.state.lightLevel - 1;
		realLUX = realLUX / 10000;
		realLUX = Math.round(Math.pow(10, realLUX));

		this.message = {};
		this.message.payload = {};
		this.message.payload.lux = realLUX;
		this.message.payload.lightLevel = sensor.state.lightLevel;
		this.message.payload.dark = sensor.state.dark;
		this.message.payload.daylight = sensor.state.daylight;
		this.message.payload.updated = moment.utc(sensor.state.lastUpdated).local().format();

		this.message.info = {};
		this.message.info.id = sensor.id;
		this.message.info.uniqueId = sensor.uniqueId;
		this.message.info.name = sensor.name;
		this.message.info.type = sensor.type;
		this.message.info.softwareVersion = sensor.softwareVersion;
		this.message.info.battery = sensor.config.battery;

		this.message.info.model = {};
		this.message.info.model.id = sensor.model.id;
		this.message.info.model.manufacturer = sensor.model.manufacturer;
		this.message.info.model.name = sensor.model.name;
		this.message.info.model.type = sensor.model.type;
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE GROUP
class HueGroupMessage
{
	constructor(group, config)
	{
		this.message = {};
		this.message.payload = {};
		this.message.payload.on = group.on;
		this.message.payload.allOn = group.allOn;
		this.message.payload.anyOn = group.anyOn;
		this.message.payload.brightness = Math.round((100/254)*group.brightness);
		this.message.payload.brightnessLevel = group.brightness;

		this.message.info = {};
		this.message.info.id = group.id;
		this.message.info.lightIds = group.lightIds.join(', ');
		this.message.info.name = group.name;
		this.message.info.type = group.type;
		this.message.info.class = group.class;

		if(group.modelId !== undefined)
		{
			this.message.info.model = {};
			this.message.info.model.id = group.model.id;
			this.message.info.model.uniqueId = group.uniqueId;
			this.message.info.model.manufacturer = group.model.manufacturer;
			this.message.info.model.name = group.model.name;
			this.message.info.model.type = group.model.type;
		}

		if(group.xy)
		{
			var rgbColor = rgb.convertXYtoRGB(group.xy[0], group.xy[1], group.brightness);

			this.message.payload.rgb = rgbColor;
			this.message.payload.hex = rgbHex(rgbColor[0], rgbColor[1], rgbColor[2]);

			if(config.colornamer == true)
			{
				var cNamesArray = colornamer(rgbHex(rgbColor[0], rgbColor[1], rgbColor[2]));
				this.message.payload.color = cNamesArray.basic[0]["name"];
			}
		}

		if(group.colorTemp)
		{
			this.message.payload.colorTemp = group.colorTemp;
		}

		this.message.payload.updated = moment().format();
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE LIGHT
class HueLightMessage
{
	constructor(light, config)
	{
		this.message = {};
		this.message.payload = {};
		this.message.payload.on = light.on;
		this.message.payload.brightness = (light.brightness) ? Math.round((100/254)*light.brightness) : -1;
		this.message.payload.brightnessLevel = light.brightness;
		this.message.payload.reachable = light.reachable;

		this.message.info = {};
		this.message.info.id = light.id;
		this.message.info.uniqueId = light.uniqueId;
		this.message.info.name = light.name;
		this.message.info.type = light.type;
		this.message.info.softwareVersion = light.softwareVersion;

		this.message.info.model = {};;
		this.message.info.model.id = light.model.id;
		this.message.info.model.manufacturer = light.model.manufacturer;
		this.message.info.model.name = light.model.name;
		this.message.info.model.type = light.model.type;
		this.message.info.model.colorGamut = light.model.colorGamut;
		this.message.info.model.friendsOfHue = light.model.friendsOfHue;

		if(light.xy)
		{
			var rgbColor = rgb.convertXYtoRGB(light.xy[0], light.xy[1], light.brightness);

			this.message.payload.rgb = rgbColor;
			this.message.payload.hex = rgbHex(rgbColor[0], rgbColor[1], rgbColor[2]);

			if(config.colornamer == true)
			{
				var cNamesArray = colornamer(rgbHex(rgbColor[0], rgbColor[1], rgbColor[2]));
				this.message.payload.color = cNamesArray.basic[0]["name"];
			}
		}

		if(light.colorTemp)
		{
			this.message.payload.colorTemp = light.colorTemp;
		}

		this.message.payload.updated = moment().format();
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE MOTION
class HueMotionMessage
{
	constructor(sensor, active = true)
	{
		this.message = {};
		this.message.payload = {active: active, motion: (sensor.state.presence) ? true : false, updated: moment.utc(sensor.state.lastUpdated).local().format()};

		this.message.info = {};
		this.message.info.id = sensor.id;
		this.message.info.uniqueId = sensor.uniqueId;
		this.message.info.name = sensor.name;
		this.message.info.type = sensor.type;
		this.message.info.softwareVersion = sensor.softwareVersion;
		this.message.info.battery = sensor.config.battery;

		this.message.info.model = {};
		this.message.info.model.id = sensor.model.id;
		this.message.info.model.manufacturer = sensor.model.manufacturer;
		this.message.info.model.name = sensor.model.name;
		this.message.info.model.type = sensor.model.type;
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE RULES
class HueRulesMessage
{
	constructor(rule)
	{
		this.message = {};
		this.message.payload = {};
		this.message.payload.triggered = (rule.lastTriggered != null) ? moment.utc(rule.lastTriggered).local().format() : false;

		this.message.info = {};
		this.message.info.id = rule.id;
		this.message.info.created = moment.utc(rule.created).local().format();
		this.message.info.name = rule.name;
		this.message.info.timesTriggered = rule.timesTriggered;
		this.message.info.owner = rule.owner;
		this.message.info.status = rule.status;

		this.message.conditions = [];
		for (let condition of rule.conditions)
		{
			var conditionValues = {};
			conditionValues.address = condition.address;
			conditionValues.operator = condition.operator;
			conditionValues.value = condition.value;

			this.message.conditions.push(conditionValues);
		}

		this.message.actions = [];
		for (let action of rule.actions)
		{
			var actionValues = {};
			actionValues.address = action.address;
			actionValues.method = action.method;
			actionValues.body = action.body;

			this.message.actions.push(actionValues);
		}
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE SCENE
class HueSceneMessage
{
	constructor(scene)
	{
		this.message = {};
		this.message.payload = {};

		this.message.payload.id = scene.id;
		this.message.payload.name = scene.name;
		this.message.payload.lightIds = scene.lightIds.join(', ');
		this.message.payload.owner = scene.owner;
		this.message.payload.appData = scene.appData;
		this.message.payload.lastUpdated = scene.lastUpdated;
		this.message.payload.version = scene.version;
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE SWITCH
class HueSwitchMessage
{
	constructor(sensor)
	{
		// DEFINE HUMAN READABLE BUTTON NAME
		var buttonName = "";
		if(sensor.state.buttonEvent < 2000)
		{
			buttonName = "On";
		}
		else if(sensor.state.buttonEvent < 3000)
		{
			buttonName = "Dim Up";
		}
		else if(sensor.state.buttonEvent < 4000)
		{
			buttonName = "Dim Down";
		}
		else
		{
			buttonName = "Off";
		}

		// DEFINE HUMAN READABLE BUTTON ACTION
		var buttonAction = "";
		var buttonActionRaw = parseInt(sensor.state.buttonEvent.toString().substring(3));

		if(buttonActionRaw == 0)
		{
			buttonAction = "pressed";
		}
		else if(buttonActionRaw == 1)
		{
			buttonAction = "holded";
		}
		else if(buttonActionRaw == 2)
		{
			buttonAction = "short released";
		}
		else
		{
			buttonAction = "long released";
		}

		this.message = {};
		this.message.payload = {};
		this.message.payload.button = sensor.state.buttonEvent;
		this.message.payload.name = buttonName;
		this.message.payload.action = buttonAction;
		this.message.payload.updated = moment.utc(sensor.state.lastUpdated).local().format();

		this.message.info = {};
		this.message.info.id = sensor.id;
		this.message.info.uniqueId = sensor.uniqueId;
		this.message.info.name = sensor.name;
		this.message.info.type = sensor.type;
		this.message.info.softwareVersion = sensor.softwareVersion;
		this.message.info.battery = sensor.config.battery;

		this.message.info.model = {};
		this.message.info.model.id = sensor.model.id;
		this.message.info.model.manufacturer = sensor.model.manufacturer;
		this.message.info.model.name = sensor.model.name;
		this.message.info.model.type = sensor.model.type;
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE TAP
class HueTapMessage
{
	constructor(sensor)
	{
		var buttonNum = 0;
		if(sensor.state.buttonEvent == 34)
		{
			buttonNum = 1;
		}
		else if(sensor.state.buttonEvent == 16)
		{
			buttonNum = 2;
		}
		else if(sensor.state.buttonEvent == 17)
		{
			buttonNum = 3;
		}
		else if(sensor.state.buttonEvent == 18)
		{
			buttonNum = 4;
		}

		this.message = {};
		this.message.payload = {button: buttonNum, buttonAlt: sensor.state.buttonEvent, updated: moment.utc(sensor.state.lastUpdated).local().format()};

		this.message.info = {};
		this.message.info.id = sensor.id;
		this.message.info.uniqueId = sensor.uniqueId;
		this.message.info.name = sensor.name;
		this.message.info.type = sensor.type;

		this.message.info.model = {};
		this.message.info.model.id = sensor.model.id;
		this.message.info.model.manufacturer = sensor.model.manufacturer;
		this.message.info.model.name = sensor.model.name;
		this.message.info.model.type = sensor.model.type;
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE TEMPERATURE
class HueTemperatureMessage
{
	constructor(sensor)
	{
		var celsius = Math.round(sensor.state.temperature * 100) / 100;
		var fahrenheit = Math.round(((celsius * 1.8)+32) * 100) / 100;

		this.message = {};
		this.message.payload = {celsius: celsius, fahrenheit: fahrenheit, updated: moment.utc(sensor.state.lastUpdated).local().format()};

		this.message.info = {};
		this.message.info.id = sensor.id;
		this.message.info.uniqueId = sensor.uniqueId;
		this.message.info.name = sensor.name;
		this.message.info.type = sensor.type;
		this.message.info.softwareVersion = sensor.softwareVersion;
		this.message.info.battery = sensor.config.battery;

		this.message.info.model = {};
		this.message.info.model.id = sensor.model.id;
		this.message.info.model.manufacturer = sensor.model.manufacturer;
		this.message.info.model.name = sensor.model.name;
		this.message.info.model.type = sensor.model.type;
	}

	get msg()
	{
		return this.message;
	}
}

//
// EXPORT
module.exports = { HueBridgeMessage, HueBrightnessMessage, HueGroupMessage, HueLightMessage, HueMotionMessage, HueRulesMessage, HueSceneMessage, HueSwitchMessage, HueTapMessage, HueTemperatureMessage }

