/**
 * THOOTHUKUDI DISTRICT ADMINISTRATION
 * HOUSE SITE PATTA & PATTA REGULARISATION MONITORING PORTAL
 * 
 * Google Apps Script Web App Backend API
 * Connected to Primary Spreadsheet: 1wcvgGj_Y6__RpUSDjv5J3D0OWVPiplZLdN0BZ6KPvfw
 * 
 * Deployment Instructions:
 * 1. Open Google Sheets (ID: 1wcvgGj_Y6__RpUSDjv5J3D0OWVPiplZLdN0BZ6KPvfw)
 * 2. Click Extensions > Apps Script
 * 3. Paste this code into Code.gs
 * 4. Deploy > New Deployment > Web App
 *    - Execute as: Me (thoothukudidistrictpmu@gmail.com)
 *    - Who has access: Anyone (secured via API Secret Key & Server-side PBKDF2 Session)
 * 5. Copy the Web App URL and configure it in the Portal District Admin Settings
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
var CONFIG = {
  SPREADSHEET_ID: '1wcvgGj_Y6__RpUSDjv5J3D0OWVPiplZLdN0BZ6KPvfw',
  SHEET_BENEFICIARIES: 'Free House Site and Regularisation',
  SHEET_REGULARISATION_ALT: 'Regularization', // Secondary tab if split
  SHEET_USERS: 'User ID',
  SHEET_AUDIT: 'Verification_Audit_Trail',
  
  // Shared API Secret Key for server-to-Apps-Script authorization
  API_SECRET_KEY: 'TNK-THOO-PATTA-GAS-SECURE-2026',
  
  // Official Thoothukudi Taluks
  TALUKS: [
    'Eral',
    'Ettayapuram',
    'Kayathar',
    'Kovilpatty', // or Kovilpatti
    'Ottapidaram',
    'Sattankulam',
    'Srivaikundam',
    'Thoothukudi',
    'Tiruchendur',
    'Vilathikulam'
  ],
  
  // Verification Column Definitions (Columns G to W, 1-indexed cols 7 to 23)
  VERIFICATION_HEADERS: [
    'Category',                      // Col G (7)
    'Community',                     // Col H (8)
    'Patta Issued',                  // Col I (9)
    'Patta Number',                  // Col J (10)
    'Patta Issue Date',              // Col K (11)
    'Seniority Register Maintained', // Col L (12)
    'Included in Seniority Register',// Col M (13)
    'Seniority Number',              // Col N (14)
    'Land Occupied',                 // Col O (15)
    'Relocation Willingness',         // Col P (16)
    'Verified Firka',                // Col Q (17)
    'Verified Revenue Village',      // Col R (18)
    'Verification Remarks',          // Col S (19)
    'Verification Status',           // Col T (20)
    'Verified By',                   // Col U (21)
    'Verification Date and Time',    // Col V (22)
    'Beneficiary ID'                 // Col W (23)
  ]
};

// ============================================================================
// HTTP HANDLERS: doGet & doPost
// ============================================================================

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'ping';

    // 1. Health check & status
    if (action === 'ping' || action === 'status') {
      return jsonResponse(handleStatus());
    }

    // Validate security authorization
    var authError = validateAuth(params);
    if (authError) {
      return jsonResponse({ success: false, error: authError }, 403);
    }

    // 2. Actions
    switch (action) {
      case 'getBeneficiaries':
        return jsonResponse(handleGetBeneficiaries(params));

      case 'getBeneficiary':
        return jsonResponse(handleGetBeneficiary(params));

      case 'getStats':
        return jsonResponse(handleGetStats(params));

      case 'getAuditTrail':
        return jsonResponse(handleGetAuditTrail(params));

      case 'ensureHeaders':
        return jsonResponse(handleEnsureHeaders());

      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ success: false, error: 'Server error: ' + err.toString() }, 500);
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (ex) {
        body = {};
      }
    }
    
    // Merge URL query parameters with post body
    var params = e && e.parameter ? e.parameter : {};
    for (var key in params) {
      if (!body.hasOwnProperty(key)) {
        body[key] = params[key];
      }
    }

    var action = body.action || params.action;

    // Validate security authorization
    var authError = validateAuth(body);
    if (authError) {
      return jsonResponse({ success: false, error: authError }, 403);
    }

    switch (action) {
      case 'updateVerification':
        return jsonResponse(handleUpdateVerification(body));

      case 'ensureHeaders':
        return jsonResponse(handleEnsureHeaders());

      case 'getBeneficiaries':
        return jsonResponse(handleGetBeneficiaries(body));

      case 'getStats':
        return jsonResponse(handleGetStats(body));

      default:
        return jsonResponse({ success: false, error: 'Unknown POST action: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ success: false, error: 'Execution error: ' + err.toString() }, 500);
  }
}

// Helper to return standardized JSON with CORS headers
function jsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ============================================================================
// SECURITY & AUTHORIZATION VALIDATION
// ============================================================================

function validateAuth(params) {
  var secret = params.apiKey || params.secret || params.api_secret_key;
  if (!secret || secret !== CONFIG.API_SECRET_KEY) {
    return 'Unauthorized: Invalid or missing API secret key.';
  }

  // Validate Officer identity
  var role = params.officerRole || params.role;
  var taluk = params.officerTaluk || params.assigned_taluk;

  if (!role) {
    return 'Unauthorized: Officer role is required.';
  }

  // If role is Taluk Admin, assigned_taluk must be present
  if (role === 'Taluk Admin' && (!taluk || taluk === 'All Taluks')) {
    return 'Unauthorized: Valid assigned taluk required for Taluk Admin.';
  }

  return null; // Valid
}

// Check if officer is permitted to access a given taluk
function isTalukPermitted(officerRole, officerTaluk, targetTaluk) {
  if (officerRole === 'District Admin' || officerTaluk === 'All Taluks') {
    return true;
  }
  if (!targetTaluk) return true;
  
  var normOfficer = normalizeTalukName(officerTaluk);
  var normTarget = normalizeTalukName(targetTaluk);
  return normOfficer === normTarget;
}

function normalizeTalukName(name) {
  if (!name) return '';
  var s = String(name).trim().toLowerCase();
  if (s.includes('kovilpat')) return 'kovilpatty';
  return s;
}

// ============================================================================
// SPREADSHEET ACCESS & HELPERS
// ============================================================================

function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getBeneficiariesSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_BENEFICIARIES);
  if (!sheet) {
    // Fallback to first sheet
    sheet = ss.getSheets()[0];
  }
  return sheet;
}

function getAuditSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_AUDIT);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_AUDIT);
    sheet.appendRow([
      'Audit ID',
      'Beneficiary ID',
      'Field Name',
      'Previous Value',
      'Updated Value',
      'Updated By Officer',
      'Officer Taluk',
      'Timestamp'
    ]);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#0F2744').setFontColor('#FFFFFF');
  }
  return sheet;
}

// Ensure Columns G to W have proper headers in Row 1
function handleEnsureHeaders() {
  var sheet = getBeneficiariesSheet();
  var headers = CONFIG.VERIFICATION_HEADERS;
  
  // Range G1:W1 (Col 7 to Col 23, total 17 cols)
  var range = sheet.getRange(1, 7, 1, headers.length);
  var currentValues = range.getValues()[0];
  
  var needsUpdate = false;
  for (var i = 0; i < headers.length; i++) {
    if (!currentValues[i] || String(currentValues[i]).trim() === '') {
      needsUpdate = true;
      break;
    }
  }

  if (needsUpdate) {
    range.setValues([headers]);
    range.setFontWeight('bold').setBackground('#E2E8F0').setFontColor('#0F2744');
  }

  return {
    success: true,
    message: 'Verification headers G1:W1 verified.',
    headers: headers
  };
}

// ============================================================================
// API ACTION HANDLERS
// ============================================================================

function handleStatus() {
  var ss = getSpreadsheet();
  var sheet = getBeneficiariesSheet();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  return {
    success: true,
    status: 'ONLINE',
    system: 'Thoothukudi District Patta Monitoring Portal - Google Apps Script Backend',
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    primarySheet: sheet.getName(),
    totalRows: lastRow,
    totalBeneficiaries: Math.max(0, lastRow - 1),
    timestamp: new Date().toISOString()
  };
}

/**
 * Retrieve beneficiary records with pagination, filtering, and taluk isolation
 */
