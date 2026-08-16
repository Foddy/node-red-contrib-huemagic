[![Hue Magic Logo](https://raw.githubusercontent.com/Foddy/node-red-contrib-huemagic/master/docs/images/huemagic-logo.svg)](https://flows.nodered.org/node/node-red-contrib-huemagic)

# Changelog

### v5.0.0 (latest)

> **Attention!** HueMagic v5 requires **Node.js 18+** and **Node-RED v3+**. The "Hue Group" node now speaks the CLIP/v2 API instead of the legacy API, and the alert effect on the "Hue Light" & "Hue Group" nodes is now played by the bridge itself, which also restores the previous state on its own. Your existing flows keep working as they are — no reconfiguration needed.

**New devices and features**

* New "Hue Speaker" node plays the sounds of a Hue Secure chime and can use it as an indoor siren
* New "Hue Automation" node enables and disables the automations you created in the Philips Hue app — the modern successor to the rules of the legacy API
* The "Hue Motion" node now also covers Hue Secure cameras and, on the Hue Bridge Pro, the MotionAware areas that turn your lights into motion sensors
* Cameras and MotionAware areas can be made more or less sensitive
* The "Hue Buttons" node now also reports the Hue Secure video doorbell
* The Hue wall switch module can be switched between rocker and pushbutton mode ([#331](https://github.com/Foddy/node-red-contrib-huemagic/issues/331)) (thx @KGS501)
* The "Hue Light" node can play the built-in effects of a light (`candle`, `fire`, `sparkle`, `prism` and more)
* The "Hue Light" node can play the `sunrise` and `sunset` simulation of a light for up to six hours
* The behaviour of a light after a power cut can now be configured (`safety`, `powerfail`, `last_on_state` or `custom`)
* The mode of a gradient can now be set, so the colors are spread as an interpolated, mirrored, pixelated or segmented palette
* The "Hue Motion" and "Hue Brightness" nodes now also read the grouped sensors the bridge aggregates for a room or zone
* New "Hue Sync Box" node controls a Philips Hue Play HDMI Sync Box over its own local API — modes, intensity, brightness, HDMI input and entertainment area ([#195](https://github.com/Foddy/node-red-contrib-huemagic/issues/195)) (thx @masterfish1)
* The "Hue Scene" node can now recall a scene with its own transition time and brightness, so the same scene can be applied slowly or dimmed depending on the time of day ([#392](https://github.com/Foddy/node-red-contrib-huemagic/issues/392)) (thx @guenter-ms)
* Scenes in the node configuration are now sorted by room or zone first and then by name, so the scenes of one room stay together ([#259](https://github.com/Foddy/node-red-contrib-huemagic/issues/259)) (thx @hendersj)
* The "Hue Brightness" node lets you set the light level below which a room counts as dark instead of insisting on a fixed value ([#279](https://github.com/Foddy/node-red-contrib-huemagic/issues/279)) (thx @kazzyUK)
* The "Hue Temperature" node can correct the measured value with an offset, so a sensor that reads too warm can finally be calibrated ([#205](https://github.com/Foddy/node-red-contrib-huemagic/issues/205)) (thx @tutenchamun)
* Every node that reports events can now be set to "Only report after a command", so it stays silent when a light is changed in the app or by a switch and only answers your own commands ([#247](https://github.com/Foddy/node-red-contrib-huemagic/issues/247)) (thx @adams-family)
* New example flows for the "Hue Speaker", "Hue Automation" and "Hue Sync Box" nodes

**Philips Hue Bridge Pro**

* Support for the Philips Hue Bridge Pro: the API key is now requested over HTTPS, because modern bridges no longer answer on plain HTTP ([#454](https://github.com/Foddy/node-red-contrib-huemagic/issues/454)) ([#452](https://github.com/Foddy/node-red-contrib-huemagic/issues/452)) (thx @ozdeadmeat & @JGoor)
* Requesting the API key now keeps asking the bridge for a minute instead of guessing a single moment
* Fixed a crash that took down the whole Node-RED instance as soon as a Bridge Pro streamed an unknown service type ([#453](https://github.com/Foddy/node-red-contrib-huemagic/issues/453)) (thx @lmuser22)
* Bridges are now also discovered when they run on a port other than 443

**Stability**

* HueMagic no longer takes Node-RED down with it — all known uncaught exceptions and unhandled promise rejections have been closed ([#435](https://github.com/Foddy/node-red-contrib-huemagic/issues/435)) ([#398](https://github.com/Foddy/node-red-contrib-huemagic/issues/398)) ([#388](https://github.com/Foddy/node-red-contrib-huemagic/issues/388)) ([#366](https://github.com/Foddy/node-red-contrib-huemagic/issues/366)) ([#336](https://github.com/Foddy/node-red-contrib-huemagic/issues/336)) ([#326](https://github.com/Foddy/node-red-contrib-huemagic/issues/326)) ([#321](https://github.com/Foddy/node-red-contrib-huemagic/issues/321)) ([#312](https://github.com/Foddy/node-red-contrib-huemagic/issues/312)) ([#306](https://github.com/Foddy/node-red-contrib-huemagic/issues/306)) ([#304](https://github.com/Foddy/node-red-contrib-huemagic/issues/304)) ([#270](https://github.com/Foddy/node-red-contrib-huemagic/issues/270)) (thx @MarkRoks, @TerryMcgurk, @CyrielRct, @Wombosvideo, @Zootopie-LG, @ddlsmurf, @nibbsification, @Darkman1900, @bmdevx & @McFozzy75)
* Commands are now paced to what the bridge actually accepts (about 10 light and 1 group command per second), so the worker setting no longer has to be turned down to 1 to avoid 429/503 errors ([#295](https://github.com/Foddy/node-red-contrib-huemagic/issues/295)) ([#350](https://github.com/Foddy/node-red-contrib-huemagic/issues/350)) ([#404](https://github.com/Foddy/node-red-contrib-huemagic/issues/404)) ([#431](https://github.com/Foddy/node-red-contrib-huemagic/issues/431)) ([#276](https://github.com/Foddy/node-red-contrib-huemagic/issues/276)) (thx @Brewj, @ralfhille, @hazymat, @bevrat & @hurenkam)
* The connection to the bridge is now rebuilt with a backoff instead of a reconnect storm, and a single failed request no longer restarts the whole bridge ([#372](https://github.com/Foddy/node-red-contrib-huemagic/issues/372)) ([#353](https://github.com/Foddy/node-red-contrib-huemagic/issues/353)) (thx @develmac & @Jai-Gogineni)
* The watchdog no longer tears down the event subscription every ten seconds, which stopped sensors and switches from reporting after a short while ([#384](https://github.com/Foddy/node-red-contrib-huemagic/issues/384)) ([#396](https://github.com/Foddy/node-red-contrib-huemagic/issues/396)) ([#358](https://github.com/Foddy/node-red-contrib-huemagic/issues/358)) ([#344](https://github.com/Foddy/node-red-contrib-huemagic/issues/344)) (thx @spacewalker0815, @bobhobelman, @otoivanen & @isaac-the-newt)
* Nodes now detach from the bridge when they are removed, so a re-deploy no longer makes them receive every event twice, three times, … ([#297](https://github.com/Foddy/node-red-contrib-huemagic/issues/297)) ([#301](https://github.com/Foddy/node-red-contrib-huemagic/issues/301)) ([#412](https://github.com/Foddy/node-red-contrib-huemagic/pull/412)) (thx @FreeTechNick, @ScottBevin & @FredBlo)
* One event in a batch that could not be assigned no longer discards all the following ones
* Devices that are added to or removed from the bridge are now picked up without restarting Node-RED
* Requests to the bridge never go through a configured HTTP proxy anymore, which broke the TLS connection on some setups ([#436](https://github.com/Foddy/node-red-contrib-huemagic/issues/436)) ([#265](https://github.com/Foddy/node-red-contrib-huemagic/issues/265)) (thx @rsch90 & @HonestJohn61)
* Timers and event listeners are properly cleaned up when a node is removed

**Nodes**

* The "Hue Group" node now speaks CLIP/v2, which brings back `incrementBrightness` & `decrementBrightness` and fixes groups without a legacy identifier ([#380](https://github.com/Foddy/node-red-contrib-huemagic/issues/380)) ([#400](https://github.com/Foddy/node-red-contrib-huemagic/issues/400)) ([#405](https://github.com/Foddy/node-red-contrib-huemagic/issues/405)) (thx @peterbaker, @SierraLimaOscar & @guenter-ms)
* The "Hue Group" node now also reports `brightness`, `brightnessLevel` and the current color ([#292](https://github.com/Foddy/node-red-contrib-huemagic/issues/292)) (thx @Schmetterfliege)
* Universal mode no longer fails on every other message and the "Hue Group" node finally receives messages in it ([#300](https://github.com/Foddy/node-red-contrib-huemagic/issues/300)) ([#305](https://github.com/Foddy/node-red-contrib-huemagic/issues/305)) ([#418](https://github.com/Foddy/node-red-contrib-huemagic/issues/418)) (thx @oxivanisher, @aL1aL7 & @vongomben)
* "The group is not yet available" is gone — groups, zones and third party devices are resolved correctly again ([#373](https://github.com/Foddy/node-red-contrib-huemagic/issues/373)) ([#374](https://github.com/Foddy/node-red-contrib-huemagic/issues/374)) ([#376](https://github.com/Foddy/node-red-contrib-huemagic/issues/376)) ([#314](https://github.com/Foddy/node-red-contrib-huemagic/issues/314)) ([#378](https://github.com/Foddy/node-red-contrib-huemagic/issues/378)) ([#377](https://github.com/Foddy/node-red-contrib-huemagic/issues/377)) ([#407](https://github.com/Foddy/node-red-contrib-huemagic/issues/407)) ([#395](https://github.com/Foddy/node-red-contrib-huemagic/issues/395)) (thx @Eggn1n3, @MarkRoks, @marsjupiter1, @andesse, @djiwondee, @Stieger81, @McFozzy75, @otoivanen & @traverseda)
* Turning a light or group off now always reaches the bridge, even if the cached state claimed it was already off ([#334](https://github.com/Foddy/node-red-contrib-huemagic/issues/334)) (thx @dewenni)
* Nodes no longer get stuck on "executing command…" after a command that changed nothing ([#315](https://github.com/Foddy/node-red-contrib-huemagic/issues/315)) ([#345](https://github.com/Foddy/node-red-contrib-huemagic/issues/345)) ([#382](https://github.com/Foddy/node-red-contrib-huemagic/issues/382)) ([#394](https://github.com/Foddy/node-red-contrib-huemagic/issues/394)) (thx @BlaM, @NodeRedFan & @adb336)
* The alert effect is no longer capped at 15 seconds and the bridge now restores the previous state itself, so groups no longer stay dark afterwards ([#451](https://github.com/Foddy/node-red-contrib-huemagic/issues/451)) ([#294](https://github.com/Foddy/node-red-contrib-huemagic/issues/294)) (thx @biosmanager & @spudje)
* The "Hue Buttons" node now reports the rotation of the Hue Tap Dial Switch and the Lutron Aurora ([#385](https://github.com/Foddy/node-red-contrib-huemagic/issues/385)) ([#275](https://github.com/Foddy/node-red-contrib-huemagic/issues/275)) (thx @WhiteSockedDancer & @hurenkam)
* The "Hue Buttons" node now also recognizes `long_press`, `long_release` and `double_short_release` ([#129](https://github.com/Foddy/node-red-contrib-huemagic/issues/129)) (thx @Tscherno)
* Sensors read their values from the reports of the current API, so motion, temperature and brightness stay correct on new firmwares ([#384](https://github.com/Foddy/node-red-contrib-huemagic/issues/384)) ([#396](https://github.com/Foddy/node-red-contrib-huemagic/issues/396)) ([#279](https://github.com/Foddy/node-red-contrib-huemagic/issues/279)) (thx @spacewalker0815, @bobhobelman & @kazzyUK)
* Devices without a battery (e.g. mains powered sensors) no longer break their node ([#446](https://github.com/Foddy/node-red-contrib-huemagic/issues/446)) (thx @DangersTR)
* The "Hue Contact" node now also reports whether the sensor has been tampered with and finally got its documentation and example flow
* The "Hue Scene" node supports smart scenes and no longer fails on scenes whose group has been deleted ([#447](https://github.com/Foddy/node-red-contrib-huemagic/issues/447)) ([#386](https://github.com/Foddy/node-red-contrib-huemagic/issues/386)) ([#449](https://github.com/Foddy/node-red-contrib-huemagic/issues/449)) ([#316](https://github.com/Foddy/node-red-contrib-huemagic/issues/316)) (thx @Himola, @danieldaeschle, @stijnbrocker & @andesse)
* The searches in the node configuration now report the real error instead of a generic one ([#449](https://github.com/Foddy/node-red-contrib-huemagic/issues/449)) ([#274](https://github.com/Foddy/node-red-contrib-huemagic/issues/274)) (thx @stijnbrocker & @TomGeoDK)
* `msg.lastState` now really contains the previous state instead of a reference to the current one ([#322](https://github.com/Foddy/node-red-contrib-huemagic/issues/322)) (thx @valiquette)
* Fixed the random color option, which threw an error instead of picking a color
* Fixed `brightnessLevel: 0` not turning a light or group off
* Fixed the state restoration after an animation on the "Hue Group" node
* Lights and groups no longer flicker when an animation restores their previous state

**Localization**

* All error messages, node states and log outputs are now translated instead of being hardcoded in English
* HueMagic now speaks ten languages: English, German, Spanish, French, Italian, Dutch, Portuguese, Polish, Turkish and Greek — node configuration, status texts, error messages and the complete node documentation
* The example flows are translated as well and live in one folder per language, so you can import them in your own language
* Completed the German translation, which was missing several texts in the node configuration
* The node icons are now rendered from the SVG versions that have been shipped since v4 but were never used

**Under the hood**

* Requires Node.js 18+ and Node-RED v3+, tested against Node-RED v5 on Node.js 24
* The event stream is now spoken directly instead of through the `eventsource` dependency, which had dropped support for older Node.js versions
* Connections to the bridge are kept alive instead of renegotiating TLS for every single request
* The HTTP endpoints of the node configuration now require an authenticated Node-RED editor session
* Updated all dependencies to their latest versions
* Added a test suite (`npm test`) that also guards the translations
* Published again, so all the fixes that were sitting on master since 2022 finally reach everyone ([#414](https://github.com/Foddy/node-red-contrib-huemagic/issues/414)) (thx @AleksCee)

### v4.2.2

* HueMagic can now be installed again on older Node-RED versions without official support
* Fixed an issue for Hue Group nodes not getting/updating their current status ([#342](https://github.com/Foddy/node-red-contrib-huemagic/issues/342)) (thx @bmdevx)
* Fixed an error with non-functioning node configurations

### v4.2.1

* Commands are now re-executed up to three times if they fail due to a bridge timeout
* The "image" option on the "Hue Light" node will now set the corresponding gradient colors on supported resources
* Better handling of broken connections to the bridge ([#309](https://github.com/Foddy/node-red-contrib-huemagic/pull/309)) (thx)
* Fixed an error with the "Hue Scenes" node on newer bridge firmwares ([#335](https://github.com/Foddy/node-red-contrib-huemagic/issues/335)) ([#339](https://github.com/Foddy/node-red-contrib-huemagic/pull/339)) (thx)
* Fixed an uncaught exception on newer bridge firmwares ([#302](https://github.com/Foddy/node-red-contrib-huemagic/issues/302)) ([#309](https://github.com/Foddy/node-red-contrib-huemagic/pull/309)) (thx)
* Updated dependencies to the latest versions
* Fixed some typos here and there

### v4.1.0

* New queue worker throttles the number of parallel requests to the bridge to avoid 503 API limit errors (can be configured in the Bridge configuration)
* Resources are now alphabetically sorted in the node's configuration interface ([#282](https://github.com/Foddy/node-red-contrib-huemagic/pull/282)) (thx)
* "Hue Brightness" node was optimized to output more accurate "dark" and "dayLight" values
* Several optimizations in the documentation of some nodes

### v4.0.5

* The "Hue Group" node now contains the "resources" information with all linked resources behind the group/zone
* Fixed an issue that caused Node-RED to restart if a command was sent before a node was initialized

### v4.0.4

* Fixed an issue with the bridge config node checking for updates too frequently ([#246](https://github.com/Foddy/node-red-contrib-huemagic/issues/246#issuecomment-1009376442))
* Fixed an issue with multiple bridges configured

### v4.0.3

> **Attention!** HueMagic v4+ has been almost completely rewritten under the hood and requires at least the (square-shaped) Philips Hue Bridge firmware 1948086000+ from November 1st, 2021 ([Upgrade instructions](https://www.lighting.philips.com/content/B2C/en_US/microsites/meethue/marketing-catalog/huewireless_ca/support/security-advisory/general/where-and-how-can-i-update-my-hue-system-with-the-latest-software.html)) and Node-RED v1+ ([Upgrade instructions](https://nodered.org/docs/getting-started/local#upgrading-node-red)). If you are upgrading from a previous HueMagic version to the v4, you will have to reconfigure (not completely rebuild) all nodes by clicking them and selecting the appropriate device from the list. This also applies to nodes / functions that are operated in universal mode, as the numeric identifiers of the latest Philips Hue API version have been replaced in UUIDs. The nodes "Hue Switch", "Hue Button" & "Hue Tap" have been replaced in v4 by the universal and uniform node "Hue Buttons", which works with all button / switch devices that are connected to the Hue Bridge (please note here also the new API in the documentation). The request and return objects of the individual nodes are largely compatible with older HueMagic versions - with the exception of the nodes "Hue Bridge", "Hue Buttons", "Hue Scene" & "Hue Group". These need to be adjusted in the v4. Make sure that you meet the minimum technical requirements and have a quiet minute for the migration before upgrading to the v4.

* HueMagic speaks now directly with the bridge without any submodules *(huejay dependency removed)*
* Migrated to the newest CLIP/v2 API version from the Philips Hue bridge
* Nodes are now updated via push notifications (SSE) from the bridge instead of periodic polling
* Instant "current status" queries on each node with no loading time
* "Hue Buttons" node supports all new Philips Hue buttons/switches (e.g. Dimmer Switch v2, Hue Wall Switch…)
* All nodes provide additional property information in the output (check docs)
* New universal node "Hue Buttons" replaces the following nodes: "Hue Switch", "Hue Button", "Hue Tap"
* New "updated" object for all nodes, which only contains the properties that have been updated since the last state
* New configuration option to suppress first message after node initialization (for all nodes)
* New gradient color setting for compatible light sources (in "Hue Light" node)
* New inject button for almost all nodes, which triggers the current status of a node
* New "universal mode" support for the "Hue Rule" node
* New SVG-version of each node icon for higher quality rendering in the Node-RED UI
* New and full featured examples for each node right inside Node-RED
* New color mix feature in "Hue Light" nodes with the ability to mix the current light color with another
* New automatic brightness support based on the current time for "Hue Light" & "Hue Group" nodes
* New "Superhero", "Neon City" & "Christmas" (for next year, sorry) animations in "Hue Magic" node
* The custom alert effect on "Hue Light" & "Hue Group" nodes can now also be configured in brightness
* All nodes will now also forward the last command that has been applied ([#249](https://github.com/Foddy/node-red-contrib-huemagic/issues/249))
* "Hue Temperature" & "Hue Brightness" nodes can now also be activated & deactivated
* "Hue Light" & "Hue Group" nodes can now also receive XY color settings
* "Hue Light" & "Hue Group" can now also receive a named color temperature setting
* "Hue Light" & "Hue Group" nodes can now receive future brightness states in "turned off" mode ([#244](https://github.com/Foddy/node-red-contrib-huemagic/issues/244))
* Automatic light temperature setting outputs now values from 153 (coldest) to 500 (warmest)
* Automatic color correction based on the light's capabilities for more accurate color settings
* Optimized node editor configuration UI to better match the current Node-RED's UI
* The option for "automatic firmware updates" on the bridge moved to the bridge configuration node
* "Hue Group" node does no longer contain the "msg.info.model" & "msg.info.class" property
* Fixed timeout connection issues to the bridge
* Fixed an issue with non stopping custom animations ([#222](https://github.com/Foddy/node-red-contrib-huemagic/issues/222)), ([#224](https://github.com/Foddy/node-red-contrib-huemagic/issues/224)) & ([#226](https://github.com/Foddy/node-red-contrib-huemagic/pull/226)) (thx)
* Node-RED will no longer crash if there is no active connection to the bridge ([#237](https://github.com/Foddy/node-red-contrib-huemagic/issues/237))
* Fixed an issue that prevented the light / group from not reporting its own status when queried & node events were deactivated ([#248](https://github.com/Foddy/node-red-contrib-huemagic/issues/248))
* Fixed an issue with nodes in universal mode ([#245](https://github.com/Foddy/node-red-contrib-huemagic/issues/245))
* A possible attack target has been fixed ([#217](https://github.com/Foddy/node-red-contrib-huemagic/issues/217))
* Moved away from "moment.js" to "Day.js" for date/time formatting inside the nodes
* Updated README and help section on each node
* Updated dependencies to the latest version

### v3.0.0
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