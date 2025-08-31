const express = require('express');
const router = express.Router();
const ApplicationTemplate = require('../models/ApplicationTemplate');
const ApplicationSubmission = require('../models/ApplicationSubmission');

// Auth middleware - check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  
  // Check token from cookie
  if (req.cookies && req.cookies.skyrden_auth) {
    try {
      const decoded = jwt.verify(req.cookies.skyrden_auth, process.env.JWT_SECRET || 'skyrden-jwt-secret-key');
      if (decoded && decoded.id) {
        req.user = {
          discord_id: decoded.id,
          discord_username: decoded.username || 'Discord User',
          roblox_username: decoded.roblox || null,
          is_admin: decoded.is_admin || false
        };
        return next();
      }
    } catch (e) {
      console.error('Auth token validation error:', e.message);
    }
  }
  
  return res.status(401).json({ error: 'Authentication required' });
};

// Admin auth middleware
const isAdmin = (req, res, next) => {
  if (!req.session || !req.session.user || !req.session.user.is_admin) {
    // Check token from cookie
    if (req.cookies && req.cookies.skyrden_auth) {
      try {
        const decoded = jwt.verify(req.cookies.skyrden_auth, process.env.JWT_SECRET || 'skyrden-jwt-secret-key');
        if (decoded && decoded.is_admin) {
          return next();
        }
      } catch (e) {
        console.error('Admin token validation error:', e.message);
      }
    }
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get all open application templates
router.get('/templates', isAuthenticated, async (req, res) => {
  try {
    const templates = await ApplicationTemplate.find({ status: 'open' }).select('name description requirements closureDate');
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch application templates' });
  }
});

// Get single application template details
router.get('/templates/:id', isAuthenticated, async (req, res) => {
  try {
    const template = await ApplicationTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Application template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch application template' });
  }
});

// Submit application
router.post('/submit', isAuthenticated, async (req, res) => {
  try {
    const { templateId, responses } = req.body;
    
    if (!templateId || !responses) {
      return res.status(400).json({ error: 'Template ID and responses are required' });
    }
    
    // Check if template exists and is open
    const template = await ApplicationTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Application template not found' });
    }
    
    if (template.status !== 'open') {
      return res.status(400).json({ error: 'This application is no longer accepting submissions' });
    }
    
    // Check if user has already applied
    const existingSubmission = await ApplicationSubmission.findOne({ 
      userId: req.user.discord_id,
      templateId: templateId
    });
    
    if (existingSubmission) {
      return res.status(400).json({ error: 'You have already submitted an application for this position' });
    }
    
    // Create submission
    const submission = new ApplicationSubmission({
      userId: req.user.discord_id,
      discordUsername: req.user.discord_username,
      robloxUsername: req.user.roblox_username,
      templateId,
      responses
    });
    
    await submission.save();
    
    res.status(201).json({ 
      message: 'Application submitted successfully',
      submissionId: submission._id
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Get user's submitted applications
router.get('/my-applications', isAuthenticated, async (req, res) => {
  try {
    const submissions = await ApplicationSubmission.find({ userId: req.user.discord_id })
      .populate('templateId', 'name')
      .select('templateId submissionDate status adminFeedback');
      
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching user applications:', error);
    res.status(500).json({ error: 'Failed to fetch your applications' });
  }
});

// Admin routes

// Get all templates (admin)
router.get('/admin/templates', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const templates = await ApplicationTemplate.find().sort({ createdDate: -1 });
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch application templates' });
  }
});

// Create new template (admin)
router.post('/admin/templates', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { name, description, fields, requirements, closureDate } = req.body;
    
    if (!name || !fields || !Array.isArray(fields)) {
      return res.status(400).json({ error: 'Name and fields are required' });
    }
    
    const template = new ApplicationTemplate({
      name,
      description,
      fields,
      requirements,
      closureDate,
      createdBy: req.user.discord_id,
      status: 'draft'
    });
    
    await template.save();
    
    res.status(201).json({ 
      message: 'Application template created successfully',
      templateId: template._id
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create application template' });
  }
});

// Update template (admin)
router.put('/admin/templates/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { name, description, fields, requirements, closureDate, status } = req.body;
    
    const template = await ApplicationTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Application template not found' });
    }
    
    // Update fields
    if (name) template.name = name;
    if (description) template.description = description;
    if (fields) template.fields = fields;
    if (requirements) template.requirements = requirements;
    if (closureDate) template.closureDate = closureDate;
    if (status) template.status = status;
    
    await template.save();
    
    res.json({ 
      message: 'Application template updated successfully',
      template
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update application template' });
  }
});

// Delete template (admin)
router.delete('/admin/templates/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const result = await ApplicationTemplate.findByIdAndDelete(req.params.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Application template not found' });
    }
    
    res.json({ message: 'Application template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete application template' });
  }
});

// Get all submissions (admin)
router.get('/admin/submissions', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { templateId, status, sortBy = 'submissionDate', order = 'desc' } = req.query;
    
    const query = {};
    if (templateId) query.templateId = templateId;
    if (status) query.status = status;
    
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort = {};
    sort[sortBy] = sortOrder;
    
    const submissions = await ApplicationSubmission.find(query)
      .populate('templateId', 'name')
      .sort(sort);
      
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch application submissions' });
  }
});

// Get single submission (admin)
router.get('/admin/submissions/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const submission = await ApplicationSubmission.findById(req.params.id)
      .populate('templateId');
      
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    res.json(submission);
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ error: 'Failed to fetch application submission' });
  }
});

// Review submission (admin)
router.post('/admin/submissions/:id/review', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { status, adminFeedback, sendNotification } = req.body;
    
    if (!status || !['approved', 'denied'].includes(status)) {
      return res.status(400).json({ error: 'Valid status (approved/denied) is required' });
    }
    
    const submission = await ApplicationSubmission.findById(req.params.id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    submission.status = status;
    submission.adminFeedback = adminFeedback || '';
    submission.reviewedBy = req.user.discord_id;
    
    if (sendNotification) {
      submission.notificationSent = true;
      // TODO: Send Discord notification
    }
    
    await submission.save();
    
    res.json({ 
      message: 'Application reviewed successfully',
      notificationSent: sendNotification
    });
  } catch (error) {
    console.error('Error reviewing submission:', error);
    res.status(500).json({ error: 'Failed to review application submission' });
  }
});

// Send all pending notifications
router.post('/admin/send-notifications', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const submissions = await ApplicationSubmission.find({
      status: { $in: ['approved', 'denied'] },
      notificationSent: false,
      reviewedBy: { $exists: true }
    });
    
    if (submissions.length === 0) {
      return res.json({ message: 'No pending notifications to send' });
    }
    
    // TODO: Send Discord notifications
    
    // Mark as sent
    const updateResults = await ApplicationSubmission.updateMany(
      { _id: { $in: submissions.map(s => s._id) } },
      { $set: { notificationSent: true } }
    );
    
    res.json({ 
      message: `Sent ${submissions.length} notifications successfully`
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

module.exports = router;