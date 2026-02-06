
import React, { useMemo } from 'react';
import { GeneratedSchedule, DayOfWeek, ScheduleEntry, Therapist, SessionType, Team, ScheduleViewProps } from '../types';
import { TIME_SLOTS_H_MM, COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END } from '../constants';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { PencilIcon } from './icons/PencilIcon';
import { to12HourTime } from '../utils/validationService';
import { getClientColor, getContrastText } from '../utils/colorUtils';
import { sortStaffHierarchically } from '../utils/staffUtils';

const timeToMinutes = (time: string): number => {
  if (!time || !time.includes(':')) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const generateDisplayTimeSlots = (): string[] => {
  const startMinutes = timeToMinutes(COMPANY_OPERATING_HOURS_START);
  const endMinutes = timeToMinutes(COMPANY_OPERATING_HOURS_END);
  const slots: string[] = [];
  for (let minutes = startMinutes; minutes < endMinutes; minutes += 15) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
};
const displayTimeSlots = generateDisplayTimeSlots();

const getSessionTypeStyling = (sessionType: SessionType, clientId: string | null, clients: Client[]): { display: string; classes: string; style?: React.CSSProperties } => {
  const client = clientId ? clients.find(c => c.id === clientId) : null;
  const clientColor = client ? (client.color || getClientColor(client.id)) : null;
  const textColor = clientColor ? getContrastText(clientColor) : null;

  switch (sessionType) {
    case 'ABA':
      return {
        display: 'ABA',
        classes: clientColor ? '' : 'bg-brand-blue/10 border-brand-blue/20 text-brand-blue',
        style: clientColor ? { backgroundColor: clientColor, color: textColor, borderColor: 'rgba(0,0,0,0.1)' } : undefined
      };
    case 'AlliedHealth_OT':
      return {
        display: 'OT',
        classes: clientColor ? '' : 'bg-emerald-100 border-emerald-200 text-emerald-700',
        style: clientColor ? { backgroundColor: clientColor, color: textColor, borderColor: 'rgba(0,0,0,0.1)', filter: 'saturate(0.8) brightness(0.9)' } : undefined
      };
    case 'AlliedHealth_SLP':
      return {
        display: 'SLP',
        classes: clientColor ? '' : 'bg-violet-100 border-violet-200 text-violet-700',
        style: clientColor ? { backgroundColor: clientColor, color: textColor, borderColor: 'rgba(0,0,0,0.1)', filter: 'saturate(0.8) brightness(1.1)' } : undefined
      };
    case 'IndirectTime': return { display: 'Lunch', classes: 'bg-slate-100 border-slate-200 text-slate-500' };
    default: return { display: sessionType, classes: 'bg-slate-50 border-slate-100 text-slate-400' };
  }
};

const getDayOfWeekFromDate = (date: Date | null): DayOfWeek | null => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        return null;
    }
    const dayIndex = date.getDay();
    const daysMap: DayOfWeek[] = [ DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY];
    return daysMap[dayIndex];
};

