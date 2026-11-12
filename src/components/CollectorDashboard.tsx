import React, { useState, useEffect } from 'react';
import { CollectorDashboardData, TalukProgressItem } from '../types.ts';
import { api } from '../services/api.ts';
import {
  Home,
  FileCheck2,
  CheckCircle2,
  Clock,
  Award,
  XCircle,
  ShieldCheck,
  Hourglass,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  X
} from 'lucide-react';

interface CollectorDashboardProps {
  onSelectTaluk?: (taluk: string, category?: 'FREE_HOUSE_SITE' | 'PATTA_REGULARISATION') => void;
}

export const CollectorDashboard: React.FC<CollectorDashboardProps> = ({
  onSelectTaluk
}) => {
  const [data, setData] = useState<CollectorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected taluk for inspecting detailed category progress
  const [inspectTaluk, setInspectTaluk] = useState<TalukProgressItem | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCollectorDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load district dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 flex items-center justify-center space-x-2 text-xs">
        <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
        <span>Loading consolidated district records...</span>
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
      
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            District Collector / DM Dashboard
          </h2>
          <p className="text-xs text-slate-500">
            Consolidated progress monitoring across all 10 Taluks
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

      {/* 8 Required KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        
        {/* 1. Total New Free House Site Patta */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              New House Site Patta
            </span>
            <Home className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <p className="text-xl font-bold text-slate-900">
            {data.totalNewHouseSite.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            GDP petitions
          </span>
        </div>

        {/* 2. Total Patta Regularisation */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Patta Regularisation
            </span>
            <FileCheck2 className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <p className="text-xl font-bold text-slate-900">
            {data.totalPattaRegularisation.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Occupancy petitions
          </span>
        </div>

        {/* 3. Total Completed */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Total Completed
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-emerald-700">
            {data.totalCompleted.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Questionnaires finalized
          </span>
        </div>

        {/* 4. Total Pending */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Total Pending
            </span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-xl font-bold text-amber-700">
            {data.totalPending.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Pending field enquiry
          </span>
        </div>

        {/* 5. Patta Issued */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Patta Issued
            </span>
            <Award className="w-3.5 h-3.5 text-teal-700" />
          </div>
          <p className="text-xl font-bold text-teal-800">
            {data.pattaIssued.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Orders granted
          </span>
        </div>

        {/* 6. Patta Not Issued */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Patta Not Issued
            </span>
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <p className="text-xl font-bold text-rose-700">
            {data.pattaNotIssued.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Ineligible / rejected
          </span>
        </div>

        {/* 7. Seniority Verified */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Seniority Verified
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-blue-800">
            {data.seniorityVerified.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Register matched
          </span>
        </div>

        {/* 8. Seniority Pending */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Seniority Pending
            </span>
            <Hourglass className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <p className="text-xl font-bold text-slate-800">
            {data.seniorityPending.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Awaiting index match
          </span>
        </div>

      </div>

      {/* Selected Taluk Detail Drawer/Card if clicked */}
      {inspectTaluk && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Category-wise Progress &bull; {inspectTaluk.taluk} Taluk
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                ({inspectTaluk.totalBeneficiaries.toLocaleString()} Petitions)
              </span>
            </div>
            <button
              onClick={() => setInspectTaluk(null)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* New House Site Patta */}
            <div className="bg-white p-3 rounded-md border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">New Free House Site Patta</span>
                <button
                  onClick={() => onSelectTaluk?.(inspectTaluk.taluk, 'FREE_HOUSE_SITE')}
                  className="text-teal-700 hover:underline font-medium text-[11px]"
                >
                  View Records &rarr;
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center py-1 bg-slate-50 rounded">
                <div>
                  <span className="text-[10px] text-slate-400 block">Total</span>
                  <span className="font-bold text-slate-800">{inspectTaluk.newHouseSite.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 block">Completed</span>
                  <span className="font-bold text-emerald-700">{inspectTaluk.newHouseSiteCompleted.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-600 block">Pending</span>
                  <span className="font-bold text-amber-700">{inspectTaluk.newHouseSitePending.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Patta Regularisation */}
            <div className="bg-white p-3 rounded-md border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Patta Regularisation</span>
                <button
                  onClick={() => onSelectTaluk?.(inspectTaluk.taluk, 'PATTA_REGULARISATION')}
                  className="text-indigo-700 hover:underline font-medium text-[11px]"
                >
                  View Records &rarr;
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center py-1 bg-slate-50 rounded">
                <div>
                  <span className="text-[10px] text-slate-400 block">Total</span>
                  <span className="font-bold text-slate-800">{inspectTaluk.pattaRegularisation.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 block">Completed</span>
                  <span className="font-bold text-emerald-700">{inspectTaluk.pattaRegularisationCompleted.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-600 block">Pending</span>
                  <span className="font-bold text-amber-700">{inspectTaluk.pattaRegularisationPending.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compact Taluk-Wise Progress Table covering all 10 taluks */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            Taluk-Wise Progress (10 Taluks)
          </span>
          <span className="text-slate-400 text-[11px]">
            Click any row to inspect category-wise breakdown
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0F2744] text-white uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Taluk</th>
                <th className="py-2.5 px-3 text-right">Total Petitions</th>
                <th className="py-2.5 px-3 text-right">House Site</th>
                <th className="py-2.5 px-3 text-right">Regularisation</th>
                <th className="py-2.5 px-3 text-right">Completed</th>
                <th className="py-2.5 px-3 text-right">Pending</th>
                <th className="py-2.5 px-3 text-right">Patta Issued</th>
                <th className="py-2.5 px-3 text-right">Patta Not Issued</th>
                <th className="py-2.5 px-3 text-center">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {data.talukProgress.map((t) => {
                const isSelected = inspectTaluk?.taluk === t.taluk;
                return (
                  <tr
                    key={t.taluk}
                    onClick={() => setInspectTaluk(isSelected ? null : t)}
                    className={`hover:bg-slate-50 cursor-pointer transition ${
                      isSelected ? 'bg-teal-50/60 font-medium' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-semibold text-slate-900 flex items-center space-x-1.5">
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSelected ? 'rotate-90 text-teal-700' : ''}`} />
                      <span>{t.taluk}</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                      {t.totalBeneficiaries.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">
                      {t.newHouseSite.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">
                      {t.pattaRegularisation.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700">
                      {t.completed.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-amber-700">
                      {t.pending.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-teal-800 font-semibold">
                      {t.pattaIssued.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-rose-700">
                      {t.pattaNotIssued.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="font-mono text-[11px] text-slate-600 font-medium">
                        {t.completionPercentage}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
              <tr>
                <td className="py-2 px-3">District Total</td>
                <td className="py-2 px-3 text-right font-mono">
                  {data.totalDistrictBeneficiaries.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right font-mono">
                  {data.totalNewHouseSite.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right font-mono">
                  {data.totalPattaRegularisation.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right font-mono text-emerald-700">
                  {data.totalCompleted.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right font-mono text-amber-700">
                  {data.totalPending.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right font-mono text-teal-800">
                  {data.pattaIssued.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right font-mono text-rose-700">
                  {data.pattaNotIssued.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-center font-mono">
                  {data.totalDistrictBeneficiaries > 0
                    ? Number(((data.totalCompleted / data.totalDistrictBeneficiaries) * 100).toFixed(2)) + '%'
                    : '0%'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
};
