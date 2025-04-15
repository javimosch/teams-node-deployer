# Multi-Repository Support

## Overview

Teams Node Deployer now supports managing multiple Git repositories through configurable Git connectors. This feature allows you to:

1. Configure multiple Git provider connections (currently GitLab, with GitHub planned for future)
2. Associate deployments with specific repositories and connectors
3. Manage all your deployments from a single interface

## Git Connectors

Git connectors represent connections to Git providers (e.g., GitLab). Each connector has:

- Name: A friendly name for the connector
- Type: The Git provider type (currently only 'gitlab')
- URL: The base URL for the Git provider (e.g., https://gitlab.com)
- Access Token: The authentication token for the Git provider
- Active status: Whether the connector is currently active

## How It Works

### Connector Management

1. Connectors are managed through the UI in the "Git Connectors" tab
2. You can create, edit, activate/deactivate, and delete connectors
3. The first active connector is used by default if none is specified for a deployment

### Deployment Creation

When creating a deployment, you can specify:

1. The repository name to use for the deployment
2. The Git connector to use for accessing the repository

If no repository or connector is specified, the system falls back to the default values from environment variables (GITLAB_REPO_NAME, etc.).

### Backward Compatibility

For backward compatibility, the system:

1. Automatically creates a default connector from environment variables if none exist
2. Continues to support the legacy environment variables (GITLAB_BASE_URL, GITLAB_ACCESS_TOKEN, GITLAB_REPO_NAME)

## API Endpoints

### Git Connectors

- `GET /api/connectors`: Get all connectors
- `GET /api/connectors/active`: Get active connectors
- `GET /api/connectors/:id`: Get connector by ID
- `POST /api/connectors`: Create a new connector
- `PUT /api/connectors/:id`: Update a connector
- `DELETE /api/connectors/:id`: Delete a connector

### Deployments

- `POST /api/deployments`: Create a new deployment (supports repoName and connectorId parameters)

## Technical Implementation

The multi-repository support is implemented through:

1. A Git connector model and service for managing connectors
2. Updated GitLab integration to work with multiple repositories and connectors
3. UI components for managing connectors and creating deployments with repository selection

## Future Enhancements

Planned enhancements for the multi-repository support include:

1. Support for GitHub repositories
2. Repository-specific configuration options
3. Branch naming convention configuration per repository
4. Repository groups for organizing related repositories
