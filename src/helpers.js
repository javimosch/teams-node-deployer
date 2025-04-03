const axios = require("axios");
const { onInvalidToken } = require("./auth");
const { getData } = require("./db");

module.exports = {
    getLatestMessages,
    getChatIdByTopic,
    getAllChats,
    getLatestMessage
}

async function getLastFiveMessagesFromMepChannelUsingStoredAccessToken() {
    const accessToken = await getData('accessToken');
    if (accessToken) {
        let chatId = await getChatIdByTopic(accessToken, 'MEP');
        console.log(`Chat ID: ${chatId}`);

        let messages = await getLatestMessages(accessToken, chatId);
        console.log(`Fetched messages`, {
            messages: messages||[].map(message => ({
                from: message.from.user.displayName,
                content: message.body.content,
                createdAt: message.createdDateTime
            })),
        })
    }
}

async function getChatIdByTopic(accessToken, topicStartWith) {
    try {
        const response = await axios.get('https://graph.microsoft.com/v1.0/me/chats', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }
        });

        const chat = response.data.value.find(chat => chat.topic && chat.topic.startsWith(topicStartWith));

        if (chat) {
            return chat.id;
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
        return response?.data?.value||[];
    } catch (error) {
        console.error('Error fetching messages:', error.response ? error.response.data : error.message);

        if (error.code === 'InvalidAuthenticationToken') {
            onInvalidToken()
            return
        }
    }
}

async function getLatestMessage(accessToken, chatId) {
    const functionName = 'getLatestMessage';
    try {
        console.log(`${functionName}: Fetching latest message for chat ID: ${chatId}`);
        const response = await axios.get(
            `https://graph.microsoft.com/v1.0/chats/${chatId}/messages?$top=1`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );
        const messages = response?.data?.value || [];
        if (messages.length > 0) {
            console.log(`${functionName}: Found latest message:`, { id: messages[0].id });
            const msg = messages[0];
            return {
                id: msg.id,
                from: msg.from?.user?.displayName || 'Unknown Sender',
                content: msg.body?.content || "",
                createdAt: msg.createdDateTime,
            };
        } else {
            console.log(`${functionName}: No messages found in chat ID: ${chatId}`);
            return null;
        }
    } catch (error) {
        console.error(`${functionName}: Error fetching latest message for chat ID ${chatId}:`, error.response ? error.response.data : error.message);
        if (error.response?.status === 401 || error.response?.data?.error?.code === 'InvalidAuthenticationToken') {
            await onInvalidToken();
            throw new Error('Authentication token invalid or expired. Please re-authenticate.');
        } else if (error.response?.status === 404) {
             throw new Error(`Chat not found or access denied for ID: ${chatId}`);
        }
        throw error;
    }
}

async function getPersonalChatId(accessToken) {
    try {
        let allChats = [];
        let nextLink = 'https://graph.microsoft.com/v1.0/me/chats';

        while (nextLink) {
            console.log(`Fetching chats from ${nextLink}`);
            const response = await axios.get(nextLink, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                }
            });

            allChats = allChats.concat(response.data.value);

            nextLink = response.data['@odata.nextLink'] || null;
        }

        const targetYear = 2025;
        const personalChats = allChats
            .filter(chat => {
                if (chat.chatType === "oneOnOne") {
                    const updatedDate = new Date(chat.lastUpdatedDateTime);
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

        if (personalChats.length > 0) {
            const chatId = personalChats[0].id;
            console.log(`Personal chat ID: ${chatId}`);

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

async function getAllChats(accessToken) {
    const functionName = 'getAllChats';
    try {
        let allChats = [];
        let nextLink = 'https://graph.microsoft.com/v1.0/me/chats?$select=id,topic,chatType,createdDateTime,lastUpdatedDateTime';

        console.log(`${functionName}: Fetching chats...`);

        while (nextLink) {
            const response = await axios.get(nextLink, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                }
            });

            allChats = allChats.concat(response.data.value);

            nextLink = response.data['@odata.nextLink'] || null;
            if (nextLink) {
                console.log(`${functionName}: Fetching next page: ${nextLink.substring(0, 100)}...`);
            }
        }

        console.log(`${functionName}: Fetched total chats:`, allChats.length);

        allChats.sort((a, b) => {
            const topicA = a.topic || '';
            const topicB = b.topic || '';
            if (topicA.toLowerCase() < topicB.toLowerCase()) return -1;
            if (topicA.toLowerCase() > topicB.toLowerCase()) return 1;
            return new Date(b.lastUpdatedDateTime) - new Date(a.lastUpdatedDateTime);
        });

        return allChats.map(chat => ({
            id: chat.id,
            topic: chat.topic || `Chat (${chat.chatType})`,
            type: chat.chatType,
            lastUpdated: chat.lastUpdatedDateTime
        }));
    } catch (error) {
        console.error(`${functionName}: Error fetching chats:`, error.response ? error.response.data : error.message);
        if (error.response?.status === 401 || error.response?.data?.error?.code === 'InvalidAuthenticationToken') {
            await onInvalidToken();
            throw new Error('Authentication token invalid or expired. Please re-authenticate.');
        }
        throw error;
    }
}