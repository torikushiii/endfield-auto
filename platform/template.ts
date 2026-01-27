import type { PlatformConfig } from "../utils/config";

export interface SignInResult {
    name: string;
    status: "claimed" | "already_claimed" | "error";
    rewards: Array<{ name: string; count: number; icon: string }>;
    profile: {
        nickname?: string;
        user_id?: string;
        avatar?: string;
    };
    error?: string;
}

export interface PlatformSendOptions {
    chatId?: string;
    [key: string]: unknown;
}

export abstract class Platform {
    abstract name: string;
    abstract description: string;

    abstract send(content: string | Record<string, unknown>, options?: PlatformSendOptions): Promise<void>;

    isConfigured(): boolean {
        return true;
    }

    async startBot(): Promise<void> {
        // Optional: to be implemented by platforms that support interactive bots
    }

    static async create(config: PlatformConfig): Promise<Platform> {
        switch (config.type) {
        case "discord": {
            const { DiscordPlatform } = await import("./discord");
            return new DiscordPlatform(undefined, config.token, config.botId);
        }
        case "webhook": {
            const { DiscordPlatform } = await import("./discord");
            return new DiscordPlatform(config.url, undefined);
        }
        case "telegram": {
            const { TelegramPlatform } = await import("./telegram");
            return new TelegramPlatform(config.token, config.chatId);
        }
        default:
            throw new Error(`Unsupported platform type: ${(config as { type: string }).type}`);
        }
    }
}

export default Platform;
