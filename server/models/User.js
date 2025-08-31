const mongoose = require('mongoose');

// IMPORTANT: discord_id must be a String, not an ObjectId
const UserSchema = new mongoose.Schema({
  discord_id: {
    type: String,  // Keep as String, not ObjectId!
    required: true,
    unique: true
  },
  discord_username: {
    type: String,
    required: true
  },
  discord_avatar: {
    type: String,
    default: null
  },
  discord_email: {
    type: String,
    default: null
  },
  roblox_id: {
    type: String,
    default: null
  },
  roblox_username: {
    type: String,
    default: null
  },
  is_admin: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  last_login: {
    type: Date,
    default: Date.now
  }
});

// Helper methods
UserSchema.methods.updateLastLogin = function() {
  this.last_login = Date.now();
  return this.save();
};

// Create and export the model
const User = mongoose.model('User', UserSchema);

// Add custom logging to user methods
const originalSave = User.prototype.save;
User.prototype.save = function() {
  console.log(`[USER-DEBUG] Saving user: ${this.discord_id}, username: ${this.discord_username}`);
  return originalSave.apply(this, arguments);
};

module.exports = User;