export type UserRole = 'Taluk Admin' | 'District Admin';

export interface UserAccount {
  user_id: string;
  username: string;
  designation: string;
  role: UserRole;
  assigned_taluk: string;
  active_status: string;
  id?: string;
  taluk?: string;
}

export interface Beneficiary {
  id: string;
  source_sno: number;
  s_no?: number;
  beneficiary_name: string;
  address: string | null;
  phone: string | null;
  taluk: string;
  revenue_village: string | null;
  application_category: string;
  created_at: string;
  category?: 'FREE_HOUSE_SITE' | 'PATTA_REGULARISATION';
  sheet_name?: string;
  sheet_row?: number;

  // Joined fields from taluk_verification
  patta_issued?: string | number | null;
  patta_number?: string | null;
  patta_issue_date?: string | null;
  proceedings_number?: string | null;
  seniority_register_maintained?: string | number | null;
  included_in_seniority_register?: string | null;
  seniority_number?: string | null;
  land_occupied?: string | null;
  community?: string | null;
  relocation_willingness?: string | null;
  firka?: string | null;
  verified_revenue_village?: string | null;
  verification_status?: string;
  status?: string;
  remarks?: string | null;
  synced_to_sheet?: number | null;
  synced_at?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

export interface TalukVerification {
  id?: string;
  beneficiary_id: string;
  community?: string | null;
  patta_issued: string | number; // 'Yes' | 'No' | 'Verification Pending' (or 1/0)
  patta_number?: string | null;
  patta_issue_date?: string | null;
  seniority_register_maintained?: string | number; // 'Yes' | 'No' | 'Verification Pending'
  included_in_seniority_register?: string | null; // 'Yes' | 'No' | 'Pending'
  seniority_number?: string | null;
  land_occupied?: string | null; // 'Yes' | 'No' | 'Partially Occupied' | 'Verification Pending'
  relocation_willingness?: string | null; // 'Yes' | 'No' | 'Response Pending' | 'Not Applicable' | 'In-situ Regularisation'
  firka?: string | null;
  verified_revenue_village?: string | null;
  verification_status?: string; // 'Pending' | 'Completed'
  remarks?: string | null;
  proceedings_number?: string | null;
  synced_to_sheet?: number;
  synced_at?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

export interface AuditTrailEntry {
  id: number;
  beneficiary_id: string;
  field_name: string;
  previous_value: string | null;
  updated_value: string | null;
  updated_by: string;
  updated_at: string;
}

export interface GoogleSheetsSyncStatus {
  spreadsheetId: string;
  connected: boolean;
  sheets: {
    name: string;
    totalRows: number;
    gid: string;
  }[];
  lastSyncAt: string | null;
  totalBeneficiaries: number;
  totalSyncedToSheet: number;
}

export interface TahsildarModuleStats {
  title: string;
  category: 'FREE_HOUSE_SITE' | 'PATTA_REGULARISATION' | string;
  totalRecords: number;
  completed: number;
  pending: number;
  completionPercentage?: number;
}

export interface TahsildarDashboardData {
  taluk: string;
  designation: string;
  totalBeneficiaries: number;
  completedRecords: number;
  pendingRecords: number;
  completionPercentage: number;
  module1: TahsildarModuleStats;
  module2: TahsildarModuleStats;
}

export interface TalukProgressItem {
  taluk: string;
  totalBeneficiaries: number;
  newHouseSite: number;
  newHouseSiteCompleted: number;
  newHouseSitePending: number;
  pattaRegularisation: number;
  pattaRegularisationCompleted: number;
  pattaRegularisationPending: number;
  completed: number;
  pending: number;
  pattaIssued: number;
  pattaNotIssued: number;
  completionPercentage: number;
}

export interface CollectorDashboardData {
  totalNewHouseSite: number;
  totalPattaRegularisation: number;
  totalDistrictBeneficiaries: number;
  totalCompleted: number;
  totalPending: number;
  pattaIssued: number;
  pattaNotIssued: number;
  seniorityVerified: number;
  seniorityPending: number;
  inProcess?: number;
  rejected?: number;
  talukProgress: TalukProgressItem[];
  auditLogs?: ImportAuditRecord[];
  sheetsSyncStatus?: GoogleSheetsSyncStatus;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ImportAuditRecord {
  id: number;
  imported_at: string;
  category: string;
  source_filename: string;
  source_records: number;
  imported_records: number;
  duplicate_records: number;
  rejected_records: number;
  missing_taluk_records: number;
  missing_village_records: number;
}

export interface ImportAuditSummary {
  expectedTotals: {
    newFreeHouseSite: number;
    pattaRegularisation: number;
    combinedTotal: number;
  };
  liveCounts: {
    newFreeHouseSite: number;
    pattaRegularisation: number;
    combinedTotal: number;
    missingVillageTotal: number;
    missingTalukTotal: number;
    fhsMissingVillage: number;
    regMissingVillage: number;
  };
  auditLogs: ImportAuditRecord[];
  sheetsStatus?: GoogleSheetsSyncStatus;
}

export interface ImportPreviewResult {
  valid: boolean;
  totalRows: number;
  header: string[];
  sampleRows: Array<{
    index: number;
    sno: string;
    name: string;
    address: string;
    phone: string;
    taluk: string;
    revenue_village: string;
  }>;
}

export interface AppsScriptConfig {
  webAppUrl: string;
  apiSecretKey: string;
  spreadsheetId: string;
  lastConnectedAt: string | null;
  lastStatus: 'ONLINE' | 'OFFLINE' | 'UNCONFIGURED';
}

export interface AppsScriptPingResult {
  success: boolean;
  status: string;
  message: string;
  details?: any;
}
