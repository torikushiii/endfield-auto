import { createCanvas, type CanvasRenderingContext2D } from "@napi-rs/canvas";
import { registerFonts, pathIndustrial } from "../../utils/canvas";
import { getRemoteAsset } from "../../utils/assets";
import type { StoredAccount, SignInResult } from "../template";

registerFonts();

const COLOR_BG = "#0F1112";
const COLOR_ACCENT = "#FF7E00";
const COLOR_BORDER = "#2A2E30";
const COLOR_TEXT_PRIMARY = "#FFFFFF";
const COLOR_TEXT_SECONDARY = "#8A8E91";

function drawStripes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const gap = 8;
    for (let i = -h; i < w + h; i += gap) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + h, y + h);
        ctx.stroke();
    }
    ctx.restore();
}

export async function drawDashboard(data: StoredAccount): Promise<Buffer> {
    const { profile, game, uid } = data;
    const stats = game;

    const width = 1600;
    const height = 900;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    const stepX = 40;
    for (let x = 0; x < width; x += stepX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    const stepY = 40;
    for (let y = 0; y < height; y += stepY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    ctx.fillStyle = COLOR_ACCENT;
    ctx.fillRect(35, 35, 30, 10);
    ctx.fillRect(35, 35, 10, 30);
    ctx.fillRect(width - 65, 35, 30, 10);
    ctx.fillRect(width - 45, 35, 10, 30);

    const headerY = 80;
    const avatarSize = 140;

    ctx.save();
    pathIndustrial(ctx, 80, headerY, avatarSize, avatarSize, 20);
    ctx.clip();
    if (profile?.avatar) {
        const avatarImg = await getRemoteAsset(profile.avatar);
        if (avatarImg) {
            ctx.drawImage(avatarImg, 80, headerY, avatarSize, avatarSize);
        } else {
            ctx.fillStyle = "#222";
            ctx.fillRect(80, headerY, avatarSize, avatarSize);
        }
    }
    ctx.restore();

    ctx.strokeStyle = COLOR_ACCENT;
    ctx.lineWidth = 2;
    pathIndustrial(ctx, 80, headerY, avatarSize, avatarSize, 20);
    ctx.stroke();

    ctx.fillStyle = COLOR_TEXT_PRIMARY;
    ctx.font = "bold 64px EndfieldBold";
    const nickname = stats?.nickname || profile?.nickname || "OPERATOR";
    ctx.fillText(nickname.toUpperCase(), 80 + avatarSize + 40, headerY + 60);

    ctx.fillStyle = COLOR_ACCENT;
    ctx.font = "bold 24px EndfieldBold";
    ctx.fillText("PROTOCOL: FIELD_TERMINAL_V1.0", 80 + avatarSize + 40, headerY + 100);

    ctx.fillStyle = COLOR_TEXT_SECONDARY;
    ctx.font = "20px EndfieldBold";
    ctx.fillText(`UID: ${uid} | REGION: ${stats?.serverName?.toUpperCase() || "GLOBAL"}`, 80 + avatarSize + 40, headerY + 130);

    drawStripes(ctx, 80, 250, width - 160, 4, "rgba(255, 255, 255, 0.1)");

    const statsY = 300;
    const statsW = (width - 240) / 4;
    const statsH = 120;
    const statsGap = 30;

    const gridStats = [
        { label: "EXPLORATION_LV", value: (stats?.worldLevel ?? 0).toString().padStart(2, "0") },
        { label: "AUTH_LEVEL", value: (stats?.level ?? 0).toString().padStart(2, "0") },
        { label: "OPERATORS", value: (stats?.charCount ?? 0).toString().padStart(2, "0") },
        { label: "WEAPONS", value: (stats?.weaponCount ?? 0).toString().padStart(2, "0") },
    ];

    gridStats.forEach((stat, i) => {
        const x = 80 + (statsW + statsGap) * i;

        ctx.strokeStyle = COLOR_BORDER;
        ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
        pathIndustrial(ctx, x, statsY, statsW, statsH, 15);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = COLOR_TEXT_SECONDARY;
        ctx.font = "bold 18px EndfieldBold";
        ctx.fillText(stat.label, x + 20, statsY + 35);

        ctx.fillStyle = COLOR_TEXT_PRIMARY;
        ctx.font = "bold 56px EndfieldBold";
        ctx.fillText(stat.value, x + 20, statsY + 95);

        ctx.fillStyle = COLOR_ACCENT;
        ctx.fillRect(x + statsW - 15, statsY + 15, 5, 5);
    });

    const staminaY = 480;
    const staminaW = width - 160;
    const staminaH = 280;

    ctx.strokeStyle = COLOR_BORDER;
    ctx.fillStyle = "rgba(255, 126, 0, 0.05)";
    pathIndustrial(ctx, 80, staminaY, staminaW, staminaH, 30);
    ctx.fill();
    ctx.stroke();

    const sectionHeaderTag = "STAMINA_CORE";
    ctx.font = "bold 24px EndfieldBold";
    const tagWidth = ctx.measureText(sectionHeaderTag).width + 60;

    ctx.fillStyle = COLOR_ACCENT;
    ctx.fillRect(80, staminaY, tagWidth, 40);

    drawStripes(ctx, 80, staminaY, tagWidth, 40, "rgba(0, 0, 0, 0.2)");

    ctx.fillStyle = "#000";
    ctx.fillText(sectionHeaderTag, 100, staminaY + 30);

    if (stats?.stamina) {
        const { current, max, recoveryTime } = stats.stamina;
        const isHigh = current >= max - 10;

        ctx.fillStyle = COLOR_TEXT_SECONDARY;
        ctx.font = "16px EndfieldBold";
        ctx.fillText("PARAMETER: ENERGY_RESERVE", 110, staminaY + 80);
        ctx.fillText("STATUS:", 110, staminaY + 240);

        ctx.fillStyle = isHigh ? COLOR_ACCENT : "#00FF7F";
        ctx.font = "bold 20px EndfieldBold";
        ctx.fillText(isHigh ? "WARNING: LIMIT_REACHED" : "OPTIMAL", 190, staminaY + 240);

        ctx.fillStyle = COLOR_TEXT_PRIMARY;
        ctx.font = "bold 120px EndfieldBold";
        ctx.fillText(current.toString(), 110, staminaY + 200);

        const curWidth = ctx.measureText(current.toString()).width;
        ctx.fillStyle = COLOR_TEXT_SECONDARY;
        ctx.font = "bold 40px EndfieldBold";
        ctx.fillText(`/ ${max}`, 110 + curWidth + 20, staminaY + 200);

        const gaugeX = 500;
        const gaugeY = staminaY + 120;
        const gaugeH = 60;
        const segments = 20;
        const segmentW = (staminaW - gaugeX - 40) / segments;
        const ratio = current / max;

        for (let i = 0; i < segments; i++) {
            const segX = gaugeX + i * segmentW;
            const active = (i / segments) < ratio;

            ctx.fillStyle = active
                ? (isHigh ? COLOR_ACCENT : "rgba(0, 255, 127, 0.8)")
                : "rgba(255, 255, 255, 0.05)";

            ctx.beginPath();
            ctx.moveTo(segX + 2, gaugeY);
            ctx.lineTo(segX + segmentW - 2, gaugeY);
            ctx.lineTo(segX + segmentW + 8, gaugeY + gaugeH);
            ctx.lineTo(segX + 12, gaugeY + gaugeH);
            ctx.closePath();
            ctx.fill();
        }

        if (current < max && recoveryTime) {
            const diff = Math.max(0, recoveryTime - Date.now() / 1000);
            const h = Math.floor(diff / 3600);
            const m = Math.floor((diff % 3600) / 60);

            ctx.fillStyle = COLOR_TEXT_SECONDARY;
            ctx.font = "16px EndfieldBold";
            ctx.fillText("RECOVERY_ETA:", gaugeX, gaugeY - 20);

            ctx.fillStyle = COLOR_TEXT_PRIMARY;
            ctx.font = "bold 24px EndfieldBold";
            ctx.fillText(`${h}H ${m}M`, gaugeX + 140, gaugeY - 20);
        }
    }

    ctx.fillStyle = COLOR_TEXT_SECONDARY;
    ctx.font = "14px EndfieldBold";
    ctx.textAlign = "right";
    const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
    ctx.fillText(`TS_LOG: ${timestamp} UTC`, width - 60, height - 60);
    ctx.textAlign = "left";
    ctx.fillText("END_AUTO_DIAGNOSTICS // PROJECT_TALOS", 60, height - 60);

    return canvas.toBuffer("image/png");
}

export async function drawCheckInCard(result: SignInResult): Promise<Buffer> {
    const { profile, game, rewards, attendance, status } = result;
    const width = 1200;
    const height = 650;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 126, 0, 0.03)";
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    ctx.fillStyle = COLOR_ACCENT;
    ctx.fillRect(25, 25, 40, 4);
    ctx.fillRect(25, 25, 4, 40);
    ctx.fillRect(width - 65, height - 29, 40, 4);
    ctx.fillRect(width - 29, height - 65, 4, 40);

    const headerY = 60;
    ctx.fillStyle = COLOR_ACCENT;
    ctx.fillRect(60, headerY, 8, 40);

    ctx.fillStyle = COLOR_TEXT_PRIMARY;
    ctx.font = "bold 32px EndfieldBold";
    ctx.fillText("PROTOCOL: SIGN_IN_RECOVERY_V2", 85, headerY + 32);

    ctx.textAlign = "right";
    ctx.font = "18px EndfieldBold";
    ctx.fillStyle = COLOR_TEXT_SECONDARY;
    const statusText = status === "claimed" ? "STATUS: SUCCESSFUL" : status === "already_claimed" ? "STATUS: ALREADY_LOGGED" : "STATUS: ERROR";
    ctx.fillText(statusText, width - 60, headerY + 28);
    ctx.textAlign = "left";

    const profileX = 60;
    const profileY = 140;
    const avatarSize = 120;

    ctx.save();
    pathIndustrial(ctx, profileX, profileY, avatarSize, avatarSize, 15);
    ctx.clip();
    const avatarUrl = profile.avatar || "https://play-lh.googleusercontent.com/IHJeGhqSpth4VzATp_afjsCnFRc-uYgGC1EV3b2tryjyZsVrbcaeN5L_m8VKwvOSpIu_Skc49mDpLsAzC6Jl3mM";
    const avatarImg = await getRemoteAsset(avatarUrl);
    if (avatarImg) ctx.drawImage(avatarImg, profileX, profileY, avatarSize, avatarSize);
    ctx.restore();

    ctx.strokeStyle = COLOR_ACCENT;
    ctx.lineWidth = 2;
    pathIndustrial(ctx, profileX, profileY, avatarSize, avatarSize, 15);
    ctx.stroke();

    ctx.fillStyle = COLOR_TEXT_PRIMARY;
    ctx.font = "bold 36px EndfieldBold";
    ctx.fillText((profile.nickname || "OPERATOR").toUpperCase(), profileX + avatarSize + 30, profileY + 45);

    ctx.fillStyle = COLOR_TEXT_SECONDARY;
    ctx.font = "20px EndfieldBold";
    ctx.fillText(`UID: ${game?.uid || "-------"}`, profileX + avatarSize + 30, profileY + 80);
    ctx.fillText(`AUTH_LV. ${game?.level || "--"}`, profileX + avatarSize + 30, profileY + 110);

    const mainRewardItem = rewards[0];
    if (mainRewardItem) {
        const rewardX = 550;
        const rewardY = 160;
        const rewardSize = 160;

        ctx.fillStyle = "rgba(255, 126, 0, 0.05)";
        ctx.fillRect(rewardX - 20, rewardY - 20, 580, 200);
        ctx.strokeStyle = "rgba(255, 126, 0, 0.1)";
        ctx.strokeRect(rewardX - 20, rewardY - 20, 580, 200);

        if (mainRewardItem.icon) {
            const itemImg = await getRemoteAsset(mainRewardItem.icon);
            if (itemImg) {
                ctx.drawImage(itemImg, rewardX, rewardY, rewardSize, rewardSize);
            }
        }

        const itemName = ((mainRewardItem.name ?? "UNKNOWN_ITEM").split("|")[0] ?? "UNKNOWN_ITEM").toUpperCase();
        ctx.fillStyle = COLOR_TEXT_PRIMARY;
        ctx.font = "bold 28px EndfieldBold";

        if (ctx.measureText(itemName).width > 380) {
            ctx.font = "bold 20px EndfieldBold";
        }
        ctx.fillText(itemName, rewardX + rewardSize + 20, rewardY + 70);

        if (mainRewardItem.count !== undefined) {
            ctx.fillStyle = COLOR_ACCENT;
            ctx.font = "bold 48px EndfieldBold";
            ctx.fillText(`x${mainRewardItem.count}`, rewardX + rewardSize + 20, rewardY + 130);
        }
    }

    const nextRewardItem = result.nextReward;
    if (nextRewardItem) {
        const nextX = 550;
        const nextY = 400;
        const nextSize = 80;

        ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
        ctx.fillRect(nextX - 10, nextY - 10, 580, 185);
        ctx.strokeStyle = COLOR_BORDER;
        ctx.strokeRect(nextX - 10, nextY - 10, 580, 185);

        ctx.fillStyle = COLOR_TEXT_SECONDARY;
        ctx.font = "bold 16px EndfieldBold";
        ctx.fillText("NEXT_SCHEDULED_REQUISITION", nextX + 10, nextY + 20);

        if (nextRewardItem.icon) {
            const nextImg = await getRemoteAsset(nextRewardItem.icon);
            if (nextImg) {
                ctx.drawImage(nextImg, nextX + 10, nextY + 40, nextSize, nextSize);
            }
        }

        const nextName = ((nextRewardItem.name ?? "UNKNOWN_ITEM").split("|")[0] ?? "UNKNOWN_ITEM").toUpperCase();
        ctx.fillStyle = COLOR_TEXT_PRIMARY;
        ctx.font = "bold 20px EndfieldBold";
        ctx.fillText(nextName, nextX + nextSize + 30, nextY + 75);

        if (nextRewardItem.count !== undefined) {
            ctx.fillStyle = COLOR_ACCENT;
            ctx.font = "bold 28px EndfieldBold";
            ctx.fillText(`x${nextRewardItem.count}`, nextX + nextSize + 30, nextY + 110);
        }

        ctx.fillStyle = "rgba(255, 126, 0, 0.3)";
        ctx.fillRect(nextX + 10, nextY + 135, 560, 30);
        drawStripes(ctx, nextX + 10, nextY + 135, 560, 30, "rgba(0, 0, 0, 0.2)");

        ctx.fillStyle = "#000";
        ctx.font = "bold 14px EndfieldBold";
        ctx.textAlign = "center";
        ctx.fillText("UPCOMING ACQUISITION // STANDBY FOR SYNCHRONIZATION", nextX + 290, nextY + 155);
        ctx.textAlign = "left";
    }

    if (attendance?.calendar) {
        const gridX = 60;
        const gridY = 400;
        const boxSize = 45;
        const gap = 12;
        const cols = 7;

        ctx.fillStyle = COLOR_TEXT_SECONDARY;
        ctx.font = "bold 18px EndfieldBold";
        ctx.fillText(`ATTENDANCE_LOG // TOTAL_ENTRIES: ${attendance.totalSignIns || 0}`, gridX, gridY - 20);

        attendance.calendar.forEach((day, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = gridX + col * (boxSize + gap);
            const y = gridY + row * (boxSize + gap);

            if (day.done) {
                ctx.fillStyle = COLOR_ACCENT;
                ctx.fillRect(x, y, boxSize, boxSize);

                ctx.strokeStyle = "#000";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x + 10, y + boxSize/2);
                ctx.lineTo(x + boxSize/2 - 2, y + boxSize - 12);
                ctx.lineTo(x + boxSize - 10, y + 10);
                ctx.stroke();
            } else {
                ctx.strokeStyle = COLOR_BORDER;
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, boxSize, boxSize);

                if (day.available) {
                    ctx.fillStyle = "rgba(255, 126, 0, 0.2)";
                    ctx.fillRect(x + 5, y + 5, boxSize - 10, boxSize - 10);
                }
            }
        });
    }

    ctx.textAlign = "right";
    ctx.fillStyle = COLOR_TEXT_SECONDARY;
    ctx.font = "14px EndfieldBold";
    ctx.fillText("END_SIGN_IN_DIAGNOSTICS // AUTH_TOKEN_VALID", width - 60, height - 50);

    return canvas.toBuffer("image/png");
}
