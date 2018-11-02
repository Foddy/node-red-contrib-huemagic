[![Hue Magic Logo](https://cloud.foddys.com/mRlI/HUEMAGIC-LOGO.svg)](https://flows.nodered.org/node/node-red-contrib-huemagic)

# HueMagic - Philips Hue nodes for Node-RED

[![Travis](https://img.shields.io/travis/Foddy/node-red-contrib-huemagic.svg?style=flat-square)](https://github.com/foddy/node-red-contrib-huemagic/) [![Dependencies](https://david-dm.org/foddy/node-red-contrib-huemagic.svg?style=flat-square)](https://david-dm.org/foddy/node-red-contrib-huemagic) [![npm](https://img.shields.io/npm/dt/node-red-contrib-huemagic.svg?style=flat-square)](https://www.npmjs.com/package/node-red-contrib-huemagic) [![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=LUQ7CWBWQ3Q4U) [![npm](https://img.shields.io/npm/v/node-red-contrib-huemagic.svg?style=flat-square)](https://github.com/foddy/node-red-contrib-huemagic/) [![GitHub license](https://img.shields.io/badge/license-Apache%202-blue.svg?style=flat-square)](https://raw.githubusercontent.com/Foddy/node-red-contrib-huemagic/master/LICENSE)

HueMagic provides several input and output nodes for Node-RED and is the most in-depth and easy to use solution to control Philips Hue bridges, lights, groups, scenes, taps, switches, motion sensors, temperature sensors and Lux sensors.

### Features
* Simple and comprehensive control of the Hue Bridge and connected devices
* Automatic discovery of Philips Hue bridges as well as devices, scenes & groups…
* Supports the output and input of multiple color code definitions *(HEX, RGB & human readable color names)*
* Event-based status messages for all devices connected to the Hue Bridge
* Real-time status messages in the NodeRED UI
* Supports virtual pressing of the button on the Hue Bridge (Link Button)
* Programmatic pairing of new devices without app enforcement (TouchLink)
* Automatic firmware updates to the Hue Bridge and connected devices
* Supports activating / deactivating of motion sensors
* Easy to use alarm and colorloop effects on light bulbs and whole groups
* Additive state settings on all nodes with multiple commands

### Installation
HueMagic was written for **Node.js 10+** and Node-RED v0.19.5+. It supports Philips Hue API version v1.19.0+.
_Please make sure, that you deactivate / remove other Philips Hue related NodeRED nodes before installing HueMagic!_

`npm install node-red-contrib-huemagic`

### Available Nodes

- [Hue Bridge](#hue-bridge)
- [Hue Lights](#hue-lights)
- [Hue Groups](#hue-groups)
- [Hue Scenes](#hue-scenes)
- [Hue Taps](#hue-tap)
- [Hue Wireless Dimmer Switches](#hue-switch)
- [Hue Motion Sensors](#hue-motion-sensor)
- [Hue Temperature Sensors](#hue-temperature-sensor)
- [Hue Lux Sensors](#hue-lux-sensor)


## Hue Bridge
The Hue Bridge node keeps the Hue Bridge firmware and connected devices up-to-date and provides more information and setup options for the bridge.

![Hue Bridge Example](https://d3vv6lp55qjaqc.cloudfront.net/items/2l270c161N2A1C2U141n/hue-bridge.png)

### Get settings / status
Retrieves the current status / settings of the bridge by injecting any input value.

| Property | Type |                     Information                     |
|:--------:|:----:|:---------------------------------------------------:|
| **any**  | any  | Triggers an output of the current status / settings |

### Simulate link button press
Use this command to simulate pressing the link button of the Hue Bridge. No need to physically press the button on your bridge for creating users and other actions. Pass the **pressButton** property to **msg.payload**.

|     Property    |             Type             |             Information            |
|:---------------:|:----------------------------:|:----------------------------------:|
| **pressButton** | boolean (any value accepted) | Simulates pressing the link button |

### Enable TouchLink scan
Use TouchLink to pair new devices or old devices after a bridge reset. This is commonly known in the community as "Lamp stealer". Pass the **touchLink** property to **msg.payload**.

|    Property   |             Type             |       Information      |
|:-------------:|:----------------------------:|:----------------------:|
| **touchLink** | boolean (any value accepted) | Pairs lights / devices |

### Hue Bridge Settings
Changes the Hue Bridge settings based on the passed in **msg.payload.settings** values of:

|      Property     |   Type  |                   Information                  |
|:-----------------:|:-------:|:----------------------------------------------:|
| **name**          | string  | Name of the bridge                             |
| **zigbeeChannel** | int     | ZigBee channel (for communicating with lights) |
| **ipAddress**     | string  | IP address                                     |
| **dhcpEnabled**   | boolean | Whether or not DHCP is enabled                 |
| **netmask**       | string  | Netmask                                        |
| **gateway**       | string  | Gateway                                        |
| **proxyAddress**  | string  | Proxy address                                  |
| **proxyPort**     | string  | Proxy port                                     |
| **timeZone**      | string  | Time zone                                      |

### Hue Bridge Events
The event message that the bridge sends contains the following data in the **msg.payload** object:

|          Property         |      Type     |                                                       Information                                                       |
|:-------------------------:|:-------------:|:-----------------------------------------------------------------------------------------------------------------------:|
| **id**                    | string        | Unique ID of the Hue Bridge                                                                                             |
| **name**                  | string        | Name of the bridge                                                                                                      |
| **factoryNew**            | boolean       | Whether or not the bridge is factory new                                                                                |
| **replacesBridgeId**      | string / null | Replaces bridge id (for migrating from old bridges)                                                                     |
| **dataStoreVersion**      | string        | Data store version                                                                                                      |
| **starterKitId**          | string        | Name of the starterkit created in the factory                                                                           |
| **softwareVersion**       | string        | Software version of the bridge                                                                                          |
| **apiVersion**            | string        | API version of the bridge                                                                                               |
| **zigbeeChannel**         | int           | ZigBee channel (for communicating with lights)                                                                          |
| **macAddress**            | string        | MAC address                                                                                                             |
| **ipAddress**             | string        | IP address                                                                                                              |
| **dhcpEnabled**           | boolean       | Whether or not DHCP is enabled                                                                                          |
| **netmask**               | string        | Netmask                                                                                                                 |
| **gateway**               | string        | Gateway                                                                                                                 |
| **proxyAddress**          | string        | Proxy address                                                                                                           |
| **proxyPort**             | string        | Proxy port                                                                                                              |
| **utcTime**               | string        | UTC time of the bridge                                                                                                  |
| **timeZone**              | string        | Time zone                                                                                                               |
| **localTime**             | string        | Local time of the bridge                                                                                                |
| **portalServicesEnabled** | boolean       | Whether or not portal services are enabled                                                                              |
| **portalConnected**       | boolean       | Whether or not portal is connected                                                                                      |
| **linkButtonEnabled**     | boolean       | Whether or not link button is enabled                                                                                   |
| **touchlinkEnabled**      | boolean       | Whether or not TouchLink is enabled                                                                                     |
| **model**                 | object        | The model object of the bridge includes model specific information like the model.id, model.manufacturer and model.name |

## Hue Lights
Use the Hue Light node to control the lights and receive light bulb events.

![Hue Light Example](https://cloud.foddys.com/mY6m/hue-light.png)

### Turn on / off (simple mode)
Changes the light on / off state based on the passed in **msg** values of:

|   Property  |   Type  |                                        Information                                        |
|:-----------:|:-------:|:-----------------------------------------------------------------------------------------:|
| **payload** | boolean | Will turn on or turn off the light with its previous configuration (color and brightness) |

### Turn On / Off (extended mode)
Changes the light state, effect, color, brightness and other states based on the passed in **msg.payload** values of:

|         Property        |        Type        |                                                            Information                                                            |
|:-----------------------:|:------------------:|:---------------------------------------------------------------------------------------------------------------------------------:|
| **on**                  | boolean            | Will turn on or turn off the light with its previous configuration (color and brightness)                                         |
| **brightness**          | int                | Optionally configurable brightness of the light in percent (0-100)                                                                |
| **incrementBrightness** | int                | Increment/decrement brightness by given percentage value                                                                          |
| **rgb**                 | array[int,int,int] | Optionally configurable RGB color value of the light bulb. You don't need to pass the RGB value if you already passed a HEX value |
| **hex**                 | string             | Optionally configurable HEX color value of the light bulb. You don't need to pass the HEX value if you already passed a RGB value |
| **color**               | string             | Optionally configurable human readable color name in english like "red" of the light bulb                                         |
| **transitionTime**      | int                | Optionally configurable temporary value which eases transition of an effect (value in seconds, 0 for instant, 5 for five seconds) |
| **colorloop**           | int                | Optionally configurable color loop effect. Value in seconds (deactivates the effect to the previous state after x seconds)        |
| **colorTemp**           | int                | Optionally configurable color temperature of the light from 153 to 500                                                            |
| **saturation**          | int                | Optionally configurable color saturation of the light in percent (from 0 to 100)                                                  |

### Special Alert Effect
Plays an alert effect based on the passed in **msg.payload** values of:

|  Property |        Type        |                                                                      Information                                                                     |
|:---------:|:------------------:|:----------------------------------------------------------------------------------------------------------------------------------------------------:|
| **alert** | int *(required)*   | Configurable amount of seconds to play the alert effect (max 30). When the alert effect is finished the light bulb will reset to the previous state. |
| **rgb**   | array[int,int,int] | Optionally configurable RGB color value of the alert effect. You don't need to pass the RGB value if you already passed a HEX value                  |
| **hex**   | string             | Optionally configurable HEX color value of the alert effect. You don't need to pass the HEX value if you already passed a RGB value                  |
| **color** | string             | Optionally configurable human readable color name in english like "red" of the alert effect                                                          |


### Light Events
The event message that the light bulb sends contains the following data in the **msg.payload** object. Events will only be sent if the light bulb state is changed.

|    Property    |        Type        |                         Information                        |
|:--------------:|:------------------:|:----------------------------------------------------------:|
| **on**         | boolean            | True for on, false for off                                 |
| **brightness** | int                | Current brightness of the light bulb in percent            |
| **rgb**        | array[int,int,int] | Current RGB color value of the light bulb (if supported)   |
| **hex**        | string             | Current HEX color value of the light bulb (if supported)   |
| **color**      | string             | Current color name of the light bulb (if supported)        |
| **colorTemp**  | int                | Current color temperature of the light bulb (if supported) |
| **updated**    | string             | ISO 8601 date string of the last light state update        |

### Additional Light Bulb Information
The event message that the light bulb sends also contains the following data in the **msg.info** object.

|       Property      |  Type  |                                                                                Information                                                                               |
|:-------------------:|:------:|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| **id**              | int    | Numerical id of the light as registered on the bridge                                                                                                                    |
| **uniqueId**        | string | Unique Id of the light (typically hardware id)                                                                                                                           |
| **name**            | string | Name for the light                                                                                                                                                       |
| **type**            | string | Type of light (e.g. Extended Color Light, Dimmable Light)                                                                                                                |
| **softwareVersion** | float  | Software version of the light                                                                                                                                            |
| **model**           | object | The model object of the light includes model specific information like the model.id, model.manufacturer, model.name, model.type, model.colorGamut and model.friendsOfHue |

### Universal Mode (optional)
Defines the light Id on the Hue Bridge manually if not configured in the node properties (deactivates light update events):

|    Property   | Type |               Information              |
|:-------------:|:----:|:--------------------------------------:|
| **msg.topic** | int  | Manual definition of the light bulb Id |

## Hue Groups
Use the Hue Group node to control whole groups containing lights and receive group events.

![Hue Group Example](https://cloud.foddys.com/mXpj/hue-group.png)

### Turn on / off (simple mode)
Changes the group on / off state based on the passed in **msg** values of:

|   Property  |   Type  |                                                  Information                                                  |
|:-----------:|:-------:|:-------------------------------------------------------------------------------------------------------------:|
| **payload** | boolean | Will turn on or turn off all lights inside the group with their previous configuration (color and brightness) |

### Turn On / Off (extended mode)
Changes the group state, effect, color, brightness and other states based on the passed in **msg.payload** values of:

|         Property        |        Type        |                                                                   Information                                                                  |
|:-----------------------:|:------------------:|:----------------------------------------------------------------------------------------------------------------------------------------------:|
| **on**                  | boolean            | True to turn on all the lights inside the group, false to turn them off                                                                        |
| **brightness**          | int                | Optionally configurable brightness of the lights in percent (0-100)                                                                            |
| **incrementBrightness** | int                | Increment/decrement brightness by given percentage value                                                                                       |
| **rgb**                 | array[int,int,int] | Optionally configurable RGB color value of all lights inside the group. You don't need to pass the RGB value if you already passed a HEX value |
| **hex**                 | string             | Optionally configurable HEX color value of all lights inside the group. You don't need to pass the HEX value if you already passed a RGB value |
| **color**               | string             | Optionally configurable human readable color name in english like "red" of all lights inside the group                                         |
| **transitionTime**      | int                | Optionally configurable temporary value which eases transition of an effect (value in seconds, 0 for instant, 5 for five seconds)              |
| **colorloop**           | int                | Optionally configurable color loop effect. Value in seconds (deactivates the effect to the previous state after x seconds)                     |
| **colorTemp**           | int                | Optionally configurable color temperature of the group lights from 153 to 500                                                                  |
| **saturation**          | int                | Optionally configurable color saturation of the group in percent (from 0 to 100)                                                               |

### Special Alert Effect
Plays an alert effect based on the passed in **msg.payload** values of:

|  Property |        Type        |                                                                             Information                                                                            |
|:---------:|:------------------:|:------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| **alert** | int *(required)*   | Configurable amount of seconds to play the alert effect (max 30). When the alert effect is finished you have to manually reset the lights to their previous state. |
| **rgb**   | array[int,int,int] | Optionally configurable RGB color value of the alert effect. You don't need to pass the RGB value if you already passed a HEX value                                |
| **hex**   | string             | Optionally configurable HEX color value of the alert effect. You don't need to pass the HEX value if you already passed a RGB value                                |
| **color** | string             | Optionally configurable human readable color name in english like "red" of the alert affect on all lights inside the group                                         |

### Group Events
The event message that the group sends contains the following data in the **msg.payload** object. Events will only be sent if the group state is changed.

|    Property    |        Type        |                             Information                             |
|:--------------:|:------------------:|:-------------------------------------------------------------------:|
| **on**         | boolean            | True for on, false for off                                          |
| **allOn**      | boolean            | True if all lights in the group are on, false if not                |
| **anyOn**      | boolean            | True if any lights in the group are on, false if none are on        |
| **brightness** | int                | Current brightness of all lights in the whole group in percent      |
| **rgb**        | array[int,int,int] | Current RGB color value of all lights in the group (if supported)   |
| **hex**        | string             | Current HEX color value of all lights in the group (if supported)   |
| **color**      | string             | Current color name of all lights in the group (if supported)        |
| **colorTemp**  | int                | Current color temperature of all lights in the group (if supported) |
| **updated**    | string             | ISO 8601 date string of the last group state update                 |

### Additional Group Information
The event message that the group sends also contains the following data in the **msg.info** object.

|   Property   |  Type  |                                                                                                                                                                           Information                                                                                                                                                                           |
|:------------:|:------:|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| **id**       | int    | Group Id, generated automatically by the bridge                                                                                                                                                                                                                                                                                                                 |
| **lightIds** | array  | An array of light ids associated with the group                                                                                                                                                                                                                                                                                                                 |
| **name**     | string | Name for the group                                                                                                                                                                                                                                                                                                                                              |
| **type**     | string | Type of group (e.g. LightGroup, Luminaire, LightSource, Room)                                                                                                                                                                                                                                                                                                   |
| **model**    | object | [Huejay](https://github.com/sqmk/huejay) *(the API behind HueMagic)* maintains a list of Philips Hue supported luminaire models. The Group model attribute returns optionally a GroupModel object. This object contains more information about the model like the model.id, model.manufacturer, model.name, model.type, model.colorGamut and model.friendsOfHue |

### Universal Mode (optional)
Defines the group Id on the Hue Bridge manually if not configured in the node properties (deactivates group update events):

|    Property   | Type |            Information            |
|:-------------:|:----:|:---------------------------------:|
| **msg.topic** | int  | Manual definition of the group Id |

## Hue Scenes
Use the Hue Scene node to recall / activate preconfigured scenes on the bridge and receive scene information.

![Hue Scene Example](https://cloud.foddys.com/mXl6/hue-scene.png)

### Recall / Activate Scene
**Any** passed in value on the scene node activates the preconfigured scene. Please note that recalling animated scenes may not work properly due to some restrictions.

### Scene Events
The event message that the scene node sends contains the following data in the **msg.payload** object. Events will only be sent if a scene receives any command.

|     Property    |     Type    |                            Information                           |
|:---------------:|:-----------:|:----------------------------------------------------------------:|
| **id**          | string      | The unique scene id                                              |
| **name**        | string      | The scene name                                                   |
| **lightIds**    | array[int…] | Array of associated light ids in the scene                       |
| **owner**       | string      | User who created the scene                                       |
| **appData**     | object      | Object consisting of appData.version and appData.data properties |
| **lastUpdated** | string      | ISO 8601 date string when scene was last updated                 |
| **version**     | float       | Version number of the scene                                      |

## Hue Tap
Use the Hue Tap node to receive button events.

![Hue Scene Example](https://cloud.foddys.com/o2qO/HueTap.png)

### Button Events
The event message that the Hue Tap device sends contains the following data in the **msg.payload** object. Events will only sent on deploy (once) and if a button is pressed.

|   Property  |  Type  |                  Information                  |
|:-----------:|:------:|:---------------------------------------------:|
| **button**  | int    | Pressed button number from 1-4                |
| **updated** | string | ISO 8601 date string of the last button event |

### Additional Hue Tap Information
The event message that the Hue Tap device sends also contains the following data in the **msg.info** object.

|   Property   |  Type  |                                                             Information                                                             |
|:------------:|:------:|:-----------------------------------------------------------------------------------------------------------------------------------:|
| **id**       | int    | Numerical id of the sensor as registered on the bridge                                                                              |
| **uniqueId** | string | Unique Id of the sensor (typically hardware id)                                                                                     |
| **name**     | string | Name for the sensor                                                                                                                 |
| **type**     | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
| **model**    | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

## Hue Switch
Use the Hue Switch node to receive button events.

![Hue Scene Example](https://cloud.foddys.com/o3eV/HueSwitch.png)

### Button Events
The event message that the Hue Wireless Dimmer Switch sends contains the following data in the **msg.payload** object. Events will only sent on deploy (once) and if a button is pressed.

|   Property  |  Type  |                                                              Information                                                              |
|:-----------:|:------:|:-------------------------------------------------------------------------------------------------------------------------------------:|
| **button**  | int    | Pressed button id ([more information under 1.2 ZLL Switch](https://developers.meethue.com/documentation/supported-sensors#zgpSwitch)) |
| **name**    | string | Human readable pressed button name *(On, Dim Up, Dim Down, Off)*                                                                      |
| **action**  | string | Human readable pressed button action *(pressed, holded, short released, long released)*                                               |
| **updated** | string | ISO 8601 date string of the last button event                                                                                         |

### Additional Hue Switch Information
The event message that the Hue Wireless Dimmer Switch device sends also contains the following data in the **msg.info** object.

|   Property   |  Type  |                                                             Information                                                             |
|:------------:|:------:|:-----------------------------------------------------------------------------------------------------------------------------------:|
| **id**       | int    | Numerical id of the sensor as registered on the bridge                                                                              |
| **uniqueId** | string | Unique Id of the sensor (typically hardware id)                                                                                     |
| **name**     | string | Name for the sensor                                                                                                                 |
| **type**     | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
| **battery**  | int    | Current battery level of the Hue Switch in percent                                                                                  |
| **model**    | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

## Hue Motion Sensor
Use the Hue Motion node to control the motion sensor and receive motion events.

![Hue Motion Example](https://cloud.foddys.com/mXpZ/hue-motion.png)

### Activate / Deactivate Sensor
Activates or deactivates the motion sensor based on the passed in **msg** values of:

|   Property  |   Type  |                       Information                       |
|:-----------:|:-------:|:-------------------------------------------------------:|
| **payload** | boolean | True to activate the motion sensor, false to deactivate |

### Motion Events
The event message that the motion sensor sends contains the following data in the **msg.payload** object. Events will only be sent if a motion is detected, if a motion stops or if the motion sensor receives the *Activate / Deactivate* command.

|   Property  |   Type  |                    Information                   |
|:-----------:|:-------:|:------------------------------------------------:|
| **active**  | boolean | Current sensor state                             |
| **motion**  | boolean | Indicates if a motion is detected or not         |
| **updated** | string  | ISO 8601 date string of the last detected motion |

### Additional Motion Sensor Information
The event message that the motion sensor sends also contains the following data in the **msg.info** object.

|       Property      |  Type  |                                                             Information                                                             |
|:-------------------:|:------:|:-----------------------------------------------------------------------------------------------------------------------------------:|
| **id**              | int    | Numerical id of the sensor as registered on the bridge                                                                              |
| **uniqueId**        | string | Unique Id of the sensor (typically hardware id)                                                                                     |
| **name**            | string | Name for the sensor                                                                                                                 |
| **type**            | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
| **softwareVersion** | float  | Software version of the sensor                                                                                                      |
| **battery**         | int    | Current battery level of the temperature sensor in percent                                                                          |
| **model**           | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

## Hue Temperature Sensor
Use the Hue Temperature node to receive current (room) temperature in Celsius and Fahrenheit.

![Hue Temperature Example](https://cloud.foddys.com/mXYB/hue-temperature.png)

### Temperature Events
The event message that the temperature sensor sends contains the following data in the **msg.payload** object. Events will only sent on deploy (once) and if the temperature changes.

|    Property    |  Type  |                     Information                     |
|:--------------:|:------:|:---------------------------------------------------:|
| **celsius**    | float  | Temperature in Celsius                              |
| **fahrenheit** | float  | Temperature in Fahrenheit                           |
| **updated**    | string | ISO 8601 date string of the last temperature change |

### Additional Temperature Sensor Information
The event message that the temperature sensor sends also contains the following data in the **msg.info** object.

|       Property      |  Type  |                                                             Information                                                             |
|:-------------------:|:------:|:-----------------------------------------------------------------------------------------------------------------------------------:|
| **id**              | int    | Numerical id of the sensor as registered on the bridge                                                                              |
| **uniqueId**        | string | Unique Id of the sensor (typically hardware id)                                                                                     |
| **name**            | string | Name for the sensor                                                                                                                 |
| **type**            | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
| **softwareVersion** | float  | Software version of the sensor                                                                                                      |
| **battery**         | int    | Current battery level of the temperature sensor in percent                                                                          |
| **model**           | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

## Hue Lux Sensor
Use the Hue Brightness node to receive the current light level in Lux and daylight / darkness.

![Hue Lux Example](https://cloud.foddys.com/mX3W/hue-lux.png)

### Light Level Events
The event message that the light sensor sends contains the following data in the **msg.payload** object. Events will only be sent on deploy (once) and if the light level changes.

|    Property    |   Type  |                     Information                     |
|:--------------:|:-------:|:---------------------------------------------------:|
| **lux**        | int     | Real lux value                                      |
| **lightlevel** | int     | Light level                                         |
| **dark**       | boolean | True if it's dark                                   |
| **daylight**   | boolean | True if daylight recognized                         |
| **updated**    | string  | ISO 8601 date string of the last light level update |

### Additional Lux Sensor Information
The event message that the lux sensor sends also contains the following data in the **msg.info** object.

|       Property      |  Type  |                                                             Information                                                             |
|:-------------------:|:------:|:-----------------------------------------------------------------------------------------------------------------------------------:|
| **id**              | int    | Numerical id of the sensor as registered on the bridge                                                                              |
| **uniqueId**        | string | Unique Id of the sensor (typically hardware id)                                                                                     |
| **name**            | string | Name for the sensor                                                                                                                 |
| **type**            | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
| **softwareVersion** | float  | Software version of the sensor                                                                                                      |
| **battery**         | int    | Current battery level of the temperature sensor in percent                                                                          |
| **model**           | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

# Changelog

### v1.9.0 (latest)
* New "Hue Bridge" node (check node docs)
* New event-based algorithm improves the stability of all nodes
* New option to specify your own, alternative Hue Bridge port has been added (check node docs)
* Fixed Hue Bridge API limit errors for bridges with a large number of devices
* Other improvements
* Dependency updates

### v1.5.6
* New increment/decrement brightness setting in Hue Light and Hue Group nodes ([3a6977a](https://github.com/Foddy/node-red-contrib-huemagic/pull/54/commits/3a6977a1f8090917556f6ee4bdf4142fad7f7d85))
* New real lux property to Hue Brightness event outputs ([thanks @Travelbacon](https://github.com/Foddy/node-red-contrib-huemagic/issues/49))
* Added colorTemp property to Hue Light event outputs ([f8d237d](https://github.com/Foddy/node-red-contrib-huemagic/pull/52/commits/f8d237d6edf6772dbb73d9bd408e81a4ad4bd99a))
* Manipulation of the update interval setting to avoid API errors with many devices
* Fixed some annoying typos
* Dependency updates

### v1.5.4
* Dependency updates

### v1.5.3
* Fixed a typo in Hue Temperature node

### v1.5.2
* Added option to disable color naming in Hue Light & Hue Group config
* Fixed hex color conversion for Hue Light and Hue Group nodes
* More accurate color handling for light bulbs
* Added reachable attribute to Hue Light node
* Hue Tap can now send the same button action twice
* Fixed Hue Brightness event trigger when lux is 0
* UTC formatted "updated" date for Hue Brightness node
* Better error handling for all nodes
* Dependency updates

### v1.4.1
* New color name setting in Hue Light and Hue Group nodes (check docs)
* Human readable color names for Hue Lights and Hue Groups
* HueMagic nodes are now all under the new "HueMagic" category in the palette
* Support of Philips Hue API version v1.19.0+ and Node.js 8+
* Dependency updates

### v1.3.4
* Improved status messages for transition commands
* Dependency updates

### v1.3.2
* Fixed incorrect msg.topic handlings
* Small improvements

### v1.3.1
* New "saturation" setting in Hue Light and Hue Group nodes
* Improved input algorithm for Hue Lights and Groups nodes
* Added range validation for the "brightness" setting
* Setting the brightness level to "0" percent now turns off the lamp / group
* Fixed an error where nodes are losing their Id
* Fixed an error with the Hue Switch / Hue Tap node
* Typo corrections in README and several node's information

### v1.2.3
* Fixed an error on the Hue Switch and Hue Tap nodes
* Fixed an error with the "Universal Mode" on several nodes

### v1.2.1
* Support of Hue Taps and Wireless Dimmer Switches *(new nodes available)*
* Improved connection handling with automatic reconnection
* New option to configure color temperature on lights and groups ([28277f4](https://github.com/Foddy/node-red-contrib-huemagic/commit/28277f49eeb58d59377a609eb75573d7816c11fd))
* Dependency updates

### v1.1.9
* Improved alert function with configurable amount of seconds
* Several fixes and optimizations

### v1.1.8
* New "universal mode" for Hue Light and Hue Group nodes

### v1.1.7
* Replacing "superagent" dependency with "request" due to security vulnerabilities
* Several small fixes and optimizations for hue bridge node

### v1.1.3
* Several fixes for the Hue Light and Hue Group nodes

### v1.1.2
* Fixed block-scoped declarations for Node.js below version 6.x

### v1.1.0
* Support of Hue Scenes (new scene node)!
* Removed "id, "lightIds" and "battery" parameter in msg.payload of sensors / lights / groups
* Added msg.info object on all node events with extended device information

### v1.0.3
* Typo corrections and small improvements

### v1.0.0
* Initial release


***
<a href="https://en.wikipedia.org/wiki/Stuttgart" target="_blank"><img src="https://d3vv6lp55qjaqc.cloudfront.net/items/3g371R3Z1X0Z280q3P3P/huemagic-made-with-love.svg" width="555"></a>
If you like HueMagic and would like to support the development, you can do so with a donation. Just choose below, which amount or for what purpose you want to donate. HueMagic is and remains completely free for everyone - even without a donation. Thank you! :)

<a href="https://bit.ly/2JDJAKk" target="_blank"><img src="https://d3vv6lp55qjaqc.cloudfront.net/items/3p0j0X0L2Q2V2a2p3j2T/huemagic-donate-coffee.svg" width="164.2"></a><img src="https://d3vv6lp55qjaqc.cloudfront.net/items/0S303c1A052l2h0E1b1x/line.svg" width="55.26"><a href="https://bit.ly/2CW70ZY" target="_blank"><img src="https://d3vv6lp55qjaqc.cloudfront.net/items/1X2Z2I3X1H1T1M3U3p0d/huemagic-donate-light.svg" width="186.32"></a><img src="https://d3vv6lp55qjaqc.cloudfront.net/items/0S303c1A052l2h0E1b1x/line.svg" width="55.26"><a href="https://bit.ly/2yIRj5t" target="_blank"><img src="https://d3vv6lp55qjaqc.cloudfront.net/items/1R0h422r2q1Z0a0H2w42/huemagic-donate-sensor.svg" width="202.11"></a><img src="https://d3vv6lp55qjaqc.cloudfront.net/items/0S303c1A052l2h0E1b1x/line.svg" width="55.26"><a href="https://bit.ly/2P3txLu" target="_blank"><img src="https://d3vv6lp55qjaqc.cloudfront.net/items/1I0e1g320Z0M2L2s3l2c/huemagic-donate-bridge.svg" width="202.11"></a><img src="https://d3vv6lp55qjaqc.cloudfront.net/items/0S303c1A052l2h0E1b1x/line.svg" width="55.26"><a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=LUQ7CWBWQ3Q4U" target="_blank"><img src="https://d3vv6lp55qjaqc.cloudfront.net/items/0i20323o0H1k393z0t2g/huemagic-donate-anything.svg" width="165.79"></a>

***
<a href="https://www.browserstack.com"><img src="https://cloud.foddys.com/mmBs/Logo-01.svg" width="200"></a>

HueMagic is sponsored by [BrowserStack](https://www.browserstack.com) for cross browser compatibility testing on real browsers.
*Released under the [Apache License 2.0](https://tldrlegal.com/license/apache-license-2.0-(apache-2.0)).*
