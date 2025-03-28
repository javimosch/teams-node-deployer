const axios = require("axios");

module.exports = function configure(app){
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
    
    

    
}


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
