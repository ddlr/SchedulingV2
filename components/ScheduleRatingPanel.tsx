
import React, { useState } from 'react';
import { GeneratedSchedule, ValidationError } from '../types';
import { ScheduleLearningService } from '../services/scheduleLearningService';

interface ScheduleRatingPanelProps {
  schedule: GeneratedSchedule | null;
  validationErrors: ValidationError[];
  teamId?: string;
  onFeedbackSubmitted?: () => void;
}

export const ScheduleRatingPanel: React.FC<ScheduleRatingPanelProps> = ({
  schedule,
  validationErrors,
  teamId,
  onFeedbackSubmitted
}) => {
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [diagnostics, setDiagnostics] = useState<any>(null);

  if (!schedule || schedule.length === 0) {
    return null;
  }

  const handleRating = (value: number) => {
    setRating(value);
  };

  const handleSubmitFeedback = async () => {
    if (!rating) {
      setSubmitMessage('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage('Submitting feedback...');

    try {
      const success = await ScheduleLearningService.submitFeedback({
        schedule,
        rating,
        violationsCount: validationErrors.length,
        violationsDetail: validationErrors,
        feedbackText: feedback,
        teamId
      });

      if (success) {
        setSubmitMessage('Thank you! Your feedback helps improve schedule generation.');
        setRating(null);
        setFeedback('');
        onFeedbackSubmitted?.();

        setTimeout(() => setSubmitMessage(''), 3000);
      } else {
        setSubmitMessage('Error submitting feedback. Please try again.');
      }
    } catch (e) {
      console.error('Error submitting feedback:', e);
      setSubmitMessage('Error submitting feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDiagnostics = async () => {
    try {
      const diag = await ScheduleLearningService.getSelfDiagnostics();
      setDiagnostics(diag);
    } catch (e) {
      console.error('Error fetching diagnostics:', e);
    }
  };

  return (
    <div
      style={{
        padding: '20px',
        margin: '20px 0',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '16px', fontWeight: 600 }}>
        Rate This Schedule
      </h3>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', fontWeight: 500 }}>
          How well does this schedule follow your requirements?
        </label>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          {[1, 2, 3, 4, 5].map(value => (
            <button
              key={value}
              onClick={() => handleRating(value)}
              style={{
                padding: '10px 15px',
                border: `2px solid ${rating === value ? '#007bff' : '#dee2e6'}`,
                backgroundColor: rating === value ? '#007bff' : '#fff',
                color: rating === value ? '#fff' : '#000',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              {value}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '12px', color: '#6c757d', margin: '5px 0' }}>
          1 = Poor | 5 = Excellent
        </p>
      </div>

      {validationErrors.length > 0 && (
        <div
          style={{
            padding: '12px',
            marginBottom: '15px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '6px',
            fontSize: '13px'
          }}
        >
          <strong>Issues detected: {validationErrors.length}</strong>
          <ul style={{ marginTop: '8px', paddingLeft: '20px', margin: '8px 0 0 0' }}>
            {validationErrors.slice(0, 3).map((err, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>
                {err.ruleId}
              </li>
            ))}
            {validationErrors.length > 3 && <li>... and {validationErrors.length - 3} more</li>}
          </ul>
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
          Additional Feedback (optional)
        </label>
        <textarea
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          placeholder="What could be improved? Any specific concerns?"
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: '80px'
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button
          onClick={handleSubmitFeedback}
          disabled={isSubmitting || !rating}
          style={{
            padding: '10px 20px',
            backgroundColor: isSubmitting || !rating ? '#ccc' : '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: isSubmitting || !rating ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'background-color 0.2s'
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>

        <button
          onClick={handleViewDiagnostics}
          style={{
            padding: '10px 20px',
            backgroundColor: '#17a2b8',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'background-color 0.2s'
          }}
        >
          View System Diagnostics
        </button>
      </div>

      {submitMessage && (
        <div
          style={{
            padding: '10px',
            marginBottom: '10px',
            backgroundColor: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '6px',
            color: '#155724',
            fontSize: '13px'
          }}
        >
          {submitMessage}
        </div>
      )}

      {diagnostics && (
        <div
          style={{
            padding: '15px',
            marginTop: '15px',
            backgroundColor: '#e7f3ff',
            border: '1px solid #b3d9ff',
            borderRadius: '6px',
            fontSize: '13px'
          }}
        >
          <h4 style={{ marginTop: 0, marginBottom: '10px' }}>System Diagnostics</h4>
          <div style={{ marginBottom: '10px' }}>
            <strong>Average Schedule Rating:</strong>{' '}
            <span style={{ color: diagnostics.averageRating >= 4 ? '#28a745' : '#dc3545' }}>
              {diagnostics.averageRating.toFixed(2)} / 5
            </span>
          </div>

          {diagnostics.strengths.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <strong>What the system does well:</strong>
              <ul style={{ marginTop: '5px', paddingLeft: '20px', margin: '5px 0 0 0' }}>
                {diagnostics.strengths.map((strength: string, idx: number) => (
                  <li key={idx}>{strength}</li>
                ))}
              </ul>
            </div>
          )}

          {diagnostics.recommendedFocusAreas.length > 0 && (
            <div>
              <strong>Focus areas for improvement:</strong>
              <ul style={{ marginTop: '5px', paddingLeft: '20px', margin: '5px 0 0 0' }}>
                {diagnostics.recommendedFocusAreas.map((area: string, idx: number) => (
                  <li key={idx}>{area}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScheduleRatingPanel;
