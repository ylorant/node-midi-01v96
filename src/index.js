const EventEmitter = require('events');
const Midi = require('midi');

// Constants
const SYSEX_HEADER = [0xF0, 0x43, 0x00, 0x3E];
const CHANNEL_COUNT = 32;
const AUX_COUNT = 8;
const BUS_COUNT = 8;
const MASTER_COUNT = AUX_COUNT + BUS_COUNT;
const IN_GROUP_COUNT = 8;
const OUT_GROUP_COUNT = 4;

// Enums
const SubStatus = require('./enum/sub-status');
const DataType = require('./enum/data-type');
const MixerElement = require('./enum/mixer-element');
const ParameterFormat = require('./enum/parameter-format');
const LibraryFunction = require('./enum/library-function');

// Event types
const SceneEvent = require('./event/scene');
const FunctionCallEvent = require('./event/function-call');
const SetupElement = require('./enum/setup-element');
const RemoteKey = require('./enum/remote-key');
const SetupEvent = require('./event/setup');

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

    /// LIFECYCLE ///

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

            if (deviceName.match(/01v96/i) || allDevices) {
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

            if (deviceName.match(/01v96/i) || allDevices) {
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
        if (!midiInput || !midiOutput) {
            let devices = this.getDevices();
            
            if (!midiInput) {
                this.emit("debug", "No input device ID provided, auto-discovering it.");
                midiInput = parseInt(Object.keys(devices.input)[0]);
            }
            
            if (!midiOutput) {
                this.emit("debug", "No output device ID provided, auto-discovering it.");
                midiOutput = parseInt(Object.keys(devices.output)[0]);
            }
        }

        if (!midiInput || !midiOutput) {
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

        // Ignore if the message isn't a SysEx with the good protocol
        if (msg[0] != 0xF0 || msg[1] != 0x43 || msg[3] != 0x3E) {
            return null;
        }

        // Ignore the messages if it's less than 14 bytes long
        if (msg.length < 12) {
            return null;
        }

        let event = this.parseEventType(msg);
        if (event) {
            this.emit("debug", "Event: " + Object.entries(event).map((e) => e.join(': ')).join('; '));
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

    parameterChange(dataType, element, parameter, channel, extraData = [], format = ParameterFormat.UNIVERSAL)
    {
        let data = [];

        // Convert parameter and channel to arrays if single byte, to add flexibility to those parameters
        parameter = parameter instanceof Array ? parameter : [parameter];
        channel = channel instanceof Array ? channel : [channel];

        // Build the data structure to send to the mixer
        data = data
            .concat(parameter)
            .concat(channel)
            .concat(extraData);

        this.emit("debug", "Parameter change: " + Array.prototype.join.call(arguments, ['; ']));
        this.send(
            SubStatus.PARAMETER_CHANGE, 
            [format, dataType, element].concat(data)
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

    /// EVENT MANAGEMENT ///
    
    parseEventType(msg)
    {
        // Handle data types
        switch (msg[5]) {
            case DataType.EDIT_BUFFER:
                return SceneEvent.fromMessage(msg, this);
            
            case DataType.FUNCTION_CALL:
                return FunctionCallEvent.fromMessage(msg, this);
            
            case DataType.SETUP_MEMORY:
                return SetupEvent.fromMessage(msg, this);
        }
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

    // Meter

    requestMeterUpdates()
    {
        this.emit("debug", "Requesting meter updates...");
        this.parameterRequest(DataType.REMOTE_METER, 0x00, 0x00, 0x00, [0, 32], ParameterFormat.YAMAHA_01V96);
    }

    remoteKeypress(key)
    {
        this.emit("debug", "Clearing solo...");
        this.parameterChange(DataType.REMOTE_KEY, 0x00, key[0], key[1], [0x01], ParameterFormat.YAMAHA_01V96);
    }

    // Buffer edit (direct edit actions)

    /**
     * Sets the given input channel on status.
     * 
     * @param {number} channel The channel to set the on status of.
     * @param {bool} status The on status, true for on, false for off.
     */
    setChannelOn(channel, status)
    {
        if (channel < 1 || channel > CHANNEL_COUNT) {
            this.emit('error', 'Invalid channel number ' + channel);
            return;
        }

        this.emit("debug", "Setting channel " + channel + " " + (status ? "on" : "off"));
        this.parameterChange(DataType.EDIT_BUFFER, MixerElement.CHANNEL_ON, 0x00, channel - 1, this.on2Data(status));
    }

    /**
     * Requests the on status for a given input channel.
     * 
     * @param {number} channel The channel to request the on status of. 
     */
    getChannelOn(channel)
    {
        if (channel < 1 || channel > CHANNEL_COUNT) {
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
        if (channel < 1 || channel > CHANNEL_COUNT) {
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
        if (channel < 1 || channel > CHANNEL_COUNT) {
            this.emit('error', 'Invalid channel number ' + channel);
            return;
        }

        this.emit("debug", "Requesting channel " + channel + " level");
        this.parameterRequest(DataType.EDIT_BUFFER, MixerElement.CHANNEL_FADER, 0x00, channel - 1);
    }

    /**
     * Sets the given aux out channel on status.
     * 
     * @param {number} aux The channel to set the on status of.
     * @param {bool} status The on status, true for on, false for off.
     */
    setAuxOn(aux, status)
    {
        if (aux < 1 || aux > AUX_COUNT) {
            this.emit('error', 'Invalid aux number ' + aux);
            return;
        }

        this.emit("debug", "Setting aux " + aux + " " + (status ? "on" : "off"));
        this.parameterChange(DataType.EDIT_BUFFER, MixerElement.AUX_ON, 0x00, aux - 1, this.on2Data(status));
    }

    /**
     * Requests the on status for a given aux out channel.
     * 
     * @param {number} aux The aux channel to request the on status of. 
     */
    getAuxOn(aux)
    {
        if (aux < 1 || aux > AUX_COUNT) {
            this.emit('error', 'Invalid aux number ' + aux);
            return;
        }
        
        this.emit("debug", "Requesting aux " + aux + " on status");
        this.parameterRequest(DataType.EDIT_BUFFER, MixerElement.AUX_ON, 0x00, aux - 1);
    }

    /**
     * Sets the given aux out channel fader level to the given value.
     * 
     * @param {number} aux The aux channel, between 1-8.
     * @param {number} level The level, between 0 and 100 (0 being -infinite, 100 being 0db).
     */
    setAuxLevel(aux, level)
    {
        if (aux < 1 || aux > AUX_COUNT) {
            this.emit('error', 'Invalid aux number ' + aux);
            return;
        }

        this.emit("debug", "Setting aux " + aux + " level to " + level + "%");
        this.parameterChange(DataType.EDIT_BUFFER, MixerElement.AUX_FADER, 0x00, aux - 1, this.fader2Data(level, true));
    }

    /**
     * Requests an aux channel level from the mixer.
     * 
     * @param {number} aux The aux channel, between 1-8.
     */
    getAuxLevel(aux)
    {
        if (aux < 1 || aux > AUX_COUNT) {
            this.emit('error', 'Invalid aux number ' + aux);
            return;
        }

        this.emit("debug", "Requesting aux " + aux + " level");
        this.parameterRequest(DataType.EDIT_BUFFER, MixerElement.AUX_FADER, 0x00, aux - 1);
    }

    /**
     * Sets the given bus out channel on status.
     * 
     * @param {number} bus The channel to set the on status of.
     * @param {bool} status The on status, true for on, false for off.
     */
    setBusOn(bus, status)
    {
        if (bus < 1 || bus > BUS_COUNT) {
            this.emit('error', 'Invalid bus number ' + bus);
            return;
        }

        this.emit("debug", "Setting bus " + bus + " " + (status ? "on" : "off"));
        this.parameterChange(DataType.EDIT_BUFFER, MixerElement.BUS_ON, 0x00, bus - 1, this.on2Data(status));
    }

    /**
     * Requests the on status for a given bus out channel.
     * 
     * @param {number} bus The bus channel to request the on status of. 
     */
    getBusOn(bus)
    {
        if (bus < 1 || bus > BUS_COUNT) {
            this.emit('error', 'Invalid bus number ' + bus);
            return;
        }
        
        this.emit("debug", "Requesting bus " + bus + " on status");
        this.parameterRequest(DataType.EDIT_BUFFER, MixerElement.BUS_ON, 0x00, bus - 1);
    }

    /**
     * Sets the given bus out channel fader level to the given value.
     * 
     * @param {number} bus The bus channel, between 1-8.
     * @param {number} level The level, between 0 and 100 (0 being -infinite, 100 being 0db).
     */
    setBusLevel(bus, level)
    {
        if (bus < 1 || bus > BUS_COUNT) {
            this.emit('error', 'Invalid bus number ' + bus);
            return;
        }

        this.emit("debug", "Setting bus " + bus + " level to " + level + "%");
        this.parameterChange(DataType.EDIT_BUFFER, MixerElement.BUS_FADER, 0x00, bus - 1, this.fader2Data(level, true));
    }

    /**
     * Requests an bus channel level from the mixer.
     * 
     * @param {number} bus The bus channel, between 1-8.
     */
    getBusLevel(bus)
    {
        if (bus < 1 || bus > BUS_COUNT) {
            this.emit('error', 'Invalid bus number ' + bus);
            return;
        }

        this.emit("debug", "Requesting bus " + bus + " level");
        this.parameterRequest(DataType.EDIT_BUFFER, MixerElement.BUS_FADER, 0x00, bus - 1);
    }

    /**
     * Sets the given inGroup out channel on status.
     * 
     * @param {number} inGroup The channel to set the on status of.
     * @param {bool} status The on status, true for on, false for off.
     */
    setInGroupMasterOn(inGroup, status)
    {
        if (inGroup < 1 || inGroup > IN_GROUP_COUNT) {
            this.emit('error', 'Invalid inGroup number ' + inGroup);
            return;
        }

        this.emit("debug", "Setting inGroup " + inGroup + " " + (status ? "on" : "off"));
        this.parameterChange(DataType.EDIT_BUFFER, MixerElement.IN_GROUP_MASTER, 0x02, inGroup - 1, this.on2Data(status));
    }

    /**
     * Requests the on status for a given inGroup out channel.
     * 
     * @param {number} inGroup The inGroup channel to request the on status of. 
     */
    getInGroupMasterOn(inGroup)
    {
        if (inGroup < 1 || inGroup > IN_GROUP_COUNT) {
            this.emit('error', 'Invalid inGroup number ' + inGroup);
            return;
        }
        
        this.emit("debug", "Requesting inGroup " + inGroup + " on status");
        this.parameterRequest(DataType.EDIT_BUFFER, MixerElement.IN_GROUP_MASTER, 0x02, inGroup - 1);
    }

    /**
     * Sets the given inGroup out channel fader level to the given value.
     * 
     * @param {number} inGroup The inGroup channel, between 1-8.
     * @param {number} level The level, between 0 and 100 (0 being -infinite, 100 being 0db).
     */
    setInGroupMasterLevel(inGroup, level)
    {
        if (inGroup < 1 || inGroup > IN_GROUP_COUNT) {
            this.emit('error', 'Invalid inGroup number ' + inGroup);
            return;
        }

        this.emit("debug", "Setting inGroup " + inGroup + " level to " + level + "%");
        this.parameterChange(DataType.EDIT_BUFFER, MixerElement.IN_GROUP_MASTER, 0x00, inGroup - 1, this.fader2Data(level));
    }

    /**
     * Requests an inGroup channel level from the mixer.
     * 
     * @param {number} inGroup The inGroup channel, between 1-8.
     */
    getInGroupMasterLevel(inGroup)
    {
        if (inGroup < 1 || inGroup > IN_GROUP_COUNT) {
            this.emit('error', 'Invalid inGroup number ' + inGroup);
            return;
        }

        this.emit("debug", "Requesting inGroup " + inGroup + " level");
        this.parameterRequest(DataType.EDIT_BUFFER, MixerElement.IN_GROUP_MASTER, 0x00, inGroup - 1);
    }

    /**
     * Sets the given outGroup out channel on status.
     * 
     * @param {number} outGroup The channel to set the on status of.
     * @param {bool} status The on status, true for on, false for off.
     */
    setOutGroupMasterOn(outGroup, status)
    {
        if (outGroup < 1 || outGroup > OUT_GROUP_COUNT) {
            this.emit('error', 'Invalid outGroup number ' + outGroup);
            return;
        }

        this.emit("debug", "Setting outGroup " + outGroup + " " + (status ? "on" : "off"));
        this.parameterChange(DataType.EDIT_BUFFER, MixerElement.OUT_GROUP_MASTER, 0x02, outGroup - 1, this.on2Data(status));
    }

    /**
     * Requests the on status for a given outGroup out channel.
     * 
     * @param {number} outGroup The outGroup channel to request the on status of. 
     */
    getOutGroupMasterOn(outGroup)
    {
        if (outGroup < 1 || outGroup > OUT_GROUP_COUNT) {
            this.emit('error', 'Invalid outGroup number ' + outGroup);
            return;
        }
        
        this.emit("debug", "Requesting outGroup " + outGroup + " on status");
        this.parameterRequest(DataType.EDIT_BUFFER, MixerElement.OUT_GROUP_MASTER, 0x02, outGroup - 1);
    }

    /**
     * Sets the given outGroup out channel fader level to the given value.
     * 
     * @param {number} outGroup The outGroup channel, between 1-8.
     * @param {number} level The level, between 0 and 100 (0 being -infinite, 100 being 0db).
     */
    setOutGroupMasterLevel(outGroup, level)
    {
        if (outGroup < 1 || outGroup > OUT_GROUP_COUNT) {
            this.emit('error', 'Invalid outGroup number ' + outGroup);
            return;
        }

        this.emit("debug", "Setting outGroup " + outGroup + " level to " + level + "%");
        this.parameterChange(DataType.EDIT_BUFFER, MixerElement.OUT_GROUP_MASTER, 0x00, outGroup - 1, this.fader2Data(level));
    }

    /**
     * Requests an outGroup channel level from the mixer.
     * 
     * @param {number} outGroup The outGroup channel, between 1-8.
     */
    getOutGroupMasterLevel(outGroup)
    {
        if (outGroup < 1 || outGroup > OUT_GROUP_COUNT) {
            this.emit('error', 'Invalid outGroup number ' + outGroup);
            return;
        }

        this.emit("debug", "Requesting outGroup " + outGroup + " level");
        this.parameterRequest(DataType.EDIT_BUFFER, MixerElement.OUT_GROUP_MASTER, 0x00, outGroup - 1);
    }

    // Library management (stores/recalls)

    libraryStoreRecall(func, parameter, channel = null)
    {
        if (channel === null) {
            channel = 256;
        }

        this.parameterChange(DataType.FUNCTION_CALL, func, this.word2Data(parameter), this.word2Data(channel));
    }

    /**
     * Recalls a scene.
     * 
     * @param {number} sceneId The scene ID to recall 
     */
    recallScene(sceneId)
    {
        this.emit("debug", "Recalling scene #" + sceneId + "...");
        this.libraryStoreRecall(LibraryFunction.SCENE_RECALL, sceneId);
    }

    /**
     * Store current settings in the given scene ID.
     * 
     * @param {number} sceneId The scene ID to store settings in.
     */
    storeScene(sceneId)
    {
        this.emit("debug", "Storing scene #" + sceneId + "...");
        this.libraryStoreRecall(LibraryFunction.SCENE_STORE, sceneId);
    }

    // Setup (a lot of stuff, for now mainly solos)

    /**
     * Clears all active solos.
     * This sends a remote key, way simpler than sending the solo clear commands for each channel. 
     */
    clearSolo()
    {
        this.remoteKeypress(RemoteKey.SOLO_CLEAR);
    }

    /**
     * Requests the solo status for a specific input channel.
     * 
     * @param {number} channel The channel to request the solo status of.
     */
    getChannelSolo(channel)
    {
        if (channel < 1 || channel > CHANNEL_COUNT) {
            this.emit('error', 'Invalid channel number ' + channel);
            return;
        }
        
        this.emit("debug", "Requesting channel " + channel + " solo status");
        this.parameterRequest(DataType.SETUP_MEMORY, SetupElement.SOLO_CH_ON, 0x00, channel - 1, [], ParameterFormat.YAMAHA_01V96);
    }

    /**
     * Sets the solo status for a specific channel
     * 
     * @param {number} channel The channel to set the solo status of.
     * @param {boolean} solo True to enable solo, false to disable it.
     */
    soloChannel(channel, solo)
    {
        if (channel < 1 || channel > CHANNEL_COUNT) {
            this.emit('error', 'Invalid channel number ' + channel);
            return;
        }

        this.parameterChange(DataType.SETUP_MEMORY, SetupElement.SOLO_CH_ON, 0x00, channel - 1, this.on2Data(solo), ParameterFormat.YAMAHA_01V96);
    }

    /**
     * Requests the solo status for a specific master channel.
     * 
     * @param {number} channel The channel to request the solo status of.
     */
    getMasterChannelSolo(channel)
    {
        if (channel < 1 || channel > MASTER_COUNT) {
            this.emit('error', 'Invalid master channel number ' + channel);
            return;
        }
        
        this.parameterRequest(DataType.SETUP_MEMORY, SetupElement.SOLO_MASTER_ON, 0x00, channel - 1, [], ParameterFormat.YAMAHA_01V96);
    }

    /**
     * Sets the solo status for a master (output) channel (aux, out, matrix).
     * 
     * 
     */
    soloMasterChannel(channel, solo)
    {
        if (channel < 1 || channel > MASTER_COUNT) {
            this.emit('error', 'Invalid master channel number ' + channel);
            return;
        }

        this.parameterChange(DataType.SETUP_MEMORY, SetupElement.SOLO_MASTER_ON, 0x00, channel - 1, this.on2Data(solo), ParameterFormat.YAMAHA_01V96);
    }

    /**
     * Requests solo status for an auxiliary output channel.
     * 
     * @param {number} aux The aux out channel number to get solo status of.
     */
    getAuxOutSolo(aux)
    {
        if (aux < 1 || aux > AUX_COUNT) {
            this.emit('error', 'Invalid aux number ' + aux);
            return;
        }

        // Aux channels start from the end of the bus channels on the master layer
        this.getMasterChannelSolo(BUS_COUNT + aux);
    }

    /**
     * Sets the solo status for a specific auxiliary output.
     * 
     * @param {number} aux The auxiliary output channel to solo (1-8).
     * @param {boolean} solo True to enable solo, false to disable it.
     */
    soloAuxOut(aux, solo)
    {
        if (aux < 1 || aux > AUX_COUNT) {
            this.emit('error', 'Invalid aux number ' + aux);
            return;
        }

        // Aux channels start from the end of the bus channels on the master layer
        this.soloMasterChannel(BUS_COUNT + aux, solo);
    }

    /**
     * Requests solo status for a bus output channel.
     * 
     * @param {number} bus The bus out channel number to get solo status of.
     */
    getBusOutSolo(bus)
    {
        if (bus < 1 || bus > BUS_COUNT) {
            this.emit('error', 'Invalid bus number ' + bus);
            return;
        }

        this.getMasterChannelSolo(bus);
    }

    /**
     * Sets the solo status for a specific bus output.
     * 
     * @param {number} bus The bus channel to solo (1-8).
     * @param {boolean} solo True to enable solo, false to disable it.
     */
    soloBusOut(bus, solo)
    {
        if (bus < 1 || bus > BUS_COUNT) {
            this.emit('error', 'Invalid bus number ' + channel);
            return;
        }

        this.soloMasterChannel(bus, solo);
    }

    /**
     * Requests solo status for an in group master channel.
     * 
     * @param {number} group The in group master channel number to get solo status of.
     */
    getInGroupSolo(group)
    {
        if (group < 1 || group > IN_GROUP_COUNT) {
            this.emit('error', 'Invalid group number ' + group);
            return;
        }

        this.parameterRequest(DataType.SETUP_MEMORY, SetupElement.GROUP_SOLO_ON, 0x00, group - 1, [], ParameterFormat.YAMAHA_01V96);
    }

    /**
     * Sets the solo status for an input group.
     * 
     * @param {number} group The group number, corresponding to it's letter index (A=1, B=2, etc.)
     * @param {boolean} solo True to enable solo, false to disable it.
     */
    soloInGroup(group, solo)
    {
        if (group < 1 || group > IN_GROUP_COUNT) {
            this.emit('error', 'Invalid in group number ' + group);
            return;
        }

        this.parameterChange(DataType.SETUP_MEMORY, SetupElement.GROUP_SOLO_ON, 0x00, group - 1, this.on2Data(solo), ParameterFormat.YAMAHA_01V96);
    }

    /**
     * Requests solo status for an out group master channel.
     * 
     * @param {number} group The out group master channel number to get solo status of.
     */
    getOutGroupSolo(group)
    {
        if (group < 1 || group > OUT_GROUP_COUNT) {
            this.emit('error', 'Invalid group number ' + group);
            return;
        }

        this.parameterRequest(DataType.SETUP_MEMORY, SetupElement.GROUP_SOLO_MASTER_ON, 0x00, group - 1, [], ParameterFormat.YAMAHA_01V96);
    }

    /**
     * Sets the solo status for an output group.
     * 
     * @param {number} group The group number, corresponding to it's letter index (Q=1, R=2, etc.)
     * @param {boolean} solo True to enable solo, false to disable it.
     */
    soloOutGroup(group, solo)
    {
        if (group < 1 || group > OUT_GROUP_COUNT) {
            this.emit('error', 'Invalid out group number ' + group);
            return;
        }

        this.parameterChange(DataType.SETUP_MEMORY, SetupElement.GROUP_SOLO_MASTER_ON, 0x00, group - 1, this.on2Data(solo), ParameterFormat.YAMAHA_01V96);
    }

    /// UTILITIES ///

    on2Data(status)
    {
        return [0, 0, 0, status ? 1 : 0];
    }

    // 10bit fader values are transmitted in 4 bytes
    // 00000000 00000000 00000nnn 0nnnnnnn
    fader2Data(value, isMaster = false)
    {
        // According to the range, the conversion method isn't the same
        if (this.faderRange == Yamaha01v96.RANGE_ABSOLUTE || isMaster) {
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

    /**
     * Converts a 16-bit (word) value into an byte array to incorporate into a message
     * @param {number} value The 16-bit value to convert
     */
    word2Data(value)
    {
        return [value>>7, value&0x7F];
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