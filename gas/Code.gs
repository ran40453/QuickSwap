const ADMIN_SPREADSHEET_ID = '15inrUERXm3qTU697GzZsmcc7UsBX6fgg9wM-Mq559Bc';
const SHEET_NAME = 'Transactions';

/**
 * Admin: Log Spreadsheet IDs used by the app to a central admin sheet
 */
function logSpreadsheetAccess(targetId, action, userAgent) {
  try {
    const adminSs = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
    let logSheet = adminSs.getSheetByName('AccessLogs');
    
    if (!logSheet) {
      logSheet = adminSs.insertSheet('AccessLogs');
      logSheet.appendRow(['Timestamp', 'TargetSpreadsheetID', 'Action', 'UserAgent']);
      logSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#e6f4ea');
    }

    logSheet.appendRow([
      new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
      targetId,
      action || "ACCESS",
      userAgent || ""
    ]);
    
    return { success: true };
  } catch (e) {
    console.error("Admin logging error:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Serves the web application.
 */
function doGet() {
  const template = HtmlService.createTemplateFromFile('index');
  template.version = "v1.0.6-UIUpdate"; // Version stamp for debugging
  return template.evaluate()
    .setTitle('QuickSwap - 匯率快速計算及記錄器')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper to include other HTML files (CSS, JS, etc.)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Fetches latest exchange rates using Gemini API with Grounding (Google Search).
 */
function fetchLiveRates() {
  const rates = getFallbackRates();
  let statusInfo = "數據已即時更新。";
  
  // 1. Fetch Fiat Rates (USD base) - Exchangerate-API
  try {
    const fiatUrl = 'https://open.er-api.com/v6/latest/USD';
    const response = UrlFetchApp.fetch(fiatUrl, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'QuickSwapConverter/1.0' }
    });
    const data = JSON.parse(response.getContentText());
    if (data && data.rates) {
      Object.keys(data.rates).forEach(code => {
        rates[code] = data.rates[code];
      });
      console.log("Fiat rates updated successfully.");
    }
  } catch (e) {
    console.error('Fiat API Error:', e.message);
    statusInfo = "法幣匯率連線不穩，";
  }

  // 2. Fetch Crypto Rates (BTC, ETH) - CoinGecko
  try {
    const cryptoUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd';
    const response = UrlFetchApp.fetch(cryptoUrl, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'QuickSwapConverter/1.0' }
    });
    
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      if (data.bitcoin) rates['BTC'] = 1 / data.bitcoin.usd;
      if (data.ethereum) rates['ETH'] = 1 / data.ethereum.usd;
      console.log("Crypto rates updated successfully.");
    } else {
      throw new Error("HTTP " + response.getResponseCode());
    }
  } catch (e) {
    console.error('Crypto API Error:', e.message);
    statusInfo += "加密貨幣連線不穩。";
  }

  rates.lastUpdated = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  
  return {
    rates: rates,
    insight: { summary: statusInfo, sources: [] }
  };
}

function getFallbackRates() {
  // Ultra-current fallbacks (Jan 2026 approximate)
  return {
    USD: 1, TWD: 32.8, CNY: 7.3, VND: 25450, HKD: 7.82, KRW: 1380, JPY: 156, EUR: 0.95, GBP: 0.82,
    SGD: 1.35, MYR: 4.75, THB: 36.80, AUD: 1.55, CAD: 1.40, CHF: 0.92, BTC: 0.0000104, ETH: 0.00028
  };
}

/**
 * CRUD: Save Transaction to Google Sheet
 */
function saveTransaction(tx, spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId || ADMIN_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'Date', 'FromCode', 'ToCode', 'FromAmount', 'ToAmount', 'MarketRate', 'DiffPercent', 'Note']);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#f3f3f3');
  }

  sheet.appendRow([
    tx.id,
    tx.date,
    tx.fromCode,
    tx.toCode,
    tx.fromAmount,
    tx.toAmount,
    tx.marketRate,
    tx.diffPercent,
    tx.note
  ]);
  
  return { success: true };
}

/**
 * CRUD: Get all Transactions
 */
function getTransactions(spreadsheetId) {
  console.log("Entering getTransactions for ID:", spreadsheetId);
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId || ADMIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      console.log("Sheet not found");
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // Only headers or empty

    const headers = data.shift();
    console.log("Found raw rows:", data.length);
    
    const transactions = data.map((row, index) => {
      try {
        // Safe Date Formatting: native Date objects from Sheets can fail JSON serialization
        let dateStr = "";
        if (row[1] instanceof Date) {
          dateStr = Utilities.formatDate(row[1], Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
        } else {
          dateStr = String(row[1] || "");
        }

        return {
          id: row[0] ? row[0].toString() : "tx_" + index,
          date: dateStr,
          fromCode: String(row[2] || ""),
          toCode: String(row[3] || ""),
          fromAmount: Number(row[4]) || 0,
          toAmount: Number(row[5]) || 0,
          marketRate: Number(row[6]) || 0,
          diffPercent: Number(row[7]) || 0,
          note: String(row[8] || "")
        };
      } catch (rowErr) {
        console.error("Error parsing row " + index + ":", rowErr.message);
        return null;
      }
    }).filter(tx => tx !== null); // Remove failed rows

    console.log("Successfully parsed transactions:", transactions.length);
    return transactions.reverse(); // Latest first
  } catch (e) {
    console.error("Critical error in getTransactions:", e.message);
    return [];
  }
}

/**
 * CRUD: Delete Transaction
 */
function deleteTransaction(id, spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId || ADMIN_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { success: false };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === id.toString()) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false };
}
