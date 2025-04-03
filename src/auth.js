const { getData, persistAccessToken, persistRefreshToken } = require("./db");
const qs = require("querystring");
const PORT = process.env.PORT || 3000;
const axios = require("axios");

// Microsoft OAuth Config
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
const TENANT_ID = process.env.TENANT_ID;
const AUTH_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`;
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
const REQUIRED_SCOPES = "offline_access https://graph.microsoft.com/Chat.Read Chat.ReadBasic Chat.ReadWrite";

function configureAuthRoutes(app) {
    // Step 1: Redirect User to Microsoft Login
    app.get("/login", (req, res) => {
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            response_type: "code",
            redirect_uri: REDIRECT_URI,
            response_mode: "query",
            scope: REQUIRED_SCOPES,
        });

        res.redirect(`${AUTH_URL}?${params}`);
    });

    app.get("/logout", async (req, res) => {
        const accessToken = await getData('accessToken');
        if (accessToken) {
            try {
                // Revoke the access token
                await axios.post('https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/logout', {}, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                });
            } catch (error) {
                console.error('Error revoking access token:', error.response ? error.response.data : error.message);
            }
        }

        await setData('accessToken', null);
        await setData('refreshToken', null);

        res.redirect('/login');
    });

    // Step 2: Handle OAuth Callback
    app.get("/auth/callback", async (req, res) => {
        const code = req.query.code;

        if (!code) {
            return res.status(400).send("Authorization failed");
        }

        try {
            // Exchange code for access token
            const response = await axios.post(
                TOKEN_URL,
                qs.stringify({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: REDIRECT_URI,
                    scope: REQUIRED_SCOPES,
                }),
                { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
            );

            console.log(`auth callback response:`, {
                data: response.data
            });

            const { access_token } = response.data;
            const { refresh_token } = response.data;

            await persistAccessToken(access_token);
            await persistRefreshToken(refresh_token);

            console.log(`auth callback raw response:`, {
                data: response.data
            });

            res.redirect('/');
        } catch (error) {
            console.error("OAuth error:", error.response ? error.response.data : error.message);
            res.status(500).send("Authentication failed");
        }
    });
}

async function onInvalidToken() {
    console.warn("Invalid token detected. Attempting refresh or requiring re-login.");
    // Clear potentially invalid tokens
    // await setData('accessToken', null);
    // Consider clearing refresh token too if refresh fails repeatedly
    // await setData('refreshToken', null);

    // Attempt refresh silently first
    const refreshed = await refreshTokenIfAboutToExpire(await getData('accessToken'), await getData('refreshToken'), true);
    if (!refreshed) {
        console.error("Token refresh failed or not possible. User re-authentication required.");
        // Optionally, implement a mechanism to notify the frontend/user
    }
}

async function refreshTokenIfAboutToExpire(accessToken, refreshToken, force = false) {
    try {
        if (!accessToken || !refreshToken) {
            console.warn("No access token or refresh token found for refresh attempt.");
            return null;
        }

        let needsRefresh = force;
        if (!force) {
            // Decode the access token to get the expiration time
            const decodedToken = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
            const expirationTime = decodedToken.exp * 1000; // Convert to milliseconds
            const currentTime = Date.now();
            const bufferTime = 5 * 60 * 1000; // Refresh if within 5 minutes of expiry

            needsRefresh = (expirationTime - currentTime < bufferTime);
        }

        if (needsRefresh) {
            console.log(`Refreshing access token (Forced: ${force})...`);

            const response = await axios.post(TOKEN_URL,
                qs.stringify({
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                    scope: REQUIRED_SCOPES,
                }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                });

            const newAccessToken = response.data.access_token;
            const newRefreshToken = response.data.refresh_token || refreshToken;

            console.log('Token refreshed successfully.');
            await persistAccessToken(newAccessToken);
            await persistRefreshToken(newRefreshToken);

            return { accessToken: newAccessToken, refreshToken: newRefreshToken };
        } else {
            console.log('Access token is still valid, no refresh needed.');
            return { accessToken, refreshToken };
        }
    } catch (error) {
        console.error('Error refreshing token:', error.response ? error.response.data : error.message);
        return null;
    }
}

async function getAccessToken() {
    let accessToken = await getData('accessToken');
    let refreshToken = await getData('refreshToken');

    if (!accessToken || !refreshToken) {
        return null;
    }

    const refreshedTokens = await refreshTokenIfAboutToExpire(accessToken, refreshToken);

    return refreshedTokens ? refreshedTokens.accessToken : null;
}

module.exports = {
    refreshTokenIfAboutToExpire,
    onInvalidToken,
    configureAuthRoutes,
    getAccessToken
}