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
    <div className="space-y-12 p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
      <div>
        <h2 className="text-2xl font-serif text-slate-900 tracking-tight flex items-center gap-3">
           <div className="w-2 h-8 bg-brand-blue rounded-full"></div>
           Global Configuration
        </h2>
        <p className="text-sm text-slate-400 mt-2 font-medium">Operational boundaries and system constraints</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <section className="space-y-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Operating Hours</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Daily Start</label>
              <select
                value={config.companyOperatingHoursStart}
                onChange={(e) => handleTimeChange('companyOperatingHoursStart', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              >
                {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Daily Close</label>
              <select
                value={config.companyOperatingHoursEnd}
                onChange={(e) => handleTimeChange('companyOperatingHoursEnd', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              >
                {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Staff Availability</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Earliest Arrival</label>
              <select
                value={config.staffAssumedAvailabilityStart}
                onChange={(e) => handleTimeChange('staffAssumedAvailabilityStart', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              >
                {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Latest Departure</label>
              <select
                value={config.staffAssumedAvailabilityEnd}
                onChange={(e) => handleTimeChange('staffAssumedAvailabilityEnd', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              >
                {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-6 lg:col-span-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Lunch Break Constraints</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Earliest Start</label>
              <select
                value={config.lunchCoverageStartTime}
                onChange={(e) => handleTimeChange('lunchCoverageStartTime', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              >
                {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Latest End</label>
              <select
                value={config.lunchCoverageEndTime}
                onChange={(e) => handleTimeChange('lunchCoverageEndTime', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              >
                {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Ideal Start</label>
              <select
                value={config.idealLunchWindowStart}
                onChange={(e) => handleTimeChange('idealLunchWindowStart', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              >
                {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Ideal Window End</label>
              <select
                value={config.idealLunchWindowEndForStart}
                onChange={(e) => handleTimeChange('idealLunchWindowEndForStart', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              >
                {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
          </div>
        </section>
      </div>

      <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-50">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white font-bold py-3 px-12 rounded-full shadow-lg shadow-slate-200 hover:shadow-xl transition-all"
        >
          {isSaving ? 'Syncing...' : 'Save Configuration'}
        </button>
        {saveMessage && (
          <p className={`text-sm font-bold uppercase tracking-widest ${saveMessage.includes('Error') ? 'text-red-500' : 'text-emerald-500'}`}>
            {saveMessage}
          </p>
        )}
      </div>

      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
        <p className="text-xs text-slate-500 leading-relaxed">
          <span className="font-bold text-slate-900 uppercase tracking-widest mr-2">Critical:</span>
          These settings control global operational logic. Changes are applied immediately to all future schedule generations.
        </p>
      </div>
    </div>
  );
};

export default SystemConfigPanel;
