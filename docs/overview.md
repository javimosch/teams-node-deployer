# Teams Node Deployer Overview

## System Architecture
```mermaid
graph TD
    A[Express Server] --> B[Auth Routes]
    A --> C[Cron Jobs]
    B --> D[Token Management]
    C --> E[Deployment Automation]
    D --> F[GitLab Integration]
    E --> F
    F --> G[Repo Cloning]
    F --> H[Deployment Tracking]
```

## Tech Stack
- **Runtime**: Node.js 18+
- **Web Framework**: Express 4.x
- **Authentication**: OAuth 2.0
- **Scheduling**: Node Cron
- **Version Control**: Git CLI integration
- **Data Storage**: File-based persistence

## Key Flows
1. Server Initialization
2. Authentication Setup
3. Cron Job Configuration
4. Deployment Processing
5. Subscription Management

## Design Patterns
- Factory Pattern (Git operations)
- Dependency Injection (Route configuration)
- Singleton (Data store access)