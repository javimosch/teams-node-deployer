const { getData, setData, setDataPushIfNotExists, pruneDupes, persistAccessToken, persistRefreshToken } = require("./db");
const qs = require("querystring");
const PORT = process.env.PORT || 3000;

// Microsoft OAuth Config
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:${PORT}/auth/callback`;
const TENANT_ID = process.env.TENANT_ID;
const AUTH_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`;
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

function configureAuthRoutes(app) {
    // Step 1: Redirect User to Microsoft Login
    app.get("/login", (req, res) => {
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            response_type: "code",
            redirect_uri: REDIRECT_URI,
            response_mode: "query",
            scope: "offline_access https://graph.microsoft.com/Chat.Read",
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
                    scope: "https://graph.microsoft.com/Chat.Read",
                }),
                { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
            );

            const { access_token } = response.data;
            const { refresh_token } = response.data;

            persistAccessToken(access_token);
            persistRefreshToken(refresh_token);

            console.log(`auth callback raw response:`, {
                data: response.data
            });

            res.send(`Access Token: ${access_token}`);
        } catch (error) {
            console.error("OAuth error:", error.response.data);
            res.status(500).send("Authentication failed");
        }
    });


    

}

module.exports = {
    refreshTokenIfAboutToExpire,
    configureAuthRoutes
}

async function refreshTokenIfAboutToExpire(accessToken, refreshToken) {
    try {
        // Decode the access token to get the expiration time
        const decodedToken = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
        const expirationTime = decodedToken.exp * 1000;  // Convert to milliseconds
        const currentTime = Date.now();

        // If the token will expire in less than an 30min, refresh it
        if (expirationTime - currentTime < 30 * 60 * 1000) {
            console.log('Access token is about to expire, refreshing...');

            const response = await axios.post(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, {
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
                scope: 'offline_access https://graph.microsoft.com/.default',
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded', // Ensure the body is encoded as x-www-form-urlencoded
                }
            });

            const newAccessToken = response.data.access_token;
            const newRefreshToken = response.data.refresh_token; // May be returned

            console.log('New access token:', newAccessToken.slice(0, 10));
            await persistAccessToken(newAccessToken);
            await persistRefreshToken(newRefreshToken);

            return { newAccessToken, newRefreshToken };
        } else {
            console.log('Access token is still valid.');
            return { accessToken, refreshToken }; // No need to refresh
        }
    } catch (error) {
        console.error('Error refreshing token:', error.response ? error.response.data : error.message);
        return null;
    }
}