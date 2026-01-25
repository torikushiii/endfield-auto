import type { CheckInResult } from "../../skport/endfield/check-in";

const ENDFIELD_ICON = "https://play-lh.googleusercontent.com/IHJeGhqSpth4VzATp_afjsCnFRc-uYgGC1EV3b2tryjyZsVrbcaeN5L_m8VKwvOSpIu_Skc49mDpLsAzC6Jl3mM";
const EMBED_COLOR_SUCCESS = 0xFFD700;
const EMBED_COLOR_ALREADY = 0x3498DB;
const EMBED_COLOR_ERROR = 0xE74C3C;

function buildDiscordEmbed(result: CheckInResult, index: number, total: number) {
    const { name, status, rewards, profile, error } = result;
    const nickname = profile.nickname || name;
    const avatar = profile.avatar || ENDFIELD_ICON;

    let title: string;
    let description: string;
    let color: number;
    const fields: Array<{ name: string; value: string; inline: boolean }> = [];
    let thumbnail = ENDFIELD_ICON;

    switch (status) {
    case "claimed":
        color = EMBED_COLOR_SUCCESS;
        title = "Daily Sign-in Claimed";
        description = `Successfully claimed rewards for **${nickname}**`;
        break;
    case "already_claimed":
        color = EMBED_COLOR_ALREADY;
        title = "Already Signed In";
        description = `**${nickname}** has already claimed today's rewards`;
        break;
    case "error":
    default:
        color = EMBED_COLOR_ERROR;
        title = "Sign-in Failed";
        description = `Could not complete sign-in for **${nickname}**`;
        if (error) {
            fields.push({ name: "Error", value: error, inline: false });
        }
        break;
    }

    if (rewards.length > 0) {
        const rewardsText = rewards
            .map((r) => `- **${r.name}** x${r.count}`)
            .join("\n");
        fields.push({ name: "Today's Reward", value: rewardsText, inline: false });
        thumbnail = rewards[0]?.icon || ENDFIELD_ICON;
    }

    if (result.game) {
        if (result.game.uid) fields.push({ name: "UID", value: result.game.uid, inline: true });
        if (result.game.server) fields.push({ name: "Region", value: result.game.server, inline: true });
        if (result.game.level) fields.push({ name: "Rank", value: result.game.level.toString(), inline: true });
        if (result.game.charCount) fields.push({ name: "Characters", value: result.game.charCount.toString(), inline: true });
    }

    if (result.attendance?.totalSignIns !== undefined) {
        fields.push({ name: "Total Sign-ins", value: result.attendance.totalSignIns.toString(), inline: true });
    }

    return {
        title,
        description,
        color,
        thumbnail: { url: thumbnail },
        fields,
        footer: { text: `SKPort Auto Check-In (${index}/${total}) Executed`, icon_url: avatar },
        timestamp: new Date().toISOString(),
    };
}

export default {
    name: "check-in",
    expression: "0 0 * * *",
    description: "Daily sign-in check at scheduled time",
    code: async () => {
        ak.Logger.info("Running scheduled check-in...");

        const endfield = ak.SKPort.get("endfield");
        if (!endfield) {
            ak.Logger.error("Endfield game instance not found");
            return;
        }

        const results = await endfield.checkIn();

        ak.Logger.info("=".repeat(50));
        ak.Logger.info("Scheduled check-in summary");

        for (const result of results) {
            let status: string;
            switch (result.status) {
            case "claimed":
                status = "Claimed";
                break;
            case "already_claimed":
                status = "Already claimed";
                break;
            default:
                status = "Error";
            }
            ak.Logger.info(`  ${status} - ${result.name}`);
        }

        const successCount = results.filter(
            (r) => r.status === "claimed" || r.status === "already_claimed"
        ).length;
        ak.Logger.info(`  Total: ${successCount}/${results.length} accounts processed`);

        for (const platform of ak.Platforms.values()) {
            if (platform.isConfigured()) {
                for (let i = 0; i < results.length; i++) {
                    const result = results[i]!;
                    if (platform.name === "Discord") {
                        const embed = buildDiscordEmbed(result, i + 1, results.length);
                        await platform.send({ embeds: [embed] });
                    } else {
                        await platform.send(`${result.name}: ${result.status}`);
                    }
                }
            }
        }
    }
};
