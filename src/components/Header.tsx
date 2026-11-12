import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types.ts';
import { LogOut, Search, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { getGoogleAccessToken, googleSignIn, getGoogleUser, initGoogleAuth } from '../services/googleAuth.ts';

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

  const [googleToken, setGoogleToken] = useState<string | null>(getGoogleAccessToken());
  const [googleUser, setGoogleUser] = useState(getGoogleUser());
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleToken(null);
        setGoogleUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      const { user, accessToken } = await googleSignIn();
      setGoogleUser(user);
      setGoogleToken(accessToken);
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs h-13 px-4 sm:px-6 flex items-center justify-between">
      
      {/* Left: Format: Taluk Name | Tahsildar */}
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

      {/* Right: Google Sheets Status + Logout */}
      <div className="flex items-center space-x-3">
        {googleToken ? (
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200 text-[11px] font-medium" title={googleUser?.email || 'Google Sheets OAuth Active'}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sheets Connected</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConnectGoogle}
            disabled={isConnecting}
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-[11px] font-medium text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
            title="Connect Google account for live Google Sheets synchronization"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700" />
            <span>{isConnecting ? 'Connecting...' : 'Connect Sheets'}</span>
          </button>
        )}

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
