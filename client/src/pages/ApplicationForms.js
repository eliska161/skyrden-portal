import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/ApplicationForm.css';

const ApplicationForm = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  
  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const response = await axios.get(`/api/applications/templates/${id}`, { 
          withCredentials: true 
        });
        setTemplate(response.data);
        
        // Initialize form data with auto-filled fields
        const initialData = {};
        response.data.fields.forEach(field => {
          if (field.fieldType === 'discord_username' && user) {
            initialData[field._id] = user.discord_username;
          } else if (field.fieldType === 'roblox_username' && user) {
            initialData[field._id] = user.roblox_username || '';
          } else {
            initialData[field._id] = '';
          }
        });
        setFormData(initialData);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching application template:', err);
        setError('Failed to load application form. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchTemplate();
  }, [id, user]);
  
  const handleInputChange = (fieldId, value) => {
    setFormData({
      ...formData,
      [fieldId]: value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    
    // Validate required fields
    const requiredFields = template.fields.filter(field => field.required);
    for (const field of requiredFields) {
      if (!formData[field._id] || formData[field._id].trim() === '') {
        setSubmitError(`Please complete the required field: ${field.label}`);
        setSubmitting(false);
        return;
      }
    }
    
    // Format responses for API
    const responses = Object.entries(formData).map(([fieldId, answer]) => ({
      fieldId,
      answer
    }));
    
    try {
      await axios.post('/api/applications/submit', {
        templateId: id,
        responses
      }, { withCredentials: true });
      
      // Redirect to success page
      navigate('/application-submitted');
    } catch (err) {
      console.error('Error submitting application:', err);
      setSubmitError(err.response?.data?.error || 'Failed to submit application. Please try again.');
      setSubmitting(false);
    }
  };
  
  const renderField = (field) => {
    const { _id, fieldType, label, placeholder, required, options } = field;
    
    switch (fieldType) {
      case 'short_text':
        return (
          <div className="form-field" key={_id}>
            <label htmlFor={_id}>{label}{required && <span className="required">*</span>}</label>
            <input
              type="text"
              id={_id}
              placeholder={placeholder || ''}
              value={formData[_id] || ''}
              onChange={(e) => handleInputChange(_id, e.target.value)}
              disabled={submitting}
              required={required}
            />
          </div>
        );
        
      case 'long_text':
        return (
          <div className="form-field" key={_id}>
            <label htmlFor={_id}>{label}{required && <span className="required">*</span>}</label>
            <textarea
              id={_id}
              placeholder={placeholder || ''}
              value={formData[_id] || ''}
              onChange={(e) => handleInputChange(_id, e.target.value)}
              disabled={submitting}
              required={required}
              rows={4}
            ></textarea>
          </div>
        );
        
      case 'paragraph':
        return (
          <div className="form-field" key={_id}>
            <label htmlFor={_id}>{label}{required && <span className="required">*</span>}</label>
            <textarea
              id={_id}
              placeholder={placeholder || ''}
              value={formData[_id] || ''}
              onChange={(e) => handleInputChange(_id, e.target.value)}
              disabled={submitting}
              required={required}
              rows={8}
            ></textarea>
          </div>
        );
        
      case 'multiple_choice':
        return (
          <div className="form-field" key={_id}>
            <label>{label}{required && <span className="required">*</span>}</label>
            <div className="radio-options">
              {options && options.map((option, i) => (
                <div key={i} className="radio-option">
                  <input
                    type="radio"
                    id={`${_id}-option-${i}`}
                    name={_id}
                    value={option}
                    checked={formData[_id] === option}
                    onChange={() => handleInputChange(_id, option)}
                    disabled={submitting}
                    required={required}
                  />
                  <label htmlFor={`${_id}-option-${i}`}>{option}</label>
                </div>
              ))}
            </div>
          </div>
        );
        
      case 'checkbox':
        return (
          <div className="form-field" key={_id}>
            <label>{label}{required && <span className="required">*</span>}</label>
            <div className="checkbox-options">
              {options && options.map((option, i) => (
                <div key={i} className="checkbox-option">
                  <input
                    type="checkbox"
                    id={`${_id}-option-${i}`}
                    value={option}
                    checked={(formData[_id] || []).includes(option)}
                    onChange={(e) => {
                      const currentValues = formData[_id] || [];
                      let newValues;
                      
                      if (e.target.checked) {
                        newValues = [...currentValues, option];
                      } else {
                        newValues = currentValues.filter(val => val !== option);
                      }
                      
                      handleInputChange(_id, newValues);
                    }}
                    disabled={submitting}
                  />
                  <label htmlFor={`${_id}-option-${i}`}>{option}</label>
                </div>
              ))}
            </div>
          </div>
        );
        
      case 'dropdown':
        return (
          <div className="form-field" key={_id}>
            <label htmlFor={_id}>{label}{required && <span className="required">*</span>}</label>
            <select
              id={_id}
              value={formData[_id] || ''}
              onChange={(e) => handleInputChange(_id, e.target.value)}
              disabled={submitting}
              required={required}
            >
              <option value="">-- Select an option --</option>
              {options && options.map((option, i) => (
                <option key={i} value={option}>{option}</option>
              ))}
            </select>
          </div>
        );
        
      case 'discord_username':
        return (
          <div className="form-field" key={_id}>
            <label htmlFor={_id}>{label || 'Discord Username'}</label>
            <input
              type="text"
              id={_id}
              value={formData[_id] || ''}
              disabled={true}
              className="auto-filled"
            />
            <div className="field-note">Automatically filled from your Discord account</div>
          </div>
        );
        
      case 'roblox_username':
        return (
          <div className="form-field" key={_id}>
            <label htmlFor={_id}>{label || 'Roblox Username'}</label>
            <input
              type="text"
              id={_id}
              value={formData[_id] || ''}
              disabled={true}
              className="auto-filled"
            />
            <div className="field-note">Automatically filled from your Roblox account</div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading application form...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="btn-primary">Retry</button>
      </div>
    );
  }
  
  if (!template) {
    return (
      <div className="not-found">
        <h2>Application Not Found</h2>
        <p>The application you're looking for doesn't exist or has been removed.</p>
        <button onClick={() => navigate('/applications')} className="btn-primary">
          View Available Applications
        </button>
      </div>
    );
  }
  
  return (
    <div className="application-form-container">
      <h1>{template.name}</h1>
      
      {template.description && (
        <div className="form-description">{template.description}</div>
      )}
      
      {template.requirements && (
        <div className="form-requirements">
          <h3>Requirements</h3>
          <div>{template.requirements}</div>
        </div>
      )}
      
      {template.closureDate && (
        <div className="form-deadline">
          <strong>Application Deadline:</strong> {new Date(template.closureDate).toLocaleDateString()}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-fields">
          {template.fields.sort((a, b) => a.orderIndex - b.orderIndex).map(renderField)}
        </div>
        
        {submitError && (
          <div className="submit-error">
            {submitError}
          </div>
        )}
        
        <div className="form-actions">
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => navigate('/applications')}
            disabled={submitting}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ApplicationForm;