function handleGetBeneficiaries(params) {
  var sheet = getBeneficiariesSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return {
      success: true,
      beneficiaries: [],
      pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 0 }
    };
  }

  var officerRole = params.officerRole || params.role || '';
  var officerTaluk = params.officerTaluk || params.assigned_taluk || '';
  var filterTaluk = params.taluk || '';
  var filterCategory = params.category || '';
  var filterStatus = params.status || '';
  var searchQuery = (params.search || '').trim().toLowerCase();
  
  var page = parseInt(params.page || '1', 10);
  var limit = parseInt(params.limit || '15', 10);
  if (limit > 50) limit = 50;

  // Determine effective taluk filter enforcing officer permissions
  var effectiveTaluk = '';
  if (officerRole === 'District Admin' || officerTaluk === 'All Taluks') {
    effectiveTaluk = filterTaluk;
  } else {
    // Tahsildar CANNOT view other taluks
    effectiveTaluk = officerTaluk;
  }

  var numRows = lastRow - 1;
  // Read cols A to W (cols 1 to 23)
  var numCols = Math.max(sheet.getLastColumn(), 23);
  var dataRange = sheet.getRange(2, 1, numRows, numCols);
  var values = dataRange.getValues();

  var matched = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowNum = i + 2;

    var sNo = row[0];
    var name = String(row[1] || '').trim();
    if (!name) continue;

    var address = String(row[2] || '').trim();
    var phone = String(row[3] || '').trim();
    var taluk = String(row[4] || '').trim();
    var revVillage = String(row[5] || '').trim();

    // Verification columns G to W (indices 6 to 22)
    var category = String(row[6] || '').trim();
    if (!category) {
      category = 'New Free House Site Patta'; // Default from worksheet 1
    }

    var community = String(row[7] || '').trim();
    var pattaIssued = String(row[8] || '').trim();
    var pattaNumber = String(row[9] || '').trim();
    var pattaIssueDate = row[10] ? formatDate_(row[10]) : '';
    var seniorityRegisterMaintained = String(row[11] || '').trim();
    var includedInSeniorityRegister = String(row[12] || '').trim();
    var seniorityNumber = String(row[13] || '').trim();
    var landOccupied = String(row[14] || '').trim();
    var relocationWillingness = String(row[15] || '').trim();
    var verifiedFirka = String(row[16] || '').trim();
    var verifiedVillage = String(row[17] || '').trim();
    var remarks = String(row[18] || '').trim();
    var status = String(row[19] || '').trim();
    if (!status) status = 'Pending';

    var verifiedBy = String(row[20] || '').trim();
    var verifiedAt = row[21] ? formatDate_(row[21]) : '';
    var benId = String(row[22] || '').trim();

    if (!benId) {
      benId = generateBeneficiaryId_(category, sNo);
    }

    // Apply Taluk Filter
    if (effectiveTaluk && normalizeTalukName(taluk) !== normalizeTalukName(effectiveTaluk)) {
      continue;
    }

    // Apply Category Filter
    if (filterCategory && category !== filterCategory) {
      continue;
    }

    // Apply Status Filter
    if (filterStatus && status !== filterStatus) {
      continue;
    }

    // Apply Search Query
    if (searchQuery) {
      var matchStr = (name + ' ' + benId + ' ' + phone + ' ' + address + ' ' + revVillage + ' ' + sNo).toLowerCase();
      if (matchStr.indexOf(searchQuery) === -1) {
        continue;
      }
    }

    matched.push({
      id: benId,
      source_sno: sNo,
      s_no: sNo,
      beneficiary_name: name,
      address: address,
      phone: phone,
      taluk: taluk,
      revenue_village: revVillage || null,
      application_category: category,
      sheet_name: CONFIG.SHEET_BENEFICIARIES,
      sheet_row: rowNum,
      community: community || null,
      patta_issued: pattaIssued || null,
      patta_number: pattaNumber || null,
      patta_issue_date: pattaIssueDate || null,
      seniority_register_maintained: seniorityRegisterMaintained || null,
      included_in_seniority_register: includedInSeniorityRegister || null,
      seniority_number: seniorityNumber || null,
      land_occupied: landOccupied || null,
      relocation_willingness: relocationWillingness || null,
      firka: verifiedFirka || null,
      verified_revenue_village: verifiedVillage || null,
      remarks: remarks || null,
      verification_status: status,
      updated_by: verifiedBy || null,
      updated_at: verifiedAt || null
    });
  }

  var totalCount = matched.length;
  var totalPages = Math.ceil(totalCount / limit);
  var startIndex = (page - 1) * limit;
  var paginated = matched.slice(startIndex, startIndex + limit);

  return {
    success: true,
    beneficiaries: paginated,
    pagination: {
      page: page,
      limit: limit,
      totalCount: totalCount,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * Retrieve individual beneficiary details and audit history
 */
function handleGetBeneficiary(params) {
  var id = (params.id || '').trim();
  if (!id) {
    return { success: false, error: 'Beneficiary ID is required.' };
  }

  var officerRole = params.officerRole || params.role || '';
  var officerTaluk = params.officerTaluk || params.assigned_taluk || '';

  var found = findBeneficiaryRow_(id);
  if (!found) {
    return { success: false, error: 'Beneficiary record not found: ' + id };
  }

  // Check taluk permissions
  if (!isTalukPermitted(officerRole, officerTaluk, found.record.taluk)) {
    return { success: false, error: 'Access Denied: Record belongs to ' + found.record.taluk + ', not your assigned taluk.' };
  }

  // Load audit trail
  var history = loadAuditHistoryForBeneficiary_(id);

  return {
    success: true,
    beneficiary: found.record,
    verification: found.verification,
    history: history
  };
}

/**
 * Update verification details for an existing beneficiary row
 * PRESERVES original Columns A to F.
 * Updates Columns G to W.
 * Records audit logs into Verification_Audit_Trail sheet.
 */
function handleUpdateVerification(payload) {
  var id = (payload.id || payload.beneficiary_id || '').trim();
  if (!id) {
    return { success: false, error: 'Beneficiary ID is required.' };
  }

  var officerRole = payload.officerRole || payload.role || '';
  var officerTaluk = payload.officerTaluk || payload.assigned_taluk || '';
  var officerName = payload.officerName || payload.updated_by || 'Officer';

  var found = findBeneficiaryRow_(id);
  if (!found) {
    return { success: false, error: 'Beneficiary record not found: ' + id };
  }

  var record = found.record;
  var rowNum = found.rowNum;

  // Enforce Taluk Permission
  if (!isTalukPermitted(officerRole, officerTaluk, record.taluk)) {
    return { success: false, error: 'Access Denied: You cannot verify records belonging to ' + record.taluk };
  }

  var sheet = getBeneficiariesSheet();
  var timestampStr = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss');

  // Prepare updated values for Columns G to W (17 columns)
  var category = payload.application_category || record.application_category || 'New Free House Site Patta';
  var community = payload.community || record.community || '';
  var pattaIssued = payload.patta_issued || record.patta_issued || 'No';
  var pattaNumber = pattaIssued === 'Yes' ? (payload.patta_number || '') : '';
  var pattaIssueDate = pattaIssued === 'Yes' ? (payload.patta_issue_date || '') : '';
  var seniorityRegisterMaintained = payload.seniority_register_maintained || 'No';
  var includedInSeniorityRegister = payload.included_in_seniority_register || 'Pending';
  var seniorityNumber = includedInSeniorityRegister === 'Yes' ? (payload.seniority_number || '') : '';
  var landOccupied = payload.land_occupied || '';
  var relocationWillingness = payload.relocation_willingness || '';
  var verifiedFirka = payload.firka || '';
  var verifiedVillage = payload.verified_revenue_village || '';
  var remarks = payload.remarks || '';
  var status = payload.verification_status || 'Completed';
  var verifiedBy = officerName + ' (' + (officerTaluk || 'HQ') + ')';
  var verifiedAt = timestampStr;
  var beneficiaryId = id;

  // Build row array for Col 7 to Col 23
  var updateValues = [[
    category,
    community,
    pattaIssued,
    pattaNumber,
    pattaIssueDate,
    seniorityRegisterMaintained,
    includedInSeniorityRegister,
    seniorityNumber,
    landOccupied,
    relocationWillingness,
    verifiedFirka,
    verifiedVillage,
    remarks,
    status,
    verifiedBy,
    verifiedAt,
    beneficiaryId
  ]];

  // Write to sheet at rowNum, col 7 to 23
  sheet.getRange(rowNum, 7, 1, 17).setValues(updateValues);

  // Record audit history for changed fields
  var oldVer = found.verification || {};
  recordFieldChange_(id, 'community', oldVer.community, community, officerName, officerTaluk);
  recordFieldChange_(id, 'patta_issued', oldVer.patta_issued, pattaIssued, officerName, officerTaluk);
  recordFieldChange_(id, 'patta_number', oldVer.patta_number, pattaNumber, officerName, officerTaluk);
  recordFieldChange_(id, 'patta_issue_date', oldVer.patta_issue_date, pattaIssueDate, officerName, officerTaluk);
  recordFieldChange_(id, 'seniority_register_maintained', oldVer.seniority_register_maintained, seniorityRegisterMaintained, officerName, officerTaluk);
  recordFieldChange_(id, 'included_in_seniority_register', oldVer.included_in_seniority_register, includedInSeniorityRegister, officerName, officerTaluk);
  recordFieldChange_(id, 'seniority_number', oldVer.seniority_number, seniorityNumber, officerName, officerTaluk);
  recordFieldChange_(id, 'land_occupied', oldVer.land_occupied, landOccupied, officerName, officerTaluk);
  recordFieldChange_(id, 'relocation_willingness', oldVer.relocation_willingness, relocationWillingness, officerName, officerTaluk);
  recordFieldChange_(id, 'firka', oldVer.firka, verifiedFirka, officerName, officerTaluk);
  recordFieldChange_(id, 'verified_revenue_village', oldVer.verified_revenue_village, verifiedVillage, officerName, officerTaluk);
  recordFieldChange_(id, 'verification_status', oldVer.verification_status, status, officerName, officerTaluk);
  recordFieldChange_(id, 'remarks', oldVer.remarks, remarks, officerName, officerTaluk);

  return {
    success: true,
    message: 'Verification recorded directly in Google Spreadsheet row #' + rowNum + '.',
    beneficiary_id: id,
    sheet_name: CONFIG.SHEET_BENEFICIARIES,
    sheet_row: rowNum,
    verification_status: status,
    updated_at: timestampStr
  };
}

/**
 * Calculates live dashboard statistics directly from the Google Sheet
 */
function handleGetStats(params) {
  var sheet = getBeneficiariesSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { success: true, stats: getEmptyStats_() };
  }

  var officerRole = params.officerRole || params.role || '';
  var officerTaluk = params.officerTaluk || params.assigned_taluk || '';
  var filterTaluk = params.taluk || '';

  var numRows = lastRow - 1;
  var values = sheet.getRange(2, 1, numRows, 23).getValues();

  var stats = {
    totalBeneficiaries: 0,
    totalVerified: 0,
    totalPending: 0,
    totalRejected: 0,
    fhsCount: 0,
    regCount: 0,
    pattaIssuedCount: 0,
    pattaPendingCount: 0,
    byTaluk: {},
    byCommunity: { SC: 0, ST: 0, BC: 0, MBC: 0, OC: 0, Others: 0, Unspecified: 0 }
  };

  // Initialize all taluks
  for (var t = 0; t < CONFIG.TALUKS.length; t++) {
    stats.byTaluk[CONFIG.TALUKS[t]] = {
      taluk: CONFIG.TALUKS[t],
      total: 0,
      verified: 0,
      pending: 0,
      pattaIssued: 0,
      percentage: 0
    };
  }

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var name = String(row[1] || '').trim();
    if (!name) continue;

    var taluk = String(row[4] || '').trim();
    var category = String(row[6] || '').trim() || 'New Free House Site Patta';
    var community = String(row[7] || '').trim();
    var pattaIssued = String(row[8] || '').trim();
    var status = String(row[19] || '').trim() || 'Pending';

    // If Tahsildar view, filter by officer taluk
    if (officerRole === 'Taluk Admin' && officerTaluk && officerTaluk !== 'All Taluks') {
      if (normalizeTalukName(taluk) !== normalizeTalukName(officerTaluk)) {
        continue;
      }
    }

    stats.totalBeneficiaries++;
    if (status === 'Completed') stats.totalVerified++;
    else if (status === 'Rejected') stats.totalRejected++;
    else stats.totalPending++;

    if (category.indexOf('Regular') !== -1) stats.regCount++;
    else stats.fhsCount++;

    if (pattaIssued === 'Yes') stats.pattaIssuedCount++;
    else stats.pattaPendingCount++;

    // Community
    if (stats.byCommunity.hasOwnProperty(community)) {
      stats.byCommunity[community]++;
    } else {
      stats.byCommunity.Unspecified++;
    }

    // Taluk progress
    var matchedTalukKey = null;
    for (var k in stats.byTaluk) {
      if (normalizeTalukName(k) === normalizeTalukName(taluk)) {
        matchedTalukKey = k;
        break;
      }
    }

    if (matchedTalukKey) {
      stats.byTaluk[matchedTalukKey].total++;
      if (status === 'Completed') stats.byTaluk[matchedTalukKey].verified++;
      else stats.byTaluk[matchedTalukKey].pending++;
      if (pattaIssued === 'Yes') stats.byTaluk[matchedTalukKey].pattaIssued++;
    }
  }

  // Calculate percentages
  for (var tk in stats.byTaluk) {
    var item = stats.byTaluk[tk];
    item.percentage = item.total > 0 ? Math.round((item.verified / item.total) * 100) : 0;
  }

  stats.verificationPercentage = stats.totalBeneficiaries > 0
    ? Math.round((stats.totalVerified / stats.totalBeneficiaries) * 100)
    : 0;

  return {
    success: true,
    stats: stats,
    lastCalculatedAt: new Date().toISOString()
  };
}

