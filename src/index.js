const EventEmitter = require('events');
const Midi = require('midi');

const MixerEvent = require('./event');

// Constants
const SYSEX_HEADER = [0xF0, 0x43, 0x00, 0x3E];
const CHANNEL_COUNT = 32;
const AUX_COUNT = 8;
const BUS_COUNT = 8;

const SubStatus = require('./enum/sub-status');
const DataType = require('./enum/data-types');
const MixerElement = require('./enum/mixer-elements');
const ParameterFormat = require('./enum/parameter-format');

class Yamaha01v96 extends EventEmitter
{
    constructor()
    {
        super();

        // Midi devices
        this.input = new Midi.Input();
        this.output = new Midi.Output();

        // Internal sdefault settings
        this.faderResolution = Yamaha01v96.RES_LOW;
        this.faderRange = Yamaha01v96.RANGE_ABSOLUTE;

        // MIDI setup
        this.input.on("message", this.onMidiMessage.bind(this));
        this.input.ignoreTypes(false, false, false);
    }

    /**
     * Gets the available compatible MIDI devices.
     * 
     * @param bool allDevices Set to true to return all devices.
     * 
     * @returns object The list of available devices as an object with "input" and "output" keys for sorting.
     */
    getDevices(allDevices = false)
    {
        let count = 0;
        let i;
        let devices = {input: {}, output: {}};


        // Count the available input ports.
        this.emit("debug", "Discovering input devices:");
        count = this.input.getPortCount();

        for(i = 0; i < count; i++) {
            let deviceName = this.input.getPortName(i);
            let debugMsg = i + ": " + deviceName;

            if(deviceName.match(/01v96/i) || allDevices) {
                devices.input[i] = deviceName;
                debugMsg += " (match)";
            }

            this.emit("debug", debugMsg);
        }

        // Count the available output ports.
        this.emit("debug", "Discovering output devices:");
        count = this.output.getPortCount();

        for(i = 0; i < count; i++) {
            var deviceName = this.output.getPortName(i);
            let debugMsg = i + ": " + deviceName;

            if(deviceName.match(/01v96/i) || allDevices) {
                devices.output[i] = deviceName;
                debugMsg += " (match)";
            }

            this.emit("debug", debugMsg);
        }

        return devices;
    }

    /**
     * Connects to the mixer through MIDI.
     * If no device 
     */
    connect(midiInput = null, midiOutput = null)
    {
        // Auto-discover devices if needed
        if(!midiInput || !midiOutput) {
            let devices = this.getDevices();
            
            if(!midiInput) {
                this.emit("debug", "No input device ID provided, auto-discovering it.");
                midiInput = parseInt(Object.keys(devices.input)[0]);
            }
            
            if(!midiOutput) {
                this.emit("debug", "No output device ID provided, auto-discovering it.");
                midiOutput = parseInt(Object.keys(devices.output)[0]);
            }
        }

        if(!midiInput || !midiOutput) {
            this.emit("error", "No device discovered.");
            return;
        }

        this.emit("debug", "Input device: " + midiInput);
        this.emit("debug", "Output device: " + midiOutput);

        try {
            this.input.openPort(midiInput);
            this.output.openPort(midiOutput);
        } catch(e) {
            this.emit("error", e);
            this.emit("debug", "Cannot open MIDI port: " + e.message);
        }
    }

    /**
     * Disconnects from the device.
     */
    disconnect()
    {
        this.input.closePort();
        this.output.closePort();
    }

    onMidiMessage(deltaTime, msg)
    {
        this.emit("debug", "<- recv: " + msg.map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join(' '));
        let event = MixerEvent.parseMessage(msg, this);

        if (event) {
            this.emit("debug", "Event: " + event.type + '; channel: ' + event.channel + '; value: ' + event.value);
            this.emit(event.type, event);
        }
    }

    send(type, msg)
    {
        msg = SYSEX_HEADER
            .concat(msg)
            .concat([0xF7]);

        msg[2] = type;

        this.emit("debug", "-> send: " + msg.map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join(' '));

        this.output.sendMessage(msg);
    }

    parameterChange(dataType, element, parameter, channel, data = [], format = ParameterFormat.UNIVERSAL)
    {
        this.emit("debug", "Parameter change: " + Array.prototype.join.call(arguments, ['; ']));
        this.send(
            SubStatus.PARAMETER_CHANGE, 
            [format, dataType, element, parameter, channel].concat(data)
        );
    }

    parameterRequest(dataType, element, parameter, channel, extraData = [], format = ParameterFormat.UNIVERSAL)
    {
        this.emit("debug", "Parameter request: " + Array.prototype.join.call(arguments, ['; ']));
        this.send(
            SubStatus.PARAMETER_REQUEST, 
            [format, dataType, element, parameter, channel].concat(extraData)
        );
    }

    /// CONTROL FUNCTIONS ///

    /**
     * Sets the fader resolution for the in/out commands to the mixer
     * 
     * @param {string} res Fader resolution, either RES_LOW or RES_HIGH (constants)
     */
    setFaderResolution(res)
    {
        if ([Yamaha01v96.RES_LOW, Yamaha01v96.RES_HIGH].includes(res)) {
            this.faderResolution = res;
        }
    }

    /**
     * Sets the fader range for in/out commands to the mixer
     * 
     * @param {string} range Fader range, either RANGE_ABSOLUTE or RANGE_RELATIVE (constants)
     */
    setFaderRange(range)
    {
        if ([Yamaha01v96.RANGE_ABSOLUTE, Yamaha01v96.RANGE_RELATIVE].includes(range)) {
            this.faderRange = range;
        }
    }

    requestMeterUpdates()
    {
        this.emit("debug", "Requesting meter updates...");
        this.parameterRequest(DataType.REMOTE_METER, 0x00, 0x00, 0x00, [0, 32], ParameterFormat.YAMAHA_01V96);
        this.send(
            SubStatus.PARAMETER_REQUEST, 
            [ParameterFormat.YAMAHA_01V96, DataType.REMOTE_METER, 0x00, 0x00, 0x00, 0, 32]
        );
    }

    setChannelOn(channel, status)
    {
        if(channel < 1 || channel > CHANNEL_COUNT) {
            this.emit('error', 'Invalid channel number ' + channel);
            return;
        }

        this.emit("debug", "Setting channel " + channel + " " + (status ? "on" : "off"));
        this.parameterChange(DataType.EDIT_BUFFER, MixerElement.CHANNEL_ON, 0x00, channel - 1, this.on2Data(status));
    }

    getChannelOn(channel)
    {
        if(channel < 1 || channel > 32) {
            this.emit('error', 'Invalid channel number ' + channel);
            return;
        }
        
        this.emit("debug", "Requesting channel " + channel + " on status");
        this.parameterRequest(DataType.EDIT_BUFFER, MixerElement.CHANNEL_ON, 0x00, channel - 1);        
    }

    /**
     * Sets the given channel fader level to the given value.
     * 
     * @param {number} channel The channel, between 1-32.
     * @param {number} level The level, between 0 and 100 (0 being -infinite, 100 being +10db).
     * @returns {void}
     */
    setChannelLevel(channel, level)
    {
        if(channel < 1 || channel > CHANNEL_COUNT) {
            this.emit('error', 'Invalid channel number ' + channel);
            return;
        }

        this.emit("debug", "Setting channel " + channel + " level to " + level + "%");
        this.parameterChange(DataType.EDIT_BUFFER, MixerElement.CHANNEL_FADER, 0x00, channel - 1, this.fader2Data(level));
    }

    /**
     * Requests a channel level from the mixer.
     * 
     * @param {number} channel The channel, between 1-32.
     * @returns {void}
     */
    getChannelLevel(channel)
    {
        if(channel < 1 || channel > CHANNEL_COUNT) {
            this.emit('error', 'Invalid channel number ' + channel);
            return;
        }

        this.emit("debug", "Requesting channel " + channel + " level");
        this.parameterRequest(DataType.EDIT_BUFFER, MixerElement.CHANNEL_FADER, 0x00, channel - 1);
    }

    /// UTILITIES ///

    on2Data(status)
    {
        return [0, 0, 0, status ? 1 : 0];
    }

    // 10bit fader values are transmitted in 4 bytes
    // 00000000 00000000 00000nnn 0nnnnnnn
    fader2Data(value)
    {
        // According to the range, the conversion method isn't the same
        if (this.faderRange == Yamaha01v96.RANGE_ABSOLUTE) {
            // Depending on the fader resolution, convert the percentage to the correct value
            let maxVal = this.faderResolution == Yamaha01v96.RES_HIGH ? 1024 : 255;
            value = Math.round((value * maxVal) / 100);
        } else {
            // Get the maximum value for the base value (range from -inf to 0db), and compute the base value from that
            let maxValBase = this.faderResolution == Yamaha01v96.RES_HIGH ? 823 : 207,
                baseValue = (Math.min(value, 100) * maxValBase) / 100,
                overdrive = 0;

            // For the values above 100%, compute the overdrive value to be added to get to +10db at 200%
            if (value > 100) {
                let maxValOver = this.faderResolution == Yamaha01v96.RES_HIGH ? 200 : 48;
                overdrive = ((value - 100) * maxValOver) / 100;
            }
            
            value = baseValue + overdrive;
        }

        return [0, 0, value>>7, value&0x7F];
    }
}

// Fader value range: absolute, meaning that 100 is +10db (max)
Object.defineProperty(Yamaha01v96, 'RANGE_ABSOLUTE', {
    value: "absolute",
    writable: false,
    configurable: false,
    enumerable: true,
});

// Fader value range: relative, meaning that 100 is 0db, 200 is +10db (max)
Object.defineProperty(Yamaha01v96, 'RANGE_RELATIVE', {
    value: "relative",
    writable: false,
    configurable: false,
    enumerable: true,
});

Object.defineProperty(Yamaha01v96, 'RES_LOW', {
    value: "low",
    writable: false,
    configurable: false,
    enumerable: true,
});

Object.defineProperty(Yamaha01v96, 'RES_HIGH', {
    value: "high",
    writable: false,
    configurable: false,
    enumerable: true,
});

module.exports = Yamaha01v96;