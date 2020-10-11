[![Hue Magic Logo](https://gistcdn.githack.com/Foddy/062045775c28f5993ad646aba80e678c/raw/27e90d22bde68d9c92aed520c0c0c2cb8a22b7fd/huemagicv3x.svg)](https://flows.nodered.org/node/node-red-contrib-huemagic)

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

### v2.8.1
* Improved the speed of "future states" in Hue Group & Hue Light nodes

### v2.8.0
* Hue Light & Hue Group nodes can now receive commands even if the devices are off ([#110](https://github.com/Foddy/node-red-contrib-huemagic/issues/110) & [#155](https://github.com/Foddy/node-red-contrib-huemagic/issues/155))
* Hue Light nodes now set their status to switched off when they are not reachable ([#170](https://github.com/Foddy/node-red-contrib-huemagic/issues/170))

### v2.7.2
* Fixed an issue with Hue Group nodes ([#178](https://github.com/Foddy/node-red-contrib-huemagic/issues/178))

### v2.7.1
* Fixed a problem with "0" as topic in Hue Group nodes ([#166](https://github.com/Foddy/node-red-contrib-huemagic/issues/166))
* Fixed an issue with the active property on Hue Motion nodes ([#172](https://github.com/Foddy/node-red-contrib-huemagic/issues/172))
* Fixed a problem with "random" as a color command on Hue Group & Light nodes ([#167](https://github.com/Foddy/node-red-contrib-huemagic/issues/167))
* Dependency & readme updates

### v2.7.0
* Fixed an error on Hue Scene nodes ([#164](https://github.com/Foddy/node-red-contrib-huemagic/issues/164))
* New "lastState" property on every node (except Hue Magic & Hue Scene) with the last state before the update

### v2.6.5
* Fixed an error on Hue Group & Hue Light nodes ([#161](https://github.com/Foddy/node-red-contrib-huemagic/issues/161))
* The colorloop effect in Hue Group & Hue Light nodes can now be activated and deactivated manually ([#158](https://github.com/Foddy/node-red-contrib-huemagic/pull/158))
* New status property for Hue Light, Hue Group & Hue Motion nodes to request the current status of the devices ([#154](https://github.com/Foddy/node-red-contrib-huemagic/issues/154) & [#156](https://github.com/Foddy/node-red-contrib-huemagic/issues/156))
* Dependency updates

### v2.6.2
* New original temperature parameter on Hue Temperature nodes
* Nodes are now sending their status once after passing an action ([#150](https://github.com/Foddy/node-red-contrib-huemagic/issues/150) & [#153](https://github.com/Foddy/node-red-contrib-huemagic/issues/153))
* Fixed an issue on the Hue Motion node ([#145](https://github.com/Foddy/node-red-contrib-huemagic/issues/145))
* Dependency updates

### v2.6.1
* New option "incrementColorTemp" and "decrementBrightness" for Hue Light & Hue Group nodes ([#142](https://github.com/Foddy/node-red-contrib-huemagic/pull/142) / [#141](https://github.com/Foddy/node-red-contrib-huemagic/issues/141))
* Fixed an issue on the Hue Scene node ([#139](https://github.com/Foddy/node-red-contrib-huemagic/issues/139))
* Fixed an issue on the Hue Switch node ([#138](https://github.com/Foddy/node-red-contrib-huemagic/issues/138))
* Removed brightness layer on Hue Magic animation previews due to performance issues

### v2.6.0
* Hue Bridge node can now fetch "Portal" and "Internet Services" information
* Global device updates are now also pushed to the Hue Bridge node (check docs under "Global update events")
* Removed software update logs on the Bridge (#93)
* Message structures from each node are now outsourced

### v2.5.5
* Full German help docs translation of every node
* Delay between bridge requests has been reduced to 500ms from 700ms
* New "Strobo", "Random Rainbow" & "SOS" animations for the Hue Magic node
* Hue Magic previews now also display brightness animations
* Dependency updates

### v2.5.4
* New option "brightnessLevel" for Hue Light & Hue Group nodes (#134)
* Fixed an error on Hue Group & Hue Light nodes (#135)
* Fixed an error on Hue Magic node and Hue Magic examples (#136)

### v2.5.2
* Fixed an error with the brightness and transitionTime params on Hue Light & Hue Group nodes (#131)
* New option "ignoreOffLights" for Hue Group nodes to ignore state changes on turned off lights (#128)

### v2.5.1
* HueMagic nodes are now available in German
* All HueMagic nodes are now compatible with the new Node-RED "complete" & "catch" nodes (Node-RED v1.0+)
* Hue Bridge fetch actions now also send out an "info" object with further bridge information
* New Hue Bridge sample flow can be imported directly from Node-RED
* Fixed an issue with light & group nodes (#122)
* Code optimizations and clean up

### v2.2.6
* Hue scenes can now be applied on specific groups
* Hue Group nodes now support the option to select all groups / lights
* Optimized Hue Magic node to load dependencies locally

### v2.2.3
* API requests are called again via the absolute path

### v2.2.2
* New "Hue Magic" node with 12 animations included (check docs and examples)
* Sample flows for each node are now available and can be imported directly from Node-RED
* Fixed an issue which prevented output events on the nodes (#116)

### v2.1.1
* Fixed an issue with the new option "skip events" on each node

### v2.1.0
* Node updates can now be deactivated individually or globally (check node settings or Hue Bridge configuration)
* The "pressButton" option has been removed due to API restrictions on newer Hue Bridge firmwares (1.31+)

### v2.0.5
* A delay has been added to minimize API limit problems to the Hue Bridge
* The color parameter now supports random colors via "any" or "random" as input (Hue Light & Group nodes)

### v2.0.4
* Support of the Hue Smart plug (BETA)
* Support of alternative dimmer switches (check node docs, new property available)
* Fixed a problem in recheck loop ([#96](https://github.com/Foddy/node-red-contrib-huemagic/issues/96#issuecomment-530469447))
* Dependency updates

### v2.0.2
* New "Hue Rule" node (check node docs)
* New "fetch" command for the Hue Bridge node to get various information
* New "toggle" and "image" command for Hue Light and Group nodes
* Transitions and colorloop effects now support millisecond values (comma values)
* Optimized sequential requests to the bridge to avoid API limit errors
* Fixed validation errors when group or light nodes are used in universal mode
* Fixed a problem with human readable color names ([e354c0b](https://github.com/Foddy/node-red-contrib-huemagic/pull/84/commits/e354c0b3596d169fb25bd1e830df39adaf04dc73))
* Updated readme
* Dependency updates

### v1.9.0
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