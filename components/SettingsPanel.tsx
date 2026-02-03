
import React, { useState } from 'react';
import { SettingsPanelProps, Team, InsuranceQualification } from '../types';
import { TEAM_COLORS } from '../constants';
import { TrashIcon } from './icons/TrashIcon';
import { PlusIcon } from './icons/PlusIcon';
import { EditIcon } from './icons/EditIcon';

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  availableTeams,
  availableInsuranceQualifications,
  onUpdateTeams,
  onUpdateInsuranceQualifications,
}) => {
  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');

  const [newIQ, setNewIQ] = useState('');
  const [editingIQ, setEditingIQ] = useState<InsuranceQualification | null>(null);

  const handleAddTeam = () => {
    if (newTeamName.trim() === '') return;
    const nextColorIndex = availableTeams.length % TEAM_COLORS.length;
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: newTeamName.trim(),
      color: TEAM_COLORS[nextColorIndex],
    };
    onUpdateTeams([...availableTeams, newTeam]);
    setNewTeamName('');
  };

  const handleRemoveTeam = (teamId: string) => {
    onUpdateTeams(availableTeams.filter(team => team.id !== teamId));
  };

  const handleStartEditTeam = (team: Team) => {
    setEditingTeam(team);
    setEditingTeamName(team.name);
  };

  const handleSaveEditTeam = () => {
    if (editingTeam && editingTeamName.trim() !== '') {
      onUpdateTeams(
        availableTeams.map(team =>
          team.id === editingTeam.id ? { ...team, name: editingTeamName.trim() } : team
        )
      );
    }
    setEditingTeam(null);
    setEditingTeamName('');
  };

  const handleAddIQ = () => {
    if (newIQ.trim() === '' || availableInsuranceQualifications.some(iq => iq.id === newIQ.trim())) return;
    onUpdateInsuranceQualifications([...availableInsuranceQualifications, { id: newIQ.trim() }]);
    setNewIQ('');
  };

  const handleRemoveIQ = (idToRemove: string) => {
    onUpdateInsuranceQualifications(availableInsuranceQualifications.filter(iq => iq.id !== idToRemove));
  };

  const handleUpdateIQField = (id: string, field: keyof InsuranceQualification, value: any) => {
    const updated = availableInsuranceQualifications.map(iq => {
        if (iq.id === id) {
            return { ...iq, [field]: value === '' ? undefined : (typeof value === 'string' ? parseInt(value) : value) };
        }
        return iq;
    });
    onUpdateInsuranceQualifications(updated);
  };

  return (
    <div className="space-y-12">
      {/* Teams Management */}
      <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-xl font-serif text-slate-900 mb-6 flex items-center gap-2">
          <div className="w-1.5 h-6 bg-brand-blue rounded-full"></div>
          Manage Teams
        </h3>
        <div className="mb-8 flex flex-col sm:flex-row gap-3">
          <div className="flex-grow">
            <label htmlFor="newTeamName" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Team Name</label>
            <input
              type="text"
              id="newTeamName"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              placeholder="e.g., Clinical Ninjas"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddTeam}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-full shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center space-x-2 text-sm"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Team</span>
            </button>
          </div>
        </div>

        {availableTeams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableTeams.map(team => (
              <div key={team.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md group">
                {editingTeam?.id === team.id ? (
                  <div className="flex-grow flex items-center space-x-2">
                    <input
                      type="text"
                      value={editingTeamName}
                      onChange={(e) => setEditingTeamName(e.target.value)}
                      className="w-full px-3 py-1 bg-white border border-brand-blue/30 rounded-lg text-sm outline-none"
                    />
                    <button onClick={handleSaveEditTeam} className="text-brand-blue font-bold text-xs">Save</button>
                    <button onClick={() => setEditingTeam(null)} className="text-slate-400 font-bold text-xs">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <span style={{ backgroundColor: team.color }} className="w-3 h-3 rounded-full shadow-sm"></span>
                    <span className="text-slate-700 font-bold text-sm">{team.name}</span>
                  </div>
                )}
                {!editingTeam || editingTeam.id !== team.id ? (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleStartEditTeam(team)} className="p-2 text-slate-300 hover:text-brand-blue rounded-lg hover:bg-white transition-all" aria-label="Edit Team">
                            <EditIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleRemoveTeam(team.id)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg hover:bg-white transition-all" aria-label="Remove Team">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                ): null}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed border-slate-50 rounded-3xl">
            <p className="text-sm text-slate-400">No teams have been created.</p>
          </div>
        )}
      </section>

      {/* Insurance/Qualifications Management */}
      <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-xl font-serif text-slate-900 mb-6 flex items-center gap-2">
           <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
           Qualifications & Constraints
        </h3>
        <div className="mb-8 flex flex-col sm:flex-row gap-3">
          <div className="flex-grow">
            <label htmlFor="newIQ" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">New Credential or Payer Type</label>
            <input
              type="text"
              id="newIQ"
              value={newIQ}
              onChange={(e) => setNewIQ(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
              placeholder="e.g., MD_MEDICAID or RBT"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddIQ}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-full shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center space-x-2 text-sm"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Type</span>
            </button>
          </div>
        </div>

        {availableInsuranceQualifications.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-50 shadow-inner bg-slate-50/20">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50">
                  <th scope="col" className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                  <th scope="col" className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Hierarchy</th>
                  <th scope="col" className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff/Day Cap</th>
                  <th scope="col" className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Min/Max Session</th>
                  <th scope="col" className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Weekly Cap</th>
                  <th scope="col" className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest pr-6">Delete</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {availableInsuranceQualifications.map(iq => (
                  <tr key={iq.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">{iq.id}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <select
                        value={iq.roleHierarchyOrder ?? ''}
                        onChange={(e) => handleUpdateIQField(iq.id, 'roleHierarchyOrder', e.target.value === '' ? undefined : parseInt(e.target.value))}
                        className="text-xs bg-transparent border-none font-medium text-slate-600 focus:ring-0 cursor-pointer"
                      >
                        <option value="">Default</option>
                        <option value="0">BT (0)</option>
                        <option value="1">RBT (1)</option>
                        <option value="2">STAR 1 (2)</option>
                        <option value="3">STAR 2 (3)</option>
                        <option value="4">STAR 3 (4)</option>
                        <option value="5">CF (5)</option>
                        <option value="6">BCBA (6)</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        value={iq.maxTherapistsPerDay ?? ''}
                        onChange={(e) => handleUpdateIQField(iq.id, 'maxTherapistsPerDay', e.target.value)}
                        className="w-16 bg-transparent border-none text-xs font-bold text-slate-900 focus:ring-0"
                        placeholder="∞"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={iq.minSessionDurationMinutes ?? ''}
                          onChange={(e) => handleUpdateIQField(iq.id, 'minSessionDurationMinutes', e.target.value)}
                          className="w-12 bg-transparent border-none text-xs font-bold text-slate-900 focus:ring-0 p-0"
                          placeholder="0"
                        />
                        <span className="text-slate-300">/</span>
                        <input
                          type="number"
                          value={iq.maxSessionDurationMinutes ?? ''}
                          onChange={(e) => handleUpdateIQField(iq.id, 'maxSessionDurationMinutes', e.target.value)}
                          className="w-12 bg-transparent border-none text-xs font-bold text-slate-900 focus:ring-0 p-0"
                          placeholder="∞"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        value={iq.maxHoursPerWeek ?? ''}
                        onChange={(e) => handleUpdateIQField(iq.id, 'maxHoursPerWeek', e.target.value)}
                        className="w-16 bg-transparent border-none text-xs font-bold text-slate-900 focus:ring-0"
                        placeholder="∞"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right pr-6">
                      <button onClick={() => handleRemoveIQ(iq.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full" aria-label={`Remove ${iq.id}`}>
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed border-slate-50 rounded-3xl">
            <p className="text-sm text-slate-400">No qualifications defined.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default SettingsPanel;
