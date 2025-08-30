const express = require('express');
const router = express.Router();

// Import models
const User = require('../models/User');
const ApplicationForm = require('../models/ApplicationForm');
const ApplicationResponse = require('../models/ApplicationResponse');
const AdminWhitelist = require('../models/AdminWhitelist');

// Import Discord bot helper for notifications
const { 
  sendApplicationNotification, 
  sendAllPendingNotifications, 
  updateBotConfig, 
  getBotConfig 
} = require('../bot/discord-bot');

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get all applications with related data
router.get('/applications', requireAdmin, async (req, res) => {
  try {
    // Get all applications with populated fields
    const applications = await ApplicationResponse.find()
      .sort({ created_at: -1 })
      .populate('user_id', 'discord_username roblox_username')
      .populate('application_form_id', 'title')
      .populate('reviewed_by', 'discord_username');
    
    // Format the applications for the frontend
    const formattedApplications = applications.map(app => {
      const appObj = app.toObject();
      
      // Add user information
      if (app.user_id) {
        appObj.discord_username = app.user_id.discord_username;
        appObj.roblox_username = app.user_id.roblox_username;
      }
      
      // Add form title
      if (app.application_form_id) {
        appObj.form_title = app.application_form_id.title;
      }
      
      // Add reviewer username
      if (app.reviewed_by) {
        appObj.reviewed_by_username = app.reviewed_by.discord_username;
      }
      
      return appObj;
    });
    
    res.json(formattedApplications);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all application forms
router.get('/forms', requireAdmin, async (req, res) => {
  try {
    const forms = await ApplicationForm.find().sort({ created_at: -1 });
    res.json(forms);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new application form
router.post('/forms', requireAdmin, async (req, res) => {
  try {
    const formData = req.body;
    
    // Validate required fields
    if (!formData.title || !formData.description || !formData.fields || !formData.fields.length) {
      return res.status(400).json({ error: 'Missing required form fields' });
    }
    
    // Create new form
    const newForm = new ApplicationForm({
      title: formData.title,
      description: formData.description,
      fields: formData.fields,
      options: formData.options || {},
      is_active: formData.is_active !== undefined ? formData.is_active : true,
      deadline: formData.deadline || null,
      application_limit: formData.application_limit || 1
    });
    
    await newForm.save();
    
    res.status(201).json({
      success: true,
      message: 'Form created successfully',
      form_id: newForm._id
    });
  } catch (error) {
    console.error('Error creating form:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update application form
router.put('/forms/:id', requireAdmin, async (req, res) => {
  try {
    const formId = req.params.id;
    const formData = req.body;
    
    // Validate form existence
    const existingForm = await ApplicationForm.findById(formId);
    if (!existingForm) {
      return res.status(404).json({ error: 'Form not found' });
    }
    
    // Update form fields
    existingForm.title = formData.title || existingForm.title;
    existingForm.description = formData.description || existingForm.description;
    existingForm.fields = formData.fields || existingForm.fields;
    existingForm.options = formData.options || existingForm.options;
    existingForm.is_active = formData.is_active !== undefined ? formData.is_active : existingForm.is_active;
    existingForm.deadline = formData.deadline || existingForm.deadline;
    existingForm.application_limit = formData.application_limit || existingForm.application_limit;
    
    await existingForm.save();
    
    res.json({
      success: true,
      message: 'Form updated successfully'
    });
  } catch (error) {
    console.error('Error updating form:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete application form
router.delete('/forms/:id', requireAdmin, async (req, res) => {
  try {
    const formId = req.params.id;
    
    // Check if form exists
    const form = await ApplicationForm.findById(formId);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    
    // Check if there are any applications using this form
    const applicationsCount = await ApplicationResponse.countDocuments({ application_form_id: formId });
    if (applicationsCount > 0) {
      // Don't delete, just deactivate
      form.is_active = false;
      await form.save();
      
      return res.json({
        success: true,
        message: 'Form has existing applications. Form has been deactivated instead of deleted.'
      });
    }
    
    // If no applications, delete the form
    await ApplicationForm.findByIdAndDelete(formId);
    
    res.json({
      success: true,
      message: 'Form deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting form:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Review application with notification options
router.post('/review', requireAdmin, async (req, res) => {
  const { applicationId, status, feedback, sendNotification, customMessage } = req.body;
  
  try {
    // Find the application
    const application = await ApplicationResponse.findById(applicationId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Update application status
    application.status = status;
    application.admin_feedback = feedback;
    application.reviewed_by = req.user._id;
    application.reviewed_at = new Date();
    application.notification_sent = sendNotification ? true : false;
    
    await application.save();
    
    // Send notification immediately if requested
    if (sendNotification) {
      // Get additional data for the notification
      const populatedApp = await ApplicationResponse.findById(applicationId)
        .populate('application_form_id', 'title')
        .populate('user_id', 'discord_id');
      
      // Create notification data object
      const notificationData = {
        id: populatedApp._id,
        status: populatedApp.status,
        form_title: populatedApp.application_form_id.title,
        user_id: populatedApp.user_id._id,
        discord_id: populatedApp.user_id.discord_id,
        admin_feedback: populatedApp.admin_feedback,
        created_at: populatedApp.created_at
      };
      
      const notificationSent = await sendApplicationNotification(notificationData, customMessage);
      
      if (!notificationSent) {
        console.warn('Failed to send immediate notification');
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Application reviewed' + (sendNotification ? ' and notification sent' : ''),
      notificationSent: sendNotification
    });
    
  } catch (error) {
    console.error('Review failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin whitelist
router.get('/whitelist', requireAdmin, async (req, res) => {
  try {
    const whitelist = await AdminWhitelist.find().sort({ added_at: -1 });
    
    // Get Discord usernames for each entry if possible
    const whitelistWithUsernames = await Promise.all(whitelist.map(async (entry) => {
      const user = await User.findOne({ discord_id: entry.discord_id });
      return {
        ...entry.toObject(),
        discord_username: user ? user.discord_username : 'Unknown User',
        has_account: !!user
      };
    }));
    
    res.json(whitelistWithUsernames);
  } catch (error) {
    console.error('Error fetching whitelist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add user to admin whitelist
router.post('/whitelist', requireAdmin, async (req, res) => {
  const { discord_id } = req.body;
  
  if (!discord_id) {
    return res.status(400).json({ error: 'Discord ID is required' });
  }
  
  try {
    // Check if already in whitelist
    const existing = await AdminWhitelist.findOne({ discord_id });
    if (existing) {
      return res.status(400).json({ error: 'User already in whitelist' });
    }
    
    // Add to whitelist
    const whitelistEntry = new AdminWhitelist({
      discord_id,
      added_by: req.user.discord_username || 'Unknown',
      added_at: new Date()
    });
    
    await whitelistEntry.save();
    
    // If user already exists in the database, update their admin status
    const user = await User.findOne({ discord_id });
    if (user) {
      user.is_admin = true;
      await user.save();
    }
    
    res.status(201).json({
      success: true,
      message: 'User added to admin whitelist',
      user_updated: !!user
    });
  } catch (error) {
    console.error('Error adding to whitelist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove user from admin whitelist
router.delete('/whitelist/:discord_id', requireAdmin, async (req, res) => {
  const { discord_id } = req.params;
  
  try {
    // Remove from whitelist
    const result = await AdminWhitelist.findOneAndDelete({ discord_id });
    
    if (!result) {
      return res.status(404).json({ error: 'User not found in whitelist' });
    }
    
    // Update user if they exist
    const user = await User.findOne({ discord_id });
    if (user) {
      user.is_admin = false;
      await user.save();
    }
    
    res.json({
      success: true,
      message: 'User removed from admin whitelist',
      user_updated: !!user
    });
  } catch (error) {
    console.error('Error removing from whitelist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get notification settings
router.get('/notifications/config', requireAdmin, async (req, res) => {
  try {
    const config = await getBotConfig();
    res.json(config);
  } catch (error) {
    console.error('Error getting notification config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update notification settings
router.post('/notifications/config', requireAdmin, async (req, res) => {
  const { defaultMessage, botToken, enabled } = req.body;
  
  try {
    const success = await updateBotConfig({
      defaultMessage,
      botToken,
      enabled
    });
    
    if (success) {
      res.json({
        success: true,
        message: 'Notification settings updated'
      });
    } else {
      res.status(500).json({ error: 'Failed to update notification settings' });
    }
  } catch (error) {
    console.error('Error updating notification config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending notifications count
router.get('/notifications/pending', requireAdmin, async (req, res) => {
  try {
    const pendingCount = await ApplicationResponse.countDocuments({
      status: { $in: ['approved', 'rejected'] },
      notification_sent: false,
      reviewed_at: { $exists: true }
    });
    
    res.json({ count: pendingCount });
  } catch (error) {
    console.error('Error counting pending notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send all pending notifications
router.post('/notifications/send-all', requireAdmin, async (req, res) => {
  try {
    const result = await sendAllPendingNotifications();
    
    res.json({
      success: true,
      message: `Sent ${result.success} notifications, ${result.failed} failed`,
      results: result
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;