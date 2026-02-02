import {
    GlobalFonts,
    type CanvasRenderingContext2D,
} from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

export function registerFonts(): void {
    const fontDir = path.join(process.cwd(), "assets/fonts");
    if (fs.existsSync(path.join(fontDir, "Noto-Sans-TC-700.woff2"))) {
        GlobalFonts.registerFromPath(
            path.join(fontDir, "Noto-Sans-TC-700.woff2"),
            "EndfieldBold",
        );
    }
}

export function pathIndustrial(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, notch: number): void {
    ctx.beginPath();
    ctx.moveTo(x + notch, y);
    ctx.lineTo(x + w - notch, y);
    ctx.lineTo(x + w, y + notch);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + notch);
    ctx.closePath();
}

export function fillDynamicText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    baseFontSize: number,
    fontName: string,
    bold: boolean = true,
): void {
    let fontSize = baseFontSize;
    ctx.font = `${bold ? "bold " : ""}${fontSize}px ${fontName}`;
    let textWidth = ctx.measureText(text).width;

    while (textWidth > maxWidth && fontSize > 20) {
        fontSize -= 2;
        ctx.font = `${bold ? "bold " : ""}${fontSize}px ${fontName}`;
        textWidth = ctx.measureText(text).width;
    }

    ctx.fillText(text, x, y, maxWidth);
}
