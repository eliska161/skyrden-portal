const express = require('express');
const db = require('../database/db');
const { sendApplicationNotification, sendAllPendingNotifications, updateBotConfig, getBotConfig } = require('../bot/discord-bot');
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

// Review application with notification options
router.post('/review', requireAdmin, async (req, res) => {
    const { applicationId, status, feedback, sendNotification, customMessage } = req.body;
    
    try {
        // Update application status
        db.run(
            `UPDATE application_responses 
             SET status = ?, admin_feedback = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
                 notification_sent = ? 
             WHERE id = ?`,
            [status, feedback, req.user.id, sendNotification ? 1 : 0, applicationId],
            async function(err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                // Send notification immediately if requested
                if (sendNotification) {
                    const application = await new Promise((resolve, reject) => {
                        db.get(`
                            SELECT ar.*, af.title as form_title 
                            FROM application_responses ar
                            JOIN application_forms af ON ar.application_form_id = af.id
                            WHERE ar.id = ?
                        `, [applicationId], (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });
                    
                    if (application) {
                        const notificationSent = await sendApplicationNotification(application, customMessage);
                        if (!notificationSent) {
                            console.warn('Failed to send immediate notification');
                        }
                    }
                }
                
                res.json({ 
                    success: true, 
                    message: 'Application reviewed' + (sendNotification ? ' and notification sent' : ''),
                    notificationSent: sendNotification
                });
            }
        );
    } catch (error) {
        console.error('Review failed:', error);
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
        console.error('Failed to send all notifications:', error);
        res.status(500).json({ error: 'Failed to send notifications' });
    }
});

// Get pending notification count
router.get('/notifications/pending', requireAdmin, (req, res) => {
    db.get(`
        SELECT COUNT(*) as count 
        FROM application_responses 
        WHERE status IN ('approved', 'rejected') 
        AND notification_sent = 0
        AND admin_feedback IS NOT NULL
    `, (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ pendingCount: row.count });
    });
});

// Update bot configuration
router.post('/notifications/config', requireAdmin, (req, res) => {
    const { defaultMessage, botToken } = req.body;
    
    updateBotConfig({
        defaultMessage: defaultMessage || getBotConfig().defaultMessage,
        botToken: botToken || getBotConfig().botToken
    });
    
    res.json({ success: true, message: 'Bot configuration updated' });
});

// Get bot configuration
router.get('/notifications/config', requireAdmin, (req, res) => {
    res.json(getBotConfig());
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