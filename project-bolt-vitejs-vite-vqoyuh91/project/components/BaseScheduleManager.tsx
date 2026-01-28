
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
    <div className="space-y-8 p-4 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6 border-b pb-3">
        <h2 className="text-2xl font-semibold text-slate-700">Manage Base Schedules</h2>
        <button
          onClick={onAddConfig}
          className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow hover:shadow-md transition-colors duration-150 flex items-center space-x-2"
        >
          <PlusIcon className="w-5 h-5" />
          <span>Add Base Config</span>
        </button>
      </div>

      {baseSchedules.length === 0 && (
        <p className="text-slate-500 text-center py-6">No base schedule configurations found. Click "Add Base Config" to create one.</p>
      )}

      <div className="space-y-6">
        {baseSchedules.map(config => (
          <div key={config.id} className="bg-slate-50 p-6 rounded-lg shadow border border-slate-200">
            <div className="flex justify-between items-start mb-4">
              {editingConfigId === config.id ? (
                <div className="flex-grow flex items-center space-x-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="form-input p-2 border border-blue-400 rounded-md shadow-sm flex-grow"
                    autoFocus
                  />
                  <button onClick={() => handleSaveName(config.id)} className="text-sm bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded-md">Save</button>
                  <button onClick={() => setEditingConfigId(null)} className="text-sm bg-slate-400 hover:bg-slate-500 text-white py-1 px-3 rounded-md">Cancel</button>
                </div>
              ) : (
                <h3 className="text-xl font-semibold text-blue-600 flex items-center">
                  {config.name}
                  <button onClick={() => handleStartEditName(config)} className="ml-3 text-blue-500 hover:text-blue-700">
                    <EditIcon className="w-5 h-5" />
                  </button>
                </h3>
              )}
              <button
                onClick={() => onDeleteConfig(config.id)}
                className="text-red-500 hover:text-red-700 transition-colors"
                aria-label="Delete Base Schedule Configuration"
              >
                <TrashIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-600 mb-1">Applies to Days:</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <label key={day} className="flex items-center space-x-2 p-2 border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer transition-colors bg-white">
                    <input
                      type="checkbox"
                      checked={config.appliesToDays.includes(day)}
                      onChange={() => handleDayToggle(config.id, day, config.appliesToDays)}
                      className="form-checkbox h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-slate-700 text-sm">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-slate-600">
                Status: {config.schedule ? 
                  <span className="font-semibold text-green-600">Schedule Set ({config.schedule.length} entries)</span> : 
                  <span className="font-semibold text-amber-600">No schedule data set</span>
                }
              </p>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <button
                onClick={() => onSetAsBase(config.id)}
                disabled={!currentGeneratedScheduleIsSet}
                className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 text-white font-medium py-2 px-4 rounded-md shadow text-sm transition-colors"
                title={!currentGeneratedScheduleIsSet ? "Generate a schedule first to set it as base" : "Set current generated schedule as this base"}
              >
                Set Current as Base
              </button>
              <button
                onClick={() => onViewBase(config.id)}
                disabled={!config.schedule}
                className="bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300 text-white font-medium py-2 px-4 rounded-md shadow text-sm transition-colors"
                title={!config.schedule ? "No schedule data set for this base" : "View this base schedule"}
              >
                View Base Schedule
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BaseScheduleManager;
