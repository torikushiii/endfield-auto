import logger from "./utils/logger";
import { loadConfig } from "./utils/config";
import Got, { type GotRequestOptions } from "./classes/got";
import { Game } from "./skport/template";
import Endfield from "./skport/endfield";
import initializeCrons from "./crons";
import Platform from "./platform/template";
import Commands from "./classes/command";
import { Template } from "./classes/template";

async function initializeAk(): Promise<void> {
    const config = loadConfig();
    const gotInstance = new Got();
    const commandInstance = new Commands();
    const endfieldInstance = new Endfield();

    const gotCallable = Object.assign(
        async <T = unknown>(moduleName: string, options: GotRequestOptions, ...args: unknown[]): Promise<T> => {
            return gotInstance.request<T>(moduleName, options, ...args);
        },
        { instance: gotInstance }
    );

    const platforms = new Map<string, Platform>();
    for (const pConfig of config.platforms) {
        if (!pConfig.active) continue;
        const platform = await Platform.create(pConfig);
        platforms.set(pConfig.id, platform);
    }

    globalThis.ak = {
        Logger: logger,
        Config: config,
        Got: gotCallable,
        Platforms: platforms,
        Commands: commandInstance,
        SKPort: Game,
    };

    const MODULE_INITIALIZE_ORDER: Template[][] = [
        [gotInstance, commandInstance],
        [endfieldInstance]
    ];

    ak.Logger.info("Arknights: Endfield Auto | Initialization");

    const modulesToDestroy: Template[] = [gotInstance, commandInstance, endfieldInstance];

    for (const batch of MODULE_INITIALIZE_ORDER) {
        const promises = batch.map(async (mod: Template) => {
            const start = Date.now();
            await mod.initialize();
            const duration = Date.now() - start;
            ak.Logger.debug(`    Initialized module: ${mod.constructor.name} (${duration}ms)`);
        });
        await Promise.all(promises);
    }

    process.on("SIGINT", async () => {
        ak.Logger.info("Arknights: Endfield Auto | Shutdown");
        for (const mod of modulesToDestroy) {
            try {
                mod.destroy();
            } catch (e) {
                ak.Logger.error(`Error destroying module ${mod.constructor.name}:`, { e });
            }
        }
        process.exit(0);
    });

    ak.Logger.info(`Initialized ${platforms.size} active platform(s)`);
}

async function main(): Promise<void> {
    await initializeAk();

    initializeCrons();

    const botStarts = Array.from(ak.Platforms.values())
        .filter(platform => platform.isConfigured())
        .map(platform => platform.startBot());

    await Promise.all(botStarts);
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
