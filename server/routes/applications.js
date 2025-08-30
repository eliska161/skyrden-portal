const express = require('express');
const router = express.Router();

// Import mongoose models
const ApplicationForm = require('../models/ApplicationForm');
const ApplicationResponse = require('../models/ApplicationResponse');
const User = require('../models/User');

// Check if user is authenticated middleware
const isAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// Get active application forms with user's application count
router.get('/forms', isAuthenticated, async (req, res) => {
  try {
    // Get active forms using Mongoose
    const forms = await ApplicationForm.find({ is_active: true });
    
    const formsWithCounts = await Promise.all(forms.map(async (form) => {
      // Get user's application count for this form
      const count = await ApplicationResponse.countDocuments({
        application_form_id: form._id,
        user_id: req.user._id
      });
      
      // Convert MongoDB document to plain object
      const formData = form.toObject();
      
      // Add application count and determine if user can apply
      formData.user_application_count = count;
      formData.can_apply = true;
      
      // Check if user reached application limit
      if (form.application_limit && count >= form.application_limit) {
        formData.can_apply = false;
      }
      
      // Check if deadline has passed
      if (form.deadline && new Date(form.deadline) < new Date()) {
        formData.can_apply = false;
      }
      
      return formData;
    }));
    
    res.json(formsWithCounts);
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's submitted applications
router.get('/my-applications', isAuthenticated, async (req, res) => {
  try {
    // Find all applications submitted by the user
    const applications = await ApplicationResponse.find({ user_id: req.user._id })
      .sort({ created_at: -1 })
      .populate('application_form_id', 'title description') // Get form title and description
      .populate('reviewed_by', 'discord_username'); // Get reviewer username
    
    // Transform data for frontend
    const formattedApplications = applications.map(app => {
      const appObj = app.toObject();
      
      // Add form title from the populated field
      if (app.application_form_id) {
        appObj.form_title = app.application_form_id.title;
        appObj.form_description = app.application_form_id.description;
      }
      
      // Add reviewer username if available
      if (app.reviewed_by) {
        appObj.reviewed_by_username = app.reviewed_by.discord_username;
      }
      
      return appObj;
    });
    
    res.json(formattedApplications);
  } catch (error) {
    console.error('Error fetching user applications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit application with validation
router.post('/submit', isAuthenticated, async (req, res) => {
  const { application_form_id, application_data } = req.body;
  
  // Validate required fields
  if (!application_form_id || !application_data) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    // Check if form exists and is active
    const form = await ApplicationForm.findOne({ 
      _id: application_form_id,
      is_active: true 
    });
    
    if (!form) {
      return res.status(404).json({ error: 'Form not found or inactive' });
    }
    
    // Check if user has Roblox account linked
    const user = await User.findById(req.user._id);
    if (!user.roblox_username) {
      return res.status(403).json({ error: 'Roblox account required' });
    }
    
    // Check if user has reached application limit
    if (form.application_limit) {
      const applicationCount = await ApplicationResponse.countDocuments({
        user_id: req.user._id,
        application_form_id: application_form_id
      });
      
      if (applicationCount >= form.application_limit) {
        return res.status(403).json({ error: 'Application limit reached' });
      }
    }
    
    // Check if deadline has passed
    if (form.deadline && new Date(form.deadline) < new Date()) {
      return res.status(403).json({ error: 'Application deadline has passed' });
    }
    
    // Validate required fields in application data based on form definition
    const requiredFieldsMissing = [];
    form.fields.forEach(field => {
      if (field.required && !application_data[field.id]) {
        requiredFieldsMissing.push(field.question);
      }
    });
    
    if (requiredFieldsMissing.length > 0) {
      return res.status(400).json({ 
        error: 'Required fields missing', 
        fields: requiredFieldsMissing 
      });
    }
    
    // Create new application response
    const newApplication = new ApplicationResponse({
      user_id: req.user._id,
      application_form_id: application_form_id,
      responses: application_data,
      status: 'pending',
      created_at: new Date()
    });
    
    await newApplication.save();
    
    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application_id: newApplication._id
    });
    
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific application form
router.get('/form/:id', isAuthenticated, async (req, res) => {
  try {
    const form = await ApplicationForm.findOne({ 
      _id: req.params.id,
      is_active: true 
    });
    
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    
    res.json(form);
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific application response
router.get('/application/:id', isAuthenticated, async (req, res) => {
  try {
    const application = await ApplicationResponse.findOne({
      _id: req.params.id,
      user_id: req.user._id
    }).populate('application_form_id');
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    res.json(application);
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;