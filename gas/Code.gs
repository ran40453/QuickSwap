/**
 * QuickSwap Currency Converter & Logger
 * Google Apps Script Backend
 */

const SPREADSHEET_ID = '15inrUERXm3qTU697GzZsmcc7UsBX6fgg9wM-Mq559Bc';
const SHEET_NAME = 'Transactions';

/**
 * Serves the web application.
 */
function doGet() {
  const template = HtmlService.createTemplateFromFile('index');
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
  
  try {
    // 1. Fetch Fiat Rates (USD base) from Exchangerate-API (Fast & Accurate)
    const fiatUrl = 'https://open.er-api.com/v6/latest/USD';
    const fiatResponse = UrlFetchApp.fetch(fiatUrl);
    const fiatData = JSON.parse(fiatResponse.getContentText());
    
    if (fiatData && fiatData.rates) {
      Object.keys(fiatData.rates).forEach(code => {
        rates[code] = fiatData.rates[code];
      });
    }

    // 2. Fetch Crypto Rates (BTC, ETH) from CoinGecko
    const cryptoUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd';
    const cryptoResponse = UrlFetchApp.fetch(cryptoUrl);
    const cryptoData = JSON.parse(cryptoResponse.getContentText());
    
    // Convert to "1 USD = X BTC" format to stay consistent with fiat rates
    if (cryptoData.bitcoin) rates['BTC'] = 1 / cryptoData.bitcoin.usd;
    if (cryptoData.ethereum) rates['ETH'] = 1 / cryptoData.ethereum.usd;
    
    rates.lastUpdated = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    
    return {
      rates: rates,
      insight: { summary: "數據已從權威金融接口即時更新。", sources: [] }
    };
  } catch (e) {
    console.error('API Fetch Error:', e);
    return {
      rates: {
        ...getFallbackRates(),
        lastUpdated: "連線異常，顯示備用數據 (" + new Date().toLocaleTimeString('zh-TW') + ")"
      },
      insight: { summary: "目前使用的是離線預設匯率數據。", sources: [] }
    };
  }
}

function getFallbackRates() {
  // Default values if API fails (approximate 1 USD = X)
  return {
    USD: 1, TWD: 32.5, CNY: 7.24, VND: 25400, HKD: 7.8, KRW: 1350, JPY: 155, EUR: 0.92, GBP: 0.78,
    SGD: 1.34, MYR: 4.7, THB: 36.50, AUD: 1.51, CAD: 1.37, CHF: 0.91, BTC: 0.0000105, ETH: 0.00028
  };
}

/**
 * CRUD: Save Transaction to Google Sheet
 */
function saveTransaction(tx, spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);
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
    const ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);
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
  const ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);
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
