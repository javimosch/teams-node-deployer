# Backend Knowledge Base

## Project Overview
Teams Node Deployer - A Node.js application that automates deployments by monitoring Microsoft Teams messages and integrating with GitLab.

## Core Components

### Authentication (auth.js)
- Uses Microsoft OAuth 2.0 for Teams API access
- Handles token refresh automatically
- Required scopes: offline_access, Chat.Read, Chat.ReadBasic, Chat.ReadWrite

### Data Storage (db.js)
- File-based storage using data.json
- Handles all persistence needs (tokens, deployments, configurations)
- Uses atomic write operations for data safety

### GitLab Integration (gitlab.js, gitlab.clone.js)
- Manages repository cloning and deployment automation
- Supports branch merging and tag management
- Environment Variables Required:
  - GITLAB_BASE_URL
  - GITLAB_ACCESS_TOKEN
  - GITLAB_REPO_NAME

### Teams Integration (helpers.js)
- Monitors Teams chats for deployment messages
- Supports multiple chat channels
- Handles message pattern matching for deployment triggers

### Cron Jobs (cron.js)
- Manages scheduled tasks for message checking and deployments
- Default schedules:
  - Message fetch: */10 * * * * *
  - Deployment processing: */15 * * * * *
  - Token refresh: */5 * * * *

## Important Rules & Guidelines

### Git Operations
- Always use fast-forward only merges
- Handle merge conflicts by aborting and logging
- Clean up cloned repos after use
- Never modify production branch directly

### Deployment Process
1. Monitor Teams messages for deployment patterns
2. Extract branch information from messages
3. Clone and verify branches
4. Merge changes following fast-forward strategy
5. Create and push tags when approved

### Error Handling
- Log all errors with timestamps
- Maintain audit trail of deployment attempts
- Track branch-specific errors separately
- Preserve failed deployment information for debugging

## Common Issues & Solutions

### Authentication
- If token refresh fails, redirect to login
- Keep refresh token secure and valid
- Monitor token expiration proactively

### Git Operations
- Handle network timeouts during clones
- Manage disk space for temporary repositories
- Clean up failed clone attempts

### Deployment
- Verify branch existence before deployment
- Handle concurrent deployment requests
- Maintain deployment state consistency

## Development Guidelines

### Code Style
- Use async/await for asynchronous operations
- Log important operations with timestamps
- Include function names in log messages
- Keep error handling consistent

### Testing
- Verify deployments in staging first
- Test token refresh scenarios
- Validate git operations before production

### Security
- Never log sensitive tokens
- Validate all incoming Teams messages
- Secure GitLab access tokens
- Use environment variables for secrets