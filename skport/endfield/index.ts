import { Game, type SignInResult, type StoredAccount, getProfile, type ApiResponse } from "../template";
import type { Account } from "../../utils/config";
import { setRuntimeCredentials, getRuntimeCredentials } from "../../utils/config";
import { performOAuthFlow } from "../oauth";
import * as cache from "../cache";

export class Endfield extends Game {
    name = "endfield";
    static REGEN_RATE = 432;

    constructor() {
        super();
        Game.list.set(this.name, this);
    }

    async refreshOAuth(account: Account): Promise<boolean> {
        if (!account.account_token) {
            return false;
        }

        try {
            ak.Logger.debug(`  Refreshing OAuth for ${account.name}...`);
            const credentials = await performOAuthFlow(account.account_token);
            setRuntimeCredentials(account.name, {
                cred: credentials.cred,
                salt: credentials.salt,
                userId: credentials.userId,
                hgId: credentials.hgId,
                obtainedAt: Date.now(),
            });
            return true;
        } catch (error) {
            ak.Logger.warn(`  OAuth refresh failed for ${account.name}: ${error}`);
            return false;
        }
    }

    async initOAuth(account: Account, forceRefresh = false): Promise<boolean> {
        const existing = getRuntimeCredentials(account.name);
        const CREDENTIAL_TTL = 30 * 60 * 1000; // 30 minutes

        if (existing && !forceRefresh) {
            const age = Date.now() - existing.obtainedAt;
            if (age < CREDENTIAL_TTL) {
                return true;
            }
            ak.Logger.debug(`  Credentials stale for ${account.name}, refreshing...`);
        }

        if (account.account_token) {
            try {
                ak.Logger.debug(`  Performing OAuth for ${account.name}...`);
                const credentials = await performOAuthFlow(account.account_token);
                setRuntimeCredentials(account.name, {
                    cred: credentials.cred,
                    salt: credentials.salt,
                    userId: credentials.userId,
                    hgId: credentials.hgId,
                    obtainedAt: Date.now(),
                });
                ak.Logger.debug(`  OAuth successful for ${account.name}`);
                return true;
            } catch (error) {
                ak.Logger.warn(`  OAuth failed for ${account.name}: ${error}`);
            }
        }

        if (account.cred) {
            ak.Logger.debug(`  Using legacy cred for ${account.name}`);
            setRuntimeCredentials(account.name, {
                cred: account.cred,
                salt: "",
                userId: "",
                obtainedAt: Date.now(),
            });
            return true;
        }

        ak.Logger.error(`  No credentials available for ${account.name}`);
        return false;
    }

    async init(): Promise<void> {
        ak.Logger.info(`Initializing ${this.name} accounts...`);

        for (const account of ak.Config.accounts) {
            const hasCredentials = await this.initOAuth(account);
            if (!hasCredentials) {
                ak.Logger.error(`  Skipping ${account.name}: No valid credentials`);
                continue;
            }

            const profile = await getProfile(account);
            const roleParts = account.sk_game_role.split("_");
            const uid = roleParts[1] || account.sk_game_role;

            const stored: StoredAccount = {
                account,
                profile,
                uid,
                lastUpdated: Date.now(),
            };

            try {
                const gameStats = await this.fetchGameStats(account);
                if (gameStats) {
                    stored.game = gameStats;
                    if (gameStats.nickname) {
                        if (stored.profile) {
                            stored.profile.nickname = gameStats.nickname;
                        } else {
                            stored.profile = {
                                userId: "",
                                nickname: gameStats.nickname,
                                avatar: "",
                            };
                        }
                    }
                }
            } catch (error) {
                ak.Logger.debug(`  ${account.name}: Fetching game stats failed during boot: ${error}`);
            }

            this.accounts.push(stored);

            if (profile || stored.game?.nickname) {
                const stats = stored.game ? ` (Lv.${stored.game.level}, ${stored.game.charCount} Chars)` : "";
                const name = stored.profile?.nickname || account.name;
                ak.Logger.info(`  ${account.name}: ${name}${stats} (UID: ${uid})`);
            } else {
                ak.Logger.warn(`  ${account.name}: Could not fetch profile (UID: ${uid})`);
            }
        }

        ak.Logger.info(`Initialized ${this.accounts.length} ${this.name} account(s)`);
    }

    async checkIn(): Promise<SignInResult[]> {
        const { CheckIn } = await import("./check-in");
        const ci = new CheckIn(this);
        return await ci.execute();
    }

    async fetchGameStats(account: Account, options: { bypassCache?: boolean } = {}): Promise<StoredAccount["game"] | null> {
        const cacheKey = `stats:endfield:${account.name}`;

        if (!options.bypassCache) {
            const cached = cache.get<StoredAccount["game"]>(cacheKey);
            if (cached) return cached;
        }

        const runtimeCreds = getRuntimeCredentials(account.name);
        if (!runtimeCreds?.salt) {
            ak.Logger.debug(`fetchGameStats: No salt for ${account.name}, skipping card/detail`);
            return null;
        }

        try {
            const detailResponse = await ak.Got<ApiResponse<{ detail: {
                base: { serverName: string; name: string; level: number; worldLevel: number; charNum: number; weaponNum: number; lastLoginTime: string };
                spaceShip: { rooms: Array<{ id: string; level: number }> };
                dungeon: { curStamina: string | number; maxStamina: string | number; maxTs?: string | number };
                bpSystem: { curLevel: number; maxLevel: number };
                dailyMission: { dailyActivation: number; maxDailyActivation: number };
            } }>>("SKPortApp", {
                url: "game/endfield/card/detail",
                method: "GET",
            }, {
                account,
                signPath: "/api/v1/game/endfield/card/detail",
            });

            if (detailResponse.code === 0 && detailResponse.data?.detail) {
                const d = detailResponse.data.detail;
                const stats: StoredAccount["game"] = {
                    nickname: d.base.name,
                    level: d.base.level,
                    worldLevel: d.base.worldLevel,
                    charCount: d.base.charNum,
                    weaponCount: d.base.weaponNum,
                    lastLoginTime: Number(d.base.lastLoginTime),
                    serverName: d.base.serverName,
                    stamina: {
                        current: Number(d.dungeon.curStamina),
                        max: Number(d.dungeon.maxStamina),
                        recoveryTime: d.dungeon.maxTs ? Number(d.dungeon.maxTs) : undefined,
                    },
                    bp: {
                        level: d.bpSystem.curLevel,
                        maxLevel: d.bpSystem.maxLevel,
                    },
                    daily: {
                        activation: d.dailyMission.dailyActivation,
                        maxActivation: d.dailyMission.maxDailyActivation,
                    },
                };

                cache.set(cacheKey, stats, 10 * 60 * 1000);
                return stats;
            }

            ak.Logger.debug(`fetchGameStats for ${account.name} failed (code ${detailResponse.code}): ${detailResponse.message || "No message"}`, { fullResponse: detailResponse });
            return null;
        } catch (error) {
            ak.Logger.debug(`fetchGameStats failed for ${account.name}`, { error: error instanceof Error ? { message: error.message, stack: error.stack } : error });
            return null;
        }
    }
}

export default Endfield;
