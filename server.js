// This code lives in two places:
//  * in the repository (for bookkeeping)
//  * in the Google Apps Script project (open the spreadsheet, go to the menu Tools > App Script, then Server.gs)
// Please keep both versions in sync.

function get_sheet_by_index_or_name(ss, sheet) {
    let result = typeof sheet === 'number' ? ss.getSheets()[sheet] : ss.getSheetByName(sheet);
    if (!result) {
        throw new Error('Sheet not found');
    }
    return result;
}

function doPost(e) {
    let ss = SpreadsheetApp.getActiveSpreadsheet();
    let payload = JSON.parse(e.postData.contents);
    let action = payload.action;
    let args = payload.args;

    let result;

    try {
        switch (action) {
        case "get_range_values":
            result = get_range_values(ss, args);
            break;
        case "set_value":
            result = set_value(ss, args);
            break;
        case "add_column":
            result = add_column(ss, args);
            break;
        default:
            result = { error: "Invalid action" };
        }
    } catch (error) {
        console.error(error);
        console.error(error.stack);
        result = { error: error.message };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
}

// keep these definitions in sync with client.ts

function get_range_values(ss, args) {
    let sheet = get_sheet_by_index_or_name(ss, args.sheet);
    let height = args.height === "max" ? sheet.getLastRow() - args.row + 1 : args.height;
    let width = args.width === "max" ? sheet.getLastColumn() - args.col + 1 : args.width;
    let range = sheet.getRange(args.row, args.col, height, width);
    return range.getValues();
}

function set_value(ss, args) {
    let sheet = get_sheet_by_index_or_name(ss, args.sheet);

    for (let canary of args.canaries || []) {
        let actual_value = sheet.getRange(canary.row, canary.col).getValue();
        if (actual_value !== canary.expected_value) {
            return { success: false };
        }
    }

    sheet.getRange(args.row, args.col).setValue(args.value);
    return { success: true };
}

function add_column(ss, args) {
    let sheet = get_sheet_by_index_or_name(ss, args.sheet);
    let last_col = sheet.getLastColumn();
    sheet.insertColumnAfter(last_col);
    let col = last_col + 1;
    sheet.getRange(args.header_row, col).setValue(args.header);
    return { col };
}
