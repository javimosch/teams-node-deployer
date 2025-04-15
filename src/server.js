require("dotenv").config();
require('./logging')

const express = require("express");
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = process.env.PORT || 3000;
const { configureAuthRoutes, getAccessToken } = require('./auth');
const { configureCronJobs, restartCronJobs, runCronHandler } = require('./cron');
const { processDeployments } = require("./gitlab");
const { ensureDbFile, getData, setData, getAllData, setAllData } = require("./db");
const { getAllChats, getLatestMessage } = require("./helpers");
const basicAuthMiddleware = require("express-basic-auth");
const connectorRoutes = require('./routes/connectors');

// Event tracking constants
const EVENT_KEY = 'serverEvents';
const EVENT_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error'
};

ensureDbFile().then(() => {
    configureCronJobs();
});

configureAuthRoutes(app)

app.use(express.json());

// Register API routes
app.use('/api/connectors', connectorRoutes);

if (process.env.BASIC_AUTH_USERNAME && process.env.BASIC_AUTH_PASSWORD) {
    app.use(basicAuthMiddleware({
        users: {
            [process.env.BASIC_AUTH_USERNAME]: process.env.BASIC_AUTH_PASSWORD
        },
        challenge: true
    }));
}

async function getDeployments() {
    let data
    try {
        data = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data.json'), 'utf8'));
    } catch (e) {
        console.error('Error reading data.json:', e)
        return []
    }
    return (data.deployments || []).sort((a, b) => {
        const aDate = new Date(a.updatedAt ?? a.createdAt).getTime();
        const bDate = new Date(b.updatedAt ?? b.createdAt).getTime();
        return bDate - aDate;
    });
}

// Track server events
async function logServerEvent(type, title, message, details = null) {
    console.log(`server.js logServerEvent`, {type, title, message});
    
    try {
        // Create the event object
        const event = {
            id: uuidv4(),
            type: type,
            title: title,
            message: message,
            details: details,
            timestamp: new Date().toISOString(),
            read: false
        };
        
        // Get existing events
        const events = await getData(EVENT_KEY, []);
        
        // Add new event at the beginning
        events.unshift(event);
        
        // Keep only the latest 100 events
        const trimmedEvents = events.slice(0, 100);
        
        // Save events
        await setData(EVENT_KEY, trimmedEvents);
        
        return event;
    } catch (err) {
        console.log(`server.js logServerEvent error`, {message: err.message, stack: err.stack});
        return null;
    }
}

app.use(express.static(path.join(process.cwd(), 'frontend', '.output', 'public')));

app.get('/api/deployments', async (req, res) => {
    res.send(await getDeployments())
})

