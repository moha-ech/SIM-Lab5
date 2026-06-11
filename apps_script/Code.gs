/**
 * SIM Lab5 — Digital Shadow (historial de runs a Google Sheets)
 */

var SHEET_NAME = 'Results';

var HEADERS = [
  'timestamp',
  'num_buses', 'num_stops', 'capacity', 'sim_time', 'variable_demand', 'seed',
  'mean_wait', 'mean_headway', 'headway_cv',
  'total_rejected', 'max_queue', 'mean_occupancy'
];

function doGet(e) {
  return handle(e);
}

function doPost(e) {
  return handle(e);
}

function handle(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};

    if (params.data) {
      try {
        var parsed = JSON.parse(params.data);
        for (var k in parsed) { params[k] = parsed[k]; }
      } catch (err) { /* ignora JSON invàlid */ }
    }

    var op = params.op || 'ping';

    if (op === 'append') {
      var row = appendRow(params);
      return json({ status: 'ok', appended: true, row: row });
    }

    return json({ status: 'ok', service: 'sim-lab5-sheets', op: op });
  } catch (err) {
    return json({ status: 'error', message: String(err) });
  }
}

function appendRow(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }

  var ts = new Date().toISOString();

  // ▼▼▼ ÚNIC CANVI: escrivim números com a números (immune a la config regional) ▼▼▼
  var row = HEADERS.map(function (h) {
    if (h === 'timestamp') return ts;
    var v = (params[h] !== undefined && params[h] !== '') ? params[h] : '';
    if (h === 'variable_demand') return v;     // text/booleà, no tocar
    var n = parseFloat(v);
    return isNaN(n) ? v : n;                    // 0.486 es desa com 0.486, no 486
  });
  // ▲▲▲ fi del canvi ▲▲▲

  sheet.appendRow(row);
  return sheet.getLastRow();
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}