import type { Account } from "../../utils/config";
import type { ApiResponse, StoredAccount, SignInResult, Reward } from "../template";
import type { Endfield } from ".";
import * as cache from "../cache";

const ENDFIELD_ICON = "https://play-lh.googleusercontent.com/IHJeGhqSpth4VzATp_afjsCnFRc-uYgGC1EV3b2tryjyZsVrbcaeN5L_m8VKwvOSpIu_Skc49mDpLsAzC6Jl3mM";

export interface AttendanceData {
    hasToday: boolean;
    calendar?: Array<{
        awardId: string;
        available: boolean;
        done: boolean;
    }>;
    resourceInfoMap?: Record<string, {
        id: string;
        name: string;
        count: number;
        icon: string;
    }>;
}

export interface ClaimData {
    awardIds: Array<{ id: string }>;
    resourceInfoMap: Record<string, { name: string; count: number; icon: string }>;
}

export type CheckInResult = SignInResult;

export class CheckIn {
    #instance: Endfield;

    constructor(instance: Endfield) {
        this.#instance = instance;
    }

    async execute(): Promise<CheckInResult[]> {
        const results: CheckInResult[] = [];

        for (const stored of this.#instance.accounts) {
            const result = await this.#processAccount(stored);
            results.push(result);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        return results;
    }

    async #processAccount(stored: StoredAccount): Promise<CheckInResult> {
        const { account, profile, uid } = stored;
        const name = account.name;

        const hasAuth = await this.#instance.initOAuth(account);

        ak.Logger.info("=".repeat(50));
        ak.Logger.info(`Account: ${name}`);

        const result: CheckInResult = {
            name,
            status: "error",
            rewards: [],
            profile: {},
            game: {
                uid: account.sk_game_role?.split("_")[1] || account.sk_game_role,
                level: stored.game?.level,
                server: stored.game?.serverName,
                charCount: stored.game?.charCount,
            },
            attendance: {
                totalSignIns: stored.attendance?.totalSignIns,
            },
            error: undefined,
        };

        if (!hasAuth || !account.sk_game_role) {
            ak.Logger.error("  Missing valid credentials or sk_game_role");
            result.error = "Missing valid credentials or sk_game_role";
            return result;
        }

        ak.Logger.info(`  UID: ${uid}`);

        if (profile) {
            result.profile = {
                nickname: profile.nickname,
                user_id: profile.userId,
                avatar: profile.avatar || ENDFIELD_ICON,
            };
            ak.Logger.info(`  Logged in as: ${profile.nickname} (ID: ${profile.userId})`);
        } else {
            ak.Logger.warn("  Profile not available");
        }

        const { data: attendanceData, canClaim } = await this.#checkAttendance(account);

        if (attendanceData?.code === 0 && attendanceData.data) {
            const data = attendanceData.data;
            const calendar = data.calendar || [];
            const doneRecords = calendar.filter(r => r.done);

            if (doneRecords.length > 0) {
                result.attendance = {
                    totalSignIns: doneRecords.length,
                    calendar: calendar.map(c => ({ awardId: c.awardId, available: c.available, done: c.done })),
                };

                // If already claimed, extract today's reward from the last 'done' entry in calendar
                if (!canClaim) {
                    const lastDone = doneRecords[doneRecords.length - 1];
                    if (lastDone) {
                        const info = data.resourceInfoMap?.[lastDone.awardId];
                        if (info) {
                            result.rewards = [{
                                name: info.name,
                                count: info.count,
                                icon: info.icon,
                            }];
                        }
                    }
                }
            }

            // Extract next reward
            const firstClaimable = calendar.find(r => !r.done);
            if (firstClaimable) {
                const info = data.resourceInfoMap?.[firstClaimable.awardId];
                if (info) {
                    result.nextReward = {
                        name: info.name,
                        count: info.count,
                        icon: info.icon,
                    };
                }
            }
        }

        if (canClaim) {
            const { success, rewards } = await this.#claimAttendance(account, result);
            if (success) {
                result.status = "claimed";
                result.rewards = rewards;
                if (result.attendance?.totalSignIns !== undefined) {
                    result.attendance.totalSignIns++;
                }
            } else {
                result.status = "error";
                result.error = "Failed to claim attendance";
            }
        } else if (attendanceData?.code === 0) {
            ak.Logger.info("  Already signed in today. Nothing to claim.");
            result.status = "already_claimed";
        } else {
            ak.Logger.warn("  Could not determine attendance status.");
            result.error = "Could not determine attendance status";
        }

        try {
            const gameStats = await this.#instance.fetchGameStats(account);
            if (gameStats) {
                result.game = {
                    ...result.game,
                    level: gameStats.level,
                    server: gameStats.serverName,
                    charCount: gameStats.charCount,
                };

                if (gameStats.nickname) {
                    result.profile.nickname = gameStats.nickname;
                    if (stored.profile) {
                        stored.profile.nickname = gameStats.nickname;
                    }
                }
                stored.game = gameStats;
            }
        } catch (error) {
            ak.Logger.warn(`  Failed to fetch enriched game stats: ${error}`);
        }

        stored.attendance = result.attendance;
        stored.lastUpdated = Date.now();

        return result;
    }