/**
 * Retrieve audit history for a beneficiary
 */
function handleGetAuditTrail(params) {
  var id = (params.id || '').trim();
  if (!id) {
    return { success: false, error: 'Beneficiary ID required.' };
  }
  var history = loadAuditHistoryForBeneficiary_(id);
  return { success: true, history: history };
}

// ============================================================================
// INTERNAL UTILITY FUNCTIONS
// ============================================================================

function findBeneficiaryRow_(id) {
  var sheet = getBeneficiariesSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  var numRows = lastRow - 1;
  var values = sheet.getRange(2, 1, numRows, 23).getValues();

  var trimmedId = id.trim().toLowerCase();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowNum = i + 2;

    var sNo = row[0];
    var name = String(row[1] || '').trim();
    var address = String(row[2] || '').trim();
    var phone = String(row[3] || '').trim();
    var taluk = String(row[4] || '').trim();
    var revVillage = String(row[5] || '').trim();
    var category = String(row[6] || '').trim() || 'New Free House Site Patta';

    var community = String(row[7] || '').trim();
    var pattaIssued = String(row[8] || '').trim();
    var pattaNumber = String(row[9] || '').trim();
    var pattaIssueDate = row[10] ? formatDate_(row[10]) : '';
    var seniorityRegisterMaintained = String(row[11] || '').trim();
    var includedInSeniorityRegister = String(row[12] || '').trim();
    var seniorityNumber = String(row[13] || '').trim();
    var landOccupied = String(row[14] || '').trim();
    var relocationWillingness = String(row[15] || '').trim();
    var verifiedFirka = String(row[16] || '').trim();
    var verifiedVillage = String(row[17] || '').trim();
    var remarks = String(row[18] || '').trim();
    var status = String(row[19] || '').trim() || 'Pending';
    var verifiedBy = String(row[20] || '').trim();
    var verifiedAt = row[21] ? formatDate_(row[21]) : '';
    var benId = String(row[22] || '').trim();

    if (!benId) {
      benId = generateBeneficiaryId_(category, sNo);
    }

    if (benId.toLowerCase() === trimmedId || String(sNo) === trimmedId) {
      return {
        rowNum: rowNum,
        record: {
          id: benId,
          source_sno: sNo,
          s_no: sNo,
          beneficiary_name: name,
          address: address,
          phone: phone,
          taluk: taluk,
          revenue_village: revVillage || null,
          application_category: category,
          sheet_name: CONFIG.SHEET_BENEFICIARIES,
          sheet_row: rowNum,
          community: community || null,
          patta_issued: pattaIssued || null,
          patta_number: pattaNumber || null,
          patta_issue_date: pattaIssueDate || null,
          seniority_register_maintained: seniorityRegisterMaintained || null,
          included_in_seniority_register: includedInSeniorityRegister || null,
          seniority_number: seniorityNumber || null,
          land_occupied: landOccupied || null,
          relocation_willingness: relocationWillingness || null,
          firka: verifiedFirka || null,
          verified_revenue_village: verifiedVillage || null,
          remarks: remarks || null,
          verification_status: status,
          updated_by: verifiedBy || null,
          updated_at: verifiedAt || null
        },
        verification: {
          id: 'TV-' + benId,
          beneficiary_id: benId,
          community: community || null,
          patta_issued: pattaIssued || null,
          patta_number: pattaNumber || null,
          patta_issue_date: pattaIssueDate || null,
          seniority_register_maintained: seniorityRegisterMaintained || null,
          included_in_seniority_register: includedInSeniorityRegister || null,
          seniority_number: seniorityNumber || null,
          land_occupied: landOccupied || null,
          relocation_willingness: relocationWillingness || null,
          firka: verifiedFirka || null,
          verified_revenue_village: verifiedVillage || null,
          remarks: remarks || null,
          verification_status: status,
          updated_by: verifiedBy || null,
          updated_at: verifiedAt || null
        }
      };
    }
  }

  return null;
}

