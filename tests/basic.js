const Yamaha01v96 = require("../src/index");

let mixer = new Yamaha01v96();

mixer.on("debug", (msg) => console.log(msg));
mixer.on("error", (msg) => console.error(msg));

mixer.connect(1, 1);
mixer.getChannelOn(1);
mixer.setChannelOn(1, true);
mixer.getChannelOn(1);