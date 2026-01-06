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
  
  const prompt = `
    Find the DEFINITIVE REAL-TIME exchange rates for 1 USD.
    Use authoritative financial sources like Google Finance, Yahoo Finance, Investing.com, or TradingView.
    Provide rates for: TWD, HKD, CNY, JPY, KRW, VND, SGD, THB, MYR, PHP, IDR, EUR, GBP, AUD, CAD, CHF, BTC, ETH.
    
    Return ONLY a VALID JSON object:
    {
      "rates": { "USD": 1, "TWD": number, "BTC": number, ... },
      "summary": "Short 1-sentence current market summary in Traditional Chinese"
    }
  `;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { 
      response_mime_type: "application/json",
      temperature: 0
    }
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
        summary: "系統暫時無法取得即時數據，目前顯示參考值，請稍後重試。",
        sources: []
      }
    };
  }
}

function getFallbackRates() {
  return {
    USD: 1, TWD: 32.5, CNY: 7.24, VND: 25400, HKD: 7.8, KRW: 1350, JPY: 155, EUR: 0.92, GBP: 0.78,
    SGD: 1.34, MYR: 4.7, THB: 36.50, AUD: 1.51, CAD: 1.37, CHF: 0.91, BTC: 95000, ETH: 3500
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
    console.log("Found rows:", data.length);
    
    return data.map(row => {
      return {
        id: row[0] ? row[0].toString() : "",
        date: row[1] || "",
        fromCode: row[2] || "",
        toCode: row[3] || "",
        fromAmount: Number(row[4]) || 0,
        toAmount: Number(row[5]) || 0,
        marketRate: Number(row[6]) || 0,
        diffPercent: Number(row[7]) || 0,
        note: row[8] || ""
      };
    }).reverse();
  } catch (e) {
    console.error("Error in getTransactions:", e.message);
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
