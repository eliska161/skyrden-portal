const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');
// Fix for node-fetch ESM issue - using axios instead
const axios = require('axios');
const crypto = require('crypto'); // Built-in for random string generation
const jwt = require('jsonwebtoken');

// Environment configuration
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'skyrden-jwt-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

// Debug settings - enable verbose logging
const DEBUG = true;
const DEBUG_AUTH_FLOW = true;
const DEBUG_SESSION = true;
const DEBUG_HEADERS = true;
const DEBUG_COOKIES = true;
const DEBUG_REQUESTS = true;

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
  if (DEBUG_REQUESTS) {
    debugLog('REQUEST', {
      method: req.method,
      path: req.path,
      query: req.query,
      headers: DEBUG_HEADERS ? req.headers : 'Hidden',
      cookies: DEBUG_COOKIES ? req.cookies : 'Hidden',
      body: req.body ? (typeof req.body === 'object' ? '(Object)' : req.body) : 'No body',
      sessionID: req.sessionID || 'No sessionID'
    });
  }
  
  if (DEBUG_SESSION && req.session) {
    debugLog('SESSION', {
      id: req.sessionID,
      cookie: req.session.cookie,
      user: req.session.user ? {
        discord_id: req.session.user.discord_id,
        discord_username: req.session.user.discord_username,
        has_roblox: !!req.session.user.roblox_username
      } : 'No user in session',
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : 'N/A',
      passport: req.session.passport
    });
  }
  
  // Log response after processing
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    if (DEBUG_REQUESTS) {
      debugLog('RESPONSE', {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: DEBUG_HEADERS ? res._headers : 'Hidden',
        timing: `${Date.now() - req._startTime}ms`
      });
    }
    return originalEnd.apply(this, arguments);
  };
  
  // Track request start time
  req._startTime = Date.now();
  
  next();
});

