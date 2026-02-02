import type { GotModule } from "../../classes/got.js";

const skportAppGot: GotModule = {
    name: "SKPortApp",
    optionsType: "object",
    options: {
        prefixUrl: "https://zonai.skport.com/api/v1",
        headers: {
            "platform": "3",
            "User-Agent": "Skport/0.7.0 (com.gryphline.skport; build:700089; Android 33; ) Okhttp/5.1.0",
        },
    },
    parent: "SKPort",
    description: "SKPort App client - Android UA for game data",
};

export default skportAppGot;
