import type { CommandModule, CommandContext } from "../../classes/command";
import type { GameStats } from "../../skport/template";
import { formatTimeRemaining } from "../../utils/time-units";
import * as cache from "../../skport/cache";
import Endfield from "../../skport/endfield";
import { drawDashboard } from "../../skport/endfield/renderer";
import { AttachmentBuilder } from "discord.js";

const ENDFIELD_ICON = "https://play-lh.googleusercontent.com/IHJeGhqSpth4VzATp_afjsCnFRc-uYgGC1EV3b2tryjyZsVrbcaeN5L_m8VKwvOSpIu_Skc49mDpLsAzC6Jl3mM";
const EMBED_COLOR = 0x2ECC71;
const STAMINA_COLOR_THRESHOLD = 0xF1C40F;
const STAMINA_COLOR_NEAR = 0xE67E22;
const STAMINA_COLOR_FULL = 0xE74C3C;

function buildTerminalEmbed(accountName: string, stats: GameStats, uid: string, avatar?: string) {
    const nickname = stats.nickname || accountName;
    const fields: Array<{ name: string; value: string; inline: boolean }> = [];

    fields.push({ name: "UID", value: uid, inline: true });
    if (stats.level) fields.push({ name: "Rank", value: stats.level.toString(), inline: true });
    if (stats.serverName) fields.push({ name: "Region", value: stats.serverName, inline: true });
    if (stats.worldLevel !== undefined) fields.push({ name: "World Level", value: stats.worldLevel.toString(), inline: true });

    let embedColor = EMBED_COLOR;

    if (stats.stamina) {
        const { current, max } = stats.stamina;
        let staminaValue = `**${current}** / ${max}`;

        if (current >= max) {
            staminaValue = `**${current} / ${max} (FULL)**`;
            embedColor = STAMINA_COLOR_FULL;
        } else if (current >= max - 5) {
            embedColor = STAMINA_COLOR_NEAR;
        } else if (current >= max - 20) {
            embedColor = STAMINA_COLOR_THRESHOLD;
        }

        if (stats.stamina.recoveryTime && current < max) {
            const timeStr = formatTimeRemaining(stats.stamina.recoveryTime);
            staminaValue += `\nRestored in: ${timeStr}`;
        }
        fields.push({ name: "Stamina", value: staminaValue, inline: true });
    }

    if (stats.daily) {
        fields.push({ name: "Daily Progress", value: `${stats.daily.activation}/${stats.daily.maxActivation}`, inline: true });
    }
    if (stats.bp) {
        fields.push({ name: "Battle Pass", value: `Lv.${stats.bp.level}/${stats.bp.maxLevel}`, inline: true });
    }

    if (stats.charCount) fields.push({ name: "Operators", value: stats.charCount.toString(), inline: true });
    if (stats.weaponCount) fields.push({ name: "Weapons", value: stats.weaponCount.toString(), inline: true });

    return {
        title: `Protocol Terminal: ${nickname}`,
        color: embedColor,
        thumbnail: { url: avatar || ENDFIELD_ICON },
        fields,
        footer: { text: "Endfield Field Terminal Status", icon_url: ENDFIELD_ICON },
        timestamp: new Date().toISOString(),
    };
}

const terminal: CommandModule = {
    name: "terminal",
    description: "View detailed account status and stamina recovery",
    aliases: ["stat", "stats", "stamina"],
    options: () => {
        const endfield = ak.SKPort.get("endfield");
        const accounts = endfield?.accounts || [];

        const choices = [
            { name: "All Accounts", value: "all" },
            ...accounts.map(a => ({
                name: a.game?.nickname || a.account.name,
                value: a.account.name
            }))
        ];

        return [
            {
                name: "account",
                description: "Select an account or all accounts",
                type: 3,
                required: true,
                choices: choices.slice(0, 25)
            }
        ];
    },
    run: async (ctx: CommandContext, accountArg: string) => {
        await ctx.defer();
        try {
            const endfield = ak.SKPort.get("endfield");
            if (!endfield) {
                await ctx.ephemeral("Endfield game instance not found.");
                return;
            }

            if (endfield.accounts.length === 0) {
                await ctx.ephemeral("No accounts initialized.");
                return;
            }

            let accountsToShow = endfield.accounts;

            if (accountArg && accountArg !== "all") {
                const filtered = endfield.accounts.filter(a =>
                    a.account.name === accountArg ||
                    a.game?.nickname === accountArg
                );

                if (filtered.length === 0) {
                    await ctx.ephemeral(`No account found matching "**${accountArg}**".`);
                    return;
                }
                accountsToShow = filtered;
            }

            for (const stored of accountsToShow) {
                if (!stored.game) {
                    await ctx.ephemeral(`Detailed data for **${stored.account.name}** is not yet available. Please try again after the next automated update or use /check-in.`);
                    continue;
                }

                if (stored.game.stamina) {
                    stored.game.stamina.current = cache.predictValue({
                        current: stored.game.stamina.current,
                        max: stored.game.stamina.max,
                        recoveryTime: stored.game.stamina.recoveryTime,
                        lastUpdated: stored.lastUpdated,
                        regenRate: Endfield.REGEN_RATE
                    });
                }

                if (ctx.platform.name === "Discord") {
                    try {
                        const buffer = await drawDashboard(stored);
                        const attachment = new AttachmentBuilder(buffer, { name: "terminal.png" });
                        await ctx.ephemeral({ files: [attachment] });
                    } catch (error) {
                        ak.Logger.error("Failed to draw dashboard, falling back to embed:", error);
                        const embed = buildTerminalEmbed(
                            stored.account.name,
                            stored.game,
                            stored.uid,
                            stored.profile?.avatar
                        );
                        await ctx.ephemeral({ embeds: [embed] });
                    }
                } else {
                    const s = stored.game;
                    let text = `[${s.nickname || stored.account.name}]\n`;
                    text += `Rank: ${s.level} | WL: ${s.worldLevel} | Server: ${s.serverName}\n`;
                    if (s.stamina) {
                        text += `Stamina: ${s.stamina.current}/${s.stamina.max}`;
                        if (s.stamina.recoveryTime) text += ` (Full in: ${formatTimeRemaining(s.stamina.recoveryTime)})`;
                        text += "\n";
                    }
                    if (s.daily) text += `Daily: ${s.daily.activation}/${s.daily.maxActivation}\n`;
                    if (s.bp) text += `BP: Lv.${s.bp.level}/${s.bp.maxLevel}\n`;

                    await ctx.ephemeral(text);
                }
            }
        } catch (error) {
            ak.Logger.error("Terminal command failed:", { error });
            await ctx.ephemeral("Failed to fetch terminal status.");
        }
    }
};

export default terminal;
