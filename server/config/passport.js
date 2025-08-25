const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const db = require('../database/db');

// Discord Strategy - UPDATED WITH ADMIN CHECK
passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('Discord profile received:', profile.username);
        
        // Check if user exists in database
        db.get('SELECT * FROM users WHERE discord_id = ?', [profile.id], (err, user) => {
            if (err) return done(err);
            
            if (user) {
                console.log('Existing user found:', user.discord_username);
                
                // Check if user is in admin whitelist
                db.get('SELECT * FROM admin_whitelist WHERE discord_id = ?', [profile.id], (err, admin) => {
                    if (err) return done(err);
                    
                    if (admin && !user.is_admin) {
                        // User is in whitelist but not marked as admin yet
                        db.run('UPDATE users SET is_admin = TRUE WHERE discord_id = ?', [profile.id], (updateErr) => {
                            if (updateErr) return done(updateErr);
                            user.is_admin = true;
                            done(null, user);
                        });
                    } else {
                        done(null, user);
                    }
                });
                
            } else {
                // Create new user
                const newUser = {
                    discord_id: profile.id,
                    discord_username: `${profile.username}#${profile.discriminator}`,
                    is_admin: false
                };
                
                // Check if new user is in admin whitelist
                db.get('SELECT * FROM admin_whitelist WHERE discord_id = ?', [profile.id], (err, admin) => {
                    if (err) return done(err);
                    
                    if (admin) {
                        newUser.is_admin = true;
                    }
                    
                    db.run(
                        'INSERT INTO users (discord_id, discord_username, is_admin) VALUES (?, ?, ?)',
                        [newUser.discord_id, newUser.discord_username, newUser.is_admin],
                        function(err) {
                            if (err) return done(err);
                            newUser.id = this.lastID;
                            console.log('New user created:', newUser.discord_username);
                            done(null, newUser);
                        }
                    );
                });
            }
        });
    } catch (error) {
        console.error('Discord auth error:', error);
        done(error);
    }
}));

// Serialization
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
        done(err, user);
    });
});

module.exports = passport;