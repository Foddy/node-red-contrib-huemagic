![Hue Magic Logo](https://cloud.foddys.com/mRlI/HUEMAGIC-LOGO.svg)

# HueMagic - Philips Hue nodes for Node-RED

![Dependencies](https://david-dm.org/foddy/node-red-contrib-huemagic.svg) [![GitHub issues](https://img.shields.io/github/issues/Foddy/node-red-contrib-huemagic.svg)](https://github.com/Foddy/node-red-contrib-huemagic/issues) [![GitHub license](https://img.shields.io/badge/license-Apache%202-blue.svg)](https://raw.githubusercontent.com/Foddy/node-red-contrib-huemagic/master/LICENSE)

HueMagic provides several input and output nodes for Node-RED and is the most in-depth and easy to use solution to control Philips Hue lights, groups, motion sensors, temperature sensors and Lux sensors.

### Features
* Automatic discovery of Philips Hue bridges as well as devices & groups
* Easy and extended control of Hue light bulbs and groups
* Automatic and powerful color conversions *(supports HEX & RGB input / output)*
* Events to detect external changes on all devices / groups
* Displays current state for all device types in the Node-RED UI
* Supports activating / deactivating of motion sensors
* Easy to use alarm and colorloop effects on light bulbs

### Installation
HueMagic was written for **Node.js 4+**.

`npm install node-red-contrib-huemagic`

## Hue Light *Node*
Use the Hue Light node to control the lights and receive light bulb events *(you can find this node under the input category of your nodes palette)*.

![Hue Light Example](https://cloud.foddys.com/mSNM/HUE-LIGHT.png)

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
| **alert**    	| int *(required)*     	| Configurable amount *(> 0)* of the alert effect. When the alert effect is finished the light bulb will reset to the previous state.   	|
| **rgb**      	| array[int,int,int] 	| Optionally configurable RGB color value of the alert effect. You don't need to pass the RGB value if you already passed a HEX value 	|
| **hex**      	| string             	| Optionally configurable HEX color value of the alert effect. You don't need to pass the HEX value if you already passed a RGB value 	|


### Light Events
The event message that the light bulb sends contains the following data in the msg.payload object. Events will only be sent if the light bulb state is changed.

| Property   	| Type               	| Information                                              	|
|------------	|--------------------	|----------------------------------------------------------	|
| **id**         	| int                	| The light id                                             	|
| **on**         	| boolean            	| True for on, false for off                               	|
| **brightness** 	| int                	| Current brightness of the light bulb in percent          	|
| **rgb**        	| array[int,int,int] 	| Current RGB color value of the light bulb (if supported) 	|
| **hex**        	| string             	| Current HEX color value of the light bulb (if supported) 	|
| **updated**    	| string             	| ISO 8601 date string of the last light state update      	|

## Hue Group *Node*
Use the Hue Group node to control whole groups containing lights and receive group events *(you can find this node under the input category of your nodes palette)*.

![Hue Group Example](https://cloud.foddys.com/mSF9/HUE-GROUP.png)

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
The event message that the group sends contains the following data in the msg.payload object. Events will only be sent if the group state is changed.

| Property       | Type               | Information                                                       |
|----------------|--------------------|-------------------------------------------------------------------|
| **id**         | int                | The light id                                                      |
| **on**         | boolean            | True for on, false for off                                        |
| **lightIds**   | array              | An array of light ids associated with the group                   |
| **allOn**      | boolean            | True if all lights in the group are on, false if not              |
| **anyOn**      | boolean            | True if any lights in the group are on, false if none are on      |
| **brightness** | int                | Current brightness of all lights in the whole group in percent    |
| **rgb**        | array[int,int,int] | Current RGB color value of all lights in the group (if supported) |
| **hex**        | string             | Current HEX color value of all lights in the group (if supported) |
| **updated**    | string             | ISO 8601 date string of the last group state update               |

## Hue Motion *Node*
Use the Hue Motion node to control the motion sensor and receive motion events. *(you can find this node under the output category of your nodes palette)*.

![Hue Motion Example](https://cloud.foddys.com/mS7R/HUE-MOTION.png)

### Activate / Deactivate Sensor
Activates or deactivates the motion sensor based on the passed in **msg** values of:

|   Property  | Type    | Information                                             |
|:-----------:|---------|---------------------------------------------------------|
| **payload** | boolean | True to activate the motion sensor, false to deactivate |

### Motion Events
The event message that the motion sensor sends contains the following data in the **msg.payload** object. Events will only be sent if a motion is detected, if a motion stops or if the motion sensor receives the *Activate / Deactivate* command.

|   Property  | Type    | Information                                             |
|:-----------:|---------|---------------------------------------------------------|
|    **id**   | int     | The motion sensor id                                    |
| **active**  | boolean | Current sensor state                                    |
| **motion**  | boolean | Indicates if a motion is detected or not                |
| **updated** | string  | ISO 8601 date string of the last detected motion        |
| **battery** | int     | Current battery level of the motion sensor in percent   |

## Hue Temperature *Node*
Use the Hue Temperature node to receive current (room) temperature in Celsius and Fahrenheit *(you can find this node under the output category of your nodes palette)*.

![Hue Temperature Example](https://cloud.foddys.com/mT4C/HUE-TEMPERATURE.png)

### Temperature Events
The event message that the temperature sensor sends contains the following data in the **msg.payload** object. Events will only sent on deploy (once) and the if the temperature changes.

|    Property    | Type    | Information                                                |
|:--------------:|---------|------------------------------------------------------------|
|     **id**     | int     | The temperature sensor id                                  |
| **celsius**    | float   | Temperature in Celsius                                     |
| **fahrenheit** | float   | Temperature in Fahrenheit                                  |
| **updated**    | string  | ISO 8601 date string of the last temperature change        |
| **battery**    | int     | Current battery level of the temperature sensor in percent |

## Hue Lux (Brightness) *Node*
Use the Hue Brightness node to receive the current light level in Lux and daylight / darkness *(you can find this node under the output category of your nodes palette)*.

![Hue Lux Example](https://cloud.foddys.com/mSnM/HUE-LUX.png)

### Light Level Events
The event message that the light sensor sends contains the following data in the **msg.payload** object. Events will only be sent on deploy (once) and the if the light level changes.

|    Property    | Type    | Information                                         |
|:--------------:|---------|-----------------------------------------------------|
|     **id**     | int     | The light sensor id                                 |
| **lightlevel** | int     | Light level measured in Lux                         |
| **dark**       | boolean | True if it's dark                                   |
| **daylight**   | boolean | True if daylight recognized                         |
| **updated**    | string  | ISO 8601 date string of the last light level update |
| **battery**    | int     | Current battery level of the lux sensor in percent  |

***
Released under the [Apache License 2.0](https://tldrlegal.com/license/apache-license-2.0-(apache-2.0)).