const cron = require('node-cron');
const { getData, setDataPushIfNotExists } = require("./db");
const { processDeployments } = require("./gitlab");
const { refreshTokenIfAboutToExpire, onInvalidToken, getAccessToken } = require('./auth');
const { getLatestMessages } = require('./helpers');

const CRON_CONFIG_KEY = 'cronConfigs';
const activeCronTasks = new Map();

function stopAllCronJobs() {
    console.log('Stopping all active cron jobs...');
    activeCronTasks.forEach((task, id) => {
        try {
            task.stop();
            console.log(`Stopped cron job: ${id}`);
        } catch (e) {
            console.error(`Error stopping cron job ${id}:`, e);
        }
    });
    activeCronTasks.clear();
    console.log('All cron jobs stopped.');
}

async function startCronJobs() {
    console.log('Starting cron jobs...');
    const configs = await getData(CRON_CONFIG_KEY, []);
    const enabledConfigs = configs.filter(c => c.enabled);
    let legacyFallbackEnabled = true;

    enabledConfigs.forEach(config => {
        if (!cron.validate(config.schedule)) {
            console.error(`Invalid cron schedule "${config.schedule}" for config ID ${config.id}. Skipping.`);
            return;
        }
        console.log(`Scheduling message fetch for channel "${config.channelName}" (ID: ${config.channelId}) with schedule: ${config.schedule}`);
        const task = cron.schedule(config.schedule, () => runCronHandler(config.channelId, config.id, config.channelName, config.messagePattern));
        activeCronTasks.set(`fetch-${config.id}`, task);
        //legacyFallbackEnabled = false; //Always enabled for now
    });

    const legacyChatId = process.env.CHAT_ID;
    const legacySchedule = process.env.FETCH_CRON_JOB_SCHEDULE || process.env.CRON_JOB_SCHEDULE || '*/10 * * * * *';
    if (legacyChatId && legacyFallbackEnabled) {
        if (!cron.validate(legacySchedule)) {
            console.error(`Invalid legacy cron schedule "${legacySchedule}". Skipping legacy fallback.`);
        } else {
            console.log(`Scheduling legacy message fetch for CHAT_ID ${legacyChatId} with schedule: ${legacySchedule}`);
            const task = cron.schedule(legacySchedule, () => runCronHandler(legacyChatId, 'legacy', 'Legacy Fallback'));
            activeCronTasks.set('fetch-legacy', task);
        }
    } else if (legacyChatId && !legacyFallbackEnabled) {
        console.log('Dynamic cron configs are enabled, skipping legacy CHAT_ID fallback.');
    }

    const processSchedule = process.env.PROCESS_CRON_JOB_SCHEDULE || process.env.CRON_JOB_SCHEDULE || '*/15 * * * * *';
    if (cron.validate(processSchedule)) {
        console.log(`Scheduling deployment processing with schedule: ${processSchedule}`);
        const processTask = cron.schedule(processSchedule, processDeployments);
        activeCronTasks.set('process-deployments', processTask);
    } else {
        console.error(`Invalid deployment processing schedule "${processSchedule}". Skipping.`);
    }

    const refreshSchedule = '*/5 * * * *';
    if (cron.validate(refreshSchedule)) {
        console.log(`Scheduling token refresh with schedule: ${refreshSchedule}`);
        const refreshTask = cron.schedule(refreshSchedule, async () => {
            console.log('Running scheduled token refresh check...');
            await getAccessToken();
        });
        activeCronTasks.set('token-refresh', refreshTask);
    } else {
        console.error(`Invalid token refresh schedule "${refreshSchedule}". Skipping.`);
    }

    console.log(`Total active cron tasks: ${activeCronTasks.size}`);
}

async function restartCronJobs() {
    console.log('Restarting cron jobs...');
    stopAllCronJobs();
    await startCronJobs();
    console.log('Cron jobs restarted.');
}

async function configureCronJobs() {
    await startCronJobs();
}

let isHandlerRunning = new Map();

async function runCronHandler(channelId, configId, channelName = 'Unknown', messagePattern = process.env.MESSAGE_PATTERN) {
    const jobId = `fetch-${configId}`;
    if (isHandlerRunning.get(jobId)) {
        console.log(`Fetch handler for ${channelName} (${jobId}) is already running. Skipping.`);
        return;
    }
    isHandlerRunning.set(jobId, true);
    console.log(`Running message fetch for ${channelName} (Channel: ${channelId}, Job ID: ${jobId})...`);

    try {
        if (!messagePattern) {
            console.error(`MESSAGE_PATTERN is required for job ${jobId}. Skipping.`);
            return;
        }

        const accessToken = await getAccessToken();
        if (!accessToken) {
            console.warn(`No valid access token for job ${jobId}. Skipping fetch.`);
            return;
        }

        let messages = await getLatestMessages(accessToken, channelId);

        messages = messages || [];
        messages = messages.map(message => ({
            id: message.id,
            from: message.from?.user?.displayName || 'Unknown Sender',
            content: message?.body?.content || "",
            createdAt: message.createdDateTime,
            channelId: channelId
        }));

        console.log(`Fetched messages for ${channelName} (Job ID: ${jobId}):`, {
            count: messages.length,
            messages: messages.map(message => ({
                id: message.id,
                from: message.from,
                content: message.content.substring(0, 30) + '...',
                createdAt: message.createdAt
            })),
            messagePattern
        });

        const matched = messages.filter(message => message.content.includes(messagePattern));

        if (matched.length > 0) {
            console.log(`Deployment message found in ${channelName} (Job ID: ${jobId}):`, {
                count: matched.length,
                firstMessageId: matched[0].id
            });

            for (const message of matched) {
                await setDataPushIfNotExists('deployments', {
                    ...message,
                    status: 'pending',
                    approved: null,
                    processingLogs: [],
                    processingBranchErrors: [],
                    nextTag: null,
                    deployed: false,
                }, (item) => item.id === message.id);
            }
        } else {
            console.log(`No new deployment messages found in ${channelName} (Job ID: ${jobId}).`);
        }
    } catch (err) {
        console.error(`ERROR running fetch CRON for ${channelName} (Job ID: ${jobId}):`, {
            message: err.message
        });
    } finally {
        isHandlerRunning.set(jobId, false);
    }
}

module.exports = {
    configureCronJobs,
    restartCronJobs,
    runCronHandler
};