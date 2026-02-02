import type { StoredAccount } from "../../skport/template";
import { formatTimeRemaining } from "../../utils/time-units";
import * as cache from "../../skport/cache";
import Endfield from "../../skport/endfield";

const ENDFIELD_ICON = "https://play-lh.googleusercontent.com/IHJeGhqSpth4VzATp_afjsCnFRc-uYgGC1EV3b2tryjyZsVrbcaeN5L_m8VKwvOSpIu_Skc49mDpLsAzC6Jl3mM";
const EMBED_COLOR_STAMINA = 0x00A8FF;
const EMBED_COLOR_THRESHOLD = 0xF1C40F; // Yellow
const EMBED_COLOR_NEAR = 0xE67E22;      // Orange
const EMBED_COLOR_FULL = 0xE74C3C;      // Red

function buildStaminaEmbed(account: StoredAccount, threshold: number) {
    const { profile, game, account: configAccount } = account;
    const nickname = game?.nickname || profile?.nickname || configAccount.name;
    const avatar = profile?.avatar || ENDFIELD_ICON;

    const stamina = game?.stamina;
    const current = stamina?.current ?? 0;
    const max = stamina?.max ?? 0;

    // threshold is negative, e.g., -10
    const target = max + threshold;

    let title = "Stamina Report";
    let description = `**${nickname}**'s stamina status update.`;
    let color = EMBED_COLOR_STAMINA;

    if (current >= max) {
        title = "Stamina Full";
        description = `**${nickname}**'s stamina is **FULL**!`;
        color = EMBED_COLOR_FULL;
    } else if (current >= max - 5) {
        title = "Stamina Almost Full";
        description = `**${nickname}**'s stamina is almost full!`;
        color = EMBED_COLOR_NEAR;
    } else if (current >= target) {
        title = "Stamina Alert";
        description = `**${nickname}**'s stamina is reaching the limit!`;
        color = EMBED_COLOR_THRESHOLD;
    }

    const fields = [
        { name: "Current Stamina", value: `**${current}** / ${max}`, inline: true },
    ];

    if (account.uid) fields.push({ name: "UID", value: account.uid, inline: true });
    if (game?.level) fields.push({ name: "Rank", value: game.level.toString(), inline: true });
    if (game?.serverName) fields.push({ name: "Region", value: game.serverName, inline: true });

    if (stamina?.recoveryTime) {
        fields.push({ name: "Fully Restored in", value: formatTimeRemaining(stamina.recoveryTime), inline: false });
    }

    return {
        title,
        description,
        color,
        thumbnail: { url: avatar },
        fields,
        footer: { text: "SKPort Stamina Monitor", icon_url: ENDFIELD_ICON },
        timestamp: new Date().toISOString(),
    };
}

export default {
    name: "stamina-check",
    expression: "*/30 * * * *",
    description: "Stamina threshold check every 30 minutes",
    code: async function () {
        ak.Logger.info("Running scheduled stamina check...");

        const endfield = ak.SKPort.get("endfield");
        if (!endfield) {
            ak.Logger.error("Endfield game instance not found");
            return;
        }

        for (const account of endfield.accounts) {
            const settings = account.account.settings;
            if (!settings?.stamina_check) {
                ak.Logger.debug(`Skipping stamina check for ${account.account.name} (disabled)`);
                continue;
            }

            const threshold = settings.stamina_threshold ?? -10;
            let shouldFetch = true;

            if (account.game?.stamina) {
                const stamina = account.game.stamina;
                const target = stamina.max + threshold;

                const predicted = cache.predictValue({
                    current: stamina.current,
                    max: stamina.max,
                    recoveryTime: stamina.recoveryTime,
                    lastUpdated: account.lastUpdated,
                    regenRate: Endfield.REGEN_RATE
                });

                if (predicted < target) {
                    ak.Logger.debug(`[${account.account.name}] Prediction: ${predicted}/${stamina.max} (Target: ${target}). Below threshold, skipping API hit.`);
                    shouldFetch = false;
                } else {
                    ak.Logger.debug(`[${account.account.name}] Prediction: ${predicted}/${stamina.max} (Target: ${target}). At or above threshold, fetching real-time data...`);
                }
            }

            if (!shouldFetch) continue;

            const stats = await endfield.fetchGameStats(account.account, { bypassCache: true });
            if (!stats || !stats.stamina) {
                ak.Logger.error(`Failed to fetch fresh stats for stamina check: ${account.account.name}`);
                continue;
            }

            account.game = stats;
            account.lastUpdated = Date.now();

            const target = stats.stamina.max + threshold;
            ak.Logger.info(`[${account.account.name}] Real-time: ${stats.stamina.current}/${stats.stamina.max} (Target: ${target})`);

            if (stats.stamina.current >= target) {
                ak.Logger.warn(`Stamina alert for ${account.account.name}: ${stats.stamina.current} points!`);

                let prefix = "Stamina Alert";
                if (stats.stamina.current >= stats.stamina.max) {
                    prefix = "Stamina Full";
                } else if (stats.stamina.current >= stats.stamina.max - 5) {
                    prefix = "Stamina Near Full";
                }

                for (const platform of ak.Platforms.values()) {
                    if (platform.isConfigured()) {
                        if (platform.name === "Discord") {
                            const embed = buildStaminaEmbed(account, threshold);
                            await platform.send({ embeds: [embed] });
                        } else {
                            await platform.send(`[${prefix}] ${account.account.name}: ${stats.stamina.current}/${stats.stamina.max}`);
                        }
                    }
                }
            }
        }
    }
};
