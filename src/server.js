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

// /login /logout /auth/callback
configureAuthRoutes(app)

// fetch messages and process deployments 
ensureDbFile().then(() => {
    configureCronJobs()
})

app.use(express.json());

app.get('/', async(req, res) => {
    //read file
    const html = await fs.readFile(path.join(process.cwd(), 'src', 'index.html'), 'utf8');
    //replace with __INJECT_DEPLOYMENTS_FROM_SERVER_HERE__ from data from ./data.json
    const data = require(path.join(process.cwd(), 'data.json'))
    const newHtml = html.replace('//__INJECT_DEPLOYMENTS_FROM_SERVER_HERE__', `
window.deployments = ${JSON.stringify(data.deployments)}
        `)
    res.send(newHtml)
})

app.get('/api/deployments', async (req, res) => {
    //read file instead of cache
    const data = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data.json'), 'utf8'))
    res.send(data.deployments || [] .sort((a, b) => {
        const aDate = a.updatedAt || a.createdAt
        const bDate = b.updatedAt || b.createdAt
        return new Date(bDate) - new Date(aDate)
    }))
})

app.put('/api/deployments', async (req, res) => {
    const {id, status} = req.body
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
    if (status === 'pending' && (deployment.status !== 'processed' || deployment.approved === "true")) {
        return res.status(400).send('Can only mark as pending processed and non-approved deployments')
    }
    
    deployment.status = status

    console.log('server.js updateDeployment', {id, status, deployment})

    //UI sends processing when the user clicks "Approve" action
    if(status==='processing'){
        deployment.approved = true
    }

    deployment.updatedAt = new Date().toISOString()
    await fs.writeFile(path.join(process.cwd(), 'data.json'), JSON.stringify(data, null, 2))

    setTimeout(()=> processDeployments(), 1000)

    res.send('Deployment updated')
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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
