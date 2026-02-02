import type { GotModule } from "../../classes/got.js";

const skportWebGot: GotModule = {
    name: "SKPortWeb",
    optionsType: "object",
    options: {
        prefixUrl: "https://zonai.skport.com/web/v1",
        headers: {
            "platform": "3",
            "Referer": "https://game.skport.com/",
            "Origin": "https://game.skport.com",
        },
    },
    parent: "SKPort",
    description: "SKPort Web client - browser UA for web operations",
};

export default skportWebGot;
