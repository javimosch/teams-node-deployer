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
        deployments = deployments.filter(deployment => deployment.status !== 'processed');
        if (deployments.length > 0) {
            for (const deployment of deployments) {

                

                console.log('Processing deployment:', deployment);
                await setDataPushUpdateIfExists('deployments', {
                    status: 'in_progress'
                }, (item) => item.id === deployment.id);
                const repoPath = await cloneRepo();
                await deployTicket(deployment, repoPath);

                await setDataPushUpdateIfExists('deployments', {
                    status: 'processed'
                }, (item) => item.id === deployment.id);
            }
        }else{
            console.log('No deployments to process');
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
    let hasChanges = false;
    
    try {
        console.log(`src/gitlab.js ${functionName} Starting deployment processing`, { deployment });

        // 1. Extract branch names
        const branches = await extractBranchesFromText(deployment.content);
        if (!branches.length) {
            console.log(`src/gitlab.js ${functionName} No branches found`);
            return false;
        }

        console.log(`src/gitlab.js ${functionName} Found branches to process`, { branches });

        // 2. Process each branch
        for (const branch of branches) {
            try {
                console.log(`src/gitlab.js ${functionName} Processing branch`, { branch });

                // 2.1 Checkout preprod and reset
                await git.checkoutBranch(repoPath, 'preprod');
                await git.resetHard(repoPath);

                // 2.2 Check if branch is already merged
                const isMerged = await git.isBranchMerged(repoPath, branch);
                if (isMerged) {
                    console.log(`src/gitlab.js ${functionName} Branch already merged`, { branch });
                    continue;
                }

                // 2.3 Pull branch
                console.log(`src/gitlab.js ${functionName} Pulling branch`, { branch });
                const pullResult = await git.pullBranch(repoPath, branch);
                
                // Check if pull actually made changes
                if (!pullResult.includes('Already up to date')) {
                    hasChanges = true;
                }

                deployment.processedBranches = deployment.processedBranches || [];
                deployment.processedBranches.push(branch);
                await setDataPushUpdateIfExists('deployments', {
                    ...deployment
                }, (item) => item.id === deployment.id);

            } catch (err) {
                console.log(`src/gitlab.js ${functionName} Error processing branch`, {
                    branch,
                    message: err.message,
                    stack: err.stack
                });
                
                deployment.processingBranchErrors = deployment.processingBranchErrors || {}
                deployment.processingBranchErrors.push({
                    branch,
                    message: err.message,
                    stack: err.stack
                })
                await setDataPushUpdateIfExists('deployments', {
                    ...deployment
                }, (item) => item.id === deployment.id);


                continue;
            }
        }

        // 3. Only calculate tag if changes were made
        if (!hasChanges) {
            console.log(`src/gitlab.js ${functionName} No changes made, skipping tag calculation`);
            return false;
        }

        // 4. Calculate next tag
        const prodTag = await git.getLatestTag(repoPath, 'origin/prod');
        const preprodTag = await git.getLatestTag(repoPath, 'origin/preprod');
        const nextTag = calculateNextTag(prodTag, preprodTag);

        console.log(`src/gitlab.js ${functionName} Tag calculation complete`, {
            prodTag,
            preprodTag,
            nextTag
        });

        // 5. Output result and exit
        console.log(`Next tag would be ${nextTag}`);

        await setDataPushUpdateIfExists('deployments', {
            ...deployment,
            nextTag
        }, (item) => item.id === deployment.id);
        

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
