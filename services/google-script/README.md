# Arknights: Endfield Google Script Check-in

A standalone Google Apps Script (GAS) service for **Arknights: Endfield** daily check-ins. This script allows you to automate your check-ins without hosting a server.

## Features

- **Standalone**: No server required, runs entirely on Google's infrastructure.
- **Full OAuth Support**: Automatically refreshes session credentials using your Gryphline `account_token`.
- **V2 Signing**: Implements the enhanced HMAC-SHA256 signing required for the latest SKPort attendance protocol.
- **Multi-account Support**: Manage multiple accounts simultaneously from a single script.
- **Discord Notifications**: Optional webhook integration for daily status reports and reward summaries.

## Setup Instructions

1.  **Open Google Apps Script**:
    - Go to [script.google.com](https://script.google.com/).
    - Click **New Project**.
2.  **Paste the Script**:
    - Open `services/google-script/index.js` in this repository.
    - Copy the entire content.
    - Delete any default code in the Google Script editor and paste the content.
3.  **Obtain Credentials**:
    - Log in to the [SKPort Endfield Portal](https://game.skport.com/endfield/sign-in).
    - Open **Developer Tools** (F12) → **Application** → **Cookies**.
    - Find `ACCOUNT_TOKEN` and copy its value.
    - URL decode if needed (replace `%2F` with `/`).
4.  **Configure Accounts**:
    - In the script editor, locate the `ACCOUNTS` array at the top.
    - Fill in your `name`, `account_token`, and `sk_game_role`.
    - To find your `sk_game_role`: Inspect the portal network requests (F12 -> Network) and look for `sk-game-role` in the request headers of any game-related API call (e.g., `attendance`). It usually looks like `3_123456789`.
5.  **(Optional) Discord Webhook**:
    - If you want notifications, paste your Discord Webhook URL into `DISCORD_WEBHOOK_URL`.
6.  **Save & Test**:
    - Click the **Save** icon (rename the project to `Endfield Check-in`).
    - Select the `main` function in the toolbar and click **Run**.
    - Grant necessary permissions (Google will ask for permission to use `External Services`).
    - Check the **Execution Log** to verify successful sign-in.
7.  **Automate**:
    - Click the **Triggers** icon (clock icon on the left sidebar).
    - Click **+ Add Trigger**.
    - Choose `main` as the function to run.
    - Select **Time-driven** event source.
    - Select **Day timer** and choose a preferred time (e.g., 1am to 2am).
    - Click **Save**.

## Integration with this Project

The Google Script is a **standalone alternative** and does not connect to the main Node.js/Bun project. It is intended for users who want 24/7 automation without self-hosting.

For full features like Stamina monitoring and Interactive Terminal, please refer to the [Main Documentation](../../README.md).
