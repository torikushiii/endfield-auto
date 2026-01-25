import { Client, GatewayIntentBits, REST, Routes, Events, MessageFlags, type InteractionReplyOptions } from "discord.js";
import { Platform } from "./template";

const ENDFIELD_ICON = "https://play-lh.googleusercontent.com/IHJeGhqSpth4VzATp_afjsCnFRc-uYgGC1EV3b2tryjyZsVrbcaeN5L_m8VKwvOSpIu_Skc49mDpLsAzC6Jl3mM";

interface DiscordPayload {
    username: string;
    avatar_url: string;
    content?: string;
    embeds?: Record<string, unknown>[];
}

export class DiscordPlatform extends Platform {
    name = "Discord";
    description = "Discord bot and webhook notifications";

    #webhookUrl: string | undefined;
    #token: string | undefined;
    #botId: string | undefined;
    #client: Client | null = null;

    constructor(webhookUrl?: string, token?: string, botId?: string) {
        super();
        this.#webhookUrl = webhookUrl;
        this.#token = token;
        this.#botId = botId;
    }

    override isConfigured(): boolean {
        return this.#isValidWebhook(this.#webhookUrl);
    }

    isBotConfigured(): boolean {
        return !!this.#token && !!this.#botId;
    }

    get client(): Client | null {
        return this.#client;
    }

    async startBot(): Promise<void> {
        if (!this.#token || !this.#botId) {
            ak.Logger.warn("Discord bot token or ID not configured");
            return;
        }

        await this.#registerCommands();

        this.#client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
            ],
        });

        this.#client.once(Events.ClientReady, (client) => {
            ak.Logger.info(`Discord bot logged in as ${client.user.tag}`);
        });

        this.#client.on("interactionCreate", async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            const commandName = interaction.commandName;
            const args = interaction.options.data.map(opt => opt.value?.toString() || "").filter(Boolean);

            await ak.Commands.checkAndRun(commandName, {
                platform: this,
                defer: async () => {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                    }
                },
                ephemeral: async (content: string | Record<string, unknown>) => {
                    let payload: Record<string, unknown> = typeof content === "string" ? { content } : content;
                    if (typeof content === "string" && content.startsWith("{") && content.endsWith("}")) {
                        try {
                            payload = JSON.parse(content);
                        } catch {
                            // ignore and keep as string
                        }
                    }

                    const options = { ...payload, flags: [MessageFlags.Ephemeral] } as InteractionReplyOptions;
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(options);
                    } else {
                        await interaction.reply(options);
                    }
                },
            }, ...args);
        });

        await this.#client.login(this.#token);
    }

    async #registerCommands(): Promise<void> {
        if (!this.#token || !this.#botId) return;

        const rest = new REST({ version: "10" }).setToken(this.#token);
        const commands = ak.Commands.all.map(cmd => {
            const options = typeof cmd.options === "function" ? cmd.options() : cmd.options;
            return {
                name: cmd.name,
                description: cmd.description,
                options: options,
            };
        });

        try {
            ak.Logger.info("Registering Discord slash commands...");

            await rest.put(
                Routes.applicationCommands(this.#botId),
                { body: [] },
            );

            await rest.put(
                Routes.applicationCommands(this.#botId),
                { body: commands },
            );
            ak.Logger.info(`Successfully registered ${commands.length} commands`);
        } catch (error) {
            ak.Logger.error("Failed to register Discord commands:", { error });
        }
    }

    async stopBot(): Promise<void> {
        if (this.#client) {
            await this.#client.destroy();
            this.#client = null;
            ak.Logger.info("Discord bot stopped");
        }
    }

    #isValidWebhook(url: string | undefined): url is string {
        if (!url) return false;
        if (typeof url !== "string") return false;
        if (!url.trim()) return false;
        if (!url.startsWith("http")) return false;
        return true;
    }

    async send(content: string | Record<string, unknown>): Promise<void> {
        if (!this.#isValidWebhook(this.#webhookUrl)) {
            return;
        }

        ak.Logger.info("Sending Discord notification...");

        let payload: DiscordPayload;
        if (typeof content === "string") {
            payload = {
                username: "Endfield Auto",
                avatar_url: ENDFIELD_ICON,
                content: content,
            };
        } else {
            payload = {
                username: "Endfield Auto",
                avatar_url: ENDFIELD_ICON,
                ...(content.embeds ? content : { embeds: Array.isArray(content) ? content : [content] }),
            };
        }

        try {
            const response = await fetch(this.#webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (response.status === 204) {
                ak.Logger.info("Discord notification sent");
            } else {
                ak.Logger.warn(`Discord webhook returned: ${response.status}`);
            }
        } catch (error) {
            ak.Logger.error(`Failed to send Discord notification: ${error}`);
        }
    }
}

export default DiscordPlatform;
