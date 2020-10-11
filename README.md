[![Hue Magic Logo](https://gistcdn.githack.com/Foddy/062045775c28f5993ad646aba80e678c/raw/27e90d22bde68d9c92aed520c0c0c2cb8a22b7fd/huemagicv3x.svg)](https://flows.nodered.org/node/node-red-contrib-huemagic)

# HueMagic - Philips Hue nodes for Node-RED

[![Travis](https://img.shields.io/travis/Foddy/node-red-contrib-huemagic.svg?style=flat-square)](https://github.com/foddy/node-red-contrib-huemagic/) [![Dependencies](https://david-dm.org/foddy/node-red-contrib-huemagic.svg?style=flat-square)](https://david-dm.org/foddy/node-red-contrib-huemagic) [![npm](https://img.shields.io/npm/dt/node-red-contrib-huemagic.svg?style=flat-square)](https://www.npmjs.com/package/node-red-contrib-huemagic) [![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=LUQ7CWBWQ3Q4U) [![npm](https://img.shields.io/npm/v/node-red-contrib-huemagic.svg?style=flat-square)](https://github.com/foddy/node-red-contrib-huemagic/) [![GitHub license](https://img.shields.io/badge/license-Apache%202-blue.svg?style=flat-square)](https://raw.githubusercontent.com/Foddy/node-red-contrib-huemagic/master/LICENSE)

HueMagic provides several input and output nodes for Node-RED and is the most in-depth and easy to use solution to control Philips Hue bridges, lights, groups, scenes, rules, taps, switches, buttons, motion sensors, temperature sensors and Lux sensors.

### Features
* Simple and comprehensive control of the Hue Bridge and connected devices
* Automatic discovery of Philips Hue bridges as well as devices, scenes & groups…
* Output and input of multiple color code definitions *(HEX, RGB & human readable color names)*
* Automatic color temperature property based on current sun position
* Event-based status messages for all devices connected to the Hue Bridge
* Virtual pressing of the Hue Bridge button (Link Button)
* Pairing of new devices without app enforcement (TouchLink)
* Automatic firmware updates to the Hue Bridge and connected devices
* Activating / deactivating of motion sensors, rules on the Hue Bridge
* Extended alarm and colorloop effects on light bulbs and whole groups
* A large selection of animations and the option to apply custom animations
* Additive state settings on all nodes with multiple commands
* Change states even if the corresponding devices are offline
* Real-time status messages in the Node-RED UI
* Extensively documented in English & German

### Installation
HueMagic was written for **Node.js 12+** and Node-RED v1.1.3+. It supports Philips Hue API version v1.19.0+.
_Please make sure, that you deactivate / remove other Philips Hue related Node-RED nodes before installing HueMagic!_

`npm install node-red-contrib-huemagic`

### Available Nodes

- [Hue Bridges](#hue-bridges)
- [Hue Magic](#hue-magic)
- [Hue Lights](#hue-lights)
- [Hue Groups](#hue-groups)
- [Hue Scenes](#hue-scenes)
- [Hue Taps](#hue-tap)
- [Hue Wireless Dimmer Switches](#hue-switch)
- [Hue Buttons](#hue-button)
- [Hue Motion Sensors](#hue-motion-sensor)
- [Hue Temperature Sensors](#hue-temperature-sensor)
- [Hue Lux Sensors](#hue-lux-sensor)
- [Hue Rules](#hue-rules)

## Hue Bridges
The Hue Bridge node keeps the Hue Bridge firmware and connected devices up-to-date and provides more information and setup options for the bridge.

![Hue Bridge Example](https://user-images.githubusercontent.com/5302050/95681696-ab096980-0be1-11eb-8a20-2d13153a25d2.png)

### Get settings / status
Retrieves the current status / settings of the bridge by injecting any input value.

| Property | Type | Information                                         |
|:--------:|:----:|-----------------------------------------------------|
|  **any** |  any | Triggers an output of the current status / settings |

### Enable TouchLink scan
Use TouchLink to pair new devices or old devices after a bridge reset. This is commonly known in the community as "Lamp stealer". Pass the **touchLink** property to **msg.payload**.

|    Property   |             Type             | Information            |
|:-------------:|:----------------------------:|------------------------|
| **touchLink** | boolean (any value accepted) | Pairs lights / devices |

### Fetch all devices and resources
Use the Fetch command to retrieve various information from the Hue Bridge when needed. Pass the **fetch** property to **msg.payload**.

|       Property       |  Type  | Information                                                                                                               |
|:--------------------:|:------:|---------------------------------------------------------------------------------------------------------------------------|
|       **users**      | string | Returns an array of User objects in msg.users & bridge information in msg.info                                            |
|      **lights**      | string | Returns an array of Light objects in msg.lights & bridge information in msg.info                                          |
|      **groups**      | string | Returns an array of Group objects in msg.groups & bridge information in msg.info                                          |
|      **sensors**     | string | Returns an array of Sensor objects in msg.sensors & bridge information in msg.info                                        |
|      **scenes**      | string | Returns an array of Scene objects in msg.scenes & bridge information in msg.info                                          |
|       **rules**      | string | Returns an array of Rule objects in msg.rules & bridge information in msg.info                                            |
|     **schedules**    | string | Returns an array of Schedule objects in msg.schedules & bridge information in msg.info                                    |
|   **resourceLinks**  | string | Returns an array of ResourceLink objects in msg.resourceLinks & bridge information in msg.info                            |
|     **timeZones**    | string | Returns an array of all available time zones in msg.timeZones & bridge information in msg.info                            |
| **internetServices** | string | Returns an object of all available internet services information in msg.internetServices & bridge information in msg.info |
|      **portal**      | string | Returns an object of all available portal information in msg.portal & bridge information in msg.info                      |

### Hue Bridge Settings
Changes the Hue Bridge settings based on the passed in **msg.payload.settings** values of:

|      Property     |   Type  | Information                                    |
|:-----------------:|:-------:|------------------------------------------------|
|      **name**     |  string | Name of the bridge                             |
| **zigbeeChannel** |   int   | ZigBee channel (for communicating with lights) |
|   **ipAddress**   |  string | IP address                                     |
|  **dhcpEnabled**  | boolean | Whether or not DHCP is enabled                 |
|    **netmask**    |  string | Netmask                                        |
|    **gateway**    |  string | Gateway                                        |
|  **proxyAddress** |  string | Proxy address                                  |
|   **proxyPort**   |  string | Proxy port                                     |
|    **timeZone**   |  string | Time zone                                      |

### Hue Bridge Events
The event message that the bridge sends contains the following data in the **msg.payload** object:

|          Property         |      Type     | Information                                                                                                             |
|:-------------------------:|:-------------:|-------------------------------------------------------------------------------------------------------------------------|
|           **id**          |     string    | Unique ID of the Hue Bridge                                                                                             |
|          **name**         |     string    | Name of the bridge                                                                                                      |
|       **factoryNew**      |    boolean    | Whether or not the bridge is factory new                                                                                |
|    **replacesBridgeId**   | string / null | Replaces bridge id (for migrating from old bridges)                                                                     |
|    **dataStoreVersion**   |     string    | Data store version                                                                                                      |
|      **starterKitId**     |     string    | Name of the starterkit created in the factory                                                                           |
|    **softwareVersion**    |     string    | Software version of the bridge                                                                                          |
|       **apiVersion**      |     string    | API version of the bridge                                                                                               |
|     **zigbeeChannel**     |      int      | ZigBee channel (for communicating with lights)                                                                          |
|       **macAddress**      |     string    | MAC address                                                                                                             |
|       **ipAddress**       |     string    | IP address                                                                                                              |
|      **dhcpEnabled**      |    boolean    | Whether or not DHCP is enabled                                                                                          |
|        **netmask**        |     string    | Netmask                                                                                                                 |
|        **gateway**        |     string    | Gateway                                                                                                                 |
|      **proxyAddress**     |     string    | Proxy address                                                                                                           |
|       **proxyPort**       |     string    | Proxy port                                                                                                              |
|        **utcTime**        |     string    | UTC time of the bridge                                                                                                  |
|        **timeZone**       |     string    | Time zone                                                                                                               |
|       **localTime**       |     string    | Local time of the bridge                                                                                                |
| **portalServicesEnabled** |    boolean    | Whether or not portal services are enabled                                                                              |
|    **portalConnected**    |    boolean    | Whether or not portal is connected                                                                                      |
|   **linkButtonEnabled**   |    boolean    | Whether or not link button is enabled                                                                                   |
|    **touchlinkEnabled**   |    boolean    | Whether or not TouchLink is enabled                                                                                     |
|         **model**         |     object    | The model object of the bridge includes model specific information like the model.id, model.manufacturer and model.name |

### Global update events
The bridge also sends events when a certain active resource (lights, groups, sensors, etc.) changes its status.

|     Property    |  Type  | Information                                                                                   |
|:---------------:|:------:|-----------------------------------------------------------------------------------------------|
| **msg.updated** | object | The whole object of the device (check docs)                                                   |
|   **msg.type**  | string | Can be one of the following: light, group, rule, motion, brightness, temperature, switch, tap |

## Hue Magic
Use the Hue Magic node to apply animations on Hue Lights or Hue Groups. Connect the Hue Magic node to only one light or a whole group node to save API requests on the Hue Bridge. The animation previews can differ slightly from the real result on a lamp / group.

![Hue Magic Example](https://user-images.githubusercontent.com/5302050/95681706-b9578580-0be1-11eb-8153-d045e5f7c210.png)

### Start / Stop animation
Starts or stops an animation on the passed in **msg** values of:

|   Property  |   Type  | Information                                |
|:-----------:|:-------:|--------------------------------------------|
| **payload** | boolean | True to start the animation, false to stop |

### Included animations
Choose one of the included animations to apply to a Hue Light or Hue Group node. Contributions are welcomed! If you have created your own animation that you would like to share with others, add it at `/huemagic/animations/XXX-youranimationname.json` and create a pull request. Take a look at this directory for structure help.

![Some included animations](https://user-images.githubusercontent.com/5302050/71556018-30e16d00-2a33-11ea-8c03-45211767ee98.gif)

### Custom animations
Alternatively, you can create and use your own animations. To do this, create an **array** and pass it to **msg.payload.steps** with the following parameters.

|    Property   |  Type  | Information                                                                                                  |
|:-------------:|:------:|--------------------------------------------------------------------------------------------------------------|
|   **delay**   |   int  | Execute this frame after the delay (in ms)                                                                   |
| **animation** | object | Insert all parameters that should be animated here. Supports all values of "Hue Light" and "Hue Group" node. |

### Special commands
Sometimes it makes sense for animations to be played out in disorder. For example, to imitate fire more realistically. To do this, create an object and pass it to **msg.payload.specials** with the following parameters.

|     Property    |   Type  | Information                   |
|:---------------:|:-------:|-------------------------------|
| **randomOrder** | boolean | Execute steps in random order |

## Hue Lights
Use the Hue Light node to control the lights and receive light bulb events.

![Hue Light Example](https://user-images.githubusercontent.com/5302050/95681670-7dbcbb80-0be1-11eb-96d2-2546984459dd.png)

### Turn on / off (simple mode)
Changes the light on / off state based on the passed in **msg** values of:

|   Property  |   Type  | Information                                                                               |
|:-----------:|:-------:|-------------------------------------------------------------------------------------------|
| **payload** | boolean | Will turn on or turn off the light with its previous configuration (color and brightness) |

### Turn On / Off (extended mode)
Changes the light state, effect, color, brightness and other states based on the passed in **msg.payload** values of:

|         Property        |        Type        | Information                                                                                                                       |
|:-----------------------:|:------------------:|-----------------------------------------------------------------------------------------------------------------------------------|
|          **on**         |       boolean      | Will turn on or turn off the light with its previous configuration (color and brightness)                                         |
|      **brightness**     |         int        | Optionally configurable brightness of the light in percent (0-100)                                                                |
|   **brightnessLevel**   |         int        | Optionally configurable brightness of the light (0-254)                                                                           |
| **incrementBrightness** |         int        | Increment brightness by given percentage value                                                                                    |
| **decrementBrightness** |         int        | Decrement brightness by given percentage value                                                                                    |
|         **rgb**         | array[int,int,int] | Optionally configurable RGB color value of the light bulb. You don't need to pass the RGB value if you already passed a HEX value |
|         **hex**         |       string       | Optionally configurable HEX color value of the light bulb. You don't need to pass the HEX value if you already passed a RGB value |
|        **color**        |       string       | Optionally configurable human readable color name in english like "red" or "random" for a random color                            |
|        **image**        |       string       | Optionally configurable image path (remote or local) to apply the most dominant color to the light                                |
|    **transitionTime**   |        float       | Optionally configurable temporary value which eases transition of an effect (value in seconds, 0 for instant, 5 for five seconds) |
|      **colorloop**      |   float / boolean  | Optionally configurable color loop effect. Float = disables the effect after x seconds / Boolean to turn on / off the effect      |
|      **colorTemp**      |    int / string    | Optionally configurable color temperature of the light from 153 to 500 or a string with "cold", "normal", "warm" or "auto"        |
|  **incrementColorTemp** |         int        | Increment/decrement color temperature by given value                                                                              |
|      **saturation**     |         int        | Optionally configurable color saturation of the light in percent (from 0 to 100)                                                  |
|        **status**       |         any        | Returns the current status message of the node without taking any action                                                          |

### Toggle on / off (auto)
Turns the light on or off depending on the current state based on the passed in **msg.payload** value of:

|  Property  | Type | Information                                                                               |
|:----------:|:----:|-------------------------------------------------------------------------------------------|
| **toggle** |  any | Will turn on or turn off the light with the previous configuration (color and brightness) |

### Special Alert Effect
Plays an alert effect based on the passed in **msg.payload** values of:

|  Property |        Type        | Information                                                                                                                         |
|:---------:|:------------------:|-------------------------------------------------------------------------------------------------------------------------------------|
| **alert** |  int *(required)*  | Configurable amount of seconds to play the alert effect (max 30)                                                                    |
|  **rgb**  | array[int,int,int] | Optionally configurable RGB color value of the alert effect. You don't need to pass the RGB value if you already passed a HEX value |
|  **hex**  |       string       | Optionally configurable HEX color value of the alert effect. You don't need to pass the HEX value if you already passed a RGB value |
| **color** |       string       | Optionally configurable human readable color name in english like "red" or "random" for a random color effect                       |

### Light Events
The event message that the light bulb sends contains the following data in the **msg.payload** object. Events will only be sent if the light bulb state is changed.

|       Property      |        Type        | Information                                                |
|:-------------------:|:------------------:|------------------------------------------------------------|
|        **on**       |       boolean      | True for on, false for off                                 |
|    **brightness**   |         int        | Current brightness of the light bulb in percent            |
| **brightnessLevel** |         int        | Current brightness of the light bulb (0-254)               |
|       **rgb**       | array[int,int,int] | Current RGB color value of the light bulb (if supported)   |
|       **hex**       |       string       | Current HEX color value of the light bulb (if supported)   |
|      **color**      |       string       | Current color name of the light bulb (if supported)        |
|    **colorTemp**    |         int        | Current color temperature of the light bulb (if supported) |
|     **updated**     |       string       | ISO 8601 date string of the last light state update        |

### Additional Light Bulb Information
The event message that the light bulb sends also contains the following data in the **msg.info** object.

|       Property      |  Type  | Information                                                                                                                                                              |
|:-------------------:|:------:|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|        **id**       |   int  | Numerical id of the light as registered on the bridge                                                                                                                    |
|     **uniqueId**    | string | Unique Id of the light (typically hardware id)                                                                                                                           |
|       **name**      | string | Name for the light                                                                                                                                                       |
|       **type**      | string | Type of light (e.g. Extended Color Light, Dimmable Light)                                                                                                                |
| **softwareVersion** |  float | Software version of the light                                                                                                                                            |
|      **model**      | object | The model object of the light includes model specific information like the model.id, model.manufacturer, model.name, model.type, model.colorGamut and model.friendsOfHue |

### Universal Mode (optional)
Defines the light Id on the Hue Bridge manually if not configured in the node properties (deactivates light update events):

|    Property   | Type | Information                            |
|:-------------:|:----:|----------------------------------------|
| **msg.topic** |  int | Manual definition of the light bulb Id |

### Last State Information
This node also sends the entire last state data (before the update) in the **msg.lastState** object. It can either contain false (boolean) or the objects payload (msg.lastState.payload) and info (msg.lastState.info). The return value "false" is only sent if there was no last state, e.g. when the node was newly created or restarted.

## Hue Groups
Use the Hue Group node to control whole groups containing lights and receive group events.

![Hue Group Example](https://user-images.githubusercontent.com/5302050/95681715-c7a5a180-0be1-11eb-9816-30567792963c.png)

### Turn on / off (simple mode)
Changes the group on / off state based on the passed in **msg** values of:

|   Property  |   Type  | Information                                                                                                   |
|:-----------:|:-------:|---------------------------------------------------------------------------------------------------------------|
| **payload** | boolean | Will turn on or turn off all lights inside the group with their previous configuration (color and brightness) |

### Turn On / Off (extended mode)
Changes the group state, effect, color, brightness and other states based on the passed in **msg.payload** values of:

|         Property        |        Type        | Information                                                                                                                       |
|:-----------------------:|:------------------:|-----------------------------------------------------------------------------------------------------------------------------------|
|          **on**         |       boolean      | Will turn on or turn off the light with its previous configuration (color and brightness)                                         |
|      **brightness**     |         int        | Optionally configurable brightness of the light in percent (0-100)                                                                |
|   **brightnessLevel**   |         int        | Optionally configurable brightness of the light (0-254)                                                                           |
| **incrementBrightness** |         int        | Increment brightness by given percentage value                                                                                    |
| **decrementBrightness** |         int        | Decrement brightness by given percentage value                                                                                    |
|         **rgb**         | array[int,int,int] | Optionally configurable RGB color value of the light bulb. You don't need to pass the RGB value if you already passed a HEX value |
|         **hex**         |       string       | Optionally configurable HEX color value of the light bulb. You don't need to pass the HEX value if you already passed a RGB value |
|        **color**        |       string       | Optionally configurable human readable color name in english like "red" or "random" for a random color                            |
|        **image**        |       string       | Optionally configurable image path (remote or local) to apply the most dominant color to the light                                |
|    **transitionTime**   |        float       | Optionally configurable temporary value which eases transition of an effect (value in seconds, 0 for instant, 5 for five seconds) |
|      **colorloop**      |   float / boolean  | Optionally configurable color loop effect. Float = disables the effect after x seconds / Boolean to turn on / off the effect      |
|      **colorTemp**      |    int / string    | Optionally configurable color temperature of the group lights from 153 to 500 or a string with "cold", "normal", "warm" or "auto" |
|  **incrementColorTemp** |         int        | Increment/decrement color temperature by given value                                                                              |
|      **saturation**     |         int        | Optionally configurable color saturation of the light in percent (from 0 to 100)                                                  |
|        **status**       |         any        | Returns the current status message of the node without taking any action                                                          |

### Toggle on / off (auto)
Turns the lights on or off depending on the current state based on the passed in **msg.payload** value of:

|  Property  | Type | Information                                                                                                   |
|:----------:|:----:|---------------------------------------------------------------------------------------------------------------|
| **toggle** |  any | Will turn on or turn off all lights inside the group with their previous configuration (color and brightness) |

### Special Alert Effect
Plays an alert effect based on the passed in **msg.payload** values of:

|  Property |        Type        | Information                                                                                                                         |
|:---------:|:------------------:|-------------------------------------------------------------------------------------------------------------------------------------|
| **alert** |  int *(required)*  | Configurable amount of seconds to play the alert effect (max 30)                                                                    |
|  **rgb**  | array[int,int,int] | Optionally configurable RGB color value of the alert effect. You don't need to pass the RGB value if you already passed a HEX value |
|  **hex**  |       string       | Optionally configurable HEX color value of the alert effect. You don't need to pass the HEX value if you already passed a RGB value |
| **color** |       string       | Optionally configurable human readable color name in english like "red" or "random" for a random color                              |

### Group Events
The event message that the group sends contains the following data in the **msg.payload** object. Events will only be sent if the group state is changed.

|       Property      |        Type        | Information                                                         |
|:-------------------:|:------------------:|---------------------------------------------------------------------|
|        **on**       |       boolean      | True for on, false for off                                          |
|      **allOn**      |       boolean      | True if all lights in the group are on, false if not                |
|      **anyOn**      |       boolean      | True if any lights in the group are on, false if none are on        |
|    **brightness**   |         int        | Current brightness of all lights in the whole group in percent      |
| **brightnessLevel** |         int        | Current brightness of all lights in the whole group (0-254)         |
|       **rgb**       | array[int,int,int] | Current RGB color value of all lights in the group (if supported)   |
|       **hex**       |       string       | Current HEX color value of all lights in the group (if supported)   |
|      **color**      |       string       | Current color name of all lights in the group (if supported)        |
|    **colorTemp**    |         int        | Current color temperature of all lights in the group (if supported) |
|     **updated**     |       string       | ISO 8601 date string of the last group state update                 |

### Additional Group Information
The event message that the group sends also contains the following data in the **msg.info** object.

|   Property   |  Type  | Information                                                                                                                                                                                                                                                                                                                                                     |
|:------------:|:------:|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|    **id**    |   int  | Group Id, generated automatically by the bridge                                                                                                                                                                                                                                                                                                                 |
| **lightIds** |  array | An array of light ids associated with the group                                                                                                                                                                                                                                                                                                                 |
|   **name**   | string | Name for the group                                                                                                                                                                                                                                                                                                                                              |
|   **type**   | string | Type of group (e.g. LightGroup, Luminaire, LightSource, Room)                                                                                                                                                                                                                                                                                                   |
|   **model**  | object | [Huejay](https://github.com/sqmk/huejay) *(the API behind HueMagic)* maintains a list of Philips Hue supported luminaire models. The Group model attribute returns optionally a GroupModel object. This object contains more information about the model like the model.id, model.manufacturer, model.name, model.type, model.colorGamut and model.friendsOfHue |

### Universal Mode (optional)
Defines the group Id on the Hue Bridge manually if not configured in the node properties (deactivates group update events):

|    Property   | Type | Information                       |
|:-------------:|:----:|-----------------------------------|
| **msg.topic** |  int | Manual definition of the group Id |

### Last State Information
This node also sends the entire last state data (before the update) in the **msg.lastState** object. It can either contain false (boolean) or the objects payload (msg.lastState.payload) and info (msg.lastState.info). The return value "false" is only sent if there was no last state, e.g. when the node was newly created or restarted.

## Hue Scenes
Use the Hue Scene node to recall / activate preconfigured scenes on the bridge and receive scene information.

![Hue Scene Example](https://user-images.githubusercontent.com/5302050/95681729-d8561780-0be1-11eb-8b7e-cb579f728c7b.png)

### Recall / Activate Scene
**Any** passed in value on the scene node activates the preconfigured scene. Please note that recalling animated scenes may not work properly due to some restrictions.

### Apply scenes dynamically
When no scene is configured a scene name or scene Id must be passed in to activate that scene. It is also possible to pass a group Id dynamically to recall a scene on a specific group only. The following parameters can be passed manually in **msg.payload**.

|  Property |  Type  | Information                                        |
|:---------:|:------:|----------------------------------------------------|
| **scene** | string | Will activate the scene given by its name or id.   |
| **group** |   int  | Will recall a scene on a specific group by its id. |

### Scene Events
The event message that the scene node sends contains the following data in the **msg.payload** object. Events will only be sent if a scene receives any command.

|     Property    |     Type    | Information                                                      |
|:---------------:|:-----------:|------------------------------------------------------------------|
|      **id**     |    string   | The unique scene id                                              |
|     **name**    |    string   | The scene name                                                   |
|   **lightIds**  | array[int…] | Array of associated light ids in the scene                       |
|    **owner**    |    string   | User who created the scene                                       |
|   **appData**   |    object   | Object consisting of appData.version and appData.data properties |
| **lastUpdated** |    string   | ISO 8601 date string when scene was last updated                 |
|   **version**   |    float    | Version number of the scene                                      |

## Hue Tap
Use the Hue Tap node to receive button events.

![Hue Tap Example](https://user-images.githubusercontent.com/5302050/95681757-ea37ba80-0be1-11eb-91ee-a2100f058122.png)

### Button Events
The event message that the Hue Tap device sends contains the following data in the **msg.payload** object. Events will only sent on deploy (once) and if a button is pressed.

|    Property   |  Type  | Information                                                  |
|:-------------:|:------:|--------------------------------------------------------------|
|   **button**  |   int  | Pressed button number from 1-4                               |
| **buttonAlt** |   int  | Alternative pressed button number (unparsed from the bridge) |
|  **updated**  | string | ISO 8601 date string of the last button event                |

### Additional Hue Tap Information
The event message that the Hue Tap device sends also contains the following data in the **msg.info** object.

|   Property   |  Type  | Information                                                                                                                         |
|:------------:|:------:|-------------------------------------------------------------------------------------------------------------------------------------|
|    **id**    |   int  | Numerical id of the sensor as registered on the bridge                                                                              |
| **uniqueId** | string | Unique Id of the sensor (typically hardware id)                                                                                     |
|   **name**   | string | Name for the sensor                                                                                                                 |
|   **type**   | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
|   **model**  | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

### Check Status
Retrieves the status of the sensor by passing the following parameters to the **msg.payload**.

|  Property  | Type | Information                                                      |
|:----------:|:----:|------------------------------------------------------------------|
| **status** |  any | Returns the current status of the node without taking any action |

### Universal Mode (optional)
Defines the sensor Id on the Hue Bridge manually if not configured in the node properties:

|    Property   | Type | Information                        |
|:-------------:|:----:|------------------------------------|
| **msg.topic** |  int | Manual definition of the sensor Id |

### Last State Information
This node also sends the entire last state data (before the update) in the **msg.lastState** object. It can either contain false (boolean) or the objects payload (msg.lastState.payload) and info (msg.lastState.info). The return value "false" is only sent if there was no last state, e.g. when the node was newly created or restarted.

## Hue Switch
Use the Hue Switch node to receive button events.

![Hue Switch Example](https://user-images.githubusercontent.com/5302050/95681773-f58ae600-0be1-11eb-8867-966d0d85e30f.png)

### Button Events
The event message that the Hue Wireless Dimmer Switch sends contains the following data in the **msg.payload** object. Events will only sent on deploy (once) and if a button is pressed.

|   Property  |  Type  | Information                                                                                                                           |
|:-----------:|:------:|---------------------------------------------------------------------------------------------------------------------------------------|
|  **button** |   int  | Pressed button id ([more information under 1.2 ZLL Switch](https://developers.meethue.com/documentation/supported-sensors#zgpSwitch)) |
|   **name**  | string | Human readable pressed button name *(On, Dim Up, Dim Down, Off)*                                                                      |
|  **action** | string | Human readable pressed button action *(pressed, holded, short released, long released)*                                               |
| **updated** | string | ISO 8601 date string of the last button event                                                                                         |

### Additional Hue Switch Information
The event message that the Hue Wireless Dimmer Switch device sends also contains the following data in the **msg.info** object.

|   Property   |  Type  | Information                                                                                                                         |
|:------------:|:------:|-------------------------------------------------------------------------------------------------------------------------------------|
|    **id**    |   int  | Numerical id of the sensor as registered on the bridge                                                                              |
| **uniqueId** | string | Unique Id of the sensor (typically hardware id)                                                                                     |
|   **name**   | string | Name for the sensor                                                                                                                 |
|   **type**   | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
|  **battery** |   int  | Current battery level of the Hue Switch in percent                                                                                  |
|   **model**  | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

### Check Status
Retrieves the status of the sensor by passing the following parameters to the **msg.payload**.

|  Property  | Type | Information                                                      |
|:----------:|:----:|------------------------------------------------------------------|
| **status** |  any | Returns the current status of the node without taking any action |

### Universal Mode (optional)
Defines the sensor Id on the Hue Bridge manually if not configured in the node properties:

|    Property   | Type | Information                        |
|:-------------:|:----:|------------------------------------|
| **msg.topic** |  int | Manual definition of the sensor Id |

### Last State Information
This node also sends the entire last state data (before the update) in the **msg.lastState** object. It can either contain false (boolean) or the objects payload (msg.lastState.payload) and info (msg.lastState.info). The return value "false" is only sent if there was no last state, e.g. when the node was newly created or restarted.

## Hue Button
Use the Hue Button node to receive button events.

![Hue Button Example](https://user-images.githubusercontent.com/5302050/95681786-02a7d500-0be2-11eb-9cfd-423b27e6b189.png)

### Button Events
The event message that the Hue Smart Button sends contains the following data in the **msg.payload** object.

|   Property  |  Type  | Information                                                                                         |
|:-----------:|:------:|-----------------------------------------------------------------------------------------------------|
|  **button** |   int  | Pressed button id, 1002 for normal press, 1003 for long press (release) and 1001 during long press. |
|   **name**  | string | Human readable pressed button name *(always On)*                                                    |
|  **action** | string | Human readable pressed button action *(short released, long released, holded)*                      |
| **updated** | string | ISO 8601 date string of the last button event                                                       |

### Additional Hue Button Information
The event message that the Hue Button device sends also contains the following data in the **msg.info** object.

|   Property   |  Type  | Information                                                                                                                         |
|:------------:|:------:|-------------------------------------------------------------------------------------------------------------------------------------|
|    **id**    |   int  | Numerical id of the sensor as registered on the bridge                                                                              |
| **uniqueId** | string | Unique Id of the sensor (typically hardware id)                                                                                     |
|   **name**   | string | Name for the sensor                                                                                                                 |
|   **type**   | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
|  **battery** |   int  | Current battery level of the Hue Switch in percent                                                                                  |
|   **model**  | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

### Last State Information
This node also sends the entire last state data (before the update) in the **msg.lastState** object. It can either contain false (boolean) or the objects payload (msg.lastState.payload) and info (msg.lastState.info). The return value "false" is only sent if there was no last state, e.g. when the node was newly created or restarted.

## Hue Motion Sensor
Use the Hue Motion node to control the motion sensor and receive motion events.

![Hue Motion Example](https://user-images.githubusercontent.com/5302050/95681811-1e12e000-0be2-11eb-9085-196bfff0c775.png)

### Activate / Deactivate Sensor
Activates or deactivates the motion sensor based on the passed in **msg** values of:

|   Property  |   Type  | Information                                                              |
|:-----------:|:-------:|--------------------------------------------------------------------------|
| **payload** | boolean | True to activate the motion sensor, false to deactivate                  |
|  **status** |   any   | Returns the current status message of the node without taking any action |

### Motion Events
The event message that the motion sensor sends contains the following data in the **msg.payload** object. Events will only be sent if a motion is detected, if a motion stops or if the motion sensor receives the *Activate / Deactivate* command.

|   Property  |   Type  | Information                                      |
|:-----------:|:-------:|--------------------------------------------------|
|  **active** | boolean | Current sensor state                             |
|  **motion** | boolean | Indicates if a motion is detected or not         |
| **updated** |  string | ISO 8601 date string of the last detected motion |

### Additional Motion Sensor Information
The event message that the motion sensor sends also contains the following data in the **msg.info** object.

|       Property      |  Type  | Information                                                                                                                         |
|:-------------------:|:------:|-------------------------------------------------------------------------------------------------------------------------------------|
|        **id**       |   int  | Numerical id of the sensor as registered on the bridge                                                                              |
|     **uniqueId**    | string | Unique Id of the sensor (typically hardware id)                                                                                     |
|       **name**      | string | Name for the sensor                                                                                                                 |
|       **type**      | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
| **softwareVersion** |  float | Software version of the sensor                                                                                                      |
|     **battery**     |   int  | Current battery level of the temperature sensor in percent                                                                          |
|      **model**      | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

### Check Status
Retrieves the status of the sensor by passing the following parameters to the **msg.payload**.

|  Property  | Type | Information                                                      |
|:----------:|:----:|------------------------------------------------------------------|
| **status** |  any | Returns the current status of the node without taking any action |

### Universal Mode (optional)
Defines the sensor Id on the Hue Bridge manually if not configured in the node properties:

|    Property   | Type | Information                        |
|:-------------:|:----:|------------------------------------|
| **msg.topic** |  int | Manual definition of the sensor Id |

### Last State Information
This node also sends the entire last state data (before the update) in the **msg.lastState** object. It can either contain false (boolean) or the objects payload (msg.lastState.payload) and info (msg.lastState.info). The return value "false" is only sent if there was no last state, e.g. when the node was newly created or restarted.

## Hue Temperature Sensor
Use the Hue Temperature node to receive current (room) temperature in Celsius and Fahrenheit.

![Hue Temperature Example](https://user-images.githubusercontent.com/5302050/95681809-1e12e000-0be2-11eb-9b01-3e4e99313d0f.png)

### Temperature Events
The event message that the temperature sensor sends contains the following data in the **msg.payload** object. Events will only sent on deploy (once) and if the temperature changes.

|     Property    |  Type  | Information                                         |
|:---------------:|:------:|-----------------------------------------------------|
|   **celsius**   |  float | Temperature in Celsius                              |
|  **fahrenheit** |  float | Temperature in Fahrenheit                           |
| **deviceValue** |   int  | Temperature value of the sensor (original value)    |
|   **updated**   | string | ISO 8601 date string of the last temperature change |

### Additional Temperature Sensor Information
The event message that the temperature sensor sends also contains the following data in the **msg.info** object.

|       Property      |  Type  | Information                                                                                                                         |
|:-------------------:|:------:|-------------------------------------------------------------------------------------------------------------------------------------|
|        **id**       |   int  | Numerical id of the sensor as registered on the bridge                                                                              |
|     **uniqueId**    | string | Unique Id of the sensor (typically hardware id)                                                                                     |
|       **name**      | string | Name for the sensor                                                                                                                 |
|       **type**      | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
| **softwareVersion** |  float | Software version of the sensor                                                                                                      |
|     **battery**     |   int  | Current battery level of the temperature sensor in percent                                                                          |
|      **model**      | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

### Check Status
Retrieves the status of the sensor by passing the following parameters to the **msg.payload**.

|  Property  | Type | Information                                                      |
|:----------:|:----:|------------------------------------------------------------------|
| **status** |  any | Returns the current status of the node without taking any action |

### Universal Mode (optional)
Defines the sensor Id on the Hue Bridge manually if not configured in the node properties:

|    Property   | Type | Information                        |
|:-------------:|:----:|------------------------------------|
| **msg.topic** |  int | Manual definition of the sensor Id |

### Last State Information
This node also sends the entire last state data (before the update) in the **msg.lastState** object. It can either contain false (boolean) or the objects payload (msg.lastState.payload) and info (msg.lastState.info). The return value "false" is only sent if there was no last state, e.g. when the node was newly created or restarted.

## Hue Lux Sensor
Use the Hue Brightness node to receive the current light level in Lux and daylight / darkness.

![Hue Lux Example](https://user-images.githubusercontent.com/5302050/95681808-1d7a4980-0be2-11eb-8626-ea0a24b1733a.png)

### Light Level Events
The event message that the light sensor sends contains the following data in the **msg.payload** object. Events will only be sent on deploy (once) and if the light level changes.

|    Property    |   Type  | Information                                         |
|:--------------:|:-------:|-----------------------------------------------------|
|     **lux**    |   int   | Real lux value                                      |
| **lightlevel** |   int   | Light level                                         |
|    **dark**    | boolean | True if it's dark                                   |
|  **daylight**  | boolean | True if daylight recognized                         |
|   **updated**  |  string | ISO 8601 date string of the last light level update |

### Additional Lux Sensor Information
The event message that the lux sensor sends also contains the following data in the **msg.info** object.

|       Property      |  Type  | Information                                                                                                                         |
|:-------------------:|:------:|-------------------------------------------------------------------------------------------------------------------------------------|
|        **id**       |   int  | Numerical id of the sensor as registered on the bridge                                                                              |
|     **uniqueId**    | string | Unique Id of the sensor (typically hardware id)                                                                                     |
|       **name**      | string | Name for the sensor                                                                                                                 |
|       **type**      | string | Sensor type (e.g. Daylight, CLIPTemperature, ZGPSwitch)                                                                             |
| **softwareVersion** |  float | Software version of the sensor                                                                                                      |
|     **battery**     |   int  | Current battery level of the temperature sensor in percent                                                                          |
|      **model**      | object | The model object of the sensor includes model specific information like the model.id, model.manufacturer, model.name and model.type |

### Check Status
Retrieves the status of the sensor by passing the following parameters to the **msg.payload**.

|  Property  | Type | Information                                                      |
|:----------:|:----:|------------------------------------------------------------------|
| **status** |  any | Returns the current status of the node without taking any action |

### Universal Mode (optional)
Defines the sensor Id on the Hue Bridge manually if not configured in the node properties:

|    Property   | Type | Information                        |
|:-------------:|:----:|------------------------------------|
| **msg.topic** |  int | Manual definition of the sensor Id |

### Last State Information
This node also sends the entire last state data (before the update) in the **msg.lastState** object. It can either contain false (boolean) or the objects payload (msg.lastState.payload) and info (msg.lastState.info). The return value "false" is only sent if there was no last state, e.g. when the node was newly created or restarted.

## Hue Rules
Hue rule node to receive rule events or to enable / disable rules.

![Hue Rules Example](https://user-images.githubusercontent.com/5302050/95681806-1ce1b300-0be2-11eb-94b1-0c665ec5c160.png)

### Enable / Disable Rule
Activates or deactivates the rule based on the passed in **msg** values of:

|   Property  |   Type  | Information                               |
|:-----------:|:-------:|-------------------------------------------|
| **payload** | boolean | True to enable the rule, false to disable |

### Trigger events
The event message that the rule node sends contains the following data in the **msg.payload** object.

|    Property   |  Type  | Information                                              |
|:-------------:|:------:|----------------------------------------------------------|
| **triggered** | string | ISO 8601 date string of the last time rule was triggered |

### Additional Rule Info
Additional information about the rule is going to be sent to the **msg.info** object.

|      Property      |  Type  | Information                                           |
|:------------------:|:------:|-------------------------------------------------------|
|       **id**       |   int  | Numerical id of the rule as registered on the bridge  |
|     **created**    | string | ISO 8601 date string of the creation date of the rule |
|      **name**      | string | Name of the rule                                      |
| **timesTriggered** |   int  | Number of times rule was triggered                    |
|      **owner**     | string | User who created the rule                             |
|     **status**     | string | enabled or disabled, rule is triggerable on enabled   |

### Rule Conditions
An array of objects representing the rule conditions is going to be sent to the **msg.conditions** array.

|   Property   |  Type  | Information                                          |
|:------------:|:------:|------------------------------------------------------|
|  **address** | string | The sensor resource/state location for the condition |
| **operator** | string | The operator for the condition                       |
|   **value**  | string | The value used in conjunction with operator          |

### Rule Actions
An array of objects representing the rule actions is going to be sent to **msg.actions** array.

|   Property  |  Type  | Information                                   |
|:-----------:|:------:|-----------------------------------------------|
| **address** | string | The actionable resource location              |
|  **method** | string | Type of method for the action (e.g. GET, PUT) |
|   **body**  | object | The body of the action                        |

### Last State Information
This node also sends the entire last state data (before the update) in the **msg.lastState** object. It can either contain false (boolean) or the objects payload (msg.lastState.payload) and info (msg.lastState.info). The return value "false" is only sent if there was no last state, e.g. when the node was newly created or restarted.

# Changelog

### v3.0.0 (latest)
* Hue Motion, Hue Brightness, Hue Tap, Hue Switch & Hue Button nodes can now receive a status request
* New "Universal Mode" for the Hue Motion, Hue Brightness, Hue Tap, Hue Switch & Hue Button nodes
* The "colorTemp" property for Hue Light & Hue Group nodes can now also be set to "cold", "normal", "warm" or "auto"
* New dynamic and automatically calculated color temperature based on the current time ("auto" mode in "colorTemp" property)
* Nodes in "Universal Mode" are now also able to receive all events from devices of its type (optional)
* Hue Magic animations are now prerendered to improve performance
* 3 new Hue Magic animations ("Milkyway", "Beach" & "Forest")
* New (simple) Hue Button example flow
* Updated docs for almost all nodes and README
* Fixed an error with future states and the HTTP request node ([#200](https://github.com/Foddy/node-red-contrib-huemagic/pull/200))
* Other optimizations, dependency updates and clean up

### v2.8.6
* Optimized random color mode for Hue Magic, Hue Light & Hue Group nodes ([#190](https://github.com/Foddy/node-red-contrib-huemagic/pull/190))
* New Hue Button node ([#191](https://github.com/Foddy/node-red-contrib-huemagic/pull/191))
* Updated README and Hue Button node docs (+ localized in German)

### v2.8.2
* Fixed an issue with Hue Light & Hue Group nodes on extended mode ([#179](https://github.com/Foddy/node-red-contrib-huemagic/issues/179))
* Dependency updates

### Previous versions
A complete overview of the updates can be viewed in the [changelog](https://github.com/Foddy/node-red-contrib-huemagic/blob/master/CHANGELOG.md)…


***
<a href="https://en.wikipedia.org/wiki/Stuttgart" target="_blank"><img src="https://gistcdn.githack.com/Foddy/0e2e2598e98ecdf3c9990dcf809c1752/raw/1807bc9d75aee1484be2f78678e14959497f764a/madewithlove.svg" height="50"></a>

Do you like HueMagic? If so, make sure to give this project a star! If you want to support the development, you can also do so with a donation. HueMagic remains completely free for everyone - even without a donation. Thank you! :)
***
<a href="https://www.jetbrains.com/?from=HueMagic"><img src="https://gistcdn.githack.com/Foddy/062045775c28f5993ad646aba80e678c/raw/c84ea4ad31c72dde0883638fc9eaa2b51bba9962/jb.svg" height="50"></a> <a href="https://www.browserstack.com?from=HueMagic"><img src="https://gistcdn.githack.com/Foddy/062045775c28f5993ad646aba80e678c/raw/c84ea4ad31c72dde0883638fc9eaa2b51bba9962/browserstack.svg" height="50"></a>

HueMagic for Node-RED is sponsored by [JetBrains](https://www.jetbrains.com/?from=HueMagic) and [BrowserStack](https://www.browserstack.com?from=HueMagic).<br>
*Released under the [Apache License 2.0](https://tldrlegal.com/license/apache-license-2.0-(apache-2.0)).*