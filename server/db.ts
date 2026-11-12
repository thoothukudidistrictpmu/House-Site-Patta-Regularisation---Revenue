import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const GOOGLE_SPREADSHEET_ID = '1wcvgGj_Y6__RpUSDjv5J3D0OWVPiplZLdN0BZ6KPvfw';
export const SHEET_NAME_FHS = 'Free House Site and Regularisation';
export const SHEET_NAME_REG = 'Regularization';
export const SHEET_NAME_USERS = 'User ID';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'portal.db');
const SOURCE_DIR = path.join(DATA_DIR, 'source');
const FREE_HOUSE_SITE_CSV = path.join(SOURCE_DIR, 'free_house_site_patta.csv');
const PATTA_REG_CSV = path.join(SOURCE_DIR, 'patta_regularisation.csv');

// 10 Official Taluks of Thoothukudi District
export const THOOTHUKUDI_TALUKS = [
  'Eral',
  'Ettayapuram',
  'Kayathar',
  'Kovilpatty',
  'Ottapidaram',
  'Sattankulam',
  'Srivaikundam',
  'Thoothukudi',
  'Tiruchendur',
  'Vilathikulam'
] as const;

export type TalukName = typeof THOOTHUKUDI_TALUKS[number];

// Ensure directories
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SOURCE_DIR)) fs.mkdirSync(SOURCE_DIR, { recursive: true });

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initTables(dbInstance);
  }
  return dbInstance;
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computed = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  } catch {
    return false;
  }
}

function initTables(db: DatabaseSync) {
  // TABLE 1: beneficiary_master
  db.exec(`
    CREATE TABLE IF NOT EXISTS beneficiary_master (
      id TEXT PRIMARY KEY,
      source_sno INTEGER NOT NULL,
      beneficiary_name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      taluk TEXT NOT NULL,
      revenue_village TEXT,
      application_category TEXT NOT NULL,
      sheet_name TEXT DEFAULT 'Free House Site and Regularisation',
      sheet_row INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_sno, application_category)
    );

    CREATE INDEX IF NOT EXISTS idx_bm_taluk ON beneficiary_master(taluk);
    CREATE INDEX IF NOT EXISTS idx_bm_category ON beneficiary_master(application_category);
    CREATE INDEX IF NOT EXISTS idx_bm_source_sno ON beneficiary_master(source_sno);

    -- TABLE 2: taluk_verification (Full 13 verification fields + sync tracking)
    CREATE TABLE IF NOT EXISTS taluk_verification (
      id TEXT PRIMARY KEY,
      beneficiary_id TEXT UNIQUE NOT NULL,
      community TEXT,
      patta_issued TEXT DEFAULT 'No',
      patta_number TEXT,
      patta_issue_date TEXT,
      seniority_register_maintained TEXT DEFAULT 'Yes',
      included_in_seniority_register TEXT DEFAULT 'Pending',
      seniority_number TEXT,
      land_occupied TEXT DEFAULT 'Verification Pending',
      relocation_willingness TEXT DEFAULT 'In-situ Regularisation',
      firka TEXT,
      verified_revenue_village TEXT,
      verification_status TEXT DEFAULT 'Pending',
      remarks TEXT,
      proceedings_number TEXT,
      synced_to_sheet INTEGER DEFAULT 0,
      synced_at TEXT,
      updated_by TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (beneficiary_id) REFERENCES beneficiary_master(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tv_status ON taluk_verification(verification_status);
    CREATE INDEX IF NOT EXISTS idx_tv_patta_issued ON taluk_verification(patta_issued);

    -- TABLE 3: verification_audit_trail (Detailed audit log for every change)
    CREATE TABLE IF NOT EXISTS verification_audit_trail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      beneficiary_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      previous_value TEXT,
      updated_value TEXT,
      updated_by TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_beneficiary ON verification_audit_trail(beneficiary_id);

    -- Import Validation & Audit log
    CREATE TABLE IF NOT EXISTS import_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      source_filename TEXT NOT NULL,
      source_records INTEGER NOT NULL,
      imported_records INTEGER NOT NULL,
      duplicate_records INTEGER NOT NULL,
      rejected_records INTEGER NOT NULL,
      missing_taluk_records INTEGER NOT NULL,
      missing_village_records INTEGER NOT NULL,
      imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      designation TEXT NOT NULL,
      role TEXT NOT NULL,
      assigned_taluk TEXT NOT NULL,
      active_status TEXT DEFAULT 'Active',
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      alt_password_hash TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Run safe schema migrations for existing database columns
  safeAddColumn(db, 'beneficiary_master', 'sheet_name', 'TEXT DEFAULT "Free House Site and Regularisation"');
  safeAddColumn(db, 'beneficiary_master', 'sheet_row', 'INTEGER');

  safeAddColumn(db, 'taluk_verification', 'included_in_seniority_register', 'TEXT DEFAULT "Pending"');
  safeAddColumn(db, 'taluk_verification', 'land_occupied', 'TEXT DEFAULT "Verification Pending"');
  safeAddColumn(db, 'taluk_verification', 'synced_to_sheet', 'INTEGER DEFAULT 0');
  safeAddColumn(db, 'taluk_verification', 'synced_at', 'TEXT');

  safeAddColumn(db, 'users', 'alt_password_hash', 'TEXT');

  // Seed default accounts from Worksheet 2 mapping
  seedUsersTable(db);
}

function safeAddColumn(db: DatabaseSync, tableName: string, columnName: string, columnDef: string) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    const exists = tableInfo.some(col => col.name === columnName);
    if (!exists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`);
    }
  } catch (err: any) {
    // Column may already exist or table busy
  }
}

export function seedUsersTable(db: DatabaseSync) {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  
  // Sheet-based passwords and default backup passwords
  // All stored as salted PBKDF2 hashes - never plaintext
  const initialUsers = [
    { id: 'U001', username: 'tahsildar01', altUsername: 'tahsildar1', designation: 'Tahsildar', role: 'Taluk Admin', taluk: 'Eral', sheetPass: 'Tahsildar@01' },
    { id: 'U002', username: 'tahsildar02', altUsername: 'tahsildar2', designation: 'Tahsildar', role: 'Taluk Admin', taluk: 'Ettayapuram', sheetPass: 'Tahsildar@02' },
    { id: 'U003', username: 'tahsildar03', altUsername: 'tahsildar3', designation: 'Tahsildar', role: 'Taluk Admin', taluk: 'Kayathar', sheetPass: 'Tahsildar@03' },
    { id: 'U004', username: 'tahsildar04', altUsername: 'tahsildar4', designation: 'Tahsildar', role: 'Taluk Admin', taluk: 'Kovilpatty', sheetPass: 'Tahsildar@04' },
    { id: 'U005', username: 'tahsildar05', altUsername: 'tahsildar5', designation: 'Tahsildar', role: 'Taluk Admin', taluk: 'Ottapidaram', sheetPass: 'Tahsildar@05' },
    { id: 'U006', username: 'tahsildar06', altUsername: 'tahsildar6', designation: 'Tahsildar', role: 'Taluk Admin', taluk: 'Sattankulam', sheetPass: 'Tahsildar@06' },
    { id: 'U007', username: 'tahsildar07', altUsername: 'tahsildar7', designation: 'Tahsildar', role: 'Taluk Admin', taluk: 'Srivaikundam', sheetPass: 'Tahsildar@07' },
    { id: 'U008', username: 'tahsildar08', altUsername: 'tahsildar8', designation: 'Tahsildar', role: 'Taluk Admin', taluk: 'Thoothukudi', sheetPass: 'Tahsildar@08' },
    { id: 'U009', username: 'tahsildar09', altUsername: 'tahsildar9', designation: 'Tahsildar', role: 'Taluk Admin', taluk: 'Tiruchendur', sheetPass: 'Tahsildar@09' },
    { id: 'U010', username: 'tahsildar10', altUsername: 'tahsildar10', designation: 'Tahsildar', role: 'Taluk Admin', taluk: 'Vilathikulam', sheetPass: 'Tahsildar@10' },
    { id: 'U011', username: 'districtadmin', altUsername: 'collector', designation: 'Collector/DM', role: 'District Admin', taluk: 'All Taluks', sheetPass: 'District@01' }
  ];

  const insert = db.prepare(`
    INSERT OR REPLACE INTO users (
      user_id, username, designation, role, assigned_taluk, active_status, password_hash, password_salt, alt_password_hash
    ) VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, ?)
  `);

  for (const u of initialUsers) {
    const { hash, salt } = hashPassword(u.sheetPass);
    const { hash: altHash } = hashPassword('Patta@2026', salt);
    insert.run(u.id, u.username, u.designation, u.role, u.taluk, hash, salt, altHash);
  }

  console.log('[DB] Synchronized 11 administrative accounts mapped from Worksheet 2 (User ID) with secure PBKDF2 hashing.');
}

/**
 * Parses CSV respecting quotes and newlines
 */
export function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some(col => col.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(col => col.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Validates column headings according to Part 2 & Part 7 specifications
 */
export function validateCSVHeadings(headers: string[]): {
  valid: boolean;
  missingColumns: string[];
  mapping: { snoIndex: number; nameIndex: number; addrIndex: number; phoneIndex: number; talukIndex: number; villageIndex: number };
} {
  const norm = headers.map(h => h.toLowerCase().trim());

  let snoIndex = norm.findIndex(h => h.startsWith('s.no') || h.startsWith('s_no') || h === 'sno');
  let nameIndex = norm.findIndex(h => h.includes('beneficiary name') || h === 'name');
  let addrIndex = norm.findIndex(h => h.startsWith('address') || h === 'address_1');
  let phoneIndex = norm.findIndex(h => h.includes('phone') || h.includes('mobile'));
  let talukIndex = norm.findIndex(h => h.includes('taluk'));
  let villageIndex = norm.findIndex(h => h.includes('village') || h.includes('வருவாய் கிராமம்'));

  if (snoIndex === -1 && norm.length >= 6) snoIndex = 0;
  if (nameIndex === -1 && norm.length >= 6) nameIndex = 1;
  if (addrIndex === -1 && norm.length >= 6) addrIndex = 2;
  if (phoneIndex === -1 && norm.length >= 6) phoneIndex = 3;
  if (talukIndex === -1 && norm.length >= 6) talukIndex = 4;
  if (villageIndex === -1 && norm.length >= 6) villageIndex = 5;

  const missingColumns: string[] = [];
  if (snoIndex === -1) missingColumns.push('S.No');
  if (nameIndex === -1) missingColumns.push('Beneficiary Name');
  if (addrIndex === -1) missingColumns.push('Address_1');
  if (phoneIndex === -1) missingColumns.push('Phone');
  if (talukIndex === -1) missingColumns.push('Taluk');
  if (villageIndex === -1) missingColumns.push('Revenue Village');

  return {
    valid: missingColumns.length === 0,
    missingColumns,
    mapping: { snoIndex, nameIndex, addrIndex, phoneIndex, talukIndex, villageIndex }
  };
}

/**
 * Synchronizes beneficiary master data from the central Google Spreadsheet
 */
export async function syncFromGoogleSpreadsheet(spreadsheetId: string = GOOGLE_SPREADSHEET_ID): Promise<{
  success: boolean;
  fhsCount: number;
  regCount: number;
  totalCount: number;
  missingVillages: number;
  message: string;
}> {
  console.log(`[GoogleSheetsSync] Connecting to central Google Spreadsheet: ${spreadsheetId}...`);
  const db = getDb();

  // Fetch both worksheets
  const fhsUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME_FHS)}`;
  const regUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME_REG)}`;

  const [fhsRes, regRes] = await Promise.all([
    fetch(fhsUrl),
    fetch(regUrl)
  ]);

  if (!fhsRes.ok) {
    throw new Error(`Failed to fetch worksheet "${SHEET_NAME_FHS}": HTTP ${fhsRes.status}`);
  }

  const [fhsText, regText] = await Promise.all([
    fhsRes.text(),
    regRes.ok ? regRes.text() : ''
  ]);

  const fhsRows = parseCSV(fhsText);
  const regRows = regText ? parseCSV(regText) : [];

  console.log(`[GoogleSheetsSync] Parsed ${fhsRows.length - 1} FHS rows, ${regRows.length > 1 ? regRows.length - 1 : 0} Regularisation rows.`);

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO beneficiary_master (
      id, source_sno, beneficiary_name, address, phone, taluk, revenue_village, application_category, sheet_name, sheet_row
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let fhsCount = 0;
  let regCount = 0;
  let missingVillages = 0;

  db.exec('BEGIN TRANSACTION');
  try {
    // 1. Process Free House Site Patta worksheet (S.No starting at row 2)
    for (let i = 1; i < fhsRows.length; i++) {
      const row = fhsRows[i];
      if (!row || row.length < 2) continue;

      const sNoRaw = parseInt((row[0] || '').replace(/[^0-9]/g, ''), 10);
      const sNo = isNaN(sNoRaw) ? i : sNoRaw;
      const name = (row[1] || '').trim();
      if (!name) continue;

      const address = (row[2] || '').trim() || null;
      const phone = (row[3] || '').trim() || null;
      const taluk = (row[4] || '').trim();
      const villageRaw = (row[5] || '').trim();
      const village = villageRaw.length > 0 ? villageRaw : null;
      if (!village) missingVillages++;

      const internalId = `TNK-THOO-FH-${String(sNo).padStart(5, '0')}`;
      const sheetRow = i + 1; // 1-indexed row in sheet

      insertStmt.run(internalId, sNo, name, address, phone, taluk, village, 'New Free House Site Patta', SHEET_NAME_FHS, sheetRow);
      fhsCount++;
    }

    // 2. Process Regularisation worksheet (S.No starting at row 2)
    if (regRows.length > 1) {
      for (let i = 1; i < regRows.length; i++) {
        const row = regRows[i];
        if (!row || row.length < 2) continue;

        const sNoRaw = parseInt((row[0] || '').replace(/[^0-9]/g, ''), 10);
        const sNo = isNaN(sNoRaw) ? i : sNoRaw;
        const name = (row[1] || '').trim();
        if (!name) continue;

        const address = (row[2] || '').trim() || null;
        const phone = (row[3] || '').trim() || null;
        const taluk = (row[4] || '').trim();
        const villageRaw = (row[5] || '').trim();
        const village = villageRaw.length > 0 ? villageRaw : null;
        if (!village) missingVillages++;

        const internalId = `TNK-THOO-REG-${String(sNo).padStart(5, '0')}`;
        const sheetRow = i + 1;

        insertStmt.run(internalId, sNo, name, address, phone, taluk, village, 'Patta Regularisation', SHEET_NAME_REG, sheetRow);
        regCount++;
      }
    }

    // Audit log
    db.prepare(`
      INSERT INTO import_audit (
        category, source_filename, source_records, imported_records, duplicate_records,
        rejected_records, missing_taluk_records, missing_village_records
      ) VALUES ('Google Sheets Live Sync', ?, ?, ?, 0, 0, 0, ?)
    `).run(
      `spreadsheet:${spreadsheetId}`,
      fhsCount + regCount,
      fhsCount + regCount,
      missingVillages
    );

    db.exec('COMMIT');
    console.log(`[GoogleSheetsSync] Synchronized ${fhsCount + regCount} master records from Google Sheets.`);

    return {
      success: true,
      fhsCount,
      regCount,
      totalCount: fhsCount + regCount,
      missingVillages,
      message: `Successfully synchronized ${fhsCount + regCount} records directly from Google Spreadsheet.`
    };
  } catch (err: any) {
    db.exec('ROLLBACK');
    console.error('[GoogleSheetsSync] Sync failed:', err);
    throw err;
  }
}

/**
 * Writes verification details back to the corresponding row in the Google Spreadsheet
 */
export async function writeBeneficiaryToGoogleSheet(
  spreadsheetId: string,
  sheetName: string,
  sheetRow: number,
  verification: {
    category: string;
    community: string;
    patta_issued: string;
    patta_number: string;
    patta_issue_date: string;
    seniority_register_maintained: string;
    included_in_seniority_register: string;
    seniority_number: string;
    land_occupied: string;
    relocation_willingness: string;
    firka: string;
    verified_revenue_village: string;
    remarks: string;
    verification_status: string;
    updated_by: string;
    updated_at: string;
    beneficiary_id: string;
  },
  googleAccessToken: string
): Promise<{ success: boolean; updatedRange: string }> {
  if (!googleAccessToken) {
    throw new Error('Google authorization token is required to write updates back to Google Sheets.');
  }

  // Target columns G through W in the corresponding row
  const range = `'${sheetName}'!G${sheetRow}:W${sheetRow}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const values = [
    [
      verification.category || '',
      verification.community || '',
      verification.patta_issued || 'No',
      verification.patta_number || '',
      verification.patta_issue_date || '',
      verification.seniority_register_maintained || 'Yes',
      verification.included_in_seniority_register || 'Pending',
      verification.seniority_number || '',
      verification.land_occupied || 'Verification Pending',
      verification.relocation_willingness || '',
      verification.firka || '',
      verification.verified_revenue_village || '',
      verification.remarks || '',
      verification.verification_status || 'Pending',
      verification.updated_by || 'Tahsildar',
      verification.updated_at || new Date().toISOString(),
      verification.beneficiary_id || ''
    ]
  ];

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${googleAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values
    })
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.error?.message) errorDetail = errJson.error.message;
    } catch {
      // ignore
    }
    throw new Error(`Google Sheets API write failed: ${errorDetail}`);
  }

  const result = await response.json();
  console.log(`[GoogleSheetsSync] Successfully wrote verification details to Google Sheets row ${sheetRow} in "${sheetName}".`);
  return { success: true, updatedRange: result.updatedRange || range };
}

/**
 * Ensures verification column headers exist in row 1 (columns G to W)
 */
export async function ensureSheetHeaders(
  spreadsheetId: string,
  sheetName: string,
  googleAccessToken: string
): Promise<void> {
  if (!googleAccessToken) return;

  const headerRange = `'${sheetName}'!G1:W1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(headerRange)}?valueInputOption=USER_ENTERED`;

  const headers = [
    [
      'Category',
      'Community',
      'Patta Issued',
      'Patta Number',
      'Patta Issue Date',
      'Seniority Register Maintained',
      'Included in Seniority Register',
      'Seniority Number',
      'Land Occupied',
      'Willingness to Relocate',
      'Verified Firka',
      'Verified Revenue Village',
      'Verification Remarks',
      'Verification Status',
      'Verified By',
      'Verified At',
      'Beneficiary ID'
    ]
  ];

  try {
    await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: headerRange,
        majorDimension: 'ROWS',
        values: headers
      })
    });
    console.log(`[GoogleSheetsSync] Verified/created verification headers in "${sheetName}"!G1:W1`);
  } catch (err: any) {
    console.warn(`[GoogleSheetsSync] Notice updating headers for "${sheetName}":`, err.message);
  }
}

/**
 * Seeds or synchronizes the database from the official datasets into beneficiary_master
 */
export function seedMasterBeneficiaries(force = false) {
  const db = getDb();
  const countRow = db.prepare('SELECT COUNT(*) as count FROM beneficiary_master').get() as { count: number };

  // If already populated with sheet rows, ensure sheet_row references exist
  if (countRow.count >= 29533 && !force) {
    return {
      success: true,
      records: countRow.count,
      message: 'Database already initialized with source datasets'
    };
  }

  console.log('[DB] Initializing beneficiary_master from source datasets...');

  if (!fs.existsSync(FREE_HOUSE_SITE_CSV) || !fs.existsSync(PATTA_REG_CSV)) {
    throw new Error('Source CSV files missing in data/source directory');
  }

  const freeHouseSiteData = fs.readFileSync(FREE_HOUSE_SITE_CSV, 'utf-8');
  const pattaRegData = fs.readFileSync(PATTA_REG_CSV, 'utf-8');

  const fhsRows = parseCSV(freeHouseSiteData);
  const regRows = parseCSV(pattaRegData);

  db.exec('BEGIN TRANSACTION');
  try {
    if (force) {
      db.exec('DELETE FROM beneficiary_master');
      db.exec('DELETE FROM import_audit');
    }

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO beneficiary_master (
        id, source_sno, beneficiary_name, address, phone, taluk, revenue_village, application_category, sheet_name, sheet_row
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. Import New Free House Site Patta (Expected 28,701)
    let fhsImported = 0;
    let fhsDuplicates = 0;
    let fhsMissingVillage = 0;
    let fhsMissingTaluk = 0;
    for (let i = 1; i < fhsRows.length; i++) {
      const row = fhsRows[i];
      if (!row || row.length < 2) continue;
      const sNoRaw = parseInt(row[0].replace(/[^0-9]/g, ''), 10);
      const sNo = isNaN(sNoRaw) ? fhsImported + 1 : sNoRaw;
      const name = (row[1] || '').trim();
      if (!name) continue;
      const address = (row[2] || '').trim() || null;
      const phone = (row[3] || '').trim() || null;
      const taluk = (row[4] || '').trim();
      const villageRaw = (row[5] || '').trim();
      const village = villageRaw.length > 0 ? villageRaw : null;

      if (!taluk) fhsMissingTaluk++;
      if (!village) fhsMissingVillage++;

      const internalId = `TNK-THOO-FH-${String(sNo).padStart(5, '0')}`;
      const sheetRow = i + 1; // Row in sheet
      const res = insertStmt.run(internalId, sNo, name, address, phone, taluk, village, 'New Free House Site Patta', SHEET_NAME_FHS, sheetRow);
      if (res.changes > 0) fhsImported++;
      else fhsDuplicates++;
    }

    // 2. Import Patta Regularisation (Expected 832)
    let regImported = 0;
    let regDuplicates = 0;
    let regMissingVillage = 0;
    let regMissingTaluk = 0;
    for (let i = 1; i < regRows.length; i++) {
      const row = regRows[i];
      if (!row || row.length < 2) continue;
      const sNoRaw = parseInt(row[0].replace(/[^0-9]/g, ''), 10);
      const sNo = isNaN(sNoRaw) ? regImported + 1 : sNoRaw;
      const name = (row[1] || '').trim();
      if (!name) continue;
      const address = (row[2] || '').trim() || null;
      const phone = (row[3] || '').trim() || null;
      const taluk = (row[4] || '').trim();
      const villageRaw = (row[5] || '').trim();
      const village = villageRaw.length > 0 ? villageRaw : null;

      if (!taluk) regMissingTaluk++;
      if (!village) regMissingVillage++;

      const internalId = `TNK-THOO-REG-${String(sNo).padStart(5, '0')}`;
      const sheetRow = i + 1;
      const res = insertStmt.run(internalId, sNo, name, address, phone, taluk, village, 'Patta Regularisation', SHEET_NAME_REG, sheetRow);
      if (res.changes > 0) regImported++;
      else regDuplicates++;
    }

    // Record in import_audit
    const auditStmt = db.prepare(`
      INSERT INTO import_audit (
        category, source_filename, source_records, imported_records, duplicate_records,
        rejected_records, missing_taluk_records, missing_village_records
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec('DELETE FROM import_audit');
    auditStmt.run('New Free House Site Patta', 'free_house_site_patta.csv', 28701, fhsImported, fhsDuplicates, 0, fhsMissingTaluk, fhsMissingVillage);
    auditStmt.run('Patta Regularisation', 'patta_regularisation.csv', 832, regImported, regDuplicates, 0, regMissingTaluk, regMissingVillage);

    db.exec('COMMIT');
    console.log(`[DB] Successfully verified beneficiary_master: FHS=${fhsImported}, Reg=${regImported}, Total=${fhsImported + regImported}`);

    return {
      success: true,
      records: fhsImported + regImported,
      fhsImported,
      regImported,
      fhsDuplicates,
      regDuplicates
    };
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('[DB] Failed to seed beneficiary_master:', err);
    throw err;
  }
}
