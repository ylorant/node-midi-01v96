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
    IN_GROUP_MASTER_LEVEL: "inGroupMasterLevel",
    IN_GROUP_MASTER_ON: "inGroupMasterOn",
    OUT_GROUP_MASTER_LEVEL: "outGroupMasterLevel",
    OUT_GROUP_MASTER_ON: "outGroupMasterOn",

    // Function call types
    SCENE_RECALL: "sceneRecall",
    SCENE_STORE: "sceneStore",
    
    // Setup events
    SOLO_CHANNEL: "soloChannel",
    SOLO_MASTER: "soloMaster",
    SOLO_AUX: "soloAux",
    SOLO_BUS: "soloBus",
    SOLO_IN_GROUP_MASTER: "soloInGroupMaster",
    SOLO_OUT_GROUP_MASTER: "soloOutGroupMaster"
}

module.exports = MixerEventType;