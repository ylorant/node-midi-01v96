let DataType = require('./enum/data-types');
let MixerEventType = require('./enum/event-type');

class MixerEvent
{
    constructor(type, channel, value)
    {
        this.type = type;
        this.channel = channel;
        this.value = value;
    }

    static parseMessage(msg, mixer)
    {
        // Ignore if the message isn't a SysEx with the good protocol
        if (msg[0] != 0xF0 || msg[1] != 0x43 || msg[3] != 0x3E) {
            return null;
        }

        // Ignore the messages if it's less than 14 bytes long
        if (msg.length < 14) {
            return null;
        }

        // For now skip meter update messages
        if (msg[5] == DataType.REMOTE_METER) {
            return null;
        }

        let eventType = MixerEventType.fromMixerElement(msg[6]);
        let channel = msg[8] + 1;
        
        // Getting the value parsing function and computing the value with it
        let value = null;
        let parseValueFunc = MixerEventType.getParseValueFunc(eventType);

        if (parseValueFunc) {
            value = parseValueFunc(msg.slice(9, 13), mixer);
        }

        let event = new MixerEvent(eventType, channel, value);

        return event;
    }
}

module.exports = MixerEvent;