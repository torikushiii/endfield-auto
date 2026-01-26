import logger from "./utils/logger";
import { loadConfig } from "./utils/config";
import Got, { type GotRequestOptions } from "./classes/got";
import { DiscordPlatform } from "./platform/discord";
import { TelegramPlatform } from "./platform/telegram";
import { Game } from "./skport/template";
import Endfield from "./skport/endfield";
import initializeCrons from "./crons";
import type { Platform } from "./platform/template";
import Commands from "./classes/command";

async function initializeAk(): Promise<void> {
    const config = loadConfig();
    const gotInstance = new Got();
    await gotInstance.importData();

    const commandInstance = new Commands();
    await commandInstance.importData();

    const gotCallable = Object.assign(
        async <T = unknown>(moduleName: string, options: GotRequestOptions, ...args: unknown[]): Promise<T> => {
            return gotInstance.request<T>(moduleName, options, ...args);
        },
        { instance: gotInstance }
    );

    const platforms = new Map<string, Platform>();

    for (const pConfig of config.platforms) {
        if (!pConfig.active) continue;

        if (pConfig.type === "discord") {
            platforms.set(pConfig.id, new DiscordPlatform(undefined, pConfig.token, pConfig.botId));
        } else if (pConfig.type === "webhook") {
            platforms.set(pConfig.id, new DiscordPlatform(pConfig.url, undefined));
        } else if (pConfig.type === "telegram") {
            platforms.set(pConfig.id, new TelegramPlatform(pConfig.token, pConfig.chatId));
        }
    }

    globalThis.ak = {
        Logger: logger,
        Config: config,
        Got: gotCallable,
        Platforms: platforms,
        Commands: commandInstance,
        SKPort: Game,
    };

    // Initialize specific games
    const endfield = new Endfield();
    await endfield.init();

    ak.Logger.info("Arknights: Endfield Auto");
    ak.Logger.info(`Initialized ${platforms.size} active platform(s)`);
}

async function main(): Promise<void> {
    await initializeAk();

    initializeCrons();

    for (const platform of ak.Platforms.values()) {
        if (platform.isConfigured()) {
            await platform.startBot();
        }
    }
}

process.on("unhandledRejection", (reason) => {
    if (reason instanceof Error) {
        ak.Logger.error(`Unhandled Rejection: ${reason.message}`, { stack: reason.stack });
    } else {
        ak.Logger.error(`Unhandled Rejection: ${reason}`);
    }
});

main().catch((error) => {
    ak.Logger.error("Fatal error during initialization", { error });
    process.exit(1);
});
