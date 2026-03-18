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

  // --- Role management helpers ---
  const handleRoleRename = (index: number, newName: string) => {
    const oldName = config.allTherapistRoles[index];
    const updatedRoles = [...config.allTherapistRoles];
    updatedRoles[index] = newName;

    // Update defaultRoleRank keys to match
    const updatedRank = { ...config.defaultRoleRank };
    if (oldName !== newName && oldName in updatedRank) {
      updatedRank[newName] = updatedRank[oldName];
      delete updatedRank[oldName];
    }

    setConfig({ ...config, allTherapistRoles: updatedRoles, defaultRoleRank: updatedRank });
  };

  const handleAddRole = () => {
    const newRole = `Role ${config.allTherapistRoles.length + 1}`;
    setConfig({
      ...config,
      allTherapistRoles: [...config.allTherapistRoles, newRole],
      defaultRoleRank: { ...config.defaultRoleRank, [newRole]: 0 },
    });
  };

  const handleRemoveRole = (index: number) => {
    const roleName = config.allTherapistRoles[index];
    const updatedRoles = config.allTherapistRoles.filter((_, i) => i !== index);
    const updatedRank = { ...config.defaultRoleRank };
    delete updatedRank[roleName];

    setConfig({ ...config, allTherapistRoles: updatedRoles, defaultRoleRank: updatedRank });
  };

  const handleRankChange = (roleName: string, newRank: number) => {
    setConfig({
      ...config,
      defaultRoleRank: { ...config.defaultRoleRank, [roleName]: newRank },
    });
  };

  const handleMoveRole = (index: number, direction: 'up' | 'down') => {
    const roles = [...config.allTherapistRoles];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= roles.length) return;
    [roles[index], roles[swapIndex]] = [roles[swapIndex], roles[index]];
    setConfig({ ...config, allTherapistRoles: roles });
  };

  // Sort roles by rank for the hierarchy display (highest rank first)
  const rolesByRank = [...config.allTherapistRoles].sort((a, b) => {
    return (config.defaultRoleRank[b] ?? 0) - (config.defaultRoleRank[a] ?? 0);
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

        <section className="space-y-6 lg:col-span-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Scheduling Constraints</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Max Sessions Per Therapist</label>
              <input
                type="number"
                min={0}
                value={config.maxSessionsPerTherapist ?? 0}
                onChange={(e) => setConfig({ ...config, maxSessionsPerTherapist: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1 ml-1">0 = unlimited</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Ideal Session Min (minutes)</label>
              <input
                type="number"
                min={15}
                step={15}
                value={config.idealSessionMinMinutes ?? 90}
                onChange={(e) => setConfig({ ...config, idealSessionMinMinutes: parseInt(e.target.value) || 90 })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1 ml-1">Preferred minimum ABA session length</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Ideal Session Max (minutes)</label>
              <input
                type="number"
                min={15}
                step={15}
                value={config.idealSessionMaxMinutes ?? 150}
                onChange={(e) => setConfig({ ...config, idealSessionMaxMinutes: parseInt(e.target.value) || 150 })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1 ml-1">Preferred maximum ABA session length</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Therapist Roles</h3>
            <button
              onClick={handleAddRole}
              className="text-xs font-bold text-brand-blue hover:text-blue-700 transition-colors px-3 py-1 rounded-lg hover:bg-blue-50"
            >
              + Add Role
            </button>
          </div>
          <div className="space-y-2">
            {config.allTherapistRoles.map((role, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMoveRole(index, 'up')}
                    disabled={index === 0}
                    className="text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none"
                  >
                    &#9650;
                  </button>
                  <button
                    onClick={() => handleMoveRole(index, 'down')}
                    disabled={index === config.allTherapistRoles.length - 1}
                    className="text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none"
                  >
                    &#9660;
                  </button>
                </div>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => handleRoleRename(index, e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
                />
                <button
                  onClick={() => handleRemoveRole(index)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove role"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Role Hierarchy</h3>
          <p className="text-[10px] text-slate-400 ml-1">Higher rank = more senior. Used for scheduling priority and staff sorting.</p>
          <div className="space-y-2">
            {rolesByRank.map((role) => (
              <div key={role} className="flex items-center gap-3">
                <span className="text-sm text-slate-700 font-medium w-24 truncate">{role}</span>
                <input
                  type="number"
                  value={config.defaultRoleRank[role] ?? 0}
                  onChange={(e) => handleRankChange(role, parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-700 font-medium text-center focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
                />
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-brand-blue h-full rounded-full transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, ((config.defaultRoleRank[role] ?? 0) + 2) * 12))}%` }}
                  />
                </div>
              </div>
            ))}
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
