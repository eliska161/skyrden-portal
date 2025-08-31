const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');
// Fix for node-fetch ESM issue - using axios instead
const axios = require('axios');
// Remove uuid dependency
// const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

// Environment configuration
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'skyrden-jwt-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

// Helper function to generate a random string (replacing uuid)
const generateRandomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = chars.length;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

// Debug middleware - log all requests
router.use((req, res, next) => {
  console.log(`Auth route accessed: ${req.method} ${req.path}`);
  console.log('Session ID:', req.sessionID);
  console.log('Is authenticated:', req.isAuthenticated ? req.isAuthenticated() : 'N/A');
  console.log('User in session:', req.session?.user ? 'Yes' : 'No');
  next();
});

// Auth status endpoint
router.get('/status', (req, res) => {
  console.log('Auth status check - Session ID:', req.sessionID);
  console.log('Session data:', req.session);
  
  if (req.session && req.session.user) {
    // If using custom sessions
    res.json({
      authenticated: true,
      user: req.session.user
    });
  } else if (req.isAuthenticated && req.isAuthenticated()) {
    // If using passport
    res.json({
      authenticated: true,
      user: req.user
    });
  } else {
    // Check for auth bypass header (for development)
    const bypassToken = req.headers['x-bypass-auth'];
    if (process.env.NODE_ENV !== 'production' && bypassToken && bypassToken.startsWith('dev_')) {
      console.log('Using development bypass token');
      res.json({
        authenticated: true,
        user: {
          discord_id: 'dev_' + Date.now(),
          discord_username: 'DevUser',
          roblox_username: null,
          is_admin: false
        }
      });
    } else {
      res.json({
        authenticated: false
      });
    }
  }
});

// Discord authentication
router.get('/discord', (req, res, next) => {
  // Store the original URL to redirect back after auth
  const originalUrl = req.query.redirect || CLIENT_URL;
  req.session.returnTo = originalUrl;
  
  console.log('Starting Discord auth, will return to:', originalUrl);
  
  passport.authenticate('discord', {
    scope: ['identify', 'email', 'guilds.join']
  })(req, res, next);
});

