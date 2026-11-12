import React, { useState, useEffect } from 'react';
import { Beneficiary, PaginationMeta, UserAccount } from '../types.ts';
import { api } from '../services/api.ts';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  X,
  FileCheck2,
  Home
} from 'lucide-react';

interface BeneficiaryManagementProps {
  currentUser: UserAccount;
  category: 'FREE_HOUSE_SITE' | 'PATTA_REGULARISATION';
  talukFilter?: string;
  searchQuery?: string;
  onSelectBeneficiary: (beneficiaryId: string) => void;
}

export const BeneficiaryManagement: React.FC<BeneficiaryManagementProps> = ({
  currentUser,
  category,
  talukFilter = 'ALL',
  searchQuery = '',
  onSelectBeneficiary
}) => {
  const isDM = currentUser.role === 'District Admin' || currentUser.assigned_taluk === 'All Taluks';
  const effectiveTaluk = isDM ? talukFilter : currentUser.assigned_taluk;

  const [taluk, setTaluk] = useState<string>(effectiveTaluk);
  const [search, setSearch] = useState<string>(searchQuery);
  const [status, setStatus] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    totalCount: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [taluksList, setTaluksList] = useState<string[]>([]);

  useEffect(() => {
    if (isDM) {
      api.getTaluksMeta().then(res => setTaluksList(res.taluks)).catch(console.error);
    }
  }, [isDM]);

  useEffect(() => {
    setTaluk(effectiveTaluk);
  }, [effectiveTaluk]);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBeneficiaries({
        page,
        limit,
        taluk: isDM ? taluk : currentUser.assigned_taluk,
        category, // Strictly isolated per module
        status,
        search
      });
      setBeneficiaries(res.beneficiaries);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch beneficiary records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [page, limit, taluk, status, category]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRecords();
  };

  const moduleTitle = category === 'FREE_HOUSE_SITE'
    ? 'New Free House Site Patta Register'
    : 'Patta Regularisation Register';

  const ModuleIcon = category === 'FREE_HOUSE_SITE' ? Home : FileCheck2;

  return (
    <div className="p-5 sm:p-6 space-y-4 max-w-6xl mx-auto font-sans">
      
      {/* Module Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <div className="flex items-center space-x-2 text-slate-800">
            <ModuleIcon className="w-4 h-4 text-teal-700" />
            <h2 className="text-base font-bold tracking-tight">
              {moduleTitle}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Jurisdiction: <span className="font-semibold text-slate-700">{isDM ? (taluk === 'ALL' ? 'All 10 Taluks' : `${taluk} Taluk`) : `${currentUser.assigned_taluk} Taluk`}</span> &bull; Category: <span className="font-semibold text-slate-700">{category === 'FREE_HOUSE_SITE' ? 'Free House Site' : 'Regularisation'}</span>
          </p>
        </div>

        <button
          onClick={fetchRecords}
          className="self-start sm:self-auto p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-slate-200 transition"
          title="Refresh table"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Name, Beneficiary ID, Phone, S.No, Address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-[#0F2744] hover:bg-[#153459] text-white text-xs font-semibold rounded-md transition shadow-2xs"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setPage(1); }}
              className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-xs"
            >
              Clear
            </button>
          )}
        </form>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs pt-1 border-t border-slate-100">
          
          {/* Taluk Filter (only editable by DM; locked for Tahsildar) */}
          {isDM ? (
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Taluk:</span>
              <select
                value={taluk}
                onChange={(e) => { setTaluk(e.target.value); setPage(1); }}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="ALL">All 10 Taluks</option>
                {taluksList.map(t => (
                  <option key={t} value={t}>{t} Taluk</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 font-medium">
              Taluk: <strong className="text-slate-800">{currentUser.assigned_taluk}</strong>
            </div>
          )}

          {/* Verification Status */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Status:</span>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Patta Issued">Patta Issued</option>
              <option value="Patta Not Issued">Patta Not Issued</option>
            </select>
          </div>

          <div className="ml-auto text-[11px] text-slate-500">
            Total Matching: <strong className="text-slate-800 font-mono">{pagination.totalCount.toLocaleString()}</strong>
          </div>

        </div>
      </div>

      {/* Clean Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        
        {/* Table status header */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{pagination.totalCount > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}</strong> - <strong className="text-slate-800">{Math.min(pagination.page * pagination.limit, pagination.totalCount)}</strong> of <strong className="text-slate-800">{pagination.totalCount.toLocaleString()}</strong>
          </div>

          <div className="flex items-center space-x-1.5">
            <span>Rows:</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}
              className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-700"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0F2744] text-white uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">S.No</th>
                <th className="py-2.5 px-3">Beneficiary ID</th>
                <th className="py-2.5 px-3">Beneficiary Name</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Taluk</th>
                <th className="py-2.5 px-3">Revenue Village</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-700 mb-1" />
                    <span>Loading records...</span>
                  </td>
                </tr>
              ) : beneficiaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <AlertTriangle className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                    <p className="font-medium text-slate-700">No records found</p>
                    <p className="text-[11px] text-slate-400">Try modifying search or filters</p>
                  </td>
                </tr>
              ) : (
                beneficiaries.map((b) => {
                  const hasMissingVillage = !b.revenue_village || b.revenue_village.trim().length === 0;
                  const displayStatus = b.patta_issued === 1
                    ? 'Patta Issued'
                    : (b.verification_status === 'Completed' && b.patta_issued === 0)
                      ? 'Patta Not Issued'
                      : (b.verification_status || b.status || 'Pending');

                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-50 transition cursor-pointer"
                      onClick={() => onSelectBeneficiary(b.id)}
                    >
                      {/* Preserved Original S.No */}
                      <td className="py-2 px-3 text-center font-mono text-slate-500 text-[11px]">
                        {b.source_sno ?? b.s_no}
                      </td>

                      {/* Unique Generated Beneficiary ID */}
                      <td className="py-2 px-3 font-mono font-semibold text-slate-900 text-[11px]">
                        {b.id}
                      </td>

                      {/* Beneficiary Name & Address */}
                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-900 block">{b.beneficiary_name}</span>
                        {b.address && b.address !== '.' && b.address !== '..' && b.address !== '...' && (
                          <span className="text-[10px] text-slate-400 truncate max-w-xs block">
                            {b.address}
                          </span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">
                        {b.phone && b.phone !== '.' ? b.phone : <span className="text-slate-300">&mdash;</span>}
                      </td>

                      {/* Taluk */}
                      <td className="py-2 px-3 font-medium text-slate-800">
                        {b.taluk}
                      </td>

                      {/* Revenue Village */}
                      <td className="py-2 px-3">
                        {hasMissingVillage ? (
                          <span className="text-amber-700 text-[10px] font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Village Missing
                          </span>
                        ) : (
                          <span className="text-slate-800 font-medium">
                            {b.revenue_village}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                          displayStatus === 'Patta Issued' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                          displayStatus === 'Patta Not Issued' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                          displayStatus === 'Completed' ? 'bg-teal-50 text-teal-800 border border-teal-200' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {displayStatus}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectBeneficiary(b.id)}
                          className="px-2.5 py-1 text-[11px] font-medium text-[#0F2744] bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition"
                        >
                          Verify
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            Page <span className="font-semibold text-slate-900">{pagination.page}</span> of <span className="font-semibold text-slate-900">{pagination.totalPages || 1}</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={!pagination.hasPrev || loading}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 font-medium hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={!pagination.hasNext || loading}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 font-medium hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
