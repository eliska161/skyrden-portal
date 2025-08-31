const mongoose = require('mongoose');

// Schema for recruitment portal users
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
  github_id: {
    type: String,
    default: null
  },
  github_username: {
    type: String,
    default: null
  },
  github_avatar: {
    type: String,
    default: null
  },
  github_name: {
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
  },
  applications: [{
    position: String,
    experience: String,
    skills: String,
    why_join: String,
    availability: String,
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'interview', 'offer', 'rejected'],
      default: 'submitted'
    },
    submitted_at: {
      type: Date,
      default: Date.now
    },
    notes: String
  }]
});

// Helper methods
UserSchema.methods.updateLastLogin = function() {
  this.last_login = Date.now();
  return this.save();
};

// Add application method
UserSchema.methods.addApplication = function(applicationData) {
  this.applications.push({
    position: applicationData.position,
    experience: applicationData.experience,
    skills: applicationData.skills,
    why_join: applicationData.whyJoin,
    availability: applicationData.availability,
    submitted_at: new Date(),
    status: 'submitted'
  });
  
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