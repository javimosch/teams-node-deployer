# API Documentation

## Authentication Endpoints

### POST /login
Initiates Microsoft OAuth flow

### GET /auth/callback
Handles OAuth callback and token storage

### POST /logout
Revokes tokens and redirects to login

## Deployment Endpoints

### GET /api/deployments
Returns list of all deployments

### PUT /api/deployments
Updates deployment status
- Params: id, status, approved, blacklistedBranches

### POST /api/deployments/process
Triggers manual deployment processing

### POST /api/deployments/:id/cancel
Cancels a specific deployment

## Teams Integration Endpoints

### GET /api/teams/chats
Returns list of available Teams chats

### GET /api/cron-configs
Returns cron job configurations

### POST /api/cron-configs
Creates new cron configuration
- Required: channelId, channelName, schedule

### PUT /api/cron-configs/:id
Updates existing cron configuration

### DELETE /api/cron-configs/:id
Removes cron configuration

### POST /api/cron-configs/:id/test
Tests channel configuration

## Database Management

### GET /api/db/export
Exports current database state

### POST /api/db/import
Imports database state
- Validates JSON format
- Restarts cron jobs if needed
- Triggers deployment processing

## Event Management

### GET /api/events
Returns system events

### PUT /api/events/mark-read
Marks specific events as read

### PUT /api/events/mark-all-read
Marks all events as read

## Response Formats

### Deployment Object
```javascript
{
  id: string,
  status: string,
  approved: boolean,
  processingLogs: array,
  processingBranchErrors: array,
  nextTag: string,
  deployed: boolean
}
```

### Event Object
```javascript
{
  id: string,
  type: string,
  title: string,
  message: string,
  details: object,
  timestamp: string,
  read: boolean
}
```

## Error Handling
- 401: Authentication required
- 404: Resource not found
- 400: Invalid request parameters
- 500: Internal server error