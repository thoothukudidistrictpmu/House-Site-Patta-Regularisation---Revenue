import React, { useState } from 'react';
import { Lock, User, KeyRound, AlertCircle, HelpCircle, X, ShieldAlert } from 'lucide-react';

interface LoginPageProps {
  onLogin: (credentials: { username: string; password: string }) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  isLoading,
  error
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    await onLogin({ username: username.trim(), password });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col justify-between font-sans">
      
      {/* Top Official Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 shadow-2xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-[#0F2744] text-white flex items-center justify-center font-bold text-xs tracking-wider">
              TN
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Government of Tamil Nadu
              </p>
              <h1 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                Thoothukudi District Administration &bull; Revenue Administration
              </h1>
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 hidden sm:inline">
            Official Portal
          </span>
        </div>
      </header>

      {/* Main Form Centerpiece */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-12 flex flex-col justify-center">
        <div className="bg-white p-7 sm:p-8 rounded-xl border border-slate-200 shadow-xs">
          
          {/* Official Emblem / Header */}
          <div className="text-center mb-6 pb-5 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Thoothukudi District Administration
            </h2>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              House Site Patta & Patta Regularisation Portal
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Secure Administrative Sign-In
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] text-teal-700 hover:text-teal-900 font-medium transition"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim()}
              className="w-full py-2.5 px-4 bg-[#0F2744] hover:bg-[#153459] text-white font-semibold text-xs rounded-lg transition shadow-2xs disabled:opacity-50 flex items-center justify-center space-x-2 mt-3 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Authenticating...' : 'Sign In'}</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              Authorized access restricted to District Collectorate and Taluk Tahsildars.
            </p>
          </div>

        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-sm w-full p-5 text-xs text-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                <HelpCircle className="w-4 h-4 text-teal-700" />
                <span>Password Assistance</span>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-slate-600 text-xs leading-relaxed">
              <div className="flex items-start space-x-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px]">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  For security compliance, administrative password resets must be issued by the District Collectorate.
                </span>
              </div>
              <p>
                <strong>Tahsildar Accounts:</strong> Contact the District Project Management Unit (PMU) or District Collector/Admin to reset your credentials via the administrative console.
              </p>
              <p>
                <strong>District Admin:</strong> Please consult the District Collectorate IT System Administrator.
              </p>
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="px-3 py-1.5 bg-[#0F2744] hover:bg-[#153459] text-white rounded text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-3 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px]">
          <span>District Project Management Unit (PMU) &bull; Thoothukudi District</span>
          <span>House Site Patta &amp; Patta Regularisation Monitoring Portal</span>
        </div>
      </footer>

    </div>
  );
};