// Discord callback
router.get('/discord/callback', (req, res, next) => {
  console.log('Discord callback received');
  
  passport.authenticate('discord', async (err, user, info) => {
    if (err) {
      console.error('Discord auth error:', err);
      return res.redirect(`${CLIENT_URL}/?error=auth_failed`);
    }
    
    if (!user) {
      console.log('No user returned from Discord auth');
      return res.redirect(`${CLIENT_URL}/?error=no_user`);
    }
    
    try {
      console.log('Discord auth successful for user:', user.discord_username);
      
      // Login using passport
      req.login(user, async (err) => {
        if (err) {
          console.error('Session login error:', err);
          return res.redirect(`${CLIENT_URL}/?error=session_error`);
        }
        
        // Also store user in session directly for redundancy
        req.session.user = user;
        
        // Generate JWT for cross-domain auth
        const token = jwt.sign(
          { id: user.discord_id, username: user.discord_username },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRY }
        );
        
        console.log('Auth success, redirecting with token');
        
        // Redirect back to client with token
        const returnUrl = req.session.returnTo || CLIENT_URL;
        delete req.session.returnTo;
        
        // Set the token as a cookie for cross-domain use
        res.cookie('skyrden_auth', token, { 
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        return res.redirect(`${returnUrl}/?auth=success&token=${token}`);
      });
    } catch (error) {
      console.error('Error in Discord callback:', error);
      return res.redirect(`${CLIENT_URL}/?error=server_error`);
    }
  })(req, res, next);
});

// Roblox authentication
router.get('/roblox', (req, res) => {
  console.log('Roblox auth request, session:', req.session);
  console.log('Is authenticated:', req.isAuthenticated ? req.isAuthenticated() : 'N/A');
  
  // Check if the user is authenticated with Discord
  const isAuthenticated = (req.isAuthenticated && req.isAuthenticated()) || 
                         (req.session && req.session.user);
  
  // For development: allow bypass auth
  const bypassHeader = req.headers['x-bypass-auth'];
  const isDevelopmentBypass = process.env.NODE_ENV !== 'production' && 
                             bypassHeader && 
                             bypassHeader.startsWith('dev_');
  
  // Also check if token is provided in the URL for cross-domain auth
  const authToken = req.query.token;
  let tokenValid = false;
  
  if (authToken) {
    try {
      const decoded = jwt.verify(authToken, JWT_SECRET);
      if (decoded && decoded.id) {
        tokenValid = true;
      }
    } catch (e) {
      console.error('Invalid token:', e);
    }
  }
  
  if (isAuthenticated || isDevelopmentBypass || tokenValid) {
    // Generate a state param to verify the callback - using our helper instead of uuid
    const state = generateRandomString(32);
    req.session.robloxState = state;
    
    // Store user data if available
    if (req.user) {
      req.session.pendingRobloxLink = req.user.discord_id;
    } else if (req.session && req.session.user) {
      req.session.pendingRobloxLink = req.session.user.discord_id;
    } else if (tokenValid) {
      try {
        const decoded = jwt.verify(authToken, JWT_SECRET);
        req.session.pendingRobloxLink = decoded.id;
      } catch (e) {
        console.error('Token decode error:', e);
      }
    }
    
    // Redirect to Roblox OAuth
    const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${process.env.ROBLOX_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.API_URL + '/api/auth/roblox/callback')}&scope=openid+profile&state=${state}`;
    
    console.log('Redirecting to Roblox OAuth:', robloxAuthUrl);
    res.redirect(robloxAuthUrl);
  } else {
    console.log('Rejecting Roblox auth - no Discord account connected');
    res.redirect(`${CLIENT_URL}/?error=discord_first`);
  }
});

// Roblox callback
router.get('/roblox/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Verify state parameter to prevent CSRF
    if (!state || state !== req.session.robloxState) {
      console.error('Invalid state parameter');
      return res.redirect(`${CLIENT_URL}/?error=invalid_state`);
    }
    
    // Clear the state from session
    delete req.session.robloxState;
    
    if (!code) {
      console.error('No code provided in callback');
      return res.redirect(`${CLIENT_URL}/?error=no_code`);
    }
    
    // Exchange code for token using axios instead of node-fetch
    try {
      const authString = Buffer.from(`${process.env.ROBLOX_CLIENT_ID}:${process.env.ROBLOX_CLIENT_SECRET}`).toString('base64');
      
      const tokenResponse = await axios.post('https://apis.roblox.com/oauth/v1/token', 
        new URLSearchParams({
          'grant_type': 'authorization_code',
          'code': code,
          'redirect_uri': `${process.env.API_URL}/api/auth/roblox/callback`
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authString}`
          }
        }
      );
      
      const tokenData = tokenResponse.data;
      
      // Get user info using the access token
      const userInfoResponse = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });
      
      const userInfo = userInfoResponse.data;
      
      // Get Roblox username
      const headers = {};
      if (ROBLOX_API_KEY) {
        headers['x-api-key'] = ROBLOX_API_KEY;
      }
      
      const usernameResponse = await axios.get(`https://users.roblox.com/v1/users/${userInfo.sub}`, {
        headers
      });
      
      const usernameData = usernameResponse.data;
      const robloxUsername = usernameData.name;
      
      // Find the Discord user to update with Roblox info
      let discordId = null;
      
      // Check multiple possible sources for Discord ID
      if (req.session.pendingRobloxLink) {
        discordId = req.session.pendingRobloxLink;
      } else if (req.user) {
        discordId = req.user.discord_id;
      } else if (req.session.user) {
        discordId = req.session.user.discord_id;
      } else {
        console.error('No Discord user found to link Roblox account');
        return res.redirect(`${CLIENT_URL}/?error=no_discord_user_found`);
      }
      
      console.log(`Linking Roblox account ${robloxUsername} to Discord ID ${discordId}`);
      
      // Update the user in the database
      const updatedUser = await User.findOneAndUpdate(
        { discord_id: discordId },
        { 
          roblox_id: userInfo.sub,
          roblox_username: robloxUsername
        },
        { new: true }
      );
      
      if (!updatedUser) {
        console.error(`User with Discord ID ${discordId} not found in database`);
        return res.redirect(`${CLIENT_URL}/?error=user_not_found`);
      }
      
      // Update session
      if (req.session.user) {
        req.session.user = updatedUser;
      }
      
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        req.user = updatedUser;
      }
      
      // Clear pendingRobloxLink
      delete req.session.pendingRobloxLink;
      
      // Generate new JWT with updated user info
      const token = jwt.sign(
        { 
          id: updatedUser.discord_id, 
          username: updatedUser.discord_username,
          roblox: updatedUser.roblox_username 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      
      // Set updated token cookie
      res.cookie('skyrden_auth', token, { 
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      // Redirect back to client with success
      return res.redirect(`${CLIENT_URL}/?roblox_linked=true&username=${encodeURIComponent(robloxUsername)}&token=${token}`);
    
    } catch (error) {
      console.error('API request error:', error.response?.data || error.message);
      return res.redirect(`${CLIENT_URL}/?error=api_error`);
    }
    
  } catch (error) {
    console.error('Error in Roblox callback:', error);
    return res.redirect(`${CLIENT_URL}/?error=server_error`);
  }
});

