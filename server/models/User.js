const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  discord_id: {
    type: String,
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

// Add a method to update last login
UserSchema.methods.updateLastLogin = function() {
  this.last_login = Date.now();
  return this.save();
};

module.exports = mongoose.model('User', UserSchema);