/**
 * QuickSwap Currency Converter & Logger
 * Google Apps Script Backend
 */

const SPREADSHEET_ID = '1XiP9VSxV2sRq44AnWLiRxAA13rWrW-e1bevRufaDTFGmZalKpOhp9YD8';
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
      error: 'GEMINI_API_KEY not found in Script Properties.',
      rates: getFallbackRates(),
      insight: { summary: '無法取得腳本屬性中的 API 金鑰。', sources: [] }
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{
      parts: [{
        text: `Find the latest real-time exchange rates for 1 USD to TWD, CNY, VND, HKD, JPY, EUR, GBP, KRW. 
               Return only a JSON object matching this structure:
               {
                 "rates": { "USD": 1, "TWD": number, "CNY": number, "VND": number, "HKD": number, "JPY": number, "EUR": number, "GBP": number, "KRW": number },
                 "summary": "Short 1-sentence market trend comment in Traditional Chinese"
               }`
      }]
    }],
    tools: [{ google_search: {} }],
    generationConfig: {
      response_mime_type: "application/json"
    }
  };

  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    };
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    // Extract JSON from text response (Gemini sometimes wraps it)
    const textResponse = result.candidates[0].content.parts[0].text;
    const data = JSON.parse(textResponse);
    
    // Extract sources from grounding metadata if available
    const groundingMetadata = result.candidates[0].groundingMetadata;
    const sources = [];
    if (groundingMetadata && groundingMetadata.groundingChunks) {
      groundingMetadata.groundingChunks.forEach(chunk => {
        if (chunk.web) {
          sources.push({ title: chunk.web.title, uri: chunk.web.uri });
        }
      });
    }

    return {
      rates: {
        ...data.rates,
        lastUpdated: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
      },
      insight: {
        summary: data.summary || "目前匯率保持穩定。",
        sources: sources
      }
    };
  } catch (e) {
    console.error('Gemini API Error:', e);
    return {
      rates: getFallbackRates(),
      insight: {
        summary: "無法取得即時匯率，目前顯示預設參考值。",
        sources: []
      }
    };
  }
}

function getFallbackRates() {
  return {
    USD: 1, TWD: 32.5, CNY: 7.24, VND: 25400, HKD: 7.8, KRW: 1350, JPY: 155, EUR: 0.92, GBP: 0.78,
    lastUpdated: "備用數據 (API 連線失敗)"
  };
}

/**
 * CRUD: Save Transaction to Google Sheet
 */
function saveTransaction(tx) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
function getTransactions() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
function deleteTransaction(id) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
