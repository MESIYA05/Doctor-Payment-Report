
/* ==========================================================================
   CONFIGURATION
   Adjust these to match your Zoho Creator application field API names.

   IMPORTANT:
   - appName  = the "link name" of your Creator app, found in the app URL:
                 https://creator.zoho.com/<owner>/<app_link_name>/...
   - reportName = the "link name" of the report (Reports panel -> report ->
                 Properties -> Link Name), NOT the display name shown in the UI.
   - Field keys under "fields" below must be the field API / link names
     (Form -> field -> Properties -> Field Name), which are case-sensitive
     and usually use underscores instead of spaces.
   ========================================================================== */
/* ==========================================================================
   BRANDING (used to render the letterhead-style header/footer on the
   exported PDF so it matches the official Medi Elves report template)
   ========================================================================== */
var BRANDING = {
  companyName: "Medi Elves",
  tagline: "Keep it simple",
  reportTitle: "PAYMENT REPORT",
  phone: "1800 956 692",
  email: "admin@medielves.com.au",
  website: "www.medielves.com.au",
  confidentialHeading: "CONFIDENTIAL \u2013 CONTAINS SENSITIVE HEALTH INFORMATION",
  confidentialBody: "This document contains confidential patient and billing information and is intended only for the named recipient and authorised personnel. Unauthorised access, use, copying, forwarding or disclosure is prohibited. If you received this document in error, please notify Medi Elves immediately, delete all electronic copies and securely destroy any printed copies.",
  logoBase64: "" // keep your existing base64 logo string here (omitted for brevity)
};

var CONFIG = {
  appName: "claims-management",        // Zoho Creator application link name
  reportName: "Add_Invocie_Report",    // Report link name in Zoho Creator
  pageSize: 200,                       // records fetched per page (v1 API paginates via page/pageSize)
  criteria: "",                        // optional Zoho Creator criteria string, e.g. "Status == \"Active\""
  fields: {
    paymentNo:       "Payment_No",
    paymentDate:     "Payment_Date",
    doctor:          "Doctor",
    invoiceNo:       "Invoice_No",
    paymentType:     "Payment_Type",
    payingAmount:    "Payable_Amount",
    amountAdjusted:  "Amount_Adjusted",
    balanceAmount:   "Amount_Due"
  }
};

var allRecords = [];     // full unfiltered dataset
var visibleRecords = []; // currently filtered dataset (drives table + exports)

/* ==========================================================================
   INITIALISE WIDGET + FETCH DATA
   ========================================================================== */
window.onload = function () {
  bindEvents();

  if (window.ZOHO && ZOHO.CREATOR) {
    ZOHO.CREATOR.init()
      .then(function () {
        fetchAllRecords();
      })
      .catch(function (err) {
        console.error("ZOHO.CREATOR.init() failed:", err);
        showLoadError("Could not initialise the widget inside Zoho Creator. Open this file as a Custom Widget added to a Creator page/report — opening it directly in a browser will not work, since ZOHO.CREATOR only becomes available when embedded inside Creator.");
      });
  } else {
    showLoadError("This widget must be opened inside Zoho Creator to load live data (the ZOHO.CREATOR SDK object was not found).");
  }
};

/* ==========================================================================
   FETCH RECORDS
   ========================================================================== */
function fetchAllRecords(page) {
  page = page || 1;

  var req = {
    appName: CONFIG.appName,
    reportName: CONFIG.reportName,
    criteria: CONFIG.criteria || "",
    page: page,
    pageSize: CONFIG.pageSize
  };

  ZOHO.CREATOR.API.getAllRecords(req)
    .then(function (response) {
      console.log("getAllRecords response (page " + page + "):", response);

      if (response && response.code === 3000 && Array.isArray(response.data)) {
        allRecords = allRecords.concat(response.data);

        if (response.data.length === CONFIG.pageSize) {
          fetchAllRecords(page + 1);
        } else {
          onDataReady();
        }
      } else if (page === 1) {
        console.warn("getAllRecords returned an unexpected response:", response);
        allRecords = [];
        showLoadError(
          "No records were returned (response code: " + (response && response.code) + "). " +
          "Double-check CONFIG.appName ('" + CONFIG.appName + "') and CONFIG.reportName ('" + CONFIG.reportName + "') " +
          "match the exact link names in Zoho Creator, and that this report is accessible to the current user."
        );
      } else {
        onDataReady();
      }
    })
    .catch(function (err) {
      console.error("getAllRecords failed on page " + page + ":", err);
      if (page === 1) {
        showLoadError(
          "Failed to load records from '" + CONFIG.reportName + "'. Open the browser console for the exact error. " +
          "Common causes: appName/reportName link-name mismatch, the widget hasn't been added/published on a page with " +
          "access to this report, or a field API name in CONFIG.fields doesn't exist on this form."
        );
      } else {
        onDataReady();
      }
    });
}

function onDataReady() {
  populateFilterOptions();
  applyFilters();
}

function showLoadError(message) {
  var body = document.getElementById("reportBody");
  body.innerHTML = '<tr class="state-row error"><td colspan="8">' + message + '</td></tr>';
  document.getElementById("recordCount").textContent = "0";
  document.getElementById("totalCount").textContent = "0";
}

/* ==========================================================================
   FILTERS
   ========================================================================== */
var doctorOptions = [];
var doctorSelected = "";
var paymentTypeOptions = [];
var paymentTypeSelected = "";

function populateFilterOptions() {
  doctorOptions = uniqueValues(allRecords, CONFIG.fields.doctor);
  paymentTypeOptions = uniqueValues(allRecords, CONFIG.fields.paymentType);

  renderDoctorOptions(doctorOptions, "");
  renderPaymentTypeOptions(paymentTypeOptions, "");
}

function uniqueValues(records, key) {
  var set = {};
  records.forEach(function (r) {
    var v = getFieldDisplay(r[key]);
    if (v !== "" && v !== undefined && v !== null) set[v] = true;
  });
  return Object.keys(set).sort();
}

