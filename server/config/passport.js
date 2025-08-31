const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('../models/User');

// Environment variables
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

// Hardcode the callback URL to fix the "undefined" issue
const CALLBACK_URL = 'http://skd-portal.up.railway.app/api/auth/discord/callback';

// Enable debugging
const DEBUG = true;
const debugLog = (area, ...args) => {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString();
  console.log(`[PASSPORT-DEBUG][${timestamp}][${area}]`, ...args);
};

// Log all configuration on startup
debugLog('CONFIG', 'Passport initialization', {
  clientID: DISCORD_CLIENT_ID ? 'Set (hidden)' : 'Not set',
  clientSecret: DISCORD_CLIENT_SECRET ? 'Set (hidden)' : 'Not set',
  callbackURL: CALLBACK_URL
});

// In-memory user fallback for when database operations fail
const inMemoryUsers = [];

/**
 * Find or create user in memory
 */
const findOrCreateInMemory = (profile) => {
  let user = inMemoryUsers.find(u => u.discord_id === profile.id);
  
  if (!user) {
    user = {
      discord_id: profile.id,
      discord_username: profile.username,
      discord_email: profile.email,
      discord_avatar: profile.avatar,
      roblox_username: null,
      is_admin: false,
      created_at: new Date(),
      last_login: new Date()
    };
    inMemoryUsers.push(user);
  } else {
    user.discord_username = profile.username;
    user.discord_email = profile.email;
    user.discord_avatar = profile.avatar;
    user.last_login = new Date();
  }
  
  return user;
};

// Configure Discord Strategy
passport.use(new DiscordStrategy({
    clientID: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: ['identify', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    debugLog('DISCORD-AUTH', 'Discord authentication successful', {
      id: profile.id,
      username: profile.username,
      email: profile.email ? 'Set (hidden)' : 'Not set',
      avatar: profile.avatar ? 'Set' : 'Not set',
      displayName: profile.displayName || 'Not set'
    });
    
    // Ensure profile has required fields
    if (!profile.username) {
      profile.username = profile.displayName || profile.id;
      debugLog('PROFILE-FIX', 'Set missing username from displayName or id');
    }
    
    try {
      // Try to find user in database
      let user;
      
      try {
        // Check if User model and database connection are available
        if (typeof User.findOne === 'function') {
          // IMPORTANT: Query by discord_id string
          user = await User.findOne({ discord_id: profile.id });
          
          if (!user) {
            debugLog('DB-CREATE', 'Creating new user in database');
            // Create new user - CRITICAL: Use profile.id for discord_id
            user = new User({
              discord_id: profile.id,
              discord_username: profile.username,
              discord_avatar: profile.avatar,
              discord_email: profile.email
            });
            
            await user.save();
            
            // Verify discord_id after save
            if (user.discord_id !== profile.id) {
              debugLog('ID-FIX', 'Fixing discord_id after save');
              user.discord_id = profile.id;
            }
            
            debugLog('DB-CREATE', 'New user created in database', {
              discord_id: user.discord_id,
              username: user.discord_username
            });
          } else {
            debugLog('DB-UPDATE', 'Updating existing user in database');
            
            // CRITICAL: Ensure discord_id remains the original Discord ID
            if (user.discord_id !== profile.id) {
              debugLog('ID-MISMATCH', `Discord ID mismatch: DB has ${user.discord_id}, Discord returned ${profile.id}`);
              user.discord_id = profile.id;
            }
            
            // Update existing user fields
            user.discord_username = profile.username;
            user.discord_avatar = profile.avatar;
            user.discord_email = profile.email;
            user.last_login = new Date();
            
            await user.save();
            debugLog('DB-UPDATE', 'User updated in database', {
              discord_id: user.discord_id,
              username: user.discord_username
            });
          }
          
          // Create a clean user object with correct properties
          const cleanUser = {
            discord_id: profile.id,
            discord_username: user.discord_username,
            discord_avatar: user.discord_avatar,
            discord_email: user.discord_email,
            roblox_username: user.roblox_username,
            roblox_id: user.roblox_id,
            is_admin: user.is_admin || false
          };
          
          debugLog('USER-CLEAN', 'Created clean user object', cleanUser);
          return done(null, cleanUser);
        } else {
          throw new Error('User model not properly initialized');
        }
      } catch (dbError) {
        debugLog('DB-ERROR', 'Database operation failed, using memory fallback', dbError);
        
        // Use in-memory fallback if database operations fail
        user = findOrCreateInMemory(profile);
        debugLog('MEM-USER', 'Using in-memory user object', {
          id: user.discord_id,
          username: user.discord_username
        });
        
        return done(null, user);
      }
    } catch (err) {
      debugLog('CRITICAL-ERROR', 'Authentication error', err);
      
      // Always provide a user object even in case of errors
      const fallbackUser = {
        discord_id: profile.id,
        discord_username: profile.username || profile.displayName || 'Discord User',
        discord_avatar: profile.avatar,
        discord_email: profile.email,
        is_admin: false,
        roblox_username: null
      };
      
      debugLog('FALLBACK', 'Using fallback user due to critical error', {
        id: fallbackUser.discord_id,
        username: fallbackUser.discord_username
      });
      return done(null, fallbackUser);
    }
  }
));

// Serialize user to store in session
passport.serializeUser((user, done) => {
  debugLog('SERIALIZE', 'Serializing user to session', {
    id: user.discord_id,
    username: user.discord_username
  });
  
  // Store only the discord_id in the session - CRITICAL: Use discord_id not _id
  done(null, user.discord_id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  debugLog('DESERIALIZE', 'Deserializing user from session', { id });
  
  try {
    // Try database first
    let user = null;
    
    try {
      if (typeof User.findOne === 'function') {
        // IMPORTANT: Query by discord_id string
        user = await User.findOne({ discord_id: id });
        
        if (user) {
          debugLog('DB-DESERIALIZE', 'User found in database');
          
          // Ensure discord_id is correct
          if (user.discord_id !== id) {
            debugLog('ID-FIX', 'Fixing discord_id in deserialized user');
            user.discord_id = id;
          }
          
          // Create a clean user object
          const cleanUser = {
            discord_id: id,
            discord_username: user.discord_username,
            discord_avatar: user.discord_avatar,
            discord_email: user.discord_email,
            roblox_username: user.roblox_username,
            roblox_id: user.roblox_id,
            is_admin: user.is_admin || false
          };
          
          return done(null, cleanUser);
        }
      }
    } catch (dbError) {
      debugLog('DB-ERROR', 'Database lookup failed during deserialization', dbError);
    }
    
    // Fall back to in-memory if database lookup fails
    if (!user) {
      debugLog('MEM-LOOKUP', 'Looking up user in memory store');
      user = inMemoryUsers.find(u => u.discord_id === id);
    }
    
    if (user) {
      debugLog('DESERIALIZE-SUCCESS', 'User found', {
        id: user.discord_id,
        username: user.discord_username
      });
      done(null, user);
    } else {
      debugLog('DESERIALIZE-FAILED', 'User not found', { id });
      done(null, false);
    }
  } catch (err) {
    debugLog('DESERIALIZE-ERROR', 'Error deserializing user', err);
    done(err);
  }
});

// Make the in-memory users array available for debugging
passport.inMemoryUsers = inMemoryUsers;

module.exports = passport;