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
  roblox_id: {
    type: String,
    default: null
  },
  roblox_username: {
    type: String,
    default: null
  },
  roblox_access_token: {
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
  }
});

module.exports = mongoose.model('User', UserSchema);