function generateBeneficiaryId_(category, sNo) {
  var isReg = String(category).indexOf('Regular') !== -1;
  var prefix = isReg ? 'TNK-THOO-REG-' : 'TNK-THOO-FH-';
  var numStr = String(sNo || '0');
  while (numStr.length < 5) numStr = '0' + numStr;
  return prefix + numStr;
}

function formatDate_(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Kolkata', 'yyyy-MM-dd');
  }
  return String(val);
}

function recordFieldChange_(beneficiaryId, fieldName, oldVal, newVal, officerName, officerTaluk) {
  var cleanOld = oldVal ? String(oldVal).trim() : '';
  var cleanNew = newVal ? String(newVal).trim() : '';
  if (cleanOld === cleanNew) return; // No change

  var auditSheet = getAuditSheet();
  var timestampStr = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss');
  var auditId = 'AUD-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000);

  auditSheet.appendRow([
    auditId,
    beneficiaryId,
    fieldName,
    cleanOld || '(empty)',
    cleanNew || '(empty)',
    officerName,
    officerTaluk || 'District Admin',
    timestampStr
  ]);
}

function loadAuditHistoryForBeneficiary_(id) {
  var auditSheet = getAuditSheet();
  var lastRow = auditSheet.getLastRow();
  if (lastRow <= 1) return [];

  var values = auditSheet.getRange(2, 1, lastRow - 1, 8).getValues();
  var history = [];
  var targetId = id.trim().toLowerCase();

  for (var i = values.length - 1; i >= 0; i--) {
    var row = values[i];
    var bId = String(row[1] || '').trim().toLowerCase();
    if (bId === targetId) {
      history.push({
        id: row[0],
        beneficiary_id: row[1],
        field_name: row[2],
        previous_value: row[3],
        updated_value: row[4],
        updated_by: row[5] + ' (' + (row[6] || 'Taluk') + ')',
        updated_at: formatDate_(row[7])
      });
    }
  }

  return history;
}

function getEmptyStats_() {
  return {
    totalBeneficiaries: 0,
    totalVerified: 0,
    totalPending: 0,
    totalRejected: 0,
    fhsCount: 0,
    regCount: 0,
    pattaIssuedCount: 0,
    pattaPendingCount: 0,
    verificationPercentage: 0,
    byTaluk: {},
    byCommunity: {}
  };
}
