# NodeJS 01v96 MIDI control library

This library allows to control a Yamaha 01v96 through MIDI using Javascript/NodeJS and node-midi.

## Install

To install, just use `npm` :

```bash
npm install node-midi-01v96
```

## Usage

Using the library is quite easy, just connect to the mixer, set the fader resolution if needed, and then issue your
commands. Supported mixer events can be captured through `.on()` events.

```js
const Yamaha01v96 = require("../src/index");

let mixer = new Yamaha01v96();

mixer.on("error", (msg) => console.error(msg));
mixer.connect();

mixer.on('channelLevel', (channel, level) => console.log("Channel " + channel + " level: " + level));
mixer.setChannelOn(1, false);
```

## Debug

If at any moment you are in doubt of what happens between the mixer and your code, you can get debug info on what
the library receives, sends, and does inside by using the `debug` event :

```js
mixer.on('debug', (msg) => console.log(msg));
```

## Available functions

### Read

Note : Here the read function only sends a request command, the actual value will be returned as the associated event
from the mixer.

- `getChannelLevel(channel)` : Requests the fader level for the given channel.
- `getChannelOn(channel)` : Requests the channel on status for the given channel.

### Write

- `setChannelLevel(channel, level)` : Sets the channel level for given channel.
- `setChannelOn(channel, status)` : Sets the channel on status for the given channel.

### Settings

- `setFaderResolution(res)` : Sets the fader resolution expected from and to the mixer. Can be either `RES_HIGH` or `RES_LOW`
                              (constants set in the Yamaha01v96 class). This should be set in accordance with the mixer
                              settings.
- `setFaderRange(range)` : Sets the fader range for channel levels. Can be either `RANGE_ABSOLUTE` or `RANGE_RELATIVE`
                           (constants set in the Yamaha01v96 class).

## Fader range

This library uses for fader values sent to and from the mixer two different modes :

- `RANGE_ABSOLUTE` : Absolute range, where 0% is -infinite and 100% is +10db. Think of it as direct fader control.
- `RANGE_RELATIVE` : Relative range, where 0% is -infinite, 100% is 0db, and 200% is +10db. It is more related to the
                     actual sound that is output rather than the fader control by itself.