
import React, { useState } from 'react';
import { Client, ClientFormProps, AlliedHealthNeed, AlliedHealthServiceType } from '../types';
import { TIME_SLOTS_H_MM, ALL_ALLIED_HEALTH_SERVICES, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END } from '../constants';
import { TrashIcon } from './icons/TrashIcon';
import { PlusIcon } from './icons/PlusIcon';
import SearchableMultiSelectDropdown from './SearchableMultiSelectDropdown';
import { getClientColor } from '../utils/colorUtils';

const ClientForm: React.FC<ClientFormProps> = ({ client, availableTeams, availableInsuranceQualifications, onUpdate, onRemove }) => {
  const [formData, setFormData] = useState<Client>(client);

  const handleInputChange = (field: keyof Client, value: any) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    onUpdate(newFormData);
  };
  
  const handleAlliedHealthChange = (index: number, field: keyof AlliedHealthNeed, value: any) => {
    const newAlliedHealthNeeds = [...formData.alliedHealthNeeds];
    (newAlliedHealthNeeds[index] as any)[field] = value;
     if (field === 'durationMinutes') {
        (newAlliedHealthNeeds[index] as any)[field] = parseInt(value,10) || 0;
    }
    if (field === 'frequencyPerWeek') {
        (newAlliedHealthNeeds[index]as any)[field] = parseInt(value,10) || 0;
    }
    handleInputChange('alliedHealthNeeds', newAlliedHealthNeeds);
  };

  const addAlliedHealthNeed = () => {
    const newNeed: AlliedHealthNeed = { type: 'OT', frequencyPerWeek: 1, durationMinutes: 30 };
    handleInputChange('alliedHealthNeeds', [...formData.alliedHealthNeeds, newNeed]);
  };

  const removeAlliedHealthNeed = (index: number) => {
    handleInputChange('alliedHealthNeeds', formData.alliedHealthNeeds.filter((_, i) => i !== index));
  };
  
  const handleInsuranceRequirementsChange = (selectedRequirements: string[]) => {
    handleInputChange('insuranceRequirements', selectedRequirements);
  };

  const clientColor = formData.color || getClientColor(client.id);

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
      <div className="flex justify-between items-center pb-4 border-b border-slate-50">
        <div className="flex items-center space-x-4 w-full mr-4">
          <div className="relative group">
            <input
              type="color"
              value={clientColor}
              onChange={(e) => handleInputChange('color', e.target.value)}
              className="w-10 h-10 rounded-full border-2 border-white shadow-sm cursor-pointer overflow-hidden p-0 block appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none [&::-moz-color-swatch]:rounded-full"
              style={{ backgroundColor: clientColor }}
              title="Customize schedule block color"
            />
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap z-10 shadow-lg">
              Customize Color
            </div>
          </div>
          <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="text-2xl font-serif text-slate-900 bg-transparent border-none focus:ring-0 focus:outline-none w-full placeholder:text-slate-300"
              placeholder="Client Name"
          />
        </div>
        <button
          onClick={() => onRemove(client.id)}
          className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 p-2 hover:bg-red-50 rounded-full"
          aria-label="Remove Client"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label htmlFor={`teamId-${client.id}`} className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Team Assignment</label>
          <select
            id={`teamId-${client.id}`}
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

        <div>
           <SearchableMultiSelectDropdown
                id={`client-insurance-reqs-${client.id}`}
                label="Insurance Requirements"
                options={availableInsuranceQualifications.map(q => q.id)}
                selectedOptions={formData.insuranceRequirements}
                onChange={handleInsuranceRequirementsChange}
                placeholder="Search or select requirements..."
                ariaLabel={`Insurance requirements for ${formData.name}`}
            />
            {availableInsuranceQualifications.length === 0 && (
                 <p className="text-xs text-slate-400 mt-2 italic">No insurance types defined in Settings.</p>
            )}
        </div>
      </div>

      <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
        <p className="text-xs leading-relaxed text-blue-600/80">
          <span className="font-bold uppercase tracking-tighter mr-2">Note:</span>
          Clients are assumed to require coverage Monday-Friday, 9 AM - 5 PM.
          Allied Health needs are scheduled additionally.
          The primary staff member is the BCBA on the assigned team.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
           <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Allied Health Needs</h4>
           <button onClick={addAlliedHealthNeed} className="text-brand-blue hover:text-blue-700 font-bold text-xs flex items-center space-x-1 py-1 px-2 hover:bg-blue-50 rounded-lg transition-all"> <PlusIcon className="w-3 h-3" /> <span>Add Requirement</span> </button>
        </div>

        <div className="space-y-3">
          {formData.alliedHealthNeeds.map((need, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
              <div className="md:col-span-3">
                <select value={need.type} onChange={(e) => handleAlliedHealthChange(index, 'type', e.target.value as AlliedHealthServiceType)} className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-blue/20 outline-none"> {ALL_ALLIED_HEALTH_SERVICES.map(type => <option key={type} value={type}>{type}</option>)} </select>
              </div>
              <div className="md:col-span-2">
                <input type="number" placeholder="Freq/Week" value={need.frequencyPerWeek} onChange={(e) => handleAlliedHealthChange(index, 'frequencyPerWeek', e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-blue/20 outline-none" min="0"/>
              </div>
              <div className="md:col-span-2">
                <input type="number" placeholder="Mins/Session" value={need.durationMinutes} onChange={(e) => handleAlliedHealthChange(index, 'durationMinutes', e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-blue/20 outline-none" min="15" step="15"/>
              </div>
              <div className="md:col-span-4 flex space-x-2">
                  <select
                      value={need.preferredTimeSlot?.startTime || ""}
                      onChange={(e) => handleAlliedHealthChange(index, 'preferredTimeSlot', { ...need.preferredTimeSlot, startTime: e.target.value || COMPANY_OPERATING_HOURS_START })}
                      className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-brand-blue/20 outline-none"
                  >
                      <option value="">Start</option>
                      {TIME_SLOTS_H_MM.map(time => <option key={`pref-start-${time}`} value={time}>{time}</option>)}
                  </select>
                  <select
                      value={need.preferredTimeSlot?.endTime || ""}
                      onChange={(e) => handleAlliedHealthChange(index, 'preferredTimeSlot', { ...need.preferredTimeSlot, endTime: e.target.value || COMPANY_OPERATING_HOURS_END })}
                      className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-brand-blue/20 outline-none"
                  >
                        <option value="">End</option>
                      {TIME_SLOTS_H_MM.map(time => <option key={`pref-end-${time}`} value={time}>{time}</option>)}
                  </select>
              </div>
              <div className="md:col-span-1 flex justify-end">
                <button onClick={() => removeAlliedHealthNeed(index)} className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-xl" aria-label="Remove Allied Health Need"> <TrashIcon className="w-4 h-4" /> </button>
              </div>
            </div>
          ))}
          {formData.alliedHealthNeeds.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl">
              <p className="text-sm text-slate-400">No allied health requirements added.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientForm;
