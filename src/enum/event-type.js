let MixerElement = require('./mixer-elements');

let MixerEventType = {
    CHANNEL_LEVEL: "channelLevel",
    CHANNEL_ON: "channelOn",

    fromMixerElement: function(mixeEl)
    {
        switch (mixeEl) {
            case MixerElement.CHANNEL_FADER: return this.CHANNEL_LEVEL;
            case MixerElement.CHANNEL_ON: return this.CHANNEL_ON;
            default: return null;
        }
    },

    getParseValueFunc: function(eventType)
    {
        switch (eventType) {
            case MixerEventType.CHANNEL_LEVEL: return this.parseFaderData;
            case MixerEventType.CHANNEL_ON: return this.parseOnData;
            default: return null;
        }
    },

    /**
     * Parses fader data from the mixer and gives out the actual volume in percent.
     * 
     * @param {array} data Fader data from the mixer
     * @param {Yamaha01v96} mixer The mixer instance, to fetch settings
     * @returns The parsed fader between 0 and 100.
     */
    parseFaderData: function(data, mixer)
    {
        let parsedValue = (data[2]<<7) + data[3];

        if (mixer.faderRange == "absolute") {
            let multiplier = mixer.faderResolution === "high" ? 1024 : 255;
            parsedValue = Math.round(parsedValue * 100 / multiplier);
        } else {
            let baseMultiplier = mixer.faderResolution === "high" ? 823 : 207,
                overMultiplier = mixer.faderResolution === "high" ? 200 : 48,
                baseValue = Math.round(parsedValue * 100 / baseMultiplier),
                overValue = 0;

            if (parsedValue > baseMultiplier) {
                baseValue = 100;
                overValue = Math.round((parsedValue - baseMultiplier) * 100 / overMultiplier);
            }

            parsedValue = baseValue + overValue;
        }

        return parsedValue;
    },

    parseOnData: function(data)
    {
        return !!data[3];
    }
}

module.exports = MixerEventType;