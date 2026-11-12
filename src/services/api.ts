import {
  UserAccount,
  Beneficiary,
  TalukVerification,
  CollectorDashboardData,
  TahsildarDashboardData,
  PaginationMeta,
  ImportAuditSummary,
  ImportPreviewResult,
  AuditTrailEntry,
  GoogleSheetsSyncStatus,
  AppsScriptConfig,
  AppsScriptPingResult
} from '../types.ts';

// In-memory token storage (No sensitive data or tokens written to localStorage)
let memoryToken: string | null = null;
let currentUser: UserAccount | null = null;

export function setAuthToken(token: string | null, user: UserAccount | null) {
  memoryToken = token;
  currentUser = user;
}

export function getAuthToken(): string | null {
  return memoryToken;
}

export function getCurrentUser(): UserAccount | null {
  return currentUser;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (memoryToken) {
    headers.set('Authorization', `Bearer ${memoryToken}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) errorMsg = errorJson.error;
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Authentication (Part 1: Strict credential confidentiality)
  login: async (credentials: { username: string; password: string }) => {
    const res = await request<{ success: boolean; token: string; user: UserAccount }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    setAuthToken(res.token, res.user);
    return res;
  },

  checkSession: async () => {
    if (!memoryToken) return { authenticated: false };
    return request<{ authenticated: boolean; user?: UserAccount }>('/api/auth/me');
  },

  logout: async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null, null);
    }
  },

  // User Management (District Admin)
  getUsers: async () => {
    return request<{ users: UserAccount[] }>('/api/auth/users');
  },

  resetPassword: async (userId: string, newPassword: string) => {
    return request<{ success: boolean; message: string }>(`/api/auth/users/${encodeURIComponent(userId)}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword })
    });
  },

  updateUserStatus: async (userId: string, status: string) => {
    return request<{ success: boolean; message: string }>(`/api/auth/users/${encodeURIComponent(userId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // Dashboards
  getCollectorDashboard: async (): Promise<CollectorDashboardData> => {
    return request<CollectorDashboardData>('/api/dashboard/collector');
  },

  getTahsildarDashboard: async (taluk: string): Promise<TahsildarDashboardData> => {
    return request<TahsildarDashboardData>(`/api/dashboard/tahsildar/${encodeURIComponent(taluk)}`);
  },

  // Beneficiaries
  getBeneficiaries: async (params: {
    page?: number;
    limit?: number;
    taluk?: string;
    category?: string;
    status?: string;
    search?: string;
  }): Promise<{ beneficiaries: Beneficiary[]; pagination: PaginationMeta }> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.taluk) query.set('taluk', params.taluk);
    if (params.category) query.set('category', params.category);
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);

    return request(`/api/beneficiaries?${query.toString()}`);
  },

  getBeneficiaryById: async (id: string): Promise<{ beneficiary: Beneficiary; verification: TalukVerification | null }> => {
    return request(`/api/beneficiaries/${encodeURIComponent(id)}`);
  },

  submitVerification: async (
    id: string,
    payload: Partial<TalukVerification>,
    googleAccessToken?: string | null
  ) => {
    const headers: Record<string, string> = {};
    if (googleAccessToken) {
      headers['x-google-access-token'] = googleAccessToken;
    }

    return request<{
      success: boolean;
      message: string;
      verification_status: string;
      google_sheets_synced?: boolean;
      sheet_name?: string;
      sheet_row?: number;
    }>(`/api/beneficiaries/${encodeURIComponent(id)}/verify`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ...payload,
        google_access_token: googleAccessToken || undefined
      })
    });
  },

  getAuditTrail: async (id: string): Promise<{ history: AuditTrailEntry[] }> => {
    return request(`/api/beneficiaries/${encodeURIComponent(id)}/audit-trail`);
  },

  // Google Sheets Integration
  getGoogleSheetsStatus: async (): Promise<GoogleSheetsSyncStatus> => {
    return request<GoogleSheetsSyncStatus>('/api/sheets/status');
  },

  syncGoogleSheets: async (): Promise<{
    success: boolean;
    fhsCount: number;
    regCount: number;
    totalCount: number;
    missingVillages: number;
    message: string;
  }> => {
    return request('/api/sheets/sync', {
      method: 'POST'
    });
  },

  ensureSheetHeaders: async (googleAccessToken: string): Promise<{ success: boolean; message: string }> => {
    return request('/api/sheets/ensure-headers', {
      method: 'POST',
      body: JSON.stringify({ google_access_token: googleAccessToken })
    });
  },

  ensureGoogleSheetHeaders: async (googleAccessToken?: string): Promise<{ success: boolean; message: string }> => {
    return request('/api/sheets/ensure-headers', {
      method: 'POST',
      body: JSON.stringify({ google_access_token: googleAccessToken })
    });
  },

  // Google Apps Script Web App Integration
  getAppsScriptConfig: async (): Promise<AppsScriptConfig> => {
    return request<AppsScriptConfig>('/api/apps-script/config');
  },

  updateAppsScriptConfig: async (webAppUrl: string): Promise<{ success: boolean; config: AppsScriptConfig }> => {
    return request('/api/apps-script/config', {
      method: 'POST',
      body: JSON.stringify({ webAppUrl })
    });
  },

  pingAppsScript: async (url?: string): Promise<AppsScriptPingResult> => {
    return request<AppsScriptPingResult>('/api/apps-script/ping', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
  },

  getAppsScriptCode: async (): Promise<{ success: boolean; code: string }> => {
    return request('/api/apps-script/code');
  },

  // Data Import & Audit Management (District Admin only)
  getImportAudit: async (): Promise<ImportAuditSummary> => {
    return request<ImportAuditSummary>('/api/admin/import/audit');
  },

  previewImport: async (csvContent: string): Promise<ImportPreviewResult> => {
    return request<ImportPreviewResult>('/api/admin/import/preview', {
      method: 'POST',
      body: JSON.stringify({ csvContent })
    });
  },

  executeImport: async (payload: { csvContent: string; category: string; filename?: string }): Promise<{
    success: boolean;
    category: string;
    sourceRecords: number;
    importedRecords: number;
    duplicateRecords: number;
    rejectedRecords: number;
    missingTalukRecords: number;
    missingVillageRecords: number;
  }> => {
    return request('/api/admin/import/execute', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Metadata
  getTaluksMeta: async (): Promise<{ taluks: string[] }> => {
    return request('/api/meta/taluks');
  }
};
