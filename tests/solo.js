const Yamaha01v96 = require("../src/index");

let mixer = new Yamaha01v96();

mixer.on("error", (msg) => console.error(msg));

mixer.connect(1, 1);

let soloSweep = function(func, max) {
    return new Promise((resolve, reject) => {
        let current = 0,
            interval = null;
        
        interval = setInterval(() => {
            let mixerFunc = mixer[func].bind(mixer);
            let currentChannel = Math.floor(current / 2) + 1;

            if (current < (max * 2)) {
                process.stdout.write("\r" + currentChannel + ": " + (current % 2 == 0 ? "on " : "off"));
                mixerFunc(currentChannel, (current % 2 == 0));
                current++;
            } else {
                process.stdout.write("\r");
                clearInterval(interval);
                resolve();
            }
        }, 500);
    });
}

Promise.resolve(null)
    .then(() => {
        console.log("Input channel");
        return soloSweep("soloChannel", 32)
    })
    .then(() => {
        console.log("Aux out");
        return soloSweep("soloAuxOut", 8)
    })
    .then(() => {
        console.log("Bus out");
        return soloSweep("soloBusOut", 8)
    })
    .then(() => {
        console.log("In group");
        return soloSweep("soloInGroup", 8)
    })
    .then(() => {
        console.log("Out group");
        return soloSweep("soloOutGroup", 4)
    });