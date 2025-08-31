const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Environment configuration
const CLIENT_URL = process.env.CLIENT_URL || 'https://skyrden-portal.netlify.app';
const API_URL = process.env.API_URL || 'https://skd-portal.up.railway.app';
const JWT_SECRET = process.env.JWT_SECRET || 'skyrden-jwt-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const ROBLOX_CLIENT_ID = process.env.ROBLOX_CLIENT_ID;
const ROBLOX_CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

// Enable verbose debugging
const DEBUG = true;

// Helper function to generate a random string
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};

// Helper function to generate HMAC for state validation
const generateHmac = (data, secret) => {
  return crypto.createHmac('sha256', secret)
    .update(data)
    .digest('base64');
};

// Enhanced debug logger
const debugLog = (area, ...args) => {
  if (!DEBUG) return;
  
  const timestamp = new Date().toISOString();
  console.log(`[DEBUG][${timestamp}][${area}]`, ...args);
};

// Log all request details
router.use((req, res, next) => {
  debugLog('REQUEST', {
    method: req.method,
    path: req.path,
    query: req.query,
    cookies: req.cookies ? Object.keys(req.cookies) : 'No cookies',
    sessionID: req.sessionID || 'No sessionID'
  });
  
  // Track request start time
  req._startTime = Date.now();
  next();
});

// Auth status endpoint
router.get('/status', (req, res) => {
  debugLog('STATUS', 'Auth status check requested');
  
  let user = null;
  let authenticated = false;
  
  // Check if user exists in session
  if (req.session && req.session.user) {
    debugLog('STATUS', 'User found in session', {
      discord_id: req.session.user.discord_id,
      discord_username: req.session.user.discord_username
    });
    user = req.session.user;
    authenticated = true;
  } 
  // Check if user exists in passport
  else if (req.isAuthenticated && req.isAuthenticated()) {
    debugLog('STATUS', 'User authenticated via passport', {
      discord_id: req.user.discord_id,
      discord_username: req.user.discord_username
    });
    user = req.user;
    authenticated = true;
  }
  // Check for auth token in cookies
  else if (req.cookies && req.cookies.skyrden_auth) {
    try {
      debugLog('STATUS', 'Found auth cookie, verifying...');
      const decoded = jwt.verify(req.cookies.skyrden_auth, JWT_SECRET);
      
      if (decoded && decoded.id) {
        debugLog('STATUS', 'Valid token in cookie', {
          id: decoded.id,
          username: decoded.username
        });
        user = {
          discord_id: decoded.id,
          discord_username: decoded.username || 'Discord User',
          roblox_username: decoded.roblox || null,
          is_admin: decoded.is_admin || false
        };
        authenticated = true;
        
        // Store in session for future requests
        if (req.session) {
          req.session.user = user;
          debugLog('STATUS', 'Stored cookie user in session');
        }
      }
    } catch (e) {
      debugLog('STATUS', 'Invalid token in cookie:', e.message);
    }
  }
  
  if (authenticated && user) {
    // Ensure we always have a username
    if (!user.discord_username) {
      user.discord_username = 'Discord User';
      debugLog('STATUS', 'Fixed missing username in user object');
    }
    
    debugLog('STATUS', 'Returning authenticated user:', {
      id: user.discord_id,
      username: user.discord_username
    });
    
    res.json({
      authenticated: true,
      user
    });
  } else {
    debugLog('STATUS', 'User not authenticated');
    res.json({
      authenticated: false
    });
  }
});

// =================================================================
// STATELESS DISCORD AUTHENTICATION
// =================================================================

