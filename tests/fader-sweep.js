const Yamaha01v96 = require("../src/index");

let mixer = new Yamaha01v96();

mixer.on("error", (msg) => console.error(msg));

mixer.connect(1, 1);

let sweep = function (max, step) {
    return new Promise((resolve, reject) => {
        let current = 0,
            interval = null;
        
        interval = setInterval(() => {
            if (current <= max) {
                process.stdout.write("\r" + current + "%");
                mixer.setChannelLevel(1, current);
                current += step;
            } else {
                process.stdout.write("\r");
                clearInterval(interval);
                resolve();
            }
        }, 100);
    });
};

Promise.resolve(null)
    .then(() => {
        console.log("Sweep absolute range, high res");
        mixer.setFaderResolution(Yamaha01v96.RES_HIGH);
        return sweep(100, 1);
    })
    .then(() => {
        console.log("Sweep absolute range, low res");
        mixer.setFaderResolution(Yamaha01v96.RES_LOW);
        return sweep(100, 1);
    })
    .then(() => {
        console.log("Sweep relative range, high res");
        mixer.setFaderResolution(Yamaha01v96.RES_HIGH);
        mixer.setFaderRange(Yamaha01v96.RANGE_RELATIVE);
        return sweep(200, 1);
    })
    .then(() => {
        console.log("Sweep relative range, low res");
        mixer.setFaderResolution(Yamaha01v96.RES_LOW);
        return sweep(200, 1);
    })
    .then(() => {
        mixer.disconnect();
    });