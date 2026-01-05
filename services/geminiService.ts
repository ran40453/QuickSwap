
import { GoogleGenAI } from "@google/genai";
import { ExchangeRates, MarketInsight } from "../types";

export const fetchLatestRates = async (): Promise<{ rates: ExchangeRates; insight: MarketInsight }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Find the latest real-time exchange rates for 1 USD to TWD, CNY, VND, HKD, JPY, EUR, GBP.
    Return only a JSON object matching this structure:
    {
      "rates": {
        "USD": 1,
        "TWD": number,
        "CNY": number,
        "VND": number,
        "HKD": number,
        "JPY": number,
        "EUR": number,
        "GBP": number
      },
      "summary": "Short 1-sentence market trend comment in Traditional Chinese"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      },
    });

    const data = JSON.parse(response.text || "{}");
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || "Market Source",
      uri: chunk.web?.uri || ""
    })) || [];

    return {
      rates: {
        ...data.rates,
        lastUpdated: new Date().toLocaleTimeString()
      },
      insight: {
        summary: data.summary || "目前匯率保持穩定。",
        sources: sources
      }
    };
  } catch (error) {
    console.error("Failed to fetch rates:", error);
    return {
      rates: {
        USD: 1, TWD: 32.5, CNY: 7.24, VND: 25400, HKD: 7.8, JPY: 155, EUR: 0.92, GBP: 0.78,
        lastUpdated: "Fallback (Network Error)"
      },
      insight: {
        summary: "無法取得即時匯率，目前顯示預設參考值。",
        sources: []
      }
    };
  }
};