// Auth status endpoint
router.get('/status', (req, res) => {
  debugLog('STATUS', 'Auth status check requested');
  debugLog('STATUS-DETAILS', {
    sessionID: req.sessionID,
    session: req.session ? {
      cookie: req.session.cookie,
      user: req.session.user ? {
        discord_id: req.session.user.discord_id,
        discord_username: req.session.user.discord_username
      } : 'No user'
    } : 'No session',
    passport: req.session && req.session.passport ? req.session.passport : 'No passport',
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : 'N/A'
  });
  
  if (req.session && req.session.user) {
    // If using custom sessions
    debugLog('STATUS', 'User authenticated via session.user');
    res.json({
      authenticated: true,
      user: req.session.user
    });
  } else if (req.isAuthenticated && req.isAuthenticated()) {
    // If using passport
    debugLog('STATUS', 'User authenticated via passport');
    res.json({
      authenticated: true,
      user: req.user
    });
  } else {
    // Check for auth bypass header (for development)
    const bypassToken = req.headers['x-bypass-auth'];
    if (process.env.NODE_ENV !== 'production' && bypassToken && bypassToken.startsWith('dev_')) {
      debugLog('STATUS', 'Using development bypass token');
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
      debugLog('STATUS', 'User not authenticated');
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
  
  debugLog('DISCORD-AUTH', 'Starting Discord authentication', {
    returnTo: originalUrl,
    sessionID: req.sessionID
  });
  
  // Custom-track the request time for measuring Discord auth time
  req.session.authStartTime = Date.now();
  
  passport.authenticate('discord', {
    scope: ['identify', 'email', 'guilds.join'],
    state: generateRandomString(16) // Add state parameter for CSRF protection
  })(req, res, next);
});

// Discord callback
router.get('/discord/callback', (req, res, next) => {
  const authTime = req.session && req.session.authStartTime ? 
    `${Date.now() - req.session.authStartTime}ms` : 'unknown';
    
  debugLog('DISCORD-CALLBACK', 'Discord callback received', {
    query: req.query,
    authTime: authTime,
    sessionID: req.sessionID,
    sessionExists: !!req.session
  });
  
  passport.authenticate('discord', async (err, user, info) => {
    if (err) {
      debugLog('DISCORD-ERROR', 'Discord auth error:', err);
      return res.redirect(`${CLIENT_URL}/?error=auth_failed&reason=${encodeURIComponent(err.message || 'Unknown error')}`);
    }
    
    if (!user) {
      debugLog('DISCORD-ERROR', 'No user returned from Discord auth');
      return res.redirect(`${CLIENT_URL}/?error=no_user&info=${encodeURIComponent(JSON.stringify(info))}`);
    }
    
    debugLog('DISCORD-SUCCESS', 'Discord auth successful for user:', {
      discord_id: user.discord_id,
      discord_username: user.discord_username
    });
    
    try {
      // Login using passport
      req.login(user, async (err) => {
        if (err) {
          debugLog('SESSION-ERROR', 'Session login error:', err);
          return res.redirect(`${CLIENT_URL}/?error=session_error&reason=${encodeURIComponent(err.message || 'Unknown error')}`);
        }
        
        debugLog('SESSION-LOGIN', 'Passport login successful');
        
        // Also store user in session directly for redundancy
        if (req.session) {
          req.session.user = user;
          debugLog('SESSION-STORE', 'User stored in session');
        } else {
          debugLog('SESSION-ERROR', 'No session object to store user in');
        }
        
        // Generate JWT for cross-domain auth
        const token = jwt.sign(
          { 
            id: user.discord_id, 
            username: user.discord_username,
            // Include additional data in token for debugging
            session_id: req.sessionID || 'no-session-id',
            timestamp: Date.now()
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRY }
        );
        
        debugLog('AUTH-TOKEN', 'Generated JWT token', { tokenLength: token.length });
        
        // Check all possible return URLs
        const returnUrl = req.session && req.session.returnTo ? req.session.returnTo : CLIENT_URL;
        if (req.session) {
          delete req.session.returnTo;
          delete req.session.authStartTime;
        }
        
        debugLog('REDIRECT', 'Redirecting after auth', { 
          returnUrl, 
          includesToken: true,
          includesDiscordId: true
        });
        
        // Set explicit cookie options for cross-domain use
        res.cookie('skyrden_auth', token, { 
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        debugLog('COOKIES', 'Set auth cookie with options', {
          name: 'skyrden_auth',
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
        
        // Log all response headers before redirecting
        debugLog('RESPONSE-HEADERS', res._headers || 'No headers available');
        
        // Include token and user ID in the URL for cross-domain fallback
        return res.redirect(`${returnUrl}/?auth=success&token=${token}&id=${user.discord_id}&username=${encodeURIComponent(user.discord_username)}&debug=true`);
      });
    } catch (error) {
      debugLog('CRITICAL-ERROR', 'Error in Discord callback:', error);
      return res.redirect(`${CLIENT_URL}/?error=server_error&message=${encodeURIComponent(error.message || 'Unknown error')}`);
    }
  })(req, res, next);
});

// Roblox authentication
router.get('/roblox', (req, res) => {
  debugLog('ROBLOX-AUTH', 'Roblox auth request', {
    session: req.session ? {
      hasUser: !!req.session.user,
      userDetails: req.session.user ? {
        discord_id: req.session.user.discord_id,
        discord_username: req.session.user.discord_username
      } : 'No user'
    } : 'No session',
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : 'N/A'
  });
  
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
  let decodedToken = null;
  
  if (authToken) {
    try {
      decodedToken = jwt.verify(authToken, JWT_SECRET);
      if (decodedToken && decodedToken.id) {
        tokenValid = true;
        debugLog('TOKEN-AUTH', 'Valid token provided for Roblox auth', {
          discord_id: decodedToken.id,
          username: decodedToken.username
        });
      }
    } catch (e) {
      debugLog('TOKEN-ERROR', 'Invalid token:', e.message);
    }
  }
  
  debugLog('AUTH-STATUS', 'Authentication status for Roblox flow', {
    isAuthenticated,
    isDevelopmentBypass,
    tokenValid,
    sessionPresent: !!req.session,
    passportAuthenticated: req.isAuthenticated ? req.isAuthenticated() : 'N/A'
  });
  
  if (isAuthenticated || isDevelopmentBypass || tokenValid) {
    // Generate a state param to verify the callback
    const state = generateRandomString(32);
    
    if (req.session) {
      req.session.robloxState = state;
      debugLog('ROBLOX-STATE', 'Stored Roblox state in session', { state });
      
      // Store user data if available
      if (req.user) {
        req.session.pendingRobloxLink = req.user.discord_id;
        debugLog('ROBLOX-LINK', 'Storing Discord ID from passport user for Roblox linking', { 
          discord_id: req.user.discord_id 
        });
      } else if (req.session.user) {
        req.session.pendingRobloxLink = req.session.user.discord_id;
        debugLog('ROBLOX-LINK', 'Storing Discord ID from session user for Roblox linking', { 
          discord_id: req.session.user.discord_id 
        });
      } else if (tokenValid) {
        req.session.pendingRobloxLink = decodedToken.id;
        debugLog('ROBLOX-LINK', 'Storing Discord ID from token for Roblox linking', { 
          discord_id: decodedToken.id 
        });
      } else {
        debugLog('ROBLOX-ERROR', 'No Discord ID available to link Roblox account');
      }
    } else {
      debugLog('SESSION-ERROR', 'No session available to store Roblox state');
    }
    
    // Redirect to Roblox OAuth
    const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${process.env.ROBLOX_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.API_URL + '/api/auth/roblox/callback')}&scope=openid+profile&state=${state}`;
    
    debugLog('ROBLOX-REDIRECT', 'Redirecting to Roblox OAuth', {
      robloxAuthUrl: robloxAuthUrl.substring(0, 100) + '...' // Truncate for log readability
    });
    
    res.redirect(robloxAuthUrl);
  } else {
    debugLog('ROBLOX-DENIED', 'Rejecting Roblox auth - no Discord account connected');
    res.redirect(`${CLIENT_URL}/?error=discord_first&session_exists=${!!req.session}`);
  }
});

// Special raw auth status debug endpoint
router.get('/debug-auth', (req, res) => {
  debugLog('DEBUG-AUTH', 'Debug auth endpoint accessed');
  
  const debugInfo = {
    timestamp: new Date().toISOString(),
    request: {
      headers: req.headers,
      cookies: req.cookies,
      sessionID: req.sessionID || 'No sessionID',
      ip: req.ip
    },
    session: req.session ? {
      id: req.sessionID,
      cookie: req.session.cookie,
      user: req.session.user ? {
        discord_id: req.session.user.discord_id,
        discord_username: req.session.user.discord_username,
        has_roblox: !!req.session.user.roblox_username
      } : 'No user in session',
      returnTo: req.session.returnTo,
      robloxState: req.session.robloxState,
      pendingRobloxLink: req.session.pendingRobloxLink,
      passport: req.session.passport
    } : 'No session',
    auth: {
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : 'N/A',
      user: req.user ? {
        discord_id: req.user.discord_id,
        discord_username: req.user.discord_username,
        has_roblox: !!req.user.roblox_username
      } : 'No passport user'
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      API_URL: process.env.API_URL,
      CLIENT_URL: process.env.CLIENT_URL
    }
  };
  
  res.json(debugInfo);
});

// Logout endpoint with enhanced debugging
router.post('/logout', (req, res) => {
  debugLog('LOGOUT', 'Logout requested', {
    sessionID: req.sessionID || 'No session ID',
    hasUser: req.session && req.session.user ? true : false
  });
  
  // Clear session
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        debugLog('LOGOUT-ERROR', 'Error destroying session:', err);
      } else {
        debugLog('LOGOUT-SUCCESS', 'Session destroyed successfully');
      }
    });
  }
  
  // Clear passport login
  if (req.logout) {
    req.logout(err => {
      if (err) {
        debugLog('LOGOUT-ERROR', 'Error logging out with passport:', err);
      } else {
        debugLog('LOGOUT-SUCCESS', 'Passport logout successful');
      }
    });
  }
  
  // Clear auth cookie
  res.clearCookie('skyrden_auth', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  
  debugLog('LOGOUT-COOKIES', 'Cleared auth cookie');
  
  res.json({ success: true, message: 'Logged out successfully' });
});

// Special check cookie endpoint
router.get('/check-cookies', (req, res) => {
  debugLog('COOKIE-CHECK', 'Cookie check endpoint accessed', {
    cookies: req.cookies,
    signedCookies: req.signedCookies,
    headers: {
      cookie: req.headers.cookie
    }
  });
  
  // Set a test cookie
  res.cookie('skyrden_test_cookie', 'cookie_test_value', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 60000 // 1 minute
  });
  
  res.json({
    cookiesReceived: req.cookies || {},
    testCookieSet: true,
    instructions: 'Check if the test cookie was set and can be read on subsequent requests'
  });
});

// Export the router
module.exports = router;