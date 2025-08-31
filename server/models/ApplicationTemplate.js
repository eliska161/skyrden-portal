const mongoose = require('mongoose');

const FormFieldSchema = new mongoose.Schema({
  fieldType: {
    type: String,
    enum: ['short_text', 'long_text', 'paragraph', 'multiple_choice', 'checkbox', 'dropdown', 'discord_username', 'roblox_username'],
    required: true
  },
  label: {
    type: String,
    required: true
  },
  placeholder: String,
  required: {
    type: Boolean,
    default: false
  },
  options: [String], // For multiple choice, checkbox, dropdown
  orderIndex: {
    type: Number,
    default: 0
  }
});

const ApplicationTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  status: {
    type: String,
    enum: ['draft', 'open', 'closed'],
    default: 'draft'
  },
  fields: [FormFieldSchema],
  createdDate: {
    type: Date,
    default: Date.now
  },
  closureDate: Date,
  requirements: String,
  createdBy: {
    type: String, // Discord ID of admin
    required: true
  }
});

module.exports = mongoose.model('ApplicationTemplate', ApplicationTemplateSchema);