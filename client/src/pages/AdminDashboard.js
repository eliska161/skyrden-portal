import React, { useState, useEffect } from 'react';

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
    }, [user, activeTab]);

    const checkAdminStatus = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/auth/status', {
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

    const loadData = async () => {
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
    };

    const handleReview = async (applicationId, status) => {
        try {
            const response = await fetch('http://localhost:5001/api/admin/review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    applicationId,
                    status,
                    feedback: feedback || 'No feedback provided'
                })
            });

            if (response.ok) {
                setFeedback('');
                setSelectedApp(null);
                loadData();
                alert('Application reviewed successfully!');
            }
        } catch (error) {
            console.error('Review failed:', error);
        }
    };

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
            const response = await fetch('http://localhost:5001/api/admin/forms', {
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
            const response = await fetch('http://localhost:5001/api/admin/whitelist', {
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
            const response = await fetch(`http://localhost:5001/api/admin/whitelist/${discordId}`, {
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

    const updateFormStatus = async (formId, isActive) => {
        try {
            const response = await fetch(`http://localhost:5001/api/admin/forms/${formId}`, {
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
                                                {app.roblox_username && ` • Roblox: ${app.roblox_username}`}
                                            </p>
                                            <div style={{ color: '#64748b', fontSize: '14px' }}>
                                                Status: <span style={{ 
                                                    color: app.status === 'approved' ? '#059669' : 
                                                           app.status === 'rejected' ? '#dc2626' : '#d97706'
                                                }}>
                                                    {app.status}
                                                </span>
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
                            {applicationForms.map(form => (
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
                                                {form.fields.length} field(s) • 
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
                            borderRadius: '10px',
                            width: '90%',
                            maxWidth: '600px',
                            maxHeight: '80vh',
                            overflow: 'auto'
                        }}>
                            <h2 style={{ color: '#002244', marginBottom: '20px' }}>
                                Review Application - {selectedApp.discord_username}
                            </h2>
                            
                            <div style={{ marginBottom: '20px' }}>
                                <h4 style={{ color: '#002244' }}>Application Data:</h4>
                                <pre style={{ 
                                    background: '#f8fafc', 
                                    padding: '15px', 
                                    borderRadius: '5px',
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '14px'
                                }}>
                                    {JSON.stringify(selectedApp.responses, null, 2)}
                                </pre>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Feedback:
                                </label>
                                <textarea
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    placeholder="Enter your feedback here..."
                                    style={{
                                        width: '100%',
                                        minHeight: '100px',
                                        padding: '10px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => handleReview(selectedApp.id, 'approved')}
                                    style={{
                                        padding: '10px 20px',
                                        background: '#059669',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => handleReview(selectedApp.id, 'rejected')}
                                    style={{
                                        padding: '10px 20px',
                                        background: '#dc2626',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedApp(null);
                                        setFeedback('');
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        background: '#6b7280',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;