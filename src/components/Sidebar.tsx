import React from 'react';
import { UserAccount } from '../types.ts';
import {
  LayoutDashboard,
  Home,
  FileCheck2,
  BarChart2,
  Users2,
  Database,
  LogOut
} from 'lucide-react';

export type ActiveNav =
  | 'dashboard'
  | 'new-house-site'
  | 'patta-reg'
  | 'taluk-progress'
  | 'user-mgmt'
  | 'data-import';

interface SidebarProps {
  currentUser: UserAccount;
  activeNav: ActiveNav;
  onSelectNav: (nav: ActiveNav) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeNav,
  onSelectNav,
  onLogout
}) => {
  const isDM = currentUser.role === 'District Admin' || currentUser.assigned_taluk === 'All Taluks';

  const tahsildarNav = [
    { id: 'dashboard' as ActiveNav, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new-house-site' as ActiveNav, label: 'New House Site Patta', icon: Home },
    { id: 'patta-reg' as ActiveNav, label: 'Patta Regularisation', icon: FileCheck2 },
  ];

  const collectorNav = [
    { id: 'dashboard' as ActiveNav, label: 'District Dashboard', icon: LayoutDashboard },
    { id: 'taluk-progress' as ActiveNav, label: 'Taluk-wise Progress', icon: BarChart2 },
    { id: 'new-house-site' as ActiveNav, label: 'New House Site Patta', icon: Home },
    { id: 'patta-reg' as ActiveNav, label: 'Patta Regularisation', icon: FileCheck2 },
    { id: 'data-import' as ActiveNav, label: 'Data Import & Audit', icon: Database },
    { id: 'user-mgmt' as ActiveNav, label: 'User Management', icon: Users2 },
  ];

  const navItems = isDM ? collectorNav : tahsildarNav;

  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex flex-col justify-between flex-shrink-0 min-h-[calc(100vh-3.25rem)] text-xs font-sans">
      
      {/* Top Nav Items */}
      <div className="p-3 space-y-1">
        <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectNav(item.id)}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md font-medium transition text-left cursor-pointer ${
                isActive
                  ? 'bg-slate-100 text-[#0F2744] font-semibold border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#0F2744]' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom Logout */}
      <div className="p-3 border-t border-slate-100 space-y-1">
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-md font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700 transition text-left cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-slate-400" />
          <span>Logout</span>
        </button>

        <div className="px-3 pt-2 text-[10px] text-slate-400">
          {currentUser.assigned_taluk} &bull; {currentUser.username}
        </div>
      </div>

    </aside>
  );
};
