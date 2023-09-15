const MixerElement = require("../enum/mixer-elements");
const MixerEvent = require("./event");
const MixerEventType = require("./event-type");

class SceneEvent extends MixerEvent
{
    constructor()
    {
        super(MixerEventType.SCENE);

        this.channel = null;
        this.value = null;
    }

    static fromMessage(msg, mixer)
    {
        let event = new SceneEvent();
        event.type = event.typeFromMixerElement(msg[6]) ?? event.type;
        event.channel = msg[8] + 1;
        
        // Getting the value parsing function and computing the value with it
        event.value = null;
        let parseValueFunc = event.getParseValueFunc();

        if (parseValueFunc) {
            event.value = parseValueFunc(msg.slice(9, 13), mixer);
        }

        return event;
    }

    typeFromMixerElement(mixeEl)
    {
        switch (mixeEl) {
            case MixerElement.CHANNEL_FADER: return MixerEventType.CHANNEL_LEVEL;
            case MixerElement.CHANNEL_ON: return MixerEventType.CHANNEL_ON;
            default: return null;
        }
    }

    getParseValueFunc()
    {
        switch (this.type) {
            case MixerEventType.CHANNEL_LEVEL: return this.parseFaderData;
            case MixerEventType.CHANNEL_ON: return this.parseOnData;
            default: return null;
        }
    }

    /**
     * Parses fader data from the mixer and gives out the actual volume in percent.
     * 
     * @param {array} data Fader data from the mixer
     * @param {Yamaha01v96} mixer The mixer instance, to fetch settings
     * @returns The parsed fader between 0 and 100.
     */
    parseFaderData(data, mixer)
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
    }

    /**
     * Parses on/off data from the mixer.
     * 
     * @param {array} data Fader data from the mixer.
     * @returns 
     */
    parseOnData(data)
    {
        return !!data[3];
    }
}

module.exports = SceneEvent;