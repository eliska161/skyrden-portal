const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('../models/User');

// Environment variables
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const CALLBACK_URL = `${process.env.API_URL}/api/auth/discord/callback`;

// Debug configuration
const DEBUG = true;
const debugLog = (area, ...args) => {
  if (!DEBUG) return;
  console.log(`[PASSPORT-DEBUG][${area}]`, ...args);
};

debugLog('CONFIG', 'Initializing passport with Discord strategy', {
  callbackURL: CALLBACK_URL
});

// Configure Discord Strategy
passport.use(new DiscordStrategy({
    clientID: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: ['identify', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    debugLog('DISCORD', 'Received profile from Discord', {
      id: profile.id,
      username: profile.username
    });
    
    try {
      // Try to find user in database
      let user = await User.findOne({ discord_id: profile.id });
      
      if (!user) {
        debugLog('USER', 'Creating new user');
        // Create new user
        user = new User({
          discord_id: profile.id,
          discord_username: profile.username,
          discord_avatar: profile.avatar,
          discord_email: profile.email
        });
        await user.save();
        debugLog('USER', 'New user created');
      } else {
        debugLog('USER', 'Updating existing user');
        // Update existing user
        user.discord_username = profile.username;
        user.discord_avatar = profile.avatar;
        user.discord_email = profile.email;
        user.last_login = new Date();
        await user.save();
        debugLog('USER', 'User updated');
      }
      
      return done(null, user);
    } catch (err) {
      debugLog('ERROR', 'Database error during authentication', err);
      
      // Create temporary user if database fails
      const tempUser = {
        discord_id: profile.id,
        discord_username: profile.username,
        is_admin: false
      };
      
      debugLog('FALLBACK', 'Using temporary user due to database error');
      return done(null, tempUser);
    }
  }
));

// Serialize user to store in session
passport.serializeUser((user, done) => {
  debugLog('SERIALIZE', 'Serializing user to session', {
    id: user.discord_id,
    username: user.discord_username
  });
  done(null, user.discord_id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  debugLog('DESERIALIZE', 'Deserializing user from session', { id });
  
  try {
    const user = await User.findOne({ discord_id: id });
    done(null, user);
  } catch (err) {
    debugLog('ERROR', 'Error deserializing user', err);
    done(err);
  }
});

module.exports = passport;