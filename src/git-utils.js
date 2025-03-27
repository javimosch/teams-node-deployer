const { execSync } = require('child_process');

async function executeGitCommand(repoPath, command) {
    try {
        return execSync(`cd ${repoPath} && git ${command}`, { encoding: 'utf-8' });
    } catch (err) {
        console.error('Git command failed:', { command, error: err.message });
        throw err;
    }
}

async function isBranchMerged(repoPath, branchName) {
    try {
        const result = await executeGitCommand(repoPath, `branch --merged preprod`);
        return result.includes(branchName);
    } catch (err) {
        console.error('Failed to check merged branches:', {
            branchName,
            error: err.message
        });
        return false;
    }
}

async function checkoutBranch(repoPath, branchName) {
    return executeGitCommand(repoPath, `checkout ${branchName}`);
}

async function resetHard(repoPath) {
    return executeGitCommand(repoPath, `reset --hard origin/preprod`);
}

async function pullBranch(repoPath, branchName) {
    return executeGitCommand(repoPath, `pull origin ${branchName}`);
}

async function getLatestTag(repoPath, ref) {
    try {
        return (await executeGitCommand(repoPath, `tag --merged ${ref} --sort=-creatordate | head -1`)).trim();
    } catch (err) {
        console.error('Failed to get latest tag:', { ref, error: err.message });
        return null;
    }
}

module.exports = {
    executeGitCommand,
    isBranchMerged,
    checkoutBranch,
    resetHard,
    pullBranch,
    getLatestTag
};