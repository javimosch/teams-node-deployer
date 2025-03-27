const { spawn } = require('child_process');
const path = require('path');

async function executeGitCommand(cwd, args) {
    return new Promise((resolve, reject) => {
        const gitProcess = spawn('git', args, {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
        });

        let stdoutData = '';
        let stderrData = '';

        gitProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        gitProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        gitProcess.on('close', (code) => {
            if (code === 0) {
                resolve(stdoutData.trim());
            } else {
                reject(new Error(`Git command failed with code ${code}\nCommand: git ${args.join(' ')}\nStderr: ${stderrData}`));
            }
        });

        gitProcess.on('error', (err) => {
            reject(err);
        });
    });
}

async function checkoutBranch(cwd, branch) {
    return executeGitCommand(cwd, ['checkout', branch]);
}

async function resetHard(cwd, branch = 'origin/preprod') {
    return executeGitCommand(cwd, ['reset', '--hard', branch]);
}

async function pullBranch(cwd, branch) {
    return executeGitCommand(cwd, ['pull', 'origin', branch]);
}

async function getLatestTag(cwd, branch) {
    return executeGitCommand(cwd, ['tag', '--merged', branch, '--sort=-creatordate'])
        .then(output => output.split('\n')[0] || '');
}

module.exports = {
    executeGitCommand,
    checkoutBranch,
    resetHard,
    pullBranch,
    getLatestTag
};