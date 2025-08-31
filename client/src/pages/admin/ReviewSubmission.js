import React from 'react';
import { useParams, Link } from 'react-router-dom';
import '../../styles/admin/ReviewSubmission.css';

const ReviewSubmission = () => {
  const { id } = useParams();
  
  return (
    <div className="review-submission">
      <h1>Review Application Submission</h1>
      <p>Submission ID: {id}</p>
      
      <div className="submission-details">
        <p>Loading submission details...</p>
      </div>
      
      <div className="review-actions">
        <Link to="/admin" className="btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default ReviewSubmission;