const express = require('express');
const db = require('../database/db');
const router = express.Router();

// Get active application forms with user's application count
router.get('/forms', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        // Get active forms
        db.all('SELECT * FROM application_forms WHERE is_active = 1', async (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            const formsWithCounts = await Promise.all(rows.map(async (form) => {
                // Get user's application count for this form
                return new Promise((resolve) => {
                    db.get(
                        'SELECT COUNT(*) as count FROM application_responses WHERE application_form_id = ? AND user_id = ?',
                        [form.id, req.user.id],
                        (err, result) => {
                            if (err) {
                                console.error('Error counting applications:', err);
                                resolve({ ...form, user_application_count: 0 });
                            } else {
                                const formData = {
                                    ...form,
                                    fields: JSON.parse(form.fields),
                                    options: form.options ? JSON.parse(form.options) : null,
                                    user_application_count: result.count,
                                    can_apply: true
                                };

                                // Check if user reached application limit
                                if (form.application_limit && result.count >= form.application_limit) {
                                    formData.can_apply = false;
                                }

                                // Check if deadline has passed
                                if (form.deadline && new Date(form.deadline) < new Date()) {
                                    formData.can_apply = false;
                                }

                                resolve(formData);
                            }
                        }
                    );
                });
            }));
            
            res.json(formsWithCounts);
        });
    } catch (error) {
        console.error('Error fetching forms:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's submitted applications
router.get('/my-applications', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const query = `
        SELECT ar.*, af.title as form_title, af.description as form_description,
               reviewer.discord_username as reviewed_by_username
        FROM application_responses ar
        JOIN application_forms af ON ar.application_form_id = af.id
        LEFT JOIN users reviewer ON ar.reviewed_by = reviewer.id
        WHERE ar.user_id = ?
        ORDER BY ar.created_at DESC
    `;

    db.all(query, [req.user.id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const applications = rows.map(app => ({
            ...app,
            responses: JSON.parse(app.responses)
        }));

        res.json(applications);
    });
});

// Submit application with validation
router.post('/submit', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { application_form_id, application_data } = req.body;

    // Validate required fields
    if (!application_form_id || !application_data) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if form exists and is active
    db.get('SELECT * FROM application_forms WHERE id = ? AND is_active = 1', [application_form_id], (err, form) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!form) {
            return res.status(404).json({ error: 'Application form not found or inactive' });
        }

        // Check application limit
        db.get(
            'SELECT COUNT(*) as count FROM application_responses WHERE application_form_id = ? AND user_id = ?',
            [application_form_id, req.user.id],
            (err, result) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                if (form.application_limit && result.count >= form.application_limit) {
                    return res.status(400).json({ error: 'Application limit reached' });
                }

                // Check deadline
                if (form.deadline && new Date(form.deadline) < new Date()) {
                    return res.status(400).json({ error: 'Application deadline has passed' });
                }

                // Auto-fill Discord and Roblox usernames
                const enhancedData = { ...application_data };
                enhancedData.discord_username = req.user.discord_username;
                enhancedData.roblox_username = req.user.roblox_username;

                // Insert application
                db.run(
                    `INSERT INTO application_responses (application_form_id, user_id, responses) 
                     VALUES (?, ?, ?)`,
                    [application_form_id, req.user.id, JSON.stringify(enhancedData)],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        
                        res.json({ 
                            success: true, 
                            message: 'Application submitted successfully',
                            applicationId: this.lastID
                        });
                    }
                );
            }
        );
    });
});

module.exports = router;