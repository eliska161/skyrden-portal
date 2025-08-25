const axios = require('axios');
const db = require('../database/db');

class RobloxAuth {
    static getAuthUrl() {
        const clientId = process.env.ROBLOX_CLIENT_ID;
        const redirectUri = encodeURIComponent(process.env.ROBLOX_CALLBACK_URL);
        const scope = encodeURIComponent('openid profile');
        
        return `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    }

    static async exchangeCodeForToken(code) {
        try {
            const response = await axios.post('https://apis.roblox.com/oauth/v1/token', {
                client_id: process.env.ROBLOX_CLIENT_ID,
                client_secret: process.env.ROBLOX_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.ROBLOX_CALLBACK_URL
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Token exchange error:', error.response?.data || error.message);
            throw error;
        }
    }

    static async getUserInfo(accessToken) {
        try {
            const response = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            console.error('User info error:', error.response?.data || error.message);
            throw error;
        }
    }

    static async saveRobloxUser(discordUserId, robloxUserInfo, accessToken) {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET roblox_id = ?, roblox_username = ?, roblox_access_token = ? WHERE id = ?',
                [robloxUserInfo.sub, robloxUserInfo.preferred_username || robloxUserInfo.name, accessToken, discordUserId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }
}

module.exports = RobloxAuth;