# Thoothukudi District Administration
## House Site Patta & Patta Regularisation Monitoring Portal
### Google Apps Script Web App Backend & Deployment Guide

This document describes the complete architecture, deployment process, authorization steps, and security implementation for connecting the **Thoothukudi District Patta Monitoring Portal** to Google Sheets via Google Apps Script.

---

### 1. Architecture Overview

```text
Google AI Studio Portal (Frontend)
           ↓
   Node.js / Express Server
 (Role & Session Validation, PBKDF2 Auth)
           ↓ (Signed with API_SECRET_KEY)
Google Apps Script Web App (Backend API)
 (Executes as: thoothukudidistrictpmu@gmail.com)
           ↓
   Google Spreadsheet (Primary Database)
 (ID: 1wcvgGj_Y6__RpUSDjv5J3D0OWVPiplZLdN0BZ6KPvfw)
```

- **Primary Database**: Google Spreadsheet ID `1wcvgGj_Y6__RpUSDjv5J3D0OWVPiplZLdN0BZ6KPvfw`
  - Worksheet: `Free House Site and Regularisation` (28,701 Free House Site Patta + 832 Regularisation records)
  - Worksheet: `User ID` (Administrative account mappings for 10 Taluks + 1 District Admin)
  - Worksheet: `Verification_Audit_Trail` (Auto-created sheet tracking all field-level verification modifications)

- **Execution Context**: The Google Apps Script Web App executes as **Me (the Script Owner / Project Management Unit)**. This eliminates the need for individual Tahsildars to possess direct write permissions to the master spreadsheet or undergo personal Google OAuth popup authorization.

---

### 2. Google Apps Script Files

The complete source code is provided in:
- `google-apps-script/Code.gs`
- `google-apps-script/appsscript.json`

---

### 3. Step-by-Step Deployment Instructions

#### Step 3.1: Open the Google Spreadsheet
1. Open your browser and navigate to the master spreadsheet:
   `https://docs.google.com/spreadsheets/d/1wcvgGj_Y6__RpUSDjv5J3D0OWVPiplZLdN0BZ6KPvfw`
2. Ensure you are signed in with the authorized account (`thoothukudidistrictpmu@gmail.com`).

#### Step 3.2: Open Apps Script Editor
1. In the Google Sheets top menu, click **Extensions** > **Apps Script**.
2. A new tab will open with the Google Apps Script project editor.
3. Rename the project to: `Thoothukudi-Patta-Monitoring-Backend`.

#### Step 3.3: Paste the Source Code
1. In the left files list, select `Code.gs`.
2. Delete any default placeholder code.
3. Open `google-apps-script/Code.gs` from this repository, copy the entire file content, and paste it into `Code.gs`.
4. Click the **Save** (disk) icon or press `Ctrl + S` / `Cmd + S`.

#### Step 3.4: Configure Manifest (appsscript.json)
1. In Apps Script, click the **Project Settings** (gear icon) on the left sidebar.
2. Check the box: **"Show "appsscript.json" manifest file in editor"**.
3. Return to the **Editor** (`< >` icon) and click on `appsscript.json`.
4. Replace its content with the contents of `google-apps-script/appsscript.json`:
   ```json
   {
     "timeZone": "Asia/Kolkata",
     "dependencies": {},
     "exceptionLogging": "STACKDRIVER",
     "runtimeVersion": "V8",
     "webapp": {
       "executeAs": "USER_DEPLOYING",
       "access": "ANYONE"
     }
   }
   ```
5. Click **Save**.

#### Step 3.5: Deploy as Web App
1. In the top-right corner of the Apps Script editor, click **Deploy** > **New deployment**.
2. Click the gear icon next to "Select type" and select **Web app**.
3. Configure the deployment settings:
   - **Description**: `Thoothukudi Patta Backend API v1`
   - **Execute as**: `Me (thoothukudidistrictpmu@gmail.com)`
   - **Who has access**: `Anyone` *(Note: The endpoint is strictly secured by the application via `API_SECRET_KEY` and server-side Taluk session validation)*
4. Click **Deploy**.

