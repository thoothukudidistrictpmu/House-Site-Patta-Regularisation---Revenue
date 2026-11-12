import React from 'react';
import { UserAccount } from '../types.ts';
import { LogOut, Search, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  currentUser: UserAccount;
  onLogout: () => void;
  activeSearchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  activeSearchQuery = '',
  onSearchChange
}) => {
  const isDM = currentUser.role === 'District Admin' || currentUser.assigned_taluk === 'All Taluks';
  const locationLabel = isDM ? 'Thoothukudi District' : currentUser.assigned_taluk;
  const roleLabel = isDM ? 'Collector / DM' : 'Tahsildar';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs h-13 px-4 sm:px-6 flex items-center justify-between">
      
      {/* Left: Format: Taluk Name | Tahsildar | Username */}
      <div className="flex items-center space-x-2 text-xs">
        <span className="font-bold text-slate-900 text-sm tracking-tight">
          {locationLabel}
        </span>
        <span className="text-slate-300 font-normal">|</span>
        <span className="font-semibold text-slate-600">
          {roleLabel}
        </span>
        <span className="text-slate-300 font-normal hidden md:inline">|</span>
        <span className="text-slate-400 font-mono text-[11px] hidden md:inline">
          {currentUser.username}
        </span>
      </div>

      {/* Center: Search */}
      <div className="hidden sm:flex items-center max-w-xs w-full mx-4">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search beneficiary by name, ID, phone..."
            value={activeSearchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 transition"
          />
        </div>
      </div>

      {/* Right: Primary Storage Indicator + Logout */}
      <div className="flex items-center space-x-3">
        <div
          className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200 text-[11px] font-medium"
          title="Google Spreadsheet (ID: 1wcvgGj_Y6__RpUSDjv5J3D0OWVPiplZLdN0BZ6KPvfw) is the primary centralized database"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
          <span className="flex items-center space-x-1">
            <span>Primary DB:</span>
            <span className="font-semibold text-emerald-900">Google Sheets (GAS Backend)</span>
          </span>
          <CheckCircle2 className="w-3 h-3 text-emerald-600 ml-0.5" />
        </div>

        <button
          onClick={onLogout}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition font-medium border border-transparent hover:border-slate-200 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-slate-500" />
          <span>Logout</span>
        </button>
      </div>

    </header>
  );
};
