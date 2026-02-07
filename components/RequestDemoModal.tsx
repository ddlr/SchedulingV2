import React, { useState } from 'react';
import { XMarkIcon } from './icons/XMarkIcon';
import { demoRequestService } from '../services/demoRequestService';

interface RequestDemoModalProps {
  onClose: () => void;
}

const RequestDemoModal: React.FC<RequestDemoModalProps> = ({ onClose }) => {
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Company name is required';
    }

    if (!formData.contact_name.trim()) {
      newErrors.contact_name = 'Contact name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const result = await demoRequestService.submitRequest(formData);

    setIsSubmitting(false);

    if (result.success) {
      setIsSuccess(true);
    } else {
      setErrors({ submit: result.error || 'Failed to submit request' });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Request Submitted!</h3>
          <p className="text-slate-600 mb-6">
            Thank you for your interest in Ordus ABA. We'll be in touch within 24 hours to schedule your personalized demo.
          </p>
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900">Request a Demo</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-slate-700 mb-2">
              Company Name *
            </label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.company_name ? 'border-red-500' : 'border-slate-300'
              }`}
              placeholder="Your Company"
            />
            {errors.company_name && (
              <p className="mt-1 text-sm text-red-600">{errors.company_name}</p>
            )}
          </div>

          <div>
            <label htmlFor="contact_name" className="block text-sm font-medium text-slate-700 mb-2">
              Your Name *
            </label>
            <input
              type="text"
              id="contact_name"
              name="contact_name"
              value={formData.contact_name}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.contact_name ? 'border-red-500' : 'border-slate-300'
              }`}
              placeholder="John Doe"
            />
            {errors.contact_name && (
              <p className="mt-1 text-sm text-red-600">{errors.contact_name}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.email ? 'border-red-500' : 'border-slate-300'
              }`}
              placeholder="john@company.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-2">
              Tell us about your scheduling needs
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="How many therapists and clients do you manage? What are your biggest scheduling challenges?"
            />
          </div>

          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>

          <p className="text-xs text-slate-500 text-center">
            * Required fields
          </p>
        </form>
      </div>
    </div>
  );
};

export default RequestDemoModal;
