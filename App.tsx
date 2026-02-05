
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Client, Therapist, TherapistRole, GeneratedSchedule, DayOfWeek, Team, ScheduleEntry, SessionType, BaseScheduleConfig, ValidationError, Callout, CalloutFormValues, AlliedHealthNeed, BulkOperationSummary, InsuranceQualification } from './types';
import { DAYS_OF_WEEK, PALETTE_ICON_SVG, TEAM_COLORS, ALL_THERAPIST_ROLES, ALL_SESSION_TYPES, TIME_SLOTS_H_MM, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END } from './constants';
import ClientForm from './components/ClientForm';
import TherapistForm from './components/TherapistForm';
import ScheduleView from './components/ScheduleView';
import LoadingSpinner from './components/LoadingSpinner';
import SettingsPanel from './components/SettingsPanel';
import AdminSettingsPanel from './components/AdminSettingsPanel';
import SessionModal from './components/SessionModal';
import BaseScheduleManager from './components/BaseScheduleManager';
import FilterControls from './components/FilterControls';
import { PlusIcon } from './components/icons/PlusIcon';
import { TrashIcon } from './components/icons/TrashIcon';
import { runCsoAlgorithm } from './services/csoService';
import { validateFullSchedule, timeToMinutes, minutesToTime, sessionsOverlap, isDateAffectedByCalloutRange } from './utils/validationService';
import { CalendarIcon } from './components/icons/CalendarIcon';
import { UserGroupIcon } from './components/icons/UserGroupIcon';
import { ClockIcon } from './components/icons/ClockIcon';
import { ClipboardDocumentListIcon } from './components/icons/ClipboardDocumentListIcon';
import { Cog8ToothIcon } from './components/icons/Cog8ToothIcon';
import { SparklesIcon } from './components/icons/SparklesIcon';
import ScheduleRatingPanel from './components/ScheduleRatingPanel';
import { useAuth } from './contexts/AuthContext';

import * as clientService from './services/clientService';
import * as therapistService from './services/therapistService';
import * as teamService from './services/teamService';
import * as settingsService from './services/settingsService';
import * as baseScheduleService from './services/baseScheduleService';
import * as calloutService from './services/calloutService';
import { dailyScheduleService } from './services/dailyScheduleService';
import { subscribeToSystemConfig } from './services/systemConfigService';
import { updateCachedConfig } from './constants';


interface LoadingState {
  active: boolean;
  message: string;
}

