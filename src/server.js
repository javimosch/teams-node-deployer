require("dotenv").config();
require('./logging')

const express = require("express");
const fs = require('fs').promises;
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const { configureAuthRoutes} = require('./auth')
const {configureCronJobs} = require('./cron')
const {processDeployments} = require("./gitlab");
const {ensureDbFile} = require("./db");
const basicAuthMiddleware = require("express-basic-auth");

// /login /logout /auth/callback
configureAuthRoutes(app)

if(process.env.BASIC_AUTH_USERNAME && process.env.BASIC_AUTH_PASSWORD) {
    app.use(basicAuthMiddleware({
        users: {
            [process.env.BASIC_AUTH_USERNAME]: process.env.BASIC_AUTH_PASSWORD
        }
    }));
}

// fetch messages and process deployments 
ensureDbFile().then(() => {
    configureCronJobs()
})

app.use(express.json());

async function getDeployments() {
    let data 
    try{
        data= JSON.parse(await fs.readFile(path.join(process.cwd(), 'data.json'), 'utf8'));
    } catch (e) {
        console.error('Error reading data.json:', e)
        return []
    }
    return (data.deployments || []).sort((a, b) => {
        const aDate = new Date(a.updatedAt ?? a.createdAt).getTime();
        const bDate = new Date(b.updatedAt ?? b.createdAt).getTime();
        return bDate - aDate; // This gives descending order (newest first)
    });
}

app.get('/', async(req, res) => {
    const html = await fs.readFile(path.join(process.cwd(), 'src', 'index.html'), 'utf8');
    const newHtml = html.replace('//__INJECT_DEPLOYMENTS_FROM_SERVER_HERE__', `
window.deployments = ${JSON.stringify(await getDeployments())}
        `)
    res.send(newHtml)
})

app.get('/api/deployments', async (req, res) => {
    res.send(await getDeployments())
})

app.put('/api/deployments', async (req, res) => {
    const {id, status, approved} = req.body
    console.log('server.js updateDeployment', {id, status})
    const data = require(path.join(process.cwd(), 'data.json'))
    const deployment = data.deployments.find(d => d.id === id)
    if (!deployment) {
        return res.status(404).send('Deployment not found')
    }
    
    // Prevent modifying canceled deployments
    if (deployment.status === 'canceled') {
        return res.status(400).send('Cannot modify canceled deployments')
    }

    // Only allow setting status to pending if deployment is processed and not approved
    if (status === 'pending' && (deployment.status !== 'processed' )) {
        return res.status(400).send('Can only mark as pending processed (found '+deployment.status+')')
    }
    
    if(!!status){
        deployment.status = status
    }


    //UI sends processing when the user clicks "Approve" action
    if(approved===true){
        deployment.approved = true
    }

    console.log('server.js updateDeployment', {id, status, approved, deployment})

    deployment.updatedAt = new Date().toISOString()
    await fs.writeFile(path.join(process.cwd(), 'data.json'), JSON.stringify(data, null, 2))

    setTimeout(()=> processDeployments(), 1000)

    res.json(deployment)
})

app.post('/api/deployments/:id/cancel', async (req, res) => {
    console.log('server.js cancelDeployment', { id: req.params.id })
    const data = require(path.join(process.cwd(), 'data.json'))
    const deployment = data.deployments.find(d => d.id === req.params.id)
    if (!deployment) {
        return res.status(404).send('Deployment not found')
    }
    
    // Only allow canceling non-deployed deployments
    if (deployment.deployed) {
        return res.status(400).send('Can only cancel non-deployed deployments')
    }
    
    deployment.status = 'canceled'
    deployment.updatedAt = new Date().toISOString()
    await fs.writeFile(path.join(process.cwd(), 'data.json'), JSON.stringify(data, null, 2))
    res.send('Deployment canceled')
})

// New endpoint to trigger deployment processing
app.post('/api/deployments/process', async (req, res) => {
    console.log('server.js POST /api/deployments/process received');
    try {
        // Call processDeployments and wait for it to finish
        await processDeployments(); 
        console.log('server.js POST /api/deployments/process finished processing');
        res.status(200).send('Deployment processing completed'); // Respond with 200 OK
    } catch (error) {
        console.error('Error processing deployments:', error);
        res.status(500).send('Failed to process deployments');
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
