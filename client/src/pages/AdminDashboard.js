import React, { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL;

const AdminDashboard = () => {
    const [user, setUser] = useState(null);
    const [applications, setApplications] = useState([]);
    const [applicationForms, setApplicationForms] = useState([]);
    const [whitelist, setWhitelist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('applications');
    const [selectedApp, setSelectedApp] = useState(null);
    const [feedback, setFeedback] = useState('');
    const [newDiscordId, setNewDiscordId] = useState('');
    const [notificationConfig, setNotificationConfig] = useState({
    defaultMessage: 'Your application has been reviewed!',
    botToken: ''
});
const [pendingNotifications, setPendingNotifications] = useState(0);
const [customMessage, setCustomMessage] = useState('');

    // Form builder state
    const [newForm, setNewForm] = useState({
        title: '',
        description: '',
        fields: [],
        options: {},
        deadline: '',
        application_limit: 1
    });
    const [currentField, setCurrentField] = useState({
        type: 'text',
        question: '',
        required: false,
        options: []
    });
    const [currentOption, setCurrentOption] = useState('');

    useEffect(() => {
        checkAdminStatus();
    }, []);

    useEffect(() => {
    if (user && user.is_admin) {
        loadData();
    }
}, [user, activeTab, loadData]);

    useEffect(() => {
    // Load notification config and pending count
    if (user && user.is_admin) {
        fetchNotificationConfig();
        fetchPendingNotifications();
    }
}, [user, activeTab]);

    const checkAdminStatus = async () => {
        try {
            const response = await fetch(`${API_URL}/api/auth/status`, {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.authenticated) {
                setUser(data.user);
                if (!data.user.is_admin) {
                    window.location.href = '/?error=not_admin';
                    return;
                }
            } else {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/';
        } finally {
            setLoading(false);
        }
    };

    const loadData = useCallback(async () => {
    try {
        if (activeTab === 'applications') {
            const response = await fetch('http://localhost:5001/api/admin/applications', {
                credentials: 'include'
            });
            const data = await response.json();
            setApplications(data);
        } else if (activeTab === 'forms') {
            const response = await fetch('http://localhost:5001/api/admin/forms', {
                credentials: 'include'
            });
            const data = await response.json();
            setApplicationForms(data);
        } else if (activeTab === 'whitelist') {
            const response = await fetch('http://localhost:5001/api/admin/whitelist', {
                credentials: 'include'
            });
            const data = await response.json();
            setWhitelist(data);
        }
    } catch (error) {
        console.error('Failed to fetch data:', error);
    }
}, [activeTab]);


    const addOptionToField = () => {
        if (!currentOption) return;
        setCurrentField(prev => ({
            ...prev,
            options: [...prev.options, currentOption]
        }));
        setCurrentOption('');
    };

    const removeOption = (index) => {
        setCurrentField(prev => ({
            ...prev,
            options: prev.options.filter((_, i) => i !== index)
        }));
    };

    const addFieldToForm = () => {
        if (!currentField.question) return;
        
        const fieldToAdd = { 
            ...currentField, 
            id: Date.now(),
            options: currentField.type === 'multiple_choice' ? currentField.options : undefined
        };
        
        setNewForm(prev => ({
            ...prev,
            fields: [...prev.fields, fieldToAdd]
        }));
        
        setCurrentField({
            type: 'text',
            question: '',
            required: false,
            options: []
        });
    };

    const removeField = (index) => {
        setNewForm(prev => ({
            ...prev,
            fields: prev.fields.filter((_, i) => i !== index)
        }));
    };

    const createForm = async () => {
        if (!newForm.title || newForm.fields.length === 0) {
            alert('Please add a title and at least one field');
            return;
        }

        try {
            const response = await fetch(`${config.API_URL}/api/admin/forms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(newForm)
            });

            if (response.ok) {
                setNewForm({
                    title: '',
                    description: '',
                    fields: [],
                    options: {},
                    deadline: '',
                    application_limit: 1
                });
                loadData();
                alert('Form created successfully!');
            }
        } catch (error) {
            console.error('Form creation failed:', error);
        }
    };

    const addToWhitelist = async () => {
        if (!newDiscordId) return;

        try {
            const response = await fetch(`${config.API_URL}/api/admin/whitelist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ discord_id: newDiscordId })
            });

            if (response.ok) {
                setNewDiscordId('');
                loadData();
                alert('Added to whitelist!');
            }
        } catch (error) {
            console.error('Failed to add to whitelist:', error);
        }
    };

    const removeFromWhitelist = async (discordId) => {
        try {
            const response = await fetch(`${config.API_URL}/api/admin/whitelist/${discordId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                loadData();
                alert('Removed from whitelist!');
            }
        } catch (error) {
            console.error('Failed to remove from whitelist:', error);
        }
    };

    const fetchNotificationConfig = async () => {
        try {
            const response = await fetch(`${config.API_URL}/api/admin/notifications/config`, {
                credentials: 'include'
            });
            const data = await response.json();
            setNotificationConfig(data);
        } catch (error) {
            console.error('Failed to fetch notification config:', error);
        }
    };

    const fetchPendingNotifications = async () => {
        try {
            const response = await fetch(`${config.API_URL}/api/admin/notifications/pending`, {
                credentials: 'include'
            });
            const data = await response.json();
            setPendingNotifications(data.pendingCount);
        } catch (error) {
            console.error('Failed to fetch pending notifications:', error);
        }
    };

    const handleReview = async (applicationId, status, sendNow = false) => {
        try {
            const response = await fetch(`${config.API_URL}/api/admin/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    applicationId,
                    status,
                    feedback: feedback || 'No feedback provided',
                    sendNotification: sendNow,
                    customMessage: sendNow ? customMessage : null
                })
            });

            if (response.ok) {
                setFeedback('');
                setCustomMessage('');
                setSelectedApp(null);
                loadData();
                fetchPendingNotifications();
                alert(`Application reviewed ${sendNow ? 'and notification sent' : ''} successfully!`);
            }
        } catch (error) {
            console.error('Review failed:', error);
        }
    };

    const sendAllNotifications = async () => {
        try {
            const response = await fetch(`${config.API_URL}/api/admin/notifications/send-all`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await response.json();
            alert(data.message);
            fetchPendingNotifications();
        } catch (error) {
            console.error('Failed to send all notifications:', error);
        }
    };

    const updateNotificationConfig = async () => {
        try {
            const response = await fetch(`${config.API_URL}/api/admin/notifications/config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(notificationConfig)
            });
            alert('Notification configuration updated!');
        } catch (error) {
            console.error('Failed to update config:', error);
        }
    };

    const updateFormStatus = async (formId, isActive) => {
        try {
            const response = await fetch(`${config.API_URL}/api/admin/forms/${formId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ is_active: isActive })
            });

            

            if (response.ok) {
                loadData();
                alert('Form status updated!');
            }
        } catch (error) {
            console.error('Failed to update form status:', error);
        }
    };

    if (loading) {
        return <div>Loading admin dashboard...</div>;
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '20px' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ 
                    background: '#002244', 
                    color: 'white', 
                    padding: '20px', 
                    borderRadius: '10px',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h1 style={{ margin: 0, fontSize: '24px' }}>Admin Dashboard</h1>
                    <span>Welcome, {user?.discord_username}</span>
                </div>

                {/* Navigation Tabs */}
<div style={{ 
    display: 'flex', 
    gap: '10px', 
    marginBottom: '20px',
    background: 'white',
    padding: '10px',
    borderRadius: '8px'
}}>
    <button 
        onClick={() => setActiveTab('applications')}
        style={{ 
            padding: '10px 20px',
            background: activeTab === 'applications' ? '#002244' : '#f1f5f9',
            color: activeTab === 'applications' ? 'white' : '#002244',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        }}
    >
        Applications
    </button>
    <button 
        onClick={() => setActiveTab('forms')}
        style={{ 
            padding: '10px 20px',
            background: activeTab === 'forms' ? '#002244' : '#f1f5f9',
            color: activeTab === 'forms' ? 'white' : '#002244',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        }}
    >
        Form Builder
    </button>
    <button 
        onClick={() => setActiveTab('whitelist')}
        style={{ 
            padding: '10px 20px',
            background: activeTab === 'whitelist' ? '#002244' : '#f1f5f9',
            color: activeTab === 'whitelist' ? 'white' : '#002244',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        }}
    >
        Admin Whitelist
    </button>
    <button 
        onClick={() => setActiveTab('notifications')}
        style={{ 
            padding: '10px 20px',
            background: activeTab === 'notifications' ? '#002244' : '#f1f5f9',
            color: activeTab === 'notifications' ? 'white' : '#002244',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            position: 'relative'
        }}
    >
        Notifications
        {pendingNotifications > 0 && (
            <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: '#dc2626',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {pendingNotifications}
            </span>
        )}
    </button>
</div>

                {/* Applications Tab */}
                {activeTab === 'applications' && (
                    <div style={{ 
                        background: 'white', 
                        padding: '20px', 
                        borderRadius: '10px',
                        marginBottom: '20px'
                    }}>
                        <h2 style={{ marginBottom: '20px', color: '#002244' }}>
                            Applications ({applications.length})
                        </h2>
                        
                        <div style={{ display: 'grid', gap: '15px' }}>
                            {applications.map(app => (
    <div key={app.id} style={{ 
        padding: '15px', 
        border: '1px solid #e2e8f0', 
        borderRadius: '8px',
        background: selectedApp?.id === app.id ? '#f0f9ff' : 'white'
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
                <h3 style={{ margin: '0 0 10px 0', color: '#002244' }}>
                    {app.discord_username} - {app.form_title}
                </h3>
                <p style={{ margin: '0 0 10px 0', color: '#64748b' }}>
                    Submitted: {new Date(app.created_at).toLocaleDateString()}
                </p>
                <div style={{ color: '#64748b', fontSize: '14px' }}>
                    Status: <span style={{ 
                        color: app.status === 'approved' ? '#059669' : 
                               app.status === 'rejected' ? '#dc2626' : '#d97706'
                    }}>
                        {app.status}
                    </span>
                    {app.status !== 'pending' && (
                        <span style={{ 
                            marginLeft: '15px',
                            color: app.notification_sent ? '#059669' : '#d97706'
                        }}>
                            Notification: {app.notification_sent ? 'Sent' : 'Pending'}
                        </span>
                    )}
                </div>
            </div>
            <button 
                onClick={() => setSelectedApp(app)}
                style={{
                    padding: '8px 16px',
                    background: '#002244',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
            >
                Review
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Form Builder Tab */}
                {activeTab === 'forms' && (
                    <div style={{ 
                        background: 'white', 
                        padding: '20px', 
                        borderRadius: '10px',
                        marginBottom: '20px'
                    }}>
                        <h2 style={{ marginBottom: '20px', color: '#002244' }}>Form Builder</h2>
                        
                        {/* New Form Creation */}
                        <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                            <h3 style={{ color: '#002244', marginBottom: '15px' }}>Create New Form</h3>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Form Title:</label>
                                    <input
                                        type="text"
                                        value={newForm.title}
                                        onChange={(e) => setNewForm({...newForm, title: e.target.value})}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                        placeholder="Enter form title"
                                    />
                                </div>
                                
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Application Limit:</label>
                                    <input
                                        type="number"
                                        value={newForm.application_limit}
                                        onChange={(e) => setNewForm({...newForm, application_limit: parseInt(e.target.value) || 1})}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                        placeholder="Max applications per user"
                                        min="1"
                                    />
                                </div>
                            </div>
                            
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Description:</label>
                                <textarea
                                    value={newForm.description}
                                    onChange={(e) => setNewForm({...newForm, description: e.target.value})}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', minHeight: '60px' }}
                                    placeholder="Enter form description"
                                />
                            </div>
                            
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Deadline:</label>
                                <input
                                    type="datetime-local"
                                    value={newForm.deadline}
                                    onChange={(e) => setNewForm({...newForm, deadline: e.target.value})}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                />
                            </div>
                            
                            {/* Field Builder */}
                            <div style={{ marginBottom: '15px' }}>
                                <h4 style={{ color: '#002244', marginBottom: '10px' }}>Add Field</h4>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto auto', gap: '10px', alignItems: 'end', marginBottom: '10px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Type:</label>
                                        <select
                                            value={currentField.type}
                                            onChange={(e) => setCurrentField({...currentField, type: e.target.value, options: e.target.value === 'multiple_choice' ? [] : undefined})}
                                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                        >
                                            <option value="text">Short Text</option>
                                            <option value="long_text">Long Text</option>
                                            <option value="multiple_choice">Multiple Choice</option>
                                            <option value="number">Number</option>
                                            <option value="email">Email</option>
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Question:</label>
                                        <input
                                            type="text"
                                            value={currentField.question}
                                            onChange={(e) => setCurrentField({...currentField, question: e.target.value})}
                                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                            placeholder="Enter question"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Required:</label>
                                        <input
                                            type="checkbox"
                                            checked={currentField.required}
                                            onChange={(e) => setCurrentField({...currentField, required: e.target.checked})}
                                            style={{ transform: 'scale(1.2)' }}
                                        />
                                    </div>
                                    
                                    <button
                                        onClick={addFieldToForm}
                                        disabled={!currentField.question}
                                        style={{
                                            padding: '8px 16px',
                                            background: !currentField.question ? '#9ca3af' : '#002244',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: !currentField.question ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        Add Field
                                    </button>
                                </div>

                                {/* Multiple Choice Options */}
                                {currentField.type === 'multiple_choice' && (
                                    <div style={{ marginTop: '15px', padding: '15px', background: '#f8fafc', borderRadius: '4px' }}>
                                        <h5 style={{ color: '#002244', marginBottom: '10px' }}>Multiple Choice Options</h5>
                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                            <input
                                                type="text"
                                                value={currentOption}
                                                onChange={(e) => setCurrentOption(e.target.value)}
                                                style={{ flex: 1, padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                                placeholder="Enter option"
                                            />
                                            <button
                                                onClick={addOptionToField}
                                                disabled={!currentOption}
                                                style={{
                                                    padding: '8px 16px',
                                                    background: !currentOption ? '#9ca3af' : '#059669',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: !currentOption ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                Add Option
                                            </button>
                                        </div>
                                        {currentField.options.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {currentField.options.map((option, index) => (
                                                    <span key={index} style={{ 
                                                        padding: '4px 8px', 
                                                        background: '#002244', 
                                                        color: 'white', 
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '5px'
                                                    }}>
                                                        {option}
                                                        <button
                                                            onClick={() => removeOption(index)}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                color: 'white',
                                                                cursor: 'pointer',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {/* Fields Preview */}
                            {newForm.fields.length > 0 && (
                                <div style={{ marginBottom: '15px' }}>
                                    <h4 style={{ color: '#002244', marginBottom: '10px' }}>Fields:</h4>
                                    {newForm.fields.map((field, index) => (
                                        <div key={field.id} style={{ 
                                            padding: '10px', 
                                            border: '1px solid #e2e8f0', 
                                            borderRadius: '4px',
                                            marginBottom: '5px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <div>
                                                <span>{field.question} ({field.type}) {field.required && '*'}</span>
                                                {field.options && (
                                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                                        Options: {field.options.join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => removeField(index)}
                                                style={{
                                                    padding: '4px 8px',
                                                    background: '#dc2626',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '2px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            <button
                                onClick={createForm}
                                disabled={!newForm.title || newForm.fields.length === 0}
                                style={{
                                    padding: '10px 20px',
                                    background: !newForm.title || newForm.fields.length === 0 ? '#9ca3af' : '#059669',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: !newForm.title || newForm.fields.length === 0 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Create Form
                            </button>
                        </div>
                        
                        {/* Existing Forms */}
                        <h3 style={{ color: '#002244', marginBottom: '15px' }}>Existing Forms</h3>
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {applicationForms && applicationForms.map(form => (
                                <div key={form.id} style={{ 
                                    padding: '15px', 
                                    border: '1px solid #e2e8f0', 
                                    borderRadius: '8px',
                                    background: form.is_active ? '#f0f9ff' : '#fef2f2'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                                        <div>
                                            <h4 style={{ margin: '0 0 5px 0', color: '#002244' }}>
                                                {form.title} {!form.is_active && '(Inactive)'}
                                            </h4>
                                            <p style={{ margin: '0 0 10px 0', color: '#64748b' }}>
                                                {form.description || 'No description'}
                                            </p>
                                            <div style={{ color: '#64748b', fontSize: '14px' }}>
                                                {form.fields ? form.fields.length : 0} field(s)
                                                Limit: {form.application_limit} • 
                                                Deadline: {form.deadline ? new Date(form.deadline).toLocaleDateString() : 'None'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => updateFormStatus(form.id, !form.is_active)}
                                            style={{
                                                padding: '6px 12px',
                                                background: form.is_active ? '#dc2626' : '#059669',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }}
                                        >
                                            {form.is_active ? 'Deactivate' : 'Activate'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Whitelist Tab */}
                {activeTab === 'whitelist' && (
                    <div style={{ 
                        background: 'white', 
                        padding: '20px', 
                        borderRadius: '10px',
                        marginBottom: '20px'
                    }}>
                        <h2 style={{ marginBottom: '20px', color: '#002244' }}>Admin Whitelist</h2>
                        
                        {/* Add to Whitelist */}
                        <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                            <h3 style={{ color: '#002244', marginBottom: '15px' }}>Add Admin</h3>
                            
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'end' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Discord ID:</label>
                                    <input
                                        type="text"
                                        value={newDiscordId}
                                        onChange={(e) => setNewDiscordId(e.target.value)}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                        placeholder="Enter Discord User ID"
                                    />
                                </div>
                                
                                <button
                                    onClick={addToWhitelist}
                                    disabled={!newDiscordId}
                                    style={{
                                        padding: '8px 16px',
                                        background: !newDiscordId ? '#9ca3af' : '#002244',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: !newDiscordId ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    Add Admin
                                </button>
                            </div>
                        </div>

                        {/* Notifications Tab */}
{activeTab === 'notifications' && (
    <div style={{ 
        background: 'white', 
        padding: '20px', 
        borderRadius: '10px',
        marginBottom: '20px'
    }}>
        <h2 style={{ marginBottom: '20px', color: '#002244' }}>Discord Notifications</h2>
        
        <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#002244', marginBottom: '15px' }}>Bot Configuration</h3>
            <div style={{ display: 'grid', gap: '15px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Discord Bot Token:
                    </label>
                    <input
                        type="password"
                        value={notificationConfig.botToken}
                        onChange={(e) => setNotificationConfig({...notificationConfig, botToken: e.target.value})}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        placeholder="Enter Discord bot token"
                    />
                    <p style={{ fontSize: '12px', color: '#64748b', marginTop: '5px' }}>
                        Get this from https://discord.com/developers/applications
                    </p>
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Default Message:
                    </label>
                    <textarea
                        value={notificationConfig.defaultMessage}
                        onChange={(e) => setNotificationConfig({...notificationConfig, defaultMessage: e.target.value})}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', minHeight: '60px' }}
                        placeholder="Default notification message"
                    />
                </div>
                <button
                    onClick={updateNotificationConfig}
                    style={{
                        padding: '10px 20px',
                        background: '#002244',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Save Configuration
                </button>
            </div>
        </div>

        <div>
            <h3 style={{ color: '#002244', marginBottom: '15px' }}>Pending Notifications</h3>
            <p style={{ marginBottom: '15px', color: '#64748b' }}>
                {pendingNotifications} notification(s) waiting to be sent to applicants
            </p>
            <button
                onClick={sendAllNotifications}
                disabled={pendingNotifications === 0}
                style={{
                    padding: '10px 20px',
                    background: pendingNotifications === 0 ? '#9ca3af' : '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: pendingNotifications === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold'
                }}
            >
                Send All Pending Notifications
            </button>
            {pendingNotifications > 0 && (
                <p style={{ fontSize: '14px', color: '#64748b', marginTop: '10px' }}>
                    This will send Discord messages to all applicants with pending notifications.
                </p>
            )}
        </div>
    </div>
)}
                        
                        {/* Whitelist Members */}
                        <h3 style={{ color: '#002244', marginBottom: '15px' }}>Current Admins</h3>
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {whitelist.map(admin => (
                                <div key={admin.discord_id} style={{ 
                                    padding: '15px', 
                                    border: '1px solid #e2e8f0', 
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span style={{ fontFamily: 'monospace' }}>{admin.discord_id}</span>
                                    <button
                                        onClick={() => removeFromWhitelist(admin.discord_id)}
                                        style={{
                                            padding: '6px 12px',
                                            background: '#dc2626',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Review Modal */}
{selectedApp && (
    <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
    }}>
        <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '700px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
            {/* Header */}
            <div style={{ marginBottom: '25px' }}>
                <h2 style={{ 
                    color: '#002244', 
                    margin: '0 0 10px 0',
                    fontSize: '24px',
                    fontWeight: 'bold'
                }}>
                    Review Application
                </h2>
                <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '15px',
                    color: '#64748b',
                    fontSize: '14px'
                }}>
                    <span><strong>Applicant:</strong> {selectedApp.discord_username}</span>
                    <span><strong>Form:</strong> {selectedApp.form_title}</span>
                    <span><strong>Submitted:</strong> {new Date(selectedApp.created_at).toLocaleDateString()}</span>
                    {selectedApp.roblox_username && (
                        <span><strong>Roblox:</strong> {selectedApp.roblox_username}</span>
                    )}
                </div>
            </div>

            {/* Application Data */}
            <div style={{ marginBottom: '25px' }}>
                <h3 style={{ 
                    color: '#002244', 
                    marginBottom: '15px',
                    fontSize: '18px',
                    borderBottom: '2px solid #e2e8f0',
                    paddingBottom: '8px'
                }}>
                    Application Responses
                </h3>
                <div style={{ 
                    background: '#f8fafc', 
                    padding: '20px', 
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                }}>
                    {Object.entries(selectedApp.responses).map(([key, value]) => (
                        <div key={key} style={{ 
                            marginBottom: '15px',
                            paddingBottom: '15px',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <strong style={{ 
                                color: '#002244', 
                                marginBottom: '5px',
                                fontSize: '14px'
                            }}>
                                {key}:
                            </strong>
                            <span style={{ 
                                color: '#374151', 
                                fontSize: '14px',
                                lineHeight: '1.5',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {value || <em style={{ color: '#9ca3af' }}>Not provided</em>}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Feedback Section */}
            <div style={{ marginBottom: '25px' }}>
                <h3 style={{ 
                    color: '#002244', 
                    marginBottom: '15px',
                    fontSize: '18px',
                    borderBottom: '2px solid #e2e8f0',
                    paddingBottom: '8px'
                }}>
                    Review Feedback
                </h3>
                <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Provide detailed feedback for the applicant. This will be included in the Discord notification if you choose to send it now."
                    style={{
                        width: '100%',
                        minHeight: '120px',
                        padding: '15px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        resize: 'vertical',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        lineHeight: '1.5',
                        transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => {
                        e.target.style.borderColor = '#002244';
                    }}
                    onBlur={(e) => {
                        e.target.style.borderColor = '#e2e8f0';
                    }}
                />
            </div>

            {/* Custom Notification Message */}
            <div style={{ marginBottom: '25px' }}>
                <h3 style={{ 
                    color: '#002244', 
                    marginBottom: '15px',
                    fontSize: '18px',
                    borderBottom: '2px solid #e2e8f0',
                    paddingBottom: '8px'
                }}>
                    Notification Settings
                </h3>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ 
                        display: 'block', 
                        marginBottom: '8px', 
                        fontWeight: 'bold',
                        color: '#374151',
                        fontSize: '14px'
                    }}>
                        Custom Notification Message (optional):
                    </label>
                    <textarea
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="This custom message will be sent via Discord if you choose to notify the applicant now. Leave empty to use the default message."
                        style={{
                            width: '100%',
                            minHeight: '80px',
                            padding: '12px',
                            border: '2px solid #e2e8f0',
                            borderRadius: '6px',
                            resize: 'vertical',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            lineHeight: '1.4',
                            transition: 'border-color 0.2s ease'
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#002244';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#e2e8f0';
                        }}
                    />
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '12px',
                marginBottom: '15px'
            }}>
                {/* Send Now Buttons */}
                <button
                    onClick={() => handleReview(selectedApp.id, 'approved', true)}
                    style={{
                        padding: '12px 20px',
                        background: '#059669',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.background = '#047857';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = '#059669';
                    }}
                >
                    <span>✓</span>
                    Approve & Send Now
                </button>
                <button
                    onClick={() => handleReview(selectedApp.id, 'rejected', true)}
                    style={{
                        padding: '12px 20px',
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.background = '#b91c1c';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = '#dc2626';
                    }}
                >
                    <span>✗</span>
                    Reject & Send Now
                </button>
            </div>

            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '12px',
                marginBottom: '20px'
            }}>
                {/* Send Later Buttons */}
                <button
                    onClick={() => handleReview(selectedApp.id, 'approved', false)}
                    style={{
                        padding: '12px 20px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.background = '#2563eb';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = '#3b82f6';
                    }}
                >
                    <span>✓</span>
                    Approve & Send Later
                </button>
                <button
                    onClick={() => handleReview(selectedApp.id, 'rejected', false)}
                    style={{
                        padding: '12px 20px',
                        background: '#f59e0b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.background = '#d97706';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = '#f59e0b';
                    }}
                >
                    <span>✗</span>
                    Reject & Send Later
                </button>
            </div>

            {/* Cancel Button */}
            <div style={{ textAlign: 'center' }}>
                <button
                    onClick={() => {
                        setSelectedApp(null);
                        setFeedback('');
                        setCustomMessage('');
                    }}
                    style={{
                        padding: '10px 25px',
                        background: 'transparent',
                        color: '#6b7280',
                        border: '2px solid #e5e7eb',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.background = '#f8fafc';
                        e.target.style.borderColor = '#d1d5db';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = 'transparent';
                        e.target.style.borderColor = '#e5e7eb';
                    }}
                >
                    Cancel Review
                </button>
            </div>

            {/* Help Text */}
            <div style={{ 
                marginTop: '20px',
                padding: '15px',
                background: '#f0f9ff',
                borderRadius: '6px',
                border: '1px solid #bae6fd'
            }}>
                <p style={{ 
                    margin: 0, 
                    color: '#0369a1',
                    fontSize: '13px',
                    lineHeight: '1.4'
                }}>
                    <strong>💡 Notification Guide:</strong><br/>
                    • <strong>Send Now:</strong> Immediately notifies the applicant via Discord<br/>
                    • <strong>Send Later:</strong> Saves for bulk sending from Notifications tab<br/>
                    • Custom messages override the default notification template
                </p>
            </div>
        </div>
    </div>
)}
            </div>
        </div>
    );
};

export default AdminDashboard;