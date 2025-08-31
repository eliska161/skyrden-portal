import React, { useState, useEffect } from 'react';
import config from '../config';

const API_URL = config.API_URL;

const ApplicationPortal = () => {
    const [user, setUser] = useState(null);
    const [applicationForms, setApplicationForms] = useState([]);
    const [selectedForm, setSelectedForm] = useState(null);
    const [responses, setResponses] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [myApplications, setMyApplications] = useState([]);

    useEffect(() => {
        checkAuthStatus();
        fetchApplicationForms();
        fetchMyApplications();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const response = await fetch(`${config.API_URL}/api/auth/status`, {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.authenticated) {
                setUser(data.user);
                if (!data.user.roblox_username) {
                    window.location.href = '/';
                }
            } else {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/';
        }
    };

    const fetchApplicationForms = async () => {
        try {
            const response = await fetch(`${config.API_URL}/api/applications/forms`, {
                credentials: 'include'
            });
            const data = await response.json();
            setApplicationForms(data);
        } catch (error) {
            console.error('Failed to fetch forms:', error);
        }
    };

    const fetchMyApplications = async () => {
        try {
            const response = await fetch(`${config.API_URL}/api/applications/my-applications`, {
                credentials: 'include'
            });
            const data = await response.json();
            setMyApplications(data);
        } catch (error) {
            console.error('Failed to fetch applications:', error);
        }
    };

    const handleResponseChange = (fieldId, value) => {
        setResponses(prev => ({
            ...prev,
            [fieldId]: value
        }));
    };

    const handleMultipleChoiceChange = (fieldId, option) => {
        setResponses(prev => ({
            ...prev,
            [fieldId]: option
        }));
    };

    const submitApplication = async () => {
        if (!selectedForm) return;

        setSubmitting(true);
        try {
            const response = await fetch(`${config.API_URL}/api/applications/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    application_form_id: selectedForm.id,
                    application_data: responses
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Application submitted successfully!');
                setSelectedForm(null);
                setResponses({});
                fetchMyApplications();
            } else {
                alert(data.error || 'Failed to submit application');
            }
        } catch (error) {
            console.error('Submission failed:', error);
            alert('Failed to submit application');
        } finally {
            setSubmitting(false);
        }
    };

    const getApplicationCountForForm = (formId) => {
        return myApplications.filter(app => app.application_form_id === formId).length;
    };

    const formatDeadline = (deadline) => {
        if (!deadline) return 'No deadline';
        return new Date(deadline).toLocaleDateString();
    };

    const isFormDisabled = (form) => {
        if (!form.can_apply) return true;
        if (form.deadline && new Date(form.deadline) < new Date()) return true;
        if (form.application_limit && getApplicationCountForForm(form.id) >= form.application_limit) return true;
        return false;
    };

    const getFormStatus = (form) => {
        if (form.deadline && new Date(form.deadline) < new Date()) {
            return 'Deadline passed';
        }
        if (form.application_limit && getApplicationCountForForm(form.id) >= form.application_limit) {
            return 'Limit reached';
        }
        if (!form.can_apply) {
            return 'Not available';
        }
        return 'Available';
    };

    const renderFieldInput = (field) => {
        const baseProps = {
            value: responses[field.id] || '',
            required: field.required,
            style: {
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontFamily: 'inherit'
            }
        };

        switch (field.type) {
            case 'long_text':
                return (
                    <textarea
                        {...baseProps}
                        onChange={(e) => handleResponseChange(field.id, e.target.value)}
                        placeholder="Please provide your response here..."
                        style={{ ...baseProps.style, minHeight: '120px', resize: 'vertical' }}
                    />
                );
            
            case 'multiple_choice':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {field.options && field.options.map((option, index) => (
                            <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="radio"
                                    name={field.id}
                                    value={option}
                                    checked={responses[field.id] === option}
                                    onChange={() => handleMultipleChoiceChange(field.id, option)}
                                    required={field.required}
                                />
                                <span>{option}</span>
                            </label>
                        ))}
                    </div>
                );
            
            default:
                return (
                    <input
                        {...baseProps}
                        type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                        onChange={(e) => handleResponseChange(field.id, e.target.value)}
                        placeholder="Your answer..."
                    />
                );
        }
    };

    if (!user) {
        return <div>Loading...</div>;
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '20px' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
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
                    <div>
                        <h1 style={{ margin: 0 }}>Application Portal</h1>
                        <p style={{ margin: '10px 0 0 0', opacity: 0.8 }}>
                            Welcome, {user.discord_username} • {user.roblox_username}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                            onClick={() => window.location.href = '/my-applications'}
                            style={{
                                padding: '8px 16px',
                                background: 'rgba(255,255,255,0.2)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            My Applications
                        </button>
                        <button 
                            onClick={() => window.location.href = '/'}
                            style={{
                                padding: '8px 16px',
                                background: 'rgba(255,255,255,0.2)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            ← Home
                        </button>
                    </div>
                </div>

                {!selectedForm ? (
                    /* Application Selection */
                    <div style={{ 
                        background: 'white', 
                        padding: '30px', 
                        borderRadius: '10px',
                        marginBottom: '20px'
                    }}>
                        <h2 style={{ color: '#002244', marginBottom: '20px' }}>
                            Available Applications
                        </h2>
                        
                        <div style={{ display: 'grid', gap: '15px' }}>
                            {applicationForms.map(form => {
                                const isDisabled = isFormDisabled(form);
                                const applicationCount = getApplicationCountForForm(form.id);
                                const status = getFormStatus(form);

                                return (
                                    <div 
                                        key={form.id} 
                                        style={{ 
                                            padding: '20px', 
                                            border: `2px solid ${isDisabled ? '#e5e7eb' : '#002244'}`,
                                            borderRadius: '8px',
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            opacity: isDisabled ? 0.6 : 1,
                                            background: isDisabled ? '#f9fafb' : 'white',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onClick={isDisabled ? undefined : () => setSelectedForm(form)}
                                        onMouseEnter={(e) => {
                                            if (!isDisabled) {
                                                e.target.style.borderColor = '#002244';
                                                e.target.style.transform = 'translateY(-2px)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isDisabled) {
                                                e.target.style.borderColor = '#002244';
                                                e.target.style.transform = 'translateY(0)';
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                                            <h3 style={{ color: '#002244', margin: '0 0 10px 0' }}>
                                                {form.title}
                                            </h3>
                                            <span style={{ 
                                                padding: '4px 8px', 
                                                background: isDisabled ? '#6b7280' : '#059669',
                                                color: 'white',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}>
                                                {status}
                                            </span>
                                        </div>
                                        
                                        <p style={{ color: '#64748b', margin: '0 0 10px 0' }}>
                                            {form.description || 'No description available'}
                                        </p>
                                        
                                        <div style={{ color: '#6b7280', fontSize: '14px' }}>
                                            <div>Deadline: {formatDeadline(form.deadline)}</div>
                                            <div>Applications: {applicationCount}/{form.application_limit || '∞'}</div>
                                            {form.deadline && new Date(form.deadline) < new Date() && (
                                                <div style={{ color: '#dc2626', fontWeight: 'bold' }}>
                                                    This form is closed
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* Application Form */
                    <div style={{ 
                        background: 'white', 
                        padding: '30px', 
                        borderRadius: '10px',
                        marginBottom: '20px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ color: '#002244', margin: 0 }}>
                                {selectedForm.title}
                            </h2>
                            <button
                                onClick={() => {
                                    setSelectedForm(null);
                                    setResponses({});
                                }}
                                style={{
                                    padding: '8px 16px',
                                    background: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Back to List
                            </button>
                        </div>

                        {selectedForm.description && (
                            <p style={{ color: '#64748b', marginBottom: '20px' }}>
                                {selectedForm.description}
                            </p>
                        )}

                        {/* Auto-filled user information */}
                        <div style={{ 
                            background: '#f0f9ff', 
                            padding: '15px', 
                            borderRadius: '6px',
                            marginBottom: '20px',
                            border: '1px solid #bae6fd'
                        }}>
                            <h4 style={{ color: '#0369a1', margin: '0 0 10px 0' }}>Your Information</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <strong style={{ color: '#374151' }}>Discord:</strong>
                                    <span style={{ color: '#64748b', marginLeft: '8px' }}>{user.discord_username}</span>
                                </div>
                                <div>
                                    <strong style={{ color: '#374151' }}>Roblox:</strong>
                                    <span style={{ color: '#64748b', marginLeft: '8px' }}>{user.roblox_username}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '20px' }}>
                            {selectedForm.fields && selectedForm.fields.map(field => (
                                <div key={field.id}>
                                    <label style={{ 
                                        display: 'block', 
                                        marginBottom: '8px', 
                                        fontWeight: 'bold',
                                        color: '#002244'
                                    }}>
                                        {field.question}
                                        {field.required && <span style={{ color: '#dc2626' }}> *</span>}
                                    </label>
                                    
                                    {renderFieldInput(field)}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={submitApplication}
                            disabled={submitting}
                            style={{
                                marginTop: '30px',
                                padding: '12px 30px',
                                background: submitting ? '#9ca3af' : '#002244',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                fontSize: '16px',
                                fontWeight: 'bold'
                            }}
                        >
                            {submitting ? 'Submitting...' : 'Submit Application'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApplicationPortal;