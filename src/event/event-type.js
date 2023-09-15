let MixerEventType = {
    // Base types
    SCENE: "scene",
    FUNCTION_CALL: "functionCall",

    // Scene event types
    CHANNEL_LEVEL: "channelLevel",
    CHANNEL_ON: "channelOn",

    // Function call types
    SCENE_RECALL: "sceneRecall",
    SCENE_STORE: "sceneStore"
}

module.exports = MixerEventType;