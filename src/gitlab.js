const { getData, setDataPushUpdateIfExists, setData } = require("./db");
const { cloneRepo } = require("./gitlab.clone");
const { extractBranchesFromText, calculateNextTag } = require('./ai');
const git = require('./git-utils');

let processing = false;

async function processDeployments() {
    if (processing) return;
    processing = true;
    try {
        let deployments = await getData('deployments');
        if (deployments.length > 0) {
            for (const deployment of deployments) {
                console.log('Processing deployment:', deployment);
                await setDataPushUpdateIfExists('deployments', {
                    status: 'in_progress'
                }, (item) => item.id === deployment.id);
                const repoPath = await cloneRepo();
                await deployTicket(deployment, repoPath);
            }
        }
    } catch (err) {
        console.error('Error processing deployments:', {
            message: err.message,
            stack: err.stack
        });
    } finally {
        processing = false;
    }
}

async function deployTicket(deployment, repoPath) {
    const functionName = 'deployTicket';
    try {
        console.log(`src/gitlab.js ${functionName} Starting deployment processing`, { deployment });

        // 1. Extract branch names from content
        const branches = extractBranchesFromText(deployment.content);
        if (!branches.length) {
            console.log(`src/gitlab.js ${functionName} No branches found in deployment content`);
            return;
        }else{
            console.log(`src/gitlab.js ${functionName} Found branches to process`, { branches });
        }

        process.exit(0);

        console.log(`src/gitlab.js ${functionName} Found branches to process`, { branches });

        // 2. Process each branch
        for (const branch of branches) {
            try {
                console.log(`src/gitlab.js ${functionName} Processing branch`, { branch });

                // 2.1 Checkout preprod and reset
                await git.checkoutBranch(repoPath, 'preprod');
                await git.resetHard(repoPath);

                // 2.2 Pull branch
                console.log(`src/gitlab.js ${functionName} Pulling branch`, { branch });
                await git.pullBranch(repoPath, branch);
                
            } catch (err) {
                console.log(`src/gitlab.js ${functionName} Error processing branch`, {
                    branch,
                    message: err.message,
                    stack: err.stack
                });
                continue; // Skip to next branch on error
            }
        }

        // 3. Calculate next tag
        const prodTag = await git.getLatestTag(repoPath, 'origin/prod');
        const preprodTag = await git.getLatestTag(repoPath, 'origin/preprod');
        const nextTag = calculateNextTag(prodTag, preprodTag);

        console.log(`src/gitlab.js ${functionName} Tag calculation complete`, {
            prodTag,
            preprodTag,
            nextTag
        });

        // 4. Output result and exit
        console.log(`Next tag would be ${nextTag}`);
        process.exit(0);

    } catch (err) {
        console.log(`src/gitlab.js ${functionName} Deployment processing failed`, {
            message: err.message,
            stack: err.stack
        });
        throw err;
    }
}

module.exports = {
    processDeployments
};
