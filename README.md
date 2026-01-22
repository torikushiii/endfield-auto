<p align="center">
  <img src="https://play-lh.googleusercontent.com/IHJeGhqSpth4VzATp_afjsCnFRc-uYgGC1EV3b2tryjyZsVrbcaeN5L_m8VKwvOSpIu_Skc49mDpLsAzC6Jl3mM" width="128" height="128" alt="SKPort Auto">
</p>

<h1 align="center">SKPort Auto</h1>

<p align="center">
  Automated daily sign-in tool for Arknights: Endfield via SKPort
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#usage">Usage</a> •
  <a href="#discord-notifications">Discord Notifications</a>
</p>

---

> [!WARNING]
> Use of this tool may violate the terms of service. The authors are not responsible for any consequences of using this tool.

## Features

- Automated daily attendance check-in for Arknights: Endfield
- Multi-account support
- Discord webhook notifications with embedded reward information
- Configurable via JSON file

## Installation

### Prerequisites

- Python 3.8 or higher
- `requests` library

### Setup

1. Clone or download this repository

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Create a `config.json` file (see Configuration section)

## Configuration

Create a `config.json` file in the same directory as `main.py`:

```json
{
    "accounts": [
        {
            "name": "Account1",
            "cred": "YOUR_CRED_TOKEN",
            "sk_game_role": "YOUR_GAME_ROLE"
        }
    ],
    "discord_webhook": "YOUR_DISCORD_WEBHOOK_URL",
    "schedule_time": "00:00"
}
```

### Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `accounts` | Yes | Array of account objects |
| `accounts[].name` | Yes | Display name for the account |
| `accounts[].cred` | Yes | Authentication credential token |
| `accounts[].sk_game_role` | Yes | Game role identifier (format: `platform_uid_region`) |
| `discord_webhook` | No | Discord webhook URL for notifications |
| `schedule_time` | No | Time to run daily sign-in (24h format "HH:MM", default: "00:00") |

### Obtaining Credentials

1. Open the [SKPort Endfield Sign-in page](https://game.skport.com/endfield/sign-in) in your browser
2. Log in to your account
3. Open browser Developer Tools (F12)
4. Go to the Network tab
5. Perform a sign-in action or refresh the page
6. Find any request to `zonai.skport.com`
7. In the request headers, copy:
   - `cred` header value
   - `sk-game-role` header value

## Usage

### One-time Sign-in

Run the script manually:

```bash
python main.py
```

This will sign in immediately and exit.

### Automated Daily Sign-in

Run the scheduler to automatically sign in at midnight:

```bash
python scheduler.py
```

The scheduler will:
1. Run sign-in immediately on startup
2. Schedule daily runs at the time specified in `config.json` (default: midnight)
3. Continue running in the foreground

### Example Output

```
==================================================
Arknights: Endfield Daily Sign-in
==================================================

Found 1 account(s) in config
Discord notifications enabled

==================================================
Account: Account1
==================================================
  UID: 1234567890
  Logged in as: Username (ID: 9876543210)
  Checking attendance status...
  Claiming attendance reward...
  Successfully claimed attendance!
  Rewards received:
     - Oroberyl x120
     - Intermediate Combat Record x2

Summary
==================================================
  Claimed - Account1

  Total: 1/1 accounts processed successfully

Sending Discord notification...
  Discord notification sent!
```

## Discord Notifications

When configured, the script sends rich embed notifications to Discord:

- **Yellow embed**: Successfully claimed rewards (shows reward list with icons)
- **Blue embed**: Already claimed today
- **Red embed**: Error occurred

To set up Discord notifications:

1. Create a webhook in your Discord server (Server Settings > Integrations > Webhooks)
2. Copy the webhook URL
3. Add it to your `config.json` as `discord_webhook`

To disable notifications, remove the `discord_webhook` field or set it to an empty string.

## Automation

This project includes a Python-based scheduler that runs independently of the system cron.

### Running the Scheduler

1. Install the schedule library:
   ```bash
   pip install schedule
   ```

2. Run the scheduler:
   ```bash
   python scheduler.py
   ```

The scheduler will:
- Run the sign-in script immediately on startup
- Schedule daily runs at the time specified in `config.json` (default: 00:00)
- Continue running in the foreground

### Customizing Schedule Time

Edit `config.json` and modify the `schedule_time` field:

```json
"schedule_time": "00:10"
```

The time should be in 24-hour format ("HH:MM"). The scheduler uses your system's local time.

### Running in Background

Using nohup:
```bash
nohup python scheduler.py > scheduler.log 2>&1 &
```

Using screen:
```bash
screen -S skport-auto
python scheduler.py
# Press Ctrl+A, then D to detach
```

Using Docker (if containerized):
```bash
docker run -d skport-auto python scheduler.py
```
## Disclaimer

This is an unofficial tool and is not affiliated with Hypergryph, Gryphline, or SKPort. Use of this tool may violate the terms of service. The authors are not responsible for any consequences of using this tool.
