// This code lives in two places:
//  * in the repository (for bookkeeping)
//  * in the Google Apps Script project (open the spreadsheet, go to the menu Tools > App Script, then Server.gs)
// Please keep both versions in sync.

function doPost(e) {
    let ss = SpreadsheetApp.getActiveSpreadsheet();
    let payload = JSON.parse(e.postData.contents);
    let action = payload.action;
    let args = payload.args;

    let result;

    switch (action) {
    case 'get_range_values':
        result = get_range_values(ss, args);
        break;
    case 'set_value':
        result = set_value(ss, args);
        break;
    case 'add_column':
        result = add_column(ss, args);
        break;
    default:
        result = { error: 'Invalid action' };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
}

// keep these definitions in sync with client.ts

function get_range_values(ss, args) {
    let sheet = ss.getSheets()[args.sheet];
    let range = sheet.getRange(args.row, args.col, args.height, args.width);
    return range.getValues();
}

function set_value(ss, args) {
    let sheet = ss.getSheets()[args.sheet];
    sheet.getRange(args.row, args.col).setValue(args.value);
    return { success: true };
}

function add_column(ss, args) {
    let sheet = ss.getActiveSheet();
    let last_col = sheet.getLastColumn();
    sheet.insertColumnAfter(last_col);
    let col = last_col + 1;
    sheet.getRange(args.header_row, col).setValue(args.header);
    return { col };
}
