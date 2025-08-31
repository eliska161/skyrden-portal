import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/ApplicationList.css';

const ApplicationList = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await axios.get('/api/applications/templates', { 
          withCredentials: true 
        });
        setTemplates(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching application templates:', err);
        setError('Failed to load available applications. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchTemplates();
  }, []);
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading available applications...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }
  
  if (templates.length === 0) {
    return (
      <div className="no-applications">
        <h2>No Applications Available</h2>
        <p>There are currently no open applications. Please check back later.</p>
        <Link to="/" className="btn-primary">Return to Home</Link>
      </div>
    );
  }
  
  return (
    <div className="application-list-container">
      <h1>Available Applications</h1>
      <p className="list-description">Select an application to complete</p>
      
      <div className="application-grid">
        {templates.map(template => (
          <div key={template._id} className="application-card">
            <h3>{template.name}</h3>
            {template.description && <p>{template.description}</p>}
            
            {template.closureDate && (
              <div className="closure-date">
                <span>Closes on:</span> 
                <span>{new Date(template.closureDate).toLocaleDateString()}</span>
              </div>
            )}
            
            <Link to={`/apply/${template._id}`} className="btn-apply">
              Start Application
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApplicationList;