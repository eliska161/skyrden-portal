const mongoose = require('mongoose');

const ApplicationFormSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  fields: {
    type: Array,
    required: true
  },
  options: {
    type: Object,
    default: {}
  },
  is_active: {
    type: Boolean,
    default: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  deadline: {
    type: Date,
    default: null
  },
  application_limit: {
    type: Number,
    default: 1
  }
});

module.exports = mongoose.model('ApplicationForm', ApplicationFormSchema);