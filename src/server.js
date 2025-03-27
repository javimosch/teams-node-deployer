require("dotenv").config();
const express = require("express");
const axios = require("axios");
const qs = require("querystring");

const app = express();
const PORT = 3000;
const {getData, setData, setDataPushIfNotExists, pruneDupes, persistAccessToken, persistRefreshToken} = require("./db");
const {processDeployments} = require("./gitlab");

// Microsoft OAuth Config
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:${PORT}/auth/callback`;
const TENANT_ID = process.env.TENANT_ID;
const AUTH_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`;
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

const cron = require('node-cron');
let isCronRunning = false;
let cronRunTimes=0

cron.schedule(process.env.CRON_JOB_SCHEDULE || '*/10 * * * * *', runCronHandler);
runCronHandler();

cron.schedule(process.env.CRON_JOB_SCHEDULE || '*/10 * * * * *', processDeployments);
processDeployments();

cron.schedule('*/20 * * * * *', async () => {
   await refreshTokenIfAboutToExpire(await getData('accessToken'), await getData('refreshToken'));
});





async function runCronHandler() {
    if (isCronRunning) return;
    isCronRunning = true;
    cronRunTimes++
    console.log(`Running CRON...(${cronRunTimes})`);
    try {
        let accessToken = await getData('accessToken');
        let chatId = `48:notes`
        let messages = await getLatestMessages(accessToken, chatId)
        messages = messages.map(message => ({
            id: message.id,                                                                         
            from: message.from.user.displayName,
            content: message.body.content,
            createdAt: message.createdDateTime
        }))
        let matched = messages.filter(message => message.content.includes('agent:deploy'))

        if (matched.length > 0) {
            console.log(`Deploy message found:`, {
                message: matched[0]
            })

            
            await setDataPushIfNotExists('deployments', matched[0], (item) => item.id === matched[0].id)

        }
    } catch (err) {
        console.error('ERROR: Error running CRON', {
            message: err.message,
            stack: err.stack
        })
    }finally{
        isCronRunning = false;
    }
}



//SETUP/TEST
(async () => {
    const accessToken = await getData('accessToken');
    if (accessToken) {

        //await pruneDupes('deployments')

        /*  await refreshTokenIfAboutToExpire(accessToken, await getData('refreshToken'));
         process.exit(0); */

        /* const subscriptions = await getExistingSubscriptions(accessToken);
        console.log('Existing Subscriptions:', subscriptions);
         */


        /*   let subscriptionId = await checkAndCreateSubscription(accessToken, '48:notes', process.env.WEBHOOK_URL)
  
          if(subscriptionId) {
              console.log('Final subscription ID:', subscriptionId)
          } */

        /*  let chatId = '48:notes'
         let messages = await getLatestMessages(accessToken, chatId)
         console.log(`Fetched messages`,{
             messages: messages.map(message => ({
                 from: message.from.user.displayName,
                 content: message.body.content,
                 createdAt: message.createdDateTime
             })),
         }) */
    }
})();

async function refreshTokenIfAboutToExpire(accessToken, refreshToken) {
    try {
        // Decode the access token to get the expiration time
        const decodedToken = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
        const expirationTime = decodedToken.exp * 1000;  // Convert to milliseconds
        const currentTime = Date.now();

        // If the token will expire in less than an 30min, refresh it
        if (expirationTime - currentTime < 30 * 60 * 1000) {
            console.log('Access token is about to expire, refreshing...');

            const response = await axios.post(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, {
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
                scope: 'offline_access https://graph.microsoft.com/.default',
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded', // Ensure the body is encoded as x-www-form-urlencoded
                }
            });

            const newAccessToken = response.data.access_token;
            const newRefreshToken = response.data.refresh_token; // May be returned

            console.log('New access token:', newAccessToken.slice(0, 10));
            await persistAccessToken(newAccessToken);
            await persistRefreshToken(newRefreshToken);

            return { newAccessToken, newRefreshToken };
        } else {
            console.log('Access token is still valid.');
            return { accessToken, refreshToken }; // No need to refresh
        }
    } catch (error) {
        console.error('Error refreshing token:', error.response ? error.response.data : error.message);
        return null;
    }
}

