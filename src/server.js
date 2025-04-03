require("dotenv").config();
require('./logging')

const express = require("express");
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = process.env.PORT || 3000;
const { configureAuthRoutes, getAccessToken } = require('./auth');
const { configureCronJobs, restartCronJobs } = require('./cron');
const { processDeployments } = require("./gitlab");
const { ensureDbFile, getData, setData } = require("./db");
const { getAllChats } = require("./helpers");
const basicAuthMiddleware = require("express-basic-auth");

ensureDbFile().then(() => {
    configureCronJobs();
});

configureAuthRoutes(app)

app.use(express.json());

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

/* app.get('/', async(req, res) => {
    try {
        const html = await fs.readFile(path.join(process.cwd(), 'src', 'index.html'), 'utf8');
        res.send(html);
    } catch (e) {
        res.status(404).send("Frontend not found. Build the Nuxt app first.");
    }
}) */

app.use(express.static(path.join(process.cwd(), 'frontend', '.output', 'public')));

app.get('/api/deployments', async (req, res) => {
    res.send(await getDeployments())
})

app.put('/api/deployments', async (req, res) => {
    const { id, status, approved } = req.body
    console.log('server.js updateDeployment', { id, status })
    const data = require(path.join(process.cwd(), 'data.json'))
    const deployment = data.deployments.find(d => d.id === id)
    if (!deployment) {
        return res.status(404).send('Deployment not found')
    }

    if (deployment.status === 'canceled') {
        return res.status(400).send('Cannot modify canceled deployments')
    }

    if (status === 'pending' && (deployment.status !== 'processed')) {
        return res.status(400).send('Can only mark as pending processed (found ' + deployment.status + ')')
    }

    if (!!status) {
        deployment.status = status
    }

    if (approved === true) {
        deployment.approved = true
    }

    console.log('server.js updateDeployment', { id, status, approved, deployment })

    deployment.updatedAt = new Date().toISOString()
    await fs.writeFile(path.join(process.cwd(), 'data.json'), JSON.stringify(data, null, 2))

    setTimeout(() => processDeployments(), 1000)

    res.json(deployment)
})

app.post('/api/deployments/:id/cancel', async (req, res) => {
    console.log('server.js cancelDeployment', { id: req.params.id })
    const data = require(path.join(process.cwd(), 'data.json'))
    const deployment = data.deployments.find(d => d.id === req.params.id)
    if (!deployment) {
        return res.status(404).send('Deployment not found')
    }

    if (deployment.deployed) {
        return res.status(400).send('Can only cancel non-deployed deployments')
    }

    deployment.status = 'canceled'
    deployment.updatedAt = new Date().toISOString()
    await fs.writeFile(path.join(process.cwd(), 'data.json'), JSON.stringify(data, null, 2))
    res.send('Deployment canceled')
})

app.post('/api/deployments/process', async (req, res) => {
    console.log('server.js POST /api/deployments/process received');
    try {
        await processDeployments();
        console.log('server.js POST /api/deployments/process finished processing');
        res.status(200).send('Deployment processing completed');
    } catch (error) {
        console.error('Error processing deployments:', error);
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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
