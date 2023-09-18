const SetupElement = require("../enum/setup-element");
const MixerEvent = require("./event");
const MixerEventType = require("./event-type");
const { fromMessage } = require("./scene");

class SetupEvent extends MixerEvent
{
    constructor()
    {
        super(MixerEventType.SETUP);

        this.parameter = null;
        this.channel = null;
        this.value = null;
    }

    static fromMessage(msg, mixer)
    {
        let event = new SetupEvent();

        event.type = event.typeFromElement(msg[6], msg[7]);
        event.parameter = msg[7];
        event.channel = msg[8];

        // Skip event if type returned is not recognized
        if (!event.type) {
            return null;
        }

        let valueFunc = event.getParseValueFunc();
        event.value = valueFunc(msg.slice(9,13));

        return event;
    }

    typeFromElement(element, parameter)
    {
        let paramFilter = null;
        let type = null;

        switch (element) {
            case SetupElement.SOLO_CH_ON: paramFilter = 0x00; type = MixerEventType.SOLO_CHANNEL; break;
            case SetupElement.SOLO_MASTER_ON: paramFilter = 0x00; type = MixerEventType.SOLO_MASTER; break;
            case SetupElement.GROUP_SOLO_ON: paramFilter = 0x00; type = MixerEventType.SOLO_GROUP; break;
            default: return null;
        }

        if (paramFilter !== null && parameter != paramFilter) {
            return null;
        }

        return type;
    }


    getParseValueFunc()
    {
        switch (this.type) {
            case MixerEventType.SOLO_CHANNEL:
            case MixerEventType.SOLO_MASTER:
            case MixerEventType.SOLO_GROUP:
                return this.parseOnData;
            default: return null;
        }
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

module.exports = SetupEvent;