async function createMessageSubscription(accessToken, chatId, webhookUrl) {
    const subscription = {
        changeType: "created",  // Only interested in new messages
        notificationUrl: webhookUrl,  // The URL where Microsoft will send notifications
        resource: `/chats/${chatId}/messages`,  // Specify the chat messages resource
        expirationDateTime: "2025-03-27T23:59:59Z",  // The expiration time for the subscription
        clientState: "my-client-state",  // Optional state that can be used for verification
        lifecycleNotificationUrl: `${process.env.BASE_URL}/lifecycle-webhook`,
    };

    try {
        const response = await axios.post('https://graph.microsoft.com/v1.0/subscriptions', subscription, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        console.log('Subscription created successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error creating subscription:', error.response ? error.response.data : error.message);
        return null;
    }
}

// Main function to check and create/renew the subscription
async function checkAndCreateSubscription(accessToken, chatId, webhookUrl) {
    // Check for existing subscriptions
    const existingSubscriptions = await getExistingSubscriptions(accessToken);

    // Find if a subscription already exists for the given chatId
    const existingSubscription = existingSubscriptions.find(subscription => {
        return subscription.resource === `/chats/${chatId}/messages`;
    });

    if (existingSubscription) {
        console.log(`Subscription already exists for chat ${chatId}. Subscription ID: ${existingSubscription.id}`);

        // Optional: renew subscription if it's close to expiring
        const currentDate = new Date();
        const expirationDate = new Date(existingSubscription.expirationDateTime);
        const timeDiff = expirationDate - currentDate;

        // If the subscription is about to expire, renew it
        if (timeDiff < 24 * 60 * 60 * 1000) {  // Renew if less than 1 day left
            return await renewSubscription(accessToken, existingSubscription.id);
        }

        return existingSubscription.id;
    }

    // If no subscription exists, create a new one
    return await createMessageSubscription(accessToken, chatId, webhookUrl);
}

async function renewSubscription(accessToken, subscriptionId) {
    const subscriptionUpdate = {
        expirationDateTime: "2025-03-30T23:59:59Z",  // New expiration date
    };

    try {
        const response = await axios.patch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, subscriptionUpdate, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }
        });
        console.log('Subscription renewed:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error renewing subscription:', error.response ? error.response.data : error.message);
        return null;
    }
}


// Middleware to parse JSON body of incoming requests
app.use(express.json());

app.get('/webhook/test', (req, res) => {
    //call /webhook with some dummy data
    const dummyData = {
        clientState: 'my-client-state',
        value: [
            {
                id: '1',
                type: 'message',
                from: {
                    user: {
                        displayName: 'John Doe'
                    }
                },
                body: {
                    content: 'Hello World'
                },
                createdDateTime: new Date().toISOString()
            }
        ]
    };
    axios.post('http://localhost:3000/webhook', dummyData)
        .then(() => {
            res.send('Test completed');
        })
        .catch(error => {
            console.error('Error during test:', error);
            res.status(500).send('Error during test');
        });
});

// Webhook endpoint to handle Microsoft Graph notifications
app.post('/webhook', (req, res) => {

    console.log('Received notification (webhook):', {
        body: req.body,
        headers: req.headers,
        query: req.query
    });

    /*  // Verify the client state (optional, for security purposes)
     const clientState = req.body.clientState;
     if (clientState !== 'my-client-state') {
         return res.status(400).send('Invalid client state');
     } */

    // Handle the notifications
    console.log('Received notification (webhook):', {
        body: req.body,
        query: req.query
    });

    /*  // Process the data (you can get message information from req.body)
     // Example: req.body.value contains the changes (messages created)
     req.body.value.forEach(item => {
         console.log('New message:', item);
         // You can process new message here
     }); */

    // Send a 200 response to acknowledge receipt of the notification
    res.status(200).send();
});


app.post('/lifecycle-webhook', (req, res) => {

    console.log('Received lifecycle notification:', req.body);

    // Verify the client state (optional, for security purposes)
    const clientState = req.body.clientState;
    if (clientState !== 'my-client-state') {
        return res.status(400).send('Invalid client state');
    }

    // Handle the lifecycle notifications
    console.log('Received lifecycle notification:', req.body);

    // Example: Check if the subscription is about to expire or has expired
    if (req.body.value && req.body.value[0].expirationDateTime) {
        const expirationDate = new Date(req.body.value[0].expirationDateTime);
        console.log(`Subscription expires at: ${expirationDate}`);
    }

    // Acknowledge receipt of the lifecycle notification
    res.status(200).send();
});


async function getExistingSubscriptions(accessToken) {
    try {
        const response = await axios.get('https://graph.microsoft.com/v1.0/subscriptions', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }
        });

        return response.data.value; // List of subscriptions
    } catch (error) {
        console.error('Error fetching subscriptions:', error.response ? error.response.data : error.message);
        return [];
    }
}


