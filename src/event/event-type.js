let MixerEventType = {
    // Base types
    SCENE: "scene",
    FUNCTION_CALL: "functionCall",
    SETUP: "setup",

    // Scene event types
    CHANNEL_LEVEL: "channelLevel",
    CHANNEL_ON: "channelOn",
    AUX_LEVEL: "auxLevel",
    AUX_ON: "auxOn",
    BUS_LEVEL: "busLevel",
    BUS_ON: "busOn",

    // Function call types
    SCENE_RECALL: "sceneRecall",
    SCENE_STORE: "sceneStore",
    
    // Setup events
    SOLO_CHANNEL: "soloChannel",
    SOLO_MASTER: "soloMaster",
    SOLO_AUX: "soloAux",
    SOLO_BUS: "soloBus",
    SOLO_GROUP: "soloGroup",
    SOLO_GROUP_MASTER: "soloGroupMaster"
}

module.exports = MixerEventType;