/* ---------- Doctor searchable combobox ---------- */
function renderDoctorOptions(list, searchText) {
  var ul = document.getElementById("doctorComboList");
  ul.innerHTML = "";

  var allLi = document.createElement("li");
  allLi.className = "combo-option" + (doctorSelected === "" ? " selected" : "");
  allLi.textContent = "All Doctors";
  allLi.addEventListener("click", function () { selectDoctor(""); });
  ul.appendChild(allLi);

  var ft = (searchText || "").toLowerCase();
  var matches = 0;
  list.forEach(function (name) {
    if (ft && name.toLowerCase().indexOf(ft) === -1) return;
    matches++;
    var li = document.createElement("li");
    li.className = "combo-option" + (doctorSelected === name ? " selected" : "");
    li.textContent = name;
    li.addEventListener("click", function () { selectDoctor(name); });
    ul.appendChild(li);
  });

  if (ft && matches === 0) {
    var empty = document.createElement("li");
    empty.className = "combo-empty";
    empty.textContent = "No doctors found";
    ul.appendChild(empty);
  }
}

function selectDoctor(name) {
  doctorSelected = name;
  document.getElementById("filterDoctor").value = name;
  document.getElementById("doctorComboLabel").textContent = name || "All doctors";
  closeDoctorCombo();
  applyFilters();
}

function openDoctorCombo() {
  closePaymentTypeCombo();
  document.getElementById("doctorComboPanel").classList.add("open");
  document.getElementById("doctorComboControl").classList.add("open");
  var search = document.getElementById("doctorSearchInput");
  search.value = "";
  renderDoctorOptions(doctorOptions, "");
  setTimeout(function () { search.focus(); }, 0);
}

function closeDoctorCombo() {
  document.getElementById("doctorComboPanel").classList.remove("open");
  document.getElementById("doctorComboControl").classList.remove("open");
}

function toggleDoctorCombo() {
  var panel = document.getElementById("doctorComboPanel");
  if (panel.classList.contains("open")) closeDoctorCombo();
  else openDoctorCombo();
}

/* ---------- Payment Type searchable combobox ---------- */
function renderPaymentTypeOptions(list, searchText) {
  var ul = document.getElementById("paymentTypeComboList");
  ul.innerHTML = "";

  var allLi = document.createElement("li");
  allLi.className = "combo-option" + (paymentTypeSelected === "" ? " selected" : "");
  allLi.textContent = "All Payment";
  allLi.addEventListener("click", function () { selectPaymentType(""); });
  ul.appendChild(allLi);

  var ft = (searchText || "").toLowerCase();
  var matches = 0;
  list.forEach(function (name) {
    if (ft && name.toLowerCase().indexOf(ft) === -1) return;
    matches++;
    var li = document.createElement("li");
    li.className = "combo-option" + (paymentTypeSelected === name ? " selected" : "");
    li.textContent = name;
    li.addEventListener("click", function () { selectPaymentType(name); });
    ul.appendChild(li);
  });

  if (ft && matches === 0) {
    var empty = document.createElement("li");
    empty.className = "combo-empty";
    empty.textContent = "No payment types found";
    ul.appendChild(empty);
  }
}

function selectPaymentType(name) {
  paymentTypeSelected = name;
  document.getElementById("filterPaymentType").value = name;
  document.getElementById("paymentTypeComboLabel").textContent = name || "All payment types";
  closePaymentTypeCombo();
  applyFilters();
}

function openPaymentTypeCombo() {
  closeDoctorCombo();
  document.getElementById("paymentTypeComboPanel").classList.add("open");
  document.getElementById("paymentTypeComboControl").classList.add("open");
  var search = document.getElementById("paymentTypeSearchInput");
  search.value = "";
  renderPaymentTypeOptions(paymentTypeOptions, "");
  setTimeout(function () { search.focus(); }, 0);
}

function closePaymentTypeCombo() {
  document.getElementById("paymentTypeComboPanel").classList.remove("open");
  document.getElementById("paymentTypeComboControl").classList.remove("open");
}

function togglePaymentTypeCombo() {
  var panel = document.getElementById("paymentTypeComboPanel");
  if (panel.classList.contains("open")) closePaymentTypeCombo();
  else openPaymentTypeCombo();
}

function applyFilters() {
  var doctor = document.getElementById("filterDoctor").value;
  var payType = document.getElementById("filterPaymentType").value;
  var payDate = document.getElementById("filterPaymentDate").value;
  var search = document.getElementById("searchInput").value.trim().toLowerCase();
  var f = CONFIG.fields;

  visibleRecords = allRecords.filter(function (r) {
    var matchDoctor = !doctor || getFieldDisplay(r[f.doctor]) === doctor;
    var matchType = !payType || getFieldDisplay(r[f.paymentType]) === payType;
    var matchDate = !payDate || normaliseDate(r[f.paymentDate]) === payDate;
    var matchSearch = !search || [
      r[f.paymentNo], r[f.doctor], r[f.invoiceNo], r[f.paymentType]
    ].some(function (v) { return String(safe(v)).toLowerCase().indexOf(search) > -1; });
    return matchDoctor && matchType && matchDate && matchSearch;
  });

  renderTable(visibleRecords);
  updateResetButtonState(doctor, payType, payDate, search);
  updateClearButtonsVisibility(doctor, payType, payDate, search);
}

function updateResetButtonState(doctor, payType, payDate, search) {
  var btn = document.getElementById("resetAllBtn");
  var active = !!(doctor || payType || payDate || search);
  btn.classList.toggle("active", active);
  btn.disabled = !active;
}

function updateClearButtonsVisibility(doctor, payType, payDate, search) {
  toggleClearButton("filterDoctor", !!doctor);
  toggleClearButton("filterPaymentType", !!payType);
  toggleClearButton("filterPaymentDate", !!payDate);
  toggleClearButton("searchInput", !!search);
}

function toggleClearButton(targetId, show) {
  var btn = document.querySelector('.field-clear[data-target="' + targetId + '"]');
  if (btn) btn.classList.toggle("visible", !!show);
}

function normaliseDate(value) {
  if (!value) return "";
  var d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  var mm = String(d.getMonth() + 1).padStart(2, "0");
  var dd = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mm + "-" + dd;
}

function clearSingleFilter(targetId) {
  if (targetId === "filterDoctor") {
    selectDoctor("");
    return;
  }
  if (targetId === "filterPaymentType") {
    selectPaymentType("");
    return;
  }
  var el = document.getElementById(targetId);
  el.value = "";
  applyFilters();
}

function resetAllFilters() {
  doctorSelected = "";
  document.getElementById("filterDoctor").value = "";
  document.getElementById("doctorComboLabel").textContent = "All doctors";
  paymentTypeSelected = "";
  document.getElementById("filterPaymentType").value = "";
  document.getElementById("paymentTypeComboLabel").textContent = "All payment types";
  document.getElementById("filterPaymentDate").value = "";
  document.getElementById("searchInput").value = "";
  applyFilters();
}

/* ==========================================================================
   RENDER TABLE
   ========================================================================== */
function renderTable(records) {
  var body = document.getElementById("reportBody");
  body.innerHTML = "";

  document.getElementById("recordCount").textContent = records.length;
  document.getElementById("totalCount").textContent = allRecords.length;

  if (records.length === 0) {
    body.innerHTML = '<tr class="state-row"><td colspan="8">No payments match the selected filters.</td></tr>';
    renderGrandSummary([]);
    return;
  }

  var f = CONFIG.fields;
  records.forEach(function (r) {
    var balance = Number(r[f.balanceAmount]) || 0;
    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + safe(r[f.paymentNo]) + "</td>" +
      "<td>" + safe(formatDisplayDate(r[f.paymentDate])) + "</td>" +
      "<td>" + safe(r[f.doctor]) + "</td>" +
      "<td>" + safe(r[f.invoiceNo]) + "</td>" +
      "<td>" + safe(r[f.paymentType]) + "</td>" +
      "<td class='num'>" + formatAmount(r[f.payingAmount]) + "</td>" +
      "<td class='num'>" + formatAmount(r[f.amountAdjusted]) + "</td>" +
      "<td class='num " + (balance > 0 ? "balance-due" : "balance-clear") + "'>" + formatAmount(balance) + "</td>";
    body.appendChild(tr);
  });

  renderGrandSummary(records);
}

/* ---------- Grand Payment Summary (on-screen card) ---------- */
function renderGrandSummary(records) {
  var f = CONFIG.fields;
  var doctorSet = {};
  var totals = { paying: 0, adjusted: 0, balance: 0 };

  records.forEach(function (r) {
    var docName = getFieldDisplay(r[f.doctor]);
    if (docName) doctorSet[docName] = true;
    totals.paying   += Number(r[f.payingAmount]) || 0;
    totals.adjusted += Number(r[f.amountAdjusted]) || 0;
    totals.balance  += Number(r[f.balanceAmount]) || 0;
  });

  document.getElementById("gsTotalPayments").textContent = records.length;
  document.getElementById("gsDoctors").textContent = Object.keys(doctorSet).length;
  document.getElementById("gsPayingAmount").textContent   = formatAmount(totals.paying);
  document.getElementById("gsAmountAdjusted").textContent = formatAmount(totals.adjusted);
  document.getElementById("gsBalanceAmount").textContent  = formatAmount(totals.balance);
}

function safe(v) { return (v === undefined || v === null) ? "" : getFieldDisplay(v); }

