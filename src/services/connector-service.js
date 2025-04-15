/**
 * Connector Service
 * Manages Git connectors (GitLab, GitHub) for multi-repository support
 */

const { getData, setData, setDataPushUpdateIfExists } = require("../db");
const GitConnector = require("../models/git-connector");

const CONNECTORS_KEY = 'gitConnectors';

/**
 * Get all git connectors
 * @returns {Array} List of git connectors
 */
async function getAllConnectors() {
    const functionName = 'getAllConnectors';
    console.log(`services/connector-service.js ${functionName} Fetching all git connectors`);
    return await getData(CONNECTORS_KEY, []);
}

/**
 * Get active git connectors
 * @returns {Array} List of active git connectors
 */
async function getActiveConnectors() {
    const functionName = 'getActiveConnectors';
    console.log(`services/connector-service.js ${functionName} Fetching active git connectors`);
    const connectors = await getData(CONNECTORS_KEY, []);
    return connectors.filter(connector => connector.active);
}

/**
 * Get a connector by id
 * @param {String} id Connector id
 * @returns {Object|null} Connector or null if not found
 */
async function getConnectorById(id) {
    const functionName = 'getConnectorById';
    console.log(`services/connector-service.js ${functionName} Fetching connector by id`, { id });
    const connectors = await getData(CONNECTORS_KEY, []);
    return connectors.find(connector => connector.id === id) || null;
}

/**
 * Create a new git connector
 * @param {Object} connectorData Connector data
 * @returns {Object} Created connector
 */
async function createConnector(connectorData) {
    const functionName = 'createConnector';
    console.log(`services/connector-service.js ${functionName} Creating new git connector`, { connectorData });
    
    const connector = new GitConnector(connectorData);
    const validationErrors = GitConnector.validateConnector(connector);
    
    if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
    }
    
    const connectors = await getData(CONNECTORS_KEY, []);
    connectors.push(connector);
    await setData(CONNECTORS_KEY, connectors);
    
    return connector;
}

/**
 * Update an existing git connector
 * @param {String} id Connector id
 * @param {Object} connectorData Updated connector data
 * @returns {Object} Updated connector
 */
async function updateConnector(id, connectorData) {
    const functionName = 'updateConnector';
    console.log(`services/connector-service.js ${functionName} Updating git connector`, { id, connectorData });
    
    const connector = await getConnectorById(id);
    if (!connector) {
        throw new Error(`Connector with id ${id} not found`);
    }
    
    const updatedConnector = {
        ...connector,
        ...connectorData,
        updatedAt: new Date().toISOString()
    };
    
    const validationErrors = GitConnector.validateConnector(updatedConnector);
    if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
    }
    
    await setDataPushUpdateIfExists(
        CONNECTORS_KEY,
        updatedConnector,
        item => item.id === id
    );
    
    return updatedConnector;
}

/**
 * Delete a git connector
 * @param {String} id Connector id
 * @returns {Boolean} Success
 */
async function deleteConnector(id) {
    const functionName = 'deleteConnector';
    console.log(`services/connector-service.js ${functionName} Deleting git connector`, { id });
    
    const connectors = await getData(CONNECTORS_KEY, []);
    const filteredConnectors = connectors.filter(connector => connector.id !== id);
    
    if (filteredConnectors.length === connectors.length) {
        throw new Error(`Connector with id ${id} not found`);
    }
    
    await setData(CONNECTORS_KEY, filteredConnectors);
    return true;
}

/**
 * Initialize default connector from environment variables if none exist
 */
async function initializeDefaultConnector() {
    const functionName = 'initializeDefaultConnector';
    console.log(`services/connector-service.js ${functionName} Checking for existing connectors`);
    
    const connectors = await getData(CONNECTORS_KEY, []);
    
    if (connectors.length === 0 && process.env.GITLAB_ACCESS_TOKEN && process.env.GITLAB_BASE_URL) {
        console.log(`services/connector-service.js ${functionName} Creating default connector from environment variables`);
        try {
            const defaultConnector = new GitConnector({
                name: 'Default GitLab',
                type: 'gitlab',
                url: process.env.GITLAB_BASE_URL,
                accessToken: process.env.GITLAB_ACCESS_TOKEN
            });
            
            connectors.push(defaultConnector);
            await setData(CONNECTORS_KEY, connectors);
            console.log(`services/connector-service.js ${functionName} Default connector created successfully`);
        } catch (err) {
            console.log(`services/connector-service.js ${functionName} Failed to create default connector`, {
                message: err.message,
                stack: err.stack
            });
        }
    }
}

module.exports = {
    getAllConnectors,
    getActiveConnectors,
    getConnectorById,
    createConnector,
    updateConnector,
    deleteConnector,
    initializeDefaultConnector
};
