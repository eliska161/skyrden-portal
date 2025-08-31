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
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// Enable verbose debugging
const DEBUG = true;

// Helper function to generate a random string
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};

// Helper function to generate HMAC for state validation
function generateHmac(data, secret) {
  return crypto.createHmac('sha256', secret)
    .update(data)
    .digest('base64');
}

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
          discord_username: decoded.username || 'User',
          github_username: decoded.github || null,
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
      user.discord_username = 'User';
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
    scope: ['identify', 'email'],
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
    
    // Log the complete user profile
    debugLog('DISCORD-SUCCESS', 'Discord auth successful for profile:', {
      id: profile.discord_id || profile.id,
      username: profile.discord_username || profile.username
    });
    
    try {
      // Ensure we always use the correct Discord ID
      const discordId = profile.discord_id || profile.id;
      const username = profile.discord_username || profile.username || 'User';
      
      debugLog('DISCORD-ID-CHECK', 'Using Discord ID and username:', {
        id: discordId,
        username: username
      });
      
      // Prepare clean user object
      const user = {
        discord_id: discordId,
        discord_username: username,
        discord_avatar: profile.discord_avatar || profile.avatar,
        discord_email: profile.discord_email || profile.email,
        github_username: profile.github_username || null,
        is_admin: profile.is_admin || false
      };
      
      // Set user in session
      if (req.session) {
        req.session.user = user;
        debugLog('SESSION', 'User set in session', {
          id: user.discord_id,
          username: user.discord_username
        });
      } else {
        debugLog('SESSION-ERROR', 'No session available');
      }
      
      // Generate JWT token with user data
      const token = jwt.sign(
        {
          id: user.discord_id,
          username: user.discord_username,
          github: user.github_username,
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
      debugLog('REDIRECT', 'Redirecting with auth data', {
        returnUrl,
        id: user.discord_id,
        username: user.discord_username
      });
      
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
      username: decoded.username || 'No username in token'
    });
    
    // Create user object from token data with fallback for missing username
    const user = {
      discord_id: decoded.id,
      discord_username: decoded.username || 'User',
      github_username: decoded.github || null,
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
              last_login: new Date(),
              discord_username: decoded.username || 'User'
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

// GitHub authentication (stateless)
router.get('/github-link', (req, res) => {
  const { discord_id, username } = req.query;
  
  if (!discord_id) {
    return res.status(400).json({ error: 'Missing discord_id parameter' });
  }
  
  debugLog('GITHUB-AUTH', 'GitHub auth requested', {
    discord_id,
    username: username || 'Not provided'
  });
  
  // Generate a secure state parameter that includes the user info
  const userInfo = {
    discord_id,
    username: username || 'User',
    timestamp: Date.now()
  };
  
  // Encrypt user info into the state parameter
  const stateData = Buffer.from(JSON.stringify(userInfo)).toString('base64');
  const state = `${stateData}.${generateHmac(stateData, JWT_SECRET)}`;
  
  // Construct GitHub OAuth URL
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${API_URL}/api/auth/github-callback`)}&scope=user:email&state=${encodeURIComponent(state)}`;
  
  debugLog('GITHUB-AUTH', 'Redirecting to GitHub OAuth', {
    state: state.substring(0, 20) + '...',
    discord_id
  });
  
  return res.redirect(githubAuthUrl);
});

// GitHub callback (stateless)
router.get('/github-callback', async (req, res) => {
  const { code, state } = req.query;
  
  debugLog('GITHUB-CALLBACK', 'GitHub callback received', {
    hasCode: !!code,
    hasState: !!state
  });
  
  if (!code || !state) {
    debugLog('GITHUB-CALLBACK', 'Missing code or state');
    return res.redirect(`${CLIENT_URL}/?error=missing_params&message=Missing+required+parameters`);
  }
  
  try {
    // Validate and decrypt the state parameter
    const [stateData, signature] = state.split('.');
    
    if (!stateData || !signature) {
      debugLog('GITHUB-CALLBACK', 'Invalid state format');
      return res.redirect(`${CLIENT_URL}/?error=invalid_state&message=Invalid+state+format`);
    }
    
    const expectedSignature = generateHmac(stateData, JWT_SECRET);
    if (signature !== expectedSignature) {
      debugLog('GITHUB-CALLBACK', 'State signature mismatch');
      return res.redirect(`${CLIENT_URL}/?error=invalid_signature&message=State+validation+failed`);
    }
    
    // Decode the user info from state
    const userInfo = JSON.parse(Buffer.from(stateData, 'base64').toString());
    const { discord_id, username } = userInfo;
    
    debugLog('GITHUB-CALLBACK', 'State validated successfully', { discord_id, username });
    
    // Check if the state is too old (1 hour max)
    const stateAge = Date.now() - userInfo.timestamp;
    if (stateAge > 60 * 60 * 1000) {
      debugLog('GITHUB-CALLBACK', 'State expired');
      return res.redirect(`${CLIENT_URL}/?error=state_expired&message=Authentication+request+expired`);
    }
    
    // Exchange code for token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${API_URL}/api/auth/github-callback`
    }, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      throw new Error('Failed to obtain GitHub access token');
    }
    
    // Get user data from GitHub
    const githubUserResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    const githubUserData = githubUserResponse.data;
    const githubUsername = githubUserData.login;
    
    debugLog('GITHUB-CALLBACK', 'GitHub profile fetched', {
      username: githubUsername
    });
    
    // Update user in database if available
    try {
      if (typeof User.findOneAndUpdate === 'function') {
        await User.findOneAndUpdate(
          { discord_id },
          {
            $set: {
              github_id: githubUserData.id,
              github_username: githubUsername,
              github_avatar: githubUserData.avatar_url,
              github_name: githubUserData.name
            }
          },
          { upsert: true, new: true }
        );
        
        debugLog('GITHUB-CALLBACK', 'Updated user in database');
      }
    } catch (dbErr) {
      debugLog('GITHUB-CALLBACK', 'Database error:', dbErr.message);
    }
    
    // Generate new token with GitHub data
    const token = jwt.sign(
      {
        id: discord_id,
        username: username,
        github: githubUsername,
        is_admin: false
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    debugLog('GITHUB-CALLBACK', 'GitHub linking successful, redirecting to client');
    
    // Redirect back to client
    return res.redirect(`${CLIENT_URL}/?github_linked=true&username=${encodeURIComponent(githubUsername)}&token=${token}`);
  } catch (error) {
    debugLog('GITHUB-ERROR', 'Error in GitHub callback:', error.message);
    return res.redirect(`${CLIENT_URL}/?error=github_error&message=${encodeURIComponent(error.message)}`);
  }
});

// Environment variables check endpoint
router.get('/env-check', (req, res) => {
  res.json({
    API_URL: process.env.API_URL || 'not set',
    CLIENT_URL: process.env.CLIENT_URL || 'not set',
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ? 'set' : 'not set',
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET ? 'set' : 'not set',
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ? 'set' : 'not set',
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ? 'set' : 'not set',
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
        github_username: req.session.user.github_username
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