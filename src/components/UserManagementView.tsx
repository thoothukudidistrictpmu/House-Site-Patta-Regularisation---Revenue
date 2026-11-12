import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types.ts';
import { api } from '../services/api.ts';
import {
  Users2,
  KeyRound,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';

interface UserManagementViewProps {
  currentUser: UserAccount;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Password Reset Modal State
  const [resetModalUser, setResetModalUser] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getUsers();
      setUsers(res.users);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !newPassword) return;

    setIsResetting(true);
    setResetError(null);
    try {
      await api.resetPassword(resetModalUser.user_id, newPassword);
      setNotification(`Password for ${resetModalUser.username} (${resetModalUser.assigned_taluk}) has been securely reset.`);
      setResetModalUser(null);
      setNewPassword('');
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    const nextStatus = user.active_status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.updateUserStatus(user.user_id, nextStatus);
      setNotification(`Status for ${user.username} updated to ${nextStatus}.`);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="p-5 sm:p-6 space-y-5 max-w-6xl mx-auto font-sans">
      
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            User Management & Authentication Registry
          </h2>
          <p className="text-xs text-slate-500">
            11 Individual User Accounts (10 Tahsildars + 1 District Admin)
          </p>
        </div>
        <button
          onClick={fetchUsers}
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-slate-200 transition"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0F2744] text-white uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="py-2.5 px-3">User ID</th>
                <th className="py-2.5 px-3">Username</th>
                <th className="py-2.5 px-3">Designation</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Assigned Taluk</th>
                <th className="py-2.5 px-3 text-center">Active Status</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto text-teal-700 mb-1" />
                    <span>Loading user accounts...</span>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isDistrictAdmin = u.role === 'District Admin';
                  return (
                    <tr key={u.user_id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 text-[11px]">
                        {u.user_id}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-800">
                        {u.username}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {u.designation}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          isDistrictAdmin ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {u.assigned_taluk}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          u.active_status === 'Active'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {u.active_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => {
                              setResetModalUser(u);
                              setNewPassword('');
                              setResetError(null);
                            }}
                            className="px-2 py-0.5 text-[11px] font-medium text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 transition"
                          >
                            Reset Password
                          </button>
                          {!isDistrictAdmin && (
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className="px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition"
                            >
                              {u.active_status === 'Active' ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password Reset Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-sm w-full p-5 text-xs text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                <KeyRound className="w-4 h-4 text-teal-700" />
                <span>Reset Password &bull; {resetModalUser.username}</span>
              </div>
              <button
                onClick={() => setResetModalUser(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Account: <strong className="text-slate-800">{resetModalUser.user_id}</strong> &bull; Assigned: <strong className="text-slate-800">{resetModalUser.assigned_taluk}</strong>
            </p>

            {resetError && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-[11px]">
                {resetError}
              </div>
            )}

            <form onSubmit={handlePasswordResetSubmit} className="space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Enter New Password (min. 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New secure password"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-3 py-1.5 bg-[#0F2744] hover:bg-[#153459] text-white rounded font-medium disabled:opacity-50"
                >
                  {isResetting ? 'Saving...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