app.post('/api/deployments', async (req, res) => {
    const functionName = 'POST /api/deployments';
    console.log(`server.js ${functionName} Creating new deployment`, { body: req.body });
    
    try {
        const { content, from, repoName, connectorId } = req.body;
        
        if (!content) {
            return res.status(400).json({ message: 'Content is required' });
        }
        
        // Create deployment object
        const deployment = {
            id: Date.now().toString(),
            content,
            from: from || 'Manual UI Deployment',
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Add repository and connector if provided
        if (repoName) {
            deployment.repoName = repoName;
        }
        
        if (connectorId) {
            deployment.connectorId = connectorId;
        }
        
        // Add to database
        let data = await getAllData();
        if (!data.deployments) {
            data.deployments = [];
        }
        
        data.deployments.push(deployment);
        await setAllData(data);
        
        // Log event
        await logServerEvent(
            EVENT_TYPES.INFO,
            'Deployment Created',
            `New deployment created${repoName ? ` for repository ${repoName}` : ''}`,
            { deploymentId: deployment.id, content, repoName, connectorId }
        );
        
        res.status(201).json(deployment);
    } catch (err) {
        console.log(`server.js ${functionName} Error creating deployment`, {
            message: err.message,
            stack: err.stack
        });
        res.status(500).json({ message: 'Failed to create deployment', error: err.message });
    }
})

app.put('/api/deployments', async (req, res) => {
    const { id, status, approved, blacklistedBranches } = req.body
    console.log('server.js updateDeployment', { id, status, blacklistedBranches })
    let data;
    try {
        data = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data.json'), 'utf8'));
    } catch (e) {
        console.error('Error reading data.json for update:', e);
        return res.status(500).send('Error reading database file.');
    }

    const deploymentIndex = data.deployments.findIndex(d => d.id === id);
    if (deploymentIndex === -1) {
        return res.status(404).send('Deployment not found');
    }
    const deployment = data.deployments[deploymentIndex];

    if (deployment.status === 'canceled') {
        return res.status(400).send('Cannot modify canceled deployments')
    }

    if (status === 'pending' && !['processed', 'failed'].includes(deployment.status)) {
         console.warn(`Attempted to mark deployment ${id} as pending from status ${deployment.status}`);
         return res.status(400).send('Can only mark as pending from processed or failed status (found ' + deployment.status + ')')
    }

    if (status === 'pending') {
        deployment.status = 'pending';
        deployment.processingLogs = [];
        deployment.processingBranchErrors = [];
        deployment.nextTag = null;
        deployment.deployed = false;
        deployment.approved = null;
    } else if (!!status) {
        deployment.status = status;
    }
    
    // Handle blacklisted branches update if provided
    if (blacklistedBranches !== undefined) {
        console.log('server.js updateDeployment updating blacklistedBranches', { blacklistedBranches });
        deployment.blacklistedBranches = blacklistedBranches;
    }

    if (approved === true) {
        if (deployment.status !== 'processed') {
             return res.status(400).send('Can only approve deployments with status "processed"');
        }
        deployment.approved = true;
    } else if (approved === false) {
        deployment.approved = false;
    }

    console.log('server.js updateDeployment', { id, status, approved, deployment })

    deployment.updatedAt = new Date().toISOString()
    data.deployments[deploymentIndex] = deployment;

    try {
        await fs.writeFile(path.join(process.cwd(), 'data.json'), JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error writing data.json after update:', e);
        return res.status(500).send('Error saving database changes.');
    }

    if (approved === true) {
        console.log(`Deployment ${id} approved, triggering processing.`);
        
        // Log event for deployment approval
        await logServerEvent(
            EVENT_TYPES.INFO,
            'Deployment Approved',
            `Deployment #${id} was approved for processing`,
            { deploymentId: id }
        );
        
        setTimeout(() => processDeployments(), 1000);
    }

    res.json(deployment)
})

app.post('/api/deployments/:id/cancel', async (req, res) => {
    console.log('server.js cancelDeployment', { id: req.params.id })
    let data;
     try {
        data = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data.json'), 'utf8'));
    } catch (e) {
        console.error('Error reading data.json for cancel:', e);
        return res.status(500).send('Error reading database file.');
    }

    const deploymentIndex = data.deployments.findIndex(d => d.id === req.params.id);
     if (deploymentIndex === -1) {
        return res.status(404).send('Deployment not found');
    }
    const deployment = data.deployments[deploymentIndex];

    if (deployment.deployed) {
        return res.status(400).send('Cannot cancel already deployed deployments')
    }

    deployment.status = 'canceled'
    deployment.approved = null;
    deployment.updatedAt = new Date().toISOString()
    data.deployments[deploymentIndex] = deployment;

    try {
        await fs.writeFile(path.join(process.cwd(), 'data.json'), JSON.stringify(data, null, 2));
        res.send('Deployment canceled');
    } catch (e) {
        console.error('Error writing data.json after cancel:', e);
        res.status(500).send('Error saving database changes.');
    }
})

app.post('/api/deployments/process', async (req, res) => {
    console.log('server.js POST /api/deployments/process received');
    try {
        // Log event for processing start
        await logServerEvent(
            EVENT_TYPES.INFO,
            'Deployment Processing Started',
            'Started processing pending deployments',
            { initiatedBy: 'user', timestamp: new Date().toISOString() }
        );
        
        processDeployments()
            .then(async (result) => {
                // Log success event
                await logServerEvent(
                    EVENT_TYPES.SUCCESS,
                    'Deployment Processing Completed',
                    `Successfully processed deployments`,
                    result
                );
            })
            .catch(async (err) => {
                console.error('Error in processDeployments:', err);
                // Log error event
                await logServerEvent(
                    EVENT_TYPES.ERROR,
                    'Deployment Processing Failed',
                    `Error occurred during deployment processing: ${err.message}`,
                    { error: err.message, stack: err.stack }
                );
            });
            
        res.send('Processing started');
    } catch (error) {
        console.error('Error processing deployments:', error);
        
        // Log error event
        await logServerEvent(
            EVENT_TYPES.ERROR,
            'Deployment Processing Error',
            `Failed to start deployment processing: ${error.message}`,
            { error: error.message, stack: error.stack }
        );
        
        res.status(500).send('Failed to process deployments');
    }
});

app.get('/api/teams/chats', async (req, res) => {
    try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            return res.status(401).send('Authentication required. Please login.');
        }
        const chats = await getAllChats(accessToken);
        res.json(chats);
    } catch (error) {
        console.error('Error fetching Teams chats:', error);
        res.status(error.message.includes('Authentication') ? 401 : 500).send(error.message || 'Failed to fetch Teams chats');
    }
});

