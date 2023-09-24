const Yamaha01v96 = require("../src/index");

let mixer = new Yamaha01v96();

mixer.on("debug", (msg) => console.log(msg));
mixer.on("error", (msg) => console.error(msg));

mixer.setFaderResolution(Yamaha01v96.RES_HIGH);

mixer.connect(1, 1);