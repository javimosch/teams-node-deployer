const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { getData, setDataPushUpdateIfExists, setData } = require("./db");
const connectorService = require('./services/connector-service');

/**
 * Ensures that the cloned repository is configured to use fast-forward merges.
 * This is necessary because some GitLab repositories may have merge commits that
 * are not fast-forward, which can cause issues during deployment.
 * @param {Function} runGitConfig - Function to run git config commands sequentially
 */
async function ensureRepoIsConfigured(runGitConfig) {
    const fileName = 'git-utils.js';
    const functionName = 'ensureRepoIsConfigured';
    try {
        await runGitConfig(['config', '--global', 'pull.rebase', 'false']);
        await runGitConfig(['config', '--global', 'pull.ff', 'true']);
        await runGitConfig(['config', '--global', 'user.email', process.env.GITLAB_USER_EMAIL]);
        await runGitConfig(['config', '--global', 'user.name', process.env.GITLAB_USER_NAME]);
        console.log(`${fileName} ${functionName} Git configurations completed`);
    } catch (err) {
        console.error(`${fileName} ${functionName} Error during git configuration`, { message: err.message, stack: err.stack });
    }
}

/**
 * Clone repository using a specific connector
 * @param {String} repoName Repository name to clone
 * @param {String} connectorId Connector ID to use for cloning (optional - uses first active if not provided)
 * @returns {String} Path to cloned repository
 */
