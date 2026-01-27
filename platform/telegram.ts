import { Platform } from "./template";

interface DiscordEmbed {
    title?: string;
    description?: string;
    thumbnail?: { url: string };
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: { text?: string; icon_url?: string };
}

interface TelegramMessage {
    text?: string;
    chat: { id: number | string };
}

interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
}

export class TelegramPlatform extends Platform {
    name = "Telegram";
    description = "Telegram Bot notifications";

    #token: string | undefined;
    #chatId: string | undefined;

    constructor(token?: string, chatId?: string) {
        super();
        this.#token = token;
        this.#chatId = chatId;
    }

    override isConfigured(): boolean {
        return !!this.#token && !!this.#chatId;
    }

    async send(content: string | DiscordEmbed, options?: { chatId?: string }): Promise<void> {
        const destChatId = options?.chatId || this.#chatId;
        if (!this.#token || !destChatId) {
            return;
        }

        ak.Logger.info("Sending Telegram notification...");

        let text = "";
        const parseMode = "HTML";

        if (typeof content === "string") {
            text = content;
        } else {
            const lines: string[] = [];

            const thumbnail = content.thumbnail?.url || content.footer?.icon_url;
            if (thumbnail) {
                lines.push(`<a href="${thumbnail}">&#8205;</a>`);
            }

            if (content.title) {
                lines.push(`<b>${this.#escapeHtml(content.title)}</b>`);
            }

            if (content.description) {
                lines.push(this.#escapeHtml(content.description));
            }

            if (content.fields && Array.isArray(content.fields)) {
                lines.push("");
                for (const field of content.fields) {
                    lines.push(`<b>${this.#escapeHtml(field.name)}</b>: ${this.#escapeHtml(field.value)}`);
                }
            }

            if (content.footer?.text) {
                lines.push("");
                lines.push(`<i>${this.#escapeHtml(content.footer.text)}</i>`);
            }

            text = lines.join("\n");
        }

        try {
            const url = `https://api.telegram.org/bot${this.#token}/sendMessage`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: destChatId,
                    text: text,
                    parse_mode: parseMode,
                    disable_web_page_preview: false,
                }),
            });

            const data = await response.json() as { ok: boolean; description?: string };
            if (data.ok) {
                ak.Logger.info("Telegram notification sent");
            } else {
                ak.Logger.warn(`Telegram API error: ${data.description}`);
            }
        } catch (error) {
            ak.Logger.error(`Failed to send Telegram notification: ${error}`);
        }
    }

    override async startBot(): Promise<void> {
        if (!this.#token) return;

        ak.Logger.info("Telegram bot started (polling mode)");
        let lastUpdateId = 0;

        const poll = async () => {
            try {
                ak.Logger.debug("Telegram: Polling for updates...");
                const response = await fetch(`https://api.telegram.org/bot${this.#token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
                const data = await response.json() as { ok: boolean; result: TelegramUpdate[]; description?: string };

                if (data.ok) {
                    if (data.result.length > 0) {
                        ak.Logger.debug(`Telegram: Received ${data.result.length} update(s)`);
                        for (const update of data.result) {
                            lastUpdateId = update.update_id;
                            if (update.message?.text?.startsWith("/")) {
                                await this.#handleCommand(update.message);
                            }
                        }
                    }
                } else {
                    ak.Logger.warn(`Telegram: Poll failed - ${data.description}`);
                }
            } catch (error) {
                ak.Logger.error(`Telegram: Poll request failed - ${error}`);
            }
            setTimeout(poll, 1000);
        };

        poll();
    }

    async #handleCommand(message: TelegramMessage): Promise<void> {
        const text = message.text || "";
        const chatId = message.chat.id.toString();
        const parts = text.split(" ");
        const rawCmd = parts[0] || "";
        const commandName = (rawCmd.substring(1).split("@")[0] || "").toLowerCase(); // /start@bot -> start
        const args = parts.slice(1);

        ak.Logger.info(`Telegram command received: ${commandName} from ${chatId}`);

        await ak.Commands.checkAndRun(commandName, {
            platform: this,
            defer: () => {
                // Telegram doesn't strictly need a "defer"
            },
            ephemeral: async (content: string | DiscordEmbed) => {
                await this.send(content, { chatId });
            },
        }, ...args);
    }

    #escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

export default TelegramPlatform;