function getFieldDisplay(v) {
  if (v === undefined || v === null) return "";
  if (typeof v !== "object") return v;

  if (Array.isArray(v)) {
    return v.map(getFieldDisplay).filter(function (s) { return s !== ""; }).join(", ");
  }

  if (typeof v.display_value !== "undefined") return v.display_value;
  if (typeof v.zc_display_value !== "undefined") return v.zc_display_value;
  if (typeof v.first_name !== "undefined" || typeof v.last_name !== "undefined") {
    return [v.first_name, v.last_name].filter(Boolean).join(" ");
  }
  if (typeof v.value !== "undefined") return v.value;
  if (typeof v.Name !== "undefined") return getFieldDisplay(v.Name);

  var parts = Object.keys(v)
    .filter(function (k) { return k.toUpperCase() !== "ID"; })
    .map(function (k) { return getFieldDisplay(v[k]); })
    .filter(function (s) { return s !== ""; });
  return parts.join(" ");
}
function formatAmount(v) {
  var n = Number(v) || 0;
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDisplayDate(v) {
  var norm = normaliseDate(v);
  if (!norm) return "";
  var parts = norm.split("-");
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return parts[2] + "-" + months[parseInt(parts[1], 10) - 1] + "-" + parts[0];
}

/* ==========================================================================
   EXPORTS
   ========================================================================== */
function getExportRows() {
  var f = CONFIG.fields;
  return visibleRecords.map(function (r) {
    return {
      "Payment No": safe(r[f.paymentNo]),
      "Payment Date": formatDisplayDate(r[f.paymentDate]),
      "Doctor": safe(r[f.doctor]),
      "Invoice No": safe(r[f.invoiceNo]),
      "Payment Type": safe(r[f.paymentType]),
      "Paying Amount": Number(r[f.payingAmount]) || 0,
      "Amount Adjusted": Number(r[f.amountAdjusted]) || 0,
      "Balance Amount": Number(r[f.balanceAmount]) || 0
    };
  });
}

/* ---------- Shared helper: Grand Payment Summary totals for exports ---------- */
function computeGrandSummary(rows) {
  var doctorSet = {};
  var totals = { paying: 0, adjusted: 0, balance: 0 };

  rows.forEach(function (r) {
    if (r["Doctor"]) doctorSet[r["Doctor"]] = true;
    totals.paying   += r["Paying Amount"];
    totals.adjusted += r["Amount Adjusted"];
    totals.balance  += r["Balance Amount"];
  });

  return {
    totalPayments: rows.length,
    doctors: Object.keys(doctorSet).length,
    paying: totals.paying,
    adjusted: totals.adjusted,
    balance: totals.balance
  };
}

function exportExcel() {
  var rows = getExportRows();
  if (rows.length === 0) { alert("There is no data to export."); return; }

  var doctor  = document.getElementById("filterDoctor").value;
  var payType = document.getElementById("filterPaymentType").value;
  var payDate = document.getElementById("filterPaymentDate").value;

  var hospitalEl = document.getElementById("filterHospital");
  var hospital = hospitalEl ? hospitalEl.value : "";

  var doctorName   = doctor || "All Doctors";
  var hospitalName = payType || "All ";
  var reportPeriod = (payDate ? formatDisplayDate(payDate) : "All Dates");
  var generatedOn  = new Date().toLocaleString("en-AU", {
    day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit"
  });

  var NAVY      = '1B2A4A';
  var TEAL      = '0F6B5C';
  var HEADER_BG = '2E6F8E';
  var LINE      = 'E1E7E5';
  var TEXT      = '0F1B19';
  var TOTAL_BG  = 'EEF3F5';

  var TABLE_HEADERS = [
    "Payment No", "Payment Date", "Doctor", "Invoice No",
    "Payment Type", "Paying Amount", "Amount Adjusted", "Balance Amount"
  ];
  var COL_COUNT = TABLE_HEADERS.length;

  var TITLE_ROW   = 0;
  var LABEL_ROW   = 2;
  var VALUE_ROW   = 3;
  var HEADER_ROW  = 5;
  var DATA_START  = 6;

  var aoa = [];
  aoa[TITLE_ROW]  = ["Payment Report"].concat(new Array(COL_COUNT - 1).fill(""));
  aoa[1]          = new Array(COL_COUNT).fill("");
  aoa[LABEL_ROW]  = ["DOCTOR", "", "PAYMENT TYPE", "", "PAYMENT DATE", "", "GENERATED ON", ""];
  aoa[VALUE_ROW]  = [doctorName, "", hospitalName, "", reportPeriod, "", generatedOn, ""];
  aoa[4]          = new Array(COL_COUNT).fill("");
  aoa[HEADER_ROW] = TABLE_HEADERS;

  rows.forEach(function (r) {
    aoa.push([
      r["Payment No"], r["Payment Date"], r["Doctor"], r["Invoice No"],
      r["Payment Type"], r["Paying Amount"], r["Amount Adjusted"], r["Balance Amount"]
    ]);
  });

  // ---- Grand Payment Summary card, immediately after the last data row, mirroring the on-screen widget ----
  var summary = computeGrandSummary(rows);
  var SUMMARY_GAP_ROW   = DATA_START + rows.length;
  var SUMMARY_TITLE_ROW = SUMMARY_GAP_ROW + 1;
  var SUMMARY_LABEL_ROW = SUMMARY_GAP_ROW + 2;
  var SUMMARY_VALUE_ROW = SUMMARY_GAP_ROW + 3;

  aoa[SUMMARY_GAP_ROW]   = new Array(COL_COUNT).fill("");
  aoa[SUMMARY_TITLE_ROW] = ["GRAND SUMMARY"].concat(new Array(COL_COUNT - 1).fill(""));
  aoa[SUMMARY_LABEL_ROW] = ["TOTAL PAYMENTS", "DOCTORS", "", "", "", "PAYING AMOUNT", "AMOUNT ADJUSTED", "BALANCE AMOUNT"];
  aoa[SUMMARY_VALUE_ROW] = [summary.totalPayments, summary.doctors, "", "", "", summary.paying, summary.adjusted, summary.balance];

  var ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!cols'] = [
    { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
    { wch: 16 }, { wch: 15 }, { wch: 16 }, { wch: 15 }
  ];

  ws['!rows'] = [];
  ws['!rows'][TITLE_ROW] = { hpt: 26 };

  ws['!merges'] = [
    { s: { r: TITLE_ROW, c: 0 }, e: { r: TITLE_ROW, c: COL_COUNT - 1 } },
    { s: { r: LABEL_ROW, c: 0 }, e: { r: LABEL_ROW, c: 1 } },
    { s: { r: LABEL_ROW, c: 2 }, e: { r: LABEL_ROW, c: 3 } },
    { s: { r: LABEL_ROW, c: 4 }, e: { r: LABEL_ROW, c: 5 } },
    { s: { r: LABEL_ROW, c: 6 }, e: { r: LABEL_ROW, c: 7 } },
    { s: { r: VALUE_ROW, c: 0 }, e: { r: VALUE_ROW, c: 1 } },
    { s: { r: VALUE_ROW, c: 2 }, e: { r: VALUE_ROW, c: 3 } },
    { s: { r: VALUE_ROW, c: 4 }, e: { r: VALUE_ROW, c: 5 } },
    { s: { r: VALUE_ROW, c: 6 }, e: { r: VALUE_ROW, c: 7 } }
  ];
  ws['!merges'].push(
    { s: { r: SUMMARY_TITLE_ROW, c: 0 }, e: { r: SUMMARY_TITLE_ROW, c: COL_COUNT - 1 } },
    { s: { r: SUMMARY_LABEL_ROW, c: 0 }, e: { r: SUMMARY_LABEL_ROW, c: 1 } },
    { s: { r: SUMMARY_VALUE_ROW, c: 0 }, e: { r: SUMMARY_VALUE_ROW, c: 1 } }
  );

  var thin = { style: 'thin', color: { rgb: LINE } };

  function boxBorder(r, c1, c2, colorHex) {
    var col = { style: 'medium', color: { rgb: colorHex } };
    for (var c = c1; c <= c2; c++) {
      var addr = XLSX.utils.encode_cell({ r: r, c: c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      var border = { top: col, bottom: col };
      if (c === c1) border.left = col;
      if (c === c2) border.right = col;
      ws[addr].s = Object.assign({}, ws[addr].s, { border: border });
    }
  }

  boxBorder(TITLE_ROW, 0, COL_COUNT - 1, TEAL);
  var titleAddr = XLSX.utils.encode_cell({ r: TITLE_ROW, c: 0 });
  ws[titleAddr].s = Object.assign({}, ws[titleAddr].s, {
    font: { bold: true, sz: 14, color: { rgb: NAVY } },
    alignment: { horizontal: 'left', vertical: 'center', indent: 1 }
  });

  [0, 2, 4, 6].forEach(function (c) {
    var labelAddr = XLSX.utils.encode_cell({ r: LABEL_ROW, c: c });
    ws[labelAddr].s = {
      font: { bold: true, sz: 9, color: { rgb: TEAL } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 }
    };
    var valueAddr = XLSX.utils.encode_cell({ r: VALUE_ROW, c: c });
    ws[valueAddr].s = {
      font: { bold: true, sz: 11, color: { rgb: TEXT } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 }
    };
  });

  for (var c = 0; c < COL_COUNT; c++) {
    var addr = XLSX.utils.encode_cell({ r: HEADER_ROW, c: c });
    ws[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: HEADER_BG } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: thin, bottom: thin, left: thin, right: thin }
    };
  }

  var numericCols = [5, 6, 7];

  for (var R = DATA_START; R < SUMMARY_GAP_ROW; R++) {
    for (var C = 0; C < COL_COUNT; C++) {
      var cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      var cell = ws[cellAddr];
      if (!cell) continue;

      if (numericCols.indexOf(C) > -1) {
        cell.t = 'n';
        cell.z = '#,##0.00';
        cell.s = { alignment: { horizontal: 'right', vertical: 'center' }, border: { bottom: thin } };
      } else {
        cell.s = { alignment: { horizontal: 'left', vertical: 'center' }, border: { bottom: thin } };
      }
    }
  }

  // ---- Style the Grand Payment Summary card as one clean, continuous block ----
  var SUMMARY_BG     = 'EEF3FC';
  var SUMMARY_BORDER = { style: 'medium', color: { rgb: HEADER_BG } };
  var summaryThin    = { style: 'thin', color: { rgb: 'D8E3F5' } };

  [SUMMARY_TITLE_ROW, SUMMARY_LABEL_ROW, SUMMARY_VALUE_ROW].forEach(function (r) {
    for (var c = 0; c < COL_COUNT; c++) {
      var addr = XLSX.utils.encode_cell({ r: r, c: c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };

      var border = {};
      if (r === SUMMARY_TITLE_ROW) border.top = SUMMARY_BORDER;
      if (r === SUMMARY_VALUE_ROW) border.bottom = SUMMARY_BORDER;
      if (c === 0) border.left = SUMMARY_BORDER;
      if (c === COL_COUNT - 1) border.right = SUMMARY_BORDER;

      ws[addr].s = Object.assign({}, ws[addr].s, {
        fill: { fgColor: { rgb: SUMMARY_BG } },
        border: border
      });
    }
  });

  var summaryTitleAddr = XLSX.utils.encode_cell({ r: SUMMARY_TITLE_ROW, c: 0 });
  ws[summaryTitleAddr].s = Object.assign({}, ws[summaryTitleAddr].s, {
    font: { bold: true, sz: 11, color: { rgb: NAVY } },
    alignment: { horizontal: 'left', vertical: 'center', indent: 1 }
  });

  var summaryCols = [0, 1, 5, 6, 7];
  summaryCols.forEach(function (c) {
    var labelAddr = XLSX.utils.encode_cell({ r: SUMMARY_LABEL_ROW, c: c });
    ws[labelAddr].s = Object.assign({}, ws[labelAddr].s, {
      font: { bold: true, sz: 8.5, color: { rgb: '5C7290' } },
      alignment: { horizontal: c >= 5 ? 'right' : 'left', vertical: 'center', indent: c < 5 ? 1 : 0 },
      border: Object.assign({}, ws[labelAddr].s.border, { bottom: summaryThin })
    });

    var valueAddr = XLSX.utils.encode_cell({ r: SUMMARY_VALUE_ROW, c: c });
    var isBalance = (c === 7);
    var isNumeric = (c === 5 || c === 6 || c === 7);
    if (isNumeric) {
      ws[valueAddr].t = 'n';
      ws[valueAddr].z = '#,##0.00';
    }
    ws[valueAddr].s = Object.assign({}, ws[valueAddr].s, {
      font: { bold: true, sz: 13, color: { rgb: isBalance ? 'C1473C' : NAVY } },
      alignment: { horizontal: c >= 5 ? 'right' : 'left', vertical: 'center', indent: c < 5 ? 1 : 0 }
    });
  });

  ws['!freeze'] = { xSplit: 0, ySplit: HEADER_ROW + 1 };

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Doctor Payments");
  XLSX.writeFile(wb, "Doctor_Payments_Report.xlsx", { cellStyles: true });
}

/* ==========================================================================
   PDF LETTERHEAD (header + footer)
   ========================================================================== */
var PDF_COLORS = {
  panelDark:  [9, 58, 53],
  panelLight: [8, 95, 44],
  navy:       [21, 35, 75],
  mintBg:     [222, 242, 232],
  iconGreen:  [10, 92, 54],
  ruleGreen:  [46, 143, 80],
  tableHead:  [59, 89, 138],
  rowAlt:     [247, 250, 250],
  textMute:   [124, 139, 147],
  textDark:   [36, 49, 58],
  borderLine: [220, 230, 234]
};

/* ---- Icon library (unchanged from your original file) ---- */
function drawPersonIcon(doc, cx, cy, r) {
  doc.setDrawColor.apply(doc, PDF_COLORS.iconGreen);
  doc.setLineWidth(1.1);
  var headR = r * 0.34;
  doc.circle(cx, cy - r * 0.32, headR, "S");
  var bodyW = r * 1.15;
  var bodyH = r * 0.7;
  doc.roundedRect(cx - bodyW / 2, cy + r * 0.05, bodyW, bodyH, bodyW * 0.3, bodyW * 0.3, "S");
}

function drawCardIcon(doc, cx, cy, r) {
  doc.setDrawColor.apply(doc, PDF_COLORS.iconGreen);
  doc.setLineWidth(1.1);
  var w = r * 1.5, h = r * 1.05;
  var x = cx - w / 2, y = cy - h / 2;
  doc.roundedRect(x, y, w, h, 1.6, 1.6, "S");
  doc.setFillColor.apply(doc, PDF_COLORS.iconGreen);
  doc.rect(x, y + h * 0.28, w, h * 0.2, "F");
  doc.setLineWidth(1);
  doc.line(x + w * 0.14, y + h * 0.72, x + w * 0.5, y + h * 0.72);
}

function drawCalendarIcon(doc, cx, cy, r) {
  doc.setDrawColor.apply(doc, PDF_COLORS.iconGreen);
  doc.setLineWidth(1.1);
  var w = r * 1.3, h = r * 1.25;
  var x = cx - w / 2, y = cy - h / 2 + r * 0.15;
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "S");
  doc.line(x, y + h * 0.32, x + w, y + h * 0.32);
  doc.setLineWidth(1.3);
  doc.line(x + w * 0.26, y - r * 0.16, x + w * 0.26, y + r * 0.1);
  doc.line(x + w * 0.74, y - r * 0.16, x + w * 0.74, y + r * 0.1);
  doc.setFillColor.apply(doc, PDF_COLORS.iconGreen);
  doc.circle(cx, y + h * 0.66, r * 0.09, "F");
}

function drawClockIcon(doc, cx, cy, r) {
  doc.setDrawColor.apply(doc, PDF_COLORS.iconGreen);
  doc.setLineWidth(1.1);
  doc.circle(cx, cy, r * 0.58, "S");
  doc.setLineWidth(1);
  doc.line(cx, cy, cx, cy - r * 0.34);
  doc.line(cx, cy, cx + r * 0.24, cy + r * 0.1);
}

function drawHospitalIcon(doc, cx, cy, r) {
  doc.setDrawColor.apply(doc, PDF_COLORS.iconGreen);
  doc.setLineWidth(1.0);
  var w = r * 1.1, h = r * 1.3;
  var x = cx - w / 2, y = cy - h / 2 + r * 0.1;
  doc.rect(x, y, w, h, "S");
  var winSize = w * 0.22;
  var gap = w * 0.14;
  for (var row = 0; row < 2; row++) {
    for (var col = 0; col < 2; col++) {
      var wx = x + gap + col * (winSize + gap);
      var wy = y + gap + row * (winSize + gap);
      doc.rect(wx, wy, winSize, winSize, "S");
    }
  }
  doc.setLineWidth(1.1);
  doc.line(cx, y - r * 0.18, cx, y + r * 0.02);
  doc.line(cx - r * 0.12, y - r * 0.08, cx + r * 0.12, y - r * 0.08);
}

function drawPhoneIcon(doc, cx, cy, r) {
  doc.setFillColor.apply(doc, PDF_COLORS.iconGreen);
  doc.setDrawColor.apply(doc, PDF_COLORS.iconGreen);
  doc.setLineWidth(0.2);
  var s = r * 0.06;
  var startX = cx + (6.62 - 12) * s;
  var startY = cy + (10.79 - 12) * s;
  doc.lines(
    [
      [1.44, 2.83, 3.76, 5.14, 6.59, 6.59],
      [2.2, -2.2],
      [0.27, -0.27, 0.67, -0.36, 1.02, -0.24],
      [1.12, 0.37, 2.33, 0.57, 3.57, 0.57],
      [0.55, 0, 1, 0.45, 1, 1],
      [0, 3.49],
      [0, 0.55, -0.45, 1, -1, 1],
      [-9.39, 0, -17, -7.61, -17, -17],
      [0, -0.55, 0.45, -1, 1, -1],
      [3.5, 0],
      [0.55, 0, 1, 0.45, 1, 1],
      [0, 1.25, 0.2, 2.45, 0.57, 3.57],
      [0.11, 0.35, 0.03, 0.74, -0.25, 1.02],
      [-2.2, 2.2]
    ],
    startX, startY,
    [s, s],
    "F",
    true
  );
}

function drawEmailIcon(doc, cx, cy, r) {
  doc.setDrawColor.apply(doc, PDF_COLORS.iconGreen);
  doc.setLineWidth(1.0);
  var w = r * 1.6, h = r * 1.05;
  var x = cx - w / 2, y = cy - h / 2;
  doc.roundedRect(x, y, w, h, 1.2, 1.2, "S");
  doc.line(x, y, cx, y + h * 0.55);
  doc.line(cx, y + h * 0.55, x + w, y);
}

function drawGlobeIcon(doc, cx, cy, r) {
  doc.setDrawColor.apply(doc, PDF_COLORS.iconGreen);
  doc.setLineWidth(0.9);
  var gr = r * 0.62;
  doc.circle(cx, cy, gr, "S");
  doc.ellipse(cx, cy, gr * 0.42, gr, "S");
  doc.line(cx - gr, cy, cx + gr, cy);
}

function drawShieldLockIcon(doc, cx, cy, r) {
  var startX = cx - r, startY = cy - r * 0.6;
  doc.setDrawColor.apply(doc, PDF_COLORS.iconGreen);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(1.4);
  doc.lines(
    [
      [r * 2, 0],
      [0, r * 0.75],
      [-r, r * 0.85],
      [-r, -r * 0.85],
      [0, -r * 0.75]
    ],
    startX, startY,
    [1, 1],
    "FD",
    true
  );
  doc.setFillColor.apply(doc, PDF_COLORS.iconGreen);
  doc.roundedRect(cx - r * 0.32, cy - r * 0.02, r * 0.64, r * 0.5, 1, 1, "F");
  doc.setDrawColor.apply(doc, PDF_COLORS.iconGreen);
  doc.setLineWidth(1.2);
  doc.line(cx - r * 0.18, cy - r * 0.02, cx - r * 0.18, cy - r * 0.28);
  doc.line(cx + r * 0.18, cy - r * 0.02, cx + r * 0.18, cy - r * 0.28);
  doc.line(cx - r * 0.18, cy - r * 0.28, cx + r * 0.18, cy - r * 0.28);
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy + r * 0.2, r * 0.06, "F");
}

