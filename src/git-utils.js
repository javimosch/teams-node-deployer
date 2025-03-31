const { execSync } = require('child_process');

async function executeGitCommand(repoPath, command) {
    const fileName = 'git-utils.js';
    const functionName = 'executeGitCommand';
    
    console.log(`${fileName} ${functionName} Executing git command`, { repoPath, command });
    
    try {
        const result = execSync(`cd ${repoPath} && git ${command}`, { 
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'] // Capture stderr
        });
        return { success: true, output: result };
    } catch (err) {
        console.log(`${fileName} ${functionName} Git command failed`, {
            message: err.message,
            stack: err.stack,
            stdout: err.stdout?.toString(),
            stderr: err.stderr?.toString()
        });
        return { 
            success: false,
            output: err.stdout?.toString() || '',
            error: err.stderr?.toString() || err.message
        };
    }
}

async function isBranchMerged(repoPath, branchName) {
    const result = await executeGitCommand(repoPath, `branch --merged`);
    return result.success && result.output.includes(branchName);
}

async function checkoutBranch(repoPath, branchName) {
    const fileName = 'git-utils.js';
    const functionName = 'checkoutBranch';
    
    console.log(`${fileName} ${functionName} Attempting to checkout branch`, { repoPath, branchName });
    
    const result = await executeGitCommand(repoPath, `checkout ${branchName}`);
    if (!result.success) {
        console.log(`${fileName} ${functionName} Checkout failed`, {
            repoPath,
            branchName,
            output: result.output,
            error: result.error
        });
        // Reset and retry if checkout failed
        await executeGitCommand(repoPath, `reset --hard HEAD`);
        const retryResult = await executeGitCommand(repoPath, `checkout ${branchName}`);
        return retryResult;
    }
    return result;
}

async function pullBranch(repoPath, branchName) {
    const fileName = 'git-utils.js';
    const functionName = 'pullBranch';
    
    console.log(`${fileName} ${functionName} Attempting to pull branch`, { repoPath, branchName });
    
    const result = await executeGitCommand(repoPath, `pull origin ${branchName}`);
    
    if (!result.success) {
        console.log(`${fileName} ${functionName} Pull failed`, {
            repoPath,
            branchName,
            output: result.output,
            error: result.error
        });
        
        if (result.error.includes('CONFLICT')||result.output.includes('CONFLICT')) {
            console.log(`${fileName} ${functionName} Merge conflict detected, attempting to abort`, { repoPath, branchName });
            // Abort merge on conflict
            const abortResult = await executeGitCommand(repoPath, `merge --abort`);
            if (!abortResult.success) {
                console.log(`${fileName} ${functionName} Merge abort failed`, {
                    repoPath,
                    branchName,
                    output: abortResult.output,
                    error: abortResult.error
                });
            }
            return { 
                success: false, 
                output: result.output,
                error: 'CONFLICT: Merge conflict detected - merge aborted'
            };
        }
    }
    return result;
}

/**
 * Resets the local repository to the current state of the remote preprod branch.
 * This is used to ensure that the local repository is up to date and to avoid merge conflicts.
 * @param {string} repoPath - The path to the local repository
 * @returns {Promise<{success: boolean, output: string, error: string}>}
 */
async function resetHard(repoPath, branchName) {
    const fileName = 'git-utils.js';
    const functionName = 'resetHard';
    
    console.log(`${fileName} ${functionName} Attempting to reset hard`, { repoPath, branchName });
    
    return executeGitCommand(repoPath, `reset --hard ${branchName}`);
}

async function getLatestTag(repoPath, ref) {
    const fileName = 'git-utils.js';
    const functionName = 'getLatestTag';
    
    console.log(`${fileName} ${functionName} Attempting to get latest tag`, { repoPath, ref });
    
    const result = await executeGitCommand(repoPath, `tag --merged ${ref} --sort=-creatordate | head -1`);
    return result.success ? result.output.trim() : null;
}

/**
 * Creates a new tag in the local repository.
 * @param {string} repoPath - The path to the local repository
 * @param {string} tag - The tag to create
 * @returns {Promise<{success: boolean, output: string, error: string}>}
 */
async function createTag(repoPath,tag){
    const fileName = 'git-utils.js';
    const functionName = 'createTag';
    
    console.log(`${fileName} ${functionName} Attempting to create tag`, { tag });
    
    return executeGitCommand(repoPath, `tag ${tag}`);
}

async function pushBranchAndTag(repoPath, branch,tag){
    const fileName = 'git-utils.js';
    const functionName = 'pushBranchAndTag';
    
    console.log(`${fileName} ${functionName} Attempting to push branch and tag`, { branch, tag });
    
    return executeGitCommand(repoPath, `push origin ${branch} ${tag}`);
}

async function branchExists(repoPath, branch){
    const result = await executeGitCommand(repoPath, `branch --all`);
    return result.success && result.output.includes(branch);
}

module.exports = {
    executeGitCommand,
    isBranchMerged,
    checkoutBranch,
    resetHard,
    pullBranch,
    getLatestTag,
    createTag,
    pushBranchAndTag,
    branchExists
};