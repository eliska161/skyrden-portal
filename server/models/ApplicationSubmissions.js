const mongoose = require('mongoose');

const ResponseSchema = new mongoose.Schema({
  fieldId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  answer: mongoose.Schema.Types.Mixed // Can be string, boolean, array, etc.
});

const ApplicationSubmissionSchema = new mongoose.Schema({
  userId: {
    type: String, // Discord ID
    required: true
  },
  discordUsername: {
    type: String,
    required: true
  },
  robloxUsername: String,
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApplicationTemplate',
    required: true
  },
  submissionDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending'
  },
  responses: [ResponseSchema],
  adminFeedback: String,
  reviewedBy: String, // Discord ID of admin who reviewed
  notificationSent: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('ApplicationSubmission', ApplicationSubmissionSchema);