import type { Account } from "../utils/config";
import * as cache from "./cache";

export interface Reward {
    name: string;
    count: number;
    icon: string;
}

export interface GameStats {
    nickname?: string;
    level?: number;
    serverName?: string;
    charCount?: number;
    worldLevel?: number;
    weaponCount?: number;
    lastLoginTime?: number;
    stamina?: { current: number; max: number; recoveryTime?: number };
    bp?: { level: number; maxLevel: number };
    daily?: { activation: number; maxActivation: number };
}

export interface SignInResult {
    name: string;
    status: "claimed" | "already_claimed" | "error";
    rewards: Array<{ name: string; count: number; icon: string }>;
    profile: {
        nickname?: string;
        user_id?: string;
        avatar?: string;
    };
    game?: {
        uid?: string;
        level?: number;
        server?: string;
        charCount?: number;
    };
    attendance?: {
        totalSignIns?: number;
        calendar?: Array<{ awardId: string; available: boolean; done: boolean }>;
    };
    nextReward?: Reward;
    error?: string;
}

export interface ApiResponse<T = unknown> {
    code: number;
    message?: string;
    data?: T;
}

export interface ProfileData {
    user: {
        nickname: string;
        userId: string;
        avatar: string;
    };
}

export interface StoredAccount {
    account: Account;
    profile: ProfileData["user"] | null;
    uid: string;
    game?: GameStats;
    attendance?: {
        totalSignIns?: number;
    };
    lastUpdated: number;
}

import { TemplateWithoutId } from "../classes/template";

export abstract class Game extends TemplateWithoutId {
    public abstract name: string;
    public accounts: StoredAccount[] = [];
    public static list: Map<string, Game> = new Map();

    constructor() {
        super();
    }

    abstract override initialize(): Promise<void>;
    abstract checkIn(): Promise<SignInResult[]>;
    abstract fetchGameStats(account: Account, options?: { bypassCache?: boolean }): Promise<StoredAccount["game"] | null>;

    static get(name: string): Game | undefined {
        return Game.list.get(name.toLowerCase());
    }

    static getActiveGames(): string[] {
        return Array.from(Game.list.keys());
    }
}

export async function getProfile(account: Account): Promise<ProfileData["user"] | null> {
    const cacheKey = `profile:${account.name}`;
    const cached = cache.get<ProfileData["user"]>(cacheKey);
    if (cached) return cached;

    try {
        const data = await ak.Got<ApiResponse<ProfileData>>("SKPortWeb", {
            url: "wiki/me",
            method: "GET",
        }, {
            account,
            includeGameRole: false,
            signPath: "/web/v1/wiki/me",
        });

        if (data.code === 0 && data.data?.user) {
            cache.set(cacheKey, data.data.user, 60 * 60 * 1000);
            return data.data.user;
        }

        ak.Logger.debug(`getProfile for ${account.name} failed (code ${data.code}): ${data.message || "No message"}`, { fullResponse: data });
        return null;
    } catch (error) {
        ak.Logger.debug(`getProfile failed for ${account.name}`, { error: error instanceof Error ? { message: error.message, stack: error.stack } : error });
        return null;
    }
}