// Admin authentication (only accessible by users with admin rights)
router.get('/admin', async (req, res) => {
  // Check if the user is authenticated
  const isAuthenticated = (req.isAuthenticated && req.isAuthenticated()) || 
                         (req.session && req.session.user);
                         
  if (!isAuthenticated) {
    // Redirect to Discord auth first
    return res.redirect('/api/auth/discord?redirect=/api/auth/admin');
  }
  
  const user = req.user || req.session.user;
  
  // Check if the user is already an admin
  if (user && user.is_admin) {
    return res.redirect(`${CLIENT_URL}/admin`);
  }
  
  try {
    // Get the user's Discord ID
    const discordId = user.discord_id;
    
    // Check if the user's Discord ID is in the admin list
    // This is a placeholder - implement your actual admin verification logic here
    const adminIds = process.env.ADMIN_DISCORD_IDS ? process.env.ADMIN_DISCORD_IDS.split(',') : [];
    const isAdmin = adminIds.includes(discordId);
    
    if (isAdmin) {
      // Update user as admin
      const updatedUser = await User.findOneAndUpdate(
        { discord_id: discordId },
        { is_admin: true },
        { new: true }
      );
      
      // Update session
      if (req.session.user) {
        req.session.user = updatedUser;
      }
      
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        req.user = updatedUser;
      }
      
      // Generate new JWT with admin flag
      const token = jwt.sign(
        { 
          id: updatedUser.discord_id, 
          username: updatedUser.discord_username,
          roblox: updatedUser.roblox_username,
          is_admin: true
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      
      // Set updated token cookie
      res.cookie('skyrden_auth', token, { 
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      return res.redirect(`${CLIENT_URL}/admin`);
    } else {
      return res.redirect(`${CLIENT_URL}/?error=not_admin`);
    }
  } catch (error) {
    console.error('Error in admin auth:', error);
    return res.redirect(`${CLIENT_URL}/?error=server_error`);
  }
});

// JWT Verification endpoint
router.post('/verify-token', (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(401).json({ authenticated: false, message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Find the user in the database
    User.findOne({ discord_id: decoded.id })
      .then(user => {
        if (!user) {
          return res.status(404).json({ authenticated: false, message: 'User not found' });
        }
        
        // Update session
        if (req.session) {
          req.session.user = user;
        }
        
        res.json({ 
          authenticated: true, 
          user
        });
      })
      .catch(err => {
        console.error('Database error:', err);
        res.status(500).json({ authenticated: false, message: 'Server error' });
      });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ authenticated: false, message: 'Invalid token' });
  }
});

// Token-based login for cross-domain auth
router.post('/token-login', (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(401).json({ authenticated: false, message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Find the user in the database
    User.findOne({ discord_id: decoded.id })
      .then(user => {
        if (!user) {
          return res.status(404).json({ authenticated: false, message: 'User not found' });
        }
        
        // Set user in session
        if (req.session) {
          req.session.user = user;
        }
        
        // Login with passport if available
        if (req.login) {
          req.login(user, err => {
            if (err) {
              console.error('Session login error:', err);
            }
          });
        }
        
        // Refresh the token
        const newToken = jwt.sign(
          { 
            id: user.discord_id, 
            username: user.discord_username,
            roblox: user.roblox_username,
            is_admin: user.is_admin 
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRY }
        );
        
        // Set token cookie
        res.cookie('skyrden_auth', newToken, { 
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        res.json({ 
          authenticated: true, 
          user,
          token: newToken
        });
      })
      .catch(err => {
        console.error('Database error:', err);
        res.status(500).json({ authenticated: false, message: 'Server error' });
      });
  } catch (error) {
    // For development: if token starts with 'dev_', accept it as valid
    if (process.env.NODE_ENV !== 'production' && token.startsWith('dev_')) {
      console.log('Using development token');
      
      // Create a temporary user object
      const devUser = {
        discord_id: token,
        discord_username: 'DevUser',
        roblox_username: null,
        is_admin: false
      };
      
      // Set user in session
      if (req.session) {
        req.session.user = devUser;
      }
      
      return res.json({
        authenticated: true,
        user: devUser
      });
    }
    
    console.error('Token verification error:', error);
    res.status(401).json({ authenticated: false, message: 'Invalid token' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  console.log('Logout requested');
  
  // Clear session
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        console.error('Error destroying session:', err);
      }
    });
  }
  
  // Clear passport login
  if (req.logout) {
    req.logout(err => {
      if (err) {
        console.error('Error logging out with passport:', err);
      }
    });
  }
  
  // Clear auth cookie
  res.clearCookie('skyrden_auth');
  
  res.json({ success: true, message: 'Logged out successfully' });
});

// Development endpoints (only available in non-production)
if (process.env.NODE_ENV !== 'production') {
  // Generate development token
  router.post('/dev-token', (req, res) => {
    const { username } = req.body;
    
    const devToken = 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2);
    
    // Create a temporary user
    const devUser = {
      discord_id: devToken,
      discord_username: username || 'DevUser',
      roblox_username: null,
      is_admin: false
    };
    
    // Store in session for testing
    if (req.session) {
      req.session.user = devUser;
    }
    
    res.json({
      success: true,
      token: devToken,
      user: devUser
    });
  });
  
  // Debug session endpoint
  router.get('/debug-session', (req, res) => {
    res.json({
      sessionID: req.sessionID,
      session: req.session,
      user: req.user,
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : 'N/A',
      cookies: req.cookies
    });
  });
}

module.exports = router;