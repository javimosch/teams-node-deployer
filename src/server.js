require("dotenv").config();
require('./logging')

const express = require("express");
const fs = require('fs').promises;
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const { configureAuthRoutes} = require('./auth')
const {configureCronJobs} = require('./cron')

// /login /logout /auth/callback
configureAuthRoutes(app)

// fetch messages and process deployments 
configureCronJobs()

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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
