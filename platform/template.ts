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

export abstract class Platform {
    abstract name: string;
    abstract description: string;

    abstract send(content: string | Record<string, unknown>): Promise<void>;

    isConfigured(): boolean {
        return true;
    }

    async startBot(): Promise<void> {
        // Optional: to be implemented by platforms that support interactive bots
    }
}

export default Platform;
