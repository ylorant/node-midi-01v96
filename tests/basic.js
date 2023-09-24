const Yamaha01v96 = require("../src/index");

let mixer = new Yamaha01v96();

// mixer.on("debug", (msg) => console.log(msg));
mixer.on("error", (msg) => console.error(msg));

function sleep(time)
{
    return new Promise(resolve => setTimeout(resolve, time));
}

mixer.setFaderRange(Yamaha01v96.RANGE_RELATIVE);
mixer.setFaderResolution(Yamaha01v96.RES_HIGH);
mixer.connect(1, 1);

async function run()
{
    console.log("Channel on");
    mixer.setChannelOn(1, false);
    mixer.getChannelOn(1);
    await sleep(1000);
    mixer.setChannelOn(1, true);
    mixer.getChannelOn(1);
    await sleep(1000);

    console.log("Channel level");
    mixer.setChannelLevel(1, 0);
    mixer.getChannelLevel(1);
    await sleep(1000);
    mixer.setChannelLevel(1, 100);
    mixer.getChannelLevel(1);
    await sleep(1000);

    console.log("Aux on");
    mixer.setAuxOn(1, false)
    mixer.getAuxOn(1);
    await sleep(1000);
    mixer.setAuxOn(1, true);
    mixer.getAuxOn(1);
    await sleep(1000);

    console.log("Aux level");
    mixer.setAuxLevel(1, 0);
    mixer.getAuxLevel(1);
    await sleep(1000);
    mixer.setAuxLevel(1, 100);
    mixer.getAuxLevel(1);
    await sleep(1000);

    console.log("Bus on");
    mixer.setBusOn(1, false)
    mixer.getBusOn(1);
    await sleep(1000);
    mixer.setBusOn(1, true);
    mixer.getBusOn(1);
    await sleep(1000);

    console.log("Bus level");
    mixer.setBusLevel(1, 0);
    mixer.getBusLevel(1);
    await sleep(1000);
    mixer.setBusLevel(1, 100);
    mixer.getBusLevel(1);
    await sleep(1000);
}

run();