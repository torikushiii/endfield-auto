import type { GotModule, GotModuleOptions } from "../../classes/got.js";
import type { Account } from "../../utils/config.js";
import { getRuntimeCredentials } from "../../utils/config.js";
import { generateSignV1, generateSignV2, getSignVersion } from "../../skport/oauth.js";

export interface SKPortOptions {
    account: Account;
    includeGameRole?: boolean;
    signPath?: string;
}

const skportGot: GotModule = {
    name: "SKPort",
    optionsType: "function",
    options: (...args: unknown[]): GotModuleOptions => {
        const opts = args[0] as SKPortOptions;
        const { account, includeGameRole = true, signPath } = opts;
        const timestamp = Math.floor(Date.now() / 1000).toString();

        const runtimeCreds = getRuntimeCredentials(account.name);
        const cred = runtimeCreds?.cred || account.cred;
        const salt = runtimeCreds?.salt;

        if (!cred) {
            throw new Error(`No credentials for "${account.name}". Run OAuth or provide cred.`);
        }

        const effectivePath = signPath || "";
        const signVersion = effectivePath ? getSignVersion(effectivePath) : "v1";

        let sign: string;
        if (signVersion === "v2" && salt) {
            sign = generateSignV2(effectivePath, timestamp, "3", "1.0.0", salt);
        } else {
            sign = generateSignV1(timestamp, cred);
        }

        const headers: Record<string, string> = {
            "cred": cred,
            "priority": "u=1, i",
            "sk-language": "en",
            "timestamp": timestamp,
            "vname": "1.0.0",
            "sign": sign,
        };

        if (includeGameRole) {
            headers["sk-game-role"] = account.sk_game_role;
        }

        return { headers };
    },
    parent: "Global",
    description: "Base SKPort API client with authentication headers",
};

export default skportGot;