// Start Discord auth flow (stateless)
router.get('/discord-stateless', (req, res) => {
  const returnUrl = req.query.redirect || CLIENT_URL;
  
  // Generate state for CSRF protection with encoded return URL
  const stateData = {
    returnUrl,
    nonce: generateRandomString(16),
    timestamp: Date.now()
  };
  
  // Encode and sign state
  const stateString = Buffer.from(JSON.stringify(stateData)).toString('base64');
  const signature = generateHmac(stateString, JWT_SECRET);
  const state = `${stateString}.${signature}`;
  
  debugLog('DISCORD-STATELESS', 'Starting Discord authentication', {
    returnUrl,
    state: state.substring(0, 20) + '...'
  });
  
  // Redirect to Discord
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(`${API_URL}/api/auth/discord-callback-stateless`)}&scope=identify+email&state=${encodeURIComponent(state)}`;
  
  res.redirect(discordAuthUrl);
});

// Discord callback (stateless)
router.get('/discord-callback-stateless', async (req, res) => {
  const { code, state } = req.query;
  
  debugLog('DISCORD-CALLBACK-STATELESS', 'Discord callback received', {
    hasCode: !!code,
    hasState: !!state
  });
  
  if (!code || !state) {
    debugLog('DISCORD-CALLBACK-STATELESS', 'Missing code or state');
    return res.redirect(`${CLIENT_URL}/?error=missing_params&message=Missing+required+parameters`);
  }
  
  try {
    // Verify state
    const [stateString, signature] = state.split('.');
    
    if (!stateString || !signature) {
      debugLog('DISCORD-CALLBACK-STATELESS', 'Invalid state format');
      return res.redirect(`${CLIENT_URL}/?error=invalid_state&message=Invalid+state+format`);
    }
    
    const expectedSignature = generateHmac(stateString, JWT_SECRET);
    if (signature !== expectedSignature) {
      debugLog('DISCORD-CALLBACK-STATELESS', 'State signature mismatch');
      return res.redirect(`${CLIENT_URL}/?error=invalid_signature&message=State+validation+failed`);
    }
    
    // Decode state data
    const stateData = JSON.parse(Buffer.from(stateString, 'base64').toString());
    const { returnUrl, timestamp } = stateData;
    
    // Check state age (max 10 minutes)
    if (Date.now() - timestamp > 10 * 60 * 1000) {
      debugLog('DISCORD-CALLBACK-STATELESS', 'State expired');
      return res.redirect(`${CLIENT_URL}/?error=state_expired&message=Authentication+request+expired`);
    }
    
    debugLog('DISCORD-CALLBACK-STATELESS', 'State validated successfully');
    
    // Exchange code for token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
      new URLSearchParams({
        'client_id': DISCORD_CLIENT_ID,
        'client_secret': DISCORD_CLIENT_SECRET,
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': `${API_URL}/api/auth/discord-callback-stateless`
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token } = tokenResponse.data;
    
    // Get user info from Discord
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });
    
    const discordUser = userResponse.data;
    
    debugLog('DISCORD-CALLBACK-STATELESS', 'Discord user data retrieved', {
      id: discordUser.id,
      username: discordUser.username
    });
    
    // Update or create user in database
    try {
      let user;
      
      if (typeof User.findOneAndUpdate === 'function') {
        user = await User.findOneAndUpdate(
          { discord_id: discordUser.id },
          { 
            $set: {
              discord_username: discordUser.username,
              discord_avatar: discordUser.avatar,
              discord_email: discordUser.email,
              last_login: new Date()
            }
          },
          { upsert: true, new: true }
        );
        
        debugLog('DISCORD-CALLBACK-STATELESS', 'User saved/updated in database');
      }
    } catch (dbErr) {
      debugLog('DISCORD-CALLBACK-STATELESS', 'Database error:', dbErr.message);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      {
        id: discordUser.id,
        username: discordUser.username,
        avatar: discordUser.avatar,
        is_admin: false
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    // Set auth cookie
    res.cookie('skyrden_auth', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    debugLog('DISCORD-CALLBACK-STATELESS', 'Authentication successful, redirecting');
    
    // Redirect back with token in URL as fallback
    return res.redirect(`${returnUrl || CLIENT_URL}/?auth=success&token=${token}&id=${discordUser.id}&username=${encodeURIComponent(discordUser.username)}`);
  } catch (error) {
    debugLog('DISCORD-ERROR-STATELESS', 'Error in Discord callback:', error.message);
    return res.redirect(`${CLIENT_URL}/?error=discord_error&message=${encodeURIComponent(error.message)}`);
  }
});

// =================================================================
// STATELESS ROBLOX AUTHENTICATION
// =================================================================

// Start Roblox auth flow (stateless)
router.get('/stateless-roblox-link', (req, res) => {
  const { discord_id, username } = req.query;
  
  if (!discord_id) {
    return res.status(400).json({ error: 'Missing discord_id parameter' });
  }
  
  debugLog('STATELESS-ROBLOX', 'Stateless Roblox linking requested', {
    discord_id,
    username: username || 'Not provided'
  });
  
  // Generate a secure state parameter that includes the user info
  const userInfo = {
    discord_id,
    username: username || 'Discord User',
    timestamp: Date.now()
  };
  
  // Encode and sign state
  const stateString = Buffer.from(JSON.stringify(userInfo)).toString('base64');
  const signature = generateHmac(stateString, JWT_SECRET);
  const state = `${stateString}.${signature}`;
  
  // Construct Roblox OAuth URL
  const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${ROBLOX_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(`${API_URL}/api/auth/stateless-roblox-callback`)}&scope=openid+profile&state=${encodeURIComponent(state)}`;
  
  debugLog('STATELESS-ROBLOX', 'Redirecting to Roblox OAuth', {
    state: state.substring(0, 20) + '...',
    discord_id
  });
  
  return res.redirect(robloxAuthUrl);
});

