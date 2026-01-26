import type { StoredAccount } from "../../skport/template";

const ENDFIELD_ICON = "https://play-lh.googleusercontent.com/IHJeGhqSpth4VzATp_afjsCnFRc-uYgGC1EV3b2tryjyZsVrbcaeN5L_m8VKwvOSpIu_Skc49mDpLsAzC6Jl3mM";
const EMBED_COLOR_DAILY = 0xF1C40F; // Warning-like yellow

function buildDailyEmbed(account: StoredAccount) {
    const { profile, game, account: configAccount } = account;
    const nickname = game?.nickname || profile?.nickname || configAccount.name;
    const avatar = profile?.avatar || ENDFIELD_ICON;

    const daily = game?.daily;
    const current = daily?.activation ?? 0;
    const max = daily?.maxActivation ?? 0;

    const fields = [
        { name: "Daily Progress", value: `**${current}** / ${max}`, inline: true },
    ];

    if (account.uid) fields.push({ name: "UID", value: account.uid, inline: true });
    if (game?.level) fields.push({ name: "Rank", value: game.level.toString(), inline: true });

    return {
        title: "Daily Mission Reminder",
        description: `**${nickname}** has not completed all daily missions yet!`,
        color: EMBED_COLOR_DAILY,
        thumbnail: { url: avatar },
        fields,
        footer: { text: "SKPort Daily Monitor", icon_url: ENDFIELD_ICON },
        timestamp: new Date().toISOString(),
    };
}

export default {
    name: "daily-check",
    expression: "0 21 * * *",
    description: "Daily mission completion check at 21:00",
    code: async function () {
        ak.Logger.info("Running scheduled daily check...");

        const endfield = ak.SKPort.get("endfield");
        if (!endfield) {
            ak.Logger.error("Endfield game instance not found");
            return;
        }

        for (const account of endfield.accounts) {
            const settings = account.account.settings;
            if (!settings?.daily_check) {
                ak.Logger.debug(`Skipping daily check for ${account.account.name} (disabled)`);
                continue;
            }

            // Fetch fresh stats (dailies change based on user actions, no prediction needed)
            const stats = await endfield.fetchGameStats(account.account, { bypassCache: true });
            if (!stats) {
                ak.Logger.error(`Failed to fetch fresh stats for daily check: ${account.account.name}`);
                continue;
            }

            account.game = stats;
            account.lastUpdated = Date.now();

            if (stats.daily && stats.daily.activation < stats.daily.maxActivation) {
                ak.Logger.warn(`Daily mission alert for ${account.account.name}: ${stats.daily.activation}/${stats.daily.maxActivation}`);

                for (const platform of ak.Platforms.values()) {
                    if (platform.isConfigured()) {
                        if (platform.name === "Discord") {
                            const embed = buildDailyEmbed(account);
                            await platform.send({ embeds: [embed] });
                        } else {
                            await platform.send(`[Daily Alert] ${account.account.name}: Missions incomplete (${stats.daily.activation}/${stats.daily.maxActivation})`);
                        }
                    }
                }
            } else {
                ak.Logger.info(`Daily missions for ${account.account.name} are completed or no data available.`);
            }
        }
    }
};
