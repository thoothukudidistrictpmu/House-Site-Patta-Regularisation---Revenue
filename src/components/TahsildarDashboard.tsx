import React, { useState, useEffect } from 'react';
import { TahsildarDashboardData, UserAccount } from '../types.ts';
import { api } from '../services/api.ts';
import {
  Users,
  CheckCircle2,
  Clock,
  Percent,
  Home,
  FileCheck2,
  ArrowRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface TahsildarDashboardProps {
  currentUser: UserAccount;
  onOpenModule: (category: 'FREE_HOUSE_SITE' | 'PATTA_REGULARISATION') => void;
}

export const TahsildarDashboard: React.FC<TahsildarDashboardProps> = ({
  currentUser,
  onOpenModule
}) => {
  const [data, setData] = useState<TahsildarDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const taluk = currentUser.assigned_taluk;

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTahsildarDashboard(taluk);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load taluk dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [taluk]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 flex items-center justify-center space-x-2 text-xs">
        <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
        <span>Loading {taluk} Taluk verification records...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs m-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error || 'Error loading dashboard'}</span>
        </div>
        <button
          onClick={fetchData}
          className="px-2.5 py-1 bg-rose-600 text-white rounded font-medium text-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-6 space-y-6 max-w-6xl mx-auto font-sans">
      
      {/* Title bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            {data.taluk} Taluk Dashboard
          </h2>
          <p className="text-xs text-slate-500">
            Beneficiary verification and progress monitoring
          </p>
        </div>
        <button
          onClick={fetchData}
          title="Refresh"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-slate-200 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Total Beneficiaries */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Total Beneficiaries
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {data.totalBeneficiaries.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {data.taluk} Taluk Jurisdiction
          </span>
        </div>

        {/* Completed */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Completed
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700">
            {data.completedRecords.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Verified records
          </span>
        </div>

        {/* Pending */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Pending
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700">
            {data.pendingRecords.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Awaiting inquiry
          </span>
        </div>

        {/* Completion Percentage */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Completion Rate
            </span>
            <Percent className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-teal-800">
            {data.completionPercentage}%
          </p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-teal-600 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, data.completionPercentage)}%` }}
            ></div>
          </div>
        </div>

      </div>

      {/* Two Main Independent Modules */}
      <div className="space-y-3 pt-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Independent Verification Modules
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* MODULE 1: NEW FREE HOUSE SITE PATTA */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm mb-3">
                <Home className="w-4 h-4 text-teal-700" />
                <span>MODULE 1: NEW FREE HOUSE SITE PATTA</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs py-2 bg-slate-50 rounded-md border border-slate-100 px-3">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">Total</span>
                  <span className="font-bold text-slate-900 text-base">
                    {data.module1.totalRecords.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-700 text-[10px] uppercase font-semibold block">Completed</span>
                  <span className="font-bold text-emerald-700 text-base">
                    {data.module1.completed.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-amber-700 text-[10px] uppercase font-semibold block">Pending</span>
                  <span className="font-bold text-amber-700 text-base">
                    {data.module1.pending.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onOpenModule('FREE_HOUSE_SITE')}
              className="w-full py-2 px-3 bg-[#0F2744] hover:bg-[#153459] text-white rounded-md text-xs font-semibold transition flex items-center justify-center space-x-1.5 shadow-2xs"
            >
              <span>View Beneficiaries</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* MODULE 2: PATTA REGULARISATION */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm mb-3">
                <FileCheck2 className="w-4 h-4 text-indigo-700" />
                <span>MODULE 2: PATTA REGULARISATION</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs py-2 bg-slate-50 rounded-md border border-slate-100 px-3">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">Total</span>
                  <span className="font-bold text-slate-900 text-base">
                    {data.module2.totalRecords.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-700 text-[10px] uppercase font-semibold block">Completed</span>
                  <span className="font-bold text-emerald-700 text-base">
                    {data.module2.completed.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-amber-700 text-[10px] uppercase font-semibold block">Pending</span>
                  <span className="font-bold text-amber-700 text-base">
                    {data.module2.pending.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onOpenModule('PATTA_REGULARISATION')}
              className="w-full py-2 px-3 bg-[#0F2744] hover:bg-[#153459] text-white rounded-md text-xs font-semibold transition flex items-center justify-center space-x-1.5 shadow-2xs"
            >
              <span>View Beneficiaries</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};