#### Step 3.6: Authorize Access
1. When prompted with "Authorization required", click **Authorize access**.
2. Choose your Google account (`thoothukudidistrictpmu@gmail.com`).
3. If Google displays "Google hasn't verified this app", click **Advanced** > **Go to Thoothukudi-Patta-Monitoring-Backend (unsafe)**.
4. Click **Allow** to grant permission to read and modify Google Sheets.

#### Step 3.7: Copy the Web App URL
1. After authorization completes, Apps Script displays the **Web App URL**:
   Example: `https://script.google.com/macros/s/AKfycbx.../exec`
2. Click **Copy** to copy this URL.

---

### 4. Configuring the Web App URL in the Portal

1. Log into the portal as the District Admin (`username: districtadmin`).
2. Navigate to **Data & Audit** in the navigation sidebar.
3. Under **Google Apps Script Web App (Backend API)**, paste the copied Web App URL into the input field.
4. Click **Save Web App URL**.
5. Click **Test Connection** to execute a live health check (`action=ping`).
   - A green notification `ONLINE (Connected)` confirms active integration!

---

### 5. API Actions & Data Contracts

All requests are authenticated with `secret: "TNK-THOO-PATTA-GAS-SECURE-2026"` and verified officer credentials.

#### 1. `ping` / `status` (GET)
- **Parameters**: `action=ping`
- **Response**:
  ```json
  {
    "success": true,
    "status": "ONLINE",
    "spreadsheetId": "1wcvgGj_Y6__RpUSDjv5J3D0OWVPiplZLdN0BZ6KPvfw",
    "totalRows": 29534,
    "totalBeneficiaries": 29533
  }
  ```

#### 2. `getBeneficiaries` (GET)
- **Parameters**: `action=getBeneficiaries&taluk=Eral&category=New Free House Site Patta&page=1&limit=15`
- **Security**: Tahsildars can only query their own assigned Taluk; queries for other taluks are rejected with HTTP 403.
- **Response**: Paginated array of beneficiaries with Columns A–W.

#### 3. `getBeneficiary` (GET)
- **Parameters**: `action=getBeneficiary&id=TNK-THOO-FH-00001`
- **Response**: Complete record, verification values, and audit history.

#### 4. `updateVerification` (POST)
- **Parameters**:
  ```json
  {
    "action": "updateVerification",
    "id": "TNK-THOO-FH-00001",
    "secret": "TNK-THOO-PATTA-GAS-SECURE-2026",
    "officerRole": "Taluk Admin",
    "officerTaluk": "Eral",
    "officerName": "tahsildar01",
    "community": "BC",
    "patta_issued": "Yes",
    "patta_number": "TN/ERAL/PT/2026/001",
    "patta_issue_date": "2026-11-12",
    "seniority_register_maintained": "Yes",
    "included_in_seniority_register": "Yes",
    "seniority_number": "SR/ERAL/101",
    "land_occupied": "Objectionable Poramboke",
    "relocation_willingness": "Relocation Accepted",
    "firka": "Eral Firka",
    "verified_revenue_village": "Arumugamangalam (10)",
    "verification_status": "Completed",
    "remarks": "Joint verification completed by VAO and Tahsildar."
  }
  ```
- **Execution**:
  - Finds the exact row by permanent `Beneficiary ID` (Col W) or `S.No` (Col A).
  - Preserves immutable GDP petition columns A–F.
  - Updates Columns G–W with the 13 verification values.
  - Appends field change records into `Verification_Audit_Trail` worksheet.

#### 5. `getStats` (GET)
- **Parameters**: `action=getStats`
- **Calculation**: Aggregates verified, pending, and rejected tallies directly from the live spreadsheet rows.

---

### 6. Security & Access Control

1. **Zero Public Passwords**: Passwords from the `User ID` worksheet are never returned in responses or exposed in frontend code.
2. **Server-Side Identity Validation**: The Express server verifies sessions and injects verified officer credentials; no client can spoof its taluk.
3. **Role-Based Taluk Isolation**: Any attempt by a Tahsildar to verify or read records from another Taluk is blocked on both Express server and Apps Script with HTTP 403.
