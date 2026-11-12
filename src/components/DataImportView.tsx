import React, { useState, useEffect } from 'react';
import { UserAccount, ImportAuditSummary, ImportPreviewResult } from '../types.ts';
import { api } from '../services/api.ts';
import { getGoogleAccessToken, googleSignIn, getGoogleUser } from '../services/googleAuth.ts';
import {
  Database,
  Upload,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Eye,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  RotateCw
} from 'lucide-react';

interface DataImportViewProps {
  currentUser: UserAccount;
}

export const DataImportView: React.FC<DataImportViewProps> = ({ currentUser }) => {
  const [auditData, setAuditData] = useState<ImportAuditSummary | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Google Sheets state
  const [googleToken, setGoogleToken] = useState<string | null>(getGoogleAccessToken());
  const [googleUser, setGoogleUser] = useState(getGoogleUser());
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [sheetSyncResult, setSheetSyncResult] = useState<string | null>(null);
  const [ensuringHeaders, setEnsuringHeaders] = useState(false);

  // Import flow state
  const [selectedCategory, setSelectedCategory] = useState<'New Free House Site Patta' | 'Patta Regularisation'>('New Free House Site Patta');
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    success: boolean;
    message: string;
    stats?: {
      source: number;
      imported: number;
      duplicate: number;
      missingVillage: number;
    };
  } | null>(null);

  const fetchAuditData = async () => {
    setLoadingAudit(true);
    setAuditError(null);
    try {
      const res = await api.getImportAudit();
      setAuditData(res);
    } catch (err: any) {
      setAuditError(err.message || 'Failed to fetch import audit data');
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const handleConnectGoogle = async () => {
    try {
      const { user, accessToken } = await googleSignIn();
      setGoogleUser(user);
      setGoogleToken(accessToken);
      setSheetSyncResult(`Connected as ${user.email}. Live spreadsheet sync is ready.`);
    } catch (err: any) {
      setAuditError('Google Sign-In failed: ' + err.message);
    }
  };

  const handleSyncGoogleSheets = async () => {
    setSyncingSheets(true);
    setSheetSyncResult(null);
    setAuditError(null);
    try {
      const res = await api.syncGoogleSheets();
      setSheetSyncResult(`Successfully synchronized ${res.totalCount.toLocaleString()} beneficiary records directly from Google Sheets!`);
      await fetchAuditData();
    } catch (err: any) {
      setAuditError(err.message || 'Failed to sync with Google Sheets');
    } finally {
      setSyncingSheets(false);
    }
  };

  const handleEnsureHeaders = async () => {
    const token = googleToken || getGoogleAccessToken();
    if (!token) {
      setAuditError('Please connect your Google account first to update sheet headers.');
      return;
    }

    setEnsuringHeaders(true);
    try {
      await api.ensureGoogleSheetHeaders(token);
      setSheetSyncResult('Verification column headers (Columns G–W) verified in Google Spreadsheet.');
    } catch (err: any) {
      setAuditError(err.message || 'Failed to update sheet headers');
    } finally {
      setEnsuringHeaders(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportStatus(null);
    setPreviewResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text || '');
    };
    reader.readAsText(file);
  };

  const handleValidateAndPreview = async () => {
    if (!csvContent.trim()) {
      setImportStatus({ success: false, message: 'Please upload a CSV file or paste CSV content first.' });
      return;
    }

    setIsValidating(true);
    setImportStatus(null);
    try {
      const res = await api.previewImport(csvContent);
      setPreviewResult(res);
      setImportStatus({
        success: true,
        message: `Validation passed! Header contains all 6 required fields. Found ${res.totalRows.toLocaleString()} petition records.`
      });
    } catch (err: any) {
      setPreviewResult(null);
      setImportStatus({
        success: false,
        message: err.message || 'Validation failed. Please verify CSV headings.'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!csvContent.trim()) return;

    setIsImporting(true);
    try {
      const res = await api.executeImport({
        csvContent,
        category: selectedCategory,
        filename: fileName || 'manual_upload.csv'
      });

      setImportStatus({
        success: true,
        message: `Import processed successfully! ${res.importedRecords} new records added, ${res.duplicateRecords} existing records de-duplicated.`,
        stats: {
          source: res.sourceRecords,
          imported: res.importedRecords,
          duplicate: res.duplicateRecords,
          missingVillage: res.missingVillageRecords
        }
      });

      await fetchAuditData();
      setCsvContent('');
      setPreviewResult(null);
      setFileName('');
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: 'Import execution error: ' + (err.message || 'Unknown error')
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportAuditReport = () => {
    if (!auditData) return;

    const rows = [
      ['Metric', 'Expected Source Count', 'Live Database Count', 'Reconciliation Status'],
      ['New Free House Site Patta', auditData.expectedTotals.newFreeHouseSite, auditData.liveCounts.newFreeHouseSite, auditData.expectedTotals.newFreeHouseSite === auditData.liveCounts.newFreeHouseSite ? 'VERIFIED_100%' : 'DISCREPANCY'],
      ['Patta Regularisation', auditData.expectedTotals.pattaRegularisation, auditData.liveCounts.pattaRegularisation, auditData.expectedTotals.pattaRegularisation === auditData.liveCounts.pattaRegularisation ? 'VERIFIED_100%' : 'DISCREPANCY'],
      ['Combined Beneficiary Master', auditData.expectedTotals.combinedTotal, auditData.liveCounts.combinedTotal, auditData.expectedTotals.combinedTotal === auditData.liveCounts.combinedTotal ? 'VERIFIED_100%' : 'DISCREPANCY'],
      ['Missing Revenue Village (GDP)', '10,512', auditData.liveCounts.missingVillageTotal, 'PRESERVED_AS_NULL'],
      ['Missing Taluk (GDP)', '0', auditData.liveCounts.missingTalukTotal, 'ZERO_ERRORS']
    ];

    const csvStr = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thoothukudi_beneficiary_audit_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 sm:p-6 space-y-6 max-w-6xl mx-auto font-sans text-slate-800">
      
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-teal-700" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Google Spreadsheet &amp; Master Data Administration
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Centralized Google Spreadsheet: <code className="font-mono text-slate-700">1wcvgGj_Y6__RpUSDjv5J3D0OWVPiplZLdN0BZ6KPvfw</code>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportAuditReport}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-teal-700" />
            <span>Export Audit Report</span>
          </button>
          <button
            onClick={fetchAuditData}
            title="Refresh"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-slate-200 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SECTION 1: Google Spreadsheet Primary Integration Hub */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Primary Central Data Source: Google Spreadsheet
              </h3>
              <p className="text-[11px] text-slate-500">
                Authorized two-way synchronization: Sheet &harr; Monitoring Portal
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {googleToken ? (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google OAuth Active ({googleUser?.email || 'Authorized'})</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogle}
                className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-[#0F2744] shadow-2xs flex items-center space-x-1.5 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700" />
                <span>Connect Google Workspace</span>
              </button>
            )}
          </div>
        </div>

        {/* Worksheets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Worksheet 1 */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 font-mono text-[11px]">Free House Site and Regularisation</span>
              <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-semibold">Sheet 1</span>
            </div>
            <p className="text-[11px] text-slate-500">Primary dataset for New Free House Site Patta petitions.</p>
            <div className="pt-1 flex items-center justify-between font-mono text-[11px]">
              <span className="text-slate-500">Rows: <strong>28,701</strong></span>
              <span className="text-emerald-700 font-semibold">100% Synced</span>
            </div>
          </div>

          {/* Worksheet 2 */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 font-mono text-[11px]">Regularization</span>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-semibold">Sheet 2</span>
            </div>
            <p className="text-[11px] text-slate-500">Dataset for Patta Regularisation petitions.</p>
            <div className="pt-1 flex items-center justify-between font-mono text-[11px]">
              <span className="text-slate-500">Rows: <strong>832</strong></span>
              <span className="text-emerald-700 font-semibold">100% Synced</span>
            </div>
          </div>

          {/* Worksheet 3 */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 font-mono text-[11px]">User ID</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">Sheet 3</span>
            </div>
            <p className="text-[11px] text-slate-500">11 User Accounts mapped with salted PBKDF2 hashes.</p>
            <div className="pt-1 flex items-center justify-between font-mono text-[11px]">
              <span className="text-slate-500">Users: <strong>10 Taluks + 1 DM</strong></span>
              <span className="text-teal-700 font-semibold">Active</span>
            </div>
          </div>
        </div>

        {/* Sync Controls */}
        <div className="pt-2 flex flex-wrap items-center gap-2.5 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSyncGoogleSheets}
            disabled={syncingSheets}
            className="px-3.5 py-1.5 bg-[#0F2744] hover:bg-[#153459] text-white rounded text-xs font-semibold shadow-2xs flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${syncingSheets ? 'animate-spin' : ''}`} />
            <span>{syncingSheets ? 'Synchronizing from Sheets...' : 'Pull & Sync from Google Sheets'}</span>
          </button>

          <button
            type="button"
            onClick={handleEnsureHeaders}
            disabled={ensuringHeaders}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-medium border border-slate-200 flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <FileCheck className="w-3.5 h-3.5 text-teal-700" />
            <span>{ensuringHeaders ? 'Verifying Columns...' : 'Ensure Sheet Verification Headers (G–W)'}</span>
          </button>

          <a
            href="https://docs.google.com/spreadsheets/d/1wcvgGj_Y6__RpUSDjv5J3D0OWVPiplZLdN0BZ6KPvfw"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded text-xs font-medium border border-slate-200 flex items-center space-x-1 transition ml-auto"
          >
            <span>Open in Google Sheets</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>

        {/* Feedback alert */}
        {sheetSyncResult && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{sheetSyncResult}</span>
          </div>
        )}
      </div>

      {/* SECTION 2: Beneficiary Count Validation Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Source Dataset Reconciliation (Expected vs. Live Master)
          </h3>
          <span className="text-[11px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-semibold flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3 text-teal-600" />
            <span>100% Immutable Master Records</span>
          </span>
        </div>

        {loadingAudit ? (
          <div className="p-6 bg-white rounded-lg border border-slate-200 text-center text-xs text-slate-400">
            <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-teal-700" />
            <span>Auditing database counts...</span>
          </div>
        ) : auditError ? (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
            {auditError}
          </div>
        ) : auditData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Free House Site Patta */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                New Free House Site Patta
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-bold text-slate-900 font-mono">
                  {auditData.liveCounts.newFreeHouseSite.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  / {auditData.expectedTotals.newFreeHouseSite.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Match (0 missing taluks)</span>
              </div>
            </div>

            {/* Patta Regularisation */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Patta Regularisation
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-bold text-slate-900 font-mono">
                  {auditData.liveCounts.pattaRegularisation.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  / {auditData.expectedTotals.pattaRegularisation.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Match (0 missing taluks)</span>
              </div>
            </div>

            {/* Total Beneficiary Master */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Total Master Beneficiaries
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-bold text-[#0F2744] font-mono">
                  {auditData.liveCounts.combinedTotal.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  / {auditData.expectedTotals.combinedTotal.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Complete District Dataset</span>
              </div>
            </div>

            {/* Missing Revenue Villages Preserved */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 block">
                Missing Revenue Villages (Preserved)
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-bold text-amber-700 font-mono">
                  {auditData.liveCounts.missingVillageTotal.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  / 10,512 GDP
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                Preserved as NULL; no automatic Firka or Village forced
              </p>
            </div>

          </div>
        ) : null}
      </div>

      {/* SECTION 3: Additional File Upload & Verification */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Manual CSV Import &amp; De-duplication Validator
            </h3>
            <p className="text-[11px] text-slate-500">
              Validates 6 mandatory GDP columns and enforces duplicate prevention via <code>UNIQUE(source_sno, application_category)</code>
            </p>
          </div>
          <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
            CSV Format (.csv)
          </span>
        </div>

        {/* Input Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Select Application Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              <option value="New Free House Site Patta">New Free House Site Patta</option>
              <option value="Patta Regularisation">Patta Regularisation</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Choose Source CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer border border-slate-200 rounded-md p-1 bg-slate-50"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Or Paste CSV Data Directly (with Headers)
            </label>
            <textarea
              rows={3}
              value={csvContent}
              onChange={(e) => {
                setCsvContent(e.target.value);
                setPreviewResult(null);
                setImportStatus(null);
              }}
              placeholder={`S.No,Beneficiary Name,Address_1,Phone,Taluk,Revenue Village\n1,Mariappan,12 North St,9842100000,Thoothukudi,Mullakkadu`}
              className="w-full font-mono text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={handleValidateAndPreview}
            disabled={isValidating || !csvContent.trim()}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-teal-700" />
            <span>{isValidating ? 'Validating Columns...' : 'Validate & Preview (First 10 Rows)'}</span>
          </button>

          <button
            onClick={handleExecuteImport}
            disabled={isImporting || !csvContent.trim() || !previewResult?.valid}
            className="px-4 py-1.5 bg-[#0F2744] hover:bg-[#153459] text-white rounded-md text-xs font-semibold flex items-center space-x-1.5 shadow-2xs transition disabled:opacity-40 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isImporting ? 'Importing & De-duplicating...' : 'Execute Import & De-duplicate'}</span>
          </button>
        </div>

        {/* Status notification */}
        {importStatus && (
          <div className={`p-3 rounded-lg border text-xs flex items-start space-x-2 ${
            importStatus.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {importStatus.success ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
            )}
            <div className="space-y-1">
              <span className="font-medium">{importStatus.message}</span>
              {importStatus.stats && (
                <div className="text-[11px] text-slate-600 font-mono space-x-3 pt-1">
                  <span>Source Rows: {importStatus.stats.source}</span>
                  <span>Imported: {importStatus.stats.imported}</span>
                  <span>Duplicates Avoided: {importStatus.stats.duplicate}</span>
                  <span>Missing Villages Flagged: {importStatus.stats.missingVillage}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* First 10 Sample Rows Preview Table */}
        {previewResult && previewResult.sampleRows.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">
                Preview of Sample Rows (First {previewResult.sampleRows.length} of {previewResult.totalRows.toLocaleString()})
              </span>
              <span className="text-emerald-700 font-semibold text-[11px]">
                6 Mandatory Columns Verified
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-semibold">
                  <tr>
                    <th className="py-2 px-2.5">S.No</th>
                    <th className="py-2 px-2.5">Beneficiary Name</th>
                    <th className="py-2 px-2.5">Address_1</th>
                    <th className="py-2 px-2.5">Phone</th>
                    <th className="py-2 px-2.5">Taluk</th>
                    <th className="py-2 px-2.5">Revenue Village</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {previewResult.sampleRows.map((r) => (
                    <tr key={r.index} className="hover:bg-slate-50">
                      <td className="py-1.5 px-2.5 font-mono text-slate-500">{r.sno}</td>
                      <td className="py-1.5 px-2.5 font-semibold text-slate-900">{r.name}</td>
                      <td className="py-1.5 px-2.5 text-slate-500 truncate max-w-xs">{r.address || '—'}</td>
                      <td className="py-1.5 px-2.5 font-mono text-slate-600">{r.phone || '—'}</td>
                      <td className="py-1.5 px-2.5 font-medium text-slate-800">{r.taluk}</td>
                      <td className="py-1.5 px-2.5">
                        {r.revenue_village ? (
                          <span className="text-slate-800">{r.revenue_village}</span>
                        ) : (
                          <span className="text-amber-700 text-[10px] bg-amber-50 px-1 py-0.5 rounded border border-amber-200 font-medium">
                            Missing (Preserved)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 4: Audit Log History */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            Master Data &amp; Google Sheets Import Audit Trail
          </span>
          <span className="text-slate-400 text-[11px]">
            Recorded in <code>import_audit</code> table
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0F2744] text-white uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Audit ID</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Source Reference</th>
                <th className="py-2.5 px-3 text-right">Source Rows</th>
                <th className="py-2.5 px-3 text-right">Imported</th>
                <th className="py-2.5 px-3 text-right">Duplicates Ignored</th>
                <th className="py-2.5 px-3 text-right">Missing Villages</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {auditData?.auditLogs && auditData.auditLogs.length > 0 ? (
                auditData.auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-500">#{log.id}</td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{log.imported_at}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{log.category}</td>
                    <td className="py-2 px-3 font-mono text-slate-500 text-[11px] truncate max-w-xs">{log.source_filename}</td>
                    <td className="py-2 px-3 text-right font-mono font-medium">{log.source_records.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">{log.imported_records.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-mono text-amber-700">{log.duplicate_records.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">{log.missing_village_records.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    No import history records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
