const express = require('express');
const passport = require('passport');
const db = require('../database/db');
const router = express.Router();

// Admin login route - redirects to Discord auth but preserves admin intent
router.get('/admin', (req, res) => {
    // Store that this is an admin login attempt in session
    req.session.adminLogin = true;
    console.log('Admin login attempt initiated');
    res.redirect('/api/auth/discord');
});

// Discord authentication
router.get('/discord', (req, res, next) => {
    console.log('Discord auth started');
    passport.authenticate('discord')(req, res, next);
});

// Discord callback with admin login handling
router.get('/discord/callback', 
    passport.authenticate('discord', { failureRedirect: '/api/auth/login-failed' }),
    (req, res) => {
        console.log('Discord auth successful, checking admin status');
        
        // Check if this was an admin login attempt
        if (req.session.adminLogin) {
            delete req.session.adminLogin; // Clean up
            console.log('Admin login attempt completed for user:', req.user.discord_username);
            
            if (req.user.is_admin) {
                console.log('User is admin, redirecting to admin panel');
                res.redirect(`${process.env.CLIENT_URL}/admin`);
            } else {
                console.log('User is not admin, redirecting with error');
                res.redirect(`${process.env.CLIENT_URL}/?error=not_admin`);
            }
        } else {
            console.log('Regular login, redirecting to home');
            res.redirect(process.env.CLIENT_URL);
        }
    }
);

// Roblox authentication
router.get('/roblox', (req, res, next) => {
    console.log('Roblox auth endpoint hit');
    
    if (!req.isAuthenticated()) {
        console.log('User not authenticated, redirecting');
        return res.redirect(`${process.env.CLIENT_URL}/?error=discord_first`);
    }
    
    console.log('User authenticated, starting Roblox OAuth');
    
    // Use the manual Roblox OAuth URL since we removed passport-roblox
    const clientId = process.env.ROBLOX_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.ROBLOX_CALLBACK_URL);
    const scope = encodeURIComponent('openid profile');
    
    const authUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    res.redirect(authUrl);
});

// Roblox callback - MANUAL IMPLEMENTATION (since we removed passport-roblox)
const axios = require('axios');

router.get('/roblox/callback', async (req, res) => {
    console.log('Roblox callback received');
    
    if (!req.isAuthenticated()) {
        return res.redirect(`${process.env.CLIENT_URL}/?error=discord_first`);
    }

    const { code, error } = req.query;

    if (error) {
        console.error('Roblox OAuth error:', error);
        return res.redirect(`${process.env.CLIENT_URL}/?error=roblox_oauth_failed&message=${error}`);
    }

    if (!code) {
        console.error('No authorization code received');
        return res.redirect(`${process.env.CLIENT_URL}/?error=no_code`);
    }

    try {
        console.log('Exchanging code for tokens...');
        
        // Exchange code for tokens
        const tokenResponse = await axios.post('https://apis.roblox.com/oauth/v1/token', new URLSearchParams({
            client_id: process.env.ROBLOX_CLIENT_ID,
            client_secret: process.env.ROBLOX_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.ROBLOX_CALLBACK_URL
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const tokens = tokenResponse.data;
        console.log('Tokens received, getting user info...');

        // Get user info
        const userInfoResponse = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Content-Type': 'application/json'
            }
        });

        const userInfo = userInfoResponse.data;
        console.log('User info received:', userInfo);

        // Extract username
        const robloxUsername = userInfo.preferred_username || userInfo.name || `User_${userInfo.sub}`;
        console.log('Roblox username:', robloxUsername);

        // Save to database
        db.run(
            'UPDATE users SET roblox_id = ?, roblox_username = ? WHERE id = ?',
            [userInfo.sub, robloxUsername, req.user.id],
            function(err) {
                if (err) {
                    console.error('Database update error:', err);
                    return res.redirect(`${process.env.CLIENT_URL}/?error=database_error`);
                }
                
                console.log('Roblox data saved for user ID:', req.user.id);
                
                // Refresh user session with updated data
                db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, updatedUser) => {
                    if (err) {
                        console.error('Error fetching updated user:', err);
                        return res.redirect(`${process.env.CLIENT_URL}/?roblox_linked=true&username=${encodeURIComponent(robloxUsername)}`);
                    }
                    
                    req.login(updatedUser, (loginErr) => {
                        if (loginErr) {
                            console.error('Session update error:', loginErr);
                        }
                        res.redirect(`${process.env.CLIENT_URL}/?roblox_linked=true&username=${encodeURIComponent(robloxUsername)}`);
                    });
                });
            }
        );

    } catch (err) {
        console.error('Roblox auth failed:', err.response?.data || err.message);
        
        if (err.response) {
            console.error('Response status:', err.response.status);
            console.error('Response data:', err.response.data);
        }
        
        res.redirect(`${process.env.CLIENT_URL}/?error=roblox_auth_failed`);
    }
});

// Auth status check
router.get('/status', (req, res) => {
    res.json({ 
        authenticated: req.isAuthenticated(),
        user: req.user || null
    });
});

// Logout route
router.get('/logout', (req, res) => {
    req.logout(() => {
        // Clear the session cookie to ensure complete logout
        res.clearCookie('connect.sid', {
            path: '/',
            httpOnly: true,
            secure: false
        });
        
        res.json({ 
            success: true, 
            message: 'Logged out successfully' 
        });
    });
});

// Get current user info
router.get('/me', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json(req.user);
});

// Add a root route for /api/auth
router.get('/', (req, res) => {
    res.json({
        message: 'Skyrden Auth API',
        endpoints: {
            discord: '/discord',
            roblox: '/roblox',
            admin: '/admin',
            status: '/status',
            logout: '/logout',
            me: '/me'
        }
    });
});

// Debug route to check session data
router.get('/debug/session', (req, res) => {
    res.json({
        session: req.session,
        user: req.user,
        authenticated: req.isAuthenticated()
    });
});

// Debug route to check database users
router.get('/debug/users', (req, res) => {
    db.all('SELECT * FROM users', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Get current user's Discord ID
router.get('/debug/my-info', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    res.json({
        your_discord_id: req.user.discord_id,
        your_username: req.user.discord_username,
        is_admin: req.user.is_admin,
        message: 'Copy the discord_id and use it in the add-admin script'
    });
});

// Simple login failed page for testing
router.get('/login-failed', (req, res) => {
    res.json({ error: 'Authentication failed' });
});

module.exports = router;