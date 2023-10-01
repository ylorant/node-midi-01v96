const SetupElement = require("../enum/setup-element");
const MixerEvent = require("./event");
const MixerEventType = require("./event-type");
const { fromMessage } = require("./scene");

const BUS_COUNT = 8;

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
        event.channel = event.parseChannel(msg[8]);

        // Skip event if type returned is not recognized
        if (!event.type) {
            return null;
        }

        let valueFunc = event.getParseValueFunc();
        event.value = msg.slice(9,13);

        if (valueFunc) {
            event.value = valueFunc(event.value);
        }

        return event;
    }

    typeFromElement(element, parameter)
    {
        let paramFilter = null;
        let type = null;

        switch (element) {
            case SetupElement.SOLO_CH_ON: paramFilter = 0x00; type = MixerEventType.SOLO_CHANNEL; break;
            case SetupElement.SOLO_MASTER_ON: paramFilter = 0x00; type = MixerEventType.SOLO_MASTER; break;
            case SetupElement.GROUP_SOLO_ON: paramFilter = 0x00; type = MixerEventType.SOLO_IN_GROUP_MASTER; break;
            case SetupElement.GROUP_SOLO_MASTER_ON: paramFilter = 0x00; type = MixerEventType.SOLO_OUT_GROUP_MASTER; break;
            default: return null;
        }

        // Parameter filtering here prevents triggering events on sub-parameter reporting by the mixer
        if (paramFilter !== null && parameter != paramFilter) {
            return null;
        }

        return type;
    }


    parseChannel(channel)
    {
        if (this.type == MixerEventType.SOLO_MASTER) {
            this.type = MixerEventType.SOLO_BUS;
            if (channel >= BUS_COUNT) {
                channel -= BUS_COUNT;
                this.type = MixerEventType.SOLO_AUX;
            }
        }

        return channel + 1;
    }

    getParseValueFunc()
    {
        switch (this.type) {
            case MixerEventType.SOLO_CHANNEL:
            case MixerEventType.SOLO_MASTER:
            case MixerEventType.SOLO_AUX:
            case MixerEventType.SOLO_BUS:
            case MixerEventType.SOLO_IN_GROUP_MASTER:
            case MixerEventType.SOLO_OUT_GROUP_MASTER:
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