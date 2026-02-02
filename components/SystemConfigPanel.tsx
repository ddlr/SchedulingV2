import React, { useState, useEffect } from 'react';
import { SystemConfig, getSystemConfig, updateSystemConfig, subscribeToSystemConfig } from '../services/systemConfigService';
import { TIME_SLOTS_H_MM } from '../constants';
import { updateCachedConfig } from '../constants';

const SystemConfigPanel: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig>(getSystemConfig());
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToSystemConfig((newConfig) => {
      setConfig(newConfig);
      updateCachedConfig(newConfig);
    });
    return unsubscribe;
  }, []);

  const handleTimeChange = (field: keyof SystemConfig, value: string) => {
    setConfig({ ...config, [field]: value });
  };

  const handleArrayChange = (field: keyof SystemConfig, value: string[]) => {
    setConfig({ ...config, [field]: value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      await updateSystemConfig(config);
      updateCachedConfig(config);
      setSaveMessage('Configuration saved successfully');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      setSaveMessage('Error saving configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const timeSlots = TIME_SLOTS_H_MM.filter(slot => {
    const hour = parseInt(slot.split(':')[0]);
    return hour >= 7 && hour <= 18;
  });

  return (
    <div className="space-y-8 p-4 bg-white rounded-lg shadow-md">
      <div className="border-b pb-3">
        <h2 className="text-2xl font-semibold text-slate-700">System Configuration</h2>
        <p className="text-sm text-slate-500 mt-1">Configure system-wide operational settings stored in the database</p>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-600">Operating Hours</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Company Operating Hours Start</label>
            <select
              value={config.companyOperatingHoursStart}
              onChange={(e) => handleTimeChange('companyOperatingHoursStart', e.target.value)}
              className="form-select block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Company Operating Hours End</label>
            <select
              value={config.companyOperatingHoursEnd}
              onChange={(e) => handleTimeChange('companyOperatingHoursEnd', e.target.value)}
              className="form-select block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-600">Staff Availability</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Staff Availability Start</label>
            <select
              value={config.staffAssumedAvailabilityStart}
              onChange={(e) => handleTimeChange('staffAssumedAvailabilityStart', e.target.value)}
              className="form-select block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Staff Availability End</label>
            <select
              value={config.staffAssumedAvailabilityEnd}
              onChange={(e) => handleTimeChange('staffAssumedAvailabilityEnd', e.target.value)}
              className="form-select block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-600">Lunch Break Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Lunch Coverage Start Time</label>
            <select
              value={config.lunchCoverageStartTime}
              onChange={(e) => handleTimeChange('lunchCoverageStartTime', e.target.value)}
              className="form-select block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Lunch Coverage End Time</label>
            <select
              value={config.lunchCoverageEndTime}
              onChange={(e) => handleTimeChange('lunchCoverageEndTime', e.target.value)}
              className="form-select block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Ideal Lunch Window Start</label>
            <select
              value={config.idealLunchWindowStart}
              onChange={(e) => handleTimeChange('idealLunchWindowStart', e.target.value)}
              className="form-select block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Ideal Lunch Window End (for Start)</label>
            <select
              value={config.idealLunchWindowEndForStart}
              onChange={(e) => handleTimeChange('idealLunchWindowEndForStart', e.target.value)}
              className="form-select block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
            </select>
          </div>
        </div>
      </section>

      <div className="pt-4 border-t">
        <div className="flex items-center justify-between">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-semibold py-2 px-6 rounded-lg shadow hover:shadow-md transition-colors duration-150"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
          {saveMessage && (
            <p className={`text-sm font-medium ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {saveMessage}
            </p>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> These settings control system-wide behavior including schedule generation, validation rules, and UI options. Changes take effect immediately across the application.
        </p>
      </div>
    </div>
  );
};

export default SystemConfigPanel;
