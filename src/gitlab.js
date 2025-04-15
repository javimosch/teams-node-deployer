const { getData, setDataPushUpdateIfExists, setData } = require("./db");
const { cloneRepo } = require("./gitlab.clone");
const { extractBranchesFromText, calculateNextTag } = require('./ai');
const git = require('./git-utils');

let processing = false;

const PRODUCTION_BRANCH = process.env.PRODUCTION_BRANCH || 'origin/prod';
const PREPROD_BRANCH = process.env.PREPROD_BRANCH || 'origin/preprod';

async function processDeployments() {
    if (processing) return;
    processing = true;
    try {
        let deployments = await getData('deployments', [])

        deployments = deployments
            .filter(dpl => dpl.status !== 'canceled')
            .filter(deployment => deployment.status !== 'processed' || (deployment.approved && deployment.status === 'processed' && !!deployment.nextTag && deployment.deployed !== true))

        if (deployments.length > 0) {

            for (const deployment of deployments) {
                console.log('Processing deployment:', deployment);
                await setDataPushUpdateIfExists('deployments', {
                    status: 'processing'
                }, (item) => item.id === deployment.id);
                const repoPath = await cloneRepo();
                await deployTicket(deployment, repoPath);

                await setDataPushUpdateIfExists('deployments', {
                    status: 'processed',
                    repoPath
                }, (item) => item.id === deployment.id);
            }
        } else {
            console.log('No deployments to process');
        }
    } catch (err) {
        console.error('Error processing deployments:', {
            message: err.message,
            stack: err.stack
        });
    } finally {
        processing = false;

        const deployments = await getData('deployments', []);
        deployments.forEach(deployment => {
            deployment.status = 'processed';
        });
        await setData('deployments', deployments);
    }
}

