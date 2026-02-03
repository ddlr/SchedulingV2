
import React, { useState } from 'react';
import { BaseScheduleManagerProps, DayOfWeek, BaseScheduleConfig } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { EditIcon } from './icons/EditIcon';

const BaseScheduleManager: React.FC<BaseScheduleManagerProps> = ({
  baseSchedules,
  onAddConfig,
  onUpdateConfigName,
  onUpdateConfigDays,
  onDeleteConfig,
  onSetAsBase,
  onViewBase,
  currentGeneratedScheduleIsSet,
}) => {
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleStartEditName = (config: BaseScheduleConfig) => {
    setEditingConfigId(config.id);
    setEditingName(config.name);
  };

  const handleSaveName = (id: string) => {
    if (editingName.trim() === '') return;
    onUpdateConfigName(id, editingName.trim());
    setEditingConfigId(null);
    setEditingName('');
  };

  const handleDayToggle = (configId: string, day: DayOfWeek, currentDays: DayOfWeek[]) => {
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    onUpdateConfigDays(configId, newDays);
  };

  return (
    <div className="space-y-12">
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-serif text-slate-900 tracking-tight">Recurring Foundations</h2>
          <p className="text-sm text-slate-400 mt-1 font-medium">Standard template schedules to apply by default</p>
        </div>
        <button
          onClick={onAddConfig}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-slate-200 hover:shadow-xl transition-all flex items-center space-x-2 text-sm self-start sm:self-auto"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add Foundation</span>
        </button>
      </div>

      {baseSchedules.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
           <p className="text-slate-400 font-medium">No foundations created yet.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        {baseSchedules.map(config => (
          <div key={config.id} className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 space-y-8 transition-all hover:shadow-md">
            <div className="flex justify-between items-start">
              {editingConfigId === config.id ? (
                <div className="flex-grow flex items-center space-x-3 max-w-md">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-brand-blue/30 rounded-xl text-lg font-serif outline-none"
                    autoFocus
                  />
                  <button onClick={() => handleSaveName(config.id)} className="text-brand-blue font-bold text-sm">Save</button>
                  <button onClick={() => setEditingConfigId(null)} className="text-slate-400 font-bold text-sm">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center group">
                  <h3 className="text-2xl font-serif text-slate-900 leading-tight">
                    {config.name}
                  </h3>
                  <button onClick={() => handleStartEditName(config)} className="ml-3 p-2 text-slate-300 hover:text-brand-blue opacity-0 group-hover:opacity-100 transition-all">
                    <EditIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button
                onClick={() => onDeleteConfig(config.id)}
                className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                aria-label="Delete Base Schedule Configuration"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Applies to Days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <label
                    key={day}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all cursor-pointer ${
                      config.appliesToDays.includes(day)
                        ? 'bg-brand-blue/5 border-brand-blue text-brand-blue'
                        : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={config.appliesToDays.includes(day)}
                      onChange={() => handleDayToggle(config.id, day, config.appliesToDays)}
                      className="hidden"
                    />
                    <span className="text-xs font-bold uppercase tracking-tighter">{day.substring(0, 3)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-6 border-t border-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${config.schedule ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {config.schedule ?
                    `Active foundation (${config.schedule.length} entries)` :
                    "Blueprint only (no data)"
                  }
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => onSetAsBase(config.id)}
                  disabled={!currentGeneratedScheduleIsSet}
                  className="px-6 py-2.5 bg-brand-blue/10 hover:bg-brand-blue/20 disabled:opacity-30 text-brand-blue font-bold rounded-full text-xs transition-all"
                  title={!currentGeneratedScheduleIsSet ? "Generate a schedule first" : "Overwrite foundation with current view"}
                >
                  Sync Current View
                </button>
                <button
                  onClick={() => onViewBase(config.id)}
                  disabled={!config.schedule}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-full text-xs transition-all"
                  title={!config.schedule ? "No data set" : "Load foundation data"}
                >
                  View Blueprint
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BaseScheduleManager;
