import React, { useState, useEffect } from 'react';
import { Beneficiary, TalukVerification, UserAccount, AuditTrailEntry } from '../types.ts';
import { api } from '../services/api.ts';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Save,
  Clock,
  ShieldCheck,
  Building,
  FileCheck2,
  Home,
  FileSpreadsheet,
  History,
  RotateCw
} from 'lucide-react';

interface BeneficiaryProfileModalProps {
  beneficiaryId: string;
  currentUser: UserAccount;
  onClose: () => void;
  onSaved: () => void;
}

export const BeneficiaryProfileModal: React.FC<BeneficiaryProfileModalProps> = ({
  beneficiaryId,
  currentUser,
  onClose,
  onSaved
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'audit'>('form');

  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditTrailEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);


  // 13 Required Verification Fields
  const [community, setCommunity] = useState('BC');
  const [pattaIssued, setPattaIssued] = useState<'Yes' | 'No' | 'Verification Pending'>('No');
  const [pattaNumber, setPattaNumber] = useState('');
  const [pattaIssueDate, setPattaIssueDate] = useState('');
  const [seniorityRegisterMaintained, setSeniorityRegisterMaintained] = useState<'Yes' | 'No' | 'Verification Pending'>('Yes');
  const [includedInSeniorityRegister, setIncludedInSeniorityRegister] = useState<'Yes' | 'No' | 'Pending'>('Pending');
  const [seniorityNumber, setSeniorityNumber] = useState('');
  const [landOccupied, setLandOccupied] = useState<'Yes' | 'No' | 'Partially Occupied' | 'Verification Pending'>('Verification Pending');
  const [relocationWillingness, setRelocationWillingness] = useState<string>('In-situ Regularisation');
  const [firka, setFirka] = useState('');
  const [verifiedRevenueVillage, setVerifiedRevenueVillage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'Pending' | 'Completed'>('Pending');
  const [proceedingsNumber, setProceedingsNumber] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    api.getBeneficiaryById(beneficiaryId)
      .then(res => {
        if (!isMounted) return;
        setBeneficiary(res.beneficiary);

        if (res.verification) {
          const v = res.verification;
          setCommunity(v.community || 'BC');

          // Normalize patta_issued
          if (v.patta_issued === 'Yes' || v.patta_issued === 1 || v.patta_issued === '1') {
            setPattaIssued('Yes');
          } else if (v.patta_issued === 'Verification Pending') {
            setPattaIssued('Verification Pending');
          } else {
            setPattaIssued('No');
          }

          setPattaNumber(v.patta_number || '');
          setPattaIssueDate(v.patta_issue_date || '');

          // Normalize seniority_register_maintained
          if (v.seniority_register_maintained === 'No' || v.seniority_register_maintained === 0 || v.seniority_register_maintained === '0') {
            setSeniorityRegisterMaintained('No');
          } else if (v.seniority_register_maintained === 'Verification Pending') {
            setSeniorityRegisterMaintained('Verification Pending');
          } else {
            setSeniorityRegisterMaintained('Yes');
          }

          setIncludedInSeniorityRegister((v.included_in_seniority_register as any) || 'Pending');
          setSeniorityNumber(v.seniority_number || '');
          setLandOccupied((v.land_occupied as any) || 'Verification Pending');
          setRelocationWillingness(v.relocation_willingness || 'In-situ Regularisation');
          setFirka(v.firka || '');
          setVerifiedRevenueVillage(v.verified_revenue_village || res.beneficiary.revenue_village || '');
          setRemarks(v.remarks || '');
          setVerificationStatus(v.verification_status === 'Completed' ? 'Completed' : 'Pending');
          setProceedingsNumber(v.proceedings_number || '');
        } else {
          setVerifiedRevenueVillage(res.beneficiary.revenue_village || '');
          if (res.beneficiary.application_category?.includes('Free House Site')) {
            setRelocationWillingness('Willing to Relocate');
          }
        }
      })
      .catch(err => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load beneficiary record');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [beneficiaryId]);

  const loadAuditHistory = async () => {
    setLoadingAudit(true);
    try {
      const res = await api.getAuditTrail(beneficiaryId);
      setAuditHistory(res.history);
    } catch (err: any) {
      console.error('Failed to load audit history:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.submitVerification(
        beneficiaryId,
        {
          beneficiary_id: beneficiaryId,
          community: community.trim() || null,
          patta_issued: pattaIssued,
          patta_number: pattaIssued === 'Yes' ? pattaNumber.trim() || null : null,
          patta_issue_date: pattaIssued === 'Yes' ? pattaIssueDate || null : null,
          seniority_register_maintained: seniorityRegisterMaintained,
          included_in_seniority_register: includedInSeniorityRegister,
          seniority_number: includedInSeniorityRegister === 'Yes' ? seniorityNumber.trim() || null : null,
          land_occupied: landOccupied,
          relocation_willingness: relocationWillingness || null,
          firka: firka.trim() || null,
          verified_revenue_village: verifiedRevenueVillage.trim() || null,
          verification_status: verificationStatus,
          remarks: remarks.trim() || null,
          proceedings_number: proceedingsNumber.trim() || null
        }
      );

      if (res.google_sheets_synced) {
        setSuccessMsg(`Verification saved and synced to Google Sheet (${res.sheet_name || 'Spreadsheet'} Row #${res.sheet_row || ''})!`);
      } else {
        setSuccessMsg(res.message || 'Verification details successfully saved.');
      }

      setTimeout(() => {
        onSaved();
      }, 900);
    } catch (err: any) {
      setError(err.message || 'Failed to record verification');
    } finally {
      setSaving(false);
    }
  };

  const sheetRefText = beneficiary?.sheet_name
    ? `${beneficiary.sheet_name} (Row #${beneficiary.sheet_row || (beneficiary.source_sno + 1)})`
    : `Row #${(beneficiary?.source_sno || 1) + 1}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4 font-sans text-slate-800">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-[#0F2744] text-white rounded">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <span>{loading ? 'Loading Record...' : `Field Verification &bull; ${beneficiary?.beneficiary_name}`}</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                ID: {beneficiary?.id} &bull; S.No: {beneficiary?.source_sno} &bull; Taluk: {beneficiary?.taluk} &bull; Google Sheet: <strong className="text-teal-800 font-sans">{sheetRefText}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Tab switch */}
            <div className="flex items-center bg-slate-200/60 p-0.5 rounded text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`px-2.5 py-0.5 rounded transition ${
                  activeTab === 'form' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Verification Form
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('audit');
                  loadAuditHistory();
                }}
                className={`px-2.5 py-0.5 rounded transition flex items-center space-x-1 ${
                  activeTab === 'audit' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3 h-3" />
                <span>Audit Trail</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Google Sheets Primary Storage Status */}
        <div className="px-5 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700 flex-shrink-0" />
            <span className="text-[11px] text-slate-600">
              Target Spreadsheet Row: <strong className="text-slate-800">{sheetRefText}</strong>
            </span>
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Primary Storage: Google Sheets (GAS Backend)</span>
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {beneficiary?.application_category}
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          
          {loading ? (
            <div className="py-12 text-center text-slate-500 flex items-center justify-center space-x-2">
              <Clock className="w-4 h-4 animate-spin text-teal-700" />
              <span>Fetching beneficiary profile and verification logs...</span>
            </div>
          ) : error ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : activeTab === 'audit' ? (
            /* AUDIT TRAIL TAB */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h4 className="font-bold text-slate-800">
                    Field-Level Modification Audit Trail
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Historical changes recorded for {beneficiary?.beneficiary_name} ({beneficiary?.id})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadAuditHistory}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                  title="Refresh audit history"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin text-teal-700' : ''}`} />
                </button>
              </div>

              {loadingAudit ? (
                <div className="py-8 text-center text-slate-400">Loading audit history...</div>
              ) : auditHistory.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded border border-slate-200">
                  No previous modification history recorded yet for this beneficiary.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-md">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0F2744] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="py-2 px-2.5">Field Changed</th>
                        <th className="py-2 px-2.5">Previous Value</th>
                        <th className="py-2 px-2.5">Updated Value</th>
                        <th className="py-2 px-2.5">Officer</th>
                        <th className="py-2 px-2.5">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {auditHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2.5 font-semibold text-slate-900 font-mono text-[11px]">{item.field_name}</td>
                          <td className="py-1.5 px-2.5 text-slate-500">{item.previous_value || <span className="text-slate-300">empty</span>}</td>
                          <td className="py-1.5 px-2.5 font-medium text-emerald-800">{item.updated_value || <span className="text-slate-300">empty</span>}</td>
                          <td className="py-1.5 px-2.5 font-medium text-slate-700">{item.updated_by}</td>
                          <td className="py-1.5 px-2.5 text-slate-500 font-mono text-[10px]">{item.updated_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : beneficiary ? (
            /* VERIFICATION FORM TAB */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Beneficiary Master Summary Card (Immutable Source Data) */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-medium">Beneficiary Name:</span>
                  <span className="font-bold text-slate-900">{beneficiary.beneficiary_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">GDP Petition S.No:</span>
                  <span className="font-mono font-semibold text-slate-800">{beneficiary.source_sno}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Category:</span>
                  <span className="font-semibold text-teal-800">
                    {beneficiary.application_category}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Phone:</span>
                  <span className="font-mono text-slate-800">{beneficiary.phone || 'N/A'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block font-medium">Original Address:</span>
                  <span className="text-slate-700 truncate block">{beneficiary.address || 'N/A'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block font-medium">Original GDP Village:</span>
                  <span className="text-slate-700 font-medium">
                    {beneficiary.revenue_village || <span className="text-amber-700 font-semibold">[Missing in Source GDP]</span>}
                  </span>
                </div>
              </div>

              {/* Status alerts */}
              {successMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* SECTION 1: Community, Firka & Revenue Village Resolution */}
              <div className="p-3.5 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
                    <Building className="w-3.5 h-3.5 text-teal-700" />
                    <span>1. Community &amp; Revenue Village Identification</span>
                  </h4>
                  {!beneficiary.revenue_village && (
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Action Required: Confirm Village
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-0.5">
                      1. Community <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={community}
                      onChange={(e) => setCommunity(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 font-medium"
                    >
                      <option value="SC">Scheduled Caste (SC)</option>
                      <option value="ST">Scheduled Tribe (ST)</option>
                      <option value="MBC">Most Backward Class (MBC)</option>
                      <option value="BC">Backward Class (BC)</option>
                      <option value="BCM">BC Muslim (BCM)</option>
                      <option value="OC">Open Category (OC)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-0.5">
                      10. Firka
                    </label>
                    <input
                      type="text"
                      value={firka}
                      onChange={(e) => setFirka(e.target.value)}
                      placeholder="e.g. Kurumbur Firka"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-0.5">
                      11. Revenue Village
                    </label>
                    <input
                      type="text"
                      value={verifiedRevenueVillage}
                      onChange={(e) => setVerifiedRevenueVillage(e.target.value)}
                      placeholder="Confirm revenue village"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Land Occupation & Willingness to Relocate */}
              <div className="p-3.5 border border-slate-200 rounded-lg space-y-3">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
                  <Home className="w-3.5 h-3.5 text-teal-700" />
                  <span>2. Land Occupation &amp; Relocation Assessment</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-0.5">
                      8. Land Occupied <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={landOccupied}
                      onChange={(e) => setLandOccupied(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-600 font-medium"
                    >
                      <option value="Yes">Yes (Fully Occupied)</option>
                      <option value="Partially Occupied">Partially Occupied</option>
                      <option value="No">No (Unoccupied / Vacant)</option>
                      <option value="Verification Pending">Verification Pending</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-0.5">
                      9. Willingness to Relocate
                    </label>
                    <select
                      value={relocationWillingness}
                      onChange={(e) => setRelocationWillingness(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-600 font-medium"
                    >
                      <option value="In-situ Regularisation">In-situ Regularisation</option>
                      <option value="Yes">Yes (Willing to Relocate)</option>
                      <option value="No">No (Not Willing)</option>
                      <option value="Response Pending">Response Pending</option>
                      <option value="Not Applicable">Not Applicable</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Seniority Register Verification */}
              <div className="p-3.5 border border-slate-200 rounded-lg space-y-3">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-indigo-700" />
                  <span>3. Seniority Register Verification</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-0.5">
                      5. Seniority Register Maintained?
                    </label>
                    <select
                      value={seniorityRegisterMaintained}
                      onChange={(e) => setSeniorityRegisterMaintained(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-600 font-medium"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Verification Pending">Verification Pending</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-0.5">
                      6. Beneficiary in Seniority Register?
                    </label>
                    <select
                      value={includedInSeniorityRegister}
                      onChange={(e) => setIncludedInSeniorityRegister(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-600 font-medium"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>

                  {includedInSeniorityRegister === 'Yes' && (
                    <div>
                      <label className="block font-medium text-slate-700 mb-0.5">
                        7. Seniority Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required={includedInSeniorityRegister === 'Yes'}
                        value={seniorityNumber}
                        onChange={(e) => setSeniorityNumber(e.target.value)}
                        placeholder="e.g. SR/2026/014"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 4: Patta Status & Issuance Details */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                  4. Patta Status, Proceedings &amp; Finalization
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-0.5">
                      2. Patta Issued? <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={pattaIssued}
                      onChange={(e) => setPattaIssued(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    >
                      <option value="No">No (Patta Not Issued)</option>
                      <option value="Yes">Yes (Patta Issued)</option>
                      <option value="Verification Pending">Verification Pending</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-0.5">
                      13. Verification Status
                    </label>
                    <select
                      value={verificationStatus}
                      onChange={(e) => setVerificationStatus(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold"
                    >
                      <option value="Pending">Pending (Draft / In Process)</option>
                      <option value="Completed">Completed (Finalized)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-0.5">
                      Proceedings Number
                    </label>
                    <input
                      type="text"
                      value={proceedingsNumber}
                      onChange={(e) => setProceedingsNumber(e.target.value)}
                      placeholder="e.g. Roc.A1/4210/2026"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>

                  {/* Conditionally show Patta Number and Issue Date when Patta Issued === 'Yes' */}
                  {pattaIssued === 'Yes' && (
                    <>
                      <div>
                        <label className="block font-semibold text-slate-800 mb-0.5">
                          3. Patta Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={pattaIssued === 'Yes'}
                          value={pattaNumber}
                          onChange={(e) => setPattaNumber(e.target.value)}
                          placeholder="e.g. TN/THOO/PT/0124"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-800 mb-0.5">
                          4. Patta Issue Date
                        </label>
                        <input
                          type="date"
                          value={pattaIssueDate}
                          onChange={(e) => setPattaIssueDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium"
                        />
                      </div>
                    </>
                  )}

                  <div className="sm:col-span-3">
                    <label className="block font-medium text-slate-700 mb-0.5">
                      12. Verification Remarks
                    </label>
                    <textarea
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter verification findings, VAO enquiry status, or grounds for recommendation/rejection..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-200 gap-2">
                <div className="text-[11px] text-slate-500 font-mono">
                  Officer: <strong>{currentUser.username}</strong> ({currentUser.assigned_taluk})
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-[#0F2744] hover:bg-[#153459] text-white rounded text-xs font-semibold shadow-2xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving & Syncing...' : 'Save & Sync Verification'}</span>
                  </button>
                </div>
              </div>

            </form>
          ) : null}

        </div>
      </div>
    </div>
  );
};
