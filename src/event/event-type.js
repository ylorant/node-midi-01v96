let MixerEventType = {
    // Base types
    SCENE: "scene",
    FUNCTION_CALL: "functionCall",
    SETUP: "setup",

    // Scene event types
    CHANNEL_LEVEL: "channelLevel",
    CHANNEL_ON: "channelOn",

    // Function call types
    SCENE_RECALL: "sceneRecall",
    SCENE_STORE: "sceneStore",
    
    // Setup events
    SOLO_CHANNEL: "soloChannel",
    SOLO_MASTER: "soloMaster",
    SOLO_GROUP: "soloGroup",
}

module.exports = MixerEventType;