// Roblox callback (stateless)
router.get('/stateless-roblox-callback', async (req, res) => {
  const { code, state } = req.query;
  
  debugLog('STATELESS-ROBLOX-CALLBACK', 'Stateless Roblox callback received', {
    hasCode: !!code,
    hasState: !!state
  });
  
  if (!code || !state) {
    debugLog('STATELESS-ROBLOX-CALLBACK', 'Missing code or state');
    return res.redirect(`${CLIENT_URL}/?error=missing_params&message=Missing+required+parameters`);
  }
  
  try {
    // Verify state
    const [stateString, signature] = state.split('.');
    
    if (!stateString || !signature) {
      debugLog('STATELESS-ROBLOX-CALLBACK', 'Invalid state format');
      return res.redirect(`${CLIENT_URL}/?error=invalid_state&message=Invalid+state+format`);
    }
    
    const expectedSignature = generateHmac(stateString, JWT_SECRET);
    if (signature !== expectedSignature) {
      debugLog('STATELESS-ROBLOX-CALLBACK', 'State signature mismatch');
      return res.redirect(`${CLIENT_URL}/?error=invalid_signature&message=State+validation+failed`);
    }
    
    // Decode user info from state
    const userInfo = JSON.parse(Buffer.from(stateString, 'base64').toString());
    const { discord_id, username } = userInfo;
    
    debugLog('STATELESS-ROBLOX-CALLBACK', 'State validated successfully', { discord_id, username });
    
    // Check if the state is too old (1 hour max)
    const stateAge = Date.now() - userInfo.timestamp;
    if (stateAge > 60 * 60 * 1000) {
      debugLog('STATELESS-ROBLOX-CALLBACK', 'State expired');
      return res.redirect(`${CLIENT_URL}/?error=state_expired&message=Authentication+request+expired`);
    }
    
    // Exchange code for token
    const tokenResponse = await axios.post('https://apis.roblox.com/oauth/v1/token', 
      new URLSearchParams({
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': `${API_URL}/api/auth/stateless-roblox-callback`
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${ROBLOX_CLIENT_ID}:${ROBLOX_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );
    
    const tokenData = tokenResponse.data;
    debugLog('STATELESS-ROBLOX-CALLBACK', 'Received token from Roblox');
    
    // Get user info
    const userInfoResponse = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    const robloxUserInfo = userInfoResponse.data;
    debugLog('STATELESS-ROBLOX-CALLBACK', 'Received user info', {
      sub: robloxUserInfo.sub
    });
    
    // Get username
    const headers = {};
    if (ROBLOX_API_KEY) {
      headers['x-api-key'] = ROBLOX_API_KEY;
    }
    
    debugLog('STATELESS-ROBLOX-CALLBACK', 'Fetching Roblox username');
    const usernameResponse = await axios.get(`https://users.roblox.com/v1/users/${robloxUserInfo.sub}`, { headers });
    
    const robloxUsername = usernameResponse.data.name;
    debugLog('STATELESS-ROBLOX-CALLBACK', 'Received Roblox username', {
      username: robloxUsername
    });
    
    // Update user in database if available
    try {
      if (typeof User.findOneAndUpdate === 'function') {
        await User.findOneAndUpdate(
          { discord_id },
          {
            $set: {
              roblox_id: robloxUserInfo.sub,
              roblox_username: robloxUsername
            }
          },
          { upsert: true, new: true }
        );
        
        debugLog('STATELESS-ROBLOX-CALLBACK', 'Updated user in database');
      }
    } catch (dbErr) {
      debugLog('STATELESS-ROBLOX-CALLBACK', 'Database error:', dbErr.message);
    }
    
    // Generate new token with Roblox data
    const token = jwt.sign(
      {
        id: discord_id,
        username: username,
        roblox: robloxUsername,
        is_admin: false
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    // Set auth cookie
    res.cookie('skyrden_auth', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    debugLog('STATELESS-ROBLOX-CALLBACK', 'Roblox linking successful, redirecting to client');
    
    // Redirect back to client
    return res.redirect(`${CLIENT_URL}/?roblox_linked=true&username=${encodeURIComponent(robloxUsername)}&token=${token}`);
  } catch (error) {
    debugLog('STATELESS-ROBLOX-ERROR', 'Error in stateless Roblox callback:', error.message);
    return res.redirect(`${CLIENT_URL}/?error=roblox_error&message=${encodeURIComponent(error.message)}`);
  }
});

// Token login endpoint for cross-domain auth
router.post('/token-login', (req, res) => {
  const { token } = req.body;
  
  debugLog('TOKEN-LOGIN', 'Token login requested');
  
  if (!token) {
    debugLog('TOKEN-LOGIN', 'No token provided');
    return res.status(401).json({ authenticated: false, message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    debugLog('TOKEN-LOGIN', 'Token verified successfully:', {
      id: decoded.id,
      username: decoded.username || 'No username in token'
    });
    
    // Create user object from token data with fallback for missing username
    const user = {
      discord_id: decoded.id,
      discord_username: decoded.username || 'Discord User',
      roblox_username: decoded.roblox || null,
      is_admin: decoded.is_admin || false
    };
    
    // Store in session if available
    if (req.session) {
      req.session.user = user;
      debugLog('TOKEN-LOGIN', 'User stored in session');
    }
    
    // Login with passport if available
    if (req.login) {
      req.login(user, (loginErr) => {
        if (loginErr) {
          debugLog('TOKEN-LOGIN', 'Passport login failed:', loginErr.message);
        } else {
          debugLog('TOKEN-LOGIN', 'Passport login successful');
        }
      });
    }
    
    // Update database with last login
    try {
      if (typeof User.findOneAndUpdate === 'function') {
        User.findOneAndUpdate(
          { discord_id: decoded.id },
          { $set: { last_login: new Date() } },
          { upsert: false }
        ).then(() => {
          debugLog('TOKEN-LOGIN', 'Database updated with last login');
        }).catch(dbErr => {
          debugLog('TOKEN-LOGIN', 'Database update failed:', dbErr.message);
        });
      }
    } catch (dbErr) {
      debugLog('TOKEN-LOGIN', 'Database error:', dbErr.message);
    }
    
    // Set fresh cookie
    res.cookie('skyrden_auth', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    return res.json({
      authenticated: true,
      user
    });
  } catch (error) {
    debugLog('TOKEN-LOGIN', 'Token verification failed:', error.message);
    return res.status(401).json({ authenticated: false, message: 'Invalid token' });
  }
});

// Environment variables check endpoint
router.get('/env-check', (req, res) => {
  res.json({
    API_URL: process.env.API_URL || 'not set',
    CLIENT_URL: process.env.CLIENT_URL || 'not set',
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ? 'set' : 'not set',
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET ? 'set' : 'not set',
    ROBLOX_CLIENT_ID: process.env.ROBLOX_CLIENT_ID ? 'set' : 'not set',
    ROBLOX_CLIENT_SECRET: process.env.ROBLOX_CLIENT_SECRET ? 'set' : 'not set',
    NODE_ENV: process.env.NODE_ENV || 'not set'
  });
});

// Debug endpoint for auth status with headers
router.get('/debug-auth', (req, res) => {
  res.json({
    session: req.session ? {
      id: req.sessionID,
      cookie: req.session.cookie,
      user: req.session.user ? {
        discord_id: req.session.user.discord_id,
        discord_username: req.session.user.discord_username,
        roblox_username: req.session.user.roblox_username
      } : null
    } : null,
    passport: {
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : 'N/A',
      user: req.user ? {
        discord_id: req.user.discord_id,
        discord_username: req.user.discord_username
      } : null
    },
    cookies: req.cookies ? Object.keys(req.cookies) : null,
    headers: {
      cookie: req.headers.cookie,
      authorization: req.headers.authorization
    }
  });
});

// Raw user data - useful for debugging ID issues
router.get('/raw-user', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ authenticated: false });
  }
  
  res.json({
    session_user: req.session.user,
    passport_user: req.user || null
  });
});

// Logout endpoint
router.post('/logout', (req, res) => {
  debugLog('LOGOUT', 'Logout requested');
  
  // Clear session
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        debugLog('LOGOUT', 'Error destroying session:', err.message);
      } else {
        debugLog('LOGOUT', 'Session destroyed successfully');
      }
    });
  }
  
  // Clear passport
  if (req.logout) {
    try {
      req.logout((err) => {
        if (err) {
          debugLog('LOGOUT', 'Error in passport logout:', err.message);
        } else {
          debugLog('LOGOUT', 'Passport logout successful');
        }
      });
    } catch (e) {
      // Handle older versions of Passport
      try {
        req.logout();
        debugLog('LOGOUT', 'Passport logout (old version) successful');
      } catch (e2) {
        debugLog('LOGOUT', 'Error in old passport logout:', e2.message);
      }
    }
  }
  
  // Clear cookie
  res.clearCookie('skyrden_auth', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  
  debugLog('LOGOUT', 'Auth cookie cleared');
  
  res.json({ success: true });
});

// Special endpoint for testing cookies
router.get('/check-cookies', (req, res) => {
  const testCookie = 'skyrden_test_' + Date.now();
  
  res.cookie(testCookie, 'test-value', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 60000 // 1 minute
  });
  
  res.json({
    receivedCookies: req.cookies ? Object.keys(req.cookies) : [],
    setTestCookie: testCookie,
    sessionExists: !!req.session,
    sessionID: req.sessionID || 'No session ID'
  });
});

module.exports = router;