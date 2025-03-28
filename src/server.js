require("dotenv").config();
require('./logging')

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const { configureAuthRoutes} = require('./auth')
const {configureCronJobs} = require('./cron')

// /login /logout /auth/callback
configureAuthRoutes(app)

// fetch messages and process deployments 
configureCronJobs()

app.use(express.json());

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
