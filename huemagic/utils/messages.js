const dayjs = require('dayjs');
const colorUtils = require("./color");

//
// HUE BRIDGE
class HueBridgeMessage
{
	constructor(ressource, options = {})
	{
		this.message = {};
		this.message.payload = {};
		this.message.payload.id = ressource.bridgeid;
		this.message.payload.name = ressource.name;
		this.message.payload.factoryNew = ressource.factorynew;
		this.message.payload.replacesBridgeId = ressource.replacesbridgeid ? ressource.replacesbridgeid : false;
		this.message.payload.dataStoreVersion = ressource.datastoreversion;
		this.message.payload.starterKitId = ressource.starterkitid.length > 0 ? ressource.starterkitid : false;
		this.message.payload.softwareVersion = ressource.swversion;
		this.message.payload.apiVersion = ressource.apiversion;
		this.message.payload.zigbeeChannel = ressource.zigbeechannel;
		this.message.payload.macAddress = ressource.mac;
		this.message.payload.ipAddress = ressource.ipaddress;
		this.message.payload.dhcpEnabled = ressource.dhcp;
		this.message.payload.netmask = ressource.netmask;
		this.message.payload.gateway = ressource.gateway;
		this.message.payload.proxyAddress = ressource.proxyaddress == "none" ? false : ressource.proxyaddress;
		this.message.payload.proxyPort = ressource.proxyport;
		this.message.payload.utcTime = ressource.UTC;
		this.message.payload.timeZone = ressource.timezone;
		this.message.payload.localTime = ressource.localtime;
		this.message.payload.portalServicesEnabled = ressource.portalservices;
		this.message.payload.portalConnected = ressource.portalconnection;
		this.message.payload.linkButtonEnabled = ressource.linkbutton;
		this.message.payload.touchlinkEnabled = (ressource["touchlink"] && ressource["touchlink"] == true) ? true : false;
		this.message.payload.autoUpdatesEnabled = options["autoupdate"] ? options["autoupdate"] : false;
		this.message.payload.users = []; // NEW!
		this.message.payload.updated = ressource.updated; // NEW!

		this.message.payload.model = {};
		this.message.payload.model.id = ressource.modelid;
		this.message.payload.model.manufacturer = "Philips";
		this.message.payload.model.name = "Hue v2";

		// GET USERS
		for (const [userID, user] of Object.entries(ressource["whitelist"]))
		{
			this.message.payload.users.push({
				user: userID,
				name: user["name"],
				created: user["create date"],
				lastAccess: user["last use date"]
			});
		}
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
	constructor(ressource, options = {})
	{
		const service = Object.values(ressource["services"]["light_level"])[0];
		const connectivity = ressource.services.zigbee_connectivity ? Object.values(ressource.services.zigbee_connectivity)[0] : ((ressource.services.zgp_connectivity) ? Object.values(ressource.services.zgp_connectivity)[0] : false);

		var realLUX = service.light.light_level - 1;
		realLUX = realLUX / 10000;
		realLUX = Math.round(Math.pow(10, realLUX));

		this.message = {};
		this.message.payload = {};
		this.message.payload.active = service.enabled; // NEW!
		this.message.payload.reachable = connectivity ? (connectivity.status === "connected") : "unknown"; // NEW!
		this.message.payload.connectionStatus = connectivity ? connectivity.status : "unknown"; // NEW!
		this.message.payload.lux = realLUX;
		this.message.payload.lightLevel = service.light.light_level;
		this.message.payload.dark = (realLUX < 200);
		this.message.payload.daylight = (realLUX > 200);
		this.message.payload.updated = ressource.updated;

		this.message.info = {};
		this.message.info.id = service.id;
		this.message.info.idV1 = ressource.id_v1 ? ressource.id_v1 : false; // NEW
		this.message.info.uniqueId = ressource.id + "-" + service.id;
		this.message.info.deviceId = ressource.id; // NEW!
		this.message.info.name = ressource.metadata.name;
		this.message.info.type = "light_level";
		this.message.info.softwareVersion = ressource.product_data.software_version;
		this.message.info.battery = Object.values(ressource.services.device_power)[0].power_state.battery_level;
		this.message.info.batteryState = Object.values(ressource.services.device_power)[0].power_state.battery_state; // NEW!

		this.message.info.model = {};
		this.message.info.model.id = ressource.product_data.model_id;
		this.message.info.model.manufacturer = ressource.product_data.manufacturer_name;
		this.message.info.model.name = ressource.product_data.product_name;
		this.message.info.model.type = ressource.product_data.product_archetype;
		this.message.info.model.certified = ressource.product_data.certified; // NEW
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
	constructor(ressource, options = {})
	{
		let service = Object.values(ressource["services"]["grouped_light"])[0];
		service = options.ressources[service.id];

		this.message = {};
		this.message.payload = {};
		this.message.payload.on = service.on.on;
		this.message.payload.updated = ressource.updated;

		this.message.info = {};
		this.message.info.id = ressource.id;
		this.message.info.idV1 = ressource.id_v1 ? ressource.id_v1 : false; // NEW
		this.message.info.name = ressource.metadata ? ressource.metadata.name : "all";
		this.message.info.type = "group";
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
	constructor(ressource, options = {})
	{
		const service = Object.values(ressource["services"]["light"])[0];
		const connectivity = ressource.services.zigbee_connectivity ? Object.values(ressource.services.zigbee_connectivity)[0] : ((ressource.services.zgp_connectivity) ? Object.values(ressource.services.zgp_connectivity)[0] : false);

		this.message = {};
		this.message.payload = {};
		this.message.payload.on = service.on.on;
		this.message.payload.brightness = service.dimming ? service.dimming.brightness : false;
		this.message.payload.brightnessLevel = service.dimming ? Math.round((254/100)*this.message.payload.brightness) : false;
		this.message.payload.reachable = connectivity ? (connectivity.status === "connected") : "unknown";
		this.message.payload.connectionStatus = connectivity ? connectivity.status : "unknown"; // NEW!
		this.message.payload.updated = ressource.updated;

		this.message.info = {};
		this.message.info.id = service.id;
		this.message.info.idV1 = ressource.id_v1 ? ressource.id_v1 : false; // NEW
		this.message.info.uniqueId = ressource.id + "-" + service.id;
		this.message.info.deviceId = ressource.id; // NEW!
		this.message.info.name = service.metadata.name;
		this.message.info.type = "light";
		this.message.info.softwareVersion = ressource.product_data.software_version;

		this.message.info.model = {};
		this.message.info.model.id = ressource.product_data.model_id;
		this.message.info.model.manufacturer = ressource.product_data.manufacturer_name;
		this.message.info.model.name = ressource.product_data.product_name;
		this.message.info.model.type = ressource.product_data.product_archetype;
		this.message.info.model.certified = ressource.product_data.certified; // NEW
		this.message.info.model.friendsOfHue = true;

		// HAS COLOR CAPABILITIES?
		if(service["color"])
		{
			let RGB = colorUtils.xyBriToRgb(service.color.xy.x, service.color.xy.y, (service.dimming ? service.dimming.brightness : 100));
			this.message.payload.rgb = [RGB.r, RGB.g, RGB.b];
			this.message.payload.hex = colorUtils.rgbHex(RGB.r, RGB.g, RGB.b);
			this.message.payload.xyColor = service.color.xy; // NEW!

			if(options.colornames == true)
			{
				var cNamesArray = colorUtils.colornamer(colorUtils.rgbHex(RGB.r, RGB.g, RGB.b));
				this.message.payload.color = cNamesArray.basic[0]["name"];
			}

			this.message.info.model.colorGamut = service.color.gamut; // NEW
			this.message.info.model.colorGamutType = service.color.gamut_type; // NEW
		}

		// HAS COLOR TEMPERATURE CAPABILITIES?
		if(service["color_temperature"])
		{
			this.message.payload.colorTemp = service.color_temperature.mirek ? service.color_temperature.mirek : false;

			if(!this.message.payload.colorTemp) { this.message.payload.colorTempName = "unknown"; }
			else if(this.message.payload.colorTemp < 200) { this.message.payload.colorTempName = "cold"; } // NEW!
			else if(this.message.payload.colorTemp < 350) { this.message.payload.colorTempName = "normal"; }
			else if(this.message.payload.colorTemp < 410) { this.message.payload.colorTempName = "warm"; }
			else { this.message.payload.colorTempName = "hot"; }
		}

		// HAS GRADIENT COLOR CAPABILITIES?
		if(service["gradient"]) // NEW!
		{
			this.message.payload.gradient = {};
			this.message.payload.gradient.colors = [];

			for(let gradientColor in service["gradient"]["points"])
			{
				let gradientColorRGB = colorUtils.xyBriToRgb(gradientColor.color.xy.x, gradientColor.color.xy.y, (gradientColor.dimming ? service.dimming.brightness : 100));

				let oneColorPack = {};
				oneColorPack.rgb = [gradientColorRGB.r, gradientColorRGB.g, gradientColorRGB.b];
				oneColorPack.hex = colorUtils.rgbHex(gradientColorRGB.r, gradientColorRGB.g, gradientColorRGB.b);
				oneColorPack.xyColor = gradientColor.color.xy.x;

				this.message.payload.gradient.colors.push(oneColorPack);
			}

			this.message.payload.gradient.numColors = service["gradient"]["points"] ? service["gradient"]["points"].length : 0;
			this.message.payload.gradient.totalColors = service["gradient"]["points_capable"];
		}
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
	constructor(ressource, options = {})
	{
		const service = Object.values(ressource["services"]["motion"])[0];
		const connectivity = ressource.services.zigbee_connectivity ? Object.values(ressource.services.zigbee_connectivity)[0] : ((ressource.services.zgp_connectivity) ? Object.values(ressource.services.zgp_connectivity)[0] : false);

		this.message = {};
		this.message.payload = {
			active: service.enabled,
			reachable: connectivity ? (connectivity.status === "connected") : "unknown",
			connectionStatus: connectivity ? connectivity.status : "unknown", // NEW!
			motion: (service.motion.motion && service.motion.motion_valid),
			updated: ressource.updated
		};

		this.message.info = {};
		this.message.info.id = service.id;
		this.message.info.idV1 = ressource.id_v1 ? ressource.id_v1 : false; // NEW
		this.message.info.uniqueId = ressource.id + "-" + service.id;
		this.message.info.deviceId = ressource.id; // NEW!
		this.message.info.name = ressource.metadata.name;
		this.message.info.type = "motion";
		this.message.info.softwareVersion = ressource.product_data.software_version;
		this.message.info.battery = Object.values(ressource.services.device_power)[0].power_state.battery_level;
		this.message.info.batteryState = Object.values(ressource.services.device_power)[0].power_state.battery_state; // NEW!

		this.message.info.model = {};
		this.message.info.model.id = ressource.product_data.model_id;
		this.message.info.model.manufacturer = ressource.product_data.manufacturer_name;
		this.message.info.model.name = ressource.product_data.product_name;
		this.message.info.model.type = ressource.product_data.product_archetype;
		this.message.info.model.certified = ressource.product_data.certified; // NEW
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
	constructor(ressource, options = {})
	{
		this.message = {};
		this.message.payload = {};
		this.message.payload.enabled = (ressource["status"] == "enabled"); // NEW!
		this.message.payload.triggered = (ressource["lasttriggered"] != null) ? dayjs(ressource["lasttriggered"]).format() : false;

		this.message.info = {};
		this.message.info.id = ressource["id"];
		this.message.info.created = dayjs(ressource["created"]).format();
		this.message.info.name = ressource["name"];
		this.message.info.timesTriggered = ressource["timestriggered"];
		this.message.info.owner = ressource["_owner"];
		this.message.info.status = ressource["status"];

		this.message.conditions = ressource["conditions"];
		this.message.actions = ressource["actions"];
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE BUTTONS
class HueButtonsMessage
{
	constructor(ressource, options = {})
	{
		const connectivity = ressource.services.zigbee_connectivity ? Object.values(ressource.services.zigbee_connectivity)[0] : ((ressource.services.zgp_connectivity) ? Object.values(ressource.services.zgp_connectivity)[0] : false);

		// FIND PRESSED BUTTON
		var pressedButton = false;
		const allButtons = Object.values(ressource.services.button);

		for (var i = allButtons.length - 1; i >= 0; i--)
		{
			if(allButtons[i]["button"])
			{
				pressedButton = allButtons[i];
				break;
			}
		}

		this.message = {};
		this.message.payload = {
			reachable: connectivity ? (connectivity.status === "connected") : "unknown", // NEW!
			connectionStatus: connectivity ? connectivity.status : "unknown", // NEW!
			button: pressedButton ? pressedButton.metadata.control_id : false, // NEW
			action: pressedButton ? pressedButton.button.last_event : false, // NEW
			updated: ressource.updated
		};

		this.message.info = {};
		this.message.info.id = pressedButton ? pressedButton.id : ressource.id;
		this.message.info.idV1 = ressource.id_v1 ? ressource.id_v1 : false; // NEW
		this.message.info.uniqueId = ressource.id + "-" + (pressedButton ? pressedButton.id : "");
		this.message.info.deviceId = ressource.id; // NEW!
		this.message.info.name = ressource.metadata.name;
		this.message.info.type = "button";
		this.message.info.softwareVersion = ressource.product_data.software_version;
		this.message.info.battery = Object.values(ressource.services.device_power)[0].power_state.battery_level;
		this.message.info.batteryState = Object.values(ressource.services.device_power)[0].power_state.battery_state; // NEW!

		this.message.info.model = {};
		this.message.info.model.id = ressource.product_data.model_id;
		this.message.info.model.manufacturer = ressource.product_data.manufacturer_name;
		this.message.info.model.name = ressource.product_data.product_name;
		this.message.info.model.type = ressource.product_data.product_archetype;
		this.message.info.model.certified = ressource.product_data.certified; // NEW
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
	constructor(ressource, options = {})
	{
		const service = Object.values(ressource["services"]["temperature"])[0];
		const connectivity = ressource.services.zigbee_connectivity ? Object.values(ressource.services.zigbee_connectivity)[0] : ((ressource.services.zgp_connectivity) ? Object.values(ressource.services.zgp_connectivity)[0] : false);

		var deviceValue = service.temperature.temperature;
		var celsius = Math.round(deviceValue * 100) / 100;
		var fahrenheit = Math.round(((celsius * 1.8)+32) * 100) / 100;

		// TEMPERATURE MESSAGE
		let temperatureMessage = "comfortable";

		if(celsius < 0) {
			temperatureMessage = "very cold";
		}
		else if(celsius < 11) {
			temperatureMessage = "cold";
		}
		else if(celsius < 16) {
			temperatureMessage = "slightly cold";
		}
		else if(celsius < 22) {
			temperatureMessage = "comfortable";
		}
		else if(celsius < 27) {
			temperatureMessage = "slightly warm";
		}
		else if(celsius < 33) {
			temperatureMessage = "warm";
		}
		else if(celsius < 39) {
			temperatureMessage = "hot";
		}
		else {
			temperatureMessage = "very hot";
		}

		this.message = {};
		this.message.payload = {
			active: service.enabled, // NEW!
			reachable: connectivity ? (connectivity.status === "connected") : "unknown", // NEW!
			connectionStatus: connectivity ? connectivity.status : "unknown", // NEW!
			celsius: celsius,
			fahrenheit: fahrenheit,
			temperatureIs: temperatureMessage,
			deviceValue: deviceValue,
			updated: ressource.updated
		};

		this.message.info = {};
		this.message.info.id = service.id;
		this.message.info.idV1 = ressource.id_v1 ? ressource.id_v1 : false; // NEW
		this.message.info.uniqueId = ressource.id + "-" + service.id;
		this.message.info.deviceId = ressource.id; // NEW!
		this.message.info.name = ressource.metadata.name;
		this.message.info.type = "temperature";
		this.message.info.softwareVersion = ressource.product_data.software_version;
		this.message.info.battery = Object.values(ressource.services.device_power)[0].power_state.battery_level;
		this.message.info.batteryState = Object.values(ressource.services.device_power)[0].power_state.battery_state; // NEW!

		this.message.info.model = {};
		this.message.info.model.id = ressource.product_data.model_id;
		this.message.info.model.manufacturer = ressource.product_data.manufacturer_name;
		this.message.info.model.name = ressource.product_data.product_name;
		this.message.info.model.type = ressource.product_data.product_archetype;
		this.message.info.model.certified = ressource.product_data.certified; // NEW
	}

	get msg()
	{
		return this.message;
	}
}

//
// EXPORT
module.exports = { HueBridgeMessage, HueBrightnessMessage, HueGroupMessage, HueLightMessage, HueMotionMessage, HueRulesMessage, HueButtonsMessage, HueTemperatureMessage }

