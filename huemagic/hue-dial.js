module.exports = function (RED) {
    "use strict";

    function HueDial(config) {
        RED.nodes.createNode(this, config);

        const scope = this;
        const bridge = RED.nodes.getNode(config.bridge);

        // SAVE LAST COMMAND
        this.lastCommand = null;

        //
        // CHECK CONFIG
        if (bridge == null) {
            this.status({fill: "red", shape: "ring", text: "hue-dial.node.not-configured"});
            return false;
        }

        //
        // UNIVERSAL MODE?
        if (!config.dialid) {
            this.status({fill: "grey", shape: "dot", text: "hue-dial.node.universal"});
        }

        //
        // UPDATE STATE
        if (config.dialid) {
            this.status({fill: "grey", shape: "dot", text: "hue-dial.node.waiting"});
        }

        //
        // SUBSCRIBE TO UPDATES FROM THE BRIDGE
        bridge.subscribe(scope, "relative_rotary", config.dialid, function (info) {
            let currentState = bridge.get("relative_rotary", info.id);

            // RESOURCE FOUND?
            if (currentState !== false) {
                // SEND MESSAGE
                if(!config.skipevents && (config.initevents || info.suppressMessage == false))
                {
                    // SET LAST COMMAND
                    if(scope.lastCommand !== null)
                    {
                        currentState.command = scope.lastCommand;
                    }
                    // SEND STATE
                    scope.send(currentState);

                    // RESET LAST COMMAND
                    scope.lastCommand = null;
                }


                // NOT IN UNIVERAL MODE? -> CHANGE UI STATES
                if(config.dialid)
                {
                    if(currentState.payload.rotation == false)
                    {
                        scope.status({fill: "red", shape: "ring", text: "hue-dial.node.waiting"});
                    }
                    else
                    {
                        scope.status({fill: "blue", shape: "dot", text: "hue-dial.node.rotation"});
                        // RESET TO WAITING AFTER 3 SECONDS
                        if(scope.timeout !== null) { clearTimeout(scope.timeout); };
                        scope.timeout = setTimeout(function()
                        {
                            scope.status({fill: "grey", shape: "dot", text: "hue-dial.node.waiting"});
                        }, 3000);
                    }
                }
            }
        });

        // ON COMMAND
        this.on('input', function(msg, send, done)
        {
            // REDEFINE SEND AND DONE IF NOT AVAILABLE
            done = done || function() { scope.done.apply(scope,arguments); }

            // SAVE LAST COMMAND
            scope.lastCommand = RED.util.cloneMessage(msg);

            // DEFINE SENSOR ID
            const tempdialID = (!config.dialid && typeof msg.topic != 'undefined' && bridge.validResourceID.test(msg.topic) === true) ? msg.topic : config.dialid;
            if(!tempdialID)
            {
                scope.error("Please submit a valid button ID.");
                return false;
            }

            let currentState = bridge.get("relative_rotary", tempdialID);
            if(!currentState)
            {
                scope.error("The dial switch in not yet available. Please wait until HueMagic has established a connection with the bridge or check whether the resource ID in the configuration is valid.");
                return false;
            }

            // GET CURRENT STATE
            if( (typeof msg.payload != 'undefined' && typeof msg.payload.status != 'undefined') || (typeof msg.__user_inject_props__ != 'undefined' && msg.__user_inject_props__ == "status") )
            {
                // SET LAST COMMAND
                if(scope.lastCommand !== null)
                {
                    currentState.command = scope.lastCommand;
                }

                // SEND STATE
                scope.send(currentState);

                // RESET LAST COMMAND
                scope.lastCommand = null;

                 done();
                return true;
            }
        });

        // ON NODE UNLOAD : UNSUBSCRIBE FROM BRIDGE
        this.on('close', function (done) {
            bridge.unsubscribe(scope);
            done();
        });
    }

    RED.nodes.registerType("hue-dial", HueDial);
}