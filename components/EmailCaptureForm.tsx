import React, { useState } from 'react';
import { emailSignupService } from '../services/emailSignupService';

interface EmailCaptureFormProps {
  onSuccess?: () => void;
  source?: string;
}

const EmailCaptureForm: React.FC<EmailCaptureFormProps> = ({ onSuccess, source = 'hero_section' }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    const result = await emailSignupService.submitEmail({
      email: email.trim(),
      signup_source: source,
    });

    setIsSubmitting(false);

    if (result.success) {
      setIsSuccess(true);
      setEmail('');
      if (onSuccess) {
        onSuccess();
      }
    } else {
      setError(result.error || 'Failed to submit email');
    }
  };

  if (isSuccess) {
    return (
      <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg border border-green-200">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="font-medium">Thanks! We'll be in touch soon.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 placeholder-slate-500"
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap flex items-center gap-2"
        >
          {isSubmitting ? 'Submitting...' : 'See the demo'}
          {!isSubmitting && (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !isSuccess && (
        <p className="text-sm text-slate-500">No spam. Just product updates.</p>
      )}
    </form>
  );
};

export default EmailCaptureForm;
