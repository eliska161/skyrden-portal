import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import '../../styles/admin/AdminDashboard.css';

const AdminDashboard = () => {
  const [submissions, setSubmissions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({
    templateId: '',
    status: '',
    sortBy: 'submissionDate',
    order: 'desc'
  });
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch templates and submissions
        const [templatesRes, submissionsRes] = await Promise.all([
          axios.get('/api/applications/admin/templates', { withCredentials: true }),
          axios.get('/api/applications/admin/submissions', { 
            params: filter,
            withCredentials: true 
          })
        ]);
        
        setTemplates(templatesRes.data);
        setSubmissions(submissionsRes.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching admin data:', err);
        setError('Failed to load dashboard data. Please try again.');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [filter]);
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter({
      ...filter,
      [name]: value
    });
  };
  
  const handleSortChange = (field) => {
    setFilter({
      ...filter,
      sortBy: field,
      order: filter.sortBy === field && filter.order === 'desc' ? 'asc' : 'desc'
    });
  };
  
  const handleSendAllNotifications = async () => {
    try {
      await axios.post('/api/applications/admin/send-notifications', {}, { 
        withCredentials: true 
      });
      
      // Refresh submissions
      const submissionsRes = await axios.get('/api/applications/admin/submissions', { 
        params: filter,
        withCredentials: true 
      });
      
      setSubmissions(submissionsRes.data);
      alert('Notifications sent successfully!');
    } catch (err) {
      console.error('Error sending notifications:', err);
      alert('Failed to send notifications. Please try again.');
    }
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading admin dashboard...</p>
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
  
  const pendingReviewCount = submissions.filter(s => s.status === 'pending').length;
  const reviewedCount = submissions.filter(s => s.status !== 'pending').length;
  const pendingNotificationCount = submissions.filter(s => 
    (s.status === 'approved' || s.status === 'denied') && !s.notificationSent
  ).length;
  
  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      
      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Pending Review</h3>
          <div className="stat-value">{pendingReviewCount}</div>
        </div>
        <div className="stat-card">
          <h3>Reviewed</h3>
          <div className="stat-value">{reviewedCount}</div>
        </div>
        <div className="stat-card">
          <h3>Applications</h3>
          <div className="stat-value">{templates.filter(t => t.status === 'open').length} Open</div>
        </div>
      </div>
      
      <div className="dashboard-actions">
        <Link to="/admin/applications/new" className="btn-primary">
          Create New Application
        </Link>
        {pendingNotificationCount > 0 && (
          <button onClick={handleSendAllNotifications} className="btn-secondary">
            Send {pendingNotificationCount} Pending Notifications
          </button>
        )}
      </div>
      
      <div className="submissions-section">
        <h2>Application Submissions</h2>
        
        <div className="filter-controls">
          <div className="filter-group">
            <label>Application:</label>
            <select 
              name="templateId" 
              value={filter.templateId} 
              onChange={handleFilterChange}
            >
              <option value="">All Applications</option>
              {templates.map(template => (
                <option key={template._id} value={template._id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Status:</label>
            <select 
              name="status" 
              value={filter.status} 
              onChange={handleFilterChange}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
            </select>
          </div>
        </div>
        
        {submissions.length === 0 ? (
          <div className="no-submissions">
            <p>No submissions match your filter criteria.</p>
          </div>
        ) : (
          <table className="submissions-table">
            <thead>
              <tr>
                <th onClick={() => handleSortChange('discordUsername')}>
                  Applicant
                  {filter.sortBy === 'discordUsername' && (
                    <span className="sort-icon">{filter.order === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th onClick={() => handleSortChange('templateId')}>
                  Application
                  {filter.sortBy === 'templateId' && (
                    <span className="sort-icon">{filter.order === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th onClick={() => handleSortChange('submissionDate')}>
                  Date
                  {filter.sortBy === 'submissionDate' && (
                    <span className="sort-icon">{filter.order === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th onClick={() => handleSortChange('status')}>
                  Status
                  {filter.sortBy === 'status' && (
                    <span className="sort-icon">{filter.order === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(submission => (
                <tr key={submission._id} className={`status-${submission.status}`}>
                  <td className="applicant-col">
                    <div>{submission.discordUsername}</div>
                    {submission.robloxUsername && <div className="roblox-username">Roblox: {submission.robloxUsername}</div>}
                  </td>
                  <td>{submission.templateId.name}</td>
                  <td>{new Date(submission.submissionDate).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-badge ${submission.status}`}>
                      {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                      {submission.status !== 'pending' && !submission.notificationSent && (
                        <span className="notification-pending">Notification Pending</span>
                      )}
                    </span>
                  </td>
                  <td>
                    <Link to={`/admin/submissions/${submission._id}`} className="btn-view">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="applications-section">
        <h2>Manage Applications</h2>
        <table className="applications-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Submissions</th>
              <th>Created Date</th>
              <th>Closure Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(template => {
              const templateSubmissions = submissions.filter(s => s.templateId._id === template._id);
              return (
                <tr key={template._id}>
                  <td>{template.name}</td>
                  <td>
                    <span className={`status-badge ${template.status}`}>
                      {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
                    </span>
                  </td>
                  <td>{templateSubmissions.length}</td>
                  <td>{new Date(template.createdDate).toLocaleDateString()}</td>
                  <td>{template.closureDate ? new Date(template.closureDate).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <div className="action-buttons">
                      <Link to={`/admin/applications/edit/${template._id}`} className="btn-edit">
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;