const CRON_CONFIG_KEY = 'cronConfigs';

app.get('/api/cron-configs', async (req, res) => {
    try {
        const configs = await getData(CRON_CONFIG_KEY, []);
        res.json(configs);
    } catch (error) {
        console.error('Error fetching cron configs:', error);
        res.status(500).send('Failed to fetch cron configurations.');
    }
});

app.post('/api/cron-configs', async (req, res) => {
    try {
        const { channelId, channelName, schedule } = req.body;
        if (!channelId || !channelName || !schedule) {
            return res.status(400).send('Missing required fields: channelId, channelName, schedule.');
        }
        const newConfig = {
            id: uuidv4(),
            channelId,
            channelName,
            schedule,
            enabled: true,
            createdAt: new Date().toISOString(),
        };

        const configs = await getData(CRON_CONFIG_KEY, []);
        configs.push(newConfig);
        await setData(CRON_CONFIG_KEY, configs);

        await restartCronJobs();
        res.status(201).json(newConfig);
    } catch (error) {
        console.error('Error adding cron config:', error);
        res.status(500).send('Failed to add cron configuration.');
    }
});

app.put('/api/cron-configs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { schedule, enabled } = req.body;

        const configs = await getData(CRON_CONFIG_KEY, []);
        const index = configs.findIndex(c => c.id === id);

        if (index === -1) {
            return res.status(404).send('Cron configuration not found.');
        }

        if (schedule !== undefined) {
            configs[index].schedule = schedule;
        }
        if (enabled !== undefined) {
            configs[index].enabled = Boolean(enabled);
        }

        if(req.body.messagePattern !== undefined) {
            configs[index].messagePattern = req.body.messagePattern;
            console.log('messagePattern updated:', req.body.messagePattern);
        }

        configs[index].updatedAt = new Date().toISOString();

        await setData(CRON_CONFIG_KEY, configs);

        await restartCronJobs();
        res.json(configs[index]);
    } catch (error) {
        console.error('Error updating cron config:', error);
        res.status(500).send('Failed to update cron configuration.');
    }
});

app.delete('/api/cron-configs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let configs = await getData(CRON_CONFIG_KEY, []);
        const initialLength = configs.length;
        configs = configs.filter(c => c.id !== id);

        if (configs.length === initialLength) {
            return res.status(404).send('Cron configuration not found.');
        }

        await setData(CRON_CONFIG_KEY, configs);

        await restartCronJobs();
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting cron config:', error);
        res.status(500).send('Failed to delete cron configuration.');
    }
});

app.post('/api/cron-configs/:id/test', async (req, res) => {
    try {
        const { id } = req.params;
        const configs = await getData(CRON_CONFIG_KEY, []);
        const config = configs.find(c => c.id === id);

        if (!config) {
            return res.status(404).send('Cron configuration not found.');
        }

        const accessToken = await getAccessToken();
        if (!accessToken) {
            return res.status(401).send('Authentication required. Please login.');
        }

        console.log(`Testing channel fetch for config ID: ${id}, Channel ID: ${config.channelId}`);
        const latestMessage = await getLatestMessage(accessToken, config.channelId);

        if (latestMessage) {
            res.json({
                message: `Latest message from "${config.channelName}"`,
                details: latestMessage
            });
        } else {
            res.json({
                message: `No messages found in "${config.channelName}".`,
                details: null
            });
        }
    } catch (error) {
        console.error(`Error testing cron config ${req.params.id}:`, error);
        const statusCode = error.message.includes('Authentication') ? 401
                         : error.message.includes('Chat not found') ? 404
                         : 500;
        res.status(statusCode).send(error.message || 'Failed to test channel.');
    }
});

// Events API endpoints
app.get('/api/events', async (req, res) => {
    try {
        const events = await getData(EVENT_KEY, []);
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).send('Failed to fetch events');
    }
});

app.put('/api/events/mark-read', async (req, res) => {
    try {
        const { eventIds } = req.body;
        
        if (!Array.isArray(eventIds)) {
            return res.status(400).send('eventIds must be an array');
        }
        
        const events = await getData(EVENT_KEY, []);
        
        // Mark specified events as read
        const updatedEvents = events.map(event => {
            if (eventIds.includes(event.id)) {
                return { ...event, read: true };
            }
            return event;
        });
        
        await setData(EVENT_KEY, updatedEvents);
        res.json({ success: true, markedCount: eventIds.length });
    } catch (error) {
        console.error('Error marking events as read:', error);
        res.status(500).send('Failed to mark events as read');
    }
});

app.put('/api/events/mark-all-read', async (req, res) => {
    try {
        const events = await getData(EVENT_KEY, []);
        
        // Mark all events as read
        const updatedEvents = events.map(event => ({ ...event, read: true }));
        
        await setData(EVENT_KEY, updatedEvents);
        res.json({ success: true, markedCount: events.length });
    } catch (error) {
        console.error('Error marking all events as read:', error);
        res.status(500).send('Failed to mark all events as read');
    }
});

app.get('/api/db/export', async (req, res) => {
    try {
        const filePath = path.join(process.cwd(), 'data.json');
        await fs.access(filePath);
        res.setHeader('Content-Disposition', 'attachment; filename=data.json');
        res.setHeader('Content-Type', 'application/json');
        res.sendFile(filePath);
        
        // Log event for DB export
        await logServerEvent(
            EVENT_TYPES.INFO,
            'Database Exported',
            'Database was exported by a user',
            { timestamp: new Date().toISOString() }
        );
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error('Export failed: data.json not found.');
            res.status(404).send('Database file (data.json) not found.');
        } else {
            console.error('Error exporting database:', error);
            res.status(500).send('Failed to export database.');
        }
    }
});

app.post('/api/messages/fetch', async (req, res) => {
    console.log('server.js POST /api/messages/fetch received');
    try {
        // Log event for message fetch start
        await logServerEvent(
            EVENT_TYPES.INFO,
            'Message Fetch Started',
            'Started fetching messages from Teams channels',
            { initiatedBy: 'user', timestamp: new Date().toISOString() }
        );
        
        const configs = await getData(CRON_CONFIG_KEY, []);
        const enabledConfigs = configs.filter(c => c.enabled);
        const legacyChatId = process.env.CHAT_ID;
        
        let fetchResults = [];
        
        // Run for all enabled configs
        for (const config of enabledConfigs) {
            console.log(`Running message fetch for channel "${config.channelName}" (ID: ${config.channelId})`);
            const result = await runCronHandler(config.channelId, config.id, config.channelName, config.messagePattern);
            fetchResults.push({
                channelId: config.channelId,
                channelName: config.channelName,
                result: result
            });
        }

        // Run for legacy config if available
        if (legacyChatId && enabledConfigs.length === 0) {
            console.log(`Running legacy message fetch for CHAT_ID ${legacyChatId}`);
            const result = await runCronHandler(legacyChatId, 'legacy', 'Legacy Fallback');
            fetchResults.push({
                channelId: legacyChatId,
                channelName: 'Legacy Fallback',
                result: result
            });
        }

        // Log success event
        await logServerEvent(
            EVENT_TYPES.SUCCESS,
            'Message Fetch Completed',
            `Successfully fetched messages from ${enabledConfigs.length} channels`,
            { channels: fetchResults }
        );

        res.send('Messages fetch completed successfully');
    } catch (error) {
        console.error('Error fetching messages:', error);
        
        // Log error event
        await logServerEvent(
            EVENT_TYPES.ERROR,
            'Message Fetch Failed',
            `Error occurred during message fetch: ${error.message}`,
            { error: error.message, stack: error.stack }
        );
        
        res.status(error.message.includes('Authentication') ? 401 : 500).send(error.message || 'Failed to fetch messages');
    }
});

app.post('/api/db/import', async (req, res) => {
    try {
        const importData = req.body;

        if (typeof importData !== 'object' || importData === null || Array.isArray(importData)) {
             return res.status(400).send('Invalid JSON format. Expected a JSON object.');
        }

        await setAllData(importData);

        if (importData.hasOwnProperty(CRON_CONFIG_KEY)) {
            console.log("Imported data contains cron configurations, restarting cron jobs...");
            await restartCronJobs();
        }

        if (importData.hasOwnProperty('deployments')) {
             console.log("Imported data contains deployments, triggering processing check...");
             setTimeout(() => processDeployments().catch(err => console.error("Post-import processing failed:", err)), 1000);
        }

        // Log event for DB import
        await logServerEvent(
            EVENT_TYPES.SUCCESS,
            'Database Imported',
            'Database was imported successfully',
            { 
                deployments: importData.hasOwnProperty('deployments'),
                cronConfigs: importData.hasOwnProperty(CRON_CONFIG_KEY),
                timestamp: new Date().toISOString()
            }
        );

        res.status(200).send('Database imported successfully.');
    } catch (error) {
        console.error('Error importing database:', error);
        
        // Log error event
        await logServerEvent(
            EVENT_TYPES.ERROR,
            'Database Import Failed',
            `Failed to import database: ${error.message}`,
            { error: error.message, stack: error.stack }
        );
        
        res.status(500).send(`Failed to import database: ${error.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