const ScheduleView: React.FC<ScheduleViewProps> = ({
    schedule,
    therapists: therapistsToDisplay,
    clients,
    availableTeams,
    scheduledFullDate,
    canEdit = true,
    onMoveScheduleEntry,
    onOpenEditSessionModal,
    onOpenAddSessionModal
}) => {

  if (!scheduledFullDate) {
    return (
        <div className="text-center py-10">
            <UserGroupIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-xl text-slate-500">Please select a date and generate a schedule.</p>
        </div>
    );
  }

  const scheduledDayOfWeek = getDayOfWeekFromDate(scheduledFullDate);
  if (!scheduledDayOfWeek) {
     return (
        <div className="text-center py-10">
            <p className="text-xl text-red-500">Error: Invalid date selected for schedule view.</p>
        </div>
    );
  }

  const daySchedule = schedule.filter(entry => entry.day === scheduledDayOfWeek);

  const teamsData = useMemo(() => {
    return therapistsToDisplay.reduce((acc, therapist) => {
      const teamId = therapist.teamId || 'UnassignedTeam';
      if (!acc[teamId]) {
          const teamInfo = availableTeams.find(t => t.id === teamId);
          acc[teamId] = {
            therapists: [],
            color: teamInfo?.color || '#E2E8F0',
            name: teamInfo?.name || 'Unassigned'
          };
      }
      acc[teamId].therapists.push(therapist);
      acc[teamId].therapists.sort(sortStaffHierarchically);
      return acc;
    }, {} as Record<string, { therapists: Therapist[]; color?: string; name: string }>);
  }, [therapistsToDisplay, availableTeams]);

  const sortedTeamIds = useMemo(() => Object.keys(teamsData).sort((a, b) => {
    const teamAName = teamsData[a].name;
    const teamBName = teamsData[b].name;
    if (teamAName === 'Unassigned') return 1;
    if (teamBName === 'Unassigned') return -1;
    return teamAName.localeCompare(teamBName);
  }), [teamsData]);

  const formattedDate = scheduledFullDate.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  if (therapistsToDisplay.length === 0) {
     return (
      <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
        <h3 className="text-2xl font-semibold text-blue-600 mb-4 pb-2 border-b-2 border-blue-200">{formattedDate}</h3>
        <p className="text-slate-500 italic">No staff members match the current filters for {formattedDate}.</p>
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent<HTMLTableCellElement>, entry: ScheduleEntry) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ entryId: entry.id }));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('opacity-50', 'cursor-grabbing');
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableCellElement>) => {
     e.currentTarget.classList.remove('opacity-50', 'cursor-grabbing');
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('bg-sky-100');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.currentTarget.classList.remove('bg-sky-100');
  };

  const handleDrop = (e: React.DragEvent<HTMLTableCellElement>, targetTherapistId: string, targetTimeSlot: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-sky-100');
    const draggedDataJson = e.dataTransfer.getData('application/json');
    if (draggedDataJson) {
      const { entryId } = JSON.parse(draggedDataJson);
      if (entryId) {
        onMoveScheduleEntry(entryId, targetTherapistId, targetTimeSlot);
      }
    }
  };

  return (
    <div className="space-y-6 mt-8">
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          {canEdit && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                   <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                   </svg>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">Drag to move</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">Click to Add/Edit</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 bg-slate-50/50 p-2 rounded-2xl border border-slate-50">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-brand-blue rounded-full"></span><span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">ABA</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span><span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">OT</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-violet-500 rounded-full"></span><span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">SLP</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-slate-300 rounded-full"></span><span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Lunch</span></div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 bg-slate-50 p-4 border-b border-r border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-24 z-30 text-center">Time</th>
              {sortedTeamIds.map(teamId => (
                <th key={teamId}
                    colSpan={teamsData[teamId].therapists.length}
                    className="p-3 border-b border-r border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-center z-20"
                    style={{ color: teamsData[teamId].color === '#E2E8F0' ? '#94A3B8' : teamsData[teamId].color }}>
                  {teamsData[teamId].name}
                </th>
              ))}
            </tr>
            <tr>
                <th className="sticky left-0 bg-slate-50 border-r border-slate-100 z-30"></th>
                {sortedTeamIds.map(teamId => (
                    teamsData[teamId].therapists.map(therapist => (
                    <th key={therapist.id} className="p-3 border-b border-r border-slate-100 text-xs font-bold text-slate-500 min-w-[160px] bg-slate-50/30">
                        {therapist.name.split(' ')[0]} <span className="text-[10px] font-normal opacity-50">{therapist.name.split(' ').slice(1).join(' ')}</span>
                    </th>
                    ))
                ))}
            </tr>
          </thead>
          <tbody>
            {displayTimeSlots.map(timeSlot => {
              const currentTimeSlotStartMinutes = timeToMinutes(timeSlot);
              return (
                <tr key={timeSlot} className="group">
                  <td className="sticky left-0 bg-white p-3 border-b border-r border-slate-50 text-[10px] text-slate-400 text-center font-bold w-24 z-20 h-10 group-hover:bg-slate-50 transition-colors uppercase tracking-widest">{to12HourTime(timeSlot).replace(':00', '')}</td>
                   {sortedTeamIds.map(teamId => (
                    teamsData[teamId].therapists.map(therapist => {
                        const entryForCell = daySchedule.find(entry =>
                        entry.therapistId === therapist.id &&
                        timeToMinutes(entry.startTime) === currentTimeSlotStartMinutes
                        );

                        if (entryForCell) {
                            const entryStartMinutes = timeToMinutes(entryForCell.startTime);
                            const entryEndMinutes = timeToMinutes(entryForCell.endTime);
                            const durationMinutes = entryEndMinutes - entryStartMinutes;
                            const rowSpan = Math.max(1, Math.ceil(durationMinutes / 15));
                            const styling = getSessionTypeStyling(entryForCell.sessionType, entryForCell.clientId, clients);

                            return (
                                <td key={entryForCell.id}
                                    className={`p-1 border-r border-slate-50 text-[10px] relative group transition-all ${canEdit ? 'cursor-move' : ''} ${styling.classes}`}
                                    style={styling.style}
                                    rowSpan={rowSpan}
                                    draggable={canEdit ? "true" : "false"}
                                    onDragStart={canEdit ? (e) => handleDragStart(e, entryForCell) : undefined}
                                    onDragEnd={canEdit ? handleDragEnd : undefined}
                                    onClick={canEdit ? () => onOpenEditSessionModal(entryForCell) : undefined}
                                    title={canEdit ? `Drag to move • Click to edit: ${entryForCell.clientName || styling.display} with ${entryForCell.therapistName || 'Unassigned'}` : `${entryForCell.clientName || styling.display} with ${entryForCell.therapistName || 'Unassigned'}`}
                                    aria-label={`Session: ${entryForCell.clientName || styling.display} with ${entryForCell.therapistName || 'Unassigned'} from ${to12HourTime(entryForCell.startTime)} to ${to12HourTime(entryForCell.endTime)}.`}
                                >
                                <div className="flex flex-col h-full bg-white/10 p-1.5 rounded-xl border border-white/20 shadow-sm backdrop-blur-[2px] hover:backdrop-blur-none transition-all">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold truncate text-[11px] leading-tight mb-0.5">{entryForCell.clientName || 'N/A'}</div>
                                    <div className="flex items-center gap-1 opacity-90 font-black uppercase tracking-tighter text-[8px]">
                                       <span>{styling.display}</span>
                                       <span>·</span>
                                       <span>{to12HourTime(entryForCell.startTime).replace(' ', '')}</span>
                                    </div>
                                  </div>
                                </div>
                                </td>
                            );
                        }

                        const isCoveredByPrior = daySchedule.some(entry =>
                            entry.therapistId === therapist.id &&
                            timeToMinutes(entry.startTime) < currentTimeSlotStartMinutes &&
                            timeToMinutes(entry.endTime) > currentTimeSlotStartMinutes
                        );

                        if (isCoveredByPrior) return null;

                        return (
                            <td
                                key={`${therapist.id}-${timeSlot}-empty`}
                                className={`p-2 border-b border-r border-slate-50 h-10 transition-all group relative ${canEdit ? 'hover:bg-slate-50/80 cursor-pointer' : ''}`}
                                onDragOver={canEdit ? handleDragOver : undefined}
                                onDragLeave={canEdit ? handleDragLeave : undefined}
                                onDrop={canEdit ? (e) => handleDrop(e, therapist.id, timeSlot) : undefined}
                                onClick={canEdit ? () => onOpenAddSessionModal(therapist.id, therapist.name, timeSlot, scheduledDayOfWeek) : undefined}
                                title={canEdit ? `Add session for ${therapist.name} at ${to12HourTime(timeSlot)}` : undefined}
                                aria-label={`Empty slot for ${therapist.name} at ${to12HourTime(timeSlot)}.`}
                            >
                              {canEdit && (
                                <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-full h-full transition-opacity">
                                  <div className="bg-white rounded-full shadow-sm border border-slate-100 p-1">
                                    <svg className="w-3 h-3 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </div>
                                </div>
                              )}
                            </td>
                        );
                    })
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
         {daySchedule.length === 0 && therapistsToDisplay.length > 0 && (
             <p className="text-slate-500 italic text-center py-4">No sessions match the current filters for {formattedDate}, or no sessions are scheduled. Click on a cell to add manually.</p>
         )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleView;
