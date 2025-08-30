const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ApplicationResponseSchema = new mongoose.Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  application_form_id: {
    type: Schema.Types.ObjectId,
    ref: 'ApplicationForm',
    required: true
  },
  responses: {
    type: Object,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  admin_feedback: {
    type: String,
    default: null
  },
  reviewed_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewed_at: {
    type: Date,
    default: null
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  notification_sent: {
    type: Boolean,
    default: false
  },
  notification_sent_at: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('ApplicationResponse', ApplicationResponseSchema);