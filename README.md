<p align="center">
  <img src="https://play-lh.googleusercontent.com/IHJeGhqSpth4VzATp_afjsCnFRc-uYgGC1EV3b2tryjyZsVrbcaeN5L_m8VKwvOSpIu_Skc49mDpLsAzC6Jl3mM" width="128" height="128" alt="Endfield Field Assistant">
</p>

<h1 align="center">Arknights: Endfield Auto</h1>

<p align="center">
  An advanced automation and monitoring suite for <b>Arknights: Endfield</b> via SKPort.
</p>

<p align="center">
  <a href="#key-features">Features</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#field-commands">Commands</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#obtaining-credentials">Credentials</a>
</p>

---

## Key Features

-   **Automated Attendance**: Executes daily sign-ins across all configured accounts.
-   **Stamina Monitoring**: Tracks current stamina and predicts exactly when it will reach maximum capacity using real-time regeneration logic.
-   **Daily Mission Reminders**: Automated checks to ensure you haven't missed your daily mission rewards before the server reset.
-   **Interactive Terminal**: Real-time insights into level, world level, BP progress, and daily mission activation.
-   **Discord & Telegram Integration**: Full Slash Command and Bot support for both Discord and Telegram.
-   **Multi-Account**: Manage multiple Arknights: Endfield accounts from a single instance.
-   **Headless Mode**: Can run entirely via console logging or automated notifications, perfect for lightweight server hosting.

---

## Deployment

### Prerequisites
-   [Bun](https://bun.sh/) (Recommended) or [Node.js](https://nodejs.org/) (v18+)
-   An Arknights: Endfield account

### Setup
1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/torikushiii/endfield-auto.git
    cd endfield-auto
    ```

### Option 1: Standard Deployment
1.  **Install Dependencies**:
    ```bash
    bun install
    # or
    npm install
    ```

2.  **Initialize Configuration**:
    Copy the example config and fill in your details:
    ```bash
    cp example.config.json config.json
    ```

3.  **Start the Assistant**:
    ```bash
    bun index.ts
    # or
    npm start
    ```

### Option 2: Docker Deployment (Recommended)
1.  **Initialize Configuration**:
    ```bash
    cp example.config.json config.json
    ```
    *Fill in your credentials in `config.json` before proceeding.*

2.  **Start with Docker Compose**:
    ```bash
    docker compose up -d
    ```

### Option 3: Google Script (Standalone)
For users who want automation without self-hosting.
1.  Navigate to `services/google-script/` in this repository.
2.  Follow the [Setup Guide](services/google-script/README.md) to deploy the standalone check-in service on Google's infrastructure.

---

## Field Commands

The assistant provides powerful Discord Slash Commands for manual monitoring and operations.

| Command | Alias | Description |
| :--- | :--- | :--- |
| `/terminal <account>` | `/stats`, `/stamina` | Displays full protocol status (Stamina, BP, Dailies, Progression). **(Required)** Choose a specific account or "All Accounts". |
| `/check-in` | `/ci` | Manually triggers the daily attendance claim for all accounts. |

---

## Configuration

The `config.json` is the central brain of the assistant.

```json
{
    "accounts": [
        {
            "name": "Operator-Alpha",
            "account_token": "YOUR_ACCOUNT_TOKEN",
            "sk_game_role": "3_YOUR_UID_SERVER",
            "settings": {
                "stamina_check": true,
                "stamina_threshold": -10,
                "daily_check": true
            }
        }
    ],
    "platforms": [
        {
            "id": "discord_bot",
            "type": "discord",
            "active": true,
            "token": "BOT_TOKEN",
            "botId": "APPLICATION_ID"
        },
        {
            "id": "telegram_bot",
            "type": "telegram",
            "active": true,
            "token": "TELEGRAM_BOT_TOKEN",
            "chatId": "YOUR_CHAT_ID"
        }
    ],
    "crons": [
        {
            "name": "check-in",
            "scheduleTime": "0 0 * * *"
        },
        {
            "name": "stamina-check",
            "scheduleTime": "*/30 * * * *"
        },
        {
            "name": "daily-check",
            "scheduleTime": "0 21 * * *"
        }
    ]
}
```

### Account Settings
-   **`account_token`**: Your account token from browser cookies. Required for all features.
-   **`sk_game_role`**: Your game role identifier in format `3_UID_SERVER`.
-   **`stamina_check`**: Enable/Disable stamina monitoring for this account.
-   **`stamina_threshold`**:
    -   Use a **positive** number for an absolute threshold (e.g., `200`).
    -   Use a **negative** number for a relative offset from max (e.g., `-10` will alert when you are 10 points away from capping).
-   **`daily_check`**: Enable/Disable daily mission reminders at the scheduled time.

---

## Obtaining Credentials

To connect the assistant to your account:

1.  Log in to the [SKPort Endfield Portal](https://game.skport.com/endfield/sign-in).
2.  Open **Developer Tools** (F12) → **Application** → **Cookies**.
3.  Find `ACCOUNT_TOKEN` and copy its value.
4.  URL decode if needed (replace `%2F` with `/`).
5.  Add to config as `account_token`.

> **Note**: The account token is used to authenticate with Gryphline and obtain session credentials. Credentials are automatically refreshed every 30 minutes.

---

## Disclaimer

This is an unofficial tool and is not affiliated with Hypergryph, Gryphline, or SKPort. Use of this tool may violate the terms of service. The authors are not responsible for any consequences of using this tool.
