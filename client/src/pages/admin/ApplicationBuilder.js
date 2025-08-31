import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import '../../styles/admin/ApplicationBuilder.css';

const defaultFields = [
  { fieldType: 'discord_username', label: 'Discord Username', required: true, orderIndex: 0 },
  { fieldType: 'roblox_username', label: 'Roblox Username', required: true, orderIndex: 1 }
];

const ApplicationBuilder = () => {
  const { id } = useParams(); // If editing, this will be the template ID
  const navigate = useNavigate();
  const isEditing = !!id;
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [closureDate, setClosureDate] = useState('');
  const [status, setStatus] = useState('draft');
  const [fields, setFields] = useState([...defaultFields]);
  
  // UI state
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [currentField, setCurrentField] = useState(null);
  
  useEffect(() => {
    // Load template if in edit mode
    if (isEditing) {
      const fetchTemplate = async () => {
        try {
          const response = await axios.get(`/api/applications/admin/templates/${id}`, { 
            withCredentials: true 
          });
          
          const template = response.data;
          setName(template.name);
          setDescription(template.description || '');
          setRequirements(template.requirements || '');
          setClosureDate(template.closureDate ? new Date(template.closureDate).toISOString().split('T')[0] : '');
          setStatus(template.status);
          setFields(template.fields);
          
          setLoading(false);
        } catch (err) {
          console.error('Error fetching template:', err);
          setError('Failed to load application template. Please try again.');
          setLoading(false);
        }
      };
      
      fetchTemplate();
    }
  }, [id, isEditing]);
  
  const handleDragEnd = (result) => {
    // Dropped outside the list
    if (!result.destination) return;
    
    const items = Array.from(fields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update order indices
    const updatedFields = items.map((field, index) => ({
      ...field,
      orderIndex: index
    }));
    
    setFields(updatedFields);
  };
  
  const addField = () => {
    setCurrentField({
      fieldType: 'short_text',
      label: '',
      placeholder: '',
      required: false,
      options: [],
      orderIndex: fields.length
    });
    setShowFieldModal(true);
  };
  
  const editField = (index) => {
    setCurrentField({ ...fields[index], index });
    setShowFieldModal(true);
  };
  
  const deleteField = (index) => {
    if (window.confirm('Are you sure you want to delete this field?')) {
      const newFields = [...fields];
      newFields.splice(index, 1);
      
      // Update order indices
      const updatedFields = newFields.map((field, idx) => ({
        ...field,
        orderIndex: idx
      }));
      
      setFields(updatedFields);
    }
  };
  
  const saveField = () => {
    if (!currentField.label.trim()) {
      alert('Field label is required');
      return;
    }
    
    const newFields = [...fields];
    
    if (currentField.index !== undefined) {
      // Edit existing field
      newFields[currentField.index] = {
        ...currentField,
        index: undefined // Remove index property
      };
    } else {
      // Add new field
      newFields.push({
        ...currentField,
        index: undefined // Remove index property
      });
    }
    
    // Re-order the fields
    const updatedFields = newFields.map((field, idx) => ({
      ...field,
      orderIndex: idx
    }));
    
    setFields(updatedFields);
    setShowFieldModal(false);
    setCurrentField(null);
  };
  
  const saveTemplate = async () => {
    if (!name.trim()) {
      alert('Application name is required');
      return;
    }
    
    if (fields.length < 1) {
      alert('Please add at least one field to your application');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      const templateData = {
        name,
        description,
        requirements,
        closureDate: closureDate || undefined,
        status,
        fields: fields.map(({ index, ...field }) => field) // Remove any index property
      };
      
      let response;
      
      if (isEditing) {
        response = await axios.put(`/api/applications/admin/templates/${id}`, templateData, { 
          withCredentials: true 
        });
      } else {
        response = await axios.post('/api/applications/admin/templates', templateData, { 
          withCredentials: true 
        });
      }
      
      setSaving(false);
      navigate('/admin');
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err.response?.data?.error || 'Failed to save application template. Please try again.');
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading application builder...</p>
      </div>
    );
  }
  
  const renderField = (field, index) => {
    return (
      <Draggable key={index} draggableId={`field-${index}`} index={index}>
        {(provided) => (
          <div
            className="form-field-item"
            ref={provided.innerRef}
            {...provided.draggableProps}
          >
            <div className="field-header">
              <div className="field-drag-handle" {...provided.dragHandleProps}>
                <i className="fas fa-grip-lines"></i>
              </div>
              <div className="field-type">{getFieldTypeName(field.fieldType)}</div>
              <div className="field-actions">
                <button 
                  type="button" 
                  className="btn-edit-field"
                  onClick={() => editField(index)}
                >
                  Edit
                </button>
                <button 
                  type="button" 
                  className="btn-delete-field"
                  onClick={() => deleteField(index)}
                  disabled={['discord_username', 'roblox_username'].includes(field.fieldType)}
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="field-preview">
              <label>
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              {renderFieldPreview(field)}
            </div>
          </div>
        )}
      </Draggable>
    );
  };
  
  const getFieldTypeName = (fieldType) => {
    switch (fieldType) {
      case 'short_text': return 'Short Text';
      case 'long_text': return 'Long Text';
      case 'paragraph': return 'Paragraph';
      case 'multiple_choice': return 'Multiple Choice';
      case 'checkbox': return 'Checkbox';
      case 'dropdown': return 'Dropdown';
      case 'discord_username': return 'Discord Username';
      case 'roblox_username': return 'Roblox Username';
      default: return fieldType;
    }
  };
  
  const renderFieldPreview = (field) => {
    switch (field.fieldType) {
      case 'short_text':
        return <input type="text" placeholder={field.placeholder || ''} disabled />;
        
      case 'long_text':
      case 'paragraph':
        return <textarea placeholder={field.placeholder || ''} disabled rows={field.fieldType === 'paragraph' ? 5 : 3}></textarea>;
        
      case 'multiple_choice':
        return (
          <div className="radio-options">
            {field.options && field.options.map((option, i) => (
              <div key={i} className="radio-option">
                <input type="radio" id={`preview-${i}`} name="preview" disabled />
                <label htmlFor={`preview-${i}`}>{option}</label>
              </div>
            ))}
          </div>
        );
        
      case 'checkbox':
        return (
          <div className="checkbox-options">
            {field.options && field.options.map((option, i) => (
              <div key={i} className="checkbox-option">
                <input type="checkbox" id={`preview-${i}`} disabled />
                <label htmlFor={`preview-${i}`}>{option}</label>
              </div>
            ))}
          </div>
        );
        
      case 'dropdown':
        return (
          <select disabled>
            <option>-- Select an option --</option>
            {field.options && field.options.map((option, i) => (
              <option key={i}>{option}</option>
            ))}
          </select>
        );
        
      case 'discord_username':
      case 'roblox_username':
        return <input type="text" value={field.fieldType === 'discord_username' ? 'Discord Username' : 'Roblox Username'} disabled className="auto-filled" />;
        
      default:
        return null;
    }
  };
  
  return (
    <div className="application-builder">
      <h1>{isEditing ? 'Edit Application' : 'Create New Application'}</h1>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="builder-form">
        <div className="form-section">
          <h2>Basic Information</h2>
          
          <div className="form-group">
            <label htmlFor="name">Application Name</label>
            <input 
              type="text" 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter application name"
              disabled={saving}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description (Optional)</label>
            <textarea 
              id="description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description of this application"
              disabled={saving}
              rows={3}
            ></textarea>
          </div>
          
          <div className="form-group">
            <label htmlFor="requirements">Requirements (Optional)</label>
            <textarea 
              id="requirements" 
              value={requirements} 
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="List any requirements for applicants"
              disabled={saving}
              rows={4}
            ></textarea>
          </div>
          
          <div className="form-group">
            <label htmlFor="closureDate">Closure Date (Optional)</label>
            <input 
              type="date" 
              id="closureDate" 
              value={closureDate} 
              onChange={(e) => setClosureDate(e.target.value)}
              disabled={saving}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select 
              id="status" 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
              disabled={saving}
            >
              <option value="draft">Draft (Not Visible)</option>
              <option value="open">Open (Accepting Applications)</option>
              <option value="closed">Closed (No Longer Accepting Applications)</option>
            </select>
          </div>
        </div>
        
        <div className="form-section">
          <h2>Form Fields</h2>
          <p className="section-description">
            Drag and drop to reorder fields. Default fields (Discord and Roblox usernames) cannot be removed.
          </p>
          
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="fields">
              {(provided) => (
                <div
                  className="fields-container"
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {fields.map(renderField)}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          
          <button 
            type="button" 
            className="btn-add-field"
            onClick={addField}
            disabled={saving}
          >
            Add New Field
          </button>
        </div>
        
        <div className="form-actions">
          <button 
            type="button" 
            className="btn-secondary"
            onClick={() => navigate('/admin')}
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="btn-primary"
            onClick={saveTemplate}
            disabled={saving}
          >
            {saving ? 'Saving...' : (isEditing ? 'Update Application' : 'Create Application')}
          </button>
        </div>
      </div>
      
      {/* Field Editor Modal */}
      {showFieldModal && currentField && (
        <div className="modal-overlay">
          <div className="modal field-editor-modal">
            <h2>Edit Field</h2>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="fieldType">Field Type</label>
                <select 
                  id="fieldType" 
                  value={currentField.fieldType} 
                  onChange={(e) => setCurrentField({
                    ...currentField,
                    fieldType: e.target.value
                  })}
                >
                  <option value="short_text">Short Text</option>
                  <option value="long_text">Long Text</option>
                  <option value="paragraph">Paragraph</option>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="dropdown">Dropdown</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="label">Label</label>
                <input 
                  type="text" 
                  id="label" 
                  value={currentField.label} 
                  onChange={(e) => setCurrentField({
                    ...currentField,
                    label: e.target.value
                  })}
                  placeholder="Enter field label"
                  required
                />
              </div>
              
              {['short_text', 'long_text', 'paragraph'].includes(currentField.fieldType) && (
                <div className="form-group">
                  <label htmlFor="placeholder">Placeholder (Optional)</label>
                  <input 
                    type="text" 
                    id="placeholder" 
                    value={currentField.placeholder || ''} 
                    onChange={(e) => setCurrentField({
                      ...currentField,
                      placeholder: e.target.value
                    })}
                    placeholder="Enter placeholder text"
                  />
                </div>
              )}
              
              {['multiple_choice', 'checkbox', 'dropdown'].includes(currentField.fieldType) && (
                <div className="form-group">
                  <label>Options</label>
                  <div className="options-editor">
                    {(currentField.options || []).map((option, i) => (
                      <div key={i} className="option-row">
                        <input 
                          type="text" 
                          value={option} 
                          onChange={(e) => {
                            const newOptions = [...(currentField.options || [])];
                            newOptions[i] = e.target.value;
                            setCurrentField({
                              ...currentField,
                              options: newOptions
                            });
                          }}
                          placeholder={`Option ${i + 1}`}
                        />
                        <button 
                          type="button" 
                          className="btn-remove-option"
                          onClick={() => {
                            const newOptions = [...(currentField.options || [])];
                            newOptions.splice(i, 1);
                            setCurrentField({
                              ...currentField,
                              options: newOptions
                            });
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button 
                      type="button"
                      className="btn-add-option"
                      onClick={() => setCurrentField({
                        ...currentField,
                        options: [...(currentField.options || []), '']
                      })}
                    >
                      Add Option
                    </button>
                  </div>
                </div>
              )}
              
              <div className="form-group checkbox-group">
                <label>
                  <input 
                    type="checkbox" 
                    checked={currentField.required || false}
                    onChange={(e) => setCurrentField({
                      ...currentField,
                      required: e.target.checked
                    })}
                  />
                  Required Field
                </label>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => {
                  setShowFieldModal(false);
                  setCurrentField(null);
                }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary"
                onClick={saveField}
              >
                Save Field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationBuilder;