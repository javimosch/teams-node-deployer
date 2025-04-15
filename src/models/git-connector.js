/**
 * Git Connector Model 
 * Represents a connection to a Git provider (GitLab, GitHub, etc.)
 */

class GitConnector {
    constructor({
        id = null,
        name,
        type = 'gitlab', // 'gitlab', 'github', etc.
        url, 
        accessToken,
        active = true,
        createdAt = new Date().toISOString(),
        updatedAt = new Date().toISOString()
    }) {
        this.id = id || Date.now().toString();
        this.name = name;
        this.type = type;
        this.url = url;
        this.accessToken = accessToken;
        this.active = active;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    static validateConnector(connector) {
        const errors = [];

        if (!connector.name) {
            errors.push('Name is required');
        }

        if (!connector.type) {
            errors.push('Type is required');
        }

        if (!connector.url) {
            errors.push('URL is required');
        }

        if (!connector.accessToken) {
            errors.push('Access token is required');
        }

        return errors;
    }
}

module.exports = GitConnector;