async function cloneRepo(repoName, connectorId) {
    const functionName = 'cloneRepo';

    // If no repoName provided, use GITLAB_REPO_NAME from env
    if (!repoName) {
        repoName = process.env.GITLAB_REPO_NAME;
        if (!repoName) {
            console.log(`src/gitlab.clone.js ${functionName} No repository name provided`, {});
            throw new Error('Repository name not provided and GITLAB_REPO_NAME not found in environment');
        }
    }

    // Get the connector to use
    let connector;

    if (connectorId) {
        // Use specific connector if ID provided
        connector = await connectorService.getConnectorById(connectorId);
        if (!connector) {
            console.log(`src/gitlab.clone.js ${functionName} Connector not found`, { connectorId });
            throw new Error(`Connector with ID ${connectorId} not found`);
        }
    } else {
        // Use first active connector if no ID provided
        const activeConnectors = await connectorService.getActiveConnectors();
        if (activeConnectors.length === 0) {
            // Fallback to env variables if no connectors configured
            if (process.env.GITLAB_ACCESS_TOKEN && process.env.GITLAB_BASE_URL) {
                connector = {
                    type: 'gitlab',
                    url: process.env.GITLAB_BASE_URL,
                    accessToken: process.env.GITLAB_ACCESS_TOKEN
                };
            } else {
                console.log(`src/gitlab.clone.js ${functionName} No active connectors found`, {});
                throw new Error('No active git connectors found');
            }
        } else {
            connector = activeConnectors[0];
        }
    }

    console.log(`src/gitlab.clone.js ${functionName} Using connector`, {
        connectorType: connector.type,
        connectorUrl: connector.url,
        connectorName: connector.name
    });

    try {
        console.log(`src/gitlab.clone.js ${functionName} Starting repository clone`);

        const repoDetails = await getRepoDetailsByName(repoName, connector);
        if (!repoDetails) {
            console.log(`src/gitlab.clone.js ${functionName} getRepoDetailsByName failed`, { name: repoName });
            return;
        }
        console.log(`src/gitlab.clone.js ${functionName} Retrieved repo details`);

        const accessToken = connector.accessToken;

        // Construct authenticated URL: https://oauth2:<token>@hostname/path.git
        const url = new URL(repoDetails.http_url_to_repo);
        const authenticatedUrl = `${url.protocol}//oauth2:${accessToken}@${url.host}${url.pathname}`;
        // Use OS temp directory as base
        const timestamp = Date.now();

        const tmpDir = path.join(process.cwd(), 'tmp');

        const targetDir = path.join(tmpDir, repoDetails.path);

        // Function to run git config commands sequentially
        const runGitConfig = async (configArgs) => {
            return new Promise((resolve, reject) => {
                console.log(`src/gitlab.js ${functionName} Running git config`, { configArgs });
                const gitConfigProcess = spawn('git', configArgs, {
                    cwd: targetDir,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
                });

                let stdoutData = '';
                let stderrData = '';

                gitConfigProcess.stdout.on('data', (data) => {
                    stdoutData += data;
                    console.log(`src/gitlab.js ${functionName} Git config stdout:`, data.toString());
                });

                gitConfigProcess.stderr.on('data', (data) => {
                    stderrData += data;
                    console.log(`src/gitlab.js ${functionName} Git config stderr:`, data.toString());
                });

                gitConfigProcess.on('error', (err) => {
                    console.log(`src/gitlab.js ${functionName} Git config process error:`, { message: err.message, stack: err.stack });
                    reject(err);
                });

                gitConfigProcess.on('close', (code) => {
                    if (code === 0) {
                        console.log(`src/gitlab.js ${functionName} Git config completed successfully`);
                        resolve();
                    } else {
                        console.log(`src/gitlab.js ${functionName} Git config failed with code ${code}`, { stdout: stdoutData, stderr: stderrData });
                        // Don't reject here as the clone was successful
                        resolve();
                    }
                });
            });
        };

        try {
            const stats = await fs.stat(targetDir);
            if (stats) {
                console.log(`src/gitlab.js ${functionName} Target directory already exists`, { targetDir });
                await ensureRepoIsConfigured(runGitConfig);
                return targetDir;
            }
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        const gitTempDir = path.join(os.tmpdir(), `git-clone-${timestamp}`);

        console.log(`src/gitlab.js ${functionName} Preparing directories`, { tmpDir, targetDir, gitTempDir });

        // Create directories sequentially with proper permissions
        const createDir = async (dir) => {
            try {
                await fs.mkdir(dir, { recursive: true, mode: 0o755 });
                // Verify directory exists and is writable
                await fs.access(dir, fs.constants.W_OK);
                console.log(`src/gitlab.js ${functionName} Directory created and writable`, { dir });
            } catch (err) {
                if (err.code !== 'EEXIST') {
                    console.log(`src/gitlab.js ${functionName} Failed to create/verify directory`, { dir, error: err.message });
                    throw err;
                }
            }
        };

        // Create directories in sequence
        await createDir(tmpDir);
        await createDir(gitTempDir);

        // Clone with specific git config and temporary directory settings
        console.log(`src/gitlab.js ${functionName} Executing git clone command`);

        const gitArgs = [
            //'-c', 'core.trustctime=false',
            //'-c', 'core.checkstat=minimal',
            //'-c', 'core.quotepath=false',
            //'-c', 'core.precomposeunicode=false',
            //'-c', `core.tmpdir=${gitTempDir}`,
            //'-c', 'core.autocrlf=false',
            'clone',
            //'--depth', '1',
            //'--no-tags',
            authenticatedUrl,
            targetDir
        ];

        // Use spawn for better process control
        await new Promise((resolve, reject) => {
            const gitProcess = spawn('git', gitArgs, {
                stdio: ['ignore', 'pipe', 'pipe'],
                env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
            });

            let stdoutData = '';
            let stderrData = '';

            gitProcess.stdout.on('data', (data) => {
                stdoutData += data;
                console.log(`src/gitlab.js ${functionName} Git clone stdout:`, data.toString());
            });

            gitProcess.stderr.on('data', (data) => {
                stderrData += data;
                console.log(`src/gitlab.js ${functionName} Git clone stderr:`, data.toString());
            });

            gitProcess.on('error', (err) => {
                console.log(`src/gitlab.js ${functionName} Git process error:`, err);
                reject(err);
            });

            gitProcess.on('close', (code) => {
                if (code === 0) {
                    console.log(`src/gitlab.js ${functionName} Git clone completed successfully`);
                    resolve();
                } else {
                    reject(new Error(`Git clone failed with code ${code}\nStdout: ${stdoutData}\nStderr: ${stderrData}`));
                }
            });
        });

        // Verify the clone was successful
        const gitDirExists = await fs.access(path.join(targetDir, '.git'))
            .then(() => true)
            .catch(() => false);

        if (!gitDirExists) {
            throw new Error('Git directory not found after clone - possible incomplete clone');
        }

        // Configure git pull settings to avoid divergent branches errors
        console.log(`src/gitlab.js ${functionName} Configuring git pull settings`, { targetDir });



        await ensureRepoIsConfigured(runGitConfig);

        // Wait before cleanup to ensure git has finished with temp files
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Clean up temporary directories
        /*   for (const dir of [gitTempDir]) {
              try {
                  await fs.rm(dir, { recursive: true, force: true });
                  console.log(`src/gitlab.js ${functionName} Cleaned up directory`, { dir });
              } catch (err) {
                  console.log(`src/gitlab.js ${functionName} Failed to clean up directory`, {
                      dir,
                      message: err.message
                  });
                  // Don't throw here as the clone was successful
              }
          } */

        console.log(`src/gitlab.js ${functionName} Repository cloned successfully`, { targetDir });
        return targetDir;

    } catch (err) {
        console.log(`src/gitlab.js ${functionName} Cloning repository failed`, {
            message: err.message,
            stack: err.stack,
            axiosResponse: err.isAxiosError ? err.response?.data : undefined
        });
        throw err; // Re-throw to allow caller to handle the error
    }
}


/**
 * Get repository details by name using a specific connector
 * @param {String} name Repository name
 * @param {Object} connector Git connector to use
 * @returns {Object} Repository details
 */
async function getRepoDetailsByName(name, connector) {
    const functionName = 'getRepoDetailsByName';
    const tryDescription = 'Fetching repo details from Git API';
    try {
        // Only support GitLab for now
        if (connector.type !== 'gitlab') {
            console.log(`src/gitlab.clone.js ${functionName} Unsupported connector type`, { type: connector.type });
            throw new Error(`Unsupported connector type: ${connector.type}`);
        }

        // Create a cache key based on connector and repo name to avoid conflicts
        const cacheKey = `repoDetails_${connector.id || 'default'}_${name}`;

        console.log(`src/gitlab.clone.js ${functionName} Checking cache for repo details`, { name, cacheKey });
        let repoDetails = (await getData(cacheKey)) || null;
        if (repoDetails && repoDetails.path === name) { // Ensure cached details match requested name
            console.log(`src/gitlab.clone.js ${functionName} Found repo details in cache`);
            return repoDetails;
        }
        console.log(`src/gitlab.clone.js ${functionName} Repo details not in cache or mismatch, fetching from API`, { name });

        let accessToken = connector.accessToken;
        if (!accessToken) {
            console.log(`src/gitlab.clone.js ${functionName} No access token in connector`);
            return null;
        }

        let page = 1;
        let projects = [];
        let foundProject = null;

        console.log(`src/gitlab.js ${functionName} Starting API pagination`, { name });
        while (true) {
            const apiUrl = `${connector.url}/api/v4/projects?search=${encodeURIComponent(name)}&per_page=100&page=${page}`;
            console.log(`src/gitlab.clone.js ${functionName} Fetching page`, { apiUrl });
            const response = await axios.get(apiUrl, {
                headers: {
                    'Private-Token': accessToken
                }
            });
            const pageProjects = response.data;
            console.log(`src/gitlab.clone.js ${functionName} Received projects`, { count: pageProjects.length, page });

            // Find the exact match by path
            foundProject = pageProjects.find(p => p.path === name);
            if (foundProject) {
                console.log(`src/gitlab.clone.js ${functionName} Found exact match`, { foundProject });
                break;
            }

            projects = projects.concat(pageProjects); // Keep collecting in case we need it later, though search should be efficient

            // Check if it was the last page
            const nextPageHeader = response.headers['x-next-page'];
            if (!nextPageHeader || nextPageHeader === '') {
                console.log(`src/gitlab.clone.js ${functionName} Reached last page`, { page });
                break;
            }

            page = parseInt(nextPageHeader, 10);
            console.log(`src/gitlab.clone.js ${functionName} Moving to next page`, { page });
        }

        if (foundProject) {
            console.log(`src/gitlab.clone.js ${functionName} Caching found project details`, { foundProject });
            // Cache with the connector-specific key
            await setData(cacheKey, foundProject);
        } else {
            console.log(`src/gitlab.clone.js ${functionName} Project not found after pagination`, { name });
        }

        return foundProject || null; // Return the found project or null

    } catch (err) {
        const axiosResponse = err.isAxiosError ? err.response : null;
        console.log(`src/gitlab.clone.js ${functionName} ${tryDescription} failed`, { message: err.message, stack: err.stack, axiosResponseData: axiosResponse?.data });
        return null; // Return null on error
    }
}

module.exports = {
    cloneRepo,
    getRepoDetailsByName
}
