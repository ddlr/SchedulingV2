
import React, { useState, useEffect, useMemo } from 'react';
import { SessionModalProps, ScheduleEntry, DayOfWeek, SessionType, Client, ValidationError, Therapist, Team } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { TrashIcon } from './icons/TrashIcon';
import { TIME_SLOTS_H_MM, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END } from '../constants';
import { timeToMinutes as convertTimeToMinutes, to12HourTime } from '../utils/validationService';
import { sortStaffHierarchically } from '../utils/staffUtils';

const ensureScheduleEntryId = (id?: string) => id || `schedEntry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const SessionModal: React.FC<SessionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  sessionData,
  newSessionSlot,
  clients,
  therapists,
  availableTeams,
  insuranceQualifications,
  availableSessionTypes,
  timeSlots: allTimeSlots,
  currentSchedule,
  currentError,
  clearError
}) => {
  const initialFormState: ScheduleEntry = {
    id: ensureScheduleEntryId(),
    clientName: null,
    clientId: null,
    therapistName: '',
    therapistId: '',
    day: DayOfWeek.MONDAY,
    startTime: '',
    endTime: '',
    sessionType: 'ABA',
  };

  const [formData, setFormData] = useState<ScheduleEntry>(initialFormState);
  const [formError, setFormError] = useState<ValidationError[] | null>(null);

  const sortedTeams = useMemo(() => {
    return [...availableTeams].sort((a, b) => a.name.localeCompare(b.name));
  }, [availableTeams]);

  const filteredTherapists = useMemo(() => {
    if (formData.sessionType === 'AlliedHealth_OT') return therapists.filter(t => t.role === 'OT');
    if (formData.sessionType === 'AlliedHealth_SLP') return therapists.filter(t => t.role === 'SLP');
    return therapists;
  }, [therapists, formData.sessionType]);

  // Filter time slots to only show those within operating hours
  const visibleTimeSlots = useMemo(() => {
    const opStart = convertTimeToMinutes(COMPANY_OPERATING_HOURS_START);
    const opEnd = convertTimeToMinutes(COMPANY_OPERATING_HOURS_END);
    
    return allTimeSlots.filter(time => {
        const minutes = convertTimeToMinutes(time);
        return minutes >= opStart && minutes <= opEnd;
    });
  }, [allTimeSlots]);

  const calculateDefaultEndTime = (
    startTime: string,
    sessionType: SessionType,
    currentClientId: string | null,
    availableClients: Client[]
  ): string => {
    if (!startTime || !allTimeSlots || allTimeSlots.length === 0) return "";

    const startIndex = allTimeSlots.indexOf(startTime);
    if (startIndex === -1) return "";

    let durationMinutesDefault = 60;

    if (sessionType === 'IndirectTime') {
        durationMinutesDefault = 30;
    } else if ((sessionType === 'AlliedHealth_OT' || sessionType === 'AlliedHealth_SLP') && currentClientId) {
        const client = availableClients.find(c => c.id === currentClientId);
        const ahType = sessionType === 'AlliedHealth_OT' ? 'OT' : 'SLP';
        const need = client?.alliedHealthNeeds.find(n => n.type === ahType);
        if (need && need.startTime && need.endTime) {
            const startMinutes = parseInt(need.startTime.split(':')[0]) * 60 + parseInt(need.startTime.split(':')[1]);
            const endMinutes = parseInt(need.endTime.split(':')[0]) * 60 + parseInt(need.endTime.split(':')[1]);
            durationMinutesDefault = endMinutes - startMinutes;
        } else {
            durationMinutesDefault = 45;
        }
    } else if (sessionType === 'AlliedHealth_OT' || sessionType === 'AlliedHealth_SLP') {
        durationMinutesDefault = 45;
    }

    const slotGranularity = 15;
    const durationInSlots = Math.ceil(durationMinutesDefault / slotGranularity);
    let proposedEndIndex = startIndex + durationInSlots;

    if (proposedEndIndex >= allTimeSlots.length) {
      proposedEndIndex = allTimeSlots.length - 1;
    }
    
    const operatingEndIndex = allTimeSlots.indexOf(COMPANY_OPERATING_HOURS_END);
     if (operatingEndIndex !== -1 && proposedEndIndex > operatingEndIndex) {
        if (sessionType !== 'IndirectTime') {
            proposedEndIndex = operatingEndIndex;
        } else if (proposedEndIndex > operatingEndIndex) {
            proposedEndIndex = operatingEndIndex;
        }
    }

    if (proposedEndIndex <= startIndex) {
      const nextSlotIndex = startIndex + 1;
      if (nextSlotIndex < allTimeSlots.length && (operatingEndIndex === -1 || nextSlotIndex <= operatingEndIndex)) {
        return allTimeSlots[nextSlotIndex];
      }
      return "";
    }
    return allTimeSlots[proposedEndIndex];
  };

  useEffect(() => {
    if (isOpen) {
      setFormError(null);
      if (sessionData) {
        setFormData({...sessionData, id: ensureScheduleEntryId(sessionData.id)});
      } else if (newSessionSlot) {
        const defaultSessionType: SessionType = 'ABA';
        const therapist = therapists.find(t => t.id === newSessionSlot.therapistId);
        setFormData({
          ...initialFormState,
          id: ensureScheduleEntryId(),
          therapistId: newSessionSlot.therapistId,
          therapistName: therapist ? therapist.name : newSessionSlot.therapistName,
          day: newSessionSlot.day,
          startTime: newSessionSlot.startTime,
          sessionType: defaultSessionType,
          clientId: clients.length > 0 ? clients[0].id : null,
          clientName: clients.length > 0 ? clients[0].name : null,
          endTime: calculateDefaultEndTime(newSessionSlot.startTime, defaultSessionType, clients.length > 0 ? clients[0].id : null, clients),
        });
      } else {
        setFormData({...initialFormState, id: ensureScheduleEntryId()});
      }
    }
  }, [isOpen, sessionData, newSessionSlot, clients, therapists]);

  const handleInputChange = (field: keyof ScheduleEntry, value: string | null | SessionType | DayOfWeek | string[]) => {
    setFormError(null);
    clearError();

    let newFormData = { ...formData, [field]: value };

    if (field === 'therapistId') {
        const therapist = therapists.find(t => t.id === value);
        newFormData.therapistName = therapist ? therapist.name : '';
    }

    if (field === 'clientId') {
        const client = clients.find(c => c.id === value);
        newFormData.clientName = client ? client.name : null;
         if (newFormData.sessionType === 'AlliedHealth_OT' || newFormData.sessionType === 'AlliedHealth_SLP') {
            newFormData.endTime = calculateDefaultEndTime(newFormData.startTime, newFormData.sessionType, value as string | null, clients);
        }
    }
    
    if (field === 'sessionType') {
        const newSessionType = value as SessionType;
        if (newSessionType === 'IndirectTime') {
            newFormData.clientName = null;
            newFormData.clientId = null;
        } else if (newFormData.clientId === null && clients.length > 0) {
             newFormData.clientId = clients[0].id;
             newFormData.clientName = clients[0].name;
        }
        if (newSessionType === 'AlliedHealth_OT' || newSessionType === 'AlliedHealth_SLP') {
            const requiredRole = newSessionType === 'AlliedHealth_OT' ? 'OT' : 'SLP';
            const currentTherapist = therapists.find(t => t.id === newFormData.therapistId);
            if (!currentTherapist || currentTherapist.role !== requiredRole) {
                newFormData.therapistId = '';
                newFormData.therapistName = '';
            }
        }
        newFormData.endTime = calculateDefaultEndTime(newFormData.startTime, newSessionType, newFormData.clientId, clients);
    }

    if (field === 'startTime') {
        newFormData.endTime = calculateDefaultEndTime(value as string, newFormData.sessionType, newFormData.clientId, clients);
    }
    
    setFormData(newFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    const localErrors: ValidationError[] = [];

    if (!formData.therapistId) {
      localErrors.push({ ruleId: "MISSING_THERAPIST", message: "Staff member must be selected."});
    }
    if (formData.sessionType !== 'IndirectTime' && !formData.clientId) {
      localErrors.push({ ruleId: "MISSING_CLIENT", message: "Client must be selected for non-indirect sessions."});
    }
    if (!formData.startTime || !formData.endTime) {
      localErrors.push({ ruleId: "MISSING_TIMES", message: "Start and end times are required."});
    } else if (convertTimeToMinutes(formData.startTime) >= convertTimeToMinutes(formData.endTime)) {
      localErrors.push({ ruleId: "INVALID_TIME_ORDER", message: "End time must be after start time."});
    }

    if (localErrors.length > 0) {
        setFormError(localErrors);
        return;
    }

    // Min Session Duration Check for Insurance
    if (formData.clientId) {
        const client = clients.find(c => c.id === formData.clientId);
        if (client) {
            const duration = convertTimeToMinutes(formData.endTime) - convertTimeToMinutes(formData.startTime);
            client.insuranceRequirements.forEach(reqId => {
                const qual = insuranceQualifications.find(q => q.id === reqId);
                if (qual && qual.minSessionDurationMinutes && duration < qual.minSessionDurationMinutes) {
                    localErrors.push({
                        ruleId: "MIN_DURATION_VIOLATED",
                        message: `${reqId} requires at least ${qual.minSessionDurationMinutes} mins. Current: ${duration} mins.`
                    });
                }
            });
        }
    }

    if (localErrors.length > 0) {
        setFormError(localErrors);
        return;
    }

    onSave(formData);
  };

  const handleDeleteClick = () => {
    if (onDelete && sessionData) {
      if (window.confirm(`Are you sure you want to delete this session for ${sessionData.clientName || 'Indirect Task'} with ${sessionData.therapistName}?`)) {
        onDelete(sessionData);
      }
    }
  };

  if (!isOpen) return null;

  const displayErrors = formError || currentError;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-labelledby="session-modal-title">
      <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-white/20 animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-8">
          <h2 id="session-modal-title" className="text-2xl font-serif text-slate-900 tracking-tight">
            {sessionData ? 'Modify Session' : 'Plan Session'}
          </h2>
          <button onClick={() => { clearError(); onClose(); }} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-all" aria-label="Close session modal">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {displayErrors && displayErrors.length > 0 && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 mb-6 rounded-2xl text-xs font-medium" role="alert">
            <div className="flex items-center gap-2 mb-2">
               <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
               <p className="font-bold uppercase tracking-widest">Requirements not met</p>
            </div>
            <ul className="space-y-1 ml-3.5">
                {displayErrors.map((err, index) => (
                    <li key={index} className="opacity-80">
                        {err.message}
                    </li>
                ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sessionDay" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Day</label>
              <input
                type="text"
                id="sessionDay"
                value={formData.day}
                readOnly
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-500 font-medium cursor-not-allowed outline-none"
                aria-readonly="true"
              />
            </div>
            <div>
              <label htmlFor="sessionType" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Session Type</label>
              <select
                id="sessionType"
                value={formData.sessionType}
                onChange={(e) => handleInputChange('sessionType', e.target.value as SessionType)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              >
                {availableSessionTypes.map(type => <option key={type} value={type}>{type === 'IndirectTime' ? 'Lunch' : type}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="sessionTherapist" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Staff Member</label>
            <select
              id="sessionTherapist"
              value={formData.therapistId}
              onChange={(e) => handleInputChange('therapistId', e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              required
            >
              <option value="">Select Staff...</option>
              {sortedTeams.map(team => {
                const teamTherapists = filteredTherapists.filter(t => t.teamId === team.id).sort(sortStaffHierarchically);
                if (teamTherapists.length === 0) return null;
                return (
                  <optgroup key={team.id} label={`${team.name} Team`}>
                    {teamTherapists.map(t => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
                  </optgroup>
                );
              })}
              {filteredTherapists.some(t => !t.teamId || !availableTeams.find(team => team.id === t.teamId)) && (
                <optgroup label="Unassigned">
                  {filteredTherapists.filter(t => !t.teamId || !availableTeams.find(team => team.id === t.teamId)).sort(sortStaffHierarchically).map(t => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
                </optgroup>
              )}
            </select>
          </div>

          <div>
            <label htmlFor="sessionClient" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Client</label>
            <select
              id="sessionClient"
              value={formData.clientId || ""}
              onChange={(e) => handleInputChange('clientId', e.target.value === "" ? null : e.target.value)}
              disabled={formData.sessionType === 'IndirectTime'}
              className={`w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all ${formData.sessionType === 'IndirectTime' ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-disabled={formData.sessionType === 'IndirectTime'}
            >
              <option value="">N/A (Lunch)</option>
              {sortedTeams.map(team => {
                const teamClients = clients.filter(c => c.teamId === team.id).sort((a, b) => a.name.localeCompare(b.name));
                if (teamClients.length === 0) return null;
                return (
                  <optgroup key={team.id} label={`${team.name} Team`}>
                    {teamClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                );
              })}
              {clients.some(c => !c.teamId || !availableTeams.find(team => team.id === c.teamId)) && (
                <optgroup label="Unassigned">
                  {clients.filter(c => !c.teamId || !availableTeams.find(team => team.id === c.teamId)).sort((a,b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sessionStartTime" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Start Time</label>
              <select
                id="sessionStartTime"
                value={formData.startTime}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
                required
              >
                <option value="">Start</option>
                {visibleTimeSlots.map(time => <option key={`start-${time}`} value={time}>{to12HourTime(time)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sessionEndTime" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">End Time</label>
              <select
                id="sessionEndTime"
                value={formData.endTime}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
                required
              >
                <option value="">End</option>
                {visibleTimeSlots.map(time => <option key={`end-${time}`} value={time}>{to12HourTime(time)}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center pt-6 border-t border-slate-50">
            <div>
              {sessionData && onDelete && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                  aria-label="Delete Session"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => { clearError(); onClose(); }}
                className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-8 py-3 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-full shadow-lg shadow-slate-200 hover:shadow-xl transition-all"
              >
                {sessionData ? 'Update Session' : 'Create Session'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SessionModal;
