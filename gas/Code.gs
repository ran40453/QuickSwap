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
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return {
      error: 'GEMINI_API_KEY not found.',
      rates: getFallbackRates(),
      insight: { summary: '未設定 API 金鑰。', sources: [] }
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
  
  // 擴大請求範圍，涵蓋常見幣別
  const prompt = `
    Find the DEFINITIVE REAL-TIME exchange rates as of today (${new Date().toLocaleDateString('zh-TW')}).
    Base currency is 1 USD. 
    Provide rates for: TWD, HKD, CNY, JPY, KRW, VND, SGD, THB, MYR, PHP, IDR, EUR, GBP, AUD, CAD, CHF, BTC, ETH.
    Also include rates for any other major currencies you find.
    
    Return ONLY a JSON object:
    {
      "rates": { "USD": 1, "TWD": number, "HKD": number, ... },
      "summary": "1-sentence current market summary in Traditional Chinese"
    }
  `;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { response_mime_type: "application/json" }
  };

  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.error) throw new Error(result.error.message);

    const textResponse = result.candidates[0].content.parts[0].text;
    const data = JSON.parse(textResponse);
    
    // 合併備用數據以確保完整性
    const finalRates = {
      ...getFallbackRates(),
      ...data.rates,
      lastUpdated: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
    };

    return {
      rates: finalRates,
      insight: {
        summary: data.summary || "目前匯率保持穩定。",
        sources: []
      }
    };
  } catch (e) {
    console.error('Gemini API Error:', e);
    return {
      rates: {
        ...getFallbackRates(),
        lastUpdated: "備用數據 (" + new Date().toLocaleTimeString('zh-TW') + ")"
      },
      insight: {
        summary: "系統暫時無法取得即時數據，目前顯示參考值。",
        sources: []
      }
    };
  }
}

function getFallbackRates() {
  // 基礎備用匯率
  return {
    USD: 1, TWD: 32.5, CNY: 7.24, VND: 25400, HKD: 7.8, KRW: 1350, JPY: 155, EUR: 0.92, GBP: 0.78,
    SGD: 1.34, MYR: 4.7, THB: 36.50, AUD: 1.51, CAD: 1.37, CHF: 0.91, BTC: 65000, ETH: 3500
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
  const ss = SpreadsheetApp.openById(spreadsheetId || SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  return data.map(row => {
    return {
      id: row[0].toString(),
      date: row[1],
      fromCode: row[2],
      toCode: row[3],
      fromAmount: row[4],
      toAmount: row[5],
      marketRate: row[6],
      diffPercent: row[7],
      note: row[8]
    };
  }).reverse(); // Latest first
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
