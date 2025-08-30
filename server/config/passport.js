const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('../models/User');
const AdminWhitelist = require('../models/AdminWhitelist');

// Discord Strategy
passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ['identify']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Discord profile received:', profile.username);
    
    // Check if user exists in database
    let user = await User.findOne({ discord_id: profile.id });
    
    if (user) {
      console.log('Existing user found:', user.discord_username);
      
      // Check if user is in admin whitelist
      const adminWhitelist = await AdminWhitelist.findOne({ discord_id: profile.id });
      
      if (adminWhitelist && !user.is_admin) {
        // User is in whitelist but not marked as admin yet
        user.is_admin = true;
        await user.save();
      }
      
      done(null, user);
    } else {
      // Create new user
      const isAdmin = await AdminWhitelist.exists({ discord_id: profile.id });
      
      const newUser = new User({
        discord_id: profile.id,
        discord_username: `${profile.username}${profile.discriminator ? `#${profile.discriminator}` : ''}`,
        is_admin: !!isAdmin
      });
      
      await newUser.save();
      console.log('New user created:', newUser.discord_username);
      done(null, newUser);
    }
  } catch (error) {
    console.error('Discord auth error:', error);
    done(error);
  }
}));

// Serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;