    async #checkAttendance(account: Account): Promise<{ data: ApiResponse<AttendanceData> | null; canClaim: boolean }> {
        const cacheKey = `attendance:endfield:${account.name}`;
        const cached = cache.get<ApiResponse<AttendanceData>>(cacheKey);

        if (cached && cached.code === 0 && cached.data) {
            const hasToday = cached.data.hasToday ?? false;
            // If they haven't signed in today, we should still allow the claim part to run
            // but the status check is cached. If hasToday is true, we can definitely skip.
            if (hasToday) {
                return { data: cached, canClaim: false };
            }
        }

        try {
            const data = await ak.Got<ApiResponse<AttendanceData>>("SKPortWeb", {
                url: "game/endfield/attendance",
                method: "GET",
            }, { account });

            if (data.code === 0) {
                cache.set(cacheKey, data, 30 * 60 * 1000);
                const hasToday = data.data?.hasToday ?? false;
                return { data, canClaim: !hasToday };
            }
            return { data, canClaim: false };
        } catch (error) {
            ak.Logger.error(`Attendance check failed: ${error}`);
            return { data: null, canClaim: false };
        }
    }

    async #claimAttendance(account: Account, result: CheckInResult): Promise<{ success: boolean; rewards: Reward[] }> {
        try {
            const data = await ak.Got<ApiResponse<ClaimData>>("SKPortWeb", {
                url: "game/endfield/attendance",
                method: "POST",
            }, {
                account,
                signPath: "/web/v1/game/endfield/attendance",
                useV2Sign: true,
            });

            if (data.code === 0) {
                ak.Logger.info("  Successfully claimed attendance");

                const awards = data.data?.awardIds ?? [];
                const resourceMap = data.data?.resourceInfoMap ?? {};
                const rewards: Reward[] = [];

                for (const award of awards) {
                    const info = resourceMap[award.id];
                    if (info) {
                        ak.Logger.info(`     - ${info.name} x${info.count}`);
                        rewards.push({
                            name: info.name,
                            count: info.count,
                            icon: info.icon || "",
                        });
                    }
                }

                const cacheKey = `attendance:endfield:${account.name}`;
                const total = (result.attendance?.totalSignIns || 0) + 1;
                const cachedRecords: Array<{ resourceName?: string; count?: number; icon?: string }> = new Array(total).fill({});
                const lastReward = rewards[0];
                if (lastReward) {
                    cachedRecords[total - 1] = {
                        resourceName: lastReward.name,
                        count: lastReward.count,
                        icon: lastReward.icon,
                    };
                }

                cache.set(cacheKey, {
                    code: 0,
                    data: {
                        hasToday: true,
                        records: cachedRecords,
                    }
                }, 12 * 60 * 60 * 1000);

                return { success: true, rewards };
            }

            ak.Logger.error(`  Error: ${data.message || "Unknown error"}`);
            return { success: false, rewards: [] };
        } catch (error) {
            ak.Logger.error(`  Request failed: ${error}`);
            return { success: false, rewards: [] };
        }
    }
}
