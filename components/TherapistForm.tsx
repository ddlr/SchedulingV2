
import React, { useState } from 'react';
import { Therapist, TherapistFormProps, TherapistRole } from '../types';
import { ALL_THERAPIST_ROLES } from '../constants';
import { TrashIcon } from './icons/TrashIcon';
import SearchableMultiSelectDropdown from './SearchableMultiSelectDropdown';

const TherapistForm: React.FC<TherapistFormProps> = ({ therapist, availableTeams, availableInsuranceQualifications, onUpdate, onRemove }) => {
  const [formData, setFormData] = useState<Therapist>(therapist);

  const handleInputChange = (field: keyof Therapist, value: any) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    onUpdate(newFormData);
  };

  const handleQualificationsChange = (selectedQualifications: string[]) => {
    handleInputChange('qualifications', selectedQualifications);
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
      <div className="flex justify-between items-center pb-4 border-b border-slate-50">
        <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="text-2xl font-serif text-slate-900 bg-transparent border-none focus:ring-0 focus:outline-none w-full placeholder:text-slate-300"
            placeholder="Staff Member Name"
        />
        <button
          onClick={() => onRemove(therapist.id)}
          className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 p-2 hover:bg-red-50 rounded-full"
          aria-label="Remove Staff Member"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <div>
          <label htmlFor={`role-${therapist.id}`} className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Primary Role</label>
          <select
            id={`role-${therapist.id}`}
            value={formData.role || 'BT'}
            onChange={(e) => handleInputChange('role', e.target.value as TherapistRole)}
            className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none"
          >
            {ALL_THERAPIST_ROLES.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`teamId-${therapist.id}`} className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Team</label>
          <select
            id={`teamId-${therapist.id}`}
            value={formData.teamId || ''}
            onChange={(e) => handleInputChange('teamId', e.target.value)}
            className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all outline-none"
          >
            <option value="">Unassigned</option>
            {availableTeams.map(team => (
              <option key={team.id} value={team.id} style={{ color: team.color }}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div>
        <SearchableMultiSelectDropdown
            id={`therapist-qualifications-${therapist.id}`}
            label="Qualifications & Credentials"
            options={availableInsuranceQualifications.map(q => q.id)}
            selectedOptions={formData.qualifications}
            onChange={handleQualificationsChange}
            placeholder="Search or select qualifications..."
            ariaLabel={`Qualifications for ${formData.name}`}
        />
         {availableInsuranceQualifications.length === 0 && (
             <p className="text-xs text-slate-400 mt-2 italic">No qualifications defined in Settings.</p>
        )}
      </div>
      
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
        <p className="text-xs leading-relaxed text-slate-500">
          <span className="font-bold uppercase tracking-tighter mr-2">Schedule Rules:</span>
          Staff members are assumed available 8:45 AM - 5:15 PM, Mon-Fri. Mandatory 30-minute lunch breaks are scheduled as 'IndirectTime'.
        </p>
      </div>
    </div>
  );
};

export default TherapistForm;
