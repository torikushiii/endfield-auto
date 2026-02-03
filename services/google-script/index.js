const ACCOUNTS = [
    {
        name: "My Account 1",
        account_token: "YOUR_ACCOUNT_TOKEN_HERE",
        sk_game_role: "YOUR_ROLE_HERE",
    }
];

const DISCORD_WEBHOOK_URL = "";

const BASE_URL = "https://zonai.skport.com/web/v1";
const ATTENDANCE_ENDPOINT = "game/endfield/attendance";
const APP_CODE = "6eb76d4e13aa36e6";
const ENDFIELD_ICON = "https://play-lh.googleusercontent.com/IHJeGhqSpth4VzATp_afjsCnFRc-uYgGC1EV3b2tryjyZsVrbcaeN5L_m8VKwvOSpIu_Skc49mDpLsAzC6Jl3mM";

const COLORS = {
    SUCCESS: 0xFFD700,
    ALREADY: 0x3498DB,
    ERROR: 0xE74C3C
};

function main() {
    ACCOUNTS.forEach(account => {
        try {
            processAccount(account);
        } catch (e) {
            console.error(`Error [${account.name}]: ${e.message}`);
            sendNotification(account, "Sign-in Failed", e.message, COLORS.ERROR);
        }
    });
}

function processAccount(account) {
    let cred = account.cred;
    let salt = "";

    if (account.account_token) {
        console.log(`[${account.name}] Refreshing OAuth credentials...`);
        const oauthResult = performOAuthFlow(account.account_token);
        cred = oauthResult.cred;
        salt = oauthResult.salt;
    }

    if (!cred || !account.sk_game_role) {
        throw new Error("Missing credentials (cred/token or sk_game_role)");
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signPath = `/web/v1/${ATTENDANCE_ENDPOINT}`;

    const sign = salt ? generateSignV2(signPath, timestamp, salt) : generateSignV1(timestamp, cred);

    const headers = {
        "cred": cred,
        "sk-game-role": account.sk_game_role,
        "platform": "3",
        "sk-language": "en",
        "timestamp": timestamp,
        "vname": "1.0.0",
        "sign": sign,
        "User-Agent": "Skport/0.7.0 (com.gryphline.skport; build:700089; Android 33; ) Okhttp/5.1.0"
    };

    console.log(`[${account.name}] Checking attendance status...`);
    const statusResponse = UrlFetchApp.fetch(`${BASE_URL}/${ATTENDANCE_ENDPOINT}`, {
        method: "get",
        headers: headers,
        muteHttpExceptions: true
    });

    const statusData = JSON.parse(statusResponse.getContentText());
    if (statusData.code !== 0) throw new Error(`Status check failed: ${statusData.message}`);

    if (statusData.data.hasToday) {
        console.log(`[${account.name}] Already signed in today.`);
        sendNotification(account, "Already Signed In", `**${account.name}** has already claimed today's rewards`, COLORS.ALREADY);
        return;
    }

    const claimSign = salt ? generateSignV2(signPath, timestamp, salt) : generateSignV1(timestamp, cred);
    headers["sign"] = claimSign;

    console.log(`[${account.name}] Claiming daily reward...`);
    const claimResponse = UrlFetchApp.fetch(`${BASE_URL}/${ATTENDANCE_ENDPOINT}`, {
        method: "post",
        headers: headers,
        muteHttpExceptions: true
    });

    const claimData = JSON.parse(claimResponse.getContentText());
    if (claimData.code !== 0) throw new Error(`Claim failed: ${claimData.message}`);

    const rewardsText = claimData.data.awardIds.map(award => {
        const info = claimData.data.resourceInfoMap[award.id];
        return info ? `- **${info.name}** x${info.count}` : `- Reward ID: ${award.id}`;
    }).join("\n");

    const firstRewardIcon = claimData.data.awardIds[0]
        ? claimData.data.resourceInfoMap[claimData.data.awardIds[0].id]?.icon
        : null;

    sendNotification(account, "Daily Sign-in Claimed", `Successfully claimed rewards for **${account.name}**\n\n${rewardsText}`, COLORS.SUCCESS, firstRewardIcon);
}

function performOAuthFlow(accountToken) {
    const infoUrl = `https://as.gryphline.com/user/info/v1/basic?token=${encodeURIComponent(accountToken)}`;
    const infoRes = UrlFetchApp.fetch(infoUrl);
    const infoData = JSON.parse(infoRes.getContentText());
    if (infoData.status !== 0) throw new Error(`OAuth Step 1 Failed: ${infoData.msg}`);

    const grantRes = UrlFetchApp.fetch("https://as.gryphline.com/user/oauth2/v2/grant", {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ token: accountToken, appCode: APP_CODE, type: 0 })
    });
    const grantData = JSON.parse(grantRes.getContentText());
    if (grantData.status !== 0 || !grantData.data?.code) throw new Error(`OAuth Step 2 Failed: ${grantData.msg}`);

    const credRes = UrlFetchApp.fetch(`${BASE_URL}/user/auth/generate_cred_by_code`, {
        method: "post",
        contentType: "application/json",
        headers: { "platform": "3" },
        payload: JSON.stringify({ code: grantData.data.code, kind: 1 })
    });
    const credData = JSON.parse(credRes.getContentText());
    if (credData.code !== 0 || !credData.data?.cred) throw new Error(`OAuth Step 3 Failed: ${credData.message}`);

    return {
        cred: credData.data.cred,
        salt: credData.data.token,
        userId: credData.data.userId
    };
}

function generateSignV1(timestamp, cred) {
    const input = `timestamp=${timestamp}&cred=${cred}`;
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, input);
    return toHex(digest);
}

function generateSignV2(path, timestamp, salt) {
    const platform = "3";
    const vName = "1.0.0";
    const headerJson = JSON.stringify({ platform, timestamp, dId: "", vName });
    const s = `${path}${timestamp}${headerJson}`;

    const hmacBytes = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, s, salt);
    const hmacHex = toHex(hmacBytes);

    const md5Bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, hmacHex);
    return toHex(md5Bytes);
}

function toHex(bytes) {
    return bytes.map(byte => {
        const b = (byte < 0) ? byte + 256 : byte;
        return ("0" + b.toString(16)).slice(-2);
    }).join("");
}

function sendNotification(account, title, description, color, thumbnail) {
    if (!DISCORD_WEBHOOK_URL) return;

    const payload = {
        embeds: [{
            title: title,
            description: description,
            color: color,
            thumbnail: { url: thumbnail || ENDFIELD_ICON },
            footer: { text: "SKPort Auto Check-In (GAS)", icon_url: ENDFIELD_ICON },
            timestamp: new Date().toISOString()
        }]
    };

    UrlFetchApp.fetch(DISCORD_WEBHOOK_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    });
}
