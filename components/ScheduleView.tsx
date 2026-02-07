
import React, { useMemo } from 'react';
import { GeneratedSchedule, DayOfWeek, ScheduleEntry, Therapist, SessionType, Team, ScheduleViewProps, Client } from '../types';
import { COMPANY_OPERATING_HOURS_START, COMPANY_OPERATING_HOURS_END } from '../constants';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { to12HourTime } from '../utils/validationService';
import { getClientColor, getContrastText } from '../utils/colorUtils';
import { sortStaffHierarchically } from '../utils/staffUtils';

const timeToMinutes = (time: string): number => {
  if (!time || !time.includes(':')) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const SLOT_SIZE = 15; // minutes per slot

const generateDisplayTimeSlots = (): string[] => {
  const startMinutes = timeToMinutes(COMPANY_OPERATING_HOURS_START);
  const endMinutes = timeToMinutes(COMPANY_OPERATING_HOURS_END);
  const slots: string[] = [];
  for (let minutes = startMinutes; minutes < endMinutes; minutes += SLOT_SIZE) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
};
const displayTimeSlots = generateDisplayTimeSlots();
const OP_START_MINUTES = timeToMinutes(COMPANY_OPERATING_HOURS_START);

/** Format a time slot for display in the horizontal header: "9a", "12p", "1p" etc. Only show label on the hour. */
const formatHourLabel = (slot: string): string | null => {
  const m = timeToMinutes(slot);
  if (m % 60 !== 0) return null; // only label on the hour
  const h = Math.floor(m / 60);
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
};

const getSessionStyling = (sessionType: SessionType, clientId: string | null, clients: Client[], allClientIds?: string[]): { display: string; bgColor: string; textColor: string; borderColor: string; style?: React.CSSProperties } => {
  const client = clientId ? clients.find(c => c.id === clientId) : null;
  const clientColor = client ? (client.color || getClientColor(client.id, allClientIds)) : null;
  const contrastText = clientColor ? getContrastText(clientColor) : null;

  if (clientColor) {
    return {
      display: sessionType === 'AlliedHealth_OT' ? 'OT' : sessionType === 'AlliedHealth_SLP' ? 'SLP' : sessionType === 'IndirectTime' ? 'Lunch' : 'ABA',
      bgColor: clientColor,
      textColor: contrastText!,
      borderColor: 'rgba(0,0,0,0.08)',
      style: {
        backgroundColor: clientColor,
        color: contrastText!,
        borderColor: 'rgba(0,0,0,0.08)',
        ...(sessionType === 'AlliedHealth_OT' ? { filter: 'saturate(0.8) brightness(0.9)' } : {}),
        ...(sessionType === 'AlliedHealth_SLP' ? { filter: 'saturate(0.8) brightness(1.1)' } : {}),
      }
    };
  }

  switch (sessionType) {
    case 'ABA': return { display: 'ABA', bgColor: '#DBEAFE', textColor: '#2563EB', borderColor: '#BFDBFE' };
    case 'AlliedHealth_OT': return { display: 'OT', bgColor: '#D1FAE5', textColor: '#047857', borderColor: '#A7F3D0' };
    case 'AlliedHealth_SLP': return { display: 'SLP', bgColor: '#EDE9FE', textColor: '#6D28D9', borderColor: '#DDD6FE' };
    case 'IndirectTime': return { display: 'Lunch', bgColor: '#F1F5F9', textColor: '#64748B', borderColor: '#E2E8F0' };
    default: return { display: sessionType, bgColor: '#F8FAFC', textColor: '#94A3B8', borderColor: '#F1F5F9' };
  }
};

const getDayOfWeekFromDate = (date: Date | null): DayOfWeek | null => {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  const dayIndex = date.getDay();
  const daysMap: DayOfWeek[] = [DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY];
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

  const allClientIds = useMemo(() => clients.map(c => c.id), [clients]);

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
    const data = therapistsToDisplay.reduce((acc, therapist) => {
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
    }, {} as Record<string, { therapists: Therapist[]; color: string; name: string }>);

    const hasUnassignedSessions = daySchedule.some(entry => entry.therapistId === null);
    if (hasUnassignedSessions) {
      data['UnassignedColumn'] = {
        therapists: [{ id: 'null-staff', name: 'Unassigned', role: 'Other', qualifications: [] }],
        color: '#CBD5E1',
        name: 'Unassigned Staff'
      };
    }

    return data;
  }, [therapistsToDisplay, availableTeams, daySchedule]);

  const sortedTeamIds = useMemo(() => Object.keys(teamsData).sort((a, b) => {
    const teamAName = teamsData[a].name;
    const teamBName = teamsData[b].name;
    if (teamAName === 'Unassigned') return 1;
    if (teamBName === 'Unassigned') return -1;
    return teamAName.localeCompare(teamBName);
  }), [teamsData]);

  // Flatten therapists in team order for row rendering
  const orderedTherapists = useMemo(() => {
    const list: { therapist: Therapist; teamId: string; teamName: string; teamColor: string }[] = [];
    sortedTeamIds.forEach(teamId => {
      teamsData[teamId].therapists.forEach(t => {
        list.push({ therapist: t, teamId, teamName: teamsData[teamId].name, teamColor: teamsData[teamId].color });
      });
    });
    return list;
  }, [sortedTeamIds, teamsData]);

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

  // Build a lookup: for each therapist, which entries and at which slot indices
  const therapistEntries = useMemo(() => {
    const map = new Map<string, { entry: ScheduleEntry; startSlot: number; colSpan: number }[]>();
    daySchedule.forEach(entry => {
      const tId = entry.therapistId || 'null-staff';
      const startMin = timeToMinutes(entry.startTime);
      const endMin = timeToMinutes(entry.endTime);
      const startSlot = Math.max(0, Math.floor((startMin - OP_START_MINUTES) / SLOT_SIZE));
      const endSlot = Math.min(displayTimeSlots.length, Math.ceil((endMin - OP_START_MINUTES) / SLOT_SIZE));
      const colSpan = Math.max(1, endSlot - startSlot);
      if (!map.has(tId)) map.set(tId, []);
      map.get(tId)!.push({ entry, startSlot, colSpan });
    });
    return map;
  }, [daySchedule]);

  const handleDragStart = (e: React.DragEvent<HTMLTableCellElement>, entry: ScheduleEntry) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ entryId: entry.id }));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.currentTarget.classList.remove('opacity-50');
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('bg-sky-50');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.currentTarget.classList.remove('bg-sky-50');
  };

  const handleDrop = (e: React.DragEvent<HTMLTableCellElement>, targetTherapistId: string, targetTimeSlot: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-sky-50');
    const draggedDataJson = e.dataTransfer.getData('application/json');
    if (draggedDataJson) {
      const { entryId } = JSON.parse(draggedDataJson);
      if (entryId) onMoveScheduleEntry(entryId, targetTherapistId, targetTimeSlot);
    }
  };

  // Determine which hour columns get a label (for the top header)
  const hourHeaders = displayTimeSlots.map((slot, i) => {
    const label = formatHourLabel(slot);
    // Count how many consecutive 15-min slots until the next hour or end
    let span = 0;
    if (label) {
      for (let j = i; j < displayTimeSlots.length; j++) {
        const nextLabel = j > i ? formatHourLabel(displayTimeSlots[j]) : null;
        if (j > i && nextLabel) break;
        span++;
      }
    }
    return { slot, label, span };
  }).filter(h => h.label !== null) as { slot: string; label: string; span: number }[];

  // Track which team was last rendered to insert team separator rows
  let lastTeamId: string | null = null;

  return (
    <div className="space-y-6 mt-8">
      {/* Legend bar */}
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

      {/* Horizontal schedule grid */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0" style={{ minWidth: `${200 + displayTimeSlots.length * 36}px` }}>
            <thead>
              {/* Hour labels row */}
              <tr>
                <th className="sticky left-0 z-30 bg-slate-50 border-b border-r border-slate-100 p-0" style={{ minWidth: '200px' }}></th>
                {hourHeaders.map(h => (
                  <th
                    key={h.slot}
                    colSpan={h.span}
                    className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wide py-2 text-left pl-1"
                    style={{ minWidth: `${h.span * 36}px` }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {orderedTherapists.map(({ therapist, teamId, teamName, teamColor }) => {
                const entries = therapistEntries.get(therapist.id) || [];
                // Set of slot indices that are covered by a session
                const coveredSlots = new Set<number>();
                entries.forEach(({ startSlot, colSpan }) => {
                  for (let s = startSlot; s < startSlot + colSpan; s++) coveredSlots.add(s);
                });

                // Check if we need to render a team separator
                const showTeamHeader = teamId !== lastTeamId;
                lastTeamId = teamId;

                return (
                  <React.Fragment key={therapist.id}>
                    {/* Team separator row */}
                    {showTeamHeader && (
                      <tr>
                        <td
                          colSpan={displayTimeSlots.length + 1}
                          className="sticky left-0 z-20 px-4 py-1.5 border-b border-slate-100"
                          style={{ backgroundColor: teamColor + '18' }}
                        >
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: teamColor === '#E2E8F0' ? '#94A3B8' : teamColor }}>
                            {teamName}
                          </span>
                        </td>
                      </tr>
                    )}

                    {/* Staff row */}
                    <tr className="group/row hover:bg-slate-50/30 transition-colors">
                      {/* Staff name cell - sticky left */}
                      <td className="sticky left-0 z-20 bg-white group-hover/row:bg-slate-50/80 border-b border-r border-slate-100 px-4 py-2 transition-colors" style={{ minWidth: '200px' }}>
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: teamColor }}></div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-700 truncate">{therapist.name}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{therapist.role}</div>
                          </div>
                        </div>
                      </td>

                      {/* Time slot cells */}
                      {displayTimeSlots.map((slot, slotIdx) => {
                        // Check if a session starts at this slot
                        const entryData = entries.find(e => e.startSlot === slotIdx);
                        if (entryData) {
                          const { entry, colSpan } = entryData;
                          const styling = getSessionStyling(entry.sessionType, entry.clientId, clients, allClientIds);
                          return (
                            <td
                              key={entry.id}
                              colSpan={colSpan}
                              className={`border-b border-slate-50 p-0.5 ${canEdit ? 'cursor-pointer' : ''}`}
                              draggable={canEdit ? true : false}
                              onDragStart={canEdit ? (e) => handleDragStart(e, entry) : undefined}
                              onDragEnd={canEdit ? handleDragEnd : undefined}
                              onClick={canEdit ? () => onOpenEditSessionModal(entry) : undefined}
                              title={canEdit ? `Click to edit: ${entry.clientName || styling.display} (${to12HourTime(entry.startTime)} - ${to12HourTime(entry.endTime)})` : `${entry.clientName || styling.display}`}
                            >
                              <div
                                className="h-9 rounded-lg border flex items-center px-2 gap-1 overflow-hidden transition-all hover:shadow-md hover:brightness-95"
                                style={styling.style || { backgroundColor: styling.bgColor, color: styling.textColor, borderColor: styling.borderColor }}
                              >
                                <span className="text-[11px] font-bold truncate">{entry.clientName || styling.display}</span>
                                {colSpan >= 4 && (
                                  <span className="text-[9px] opacity-70 font-semibold whitespace-nowrap ml-auto">
                                    {to12HourTime(entry.startTime).replace(' ', '')}–{to12HourTime(entry.endTime).replace(' ', '')}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        }

                        // Skip slots that are covered by a previous session's colSpan
                        if (coveredSlots.has(slotIdx)) return null;

                        // Empty slot
                        const isHourBoundary = timeToMinutes(slot) % 60 === 0;
                        return (
                          <td
                            key={`${therapist.id}-${slot}`}
                            className={`border-b border-slate-50 p-0.5 transition-colors ${isHourBoundary ? 'border-l border-l-slate-100' : 'border-l border-l-slate-50'} ${canEdit ? 'hover:bg-sky-50 cursor-pointer' : ''}`}
                            style={{ minWidth: '36px' }}
                            onDragOver={canEdit ? handleDragOver : undefined}
                            onDragLeave={canEdit ? handleDragLeave : undefined}
                            onDrop={canEdit ? (e) => handleDrop(e, therapist.id, slot) : undefined}
                            onClick={canEdit ? () => onOpenAddSessionModal(therapist.id, therapist.name, slot, scheduledDayOfWeek) : undefined}
                            title={canEdit ? `Add session for ${therapist.name} at ${to12HourTime(slot)}` : undefined}
                          >
                            <div className="h-9"></div>
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
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