async function getLastFiveMessagesFromMepChannelUsingStoredAccessToken() {
    const accessToken = await getData('accessToken');
    if (accessToken) {



        let chatId = await getChatIdByTopic(accessToken, 'MEP');
        console.log(`Chat ID: ${chatId}`);

        let messages = await getLatestMessages(accessToken, chatId);
        console.log(`Fetched messages`, {
            messages: messages.map(message => ({
                from: message.from.user.displayName,
                content: message.body.content,
                createdAt: message.createdDateTime
            })),
        })
    }
}


async function getLatestMessages(accessToken, chatId) {
    try {
        const response = await axios.get(
            `https://graph.microsoft.com/v1.0/chats/${chatId}/messages?$top=5`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );
        return response.data.value;
    } catch (error) {
        console.error('Error fetching messages:', error.response ? error.response.data : error.message);
    }
}


async function getChatIdByTopic(accessToken, topicStartWith) {
    try {
        // Fetch all chats the user is a part of
        const response = await axios.get('https://graph.microsoft.com/v1.0/me/chats', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }
        });

        // Filter chats by topic starting with the given string
        const chat = response.data.value.find(chat => chat.topic && chat.topic.startsWith(topicStartWith));

        if (chat) {
            return chat.id; // Return the chat ID
        } else {
            console.log(`No chat found with topic starting with '${topicStartWith}'`);
            return null;
        }
    } catch (error) {
        console.error('Error fetching chats:', error.response ? error.response.data : error.message);
        return null;
    }
}

async function getPersonalChatId(accessToken) {
    try {
        let allChats = [];
        let nextLink = 'https://graph.microsoft.com/v1.0/me/chats';  // Initial request URL

        // Loop through pages
        while (nextLink) {
            console.log(`Fetching chats from ${nextLink}`);
            const response = await axios.get(nextLink, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                }
            });

            // Collect chats
            allChats = allChats.concat(response.data.value);

            // Check if there's a next page
            nextLink = response.data['@odata.nextLink'] || null;
        }

        // Filter the personal chats (1:1) and match year to 2025
        const targetYear = 2025;
        const personalChats = allChats
            .filter(chat => {
                if (chat.chatType === "oneOnOne") {
                    const updatedDate = new Date(chat.lastUpdatedDateTime);
                    // Match the year, ignoring month and day
                    return updatedDate.getFullYear() === targetYear;
                }
                return false;
            })
            .map(chat => ({
                id: chat.id,
                topic: chat.topic,
                updatedAt: chat.lastUpdatedDateTime
            }))
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        console.log('Personal chats from March 27, 2025:', personalChats);

        process.exit(0)

        // Return the latest 1:1 chat ID if found
        if (personalChats.length > 0) {
            const chatId = personalChats[0].id;
            console.log(`Personal chat ID: ${chatId}`);

            // Fetch the latest messages from the personal chat
            await getMessagesFromChat(chatId, accessToken);

            return chatId;
        } else {
            console.log('No personal chat found on March 27, 2025');
            return null;
        }

    } catch (error) {
        console.error('Error fetching chats:', error.response ? error.response.data : error.message);
        return null;
    }
}
// Step 1: Redirect User to Microsoft Login
app.get("/login", (req, res) => {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        response_mode: "query",
        scope: "offline_access https://graph.microsoft.com/Chat.Read",
    });

    res.redirect(`${AUTH_URL}?${params}`);
});

app.get("/logout", async (req, res) => {
    const accessToken = await getData('accessToken');
    if (accessToken) {
        try {
            // Revoke the access token
            await axios.post('https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/logout', {}, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
        } catch (error) {
            console.error('Error revoking access token:', error.response ? error.response.data : error.message);
        }
    }

    await setData('accessToken', null);
    await setData('refreshToken', null);

    res.redirect('/login');
});

// Step 2: Handle OAuth Callback
app.get("/auth/callback", async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send("Authorization failed");
    }

    try {
        // Exchange code for access token
        const response = await axios.post(
            TOKEN_URL,
            qs.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: REDIRECT_URI,
                scope: "https://graph.microsoft.com/Chat.Read",
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const { access_token } = response.data;
        const { refresh_token } = response.data;

        persistAccessToken(access_token);
        persistRefreshToken(refresh_token);

        console.log(`auth callback raw response:`, {
            data: response.data
        });

        res.send(`Access Token: ${access_token}`);
    } catch (error) {
        console.error("OAuth error:", error.response.data);
        res.status(500).send("Authentication failed");
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
