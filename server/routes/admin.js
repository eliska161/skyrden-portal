const express = require('express');
const db = require('../database/db');
const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
    if (!req.isAuthenticated() || !req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Get all applications with better formatting
router.get('/applications', requireAdmin, (req, res) => {
    const query = `
        SELECT ar.*, u.discord_username, u.roblox_username, af.title as form_title,
               reviewer.discord_username as reviewed_by_username
        FROM application_responses ar
        JOIN users u ON ar.user_id = u.id
        LEFT JOIN application_forms af ON ar.application_form_id = af.id
        LEFT JOIN users reviewer ON ar.reviewed_by = reviewer.id
        ORDER BY ar.created_at DESC
    `;
    
    db.all(query, (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: err.message });
        }
        
        // Parse JSON fields
        const applications = rows.map(app => ({
            ...app,
            responses: JSON.parse(app.responses),
            application_data: JSON.parse(app.responses)
        }));
        
        res.json(applications);
    });
});

// Review application
router.post('/review', requireAdmin, (req, res) => {
    const { applicationId, status, feedback } = req.body;
    
    db.run(
        `UPDATE application_responses 
         SET status = ?, admin_feedback = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [status, feedback, req.user.id, applicationId],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: err.message });
            }
            
            res.json({ success: true, message: 'Application reviewed' });
        }
    );
});

// Get all application forms
router.get('/forms', requireAdmin, (req, res) => {
    db.all('SELECT * FROM application_forms ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: err.message });
        }
        
        const forms = rows.map(form => ({
            ...form,
            fields: JSON.parse(form.fields),
            options: form.options ? JSON.parse(form.options) : null
        }));
        
        res.json(forms);
    });
});

// Create new application form with enhanced fields
router.post('/forms', requireAdmin, (req, res) => {
    const { title, description, fields, options, deadline, application_limit } = req.body;
    
    db.run(
        'INSERT INTO application_forms (title, description, fields, options, deadline, application_limit, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [title, description, JSON.stringify(fields), JSON.stringify(options), deadline, application_limit, req.user.id],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: err.message });
            }
            
            res.json({ 
                success: true, 
                message: 'Form created',
                formId: this.lastID 
            });
        }
    );
});

// Update application form with enhanced fields
router.put('/forms/:id', requireAdmin, (req, res) => {
    const { title, description, fields, options, deadline, application_limit, is_active } = req.body;
    
    db.run(
        `UPDATE application_forms 
         SET title = ?, description = ?, fields = ?, options = ?, deadline = ?, application_limit = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [title, description, JSON.stringify(fields), JSON.stringify(options), deadline, application_limit, is_active, req.params.id],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: err.message });
            }
            
            res.json({ success: true, message: 'Form updated' });
        }
    );
});

// Delete application form
router.delete('/forms/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM application_forms WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ success: true, message: 'Form deleted' });
    });
});

// Get admin whitelist
router.get('/whitelist', requireAdmin, (req, res) => {
    db.all('SELECT * FROM admin_whitelist', (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Add to admin whitelist
router.post('/whitelist', requireAdmin, (req, res) => {
    const { discord_id } = req.body;
    
    db.run(
        'INSERT OR IGNORE INTO admin_whitelist (discord_id) VALUES (?)',
        [discord_id],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: err.message });
            }
            
            res.json({ success: true, message: 'Added to whitelist' });
        }
    );
});

// Remove from admin whitelist
router.delete('/whitelist/:discord_id', requireAdmin, (req, res) => {
    db.run('DELETE FROM admin_whitelist WHERE discord_id = ?', [req.params.discord_id], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ success: true, message: 'Removed from whitelist' });
    });
});

module.exports = router;