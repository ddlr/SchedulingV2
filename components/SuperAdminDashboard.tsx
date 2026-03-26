import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { organizationService } from '../services/organizationService';
import { Organization } from '../types';
import { User } from '../services/authService';
import { SparklesIcon } from './icons/SparklesIcon';
import { PlusIcon } from './icons/PlusIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { EditIcon } from './icons/EditIcon';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { emailSignupService, EmailSignup } from '../services/emailSignupService';
import { demoRequestService, DemoRequest } from '../services/demoRequestService';

interface OrgWithUsers extends Organization {
  userCount?: number;
  users?: User[];
}

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [organizations, setOrganizations] = useState<OrgWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<OrgWithUsers | null>(null);
  const [orgUsers, setOrgUsers] = useState<User[]>([]);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [emailSignups, setEmailSignups] = useState<EmailSignup[]>([]);
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);

  const [orgFormData, setOrgFormData] = useState({ name: '', slug: '' });
  const [adminFormData, setAdminFormData] = useState({ email: '', password: '', full_name: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    const orgs = await organizationService.getAll();
    const orgsWithCounts: OrgWithUsers[] = await Promise.all(
      orgs.map(async (org) => {
        const count = await organizationService.getOrgUserCount(org.id);
        return { ...org, userCount: count };
      })
    );
    setOrganizations(orgsWithCounts);
    setLoading(false);
  }, []);

  const loadSignupsAndRequests = useCallback(async () => {
    const [signups, requests] = await Promise.all([
      emailSignupService.getAllSignups(),
      demoRequestService.getAllRequests(),
    ]);
    setEmailSignups(signups);
    setDemoRequests(requests);
  }, []);

  useEffect(() => {
    loadOrganizations();
    loadSignupsAndRequests();
  }, [loadOrganizations, loadSignupsAndRequests]);

  const handleSelectOrg = async (org: OrgWithUsers) => {
    setSelectedOrg(org);
    const users = await organizationService.getOrgUsers(org.id);
    setOrgUsers(users);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const result = await organizationService.create(orgFormData.name, orgFormData.slug);
      if (result.success) {
        setShowCreateOrgModal(false);
        setOrgFormData({ name: '', slug: '' });
        await loadOrganizations();
      } else {
        setFormError(result.error || 'Failed to create organization');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    setFormError(null);
    setSubmitting(true);

    try {
      const result = await organizationService.createOrgAdmin(
        selectedOrg.id,
        adminFormData.email,
        adminFormData.password,
        adminFormData.full_name
      );
      if (result.success) {
        setShowAddAdminModal(false);
        setAdminFormData({ email: '', password: '', full_name: '' });
        const users = await organizationService.getOrgUsers(selectedOrg.id);
        setOrgUsers(users);
        await loadOrganizations();
      } else {
        setFormError(result.error || 'Failed to create admin');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleOrgStatus = async (org: OrgWithUsers) => {
    if (org.is_active) {
      if (!window.confirm(`Deactivate "${org.name}"? Users in this organization will not be able to access the app.`)) return;
      await organizationService.deactivate(org.id);
    } else {
      await organizationService.activate(org.id);
    }
    await loadOrganizations();
    if (selectedOrg?.id === org.id) {
      setSelectedOrg({ ...org, is_active: !org.is_active });
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out?')) {
      await logout();
      navigate('/');
    }
  };

  const autoSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const handleUpdateDemoStatus = async (id: string, status: DemoRequest['status']) => {
    const result = await demoRequestService.updateRequestStatus(id, status);
    if (result.success) {
      await loadSignupsAndRequests();
    } else {
      alert(result.error || 'Failed to update status');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'contacted':
        return 'bg-blue-500/20 text-blue-400';
      case 'approved':
        return 'bg-green-500/20 text-green-400';
      case 'rejected':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-500/20 text-purple-400';
      case 'staff':
        return 'bg-blue-500/20 text-blue-400';
      case 'viewer':
        return 'bg-slate-500/20 text-slate-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <SparklesIcon className="w-8 h-8 text-blue-400" />
              <span className="text-xl font-bold text-white">Ordus ABA</span>
              <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
                Super Admin
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">
                {user?.full_name} ({user?.email})
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Organization Management</h1>
            <p className="text-slate-400 mt-1">Create and manage organizations and their administrators</p>
          </div>
          <button
            onClick={() => {
              setFormError(null);
              setOrgFormData({ name: '', slug: '' });
              setShowCreateOrgModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New Organization
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Organization List */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white">Organizations</h2>
              </div>
              {loading ? (
                <div className="p-8 text-center text-slate-400">Loading...</div>
              ) : organizations.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No organizations yet</div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => handleSelectOrg(org)}
                      className={`w-full text-left p-4 hover:bg-slate-700/50 transition-colors ${
                        selectedOrg?.id === org.id ? 'bg-slate-700/50 border-l-2 border-blue-400' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-white">{org.name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{org.slug}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            org.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {org.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                        <UserGroupIcon className="w-3 h-3" />
                        {org.userCount || 0} users
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Organization Detail */}
          <div className="lg:col-span-2">
            {selectedOrg ? (
              <div className="space-y-6">
                {/* Org Info Card */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold text-white">{selectedOrg.name}</h2>
                      <p className="text-sm text-slate-400 mt-1">Slug: {selectedOrg.slug}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Created: {selectedOrg.created_at ? new Date(selectedOrg.created_at).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleOrgStatus(selectedOrg)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        selectedOrg.is_active
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      {selectedOrg.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>

                {/* Users List */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="flex justify-between items-center p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white">Users</h3>
                    <button
                      onClick={() => {
                        setFormError(null);
                        setAdminFormData({ email: '', password: '', full_name: '' });
                        setShowAddAdminModal(true);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <PlusIcon className="w-3 h-3" />
                      Add Admin
                    </button>
                  </div>
                  {orgUsers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      No users in this organization. Add an admin to get started.
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-slate-700/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {orgUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-700/30">
                            <td className="px-4 py-3 text-sm text-white">{u.full_name}</td>
                            <td className="px-4 py-3 text-sm text-slate-300">{u.email}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getRoleBadgeColor(u.role)}`}>
                                {u.role}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
                <UserGroupIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-400">Select an organization</h3>
                <p className="text-sm text-slate-500 mt-1">Choose an organization from the list to view details and manage users</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email Signups Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Email Signups</h2>
          </div>
          {emailSignups.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No email signups yet</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Subscribed</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {emailSignups.map((signup) => (
                  <tr key={signup.id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-sm text-white">{signup.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{signup.signup_source}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        signup.subscribed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {signup.subscribed ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(signup.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Demo Requests Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Demo Requests</h2>
          </div>
          {demoRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No demo requests yet</div>
          ) : (
            <div className="divide-y divide-slate-700">
              {demoRequests.map((request) => (
                <div key={request.id} className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-white">{request.company_name}</h4>
                      <p className="text-sm text-slate-300">{request.contact_name}</p>
                      <p className="text-sm text-slate-400">{request.email}</p>
                      {request.phone && <p className="text-sm text-slate-400">{request.phone}</p>}
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(request.status)}`}>
                      {request.status}
                    </span>
                  </div>
                  {request.message && (
                    <p className="text-sm text-slate-300 mb-3 italic">"{request.message}"</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateDemoStatus(request.id, 'contacted')}
                      className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                    >
                      Mark Contacted
                    </button>
                    <button
                      onClick={() => handleUpdateDemoStatus(request.id, 'approved')}
                      className="px-3 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleUpdateDemoStatus(request.id, 'rejected')}
                      className="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                    >
                      Reject
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Submitted: {new Date(request.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Organization Modal */}
      {showCreateOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <h3 className="text-xl font-bold text-white">Create Organization</h3>
              <button onClick={() => setShowCreateOrgModal(false)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <XMarkIcon className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateOrg} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Organization Name</label>
                <input
                  type="text"
                  value={orgFormData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setOrgFormData({ name, slug: autoSlug(name) });
                  }}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Sunshine ABA Clinic"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Slug</label>
                <input
                  type="text"
                  value={orgFormData.slug}
                  onChange={(e) => setOrgFormData({ ...orgFormData, slug: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="sunshine-aba-clinic"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">URL-friendly identifier (auto-generated from name)</p>
              </div>
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-sm text-red-400">
                  {formError}
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateOrgModal(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {showAddAdminModal && selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <div>
                <h3 className="text-xl font-bold text-white">Add Admin</h3>
                <p className="text-sm text-slate-400">{selectedOrg.name}</p>
              </div>
              <button onClick={() => setShowAddAdminModal(false)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <XMarkIcon className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddAdmin} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                <input
                  type="text"
                  value={adminFormData.full_name}
                  onChange={(e) => setAdminFormData({ ...adminFormData, full_name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={adminFormData.email}
                  onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <input
                  type="password"
                  value={adminFormData.password}
                  onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-sm text-red-400">
                  {formError}
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