// Helper to generate unique IDs for schedule entries
const generateScheduleEntryId = () => `schedEntry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper functions moved to module scope (stateless)
const getFormattedDate = (date: Date | null): string => date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date';
const getInputFormattedDate = (date: Date | null): string => date ? `${new Date(date.getFullYear(), date.getMonth(), date.getDate()).getFullYear()}-${String(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getMonth() + 1).padStart(2, '0')}-${String(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getDate()).padStart(2, '0')}` : '';
const PaletteIconComponent = () => (<span dangerouslySetInnerHTML={{ __html: PALETTE_ICON_SVG }} />);
const ErrorDisplay: React.FC<{ errors: ValidationError[] | null, title?: string }> = ({ errors, title = "Error" }) => { if (!errors || errors.length === 0) return null; return ( <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md shadow" role="alert"> <p className="font-bold mb-2">{title}</p> <ul className="list-disc list-inside space-y-1 text-sm"> {errors.map((err, index) => ( <li key={index}><strong className="capitalize">{err.ruleId.replace(/_/g, ' ').toLowerCase()}:</strong> {err.message}</li> ))} </ul> </div> ); };
const formatCalloutDateDisplay = (startDateString: string, endDateString: string): string => { const s = new Date(startDateString + 'T00:00:00'), e = new Date(endDateString + 'T00:00:00'), o: Intl.DateTimeFormatOptions={weekday:'short',year:'numeric',month:'short',day:'numeric'}; return (startDateString === endDateString || !endDateString) ? s.toLocaleDateString('en-US',o) : `${s.toLocaleDateString('en-US',o)} to ${e.toLocaleDateString('en-US',o)}`; };


const App: React.FC = () => {
  const { canEdit, canViewAdmin, user } = useAuth();
  const [availableTeams, setAvailableTeams] = useState<Team[]>(teamService.getTeams());
  const [availableInsuranceQualifications, setAvailableInsuranceQualifications] = useState<InsuranceQualification[]>(settingsService.getInsuranceQualifications());
  const [clients, setClients] = useState<Client[]>(clientService.getClients());
  const [therapists, setTherapists] = useState<Therapist[]>(therapistService.getTherapists());
  const [baseSchedules, setBaseSchedules] = useState<BaseScheduleConfig[]>(baseScheduleService.getBaseSchedules());
  const [callouts, setCallouts] = useState<Callout[]>(calloutService.getCallouts());

  const [schedule, setSchedule] = useState<GeneratedSchedule>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>({ active: false, message: 'Processing...' });
  const [error, setError] = useState<ValidationError[] | null>(null);
  const [gaStatusMessage, setGaStatusMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'clients' | 'therapists' | 'schedule' | 'baseSchedules' | 'callouts' | 'settings' | 'adminSettings'>('clients');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<ScheduleEntry | null>(null);
  const [newSessionSlotDetails, setNewSessionSlotDetails] = useState<{ therapistId: string; therapistName: string; startTime: string; day: DayOfWeek } | null>(null);

  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedTherapistIds, setSelectedTherapistIds] = useState<string[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  const [bulkOperationSummary, setBulkOperationSummary] = useState<BulkOperationSummary | null>(null);

  const [isModified, setIsModified] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  const getCurrentDateString = () => new Date().toISOString().split('T')[0];

  const getAlliedHealthSessionsForDate = useCallback((date: Date, currentClients: Client[], currentTherapists: Therapist[], currentCallouts: Callout[]): ScheduleEntry[] => {
    const dayOfWeek = [DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY][date.getDay()];
    const sessions: ScheduleEntry[] = [];

    currentClients.forEach(client => {
      if (!client.alliedHealthNeeds) return;
      client.alliedHealthNeeds.forEach(need => {
        if (!need.specificDays.includes(dayOfWeek)) return;

        // Check if client is out during this specific need's time
        const isOutDuringNeed = currentCallouts.some(co =>
            co.entityType === 'client' &&
            co.entityId === client.id &&
            isDateAffectedByCalloutRange(date, co.startDate, co.endDate) &&
            sessionsOverlap(need.startTime, need.endTime, co.startTime, co.endTime)
        );
        if (isOutDuringNeed) return;

        const therapist = need.therapistId ? currentTherapists.find(t => t.id === need.therapistId) : null;

        sessions.push({
          id: `ah-stub-${client.id}-${need.sessionType}-${need.startTime}`,
          clientId: client.id,
          clientName: client.name,
          therapistId: therapist?.id || null,
          therapistName: therapist?.name || null,
          day: dayOfWeek,
          startTime: need.startTime,
          endTime: need.endTime,
          sessionType: need.sessionType
        });
      });
    });

    return sessions;
  }, []);

  const [calloutForm, setCalloutForm] = useState<CalloutFormValues>({
    entityType: 'client',
    entityId: '',
    startDate: selectedDate ? selectedDate.toISOString().split('T')[0] : getCurrentDateString(),
    endDate: selectedDate ? selectedDate.toISOString().split('T')[0] : getCurrentDateString(),
    startTime: '09:00',
    endTime: '17:00',
    reason: ''
  });

  useEffect(() => {
    const unsubClients = clientService.subscribeToClients(setClients);
    const unsubTherapists = therapistService.subscribeToTherapists(setTherapists);
    const unsubTeams = teamService.subscribeToTeams(setAvailableTeams);
    const unsubQualifications = settingsService.subscribeToInsuranceQualifications(setAvailableInsuranceQualifications);
    const unsubBaseSchedules = baseScheduleService.subscribeToBaseSchedules(setBaseSchedules);
    const unsubCallouts = calloutService.subscribeToCallouts(setCallouts);
    const unsubSystemConfig = subscribeToSystemConfig((newConfig) => {
      updateCachedConfig(newConfig);
    });
    return () => {
      unsubClients(); unsubTherapists(); unsubTeams(); unsubQualifications(); unsubBaseSchedules(); unsubCallouts(); unsubSystemConfig();
    };
  }, []);


  useEffect(() => {
    if (selectedDate) {
        const dateString = selectedDate.toISOString().split('T')[0];
        setCalloutForm(prev => ({...prev, startDate: dateString, endDate: dateString}));
    } else {
        const todayString = getCurrentDateString();
        setCalloutForm(prev => ({...prev, startDate: todayString, endDate: todayString}));
    }
  }, [selectedDate]);


  const handleAddClient = () => { setError(null); clientService.addClient({ name: 'New Client', teamId: '', insuranceRequirements: [], alliedHealthNeeds: [] }); };
  const handleUpdateClient = (updatedClient: Client) => clientService.updateClient(updatedClient);
  const handleRemoveClient = (clientId: string) => clientService.removeClient(clientId);
  const handleAddTherapist = () => { setError(null); therapistService.addTherapist({ name: 'New Therapist', role: 'BT', teamId: '', qualifications: [], canProvideAlliedHealth: [] }); };
  const handleUpdateTherapist = (updatedTherapist: Therapist) => therapistService.updateTherapist(updatedTherapist);
  const handleRemoveTherapist = (therapistId: string) => therapistService.removeTherapist(therapistId);
  const handleUpdateTeams = (updatedTeams: Team[]) => teamService.updateTeams(updatedTeams);
  const handleUpdateInsuranceQualifications = (updatedIQs: InsuranceQualification[]) => settingsService.updateInsuranceQualifications(updatedIQs);


  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = event.target.value;
    setError(null); setGaStatusMessage(null);
    if (dateString) {
      const [year, month, day] = dateString.split('-').map(Number);
      setSelectedDate(new Date(year, month - 1, day));
    } else {
      setSelectedDate(null);
    }
  };

  useEffect(() => {
    if (selectedDate) {
      const dateString = selectedDate.toISOString().split('T')[0];
      const selectedDayOfWeek = [DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY][selectedDate.getDay()];

      const loadInitialSchedule = async () => {
        try {
          const ds = await dailyScheduleService.getDailySchedule(dateString);
          if (ds) {
            setSchedule(prev => {
              const otherDays = prev.filter(e => e.day !== selectedDayOfWeek);
              return [...otherDays, ...ds.schedule_data];
            });
            setIsPublished(true);
            setIsModified(false);
          } else {
            setSchedule(prev => prev.filter(e => e.day !== selectedDayOfWeek));
            setIsPublished(false);
            setIsModified(false);
          }
        } catch (err) {
          console.error("Error loading initial schedule:", err);
          // Fallback to empty schedule for this day on error
          setSchedule(prev => prev.filter(e => e.day !== selectedDayOfWeek));
          setIsPublished(false);
          setIsModified(false);
        }
      };

      loadInitialSchedule();

      const unsubscribe = dailyScheduleService.subscribeToDailySchedule(dateString, (ds) => {
        if (ds && ds.schedule_date === dateString) {
          if (!canEdit) {
            setSchedule(prev => {
              const otherDays = (prev || []).filter(e => e.day !== selectedDayOfWeek);
              return [...otherDays, ...ds.schedule_data];
            });
            setIsPublished(true);
            setIsModified(false);
          }
        }
      });

      return () => unsubscribe();
    }
  }, [selectedDate, canEdit]);

  // Sync Allied Health sessions into the schedule if they are missing
  useEffect(() => {
    if (!selectedDate) return;
    const selectedDayOfWeek = [DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY][selectedDate.getDay()];
    const ahSessions = getAlliedHealthSessionsForDate(selectedDate, clients, therapists, callouts);

    setSchedule(prev => {
      if (!prev) return [];
      const otherDays = prev.filter(e => e.day !== selectedDayOfWeek);
      const currentDay = prev.filter(e => e.day === selectedDayOfWeek);

      const newDay = [...currentDay];
      let changedLocally = false;

      ahSessions.forEach(ah => {
        const exists = newDay.some(e =>
          e.clientId === ah.clientId &&
          e.sessionType === ah.sessionType &&
          e.startTime === ah.startTime
        );
        if (!exists) {
          newDay.push(ah);
          changedLocally = true;
        }
      });

      // Also remove AH sessions that are no longer in profile
      const finalDay = newDay.filter(e => {
        if (!e.sessionType.startsWith('AlliedHealth_')) return true;
        const stillValid = ahSessions.some(ah =>
          e.clientId === ah.clientId &&
          e.sessionType === ah.sessionType &&
          e.startTime === ah.startTime &&
          e.endTime === ah.endTime
        );
        if (!stillValid) {
          changedLocally = true;
          return false;
        }
        return true;
      });

      if (!changedLocally) return prev;

      // Use setTimeout to avoid setting state during render
      if (canEdit) {
        setTimeout(() => setIsModified(true), 0);
      }
      return [...otherDays, ...finalDay];
    });
  }, [selectedDate, clients, therapists, callouts, getAlliedHealthSessionsForDate, canEdit]);

  const handlePublishSchedule = async () => {
    if (!selectedDate || !schedule || !user) return;
    const dateString = selectedDate.toISOString().split('T')[0];
    const dayOfWeek = [DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY][selectedDate.getDay()];

    // Only save entries for the selected day
    const dayEntries = schedule.filter(e => e.day === dayOfWeek);

    setLoadingState({ active: true, message: 'Publishing Schedule...' });
    const result = await dailyScheduleService.saveDailySchedule(dateString, dayOfWeek, dayEntries, user.email, error || []);
    setLoadingState({ active: false, message: '' });

    if (result.success) {
      setIsPublished(true);
      setIsModified(false);
      alert('Schedule published successfully!');
    } else {
      alert('Failed to publish schedule: ' + result.error);
    }
  };

  const handleMoveScheduleEntry = useCallback((
    draggedEntryId: string, newTherapistId: string, newStartTime: string
  ) => {
    setError(null);
    setGaStatusMessage(null);

    // FIX: Using schedule state directly instead of prevSchedule to avoid side-effects in setter
    if (!schedule || !selectedDate) return;

    const originalDraggedEntry = schedule.find(entry => entry.id === draggedEntryId);
    if (!originalDraggedEntry) return; 

    const newTherapist = therapists.find(t => t.id === newTherapistId);
    if (!newTherapist) return; 

    const durationMinutes = timeToMinutes(originalDraggedEntry.endTime) - timeToMinutes(originalDraggedEntry.startTime);
    const newEndTime = minutesToTime(timeToMinutes(newStartTime) + durationMinutes);
    
    const proposedNewEntry: ScheduleEntry = {
      ...originalDraggedEntry,
      therapistId: newTherapistId,
      therapistName: newTherapist.name,
      startTime: newStartTime,
      endTime: newEndTime,
    };

    const scheduleWithoutOriginal = schedule.filter(entry => entry.id !== draggedEntryId);
    const newUpdatedSchedule = [...scheduleWithoutOriginal, proposedNewEntry];

    setSchedule(newUpdatedSchedule);
    setIsModified(true);

    const validationErrors = validateFullSchedule(newUpdatedSchedule, clients, therapists, availableInsuranceQualifications, selectedDate, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, callouts);
    if (validationErrors.length > 0) {
      setError(validationErrors);
    } else {
      setError(null);
    }
  }, [clients, therapists, selectedDate, callouts, schedule]);

  const handleOpenEditSessionModal = (entry: ScheduleEntry) => { setError(null); setGaStatusMessage(null); setSessionToEdit(entry); setNewSessionSlotDetails(null); setIsSessionModalOpen(true); };
  
  const handleOpenAddSessionModal = (therapistId: string, therapistName: string, startTime: string, day: DayOfWeek) => {
    setError(null); 
    setGaStatusMessage(null); 
    setNewSessionSlotDetails({ therapistId, therapistName, startTime, day }); 
    setSessionToEdit(null); 
    setIsSessionModalOpen(true); 
  };
  const handleCloseSessionModal = () => { setIsSessionModalOpen(false); setSessionToEdit(null); setNewSessionSlotDetails(null); };

  const handleSaveSession = (entryToSave: ScheduleEntry) => {
    setGaStatusMessage(null);
    setError(null);

    // FIX: Calculate new schedule first, then update state
    const baseSchedule = schedule ? [...schedule] : [];
    let newUpdatedSchedule;

    // Ensure entryToSave has an ID
    const finalEntryToSave = { ...entryToSave, id: entryToSave.id || generateScheduleEntryId() };

    if (sessionToEdit) { // Editing existing session
        newUpdatedSchedule = baseSchedule.map(e => e.id === sessionToEdit.id ? finalEntryToSave : e);
    } else { // Adding new session
        newUpdatedSchedule = [...baseSchedule, finalEntryToSave];
    }

    setSchedule(newUpdatedSchedule);
    setIsModified(true);

    if (selectedDate) {
        const validationErrors = validateFullSchedule(newUpdatedSchedule, clients, therapists, availableInsuranceQualifications, selectedDate, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, callouts);
        if (validationErrors.length > 0) {
            setError(validationErrors);
        } else {
            setError(null);
        }
    } else {
        setError([{ruleId: "MISSING_DATE_FOR_VALIDATION", message: "Cannot validate schedule as no date is selected."}]);
    }
    
    handleCloseSessionModal();
  };

  const handleDeleteSession = (sessionToDelete: ScheduleEntry) => {
    setGaStatusMessage(null);
    setError(null);
    
    if (!schedule) return;

    // FIX: Calculate new schedule first
    const newUpdatedSchedule = schedule.filter(entry => entry.id !== sessionToDelete.id);
    
    // FIX: Update state
    setSchedule(newUpdatedSchedule);
    setIsModified(true);

    // FIX: Validate independently
    if (selectedDate) {
      const validationErrors = validateFullSchedule(newUpdatedSchedule, clients, therapists, availableInsuranceQualifications, selectedDate, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, callouts);
      if (validationErrors.length > 0) {
          setError(validationErrors);
      } else {
          setError(null);
      }
    } else {
        setError([{ruleId: "MISSING_DATE_FOR_VALIDATION", message: "Cannot validate schedule as no date is selected."}]);
    }
    
    handleCloseSessionModal();
  };

  const handleAddBaseScheduleConfig = () => { setError(null); baseScheduleService.updateBaseSchedules([...baseScheduleService.getBaseSchedules(), { id: `bs-${Date.now()}`, name: 'New Base Schedule', appliesToDays: [], schedule: null }]); };
  const handleUpdateBaseScheduleConfigName = (id: string, newName: string) => { baseScheduleService.updateBaseSchedules(baseScheduleService.getBaseSchedules().map(bs => bs.id === id ? { ...bs, name: newName } : bs)); };
  const handleUpdateBaseScheduleConfigDays = (id: string, newDays: DayOfWeek[]) => { baseScheduleService.updateBaseSchedules(baseScheduleService.getBaseSchedules().map(bs => bs.id === id ? { ...bs, appliesToDays: newDays } : bs)); };
  const handleDeleteBaseScheduleConfig = (id: string) => { baseScheduleService.updateBaseSchedules(baseScheduleService.getBaseSchedules().filter(bs => bs.id !== id)); };

  const handleSetCurrentGeneratedScheduleAsBase = (baseScheduleId: string) => {
    setError(null); setGaStatusMessage(null);
    if (schedule && selectedDate) {
      // Ensure all schedule entries have IDs before saving to base
      const scheduleWithIds = schedule.map(entry => ({...entry, id: entry.id || generateScheduleEntryId() }));
      const updatedConfigs = baseScheduleService.getBaseSchedules().map(bs => bs.id === baseScheduleId ? { ...bs, schedule: [...scheduleWithIds] } : bs);
      baseScheduleService.updateBaseSchedules(updatedConfigs);
      alert('Current generated schedule has been set as the base schedule.');
    } else { alert('No schedule currently generated or date not selected to set as base.'); }
  };

  const handleViewBaseSchedule = (baseScheduleId: string) => {
    setError(null); setGaStatusMessage(null);
    const baseConfig = baseScheduleService.getBaseSchedules().find(bs => bs.id === baseScheduleId);
    if (baseConfig && baseConfig.schedule) {
      // Ensure all schedule entries from base have IDs when loading
      const scheduleWithIds = baseConfig.schedule.map(entry => ({...entry, id: entry.id || generateScheduleEntryId() }));
      setSchedule([...scheduleWithIds]);
      const today = new Date();
      let newSelectedDate = null;
      for (let i = 0; i < 7; i++) {
          const tempDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
          const dayOfWeekName = [DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY][tempDate.getDay()];
          if (baseConfig.appliesToDays.includes(dayOfWeekName)) { newSelectedDate = tempDate; break; }
      }
      setSelectedDate(newSelectedDate || today);

      if (newSelectedDate) {
          const validationErrors = validateFullSchedule(scheduleWithIds, clients, therapists, availableInsuranceQualifications, newSelectedDate, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END, callouts);
          if (validationErrors.length > 0) {
              setError(validationErrors);
          } else {
              setError(null);
          }
      }
      setActiveTab('schedule');
    } else { alert('This base schedule has no schedule data set.'); }
  };

  const handleCalloutFormChange = (field: keyof CalloutFormValues, value: string) => {
    setCalloutForm(prev => {
        const newState = { ...prev, [field]: value };
        if (field === 'entityType') {
            newState.entityId = '';
        }
        return newState;
    });
  };

  const handleAddCallout = (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    let { entityType, entityId, startDate, endDate, startTime, endTime, reason } = calloutForm;
    if (!entityId || !startDate || !startTime || !endTime) { setError([{ruleId: "MISSING_CALLOUT_FIELDS", message: "Please fill in Entity, Start Date, Start Time, and End Time for the callout."}]); return; }
    if (!endDate || new Date(endDate) < new Date(startDate)) endDate = startDate;
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) { setError([{ruleId: "INVALID_CALLOUT_TIME_ORDER", message: "Callout end time must be after start time."}]); return; }

    const sourceList = entityType === 'client' ? clients : therapists;
    const entityName = sourceList.find(item => item.id === entityId)?.name;

    if (!entityName) { setError([{ruleId: "CALLOUT_ENTITY_NOT_FOUND", message: `Selected ${entityType} not found for callout.`}]); return; }

    calloutService.addCalloutEntry({ entityType, entityId, entityName, startDate, endDate, startTime, endTime, reason });
    setCalloutForm(prev => ({ ...prev, entityId: '', startTime: '09:00', endTime: '17:00', reason: '' }));
  };
  const handleRemoveCallout = (calloutId: string) => calloutService.removeCalloutEntry(calloutId);

  const handleGenerateSchedule = useCallback(async () => {
    if (!selectedDate) { setError([{ ruleId: "MISSING_DATE", message: "Please select a date." }]); return; }
    if (clients.length === 0 || therapists.length === 0) { setError([{ ruleId: "MISSING_DATA", message: "Add clients and therapists." }]); return; }

    setLoadingState({ active: true, message: 'Optimizing Schedule...' });
    setError(null); setGaStatusMessage(null);

    try {
      // Use CSO Algorithm from service. Pass existing schedule to respect weekly hour limits.
      const result = await runCsoAlgorithm(clients, therapists, availableInsuranceQualifications, selectedDate, callouts, schedule || []);

      const newDayEntries = result.schedule ? result.schedule.map(entry => ({...entry, id: entry.id || generateScheduleEntryId() })) : [];
      const scheduledDayOfWeek = [DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY][selectedDate.getDay()];

      // Merge with other days
      const otherDayEntries = (schedule || []).filter(e => e.day !== scheduledDayOfWeek);
      const combinedSchedule = [...otherDayEntries, ...newDayEntries];
      
      setSchedule(combinedSchedule);
      setIsModified(true);
      
      if (result.finalValidationErrors.length > 0) {
         setError(result.finalValidationErrors);
      } else {
         setError(null);
      }
      setGaStatusMessage(result.statusMessage);
      setActiveTab('schedule');

    } catch (e: any) {
      console.error("Error in CSO schedule generation:", e);
      setError([{ ruleId: "CSO_GENERATION_ERROR", message: e.message || "An unexpected error occurred during schedule optimization." }]);
      setSchedule([]);
      setGaStatusMessage(`Error: ${e.message || "Unknown error."}`);
    } finally {
      setLoadingState({ active: false, message: 'Processing...' });
    }
  }, [clients, therapists, selectedDate, callouts]);

  const handleOptimizeCurrentScheduleWithGA = useCallback(async () => {
    if (!selectedDate || !schedule || schedule.length === 0) return;
    
    setLoadingState({ active: true, message: 'Evolving Current Day...' });
    setError(null);
    
    try {
       // Pass current schedule to seed the population
       const result = await runCsoAlgorithm(clients, therapists, availableInsuranceQualifications, selectedDate, callouts, schedule);
       
       const newDayEntries = result.schedule ? result.schedule.map(entry => ({...entry, id: entry.id || generateScheduleEntryId() })) : [];
       const scheduledDayOfWeek = [DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY][selectedDate.getDay()];

       const otherDayEntries = schedule.filter(e => e.day !== scheduledDayOfWeek);
       const combinedSchedule = [...otherDayEntries, ...newDayEntries];

       setSchedule(combinedSchedule);
       setIsModified(true);
       
       if (result.finalValidationErrors.length > 0) {
          setError(result.finalValidationErrors);
       } else {
          setError(null);
       }
       setGaStatusMessage(result.statusMessage);
    } catch (e: any) {
        console.error("Error optimizing schedule:", e);
        setGaStatusMessage("Error optimizing schedule.");
    } finally {
        setLoadingState({ active: false, message: 'Processing...' });
    }
  }, [clients, therapists, selectedDate, callouts, schedule]);


  const handleTeamFilterChange = (ids: string[]) => setSelectedTeamIds(ids);
  const handleTherapistFilterChange = (ids: string[]) => setSelectedTherapistIds(ids);
  const handleClientFilterChange = (ids: string[]) => setSelectedClientIds(ids);
  const handleClearFilters = () => { setSelectedTeamIds([]); setSelectedTherapistIds([]); setSelectedClientIds([]); };

  const displayedTherapists = useMemo(() => {
    let result = [...therapists];
    if (selectedTeamIds.length > 0) {
        result = result.filter(t => t.teamId && selectedTeamIds.includes(t.teamId));
    }
    if (selectedTherapistIds.length > 0) {
        result = result.filter(t => selectedTherapistIds.includes(t.id));
    }
    return result.sort((a,b) => a.name.localeCompare(b.name));
  }, [therapists, selectedTeamIds, selectedTherapistIds]);

  const displayedSchedule = useMemo(() => {
    if (!schedule) return null;

    const visibleTherapistIds = new Set(displayedTherapists.map(t => t.id));

    let filteredEntries = schedule.filter(entry => {
        if (!visibleTherapistIds.has(entry.therapistId)) {
            return false;
        }
        if (selectedClientIds.length > 0) {
            if (entry.clientId === null) return true;
            return selectedClientIds.includes(entry.clientId);
        }
        return true; 
    });

    return filteredEntries;
  }, [schedule, selectedClientIds, displayedTherapists]);


  const handleBulkUpdateClients = async (file: File, action: 'ADD_UPDATE' | 'REMOVE'): Promise<BulkOperationSummary> => {
    setLoadingState({active: true, message: "Processing client CSV..."}); setBulkOperationSummary(null); setError(null);
    let summary: BulkOperationSummary = { processedRows: 0, addedCount: 0, updatedCount: 0, removedCount: 0, errorCount: 0, errors: [], newlyAddedSettings: { insuranceRequirements: [] }};
    try {
        const text = await file.text();
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        if (rows.length <= 1) throw new Error("CSV file is empty or has only a header row.");
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        summary.processedRows = rows.length - 1;
        const clientsToProcess: Partial<Client>[] = [];
        const clientNamesToRemove: string[] = [];
        const newInsuranceRequirementsFound = new Set<string>();
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i].split(',');
            const rowData: Record<string, string> = headers.reduce((obj, header, index) => { obj[header] = values[index]?.trim() || ''; return obj; }, {} as Record<string, string>);
            if (!rowData.action || (rowData.action.toUpperCase() !== 'ADD_UPDATE' && rowData.action.toUpperCase() !== 'REMOVE')) { summary.errors.push({ rowNumber: i + 1, message: "Missing or invalid ACTION column.", rowData: rows[i] }); summary.errorCount++; continue; }
            if (!rowData.name) { summary.errors.push({ rowNumber: i + 1, message: "Missing 'name' column.", rowData: rows[i] }); summary.errorCount++; continue; }
            if (rowData.action.toUpperCase() === 'ADD_UPDATE' && action === 'ADD_UPDATE') {
                const clientTeam = availableTeams.find(t => t.name.toLowerCase() === rowData.teamname?.toLowerCase());
                let insuranceReqs: string[] | undefined = rowData.insurancerequirements !== undefined ? (rowData.insurancerequirements ? rowData.insurancerequirements.split(';').map(s => s.trim()).filter(s => s) : []) : undefined;
                if(insuranceReqs) insuranceReqs.forEach(req => newInsuranceRequirementsFound.add(req));
                let ahNeeds: AlliedHealthNeed[] | undefined = rowData.alliedhealthneeds !== undefined ? (rowData.alliedhealthneeds ? rowData.alliedhealthneeds.split(';').map(needStr => {
                    const [type, start, end, daysStr, therapistName] = needStr.split(':').map(s => s.trim());
                    if ((type === 'OT' || type === 'SLP') && start && end && daysStr) {
                        const specificDays = daysStr.split(',').map(d => {
                            const trimmed = d.trim();
                            // Map short names to full enum names if necessary
                            if (trimmed.toLowerCase().startsWith('mon')) return DayOfWeek.MONDAY;
                            if (trimmed.toLowerCase().startsWith('tue')) return DayOfWeek.TUESDAY;
                            if (trimmed.toLowerCase().startsWith('wed')) return DayOfWeek.WEDNESDAY;
                            if (trimmed.toLowerCase().startsWith('thu')) return DayOfWeek.THURSDAY;
                            if (trimmed.toLowerCase().startsWith('fri')) return DayOfWeek.FRIDAY;
                            return trimmed as DayOfWeek;
                        });
                        const therapist = therapistName ? therapists.find(t => t.name.toLowerCase() === therapistName.toLowerCase()) : undefined;
                        return {
                            sessionType: `AlliedHealth_${type}` as any,
                            startTime: start,
                            endTime: end,
                            specificDays,
                            therapistId: therapist?.id
                        } as AlliedHealthNeed;
                    }
                    return null;
                }).filter(n => n) as AlliedHealthNeed[] : []) : undefined;
                const partialClient: Partial<Client> = { name: rowData.name };
                if (clientTeam !== undefined || rowData.teamname !== undefined) partialClient.teamId = clientTeam?.id;
                if (insuranceReqs !== undefined) partialClient.insuranceRequirements = insuranceReqs;
                if (ahNeeds !== undefined) partialClient.alliedHealthNeeds = ahNeeds;
                clientsToProcess.push(partialClient);
            } else if (rowData.action.toUpperCase() === 'REMOVE' && action === 'REMOVE') clientNamesToRemove.push(rowData.name);
        }
        if (action === 'ADD_UPDATE' && clientsToProcess.length > 0) { const result = await clientService.addOrUpdateBulkClients(clientsToProcess); summary.addedCount = result.addedCount; summary.updatedCount = result.updatedCount; }
        else if (action === 'REMOVE' && clientNamesToRemove.length > 0) { const result = await clientService.removeClientsByNames(clientNamesToRemove); summary.removedCount = result.removedCount; }
        const currentIQs = settingsService.getInsuranceQualifications();
        const currentIQNames = currentIQs.map(q => q.id);
        const newIQNames = Array.from(newInsuranceRequirementsFound).filter(name => !currentIQNames.includes(name));
        if (newIQNames.length > 0) {
            const allIQs = [...currentIQs, ...newIQNames.map(name => ({ id: name }))];
            settingsService.updateInsuranceQualifications(allIQs);
            summary.newlyAddedSettings!.insuranceRequirements = newIQNames;
        }
    } catch (e: any) { summary.errors.push({ rowNumber: 0, message: `File processing error: ${e.message}` }); summary.errorCount++; }
    finally { setLoadingState({active:false, message:''}); setBulkOperationSummary(summary); }
    return summary;
  };

  const handleBulkUpdateTherapists = async (file: File, action: 'ADD_UPDATE' | 'REMOVE'): Promise<BulkOperationSummary> => {
    setLoadingState({active: true, message: "Processing therapist CSV..."}); setBulkOperationSummary(null); setError(null);
    let summary: BulkOperationSummary = { processedRows: 0, addedCount: 0, updatedCount: 0, removedCount: 0, errorCount: 0, errors: [], newlyAddedSettings: { qualifications: [] } };
    try {
        const text = await file.text();
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        if (rows.length <= 1) throw new Error("CSV file is empty or has only a header row.");
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        summary.processedRows = rows.length - 1;
        const therapistsToProcess: Partial<Therapist>[] = [];
        const therapistNamesToRemove: string[] = [];
        const newQualificationsFound = new Set<string>();
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i].split(',');
            const rowData: Record<string, string> = headers.reduce((obj, header, index) => { obj[header] = values[index]?.trim() || ''; return obj; }, {} as Record<string, string>);
            if (!rowData.action || (rowData.action.toUpperCase() !== 'ADD_UPDATE' && rowData.action.toUpperCase() !== 'REMOVE')) { summary.errors.push({ rowNumber: i + 1, message: "Missing or invalid ACTION column.", rowData: rows[i] }); summary.errorCount++; continue; }
            if (!rowData.name) { summary.errors.push({ rowNumber: i + 1, message: "Missing 'name' column.", rowData: rows[i] }); summary.errorCount++; continue; }
            if (rowData.action.toUpperCase() === 'ADD_UPDATE' && action === 'ADD_UPDATE') {
                const therapistTeam = availableTeams.find(t => t.name.toLowerCase() === rowData.teamname?.toLowerCase());
                let qualifications: string[] | undefined = rowData.qualifications !== undefined ? (rowData.qualifications ? rowData.qualifications.split(';').map(s => s.trim()).filter(s => s) : []) : undefined;
                if(qualifications) qualifications.forEach(q => newQualificationsFound.add(q));
                let canProvideAH: AlliedHealthNeed['type'][] | undefined = rowData.canprovidealliedhealth !== undefined ? (rowData.canprovidealliedhealth ? rowData.canprovidealliedhealth.split(';').map(s => s.trim().toUpperCase() as AlliedHealthNeed['type']).filter(s => s === 'OT' || s === 'SLP') : []) : undefined;
                const partialTherapist: Partial<Therapist> = { name: rowData.name };
                if (rowData.role) partialTherapist.role = rowData.role as TherapistRole;
                if (therapistTeam !== undefined || rowData.teamname !== undefined) partialTherapist.teamId = therapistTeam?.id;
                if (qualifications !== undefined) partialTherapist.qualifications = qualifications;
                if (canProvideAH !== undefined) partialTherapist.canProvideAlliedHealth = canProvideAH;
                therapistsToProcess.push(partialTherapist);
            } else if (rowData.action.toUpperCase() === 'REMOVE' && action === 'REMOVE') therapistNamesToRemove.push(rowData.name);
        }
        if (action === 'ADD_UPDATE' && therapistsToProcess.length > 0) { const result = await therapistService.addOrUpdateBulkTherapists(therapistsToProcess); summary.addedCount = result.addedCount; summary.updatedCount = result.updatedCount; }
        else if (action === 'REMOVE' && therapistNamesToRemove.length > 0) { const result = await therapistService.removeTherapistsByNames(therapistNamesToRemove); summary.removedCount = result.removedCount; }
        const currentIQs = settingsService.getInsuranceQualifications();
        const currentIQNames = currentIQs.map(q => q.id);
        const newIQNames = Array.from(newQualificationsFound).filter(name => !currentIQNames.includes(name));
        if (newIQNames.length > 0) {
            const allCombinedQuals = [...currentIQs, ...newIQNames.map(name => ({ id: name }))];
            settingsService.updateInsuranceQualifications(allCombinedQuals);
            summary.newlyAddedSettings!.qualifications = newIQNames;
        }
    } catch (e: any) { summary.errors.push({ rowNumber: 0, message: `File processing error: ${e.message}` }); summary.errorCount++; }
    finally { setLoadingState({active:false, message:''}); setBulkOperationSummary(summary); }
    return summary;
  };

  const TabButton: React.FC<{tabName: typeof activeTab, label: string, icon: React.ReactNode}> = ({tabName, label, icon}) => (
    <button
      onClick={() => { setError(null); setBulkOperationSummary(null); setGaStatusMessage(null); setActiveTab(tabName);}}
      className={`flex items-center space-x-2 px-4 py-2 font-medium rounded-full transition-all duration-200 whitespace-nowrap text-sm ${
        activeTab === tabName
          ? 'bg-slate-100 text-slate-900 shadow-sm'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden text-xs">{label.split(' ')[0]}</span>
    </button>
  );
  
  // Defined inside component to access clients and therapists state
  const getCurrentCalloutEntityList = useCallback(() => {
    if (calloutForm.entityType === 'client') {
        return clients.map(c => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name));
    } else { // 'therapist'
        return therapists.map(t => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [calloutForm.entityType, clients, therapists]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row justify-between lg:items-center space-y-4 lg:space-y-0">
          <div className="flex items-center space-x-2">
            <div className="bg-slate-900 p-2 rounded-lg">
               <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-serif text-slate-900 tracking-tight">Fiddler Scheduler</h1>
          </div>

          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3">
             <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-full border border-slate-200">
                <label htmlFor="scheduleDate" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Schedule for:</label>
                <input type="date" id="scheduleDate" value={getInputFormattedDate(selectedDate)} onChange={handleDateChange} className="bg-transparent text-slate-900 font-medium focus:outline-none text-sm cursor-pointer"/>
            </div>
            {canEdit && (
              <>
                <button
                  onClick={handleGenerateSchedule}
                  disabled={loadingState.active || clients.length === 0 || therapists.length === 0 || !selectedDate}
                  className="bg-brand-blue hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-full shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-2 text-sm"
                  aria-live="polite"
                  title={!selectedDate ? "Please select a date first" : (clients.length === 0 || therapists.length === 0 ? "Add clients and therapists first" : `Generate schedule using CSO`)}
                >
                  {loadingState.active && loadingState.message.toLowerCase().includes("optimizing") ? <LoadingSpinner size="sm" /> : <SparklesIcon className="w-4 h-4" />}
                  <span>{loadingState.active && loadingState.message.toLowerCase().includes("optimizing") ? loadingState.message : `Generate Schedule`}</span>
                </button>
                <button
                  onClick={handleOptimizeCurrentScheduleWithGA}
                  disabled={loadingState.active || !schedule || !selectedDate || clients.length === 0 || therapists.length === 0}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-full shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-2 text-sm"
                  aria-live="polite"
                  title={!schedule || !selectedDate ? "Load or generate a schedule first" : (clients.length === 0 || therapists.length === 0 ? "Client/Therapist data missing" : "Optimize current schedule with CSO Algorithm")}
                >
                  {loadingState.active && loadingState.message.toLowerCase().includes("evolving") ? <LoadingSpinner size="sm" /> : <SparklesIcon className="w-4 h-4" />}
                  <span>{loadingState.active && loadingState.message.toLowerCase().includes("evolving") ? loadingState.message : "Evolve Current"}</span>
                </button>
                {isModified && (
                  <button
                    onClick={handlePublishSchedule}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-6 rounded-full shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-2 text-sm animate-pulse"
                    title="Publish these changes to the database so others can see them"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Publish Changes</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 flex-grow max-w-7xl">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 mb-8 overflow-hidden">
          <div className="flex items-center space-x-1 p-2 bg-slate-50/50 border-b border-slate-100 overflow-x-auto">
            <TabButton tabName="clients" label="Clients" icon={<UserGroupIcon className="w-4 h-4" />} />
            <TabButton tabName="therapists" label="Staff" icon={<UserGroupIcon className="w-4 h-4" />} />
            <TabButton tabName="schedule" label="View Schedule" icon={<ClockIcon className="w-4 h-4" />} />
            <TabButton tabName="baseSchedules" label="Base Schedules" icon={<ClipboardDocumentListIcon className="w-4 h-4" />} />
            <TabButton tabName="callouts" label="Callouts" icon={<ClipboardDocumentListIcon className="w-4 h-4" />} />
            <TabButton tabName="settings" label="Settings" icon={<PaletteIconComponent />} />
            {canViewAdmin && <TabButton tabName="adminSettings" label="Admin" icon={<Cog8ToothIcon className="w-4 h-4" />} />}
          </div>
          <div className="p-4 sm:p-6 md:p-8">
            {activeTab !== 'schedule' && activeTab !== 'adminSettings' && !isSessionModalOpen && <ErrorDisplay errors={error} title="Configuration Alert" />}
            {activeTab === 'schedule' && !isSessionModalOpen && <ErrorDisplay errors={error} title="Schedule Validation Info" />}
            {activeTab === 'schedule' && gaStatusMessage && <p className={`text-sm p-3 rounded-md my-4 ${error && error.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{gaStatusMessage}</p>}
            {activeTab === 'adminSettings' && bulkOperationSummary && bulkOperationSummary.errorCount > 0 && <ErrorDisplay errors={bulkOperationSummary.errors.map(e => ({ruleId: `ROW_${e.rowNumber}`, message: `${e.message} ${e.rowData ? `(Data: ${e.rowData.substring(0,100)}...)` : ''}`}))} title="Bulk Operation Issues"/>}

            {activeTab === 'clients' && (
              <div>
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl sm:text-3xl font-serif text-slate-900 tracking-tight">Manage Clients</h2>
                  {canEdit && (
                    <button onClick={handleAddClient} className="bg-brand-blue hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-full shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-2 text-sm">
                      <PlusIcon className="w-4 h-4" />
                      <span>Add Client</span>
                    </button>
                  )}
                </div>
                <div className="space-y-8">
                  {clients.map(client => (<ClientForm key={client.id} client={client} therapists={therapists} availableTeams={availableTeams} availableInsuranceQualifications={availableInsuranceQualifications} onUpdate={handleUpdateClient} onRemove={handleRemoveClient} />))}
                  {clients.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                      <p className="text-slate-400">No clients added yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'therapists' && (
              <div>
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl sm:text-3xl font-serif text-slate-900 tracking-tight">Manage Staff</h2>
                  {canEdit && (
                    <button onClick={handleAddTherapist} className="bg-brand-blue hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-full shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-2 text-sm">
                      <PlusIcon className="w-4 h-4" />
                      <span>Add Staff Member</span>
                    </button>
                  )}
                </div>
                <div className="space-y-8">
                  {therapists.map(therapist => (<TherapistForm key={therapist.id} therapist={therapist} availableTeams={availableTeams} availableInsuranceQualifications={availableInsuranceQualifications} onUpdate={handleUpdateTherapist} onRemove={handleRemoveTherapist} />))}
                  {therapists.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                      <p className="text-slate-400">No staff members added yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'schedule' && (
              <div className="flex flex-col">
                <h2 className="text-2xl sm:text-3xl font-serif text-slate-900 tracking-tight mb-6">Schedule {selectedDate && <span className="text-slate-500 font-sans text-lg block sm:inline sm:ml-2">for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>}</h2>
                <FilterControls allTeams={availableTeams} allTherapists={therapists} allClients={clients} selectedTeamIds={selectedTeamIds} selectedTherapistIds={selectedTherapistIds} selectedClientIds={selectedClientIds} onTeamFilterChange={handleTeamFilterChange} onTherapistFilterChange={handleTherapistFilterChange} onClientFilterChange={handleClientFilterChange} onClearFilters={handleClearFilters} />
                {loadingState.active && <div className="flex flex-col justify-center items-center py-20 bg-white rounded-3xl border border-slate-100 mb-8"><LoadingSpinner /><span className="mt-4 text-slate-500 font-medium">{loadingState.message}</span></div>}
                {!loadingState.active && displayedSchedule && displayedTherapists && <ScheduleView schedule={displayedSchedule} therapists={displayedTherapists} clients={clients} availableTeams={availableTeams} scheduledFullDate={selectedDate} canEdit={canEdit} onMoveScheduleEntry={handleMoveScheduleEntry} onOpenEditSessionModal={handleOpenEditSessionModal} onOpenAddSessionModal={handleOpenAddSessionModal} />}
                {!loadingState.active && displayedSchedule && displayedSchedule.length === 0 && (!error || error.length === 0 || (error && !error.some(e => e.message.toLowerCase().includes("generated schedule is invalid")))) && <div className="text-center py-20 bg-white rounded-3xl border border-slate-100"><p className="text-slate-400">No schedule entries match current filters.</p></div>}
                {!loadingState.active && !displayedSchedule && !error && (
                  <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
                    <p className="text-slate-400 font-medium">
                      {canEdit
                        ? 'Select a date and click "Generate Schedule" to begin.'
                        : 'No schedule has been published for this date yet.'}
                    </p>
                  </div>
                )}
                {!loadingState.active && canEdit && schedule && schedule.length > 0 && <ScheduleRatingPanel schedule={schedule} validationErrors={error || []} teamId={availableTeams.length > 0 ? availableTeams[0].id : undefined} />}
              </div>
            )}
            {activeTab === 'settings' && (
              <div>
                <h2 className="text-2xl sm:text-3xl font-serif text-slate-900 tracking-tight mb-8">System Settings</h2>
                <SettingsPanel availableTeams={availableTeams} availableInsuranceQualifications={availableInsuranceQualifications} onUpdateTeams={handleUpdateTeams} onUpdateInsuranceQualifications={handleUpdateInsuranceQualifications}/>
              </div>
            )}
            {activeTab === 'baseSchedules' && (
              <div>
                <h2 className="text-2xl sm:text-3xl font-serif text-slate-900 tracking-tight mb-8">Base Schedules</h2>
                <BaseScheduleManager baseSchedules={baseSchedules} onAddConfig={handleAddBaseScheduleConfig} onUpdateConfigName={handleUpdateBaseScheduleConfigName} onUpdateConfigDays={handleUpdateBaseScheduleConfigDays} onDeleteConfig={handleDeleteBaseScheduleConfig} onSetAsBase={handleSetCurrentGeneratedScheduleAsBase} onViewBase={handleViewBaseSchedule} currentGeneratedScheduleIsSet={schedule !== null && schedule.length > 0}/>
              </div>
            )}
            {activeTab === 'adminSettings' && (
              <div>
                <h2 className="text-2xl sm:text-3xl font-serif text-slate-900 tracking-tight mb-8">Administrative Tools</h2>
                <AdminSettingsPanel availableTeams={availableTeams} onBulkUpdateClients={handleBulkUpdateClients} onBulkUpdateTherapists={handleBulkUpdateTherapists} onUpdateInsuranceQualifications={handleUpdateInsuranceQualifications}/>
              </div>
            )}
            {activeTab === 'callouts' && (
              <div>
                <h2 className="text-2xl sm:text-3xl font-serif text-slate-900 tracking-tight mb-8">Manage Unavailability</h2>
                <form onSubmit={handleAddCallout} className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 mb-12 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="calloutEntityType" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Entity Type</label>
                      <select id="calloutEntityType" value={calloutForm.entityType} onChange={(e) => handleCalloutFormChange('entityType', e.target.value)} className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 focus:ring-2 focus:ring-brand-blue/20 outline-none">
                        <option value="client">Client</option>
                        <option value="therapist">Staff</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="calloutEntityId" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Select {calloutForm.entityType === 'client' ? 'Client' : 'Staff Member'}</label>
                      <select key={calloutForm.entityType} id="calloutEntityId" value={calloutForm.entityId} onChange={(e) => handleCalloutFormChange('entityId', e.target.value)} required className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 focus:ring-2 focus:ring-brand-blue/20 outline-none">
                        <option value="">-- Select --</option>
                        {getCurrentCalloutEntityList().map(entity => (<option key={entity.id} value={entity.id}>{entity.name}</option>))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="calloutStartDate" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Start Date</label>
                      <input type="date" id="calloutStartDate" value={calloutForm.startDate} onChange={(e) => handleCalloutFormChange('startDate', e.target.value)} required className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 focus:ring-2 focus:ring-brand-blue/20 outline-none"/>
                    </div>
                    <div>
                      <label htmlFor="calloutEndDate" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">End Date (Optional)</label>
                      <input type="date" id="calloutEndDate" value={calloutForm.endDate || ''} onChange={(e) => handleCalloutFormChange('endDate', e.target.value)} className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 focus:ring-2 focus:ring-brand-blue/20 outline-none"/>
                      <p className="text-[10px] text-slate-400 mt-2 ml-1">Leave blank for a single-day callout.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="calloutStartTime" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Start Time</label>
                      <select id="calloutStartTime" value={calloutForm.startTime} onChange={(e) => handleCalloutFormChange('startTime', e.target.value)} required className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 focus:ring-2 focus:ring-brand-blue/20 outline-none">
                        {TIME_SLOTS_H_MM.map(ts => <option key={`co-start-${ts}`} value={ts}>{ts}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="calloutEndTime" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">End Time</label>
                      <select id="calloutEndTime" value={calloutForm.endTime} onChange={(e) => handleCalloutFormChange('endTime', e.target.value)} required className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 focus:ring-2 focus:ring-brand-blue/20 outline-none">
                        {TIME_SLOTS_H_MM.map(ts => <option key={`co-end-${ts}`} value={ts}>{ts}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="calloutReason" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Reason (Optional)</label>
                    <input type="text" id="calloutReason" value={calloutForm.reason || ''} onChange={(e) => handleCalloutFormChange('reason', e.target.value)} className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 focus:ring-2 focus:ring-brand-blue/20 outline-none" placeholder="e.g., Doctor's Appointment"/>
                  </div>
                  <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-full shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-2 text-sm ml-auto">
                    <PlusIcon className="w-4 h-4"/>
                    <span>Record Unavailability</span>
                  </button>
                </form>
                <div className="space-y-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Recorded History</h3>
                  {callouts.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-3xl border border-slate-100"><p className="text-slate-400">No history found.</p></div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {callouts.map(co => (
                        <div key={co.id} className="flex justify-between items-center p-6 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                          <div>
                            <span className="text-xs font-bold text-brand-blue uppercase tracking-tighter block mb-1">{co.entityType}</span>
                            <span className="font-serif text-lg text-slate-900 block">{co.entityName}</span>
                            <span className="text-sm text-slate-500 mt-2 block">
                              {formatCalloutDateDisplay(co.startDate, co.endDate)} · {co.startTime}-{co.endTime}
                            </span>
                            {co.reason && <p className="text-xs text-slate-400 italic mt-2">"{co.reason}"</p>}
                          </div>
                          <button onClick={() => handleRemoveCallout(co.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full" aria-label="Remove Callout">
                            <TrashIcon className="w-5 h-5"/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {isSessionModalOpen && ( <SessionModal isOpen={isSessionModalOpen} onClose={handleCloseSessionModal} onSave={handleSaveSession} onDelete={sessionToEdit ? handleDeleteSession : undefined} sessionData={sessionToEdit} newSessionSlot={newSessionSlotDetails} clients={clients} therapists={therapists} insuranceQualifications={availableInsuranceQualifications} availableSessionTypes={ALL_SESSION_TYPES} timeSlots={TIME_SLOTS_H_MM} currentSchedule={schedule || []} currentError={error} clearError={() => setError(null)} /> )}
      <footer className="bg-white border-t border-slate-100 py-8 text-center text-sm text-slate-500">
        <div className="container mx-auto px-4">
          <p className="font-serif text-lg text-slate-900 mb-2">Fiddler Scheduler</p>
          <p>&copy; {new Date().getFullYear()} Fiddler Scheduler. Modern scheduling for modern teams.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
