import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "..", "config.json");

export interface Account {
    name: string;
    cred: string;
    sk_game_role: string;
    settings?: {
        stamina_check?: boolean;
        stamina_threshold?: number;
        daily_check?: boolean;
    };
}

export type PlatformType = "discord" | "webhook" | "telegram";

export interface BasePlatformConfig {
    id: string;
    active: boolean;
    type: PlatformType;
}

export interface DiscordPlatformConfig extends BasePlatformConfig {
    type: "discord";
    botId: string;
    token: string;
}

export interface WebhookPlatformConfig extends BasePlatformConfig {
    type: "webhook";
    url: string;
}

export interface TelegramPlatformConfig extends BasePlatformConfig {
    type: "telegram";
    token: string;
    chatId: string;
}

export type PlatformConfig = DiscordPlatformConfig | WebhookPlatformConfig | TelegramPlatformConfig;

export interface CronConfig {
    name: string;
    scheduleTime: string;
}

export interface Config {
    accounts: Account[];
    platforms: PlatformConfig[];
    crons: CronConfig[];
}

export function loadConfig(): Config {
    if (!existsSync(CONFIG_PATH)) {
        throw new Error(`Config file not found: ${CONFIG_PATH}`);
    }

    const content = readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(content) as Config;

    if (!config.accounts || config.accounts.length === 0) {
        throw new Error("No accounts found in config.json");
    }

    return config;
}

export default loadConfig;
