const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Environment configuration
const CLIENT_URL = process.env.CLIENT_URL || 'https://skyrden-portal.netlify.app';
const API_URL = process.env.API_URL || 'http://skd-portal.up.railway.app';
const JWT_SECRET = process.env.JWT_SECRET || 'skyrden-jwt-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const ROBLOX_CLIENT_ID = process.env.ROBLOX_CLIENT_ID;
const ROBLOX_CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

// Enable verbose debugging
const DEBUG = true;

// Helper function to generate a random string
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
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
    debugLog('STATUS', 'User found in session');
    user = req.session.user;
    authenticated = true;
  } 
  // Check if user exists in passport
  else if (req.isAuthenticated && req.isAuthenticated()) {
    debugLog('STATUS', 'User authenticated via passport');
    user = req.user;
    authenticated = true;
  }
  // Check for auth token in cookies
  else if (req.cookies && req.cookies.skyrden_auth) {
    try {
      debugLog('STATUS', 'Found auth cookie, verifying...');
      const decoded = jwt.verify(req.cookies.skyrden_auth, JWT_SECRET);
      
      if (decoded && decoded.id) {
        debugLog('STATUS', 'Valid token in cookie');
        user = {
          discord_id: decoded.id,
          discord_username: decoded.username,
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
  // Check for auth bypass header (for development)
  else if (process.env.NODE_ENV !== 'production' && 
    req.headers['x-bypass-auth'] && 
    req.headers['x-bypass-auth'].startsWith('dev_')) {
    
    debugLog('STATUS', 'Using development bypass token');
    user = {
      discord_id: 'dev_' + Date.now(),
      discord_username: 'DevUser',
      roblox_username: null,
      is_admin: false
    };
    authenticated = true;
  }
  
  if (authenticated && user) {
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

// Discord authentication
router.get('/discord', (req, res, next) => {
  // Store the original URL to redirect back after auth
  const originalUrl = req.query.redirect || CLIENT_URL;
  
  if (req.session) {
    req.session.returnTo = originalUrl;
    debugLog('DISCORD-AUTH', 'Starting Discord authentication', {
      returnTo: originalUrl,
      sessionID: req.sessionID
    });
  } else {
    debugLog('DISCORD-AUTH', 'No session available, authentication may fail');
  }
  
  passport.authenticate('discord', {
    scope: ['identify', 'email', 'guilds.join'],
    state: generateRandomString(16) // Add state parameter for CSRF protection
  })(req, res, next);
});

// Discord callback
router.get('/discord/callback', (req, res, next) => {
  debugLog('DISCORD-CALLBACK', 'Discord callback received');
  
  passport.authenticate('discord', async (err, profile, info) => {
    if (err) {
      debugLog('DISCORD-ERROR', 'Discord auth error:', err);
      return res.redirect(`${CLIENT_URL}/?error=auth_failed&reason=${encodeURIComponent(err.message || 'Unknown error')}`);
    }
    
    if (!profile) {
      debugLog('DISCORD-ERROR', 'No profile returned from Discord auth');
      return res.redirect(`${CLIENT_URL}/?error=no_user&info=${encodeURIComponent(JSON.stringify(info))}`);
    }
    
    debugLog('DISCORD-SUCCESS', 'Discord auth successful for profile:', {
      id: profile.id,
      username: profile.username
    });
    
    try {
      // Prepare user object
      const user = {
        discord_id: profile.id,
        discord_username: profile.username,
        discord_avatar: profile.avatar,
        discord_email: profile.email,
        roblox_username: null,
        is_admin: false
      };
      
      // Try to save to database if available
      try {
        if (typeof User.findOneAndUpdate === 'function') {
          const dbUser = await User.findOneAndUpdate(
            { discord_id: profile.id },
            { 
              $set: {
                discord_username: profile.username,
                discord_avatar: profile.avatar,
                discord_email: profile.email,
                last_login: new Date()
              }
            },
            { upsert: true, new: true }
          );
          
          if (dbUser) {
            // Update user object with any database values
            user.roblox_username = dbUser.roblox_username;
            user.is_admin = dbUser.is_admin;
            debugLog('DATABASE', 'User saved/updated in database');
          }
        }
      } catch (dbErr) {
        debugLog('DATABASE-ERROR', 'Failed to save user to database:', dbErr.message);
      }
      
      // Set user in session
      if (req.session) {
        req.session.user = user;
        debugLog('SESSION', 'User set in session');
      } else {
        debugLog('SESSION-ERROR', 'No session available');
      }
      
      // Login with passport if available
      if (req.login) {
        req.login(user, (loginErr) => {
          if (loginErr) {
            debugLog('LOGIN-ERROR', 'Failed to login with passport:', loginErr.message);
          } else {
            debugLog('LOGIN', 'Passport login successful');
          }
        });
      }
      
      // Generate JWT token with user data
      const token = jwt.sign(
        {
          id: user.discord_id,
          username: user.discord_username,
          roblox: user.roblox_username,
          is_admin: user.is_admin
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      
      debugLog('TOKEN', 'Generated JWT token');
      
      // Set auth cookie
      res.cookie('skyrden_auth', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      debugLog('COOKIE', 'Set auth cookie');
      
      // Get redirect URL
      const returnUrl = req.session && req.session.returnTo ? req.session.returnTo : CLIENT_URL;
      
      // Clean up session
      if (req.session && req.session.returnTo) {
        delete req.session.returnTo;
      }
      
      // Redirect with token and user ID in URL (for fallback)
      return res.redirect(`${returnUrl}/?auth=success&token=${token}&id=${user.discord_id}&username=${encodeURIComponent(user.discord_username)}`);
    } catch (error) {
      debugLog('CRITICAL-ERROR', 'Unhandled error in Discord callback:', error);
      return res.redirect(`${CLIENT_URL}/?error=server_error&message=${encodeURIComponent(error.message || 'Unknown error')}`);
    }
  })(req, res, next);
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
      username: decoded.username
    });
    
    // Create user object from token data
    const user = {
      discord_id: decoded.id,
      discord_username: decoded.username,
      roblox_username: decoded.roblox || null,
      is_admin: decoded.is_admin || false
    };
    
    // Store in session
    if (req.session) {
      req.session.user = user;
      debugLog('TOKEN-LOGIN', 'User stored in session');
    }
    
    // Login with passport
    if (req.login) {
      req.login(user, (loginErr) => {
        if (loginErr) {
          debugLog('TOKEN-LOGIN', 'Passport login failed:', loginErr.message);
        } else {
          debugLog('TOKEN-LOGIN', 'Passport login successful');
        }
      });
    }
    
    // Try to update database
    try {
      if (typeof User.findOneAndUpdate === 'function') {
        User.findOneAndUpdate(
          { discord_id: decoded.id },
          { 
            $set: { 
              last_login: new Date() 
            }
          },
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

// Roblox authentication
router.get('/roblox', (req, res) => {
  debugLog('ROBLOX-AUTH', 'Roblox auth requested');
  
  // Check different auth sources
  const sessionUser = req.session && req.session.user;
  const passportUser = req.isAuthenticated && req.isAuthenticated() ? req.user : null;
  let tokenUser = null;
  
  // Check for token in query
  const authToken = req.query.token;
  if (authToken) {
    try {
      const decoded = jwt.verify(authToken, JWT_SECRET);
      if (decoded && decoded.id) {
        tokenUser = {
          discord_id: decoded.id,
          discord_username: decoded.username || 'Discord User',
          roblox_username: decoded.roblox || null,
          is_admin: decoded.is_admin || false
        };
        
        debugLog('ROBLOX-AUTH', 'Valid token provided in URL');
      }
    } catch (e) {
      debugLog('ROBLOX-AUTH', 'Invalid token in URL:', e.message);
    }
  }
  
  // Check for direct user ID
  const directUserId = req.query.user_id;
  let directUser = null;
  
  if (directUserId && directUserId.length > 10) {
    directUser = {
      discord_id: directUserId,
      discord_username: req.query.username || 'Discord User',
      roblox_username: null,
      is_admin: false
    };
    
    debugLog('ROBLOX-AUTH', 'Direct user ID provided:', directUserId);
  }
  
  // Determine which user to use
  const user = sessionUser || passportUser || tokenUser || directUser;
  
  debugLog('ROBLOX-AUTH', 'Auth sources:', {
    hasSessionUser: !!sessionUser,
    hasPassportUser: !!passportUser,
    hasTokenUser: !!tokenUser,
    hasDirectUser: !!directUser,
    usingUser: user ? 'yes' : 'no'
  });
  
  if (user) {
    // Generate state for CSRF protection
    const state = generateRandomString(32);
    
    // Store state and user ID for callback
    if (req.session) {
      req.session.robloxState = state;
      req.session.pendingRobloxLink = user.discord_id;
      
      // Store user in session if not already there
      if (!req.session.user) {
        req.session.user = user;
        debugLog('ROBLOX-AUTH', 'Stored user in session');
      }
      
      debugLog('ROBLOX-AUTH', 'Session data set for Roblox flow', {
        sessionID: req.sessionID,
        state: state.substring(0, 8) + '...',
        pendingLinkId: user.discord_id
      });
    } else {
      debugLog('ROBLOX-AUTH', 'WARNING: No session available for Roblox flow');
    }
    
    // Construct Roblox OAuth URL
    const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${ROBLOX_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(`${API_URL}/api/auth/roblox/callback`)}&scope=openid+profile&state=${state}`;
    
    debugLog('ROBLOX-AUTH', 'Redirecting to Roblox OAuth');
    return res.redirect(robloxAuthUrl);
  } else {
    debugLog('ROBLOX-AUTH', 'No authenticated user found, rejecting Roblox auth');
    return res.redirect(`${CLIENT_URL}/?error=discord_first&message=Please+log+in+with+Discord+first`);
  }
});

// Direct Roblox linking (for when sessions fail)
router.get('/direct-roblox-link', (req, res) => {
  const { discord_id, username } = req.query;
  
  if (!discord_id) {
    return res.status(400).json({ error: 'Missing discord_id parameter' });
  }
  
  debugLog('DIRECT-LINK', 'Direct Roblox linking requested', {
    discord_id,
    username: username || 'Not provided'
  });
  
  // Generate token for this user
  const token = jwt.sign(
    { 
      id: discord_id,
      username: username || 'Discord User'
    },
    JWT_SECRET,
    { expiresIn: '1h' } // Short expiry for security
  );
  
  // Create a temporary session with this user
  if (req.session) {
    req.session.user = {
      discord_id,
      discord_username: username || 'Discord User',
      roblox_username: null,
      is_admin: false
    };
    
    req.session.pendingRobloxLink = discord_id;
    debugLog('DIRECT-LINK', 'Created session for direct linking');
  } else {
    debugLog('DIRECT-LINK', 'No session available for direct linking');
  }
  
  // Redirect to regular Roblox auth with token
  return res.redirect(`/api/auth/roblox?token=${token}&user_id=${discord_id}&username=${encodeURIComponent(username || 'Discord User')}`);
});

// Roblox callback
router.get('/roblox/callback', async (req, res) => {
  const { code, state } = req.query;
  
  debugLog('ROBLOX-CALLBACK', 'Roblox callback received', {
    hasCode: !!code,
    hasState: !!state
  });
  
  // Verify state parameter
  if (!state || !req.session || state !== req.session.robloxState) {
    debugLog('ROBLOX-CALLBACK', 'Invalid state parameter', {
      receivedState: state ? state.substring(0, 8) + '...' : 'none',
      sessionState: req.session && req.session.robloxState ? 
        req.session.robloxState.substring(0, 8) + '...' : 'none',
      hasSession: !!req.session
    });
    
    return res.redirect(`${CLIENT_URL}/?error=invalid_state&message=Session+expired+or+invalid+request`);
  }
  
  // Get Discord ID for linking
  const discordId = req.session.pendingRobloxLink;
  
  if (!discordId) {
    debugLog('ROBLOX-CALLBACK', 'No Discord ID found for linking');
    return res.redirect(`${CLIENT_URL}/?error=no_discord_id&message=No+Discord+account+to+link+with`);
  }
  
  if (!code) {
    debugLog('ROBLOX-CALLBACK', 'No authorization code provided');
    return res.redirect(`${CLIENT_URL}/?error=no_code&message=No+authorization+code+received+from+Roblox`);
  }
  
  try {
    // Exchange code for token
    debugLog('ROBLOX-CALLBACK', 'Exchanging code for token');
    
    const tokenResponse = await axios.post('https://apis.roblox.com/oauth/v1/token', 
      new URLSearchParams({
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': `${API_URL}/api/auth/roblox/callback`
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${ROBLOX_CLIENT_ID}:${ROBLOX_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );
    
    const tokenData = tokenResponse.data;
    debugLog('ROBLOX-CALLBACK', 'Received token from Roblox');
    
    // Get user info
    debugLog('ROBLOX-CALLBACK', 'Fetching user info');
    const userInfoResponse = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    const userInfo = userInfoResponse.data;
    debugLog('ROBLOX-CALLBACK', 'Received user info', {
      sub: userInfo.sub
    });
    
    // Get username
    const headers = {};
    if (ROBLOX_API_KEY) {
      headers['x-api-key'] = ROBLOX_API_KEY;
    }
    
    debugLog('ROBLOX-CALLBACK', 'Fetching Roblox username');
    const usernameResponse = await axios.get(`https://users.roblox.com/v1/users/${userInfo.sub}`, { headers });
    
    const robloxUsername = usernameResponse.data.name;
    debugLog('ROBLOX-CALLBACK', 'Received Roblox username', {
      username: robloxUsername
    });
    
    // Update user in database if available
    let user = null;
    try {
      if (typeof User.findOneAndUpdate === 'function') {
        user = await User.findOneAndUpdate(
          { discord_id: discordId },
          {
            $set: {
              roblox_id: userInfo.sub,
              roblox_username: robloxUsername
            }
          },
          { upsert: true, new: true }
        );
        
        debugLog('ROBLOX-CALLBACK', 'Updated user in database');
      }
    } catch (dbErr) {
      debugLog('ROBLOX-CALLBACK', 'Database error:', dbErr.message);
    }
    
    // If database failed, create a user object manually
    if (!user) {
      user = req.session.user || {
        discord_id: discordId,
        discord_username: 'Discord User',
        roblox_id: userInfo.sub,
        roblox_username: robloxUsername,
        is_admin: false
      };
      
      // Update with Roblox info
      user.roblox_id = userInfo.sub;
      user.roblox_username = robloxUsername;
    }
    
    // Update session
    if (req.session) {
      req.session.user = user;
      delete req.session.robloxState;
      delete req.session.pendingRobloxLink;
      
      debugLog('ROBLOX-CALLBACK', 'Updated session with Roblox data');
    }
    
    // Generate new token with Roblox data
    const token = jwt.sign(
      {
        id: user.discord_id,
        username: user.discord_username,
        roblox: robloxUsername,
        is_admin: user.is_admin || false
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    // Set new cookie
    res.cookie('skyrden_auth', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    debugLog('ROBLOX-CALLBACK', 'Roblox linking successful, redirecting to client');
    
    // Redirect back to client
    return res.redirect(`${CLIENT_URL}/?roblox_linked=true&username=${encodeURIComponent(robloxUsername)}&token=${token}`);
  } catch (error) {
    debugLog('ROBLOX-ERROR', 'Error in Roblox callback:', error.message);
    return res.redirect(`${CLIENT_URL}/?error=roblox_error&message=${encodeURIComponent(error.message)}`);
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