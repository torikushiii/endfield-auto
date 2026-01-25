import type { Platform } from "../platform/template";
import logger from "../utils/logger";

export interface CommandContext {
    platform: Platform;
    ephemeral: (content: string | Record<string, unknown>) => Promise<void> | void;
    defer: () => Promise<void> | void;
}

export interface CommandOption {
    name: string;
    description: string;
    type: number; // 3 for STRING, 4 for INTEGER, etc.
    required?: boolean;
    choices?: Array<{ name: string; value: string | number }>;
}

export interface CommandModule {
    name: string;
    description: string;
    aliases?: string[];
    options?: CommandOption[] | (() => CommandOption[]);
    run: (ctx: CommandContext, ...args: string[]) => Promise<void> | void;
}

class Commands {
    #commands = new Map<string, CommandModule>();
    #aliases = new Map<string, string>();

    async importData(): Promise<void> {
        const { loadCommands } = await import("../commands");
        const modules = await loadCommands();

        for (const mod of modules) {
            if (this.#isCommandModule(mod)) {
                this.#add(mod);
            }
        }
    }

    #isCommandModule(mod: unknown): mod is CommandModule {
        return (
            typeof mod === "object" &&
            mod !== null &&
            "name" in mod &&
            "run" in mod &&
            typeof (mod as CommandModule).run === "function"
        );
    }

    #add(module: CommandModule): void {
        const name = module.name.toLowerCase();

        if (this.#commands.has(name)) {
            throw new Error(`Duplicate command name registered: ${name}`);
        }

        this.#commands.set(name, module);

        if (module.aliases) {
            for (const alias of module.aliases) {
                const aliasLower = alias.toLowerCase();
                if (this.#commands.has(aliasLower) || this.#aliases.has(aliasLower)) {
                    throw new Error(`Duplicate alias/command name conflict: ${aliasLower} (for command ${name})`);
                }
                this.#aliases.set(aliasLower, name);
            }
        }

        logger.info(`Command registered: ${name}${module.aliases ? ` (aliases: ${module.aliases.join(", ")})` : ""}`);
    }

    get(name: string): CommandModule | undefined {
        const nameLower = name.toLowerCase();
        const primaryName = this.#aliases.get(nameLower) || nameLower;
        return this.#commands.get(primaryName);
    }

    async checkAndRun(name: string, context: CommandContext, ...args: string[]): Promise<void> {
        const command = this.get(name);

        if (!command) {
            await context.ephemeral(`Command "${name}" does not exist.`);
            return;
        }
        try {
            await command.run(context, ...args);
        } catch (error) {
            logger.error(`Error running command "${name}":`, { error });
            await context.ephemeral("An error occurred while running this command.");
        }
    }

    get all(): CommandModule[] {
        return Array.from(this.#commands.values());
    }
}

export default Commands;
