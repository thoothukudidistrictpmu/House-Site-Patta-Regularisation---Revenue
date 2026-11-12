import React, { useState, useEffect } from 'react';
import { CollectorDashboardData } from '../types.ts';
import { api } from '../services/api.ts';
import { RefreshCw, AlertCircle, ArrowUpRight, BarChart2 } from 'lucide-react';

interface TalukWiseProgressViewProps {
  onOpenTalukRegister: (taluk: string, category: 'FREE_HOUSE_SITE' | 'PATTA_REGULARISATION') => void;
}

export const TalukWiseProgressView: React.FC<TalukWiseProgressViewProps> = ({
  onOpenTalukRegister
}) => {
  const [data, setData] = useState<CollectorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCollectorDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load progress data');
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
        <span>Loading 10-Taluk comparative progress...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs m-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error || 'Error loading taluk progress'}</span>
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
            Taluk-Wise Progress Monitoring (10 Taluks)
          </h2>
          <p className="text-xs text-slate-500">
            Comparative progress across New House Site Patta and Patta Regularisation
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-slate-200 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress Cards for all 10 Taluks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.talukProgress.map((t) => (
          <div key={t.taluk} className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <span className="text-sm font-bold text-slate-900">{t.taluk} Taluk</span>
                <span className="text-xs font-mono text-slate-500 ml-2">
                  Total: {t.totalBeneficiaries.toLocaleString()}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 font-mono">
                {t.completionPercentage}% Done
              </span>
            </div>

            {/* Scheme 1: Free House Site */}
            <div className="flex items-center justify-between text-xs py-1 px-2.5 bg-slate-50 rounded border border-slate-100">
              <div>
                <span className="font-semibold text-slate-800 block">New Free House Site</span>
                <span className="text-[10px] text-slate-500">
                  Total: {t.newHouseSite.toLocaleString()} &bull; Completed: {t.newHouseSiteCompleted} &bull; Pending: {t.newHouseSitePending}
                </span>
              </div>
              <button
                onClick={() => onOpenTalukRegister(t.taluk, 'FREE_HOUSE_SITE')}
                className="text-teal-700 hover:text-teal-900 font-semibold text-[11px] flex items-center space-x-0.5"
              >
                <span>Records</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scheme 2: Regularisation */}
            <div className="flex items-center justify-between text-xs py-1 px-2.5 bg-slate-50 rounded border border-slate-100">
              <div>
                <span className="font-semibold text-slate-800 block">Patta Regularisation</span>
                <span className="text-[10px] text-slate-500">
                  Total: {t.pattaRegularisation.toLocaleString()} &bull; Completed: {t.pattaRegularisationCompleted} &bull; Pending: {t.pattaRegularisationPending}
                </span>
              </div>
              <button
                onClick={() => onOpenTalukRegister(t.taluk, 'PATTA_REGULARISATION')}
                className="text-indigo-700 hover:text-indigo-900 font-semibold text-[11px] flex items-center space-x-0.5"
              >
                <span>Records</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Summary badges */}
            <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
              <span>Patta Issued: <strong className="text-teal-800">{t.pattaIssued}</strong></span>
              <span>Not Issued: <strong className="text-rose-700">{t.pattaNotIssued}</strong></span>
              <span>Total Pending: <strong className="text-amber-700">{t.pending.toLocaleString()}</strong></span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