function drawPdfHeader(doc, pageWidth, meta) {
  var marginX = 34;
  var panelY = 26, panelH = 54;

  try {
    var logoH = panelH, logoW = logoH * (322 / 122);
    doc.addImage(BRANDING.logoBase64, "PNG", marginX, panelY, logoW, logoH);
  } catch (e) {
    doc.setTextColor.apply(doc, PDF_COLORS.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(BRANDING.companyName, marginX + 14, panelY + panelH / 2 + 4);
  }

  var titleText = meta.reportTitle;
  doc.setTextColor.apply(doc, PDF_COLORS.navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(titleText, pageWidth - marginX - 10, panelY + panelH / 2 + 6, { align: "right" });

  var ruleY = panelY + panelH + 14;
  doc.setDrawColor.apply(doc, PDF_COLORS.ruleGreen);
  doc.setLineWidth(1.3);
  doc.line(marginX, ruleY, pageWidth - marginX, ruleY);
  doc.setFillColor.apply(doc, PDF_COLORS.panelDark);
  doc.circle(marginX + 3, ruleY, 2.6, "F");

  var metaY = ruleY + 34;
  var cols = [
    { label: "DOCTOR",       value: meta.doctor,      icon: drawPersonIcon }
  ];
  if (meta.hospital) {
    cols.push({ label: "HOSPITAL", value: meta.hospital, icon: drawHospitalIcon });
  }
  cols.push(
    { label: "PAYMENT TYPE", value: meta.paymentType, icon: drawCardIcon },
    { label: "PAYMENT DATE", value: meta.paymentDate, icon: drawCalendarIcon },
    { label: "GENERATED ON", value: meta.generatedOn, icon: drawClockIcon }
  );

  var colW = (pageWidth - marginX * 2) / cols.length;
  cols.forEach(function (c, i) {
    var colX = marginX + i * colW;
    c.icon(doc, colX + 7, metaY - 4, 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor.apply(doc, PDF_COLORS.textMute);
    doc.text(c.label, colX + 20, metaY - 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, PDF_COLORS.navy);
    doc.text(String(c.value || "\u2014"), colX + 20, metaY + 6);
  });

  doc.setDrawColor.apply(doc, PDF_COLORS.borderLine);
  doc.setLineWidth(0.6);
  doc.line(marginX, metaY + 16, pageWidth - marginX, metaY + 16);
}

function drawPdfFooter(doc, pageWidth, pageHeight, pageNum, totalPages) {
  var marginX = 34;
  var lineY = pageHeight - 78;

  doc.setDrawColor.apply(doc, PDF_COLORS.borderLine);
  doc.setLineWidth(0.7);
  doc.line(marginX, lineY, pageWidth - marginX, lineY);

  drawShieldLockIcon(doc, marginX + 8, lineY + 20, 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor.apply(doc, PDF_COLORS.textDark);
  doc.text(BRANDING.confidentialHeading, marginX + 24, lineY + 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor.apply(doc, PDF_COLORS.textMute);
  var bodyLines = doc.splitTextToSize(BRANDING.confidentialBody, pageWidth - marginX * 2 - 24);
  doc.text(bodyLines.slice(0, 2), marginX + 24, lineY + 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor.apply(doc, PDF_COLORS.textMute);
  doc.text("Page " + pageNum + " of " + totalPages, pageWidth - marginX, lineY + 17, { align: "right" });

  var stripY = pageHeight - 26;
  doc.setDrawColor.apply(doc, PDF_COLORS.borderLine);
  doc.setLineWidth(0.5);
  doc.line(marginX, stripY - 12, pageWidth - marginX, stripY - 12);

  var contacts = [
    { text: BRANDING.phone,   icon: drawPhoneIcon },
    { text: BRANDING.email,   icon: drawEmailIcon },
    { text: BRANDING.website, icon: drawGlobeIcon }
  ];
  var segW = (pageWidth - marginX * 2) / contacts.length;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  contacts.forEach(function (c, i) {
    var segX = marginX + i * segW;
    var textW = doc.getTextWidth(c.text);
    var iconX = segX + segW / 2 - textW / 2 - 9;
    c.icon(doc, iconX, stripY - 3, 6);
    doc.setTextColor.apply(doc, PDF_COLORS.textDark);
    doc.text(c.text, segX + segW / 2 - textW / 2 + 4, stripY);
  });
}

/* ---------- Grand Payment Summary card drawn on the PDF, below the table ---------- */
function drawGrandSummaryPdf(doc, pageWidth, startY, summary) {
  var marginX = 34;
  var cardW = pageWidth - marginX * 2;
  var cardH = 78;
  var cardX = marginX;
  var cardY = startY;

  doc.setFillColor(238, 243, 252); // #EEF3FC
  doc.roundedRect(cardX, cardY, cardW, cardH, 6, 6, "F");
  doc.setFillColor.apply(doc, PDF_COLORS.navy);
  doc.roundedRect(cardX, cardY, cardW, 4, 2, 2, "F");
  doc.setDrawColor(216, 227, 245);
  doc.setLineWidth(0.7);
  doc.roundedRect(cardX, cardY, cardW, cardH, 6, 6, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor.apply(doc, PDF_COLORS.navy);
  doc.text("GRAND SUMMARY", cardX + 18, cardY + 24);

  var metrics = [
    { label: "TOTAL PAYMENTS",  value: String(summary.totalPayments), color: PDF_COLORS.navy },
    { label: "DOCTORS",         value: String(summary.doctors),       color: PDF_COLORS.navy },
    { label: "PAYING AMOUNT",   value: summary.paying.toFixed(2),     color: PDF_COLORS.navy },
    { label: "AMOUNT ADJUSTED", value: summary.adjusted.toFixed(2),   color: PDF_COLORS.navy },
    { label: "BALANCE AMOUNT",  value: summary.balance.toFixed(2),    color: [193, 71, 60] }
  ];

  var colW = cardW / metrics.length;
  var rowY = cardY + 46;

  metrics.forEach(function (m, i) {
    var colX = cardX + i * colW + 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(92, 114, 144);
    doc.text(m.label, colX, rowY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor.apply(doc, m.color);
    doc.text(m.value, colX, rowY + 18);
  });

  return cardY + cardH;
}

function exportPdf() {
  var rows = getExportRows();
  if (rows.length === 0) { alert("There is no data to export."); return; }

  var doctor = document.getElementById("filterDoctor").value;
  var payType = document.getElementById("filterPaymentType").value;
  var payDate = document.getElementById("filterPaymentDate").value;

  var hospitalEl = document.getElementById("filterHospital");
  var hospital = hospitalEl ? hospitalEl.value : "";

  var meta = {
    reportTitle: BRANDING.reportTitle,
    doctor: doctor || "All Doctors",
    hospital: hospital || null,
    paymentType: payType || "All Payment Types",
    paymentDate: payDate ? formatDisplayDate(payDate) : "All Dates",
    generatedOn: new Date().toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true
    })
  };

  var jsPDFCtor = window.jspdf.jsPDF;
  var doc = new jsPDFCtor({ orientation: "portrait", unit: "pt", format: "a4" });
  var pageWidth = doc.internal.pageSize.getWidth();
  var pageHeight = doc.internal.pageSize.getHeight();

  var headers = [["Payment No","Payment Date","Doctor","Invoice No","Payment Type","Paying Amount","Amount Adjusted","Balance Amount"]];
  var body = rows.map(function (r) {
    return [
      r["Payment No"], r["Payment Date"], r["Doctor"], r["Invoice No"], r["Payment Type"],
      r["Paying Amount"].toFixed(2), r["Amount Adjusted"].toFixed(2), r["Balance Amount"].toFixed(2)
    ];
  });

  doc.autoTable({
    head: headers,
    body: body,
    startY: 172,
    margin: { top: 172, left: 34, right: 34, bottom: 92 },
    tableWidth: pageWidth - 68,
    styles: { fontSize: 7, cellPadding: 5, overflow: "linebreak", lineColor: PDF_COLORS.borderLine, lineWidth: 0.5, textColor: PDF_COLORS.textDark },
    headStyles: { fillColor: PDF_COLORS.tableHead, textColor: 255, fontSize: 7.5, fontStyle: "bold", halign: "left" },
    alternateRowStyles: { fillColor: PDF_COLORS.rowAlt },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 55 },
      2: { cellWidth: 95 },
      3: { cellWidth: 58 },
      4: { cellWidth: 65 },
      5: { cellWidth: 62, halign: "right" },
      6: { cellWidth: 68, halign: "right" },
      7: { cellWidth: 68, halign: "right" }
    },
    didDrawPage: function (data) {
      drawPdfHeader(doc, pageWidth, meta);
    }
  });

  // ---- Draw the Grand Payment Summary card below the table ----
  var summary = computeGrandSummary(rows);
  var summaryY = doc.lastAutoTable.finalY + 20;

  if (summaryY + 78 > pageHeight - 92) {
    doc.addPage();
    drawPdfHeader(doc, pageWidth, meta);
    summaryY = 172;
  }
  drawGrandSummaryPdf(doc, pageWidth, summaryY, summary);

  var totalPages = doc.internal.getNumberOfPages();
  for (var i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPdfFooter(doc, pageWidth, pageHeight, i, totalPages);
  }

  doc.save("Doctor_Payments_Report.pdf");
}

/* ==========================================================================
   EVENT BINDINGS
   ========================================================================== */
function bindEvents() {
  document.getElementById("doctorComboControl").addEventListener("click", function (e) {
    e.stopPropagation();
    toggleDoctorCombo();
  });
  document.getElementById("doctorSearchInput").addEventListener("click", function (e) {
    e.stopPropagation();
  });
  document.getElementById("doctorSearchInput").addEventListener("input", function () {
    renderDoctorOptions(doctorOptions, this.value);
  });

  document.getElementById("paymentTypeComboControl").addEventListener("click", function (e) {
    e.stopPropagation();
    togglePaymentTypeCombo();
  });
  document.getElementById("paymentTypeSearchInput").addEventListener("click", function (e) {
    e.stopPropagation();
  });
  document.getElementById("paymentTypeSearchInput").addEventListener("input", function () {
    renderPaymentTypeOptions(paymentTypeOptions, this.value);
  });

  document.addEventListener("click", function (e) {
    var doctorCombo = document.getElementById("doctorCombo");
    if (!doctorCombo.contains(e.target)) closeDoctorCombo();
    var paymentTypeCombo = document.getElementById("paymentTypeCombo");
    if (!paymentTypeCombo.contains(e.target)) closePaymentTypeCombo();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeDoctorCombo();
      closePaymentTypeCombo();
    }
  });

  document.getElementById("filterPaymentDate").addEventListener("change", applyFilters);
  document.getElementById("searchInput").addEventListener("input", applyFilters);

  document.querySelectorAll(".field-clear").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      clearSingleFilter(btn.getAttribute("data-target"));
    });
  });

  document.getElementById("resetAllBtn").addEventListener("click", resetAllFilters);
  document.getElementById("exportPdfBtn").addEventListener("click", exportPdf);
  document.getElementById("exportExcelBtn").addEventListener("click", exportExcel);

  updateResetButtonState("", "", "", "");
  updateClearButtonsVisibility("", "", "", "");
}