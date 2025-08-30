const express = require('express');
const passport = require('passport');
const axios = require('axios');
const router = express.Router();

// Import mongoose models
const User = require('../models/User');
const AdminWhitelist = require('../models/AdminWhitelist');

// Auth status route
router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: req.user
    });
  } else {
    res.json({
      authenticated: false
    });
  }
});

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
      res.redirect(`${process.env.CLIENT_URL}/?auth=success`);
    }
  }
);

// Roblox authentication
router.get('/roblox', (req, res) => {
  console.log('Roblox auth endpoint hit');
  
  if (!req.isAuthenticated()) {
    console.log('User not authenticated, redirecting');
    return res.redirect(`${process.env.CLIENT_URL}/?error=discord_first`);
  }
  
  console.log('User authenticated, starting Roblox OAuth');
  
  // Use the manual Roblox OAuth URL
  const clientId = process.env.ROBLOX_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.ROBLOX_CALLBACK_URL);
  const scope = encodeURIComponent('openid profile');
  
  const authUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  res.redirect(authUrl);
});

// Roblox callback - MANUAL IMPLEMENTATION
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
    const tokenResponse = await axios.post('https://apis.roblox.com/oauth/v1/token', 
      new URLSearchParams({
        client_id: process.env.ROBLOX_CLIENT_ID,
        client_secret: process.env.ROBLOX_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.ROBLOX_CALLBACK_URL
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;
    
    // Get user information
    const userResponse = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const robloxUserInfo = userResponse.data;
    
    // Update user with Roblox information
    await User.findByIdAndUpdate(req.user._id, {
      roblox_id: robloxUserInfo.sub,
      roblox_username: robloxUserInfo.preferred_username || robloxUserInfo.name,
      roblox_access_token: accessToken
    });
    
    console.log('Roblox account linked:', robloxUserInfo.preferred_username || robloxUserInfo.name);
    
    res.redirect(`${process.env.CLIENT_URL}/?roblox_linked=true&username=${encodeURIComponent(robloxUserInfo.preferred_username || robloxUserInfo.name)}`);
    
  } catch (error) {
    console.error('Error linking Roblox account:', error.response?.data || error.message);
    res.redirect(`${process.env.CLIENT_URL}/?error=roblox_linking_failed`);
  }
});

// Logout route
router.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { 
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.redirect(`${process.env.CLIENT_URL}/?logged_out=true`);
  });
});

// Login failed route
router.get('/login-failed', (req, res) => {
  res.redirect(`${process.env.CLIENT_URL}/?error=auth_failed`);
});

module.exports = router;