const mongoose = require('mongoose');

const AdminWhitelistSchema = new mongoose.Schema({
  discord_id: {
    type: String,
    required: true,
    unique: true
  },
  added_by: {
    type: String,
    default: 'system'
  },
  added_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AdminWhitelist', AdminWhitelistSchema);