/**
 * Git Connector API Routes
 * Endpoints for managing Git connectors (GitLab, GitHub)
 */
const express = require('express');
const router = express.Router();
const connectorService = require('../services/connector-service');

// Initialize default connector if none exist
(async () => {
    try {
        await connectorService.initializeDefaultConnector();
    } catch (err) {
        console.log(`routes/connectors.js initialization Error initializing default connector`, {
            message: err.message,
            stack: err.stack
        });
    }
})();

/**
 * GET /api/connectors
 * Get all connectors
 */
router.get('/', async (req, res) => {
    const functionName = 'GET /api/connectors';
    try {
        console.log(`routes/connectors.js ${functionName} Fetching all connectors`, {});
        const connectors = await connectorService.getAllConnectors();
        
        // Hide access tokens in response
        const sanitizedConnectors = connectors.map(connector => ({
            ...connector,
            accessToken: connector.accessToken ? '••••••••' : null
        }));
        
        res.json(sanitizedConnectors);
    } catch (err) {
        console.log(`routes/connectors.js ${functionName} Error fetching connectors`, {
            message: err.message,
            stack: err.stack
        });
        res.status(500).json({ message: 'Failed to fetch connectors', error: err.message });
    }
});

/**
 * GET /api/connectors/active
 * Get active connectors
 */
router.get('/active', async (req, res) => {
    const functionName = 'GET /api/connectors/active';
    try {
        console.log(`routes/connectors.js ${functionName} Fetching active connectors`, {});
        const connectors = await connectorService.getActiveConnectors();
        
        // Hide access tokens in response
        const sanitizedConnectors = connectors.map(connector => ({
            ...connector,
            accessToken: connector.accessToken ? '••••••••' : null
        }));
        
        res.json(sanitizedConnectors);
    } catch (err) {
        console.log(`routes/connectors.js ${functionName} Error fetching active connectors`, {
            message: err.message,
            stack: err.stack
        });
        res.status(500).json({ message: 'Failed to fetch active connectors', error: err.message });
    }
});

/**
 * GET /api/connectors/:id
 * Get connector by ID
 */
router.get('/:id', async (req, res) => {
    const functionName = 'GET /api/connectors/:id';
    try {
        console.log(`routes/connectors.js ${functionName} Fetching connector by ID`, { id: req.params.id });
        const connector = await connectorService.getConnectorById(req.params.id);
        
        if (!connector) {
            return res.status(404).json({ message: 'Connector not found' });
        }
        
        // Hide access token in response
        const sanitizedConnector = {
            ...connector,
            accessToken: connector.accessToken ? '••••••••' : null
        };
        
        res.json(sanitizedConnector);
    } catch (err) {
        console.log(`routes/connectors.js ${functionName} Error fetching connector`, {
            message: err.message,
            stack: err.stack
        });
        res.status(500).json({ message: 'Failed to fetch connector', error: err.message });
    }
});

/**
 * POST /api/connectors
 * Create a new connector
 */
router.post('/', async (req, res) => {
    const functionName = 'POST /api/connectors';
    try {
        console.log(`routes/connectors.js ${functionName} Creating new connector`, { body: { ...req.body, accessToken: '••••••••' } });
        
        const { name, type, url, accessToken, active } = req.body;
        
        if (!name || !type || !url || !accessToken) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        const connector = await connectorService.createConnector({
            name,
            type,
            url,
            accessToken,
            active: active !== undefined ? active : true
        });
        
        // Hide access token in response
        const sanitizedConnector = {
            ...connector,
            accessToken: connector.accessToken ? '••••••••' : null
        };
        
        res.status(201).json(sanitizedConnector);
    } catch (err) {
        console.log(`routes/connectors.js ${functionName} Error creating connector`, {
            message: err.message,
            stack: err.stack
        });
        res.status(500).json({ message: 'Failed to create connector', error: err.message });
    }
});

/**
 * PUT /api/connectors/:id
 * Update a connector
 */
router.put('/:id', async (req, res) => {
    const functionName = 'PUT /api/connectors/:id';
    try {
        console.log(`routes/connectors.js ${functionName} Updating connector`, { 
            id: req.params.id, 
            body: { ...req.body, accessToken: req.body.accessToken ? '••••••••' : null } 
        });
        
        const { name, type, url, accessToken, active } = req.body;
        
        if (!name || !type || !url) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        // Get current connector to check if we need to update the access token
        const existingConnector = await connectorService.getConnectorById(req.params.id);
        if (!existingConnector) {
            return res.status(404).json({ message: 'Connector not found' });
        }
        
        // Only update access token if provided and different from placeholder
        const updateData = {
            name,
            type,
            url,
            active: active !== undefined ? active : existingConnector.active
        };
        
        if (accessToken && accessToken !== '••••••••') {
            updateData.accessToken = accessToken;
        }
        
        const updatedConnector = await connectorService.updateConnector(req.params.id, updateData);
        
        // Hide access token in response
        const sanitizedConnector = {
            ...updatedConnector,
            accessToken: updatedConnector.accessToken ? '••••••••' : null
        };
        
        res.json(sanitizedConnector);
    } catch (err) {
        console.log(`routes/connectors.js ${functionName} Error updating connector`, {
            message: err.message,
            stack: err.stack
        });
        res.status(500).json({ message: 'Failed to update connector', error: err.message });
    }
});

/**
 * DELETE /api/connectors/:id
 * Delete a connector
 */
router.delete('/:id', async (req, res) => {
    const functionName = 'DELETE /api/connectors/:id';
    try {
        console.log(`routes/connectors.js ${functionName} Deleting connector`, { id: req.params.id });
        
        // Get active connectors count to prevent deleting last active connector
        const activeConnectors = await connectorService.getActiveConnectors();
        const connectorToDelete = await connectorService.getConnectorById(req.params.id);
        
        if (!connectorToDelete) {
            return res.status(404).json({ message: 'Connector not found' });
        }
        
        if (connectorToDelete.active && activeConnectors.length <= 1) {
            return res.status(400).json({ 
                message: 'Cannot delete the last active connector. Please activate another connector first.' 
            });
        }
        
        await connectorService.deleteConnector(req.params.id);
        res.json({ message: 'Connector deleted successfully' });
    } catch (err) {
        console.log(`routes/connectors.js ${functionName} Error deleting connector`, {
            message: err.message,
            stack: err.stack
        });
        res.status(500).json({ message: 'Failed to delete connector', error: err.message });
    }
});

module.exports = router;
