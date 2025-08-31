import React, { useState, useEffect } from 'react';
import config from '../config';

const MyApplications = () => {
    const [user, setUser] = useState(null);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuthStatus();
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

    const fetchMyApplications = async () => {
        try {
            const response = await fetch(`${config.API_URL}/api/applications/my-applications`, {
                credentials: 'include'
            });
            const data = await response.json();
            setApplications(data);
        } catch (error) {
            console.error('Failed to fetch applications:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return '#059669';
            case 'rejected': return '#dc2626';
            case 'pending': return '#d97706';
            default: return '#6b7280';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved': return '✓';
            case 'rejected': return '✗';
            case 'pending': return '⏳';
            default: return '?';
        }
    };

    if (!user) {
        return <div>Loading...</div>;
    }

    if (loading) {
        return <div>Loading your applications...</div>;
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
                        <h1 style={{ margin: 0 }}>My Applications</h1>
                        <p style={{ margin: '10px 0 0 0', opacity: 0.8 }}>
                            Welcome, {user.discord_username} • {user.roblox_username}
                        </p>
                    </div>
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
                        ← Back to Home
                    </button>
                </div>

                {applications.length === 0 ? (
                    <div style={{ 
                        background: 'white', 
                        padding: '40px', 
                        borderRadius: '10px',
                        textAlign: 'center'
                    }}>
                        <h3 style={{ color: '#002244', marginBottom: '15px' }}>
                            No Applications Yet
                        </h3>
                        <p style={{ color: '#64748b', marginBottom: '20px' }}>
                            You haven't submitted any applications yet.
                        </p>
                        <button 
                            onClick={() => window.location.href = '/apply'}
                            style={{
                                padding: '12px 30px',
                                background: '#002244',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Start Your First Application
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {applications.map(app => (
                            <div key={app.id} style={{ 
                                background: 'white', 
                                padding: '20px', 
                                borderRadius: '10px',
                                borderLeft: `4px solid ${getStatusColor(app.status)}`
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                                    <div>
                                        <h3 style={{ color: '#002244', margin: '0 0 10px 0' }}>
                                            {app.form_title}
                                        </h3>
                                        <p style={{ color: '#64748b', margin: '0 0 10px 0' }}>
                                            Submitted: {new Date(app.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div style={{ 
                                        padding: '6px 12px', 
                                        background: getStatusColor(app.status),
                                        color: 'white',
                                        borderRadius: '20px',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}>
                                        <span>{getStatusIcon(app.status)}</span>
                                        {app.status.toUpperCase()}
                                    </div>
                                </div>

                                {app.admin_feedback && (
                                    <div style={{ 
                                        background: '#f8fafc', 
                                        padding: '15px', 
                                        borderRadius: '6px',
                                        marginBottom: '15px'
                                    }}>
                                        <h4 style={{ color: '#002244', margin: '0 0 8px 0', fontSize: '14px' }}>
                                            Admin Feedback:
                                        </h4>
                                        <p style={{ color: '#374151', margin: 0, fontSize: '14px' }}>
                                            {app.admin_feedback}
                                        </p>
                                        {app.reviewed_by_username && (
                                            <p style={{ color: '#64748b', margin: '10px 0 0 0', fontSize: '12px' }}>
                                                Reviewed by: {app.reviewed_by_username}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <h4 style={{ color: '#002244', margin: '0 0 10px 0', fontSize: '14px' }}>
                                        Your Responses:
                                    </h4>
                                    <div style={{ display: 'grid', gap: '10px' }}>
                                        {Object.entries(app.responses).map(([key, value]) => (
                                            <div key={key} style={{ display: 'flex', gap: '10px' }}>
                                                <strong style={{ color: '#374151', minWidth: '120px', fontSize: '14px' }}>
                                                    {key}:
                                                </strong>
                                                <span style={{ color: '#64748b', fontSize: '14px' }}>
                                                    {value || 'Not provided'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyApplications;