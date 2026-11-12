import { Router } from 'express';
import {
  getDb,
  seedMasterBeneficiaries,
  parseCSV,
  validateCSVHeadings,
  THOOTHUKUDI_TALUKS,
  verifyPassword,
  GOOGLE_SPREADSHEET_ID,
  SHEET_NAME_FHS,
  SHEET_NAME_REG,
  SHEET_NAME_USERS,
  syncFromGoogleSpreadsheet,
  writeBeneficiaryToGoogleSheet,
  ensureSheetHeaders
} from './db.ts';
import {
  getUserByUsernameOrId,
  getAllUsers,
  resetPassword,
  updateStatus,
  createSession,
  getSession,
  removeSession,
  authMiddleware,
  enforceTalukScope,
  AuthenticatedRequest
} from './auth.ts';

export const apiRouter = Router();

// ==========================================
// 1. Authentication Endpoints
// ==========================================

apiRouter.post('/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter both Username and Password.' });
  }

  const user = getUserByUsernameOrId(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  if (user.active_status !== 'Active') {
    return res.status(403).json({ error: 'This administrative account is inactive. Please contact District Collectorate.' });
  }

  const isValid = verifyPassword(password, user.password_hash, user.password_salt) ||
    (user.alt_password_hash ? verifyPassword(password, user.alt_password_hash, user.password_salt) : false);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = createSession({
    user_id: user.user_id,
    username: user.username,
    designation: user.designation,
    role: user.role,
    assigned_taluk: user.assigned_taluk,
    active_status: user.active_status,
    id: user.user_id,
    taluk: user.assigned_taluk
  });

  res.json({
    success: true,
    token,
    user: {
      user_id: user.user_id,
      username: user.username,
      designation: user.designation,
      role: user.role,
      assigned_taluk: user.assigned_taluk,
      active_status: user.active_status,
      id: user.user_id,
      taluk: user.assigned_taluk
    }
  });
});

apiRouter.get('/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ authenticated: false });
  }
  const token = authHeader.split(' ')[1];
  const user = getSession(token);
  if (!user) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({ authenticated: true, user });
});

apiRouter.post('/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    removeSession(token);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// User Management (District Admin only)
apiRouter.get('/auth/users', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== 'District Admin' && req.user?.assigned_taluk !== 'All Taluks') {
    return res.status(403).json({ error: 'Access restricted to District Admin' });
  }
  const users = getAllUsers();
  res.json({ users });
});

apiRouter.put('/auth/users/:userId/password', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== 'District Admin' && req.user?.assigned_taluk !== 'All Taluks') {
    return res.status(403).json({ error: 'Only District Admin can reset passwords' });
  }

  const { newPassword } = req.body;
  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const ok = resetPassword(req.params.userId, newPassword);
  if (!ok) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ success: true, message: 'Password reset successfully' });
});

apiRouter.put('/auth/users/:userId/status', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== 'District Admin' && req.user?.assigned_taluk !== 'All Taluks') {
    return res.status(403).json({ error: 'Only District Admin can update account status' });
  }

  const { status } = req.body;
  if (status !== 'Active' && status !== 'Inactive') {
    return res.status(400).json({ error: 'Status must be Active or Inactive' });
  }

  const ok = updateStatus(req.params.userId, status);
  if (!ok) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ success: true, message: `User status set to ${status}` });
});

// ==========================================
// 2. Collector Dashboard Statistics
// ==========================================

apiRouter.get('/dashboard/collector', authMiddleware, (req: AuthenticatedRequest, res) => {
  const db = getDb();

  // 1. Total Beneficiaries from beneficiary_master
  const totalRow = db.prepare('SELECT COUNT(*) as total FROM beneficiary_master').get() as { total: number };
  const totalBeneficiaries = totalRow.total;

  // 2. Category counts
  const catRows = db.prepare(`
    SELECT application_category, COUNT(*) as count 
    FROM beneficiary_master 
    GROUP BY application_category
  `).all() as { application_category: string; count: number }[];

  const totalNewHouseSite = catRows.find(c => c.application_category.includes('Free House Site'))?.count || 0;
  const totalPattaRegularisation = catRows.find(c => c.application_category.includes('Regularisation'))?.count || 0;

  // 3. Verification & Questionnaire Metrics
  const verifRow = db.prepare(`
    SELECT 
      SUM(CASE WHEN tv.verification_status = 'Completed' THEN 1 ELSE 0 END) as completed_count,
      SUM(CASE WHEN tv.patta_issued = 'Yes' OR tv.patta_issued = 1 OR tv.patta_issued = '1' THEN 1 ELSE 0 END) as patta_issued_count,
      SUM(CASE WHEN tv.verification_status = 'Completed' AND (tv.patta_issued = 'No' OR tv.patta_issued = 0 OR tv.patta_issued = '0') THEN 1 ELSE 0 END) as patta_not_issued_count,
      SUM(CASE WHEN (tv.seniority_register_maintained = 'Yes' OR tv.seniority_register_maintained = 1) AND tv.seniority_number IS NOT NULL AND tv.seniority_number != '' THEN 1 ELSE 0 END) as seniority_verified_count,
      SUM(CASE WHEN tv.synced_to_sheet = 1 THEN 1 ELSE 0 END) as synced_sheet_count
    FROM taluk_verification tv
  `).get() as {
    completed_count: number | null;
    patta_issued_count: number | null;
    patta_not_issued_count: number | null;
    seniority_verified_count: number | null;
    synced_sheet_count: number | null;
  };

  const totalCompleted = verifRow?.completed_count || 0;
  const totalPending = totalBeneficiaries - totalCompleted;
  const pattaIssued = verifRow?.patta_issued_count || 0;
  const pattaNotIssued = verifRow?.patta_not_issued_count || 0;
  const seniorityVerified = verifRow?.seniority_verified_count || 0;
  const seniorityPending = totalBeneficiaries - seniorityVerified;
  const totalSyncedToSheet = verifRow?.synced_sheet_count || 0;

  // 4. Taluk-Wise Progress for all 10 taluks
  const talukData = db.prepare(`
    SELECT 
      bm.taluk,
      COUNT(bm.id) as total_beneficiaries,
      SUM(CASE WHEN bm.application_category = 'New Free House Site Patta' THEN 1 ELSE 0 END) as fhs_total,
      SUM(CASE WHEN bm.application_category = 'New Free House Site Patta' AND tv.verification_status = 'Completed' THEN 1 ELSE 0 END) as fhs_completed,
      SUM(CASE WHEN bm.application_category = 'Patta Regularisation' THEN 1 ELSE 0 END) as reg_total,
      SUM(CASE WHEN bm.application_category = 'Patta Regularisation' AND tv.verification_status = 'Completed' THEN 1 ELSE 0 END) as reg_completed,
      SUM(CASE WHEN tv.verification_status = 'Completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN tv.patta_issued = 'Yes' OR tv.patta_issued = 1 OR tv.patta_issued = '1' THEN 1 ELSE 0 END) as patta_issued,
      SUM(CASE WHEN tv.verification_status = 'Completed' AND (tv.patta_issued = 'No' OR tv.patta_issued = 0 OR tv.patta_issued = '0') THEN 1 ELSE 0 END) as patta_not_issued
    FROM beneficiary_master bm
    LEFT JOIN taluk_verification tv ON bm.id = tv.beneficiary_id
    GROUP BY bm.taluk
    ORDER BY total_beneficiaries DESC
  `).all() as Array<{
    taluk: string;
    total_beneficiaries: number;
    fhs_total: number;
    fhs_completed: number;
    reg_total: number;
    reg_completed: number;
    completed: number;
    patta_issued: number;
    patta_not_issued: number;
  }>;

  const talukProgress = talukData.map(t => {
    const total = t.total_beneficiaries || 0;
    const completed = t.completed || 0;
    const pending = total - completed;
    const completionPercentage = total > 0 ? Number(((completed / total) * 100).toFixed(2)) : 0;
    return {
      taluk: t.taluk,
      totalBeneficiaries: total,
      newHouseSite: t.fhs_total,
      newHouseSiteCompleted: t.fhs_completed,
      newHouseSitePending: t.fhs_total - t.fhs_completed,
      pattaRegularisation: t.reg_total,
      pattaRegularisationCompleted: t.reg_completed,
      pattaRegularisationPending: t.reg_total - t.reg_completed,
      completed,
      pending,
      pattaIssued: t.patta_issued,
      pattaNotIssued: t.patta_not_issued,
      completionPercentage
    };
  });

  const auditLogs = db.prepare('SELECT * FROM import_audit ORDER BY id DESC LIMIT 20').all();

  res.json({
    totalNewHouseSite,
    totalPattaRegularisation,
    totalDistrictBeneficiaries: totalBeneficiaries,
    totalCompleted,
    totalPending,
    pattaIssued,
    pattaNotIssued,
    seniorityVerified,
    seniorityPending,
    talukProgress,
    auditLogs,
    sheetsSyncStatus: {
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      connected: true,
      sheets: [
        { name: SHEET_NAME_FHS, totalRows: 28701, gid: '604455956' },
        { name: SHEET_NAME_REG, totalRows: 832, gid: '1565201227' },
        { name: SHEET_NAME_USERS, totalRows: 11, gid: '1260747954' }
      ],
      lastSyncAt: auditLogs.length > 0 ? (auditLogs[0] as any).imported_at : null,
      totalBeneficiaries,
      totalSyncedToSheet
    }
  });
});

// ==========================================
// 3. Tahsildar Dashboard Statistics
// ==========================================

apiRouter.get('/dashboard/tahsildar/:taluk', authMiddleware, enforceTalukScope, (req: AuthenticatedRequest, res) => {
  const taluk = req.params.taluk;
  const db = getDb();

  // 1. Total Beneficiaries for this Taluk in beneficiary_master
  const totalRow = db.prepare(`
    SELECT COUNT(*) as total 
    FROM beneficiary_master 
    WHERE LOWER(taluk) = LOWER(?)
  `).get(taluk) as { total: number };
  const totalBeneficiaries = totalRow?.total || 0;

  // 2. Module 1: Free House Site Patta breakdown
  const fhsRow = db.prepare(`
    SELECT 
      COUNT(bm.id) as total,
      SUM(CASE WHEN tv.verification_status = 'Completed' THEN 1 ELSE 0 END) as completed
    FROM beneficiary_master bm
    LEFT JOIN taluk_verification tv ON bm.id = tv.beneficiary_id
    WHERE LOWER(bm.taluk) = LOWER(?) AND bm.application_category = 'New Free House Site Patta'
  `).get(taluk) as { total: number; completed: number | null };

  const fhsTotal = fhsRow?.total || 0;
  const fhsCompleted = fhsRow?.completed || 0;
  const fhsPending = fhsTotal - fhsCompleted;
  const fhsPercentage = fhsTotal > 0 ? Number(((fhsCompleted / fhsTotal) * 100).toFixed(2)) : 0;

  // 3. Module 2: Patta Regularisation breakdown
  const regRow = db.prepare(`
    SELECT 
      COUNT(bm.id) as total,
      SUM(CASE WHEN tv.verification_status = 'Completed' THEN 1 ELSE 0 END) as completed
    FROM beneficiary_master bm
    LEFT JOIN taluk_verification tv ON bm.id = tv.beneficiary_id
    WHERE LOWER(bm.taluk) = LOWER(?) AND bm.application_category = 'Patta Regularisation'
  `).get(taluk) as { total: number; completed: number | null };

  const regTotal = regRow?.total || 0;
  const regCompleted = regRow?.completed || 0;
  const regPending = regTotal - regCompleted;
  const regPercentage = regTotal > 0 ? Number(((regCompleted / regTotal) * 100).toFixed(2)) : 0;

  // 4. Combined totals for Tahsildar
  const completedRecords = fhsCompleted + regCompleted;
  const pendingRecords = totalBeneficiaries - completedRecords;
  const completionPercentage = totalBeneficiaries > 0 ? Number(((completedRecords / totalBeneficiaries) * 100).toFixed(2)) : 0;

  res.json({
    taluk,
    designation: 'Tahsildar',
    totalBeneficiaries,
    completedRecords,
    pendingRecords,
    completionPercentage,
    module1: {
      title: 'New Free House Site Patta',
      category: 'New Free House Site Patta',
      totalRecords: fhsTotal,
      completed: fhsCompleted,
      pending: fhsPending,
      completionPercentage: fhsPercentage
    },
    module2: {
      title: 'Patta Regularisation',
      category: 'Patta Regularisation',
      totalRecords: regTotal,
      completed: regCompleted,
      pending: regPending,
      completionPercentage: regPercentage
    }
  });
});

// ==========================================
// 4. Beneficiary Management Endpoints
// ==========================================

apiRouter.get('/beneficiaries', authMiddleware, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;

  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string, 10) || 25));
  const offset = (page - 1) * limit;

  // Filter params
  let taluk = req.query.taluk as string;
  if (user.role === 'Taluk Admin' || user.assigned_taluk !== 'All Taluks') {
    taluk = user.assigned_taluk;
  }

  const categoryParam = req.query.category as string;
  let categoryFilter = '';
  if (categoryParam) {
    if (categoryParam.includes('Free House Site') || categoryParam === 'FREE_HOUSE_SITE') {
      categoryFilter = 'New Free House Site Patta';
    } else if (categoryParam.includes('Regularisation') || categoryParam === 'PATTA_REGULARISATION') {
      categoryFilter = 'Patta Regularisation';
    }
  }

  const search = (req.query.search as string || '').trim();
  const status = req.query.status as string;

  const whereClauses: string[] = ['1=1'];
  const params: any[] = [];

  if (taluk && taluk !== 'ALL') {
    whereClauses.push('LOWER(bm.taluk) = LOWER(?)');
    params.push(taluk);
  }

  if (categoryFilter) {
    whereClauses.push('bm.application_category = ?');
    params.push(categoryFilter);
  }

  if (status && status !== 'ALL') {
    if (status === 'Completed' || status === 'COMPLETED') {
      whereClauses.push("tv.verification_status = 'Completed'");
    } else if (status === 'Pending' || status === 'PENDING') {
      whereClauses.push("(tv.verification_status IS NULL OR tv.verification_status = 'Pending')");
    } else if (status === 'Patta Issued' || status === 'PATTA_ISSUED') {
      whereClauses.push("(tv.patta_issued = 'Yes' OR tv.patta_issued = 1 OR tv.patta_issued = '1')");
    } else if (status === 'Patta Not Issued' || status === 'PATTA_NOT_ISSUED') {
      whereClauses.push("tv.verification_status = 'Completed' AND (tv.patta_issued = 'No' OR tv.patta_issued = 0 OR tv.patta_issued = '0')");
    }
  }

  if (search) {
    whereClauses.push(`(
      bm.beneficiary_name LIKE ? OR 
      bm.id LIKE ? OR 
      bm.phone LIKE ? OR 
      bm.address LIKE ? OR
      CAST(bm.source_sno AS TEXT) = ?
    )`);
    const sTerm = `%${search}%`;
    params.push(sTerm, sTerm, sTerm, sTerm, search);
  }

  const whereSql = whereClauses.join(' AND ');

  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM beneficiary_master bm LEFT JOIN taluk_verification tv ON bm.id = tv.beneficiary_id WHERE ${whereSql}`);
  const totalCount = (countStmt.get(...params) as { count: number }).count;

  const queryStmt = db.prepare(`
    SELECT 
      bm.id,
      bm.source_sno,
      bm.source_sno as s_no,
      bm.beneficiary_name,
      bm.address,
      bm.phone,
      bm.taluk,
      bm.revenue_village,
      bm.application_category,
      bm.sheet_name,
      bm.sheet_row,
      bm.created_at,
      tv.patta_issued,
      tv.patta_number,
      tv.patta_issue_date,
      tv.proceedings_number,
      tv.seniority_register_maintained,
      tv.included_in_seniority_register,
      tv.seniority_number,
      tv.land_occupied,
      tv.community,
      tv.relocation_willingness,
      tv.firka,
      tv.verified_revenue_village,
      COALESCE(tv.verification_status, 'Pending') as verification_status,
      tv.remarks,
      tv.synced_to_sheet,
      tv.synced_at,
      tv.updated_by,
      tv.updated_at
    FROM beneficiary_master bm
    LEFT JOIN taluk_verification tv ON bm.id = tv.beneficiary_id
    WHERE ${whereSql}
    ORDER BY bm.taluk ASC, bm.source_sno ASC
    LIMIT ? OFFSET ?
  `);

  const rows = queryStmt.all(...params, limit, offset);
  const totalPages = Math.ceil(totalCount / limit);

  res.json({
    beneficiaries: rows,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
});

apiRouter.get('/beneficiaries/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;
  const id = req.params.id;

  const beneficiary = db.prepare(`
    SELECT 
      bm.id,
      bm.source_sno,
      bm.beneficiary_name,
      bm.address,
      bm.phone,
      bm.taluk,
      bm.revenue_village,
      bm.application_category,
      bm.sheet_name,
      bm.sheet_row,
      bm.created_at
    FROM beneficiary_master bm
    WHERE bm.id = ?
  `).get(id) as any;

  if (!beneficiary) {
    return res.status(404).json({ error: 'Beneficiary record not found' });
  }

  // Enforce taluk boundary for Tahsildar
  if (user.role === 'Taluk Admin' && user.assigned_taluk !== 'All Taluks' && beneficiary.taluk.toLowerCase() !== user.assigned_taluk.toLowerCase()) {
    return res.status(403).json({
      error: `Access restricted: Record belongs to ${beneficiary.taluk} Taluk. You are authorized only for ${user.assigned_taluk} Taluk.`
    });
  }

  const verification = db.prepare(`
    SELECT * FROM taluk_verification WHERE beneficiary_id = ?
  `).get(id);

  res.json({
    beneficiary,
    verification: verification || null
  });
});

// Audit trail for a specific beneficiary
apiRouter.get('/beneficiaries/:id/audit-trail', authMiddleware, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;
  const id = req.params.id;

  const beneficiary = db.prepare('SELECT taluk FROM beneficiary_master WHERE id = ?').get(id) as any;
  if (!beneficiary) {
    return res.status(404).json({ error: 'Beneficiary record not found' });
  }

  if (user.role === 'Taluk Admin' && user.assigned_taluk !== 'All Taluks' && beneficiary.taluk.toLowerCase() !== user.assigned_taluk.toLowerCase()) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const history = db.prepare(`
    SELECT * FROM verification_audit_trail
    WHERE beneficiary_id = ?
    ORDER BY id DESC
  `).all(id);

  res.json({ history });
});

// ==========================================
// 5. Beneficiary Verification & Google Sheets Write-Back
// ==========================================

apiRouter.put('/beneficiaries/:id/verify', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;
  const id = req.params.id;

  const beneficiary = db.prepare('SELECT * FROM beneficiary_master WHERE id = ?').get(id) as any;
  if (!beneficiary) {
    return res.status(404).json({ error: 'Beneficiary record not found' });
  }

  if (user.role === 'Taluk Admin' && user.assigned_taluk !== 'All Taluks' && beneficiary.taluk.toLowerCase() !== user.assigned_taluk.toLowerCase()) {
    return res.status(403).json({ error: 'Access Denied: Cannot verify a record belonging to another taluk.' });
  }

  const {
    community,
    patta_issued,
    patta_number,
    patta_issue_date,
    seniority_register_maintained,
    included_in_seniority_register,
    seniority_number,
    land_occupied,
    relocation_willingness,
    firka,
    verified_revenue_village,
    verification_status,
    remarks,
    proceedings_number,
    google_access_token
  } = req.body;

  // Retrieve incoming Google access token from header or body
  const incomingGoogleToken = google_access_token ||
    (req.headers['x-google-access-token'] as string) ||
    null;

  // Normalization
  const isPattaIssuedVal = typeof patta_issued === 'boolean'
    ? (patta_issued ? 'Yes' : 'No')
    : (patta_issued === 1 || patta_issued === '1' || patta_issued === 'Yes')
      ? 'Yes'
      : (patta_issued === 'Verification Pending' ? 'Verification Pending' : 'No');

  const seniorityMaintainedVal = typeof seniority_register_maintained === 'boolean'
    ? (seniority_register_maintained ? 'Yes' : 'No')
    : (seniority_register_maintained === 'Verification Pending' ? 'Verification Pending' : (seniority_register_maintained ? 'Yes' : 'No'));

  const statusVal = verification_status || (isPattaIssuedVal === 'Yes' ? 'Completed' : 'Pending');
  const nowIso = new Date().toISOString();
  const updatedByUsername = user.username || user.designation || 'Tahsildar';

  // Fetch previous verification record for audit trail comparison
  const existingVerif = db.prepare('SELECT * FROM taluk_verification WHERE beneficiary_id = ?').get(id) as any;

  // Track field changes for audit trail
  const fieldsToCheck = [
    { key: 'community', val: community || null },
    { key: 'patta_issued', val: isPattaIssuedVal },
    { key: 'patta_number', val: patta_number ? patta_number.trim() : null },
    { key: 'patta_issue_date', val: patta_issue_date || null },
    { key: 'seniority_register_maintained', val: seniorityMaintainedVal },
    { key: 'included_in_seniority_register', val: included_in_seniority_register || 'Pending' },
    { key: 'seniority_number', val: seniority_number ? seniority_number.trim() : null },
    { key: 'land_occupied', val: land_occupied || 'Verification Pending' },
    { key: 'relocation_willingness', val: relocation_willingness || 'In-situ Regularisation' },
    { key: 'firka', val: firka ? firka.trim() : null },
    { key: 'verified_revenue_village', val: verified_revenue_village ? verified_revenue_village.trim() : null },
    { key: 'verification_status', val: statusVal },
    { key: 'remarks', val: remarks ? remarks.trim() : null }
  ];

  const auditInsert = db.prepare(`
    INSERT INTO verification_audit_trail (
      beneficiary_id, field_name, previous_value, updated_value, updated_by
    ) VALUES (?, ?, ?, ?, ?)
  `);

  for (const f of fieldsToCheck) {
    const prev = existingVerif ? String(existingVerif[f.key] ?? '') : '';
    const next = String(f.val ?? '');
    if (prev !== next) {
      auditInsert.run(id, f.key, prev || null, next || null, updatedByUsername);
    }
  }

  // Attempt Google Sheets Write-Back if token provided
  let googleSheetWriteSuccess = false;
  let googleSheetError: string | null = null;
  let updatedRange: string | null = null;

  const sheetName = beneficiary.sheet_name || (beneficiary.application_category.includes('Free House Site') ? SHEET_NAME_FHS : SHEET_NAME_REG);
  const sheetRow = beneficiary.sheet_row || (beneficiary.source_sno + 1);

  if (incomingGoogleToken) {
    try {
      const writeRes = await writeBeneficiaryToGoogleSheet(
        GOOGLE_SPREADSHEET_ID,
        sheetName,
        sheetRow,
        {
          category: beneficiary.application_category,
          community: community ? community.trim() : '',
          patta_issued: isPattaIssuedVal,
          patta_number: patta_number ? patta_number.trim() : '',
          patta_issue_date: patta_issue_date || '',
          seniority_register_maintained: seniorityMaintainedVal,
          included_in_seniority_register: included_in_seniority_register || 'Pending',
          seniority_number: seniority_number ? seniority_number.trim() : '',
          land_occupied: land_occupied || 'Verification Pending',
          relocation_willingness: relocation_willingness || 'In-situ Regularisation',
          firka: firka ? firka.trim() : '',
          verified_revenue_village: verified_revenue_village ? verified_revenue_village.trim() : '',
          remarks: remarks ? remarks.trim() : '',
          verification_status: statusVal,
          updated_by: updatedByUsername,
          updated_at: nowIso,
          beneficiary_id: id
        },
        incomingGoogleToken
      );

      googleSheetWriteSuccess = true;
      updatedRange = writeRes.updatedRange;
    } catch (err: any) {
      googleSheetError = err.message;
      console.error('[GoogleSheetsWrite] Error writing back to sheet:', err);
    }
  }

  // If Google Sheets write was attempted and failed, do NOT falsely show success
  if (incomingGoogleToken && !googleSheetWriteSuccess) {
    return res.status(502).json({
      error: `Failed to write verification to Google Sheets: ${googleSheetError}. Please ensure you are authorized.`,
      google_sheets_synced: false
    });
  }

  // Save to SQLite taluk_verification
  const verifId = `TV-${id}`;
  const isPattaIssuedDb = isPattaIssuedVal === 'Yes' ? 'Yes' : 'No';

  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO taluk_verification (
        id, beneficiary_id, patta_issued, patta_number, patta_issue_date,
        proceedings_number, seniority_register_maintained, included_in_seniority_register,
        seniority_number, land_occupied, community, relocation_willingness, firka,
        verified_revenue_village, verification_status, remarks,
        synced_to_sheet, synced_at, updated_by, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, CURRENT_TIMESTAMP
      )
    `);

    stmt.run(
      verifId,
      id,
      isPattaIssuedDb,
      patta_number ? patta_number.trim() : null,
      patta_issue_date || null,
      proceedings_number ? proceedings_number.trim() : null,
      seniorityMaintainedVal,
      included_in_seniority_register || 'Pending',
      seniority_number ? seniority_number.trim() : null,
      land_occupied || 'Verification Pending',
      community ? community.trim() : null,
      relocation_willingness || null,
      firka ? firka.trim() : null,
      verified_revenue_village ? verified_revenue_village.trim() : null,
      statusVal,
      remarks ? remarks.trim() : null,
      googleSheetWriteSuccess ? 1 : 0,
      googleSheetWriteSuccess ? nowIso : null,
      updatedByUsername
    );

    res.json({
      success: true,
      message: googleSheetWriteSuccess
        ? `Verification saved and synchronized with Google Sheets row ${sheetRow}.`
        : 'Verification recorded in portal database. (Connect Google Sheets to enable live sheet write-back).',
      verification_status: statusVal,
      google_sheets_synced: googleSheetWriteSuccess,
      sheet_name: sheetName,
      sheet_row: sheetRow,
      updatedRange
    });
  } catch (err: any) {
    console.error('Error saving verification:', err);
    res.status(500).json({ error: 'Failed to record verification: ' + err.message });
  }
});

// ==========================================
// 6. Google Sheets Live Synchronization Endpoints
// ==========================================

apiRouter.get('/sheets/status', authMiddleware, (req, res) => {
  const db = getDb();
  const totalRow = db.prepare('SELECT COUNT(*) as cnt FROM beneficiary_master').get() as { cnt: number };
  const syncedRow = db.prepare('SELECT COUNT(*) as cnt FROM taluk_verification WHERE synced_to_sheet = 1').get() as { cnt: number };
  const auditRow = db.prepare('SELECT * FROM import_audit WHERE category LIKE ? ORDER BY id DESC LIMIT 1').get('%Google%') as any;

  res.json({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    connected: true,
    worksheets: [
      { name: SHEET_NAME_FHS, description: 'New Free House Site Patta dataset', expectedRows: 28701 },
      { name: SHEET_NAME_REG, description: 'Patta Regularisation dataset', expectedRows: 832 },
      { name: SHEET_NAME_USERS, description: 'Administrative accounts mapping', expectedRows: 11 }
    ],
    totalBeneficiaries: totalRow.cnt,
    totalSyncedToSheet: syncedRow.cnt,
    lastSyncAt: auditRow ? auditRow.imported_at : null
  });
});

apiRouter.post('/sheets/sync', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== 'District Admin' && req.user?.assigned_taluk !== 'All Taluks') {
    return res.status(403).json({ error: 'Live Google Sheets sync is restricted to District Admin.' });
  }

  try {
    const result = await syncFromGoogleSpreadsheet(GOOGLE_SPREADSHEET_ID);
    res.json(result);
  } catch (err: any) {
    console.error('[GoogleSheetsSync] Error during sync:', err);
    res.status(500).json({ error: 'Failed to synchronize from Google Sheets: ' + err.message });
  }
});

apiRouter.post('/sheets/ensure-headers', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { google_access_token } = req.body;
  const token = google_access_token || (req.headers['x-google-access-token'] as string);

  if (!token) {
    return res.status(400).json({ error: 'Google authorization token is required.' });
  }

  try {
    await ensureSheetHeaders(GOOGLE_SPREADSHEET_ID, SHEET_NAME_FHS, token);
    await ensureSheetHeaders(GOOGLE_SPREADSHEET_ID, SHEET_NAME_REG, token);
    res.json({ success: true, message: 'Google Sheet verification headers verified and updated.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update headers in Google Sheet: ' + err.message });
  }
});

// ==========================================
// 7. Data Import Administration
// ==========================================

apiRouter.get('/admin/import/audit', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== 'District Admin' && req.user?.assigned_taluk !== 'All Taluks') {
    return res.status(403).json({ error: 'Access restricted to District Admin' });
  }

  const db = getDb();
  const auditLogs = db.prepare('SELECT * FROM import_audit ORDER BY id DESC LIMIT 50').all();

  const liveStats = db.prepare(`
    SELECT 
      application_category,
      COUNT(*) as imported_count,
      SUM(CASE WHEN taluk IS NULL OR taluk = '' THEN 1 ELSE 0 END) as missing_taluk,
      SUM(CASE WHEN revenue_village IS NULL OR revenue_village = '' THEN 1 ELSE 0 END) as missing_village
    FROM beneficiary_master
    GROUP BY application_category
  `).all() as Array<{ application_category: string; imported_count: number; missing_taluk: number; missing_village: number }>;

  const fhsLive = liveStats.find(s => s.application_category.includes('Free House Site')) || { imported_count: 0, missing_taluk: 0, missing_village: 0 };
  const regLive = liveStats.find(s => s.application_category.includes('Regularisation')) || { imported_count: 0, missing_taluk: 0, missing_village: 0 };

  const syncedCountRow = db.prepare('SELECT COUNT(*) as count FROM taluk_verification WHERE synced_to_sheet = 1').get() as { count: number };

  res.json({
    expectedTotals: {
      newFreeHouseSite: 28701,
      pattaRegularisation: 832,
      combinedTotal: 29533
    },
    liveCounts: {
      newFreeHouseSite: fhsLive.imported_count,
      pattaRegularisation: regLive.imported_count,
      combinedTotal: fhsLive.imported_count + regLive.imported_count,
      missingVillageTotal: fhsLive.missing_village + regLive.missing_village,
      missingTalukTotal: fhsLive.missing_taluk + regLive.missing_taluk,
      fhsMissingVillage: fhsLive.missing_village,
      regMissingVillage: regLive.missing_village
    },
    auditLogs,
    sheetsStatus: {
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      connected: true,
      sheets: [
        { name: SHEET_NAME_FHS, totalRows: fhsLive.imported_count, gid: '604455956' },
        { name: SHEET_NAME_REG, totalRows: regLive.imported_count, gid: '1565201227' }
      ],
      totalBeneficiaries: fhsLive.imported_count + regLive.imported_count,
      totalSyncedToSheet: syncedCountRow.count,
      lastSyncAt: auditLogs.length > 0 ? (auditLogs[0] as any).imported_at : null
    }
  });
});

apiRouter.post('/admin/import/preview', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== 'District Admin' && req.user?.assigned_taluk !== 'All Taluks') {
    return res.status(403).json({ error: 'Access restricted to District Admin' });
  }

  const { csvContent } = req.body;
  if (!csvContent || typeof csvContent !== 'string') {
    return res.status(400).json({ error: 'CSV content is required' });
  }

  const rows = parseCSV(csvContent);
  if (rows.length < 2) {
    return res.status(400).json({ error: 'CSV file contains no data rows' });
  }

  const header = rows[0];
  const validation = validateCSVHeadings(header);
  if (!validation.valid) {
    return res.status(400).json({
      error: `Missing required columns: ${validation.missingColumns.join(', ')}`,
      missingColumns: validation.missingColumns
    });
  }

  const sampleRows = rows.slice(1, 11).map((r, idx) => ({
    index: idx + 1,
    sno: r[validation.mapping.snoIndex] || '',
    name: r[validation.mapping.nameIndex] || '',
    address: r[validation.mapping.addrIndex] || '',
    phone: r[validation.mapping.phoneIndex] || '',
    taluk: r[validation.mapping.talukIndex] || '',
    revenue_village: r[validation.mapping.villageIndex] || ''
  }));

  res.json({
    valid: true,
    totalRows: rows.length - 1,
    header,
    sampleRows
  });
});

apiRouter.post('/admin/import/execute', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== 'District Admin' && req.user?.assigned_taluk !== 'All Taluks') {
    return res.status(403).json({ error: 'Access restricted to District Admin' });
  }

  const { csvContent, category, filename } = req.body;
  if (!csvContent || !category) {
    return res.status(400).json({ error: 'CSV content and application category are required' });
  }

  const appCategory = category.includes('Free House Site') ? 'New Free House Site Patta' : 'Patta Regularisation';
  const prefix = appCategory === 'New Free House Site Patta' ? 'TNK-THOO-FH-' : 'TNK-THOO-REG-';
  const sheetName = appCategory === 'New Free House Site Patta' ? SHEET_NAME_FHS : SHEET_NAME_REG;

  const rows = parseCSV(csvContent);
  if (rows.length < 2) {
    return res.status(400).json({ error: 'CSV file contains no data rows' });
  }

  const header = rows[0];
  const validation = validateCSVHeadings(header);
  if (!validation.valid) {
    return res.status(400).json({ error: `Missing required columns: ${validation.missingColumns.join(', ')}` });
  }

  const db = getDb();
  let importedCount = 0;
  let duplicateCount = 0;
  let rejectedCount = 0;
  let missingTalukCount = 0;
  let missingVillageCount = 0;

  db.exec('BEGIN TRANSACTION');
  try {
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO beneficiary_master (
        id, source_sno, beneficiary_name, address, phone, taluk, revenue_village, application_category, sheet_name, sheet_row
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 2) {
        rejectedCount++;
        continue;
      }

      const sNoRaw = parseInt((r[validation.mapping.snoIndex] || '').replace(/[^0-9]/g, ''), 10);
      const sNo = isNaN(sNoRaw) ? i : sNoRaw;
      const name = (r[validation.mapping.nameIndex] || '').trim();
      if (!name) {
        rejectedCount++;
        continue;
      }

      const addr = (r[validation.mapping.addrIndex] || '').trim() || null;
      const phone = (r[validation.mapping.phoneIndex] || '').trim() || null;
      const taluk = (r[validation.mapping.talukIndex] || '').trim();
      const villageRaw = (r[validation.mapping.villageIndex] || '').trim();
      const village = villageRaw.length > 0 ? villageRaw : null;

      if (!taluk) missingTalukCount++;
      if (!village) missingVillageCount++;

      const internalId = `${prefix}${String(sNo).padStart(5, '0')}`;
      const sheetRow = i + 1;
      const result = insertStmt.run(internalId, sNo, name, addr, phone, taluk, village, appCategory, sheetName, sheetRow);
      if (result.changes > 0) {
        importedCount++;
      } else {
        duplicateCount++;
      }
    }

    // Update audit log
    db.prepare(`
      INSERT INTO import_audit (
        category, source_filename, source_records, imported_records, duplicate_records,
        rejected_records, missing_taluk_records, missing_village_records
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      appCategory,
      filename || 'uploaded_source.csv',
      rows.length - 1,
      importedCount,
      duplicateCount,
      rejectedCount,
      missingTalukCount,
      missingVillageCount
    );

    db.exec('COMMIT');

    res.json({
      success: true,
      category: appCategory,
      sourceRecords: rows.length - 1,
      importedRecords: importedCount,
      duplicateRecords: duplicateCount,
      rejectedRecords: rejectedCount,
      missingTalukRecords: missingTalukCount,
      missingVillageRecords: missingVillageCount
    });
  } catch (err: any) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Import execution failed: ' + err.message });
  }
});

// Taluks list metadata
apiRouter.get('/meta/taluks', (req, res) => {
  res.json({
    taluks: THOOTHUKUDI_TALUKS
  });
});

// Fallback 404 for undefined API routes
apiRouter.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});
