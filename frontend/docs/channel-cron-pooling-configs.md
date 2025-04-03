# Channel Cron Polling Configurations

This document describes the feature allowing channel-specific configurations for polling Teams channels/chats for deployment trigger messages.

## Purpose

Instead of a single, globally configured cron job and trigger word (`MESSAGE_PATTERN`) defined via environment variables, this feature allows administrators to define multiple polling configurations, each targeting a specific channel or chat with its own schedule and trigger words.

This provides flexibility for:
*   Polling different channels at different frequencies.
*   Using different sets of trigger words for different teams or projects.
*   Disabling polling for specific channels temporarily without stopping the entire service.

## Configuration UI

The configuration is managed via the web UI on the main page of the Deployment Manager frontend.

### Adding a New Configuration

1.  **Select Channel:** Search for and select the desired Teams channel or chat using the autocomplete input.
2.  **Trigger Words (comma-separated):** Enter one or more keywords, separated by commas, that the bot should look for in new messages within this channel (e.g., `deploy, release, go live`). Matching is case-insensitive. If left empty, the system's default trigger word(s) (usually defined by the `MESSAGE_PATTERN` environment variable on the backend) will be used. Leading/trailing whitespace for each word is ignored.
3.  **Cron Schedule:** Define the polling frequency using the `node-cron` syntax (seconds are optional but supported). Example: `*/5 * * * *` (every 5 minutes), `0 * * * *` (every hour at minute 0).
4.  Click "Add Cron Config".

### Managing Existing Configurations

The list displays all configured channel-specific cron jobs.

*   **Channel:** The name of the configured Teams channel/chat.
*   **Schedule:** The `node-cron` schedule string. This can be edited directly in the input field. Changes are saved on blur.
*   **Trigger Words:** The custom, comma-separated trigger words for this channel. This can be edited directly. Leave empty to revert to the default. Changes are saved on blur.
*   **Enabled:** A toggle switch to activate or deactivate polling for this specific channel configuration.
*   **Last Updated:** Timestamp of the last modification.
*   **Actions:**
    *   **Test (Vial Icon):** Sends a request to the backend to fetch the latest message from the configured channel. The backend should use the configured trigger words (or default) for matching during the test. Useful for verifying connectivity and pattern matching. Results are shown via toast notification.
    *   **Delete (Trash Icon):** Removes the channel-specific configuration.

## Legacy Fallback

If **no** channel-specific configurations are defined *or* if all defined configurations are **disabled**, the system *may* fall back to the legacy behavior. This typically involves using environment variables like `CRON_SCHEDULE`, `CHAT_ID`, and `MESSAGE_PATTERN` defined on the backend to poll a single, globally specified channel using the globally defined trigger word(s).

The UI will indicate if the legacy fallback is potentially active when the list of channel-specific configurations is empty or all are disabled.

## Backend Interaction (Requires Update)

*   Configurations are stored in the application's database (`cronConfigs` collection/table). The `messagePattern` field now stores a comma-separated string or null.
*   The backend cron scheduler reads these configurations.
*   For each **enabled** configuration, a separate cron job is scheduled.
*   When a job runs, it fetches messages from the specified `channelId` since its last check.
*   **[Backend Update Needed]:** The backend needs to parse the `messagePattern` string (if not null/empty). It should split the string by commas, trim whitespace from each resulting word, and convert them to lowercase. If `messagePattern` is null or empty, it should use the default trigger word(s) from the environment configuration (also processed similarly).
*   **[Backend Update Needed]:** It filters messages by checking if the message content (converted to lowercase) contains **any** of the processed trigger words (either from the specific config or the default set).
*   Matching messages trigger the deployment request creation process.