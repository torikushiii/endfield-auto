import type { Logger } from "winston";
import type Got from "../classes/got.js";
import type { GotRequestOptions } from "../classes/got.js";
import type { Config } from "../utils/config.js";
import type { Platform } from "../platform/template";
import type Commands from "../classes/command";
import type { Game } from "../skport/template";

declare global {
    var ak: AkNamespace;
}

interface AkNamespace {
    Logger: Logger;
    Config: Config;
    Got: GotCallable;
    Platforms: Map<string, Platform>;
    Commands: Commands;
    SKPort: typeof Game;
}

interface GotCallable {
    <T = unknown>(moduleName: string, options: GotRequestOptions, ...args: unknown[]): Promise<T>;
    instance: Got;
}
