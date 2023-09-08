const Yamaha01v96 = require("../src/index");
const KorgNanoKontrolStudio = require('korg-nanokontrol-studio');

let mixer = new Yamaha01v96();
let nanokontrol = new KorgNanoKontrolStudio();
let scene = 0;

mixer.connect(1,1);
nanokontrol.connect();
nanokontrol.setCurrentScene(scene + 1);

mixer.on("debug", (msg) => console.log("01v96: " + msg));
mixer.on("error", (msg) => console.error(msg));

mixer.setFaderResolution(Yamaha01v96.RES_HIGH);

nanokontrol.on("debug", (msg) => console.log("NKST: " + msg));
nanokontrol.on("sceneChange", (newScene) => scene = newScene - 1);
nanokontrol.on("slider", (slider, value) => mixer.setChannelLevel((slider + 1) + (scene * 8), value * 100 / 127));