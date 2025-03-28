const cron = require('node-cron');
const {getData, setDataPushIfNotExists} = require("./db");
const {processDeployments} = require("./gitlab");
const {refreshTokenIfAboutToExpire} = require('./auth')
const {getLatestMessages} = require('./helpers')

module.exports = {
    configureCronJobs
}

async function configureCronJobs() {

    
    let isCronRunning = false;
    let cronRunTimes = 0

    cron.schedule(process.env.FETCH_CRON_JOB_SCHEDULE || process.env.CRON_JOB_SCHEDULE || '*/10 * * * * *', runCronHandler);
    runCronHandler();

    cron.schedule(process.env.PROCESS_CRON_JOB_SCHEDULE || process.env.CRON_JOB_SCHEDULE || '*/10 * * * * *', processDeployments);
    processDeployments();

    cron.schedule('*/20 * * * * *', async () => {
        await refreshTokenIfAboutToExpire(await getData('accessToken'), await getData('refreshToken'));
    });


    async function onInvalidToken() {
        console.log("WARN: Invalid token, user should re-authenticate")
        let accessToken = await getData('accessToken');
        let refreshToken = await getData('refreshToken');
        if (accessToken && refreshToken) {
            await refreshTokenIfAboutToExpire(accessToken, refreshToken);
        }
    }


    async function runCronHandler() {
        if (isCronRunning) return;
        isCronRunning = true;
        cronRunTimes++
        console.log(`Running POOLING/FETCH CRON...(${cronRunTimes})`);
        try {

            if(!process.env.MESSAGE_PATTERN){
                throw new Error('MESSAGE_PATTERN is required')
            }

            let accessToken = await getData('accessToken');
            let chatId = process.env.CHAT_ID
            let messages = await getLatestMessages(accessToken, chatId)
            messages = messages.map(message => ({
                id: message.id,
                from: message.from.user.displayName,
                content: message.body.content,
                createdAt: message.createdDateTime
            }))

            let matched = messages.filter(message => message.content.includes(process.env.MESSAGE_PATTERN))

            if (matched.length > 0) {
                console.log(`Deploy message found:`, {
                    message: matched[0]
                })


                await setDataPushIfNotExists('deployments', matched[0], (item) => item.id === matched[0].id)

            }else{
                console.log('INFO: No messages found')
            }
        } catch (err) {

            if (err.code === 'InvalidAuthenticationToken') {
                onInvalidToken()
                return
            }

            console.error('ERROR: Error running CRON', {
                message: err.message,
                stack: err.stack
            })
        } finally {
            isCronRunning = false;
        }
    }

}