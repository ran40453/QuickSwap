
export type CurrencyCode = 'VND' | 'USD' | 'CNY' | 'TWD' | 'HKD' | 'JPY' | 'EUR' | 'GBP';

export interface ExchangeRates {
  [key: string]: number | string;
  lastUpdated: string;
}

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  symbol: string;
  flag: string;
}

export const CURRENCY_CONFIG: Record<CurrencyCode, CurrencyMeta> = {
  USD: { code: 'USD', name: '美金', symbol: '$', flag: '🇺🇸' },
  TWD: { code: 'TWD', name: '台幣', symbol: 'NT$', flag: '🇹🇼' },
  CNY: { code: 'CNY', name: '人民幣', symbol: '¥', flag: '🇨🇳' },
  VND: { code: 'VND', name: '越南盾', symbol: '₫', flag: '🇻🇳' },
  HKD: { code: 'HKD', name: '港幣', symbol: 'HK$', flag: '🇭🇰' },
  JPY: { code: 'JPY', name: '日圓', symbol: '¥', flag: '🇯🇵' },
  EUR: { code: 'EUR', name: '歐元', symbol: '€', flag: '🇪🇺' },
  GBP: { code: 'GBP', name: '英鎊', symbol: '£', flag: '🇬🇧' }
};

export interface MarketInsight {
  summary: string;
  sources: { title: string; uri: string }[];
}

export interface Transaction {
  id: string;
  date: string;
  fromCode: CurrencyCode;
  toCode: CurrencyCode;
  fromAmount: number;
  toAmount: number;
  marketRate: number;
  diffPercent: number;
  note: string;
}

export type AppTab = 'exchange' | 'compare' | 'history';
