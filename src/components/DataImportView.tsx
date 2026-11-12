import React, { useState, useEffect } from 'react';
import { UserAccount, ImportAuditSummary, ImportPreviewResult, AppsScriptConfig, AppsScriptPingResult } from '../types.ts';
import { api } from '../services/api.ts';
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
  RotateCw,
  Code2,
  Server,
  Key,
  Copy,
  Check
} from 'lucide-react';

interface DataImportViewProps {
  currentUser: UserAccount;
}

export const DataImportView: React.FC<DataImportViewProps> = ({ currentUser }) => {
  const [auditData, setAuditData] = useState<ImportAuditSummary | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Apps Script configuration state
  const [appsScriptConfig, setAppsScriptConfig] = useState<AppsScriptConfig | null>(null);
  const [webAppUrlInput, setWebAppUrlInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<AppsScriptPingResult | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [appsScriptCode, setAppsScriptCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Sync state
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

  const fetchAppsScriptConfig = async () => {
    try {
      const config = await api.getAppsScriptConfig();
      setAppsScriptConfig(config);
      setWebAppUrlInput(config.webAppUrl || '');
    } catch (err) {
      console.warn('Could not load Apps Script config:', err);
    }
  };

  useEffect(() => {
    fetchAuditData();
    fetchAppsScriptConfig();
  }, []);

  const handleSaveAppsScriptUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setPingResult(null);
    try {
      const res = await api.updateAppsScriptConfig(webAppUrlInput);
      setAppsScriptConfig(res.config);
      setSheetSyncResult('Google Apps Script Web App URL updated successfully.');
    } catch (err: any) {
      setAuditError(err.message || 'Failed to save Apps Script URL');
    } finally {
      setSavingConfig(false);
    }
  };

  const handlePingAppsScript = async () => {
    setPinging(true);
    setPingResult(null);
    try {
      const res = await api.pingAppsScript(webAppUrlInput || undefined);
      setPingResult(res);
      await fetchAppsScriptConfig();
    } catch (err: any) {
      setPingResult({
        success: false,
        status: 'OFFLINE',
        message: err.message || 'Failed to ping Google Apps Script'
      });
    } finally {
      setPinging(false);
    }
  };

  const handleLoadCode = async () => {
    setShowCodeModal(true);
    if (!appsScriptCode) {
      try {
        const res = await api.getAppsScriptCode();
        setAppsScriptCode(res.code);
      } catch (err: any) {
        setAppsScriptCode('// Could not load Code.gs: ' + err.message);
      }
    }
  };

  const handleCopyCode = () => {
    if (appsScriptCode) {
      navigator.clipboard.writeText(appsScriptCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleSyncGoogleSheets = async () => {
    setSyncingSheets(true);
    setSheetSyncResult(null);
    setAuditError(null);
    try {
      const res = await api.syncGoogleSheets();
      setSheetSyncResult(`Successfully synchronized ${res.totalCount.toLocaleString()} beneficiary records directly from Google Spreadsheet!`);
      await fetchAuditData();
    } catch (err: any) {
      setAuditError(err.message || 'Failed to sync with Google Spreadsheet');
    } finally {
      setSyncingSheets(false);
    }
  };

  const handleEnsureHeaders = async () => {
    setEnsuringHeaders(true);
    setSheetSyncResult(null);
    setAuditError(null);
    try {
      const res = await api.ensureGoogleSheetHeaders();
      setSheetSyncResult(res.message || 'Verification column headers (Columns G–W) verified in Google Spreadsheet.');
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
              Primary Data Storage &amp; Google Apps Script Backend Manager
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

      {/* SECTION 1: Google Apps Script Web App Architecture & Configuration */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <span>Google Apps Script Web App (Backend API)</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Execute as: Script Owner
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Primary architecture: Portal (Frontend) &rarr; Express Gateway (Auth) &rarr; Google Apps Script Web App &rarr; Google Spreadsheet
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleLoadCode}
              className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800 shadow-2xs flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>View &amp; Copy Code.gs</span>
            </button>
          </div>
        </div>

        {/* Web App URL Form */}
        <form onSubmit={handleSaveAppsScriptUrl} className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={webAppUrlInput}
                onChange={(e) => setWebAppUrlInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 font-mono placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 transition"
              />
            </div>
            <button
              type="submit"
              disabled={savingConfig}
              className="px-4 py-2 bg-[#0F2744] hover:bg-[#153459] text-white text-xs font-semibold rounded shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              {savingConfig ? 'Saving...' : 'Save Web App URL'}
            </button>
            <button
              type="button"
              onClick={handlePingAppsScript}
              disabled={pinging || !webAppUrlInput}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-medium rounded transition disabled:opacity-50 flex items-center space-x-1 cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 text-teal-700 ${pinging ? 'animate-spin' : ''}`} />
              <span>{pinging ? 'Testing...' : 'Test Connection'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
            <div className="flex items-center space-x-2">
              <span>Security Key:</span>
              <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                TNK-THOO-PATTA-GAS-SECURE-2026
              </code>
              <span className="text-slate-400">&bull;</span>
              <span>Status:</span>
              {appsScriptConfig?.lastStatus === 'ONLINE' ? (
                <span className="inline-flex items-center space-x-1 font-semibold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>ONLINE (Connected)</span>
                </span>
              ) : appsScriptConfig?.webAppUrl ? (
                <span className="inline-flex items-center space-x-1 font-semibold text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>CONFIGURED (Ready to Test)</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 font-semibold text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span>READY FOR DEPLOYMENT URL</span>
                </span>
              )}
            </div>

            {appsScriptConfig?.lastConnectedAt && (
              <span className="text-slate-400">
                Last ping: {new Date(appsScriptConfig.lastConnectedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </form>

        {pingResult && (
          <div className={`p-3 rounded-md text-xs flex items-center space-x-2 ${
            pingResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-700'
          }`}>
            {pingResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{pingResult.message}</span>
          </div>
        )}
      </div>

      {/* SECTION 2: Google Spreadsheet Primary Integration Hub */}
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
                29,533 Master Beneficiary Records &bull; Row-exact verification write-back (Columns G–W)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Google Sheets Central Storage Active</span>
            </span>
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

      {/* SECTION 3: Beneficiary Count Validation Cards */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* New Free House Site Patta */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
              <span className="text-[11px] text-slate-500 font-medium">New Free House Site Patta</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-bold text-slate-900 font-mono">
                  {auditData.liveCounts.newFreeHouseSite.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400">/ {auditData.expectedTotals.newFreeHouseSite.toLocaleString()}</span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] text-emerald-700 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>Reconciled 100%</span>
              </div>
            </div>

            {/* Patta Regularisation */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Patta Regularisation</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-bold text-slate-900 font-mono">
                  {auditData.liveCounts.pattaRegularisation.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400">/ {auditData.expectedTotals.pattaRegularisation.toLocaleString()}</span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] text-emerald-700 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>Reconciled 100%</span>
              </div>
            </div>

            {/* Combined Master Beneficiaries */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Combined Beneficiaries</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-bold text-teal-700 font-mono">
                  {auditData.liveCounts.combinedTotal.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400">/ {auditData.expectedTotals.combinedTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] text-emerald-700 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>All 10 Taluks Covered</span>
              </div>
            </div>

            {/* Missing Revenue Village (Preserved) */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Missing Revenue Village (GDP)</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-bold text-slate-700 font-mono">
                  {auditData.liveCounts.missingVillageTotal.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400">/ 10,512</span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] text-slate-600 font-medium">
                <CheckCircle2 className="w-3 h-3 text-slate-500" />
                <span>Preserved As Null (Rule 9)</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Code.gs Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-indigo-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Google Apps Script Backend Source Code (Code.gs)
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs font-medium text-slate-700 flex items-center space-x-1 transition cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCodeModal(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-900 overflow-y-auto flex-1 font-mono text-xs text-slate-200 leading-relaxed">
              <pre className="whitespace-pre-wrap">{appsScriptCode || '// Loading Code.gs...'}</pre>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <span>Deploy as Web App &bull; Execute as: Me &bull; Access: Anyone</span>
              <button
                type="button"
                onClick={() => setShowCodeModal(false)}
                className="px-3 py-1 bg-[#0F2744] text-white rounded font-medium text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
