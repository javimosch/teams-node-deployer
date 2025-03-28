
const axios = require("axios");

module.exports = {
    getLatestMessages
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