import crypto from "crypto";

export interface OAuthCredentials {
    cred: string;
    salt: string;
    userId: string;
    hgId?: string;
}

interface BasicInfoResponse {
    status: number;
    data?: { hgId: string; nickname: string; email: string };
    msg?: string;
}

interface GrantCodeResponse {
    status: number;
    data?: { uid: string; code: string };
    msg?: string;
}

interface GenerateCredResponse {
    code: number;
    message: string;
    data?: { cred: string; token: string; userId: string };
}

async function getBasicInfo(accountToken: string): Promise<BasicInfoResponse> {
    const url = `https://as.gryphline.com/user/info/v1/basic?token=${encodeURIComponent(accountToken)}`;
    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
    });
    return await response.json() as BasicInfoResponse;
}

async function grantOAuthCode(accountToken: string): Promise<GrantCodeResponse> {
    const response = await fetch("https://as.gryphline.com/user/oauth2/v2/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ token: accountToken, appCode: "6eb76d4e13aa36e6", type: 0 }),
    });
    return await response.json() as GrantCodeResponse;
}

async function generateCredByCode(code: string): Promise<GenerateCredResponse> {
    const response = await fetch("https://zonai.skport.com/web/v1/user/auth/generate_cred_by_code", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "platform": "3",
            "Referer": "https://www.skport.com/",
            "Origin": "https://www.skport.com",
        },
        body: JSON.stringify({ code, kind: 1 }),
    });
    return await response.json() as GenerateCredResponse;
}

export async function performOAuthFlow(accountToken: string): Promise<OAuthCredentials> {
    const basicResult = await getBasicInfo(accountToken);
    if (basicResult.status !== 0) {
        throw new Error(`OAuth Step 1 failed: ${basicResult.msg || `status ${basicResult.status}`}`);
    }

    const grantResult = await grantOAuthCode(accountToken);
    if (grantResult.status !== 0 || !grantResult.data?.code) {
        throw new Error(`OAuth Step 2 failed: ${grantResult.msg || `status ${grantResult.status}`}`);
    }

    const credResult = await generateCredByCode(grantResult.data.code);
    if (credResult.code !== 0 || !credResult.data?.cred) {
        throw new Error(`OAuth Step 3 failed: ${credResult.message || `code ${credResult.code}`}`);
    }

    return {
        cred: credResult.data.cred,
        salt: credResult.data.token,
        userId: credResult.data.userId,
        hgId: basicResult.data?.hgId,
    };
}

// V1 Sign: MD5 of "timestamp=X&cred=Y"
export function generateSignV1(timestamp: string, cred: string): string {
    return crypto.createHash("md5").update(`timestamp=${timestamp}&cred=${cred}`).digest("hex");
}

// V2 Sign: HMAC-SHA256 + MD5 (for /card/detail, /wiki/, /binding, /enums, /v2/)
export function generateSignV2(
    path: string,
    timestamp: string,
    platform: string,
    vName: string,
    salt: string
): string {
    const headerJson = JSON.stringify({ platform, timestamp, dId: "", vName });
    const s = `${path}${timestamp}${headerJson}`;
    const hmac = crypto.createHmac("sha256", salt).update(s).digest("hex");
    return crypto.createHash("md5").update(hmac).digest("hex");
}

export function getSignVersion(path: string): "v1" | "v2" {
    const v2Patterns = ["/binding", "/card/detail", "/wiki/", "/enums", "/v2/"];
    return v2Patterns.some(pattern => path.includes(pattern)) ? "v2" : "v1";
}
