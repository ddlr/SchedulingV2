
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
    <div className="p-8 my-12 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-6">
        <div>
          <h3 className="text-2xl font-serif text-slate-900 tracking-tight">Evaluate Intelligence</h3>
          <p className="text-sm text-slate-400 mt-1 font-medium">How effective was the automated distribution?</p>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(value => (
            <button
              key={value}
              onClick={() => handleRating(value)}
              className={`w-12 h-12 rounded-2xl border-2 font-bold transition-all ${
                rating === value
                  ? 'bg-slate-900 border-slate-900 text-white shadow-lg scale-110'
                  : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-6">
           {validationErrors.length > 0 && (
            <div className="p-6 bg-amber-50 border border-amber-100 rounded-[2rem] space-y-3">
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                 <p className="text-xs font-black text-amber-700 uppercase tracking-widest">Constraint Violations ({validationErrors.length})</p>
              </div>
              <ul className="space-y-2 ml-3.5">
                {validationErrors.slice(0, 3).map((err, idx) => (
                  <li key={idx} className="text-xs text-amber-600/80 font-medium">
                    {err.ruleId.replace(/_/g, ' ')}
                  </li>
                ))}
                {validationErrors.length > 3 && <li className="text-[10px] text-amber-400 italic">...and {validationErrors.length - 3} additional issues</li>}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Observational Notes</label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Provide context for the AI's performance..."
              className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all min-h-[140px] resize-none"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-3 pt-6 lg:pt-0">
            <button
              onClick={handleSubmitFeedback}
              disabled={isSubmitting || !rating}
              className="w-full bg-brand-blue hover:bg-blue-700 disabled:bg-slate-200 text-white font-bold py-4 px-8 rounded-full shadow-lg shadow-blue-100 hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Syncing Feedback...' : 'Submit Evaluation'}
            </button>

            <button
              onClick={handleViewDiagnostics}
              className="w-full bg-white hover:bg-slate-50 text-slate-500 border border-slate-100 font-bold py-4 px-8 rounded-full transition-all flex items-center justify-center gap-2"
            >
              System Health Diagnostics
            </button>
          </div>

          {submitMessage && (
            <div className={`p-4 rounded-2xl text-center text-xs font-bold uppercase tracking-widest animate-in fade-in zoom-in-95 duration-300 ${submitMessage.includes('Error') ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
              {submitMessage}
            </div>
          )}
        </div>
      </div>

      {diagnostics && (
        <div className="p-8 bg-slate-900 rounded-[2rem] text-white space-y-6 animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between">
            <h4 className="text-xl font-serif tracking-tight">Intelligence Diagnostics</h4>
            <div className="bg-white/10 px-4 py-1 rounded-full border border-white/10">
               <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mr-2">Average Score:</span>
               <span className={`text-lg font-black ${diagnostics.averageRating >= 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
                 {diagnostics.averageRating.toFixed(1)}/5.0
               </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Operational Strengths</p>
              <ul className="space-y-3">
                {diagnostics.strengths.map((strength: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5"></div>
                    <span className="text-sm text-slate-300">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Growth Opportunities</p>
              <ul className="space-y-3">
                {diagnostics.recommendedFocusAreas.map((area: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5"></div>
                    <span className="text-sm text-slate-300">{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleRatingPanel;
