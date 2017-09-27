![Hue Magic Logo](https://cloud.foddys.com/mRlI/HUEMAGIC-LOGO.svg)

# HueMagic - Philips Hue nodes for Node-RED

![Dependencies](https://david-dm.org/foddy/node-red-contrib-huemagic.svg) [![GitHub license](https://img.shields.io/badge/license-Apache%202-blue.svg)](https://raw.githubusercontent.com/Foddy/node-red-contrib-huemagic/master/LICENSE)

HueMagic provides several input and output nodes for Node-RED and is the most in-depth and easy to use solution to control Philips Hue lights, groups, scenes, motion sensors, temperature sensors and Lux sensors.

### Features
* Easy and extended control
* Automatic discovery of Philips Hue bridges as well as devices, scenes & groups
* Automatic and powerful color conversions *(supports HEX & RGB input / output)*
* Events to detect external changes on all devices / groups
* Displays current state for all device types in the Node-RED UI
* Supports activating / deactivating of motion sensors
* Easy to use alarm and colorloop effects on light bulbs and whole groups

### Installation
HueMagic was written for **Node.js 4+** and Node-RED v0.17.5+.
_Please make sure, that you deactivate / remove other Philips Hue related NodeRED nodes before installing HueMagic!_

`npm install node-red-contrib-huemagic`

### Available Nodes

- [Hue Lights](#hue-lights)
- [Hue Groups](#hue-groups)
- [Hue Scenes](#hue-scenes)
- [Hue Motion Sensor](#hue-motion-sensor)
- [Hue Temperature Sensor](#hue-temperature-sensor)
- [Hue Lux Sensor](#hue-lux-sensor)

## Hue Lights
Use the Hue Light node to control the lights and receive light bulb events *(you can find this node under the input category of your nodes palette)*.

![Hue Light Example](https://cloud.foddys.com/mY6m/hue-light.png)

### Turn on / off (simple mode)
Changes the light on / off state based on the passed in **msg** values of:

| Property 	| Type    	| Information                                                                               	|
|:--------:	|---------	|-------------------------------------------------------------------------------------------	|
| **payload**  	| boolean 	| Will turn on or turn off the light with its previous configuration (color and brightness) 	|

### Turn On / Off (extended mode)
Changes the light state, effect, color and brightness based on the passed in **msg.payload** values of:

| Property       	| Type               	| Information                                                                                                                       	|
|----------------	|--------------------	|-----------------------------------------------------------------------------------------------------------------------------------	|
| **on**             	| boolean *(required)* 	| Will turn on or turn off the light with its previous configuration (color and brightness)                                         	|
| **brightness**     	| int                	| Optionally configurable brightness of the light in percent (0-100)                                                                	|
| **rgb**            	| array[int,int,int] 	| Optionally configurable RGB color value of the light bulb. You don't need to pass the RGB value if you already passed a HEX value 	|
| **hex**            	| string             	| Optionally configurable HEX color value of the light bulb. You don't need to pass the HEX value if you already passed a RGB value 	|
| **transitionTime** 	| int                	| Optionally configurable temporary value which eases transition of an effect (value in seconds, 0 for instant, 5 for five seconds) 	|
| **colorloop**      	| int                	| Optionally configurable color loop effect. Value in seconds (deactivates the effect to the previous state after x seconds)        	|

### Special Alert Effect
Plays an alert effect based on the passed in **msg.payload** values of:

| Property 	| Type               	| Information                                                                                                                         	|
|----------	|--------------------	|-------------------------------------------------------------------------------------------------------------------------------------	|
| **alert**    	| int *(required)*     	| Configurable amount *(> 0)* of the alert effect. When the alert effect is finished the light bulb will reset to the previous state.   |
| **rgb**      	| array[int,int,int] 	| Optionally configurable RGB color value of the alert effect. You don't need to pass the RGB value if you already passed a HEX value 	|
| **hex**      	| string             	| Optionally configurable HEX color value of the alert effect. You don't need to pass the HEX value if you already passed a RGB value 	|


### Light Events
The event message that the light bulb sends contains the following data in the **msg.payload** object. Events will only be sent if the light bulb state is changed.

| Property   	| Type               	| Information                                              	|
|------------	|--------------------	|----------------------------------------------------------	|
| **on**         	| boolean            	| True for on, false for off                               	|
| **brightness** 	| int                	| Current brightness of the light bulb in percent          	|
| **rgb**        	| array[int,int,int] 	| Current RGB color value of the light bulb (if supported) 	|
| **hex**        	| string             	| Current HEX color value of the light bulb (if supported) 	|
| **updated**    	| string             	| ISO 8601 date string of the last light state update      	|

### Additional Light Bulb Information
The event message that the light bulb sends also contains the following data in the **msg.info** object.

|       Property      | Type   | Information                                                                                                                                                              |
|:-------------------:|--------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|        **id**       | int    | Numerical id of the light as registered on the bridge                                                                                                                    |
| **uniqueId**        | string | Unique Id of the light (typically hardware id)                                                                                                                           |
| **name**            | string | Name for the light                                                                                                                                                       |
| **type**            | string | Type of light (e.g. Extended Color Light, Dimmable Light)                                                                                                                |
| **softwareVersion** | float  | Software version of the light                                                                                                                                            |
| **model**           | object | The model object of the light includes model specific information like the model.id, model.manufacturer, model.name, model.type, model.colorGamut and model.friendsOfHue |

## Hue Groups
Use the Hue Group node to control whole groups containing lights and receive group events *(you can find this node under the input category of your nodes palette)*.

![Hue Group Example](https://cloud.foddys.com/mXpj/hue-group.png)

### Turn on / off (simple mode)
Changes the group on / off state based on the passed in **msg** values of:

|   Property  | Type    | Information                                                                                                   |
|:-----------:|---------|---------------------------------------------------------------------------------------------------------------|
| **payload** | boolean | Will turn on or turn off all lights inside the group with their previous configuration (color and brightness) |

### Turn On / Off (extended mode)
Changes the group state, effect, color and brightness based on the passed in **msg.payload** values of:

| Property           | Type                 | Information                                                                                                                                    |
|--------------------|----------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| **on**             | boolean *(required)* | True to turn on all the lights inside the group, false to turn them off                                                                        |
| **brightness**     | int                  | Optionally configurable brightness of the lights in percent (0-100)                                                                            |
| **rgb**            | array[int,int,int]   | Optionally configurable RGB color value of all lights inside the group. You don't need to pass the RGB value if you already passed a HEX value |
| **hex**            | string               | Optionally configurable HEX color value of all lights inside the group. You don't need to pass the HEX value if you already passed a RGB value |
| **transitionTime** | int                  | Optionally configurable temporary value which eases transition of an effect (value in seconds, 0 for instant, 5 for five seconds)              |
| **colorloop**      | int                  | Optionally configurable color loop effect. Value in seconds (deactivates the effect to the previous state after x seconds)                     |

### Special Alert Effect
Plays an alert effect based on the passed in **msg.payload** values of:

| Property  | Type               | Information                                                                                                                         |
|-----------|--------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| **alert** | int *(required)*   | Configurable amount (>0) of the alert effect. When the alert effect is finished the light bulbs will reset to the previous state.   |
| **rgb**   | array[int,int,int] | Optionally configurable RGB color value of the alert effect. You don't need to pass the RGB value if you already passed a HEX value |
| **hex**   | string             | Optionally configurable HEX color value of the alert effect. You don't need to pass the HEX value if you already passed a RGB value |

### Group Events
The event message that the group sends contains the following data in the **msg.payload** object. Events will only be sent if the group state is changed.

| Property       | Type               | Information                                                       |
|----------------|--------------------|-------------------------------------------------------------------|
| **on**         | boolean            | True for on, false for off                                        |
| **allOn**      | boolean            | True if all lights in the group are on, false if not              |
| **anyOn**      | boolean            | True if any lights in the group are on, false if none are on      |
| **brightness** | int                | Current brightness of all lights in the whole group in percent    |
| **rgb**        | array[int,int,int] | Current RGB color value of all lights in the group (if supported) |
| **hex**        | string             | Current HEX color value of all lights in the group (if supported) |
| **updated**    | string             | ISO 8601 date string of the last group state update               |

### Additional Group Information
The event message that the group sends also contains the following data in the **msg.info** object.

|   Property   | Type   | Information                                                                                                                                                                                                                                                                                                                 |
|:------------:|--------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|    **id**    | int    | Group Id, generated automatically by the bridge                                                                                                                                                                                                                                                                             |
| **lightIds** | array  | An array of light ids associated with the group                                                                                                                                                                                                                                                                             |
| **name**     | string | Name for the group                                                                                                                                                                                                                                                                                                          |
| **type**     | string | Type of group (e.g. LightGroup, Luminaire, LightSource, Room)                                                                                                                                                                                                                                                               |
| **model**    | object | [Huejay](https://github.com/sqmk/huejay) *(the API behind HueMagic)* maintains a list of Philips Hue supported luminaire models. The Group model attribute returns optionally a GroupModel object. This object contains more information about the model like the model.id, model.manufacturer, model.name, model.type, model.colorGamut and model.friendsOfHue |

## Hue Scenes
Use the Hue Scene node to recall / activate preconfigured scenes on the bridge and receive scene information *(you can find this node under the input category of your nodes palette)*.

![Hue Scene Example](https://cloud.foddys.com/mXl6/hue-scene.png)

### Recall / Activate Scene
**Any** passed in value on the scene node activates the preconfigured scene. Please note that recalling animated scenes may not work properly due to some restrictions.

### Scene Events
The event message that the scene node sends contains the following data in the **msg.payload** object. Events will only be sent if a scene receives any command.

|     Property    | Type        | Information                                                      |
|:---------------:|-------------|------------------------------------------------------------------|
|      **id**     | string      | The unique scene id                                              |
| **name**        | string      | The scene name                                                   |
| **lightIds**    | array[int…] | Array of associated light ids in the scene                       |
| **owner**       | string      | User who created the scene                                       |
| **appData**     | object      | Object consisting of appData.version and appData.data properties |
| **lastUpdated** | string      | ISO 8601 date string when scene was last updated                 |
| **version**     | float       | Version number of the scene                                      |

## Hue Motion Sensor
Use the Hue Motion node to control the motion sensor and receive motion events *(you can find this node under the output category of your nodes palette)*.

![Hue Motion Example](https://cloud.foddys.com/mXpZ/hue-motion.png)

### Activate / Deactivate Sensor
Activates or deactivates the motion sensor based on the passed in **msg** values of:

|   Property  | Type    | Information                                             |
|:-----------:|---------|---------------------------------------------------------|
| **payload** | boolean | True to activate the motion sensor, false to deactivate |

### Motion Events
The event message that the motion sensor sends contains the following data in the **msg.payload** object. Events will only be sent if a motion is detected, if a motion stops or if the motion sensor receives the *Activate / Deactivate* command.

|   Property  | Type    | Information                                             |
|:-----------:|---------|---------------------------------------------------------|
| **active**  | boolean | Current sensor state                                    |
| **motion**  | boolean | Indicates if a motion is detected or not                |
| **updated** | string  | ISO 8601 date string of the last detected motion        |

### Additional Motion Sensor Information
The event message that the motion sensor sends also contains the following data in the **msg.info** object.

|       Property      | Type   | Information                                                                                                                         |
|:-------------------:|--------|-------------------------------------------------------------------------------------------------------------------------------------|
|        **id**       | int    | Numerical id of the sensor as registered on the bridge                                                                              |
| **uniqueId**        | string | Unique Id of the sensor (typically hardware id)                                                                                     |
| **name**            | string | Name for the sensor                                                                                                                 |
| **type**            | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
| **softwareVersion** | float  | Software version of the sensor                                                                                                      |
| **battery**         | int    | Current battery level of the temperature sensor in percent                                                                          |
| **model**           | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

## Hue Temperature Sensor
Use the Hue Temperature node to receive current (room) temperature in Celsius and Fahrenheit *(you can find this node under the output category of your nodes palette)*.

![Hue Temperature Example](https://cloud.foddys.com/mXYB/hue-temperature.png)

### Temperature Events
The event message that the temperature sensor sends contains the following data in the **msg.payload** object. Events will only sent on deploy (once) and if the temperature changes.

|    Property    | Type    | Information                                                |
|:--------------:|---------|------------------------------------------------------------|
| **celsius**    | float   | Temperature in Celsius                                     |
| **fahrenheit** | float   | Temperature in Fahrenheit                                  |
| **updated**    | string  | ISO 8601 date string of the last temperature change        |

### Additional Temperature Sensor Information
The event message that the temperature sensor sends also contains the following data in the **msg.info** object.

|       Property      | Type   | Information                                                                                                                         |
|:-------------------:|--------|-------------------------------------------------------------------------------------------------------------------------------------|
|        **id**       | int    | Numerical id of the sensor as registered on the bridge                                                                              |
| **uniqueId**        | string | Unique Id of the sensor (typically hardware id)                                                                                     |
| **name**            | string | Name for the sensor                                                                                                                 |
| **type**            | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
| **softwareVersion** | float  | Software version of the sensor                                                                                                      |
| **battery**         | int    | Current battery level of the temperature sensor in percent                                                                          |
| **model**           | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

## Hue Lux Sensor
Use the Hue Brightness node to receive the current light level in Lux and daylight / darkness *(you can find this node under the output category of your nodes palette)*.

![Hue Lux Example](https://cloud.foddys.com/mX3W/hue-lux.png)

### Light Level Events
The event message that the light sensor sends contains the following data in the **msg.payload** object. Events will only be sent on deploy (once) and if the light level changes.

|    Property    | Type    | Information                                         |
|:--------------:|---------|-----------------------------------------------------|
| **lightlevel** | int     | Light level measured in Lux                         |
| **dark**       | boolean | True if it's dark                                   |
| **daylight**   | boolean | True if daylight recognized                         |
| **updated**    | string  | ISO 8601 date string of the last light level update |

### Additional Lux Sensor Information
The event message that the lux sensor sends also contains the following data in the **msg.info** object.

|       Property      | Type   | Information                                                                                                                         |
|:-------------------:|--------|-------------------------------------------------------------------------------------------------------------------------------------|
|        **id**       | int    | Numerical id of the sensor as registered on the bridge                                                                              |
| **uniqueId**        | string | Unique Id of the sensor (typically hardware id)                                                                                     |
| **name**            | string | Name for the sensor                                                                                                                 |
| **type**            | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
| **softwareVersion** | float  | Software version of the sensor                                                                                                      |
| **battery**         | int    | Current battery level of the temperature sensor in percent                                                                          |
| **model**           | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

# Changelog

### v1.1.6 (latest)
* Replacing "superagent" dependency with "request" due to security vulnerabilities
* Fixed Hue Bridge node

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
Released under the [Apache License 2.0](https://tldrlegal.com/license/apache-license-2.0-(apache-2.0)).