async function deployTicket(deployment, repoPath) {
    const functionName = 'deployTicket';
    let hasChanges = false;

    deployment.processingBranchErrors = [];
    deployment.processingLogs = [];
    // Ensure blacklistedBranches is initialized but preserved
    deployment.blacklistedBranches = deployment.blacklistedBranches || [];
    
    console.log(`src/gitlab.js ${functionName} Deployment initialized`, {
        id: deployment.id,
        blacklistedBranches: deployment.blacklistedBranches
    });

    try {
        console.log(`src/gitlab.js ${functionName} Starting deployment processing`, { deployment });

        // 1. Extract branch names
        const branches = await extractBranchesFromText(deployment.content);
        if (!branches.length) {
            console.log(`src/gitlab.js ${functionName} No branches found`);
            return false;
        }

        console.log(`src/gitlab.js ${functionName} Found branches to process`, { branches });


        let localPreprodBranch = PREPROD_BRANCH.split('origin/').join('');

        // 2.1 Checkout preprod-branch and reset
        await git.checkoutBranch(repoPath, localPreprodBranch);

        await git.resetHard(repoPath, PREPROD_BRANCH);


        // 2. Process each branch
        for (let branch of branches) {
            try {

                await git.executeGitCommand(repoPath, `fetch`); //sync

                deployment.processingLogs = deployment.processingLogs || [];

                // Check if this branch is in the blacklist
                const blacklistedBranches = deployment.blacklistedBranches || [];
                console.log(`src/gitlab.js ${functionName} Checking if branch is blacklisted`, {
                    branch,
                    blacklistedBranches
                });
                
                if (blacklistedBranches.some(blacklisted => branch === blacklisted || branch.includes(blacklisted))) {
                    console.log(`src/gitlab.js ${functionName} Skipping blacklisted branch`, { branch, blacklistedBranches: deployment.blacklistedBranches });
                    deployment.processingLogs.push({
                        branch,
                        message: `Branch blacklisted`
                    });
                    continue;
                }


                console.log(`src/gitlab.js ${functionName} Processing branch`, { branch });


                // 2.2 Check if branch is already merged
                const isMerged = await git.isBranchMerged(repoPath, branch);
                if (isMerged) {
                    console.log(`src/gitlab.js ${functionName} Branch already merged`, { branch });
                    deployment.processingLogs.push({
                        branch,
                        message: `Branch already merged`
                    });
                    continue;
                }

                const branchExistsPreprod = await git.branchExists(repoPath, `${branch}-preprod`);
                if (branchExistsPreprod) {
                    branch = `${branch}-preprod`;
                }
                console.log(`src/gitlab.js ${functionName} Using branch`, { branch, branchExistsPreprod });

                const branchExists = await git.branchExists(repoPath, branch);
                if (!branchExists) {
                    console.log(`src/gitlab.js ${functionName} Branch does not exist`, { branch });
                    deployment.processingLogs.push({
                        branch,
                        message: `Branch does not exist`
                    });
                    continue;
                }


                // 2.3 Pull branch with conflict handling
                console.log(`src/gitlab.js ${functionName} Pulling branch`, { branch });
                const pullResult = await git.pullBranch(repoPath, branch);



                if (!pullResult.success) {
                    if (pullResult.error.includes('CONFLICT')) {
                        console.log(`src/gitlab.js ${functionName} Merge conflict detected, skipping branch`, { branch });
                        deployment.processingLogs.push({
                            branch,
                            message: `Merge conflict detected - skipped`
                        });
                        continue;
                    }
                    throw new Error(pullResult.error);
                }

                // Check if pull actually made changes
                if (!pullResult.output.includes('Already up to date')) {
                    hasChanges = true;
                    deployment.processingLogs.push({
                        branch,
                        message: `Successfully merged`
                    });
                } else {
                    deployment.processingLogs.push({
                        branch,
                        message: `No changes to merge`
                    });
                }



                // Dedupe logs
                deployment.processingLogs = deployment.processingLogs.filter((log, index) => {
                    return deployment.processingLogs.findIndex(l => l.branch === log.branch) === index;
                });

                deployment.processedBranches = deployment.processedBranches || [];
                deployment.processedBranches.push(branch);
                deployment.processedBranches = [...new Set(deployment.processedBranches)];

                await setDataPushUpdateIfExists('deployments', {
                    ...deployment
                }, (item) => item.id === deployment.id);

            } catch (err) {
                console.log(`src/gitlab.js ${functionName} Error processing branch`, {
                    branch,
                    message: err.message,
                    stack: err.stack
                });

                deployment.processingBranchErrors = deployment.processingBranchErrors || [];
                deployment.processingBranchErrors.push({
                    branch,
                    message: err.message,
                    stack: err.stack
                });
                await setDataPushUpdateIfExists('deployments', {
                    ...deployment
                }, (item) => item.id === deployment.id);
                continue;
            }
        }

        //if approved and nextTag, try pushing preprod and tag
        if (deployment.approved === true && deployment.nextTag) {

            let tagResult = await git.createTag(repoPath, deployment.nextTag);

            if(tagResult.error){
                deployment.processingLogs = deployment.processingLogs || [];
                deployment.processingLogs.push({
                    branch: localPreprodBranch,
                    message: tagResult.message||tagResult.error,
                    stack: tagResult.error
                });
                await setDataPushUpdateIfExists('deployments', {
                    ...deployment,
                    deployed: false
                }, (item) => item.id === deployment.id);
                return
            }

            await git.pushBranchAndTag(repoPath, localPreprodBranch, deployment.nextTag)

            deployment.processingLogs.push({
                branch: localPreprodBranch,
                message: !!deployment.nextTag ? `Tagged as ${deployment.nextTag}` : 'No tag created'
            });
            deployment.deployed = true;
            await setDataPushUpdateIfExists('deployments', {
                ...deployment
            }, (item) => item.id === deployment.id);
        } else {

            // 3. Only calculate tag if changes were made
            if (!hasChanges) {
                console.log(`src/gitlab.js ${functionName} No changes made, skipping tag calculation`);
                return false;
            }

            // 4. Calculate next tag
            const prodTag = await git.getLatestTag(repoPath, PRODUCTION_BRANCH);
            const preprodTag = await git.getLatestTag(repoPath, PREPROD_BRANCH);
            const nextTag = calculateNextTag(prodTag, preprodTag);

            console.log(`src/gitlab.js ${functionName} Tag calculation complete`, {
                prodTag,
                preprodTag,
                nextTag
            });

            // 5. Output result and update deployment
            console.log(`Next tag would be ${nextTag}`);
            await setDataPushUpdateIfExists('deployments', {
                ...deployment,
                nextTag
            }, (item) => item.id === deployment.id);

        }

    } catch (err) {
        console.log(`src/gitlab.js ${functionName} Deployment processing failed`, {
            message: err.message,
            stack: err.stack
        });

        deployment.processingErrors = deployment.processingErrors || [];
        deployment.processingErrors.push({
            message: err.message,
            stack: err.stack
        });
        await setDataPushUpdateIfExists('deployments', {
            ...deployment
        }, (item) => item.id === deployment.id);
    } finally {
        await setDataPushUpdateIfExists('deployments', {
            processingBranchErrors: deployment.processingBranchErrors,
            processingLogs: deployment.processingLogs,
            updatedAt: new Date().toISOString()
        }, (item) => item.id === deployment.id);
    }
}

module.exports = {
    processDeployments
};
