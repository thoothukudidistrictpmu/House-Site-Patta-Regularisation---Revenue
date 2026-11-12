/**
 * Google Apps Script Web App Client
 * Connects the Portal Express Server to the Google Apps Script Web App Backend
 * 
 * Architecture:
 * Portal (Frontend) -> Express Server (Auth & Validation) -> Google Apps Script Web App -> Google Spreadsheet
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserAccount } from './auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.resolve(__dirname, '../data/apps_script_config.json');

export const DEFAULT_API_SECRET_KEY = 'TNK-THOO-PATTA-GAS-SECURE-2026';
export const GOOGLE_SPREADSHEET_ID = '1wcvgGj_Y6__RpUSDjv5J3D0OWVPiplZLdN0BZ6KPvfw';

export interface AppsScriptConfig {
  webAppUrl: string;
  apiSecretKey: string;
  spreadsheetId: string;
  lastConnectedAt: string | null;
  lastStatus: 'ONLINE' | 'OFFLINE' | 'UNCONFIGURED';
}

function loadConfig(): AppsScriptConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[AppsScriptClient] Error loading config:', err);
  }

  return {
    webAppUrl: process.env.APPS_SCRIPT_URL || '',
    apiSecretKey: process.env.APPS_SCRIPT_SECRET || DEFAULT_API_SECRET_KEY,
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    lastConnectedAt: null,
    lastStatus: process.env.APPS_SCRIPT_URL ? 'ONLINE' : 'UNCONFIGURED'
  };
}

function saveConfig(config: AppsScriptConfig) {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('[AppsScriptClient] Error saving config:', err);
  }
}

let currentConfig = loadConfig();

export function getAppsScriptConfig(): AppsScriptConfig {
  return { ...currentConfig };
}

export function updateAppsScriptUrl(newUrl: string): AppsScriptConfig {
  currentConfig.webAppUrl = newUrl.trim();
  currentConfig.lastStatus = newUrl.trim() ? 'ONLINE' : 'UNCONFIGURED';
  saveConfig(currentConfig);
  return { ...currentConfig };
}

/**
 * Pings Google Apps Script Web App to verify connectivity
 */
export async function pingAppsScript(overrideUrl?: string): Promise<{
  success: boolean;
  status: string;
  message: string;
  details?: any;
}> {
  const url = (overrideUrl || currentConfig.webAppUrl || '').trim();
  if (!url) {
    return {
      success: false,
      status: 'UNCONFIGURED',
      message: 'Google Apps Script Web App URL is not yet configured.'
    };
  }

  try {
    const pingUrl = `${url}${url.includes('?') ? '&' : '?'}action=ping`;
    const res = await fetch(pingUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    currentConfig.lastConnectedAt = new Date().toISOString();
    currentConfig.lastStatus = 'ONLINE';
    saveConfig(currentConfig);

    return {
      success: true,
      status: 'ONLINE',
      message: 'Successfully connected to Google Apps Script Web App.',
      details: data
    };
  } catch (err: any) {
    currentConfig.lastStatus = 'OFFLINE';
    saveConfig(currentConfig);
    return {
      success: false,
      status: 'OFFLINE',
      message: 'Failed to connect to Google Apps Script Web App: ' + err.message
    };
  }
}

/**
 * Invokes an action on Google Apps Script via GET
 */
async function callAppsScriptGet(action: string, params: Record<string, string>, officer?: UserAccount): Promise<any> {
  const url = currentConfig.webAppUrl;
  if (!url) {
    throw new Error('Google Apps Script Web App URL is not configured.');
  }

  const queryParams = new URLSearchParams({
    action,
    secret: currentConfig.apiSecretKey,
    ...params
  });

  if (officer) {
    queryParams.set('officerRole', officer.role);
    queryParams.set('officerTaluk', officer.assigned_taluk);
    queryParams.set('officerName', officer.username);
  }

  const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${queryParams.toString()}`;
  const res = await fetch(fullUrl, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(20000)
  });

  if (!res.ok) {
    throw new Error(`Apps Script responded with HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.success && data.error) {
    throw new Error(data.error);
  }

  return data;
}

/**
 * Invokes an action on Google Apps Script via POST
 */
async function callAppsScriptPost(action: string, body: Record<string, any>, officer?: UserAccount): Promise<any> {
  const url = currentConfig.webAppUrl;
  if (!url) {
    throw new Error('Google Apps Script Web App URL is not configured.');
  }

  const payload: Record<string, any> = {
    action,
    secret: currentConfig.apiSecretKey,
    ...body
  };

  if (officer) {
    payload.officerRole = officer.role;
    payload.officerTaluk = officer.assigned_taluk;
    payload.officerName = officer.username;
    payload.updated_by = officer.username;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000)
  });

  if (!res.ok) {
    throw new Error(`Apps Script responded with HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.success && data.error) {
    throw new Error(data.error);
  }

  return data;
}

// ============================================================================
// EXPORTED APPS SCRIPT API CALLS
// ============================================================================

export const appsScriptApi = {
  isConfigured(): boolean {
    return Boolean(currentConfig.webAppUrl && currentConfig.webAppUrl.startsWith('https://script.google.com/'));
  },

  async getBeneficiaries(params: {
    page?: number;
    limit?: number;
    taluk?: string;
    category?: string;
    status?: string;
    search?: string;
  }, officer: UserAccount) {
    const stringParams: Record<string, string> = {};
    if (params.page) stringParams.page = String(params.page);
    if (params.limit) stringParams.limit = String(params.limit);
    if (params.taluk) stringParams.taluk = params.taluk;
    if (params.category) stringParams.category = params.category;
    if (params.status) stringParams.status = params.status;
    if (params.search) stringParams.search = params.search;

    return callAppsScriptGet('getBeneficiaries', stringParams, officer);
  },

  async getBeneficiaryById(id: string, officer: UserAccount) {
    return callAppsScriptGet('getBeneficiary', { id }, officer);
  },

  async updateVerification(id: string, payload: any, officer: UserAccount) {
    return callAppsScriptPost('updateVerification', { id, ...payload }, officer);
  },

  async getStats(officer: UserAccount, taluk?: string) {
    const params: Record<string, string> = {};
    if (taluk) params.taluk = taluk;
    return callAppsScriptGet('getStats', params, officer);
  },

  async getAuditTrail(id: string, officer: UserAccount) {
    return callAppsScriptGet('getAuditTrail', { id }, officer);
  },

  async ensureHeaders(officer: UserAccount) {
    return callAppsScriptPost('ensureHeaders', {}, officer);
  }
};
