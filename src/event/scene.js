const MixerElement = require("../enum/mixer-element");
const MixerEvent = require("./event");
const MixerEventType = require("./event-type");

const MASTER_EVENTS = [
    MixerEventType.BUS_LEVEL,
    MixerEventType.BUS_ON,
    MixerEventType.AUX_LEVEL,
    MixerEventType.AUX_ON
];

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
        event.channel = event.parseChannel(msg[8]);
        
        // Getting the value parsing function and computing the value with it
        event.value = null;
        let parseValueFunc = event.getParseValueFunc();

        if (parseValueFunc) {
            event.value = parseValueFunc.call(this, msg.slice(9, 13), mixer);
        }

        return event;
    }

    typeFromMixerElement(mixerEl)
    {
        switch (mixerEl) {
            case MixerElement.CHANNEL_FADER: return MixerEventType.CHANNEL_LEVEL;
            case MixerElement.CHANNEL_ON: return MixerEventType.CHANNEL_ON;
            case MixerElement.BUS_FADER: return MixerEventType.BUS_LEVEL;
            case MixerElement.BUS_ON: return MixerEventType.BUS_ON;
            case MixerElement.AUX_FADER: return MixerEventType.AUX_LEVEL;
            case MixerElement.AUX_ON: return MixerEventType.AUX_ON;
            default: return null;
        }
    }

    parseChannel(channel)
    {
        return channel + 1;
    }

    getParseValueFunc()
    {
        switch (this.type) {
            case MixerEventType.CHANNEL_LEVEL: 
            case MixerEventType.BUS_LEVEL: 
            case MixerEventType.AUX_LEVEL: 
                return this.parseFaderData;
            case MixerEventType.CHANNEL_ON: 
            case MixerEventType.BUS_ON: 
            case MixerEventType.AUX_ON: 
                return this.parseOnData;
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

        // We force absolute range for master faders as they're ranked only up to 0db
        if (mixer.faderRange == "absolute" || MASTER_EVENTS.includes(this.type)) {
            let multiplier = mixer.faderResolution === "high" ? 1024 : 255;
            parsedValue = parsedValue * 100 / multiplier;
        } else {
            let baseMultiplier = mixer.faderResolution === "high" ? 823 : 207,
                overMultiplier = mixer.faderResolution === "high" ? 200 : 48,
                baseValue = parsedValue * 100 / baseMultiplier,
                overValue = 0;

            if (parsedValue > baseMultiplier) {
                baseValue = 100;
                overValue = (parsedValue - baseMultiplier) * 100 / overMultiplier;
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