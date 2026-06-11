/**
 * SIM Lab5 — Digital Shadow (historial de runs a Google Sheets)
 *
 * Web App d'Apps Script que rep peticions HTTP (REST) del dashboard i de
 * Node-RED i afegeix una fila a la pestanya "Results" amb el timestamp,
 * tots els paràmetres i totes les mètriques d'una simulació.
 *
 * Operacions:
 *   ?op=append&num_buses=..&...&headway_cv=..     -> afegeix una fila
 *   ?op=append&data={"num_buses":..,...}          -> idem, amb JSON
 *   (sense op)                                     -> retorna estat (ping)
 *
 * Desplegament: Implementar > Nova implementació > Aplicació web,
 * "Executar com": jo mateix · "Qui hi té accés": Qualsevol.
 */

var SHEET_NAME = 'Results';

// Ordre de columnes (capçalera). Coincideix amb el que envia el dashboard/Node-RED.
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

    // Permet passar tot en un sol paràmetre JSON "data"
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
  var row = HEADERS.map(function (h) {
    if (h === 'timestamp') return ts;
    return (params[h] !== undefined && params[h] !== '') ? params[h] : '';
  });
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
