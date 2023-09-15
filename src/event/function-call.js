const LibraryFunction = require("../enum/library-function");
const MixerEvent = require("./event");
const MixerEventType = require("./event-type");

class FunctionCallEvent extends MixerEvent
{
    constructor()
    {
        super(MixerEventType.FUNCTION_CALL);

        this.target = null;
        this.channel = null;
    }

    static fromMessage(msg, mixer)
    {
        let event = new FunctionCallEvent();

        event.type = event.typeFromFunction(msg[6]) ?? event.type;
        event.target = event.wordFromData(msg.slice(7, 9));
        event.channel = event.wordFromData(msg.slice(9, 11));

        return event;
    }

    /**
     * Gets the event type from the function code.
     * 
     * @param {int} func The function code
     */
    typeFromFunction(func)
    {
        switch (func) {
            case LibraryFunction.SCENE_RECALL: return MixerEventType.SCENE_RECALL;
            case LibraryFunction.SCENE_STORE: return MixerEventType.SCENE_STORE;
        }
        
        return null;
    }

    /**
     * Converts 2-byte data from the mixer to its word (16-bit) value.
     * 
     * @param {array} data Data from the mixer.
     */
    wordFromData(data)
    {
        return (data[0]<<7) + data[1];
    }
}

module.exports = FunctionCallEvent;