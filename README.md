# Teams Node Deployer

## Project Overview

A deployment automation system that handles Git operations and version tagging for CI/CD pipelines. Manages branch merging conflicts and calculates semantic versioning tags automatically.

## How it works

- A cron check for MS Teams channel messages (MESSAGE_PATTERN) and persist them
- A cron check for saved messages and process them for deployment
- Deployment process checks if detected branches can be merged into preprod and tag them (semantic versioning) (Check only)
- [TODO]: A web UI shows the queue of pending deployments and allows to process/approve them manually

## Assumptions

- You have a GitLab account with access to the repository
- You have a Microsoft Teams account with access to the channel
- You have a Microsoft Teams app registered with the necessary permissions
- You have a GitLab API token with read/write access to the repository
- You have a OpenRouter API key
- Your gitlab repo has a preprod and a prod branch
- Your ticket branches follow a convention i.g 'GEO-XXX', 'GDM-XXX', etc (see ai.js) (BRANCH_NAMING_CONVENTIONS)

## Goal

- Automatize integration of ticket branches into an environment branch and create a RC tag all from within a Microsoft Teams channel by sending a message like 'agent:deploy GEO-XXX'

## Persistance

- Current: FS (data.json)
- [TODO]: NocoDB and mongo support

## Setup Instructions
```bash
# Clone repository
git clone https://gitlab.example.com/your-project.git
cd teams-node-catcher

# Install dependencies
npm install

# Configure environment
cp env-example .env
```

## Configuration
Edit `.env` file with your credentials:
```ini

# Microsoft auth
CLIENT_ID=xx
TENANT_ID=xx
CLIENT_SECRET=xx

# Cron job (Check for new messages in a teams channel)
CRON_JOB_SCHEDULE=*/10 * * * * *

# Chat ID
CHAT_ID=xx

# Deployment
GITLAB_ACCESS_TOKEN=xx
GITLAB_REPO_NAME=georedv3

# Branch detection
OPENROUTER_API_KEY=xx
PRODUCTION_BRANCH=origin/prod
PREPROD_BRANCH=origin/preprod

# Other
APP_NAME=teams-node-catcher-local
```

## Deployment Process
1. Add deployment tickets through API/web interface
2. System processes tickets in queue:
   - Clones target repository
   - Attempts branch merges
   - Handles conflicts automatically
   - Calculates next semantic version
3. View results in dashboard or via API

## Usage Examples
```bash
# Check deployment status
curl http://localhost:3000/api/deployments

# Force process queue
curl -X POST http://localhost:3000/api/deployments/process
```

## Troubleshooting
Common issues and solutions:

| Error | Solution |
|-------|----------|
| Merge conflicts | System automatically skips conflicting branches - check logs |
| Missing .env | Copy env-example to .env and populate values |
| Git authentication | Verify GITLAB_TOKEN has repo read/write access |

## Maintenance
```bash
# Update dependencies
npm update

# View logs
tail -f logs/deployment.log
```

## License
MIT License