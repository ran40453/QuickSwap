
import React, { useState, useEffect, useMemo } from 'react';
import { CurrencyCode, ExchangeRates, CURRENCY_CONFIG, MarketInsight, AppTab, Transaction } from './types';
import { fetchLatestRates } from './services/geminiService';
import CurrencyCard from './components/CurrencyCard';
import { 
  RefreshCw, TrendingUp, HelpCircle, ArrowRightLeft, 
  AlertCircle, ExternalLink, Calculator, History, 
  TrendingDown, PlusCircle, Trash2, X, ChevronRight,
  TrendingUp as ProfitIcon, DollarSign
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('exchange');
  const [rates, setRates] = useState<ExchangeRates>({
    USD: 1, TWD: 32.5, CNY: 7.24, VND: 25400, HKD: 7.8, JPY: 155, EUR: 0.92, GBP: 0.78,
    lastUpdated: "正在載入..."
  });
  const [insight, setInsight] = useState<MarketInsight | null>(null);
  const [baseAmount, setBaseAmount] = useState<number>(100);
  const [activeCurrency, setActiveCurrency] = useState<CurrencyCode>('USD');
  const [isLoading, setIsLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<CurrencyCode | 'ALL'>('ALL');
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('quickswap_history');
    return saved ? JSON.parse(saved) : [];
  });

  // UI State
  const [visibleCurrencies, setVisibleCurrencies] = useState<CurrencyCode[]>(['USD', 'TWD', 'CNY', 'VND']);
  const [isEditingIdx, setIsEditingIdx] = useState<number | null>(null);

  // Comparison Tool State
  const [offerFrom, setOfferFrom] = useState<CurrencyCode>('TWD');
  const [offerTo, setOfferTo] = useState<CurrencyCode>('VND');
  const [offerAmountFrom, setOfferAmountFrom] = useState<number>(1000);
  const [offerAmountTo, setOfferAmountTo] = useState<number>(780000);

  useEffect(() => {
    updateRates();
  }, []);

  useEffect(() => {
    localStorage.setItem('quickswap_history', JSON.stringify(transactions));
  }, [transactions]);

  const updateRates = async () => {
    setIsLoading(true);
    const data = await fetchLatestRates();
    setRates(data.rates);
    setInsight(data.insight);
    setIsLoading(false);
  };

  const handleAmountChange = (code: CurrencyCode, value: number) => {
    setActiveCurrency(code);
    const rate = rates[code] as number;
    setBaseAmount(value / rate);
  };

  const getAmount = (code: CurrencyCode) => (baseAmount * (rates[code] as number));

  const saveTransaction = () => {
    const marketRate = (rates[offerTo] as number) / (rates[offerFrom] as number);
    const friendRate = offerAmountTo / offerAmountFrom;
    const diffPercent = ((friendRate - marketRate) / marketRate) * 100;

    const newTx: Transaction = {
      id: Date.now().toString(),
      date: new Date().toLocaleString(),
      fromCode: offerFrom,
      toCode: offerTo,
      fromAmount: offerAmountFrom,
      toAmount: offerAmountTo,
      marketRate: marketRate,
      diffPercent: diffPercent,
      note: ""
    };
    setTransactions([newTx, ...transactions]);
    alert("已儲存紀錄！");
  };

  const deleteTransaction = (id: string) => {
    if (confirm("確定要刪除這筆紀錄嗎？")) {
      setTransactions(transactions.filter(t => t.id !== id));
    }
  };

  // Calculate Total Profit/Loss in TWD
  const stats = useMemo(() => {
    let totalTWD = 0;
    transactions.forEach(tx => {
      // 盈虧 = (實得 - (應得)) 換算回台幣
      // 應得 = 換出金額 * 市場匯率
      const marketToAmount = tx.fromAmount * tx.marketRate;
      const profitInTarget = tx.toAmount - marketToAmount;
      
      // 換算回 TWD: 盈虧 * (當前台幣匯率 / 當前目標幣別匯率)
      const currentRateTWD = rates['TWD'] as number;
      const currentRateTarget = rates[tx.toCode] as number;
      const profitInTWD = profitInTarget * (currentRateTWD / currentRateTarget);
      
      totalTWD += profitInTWD;
    });
    return { totalTWD };
  }, [transactions, rates]);

  const filteredTransactions = useMemo(() => {
    if (historyFilter === 'ALL') return transactions;
    return transactions.filter(t => t.fromCode === historyFilter || t.toCode === historyFilter);
  }, [transactions, historyFilter]);

  const currentMarketRate = (rates[offerTo] as number) / (rates[offerFrom] as number);
  const currentFriendRate = offerAmountTo / offerAmountFrom;
  const currentDiffPercent = ((currentFriendRate - currentMarketRate) / currentMarketRate) * 100;
  const isBetterForMe = currentDiffPercent > 0;

  return (
    <div className="min-h-screen px-4 pb-28 pt-8 max-w-lg mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 neu-flat rounded-2xl">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">QuickSwap</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Neumorphic Pro</p>
          </div>
        </div>
        <button 
          onClick={updateRates}
          className="p-4 neu-flat neu-button rounded-2xl active:scale-95 transition-all"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-indigo-500' : 'text-slate-500'}`} />
        </button>
      </div>

      <main>
        {/* TAB 1: EXCHANGE */}
        {activeTab === 'exchange' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="grid grid-cols-2 gap-5">
              {visibleCurrencies.map((code, idx) => (
                <CurrencyCard
                  key={`${code}-${idx}`}
                  code={code}
                  amount={getAmount(code)}
                  onAmountChange={(val) => handleAmountChange(code, val)}
                  onEditClick={() => setIsEditingIdx(idx)}
                  isActive={activeCurrency === code}
                />
              ))}
            </div>

            {insight && (
              <div className="neu-inset p-5 rounded-3xl space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-indigo-900/60 uppercase">市場觀察</span>
                </div>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{insight.summary}</p>
                {insight.sources.length > 0 && (
                  <a href={insight.sources[0].uri} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-500 font-bold flex items-center gap-1 opacity-70">
                    來源：{insight.sources[0].title.substring(0, 30)}... <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
            
            <div className="text-center">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                最後更新：{rates.lastUpdated}
              </span>
            </div>
          </div>
        )}

        {/* TAB 2: COMPARE */}
        {activeTab === 'compare' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="neu-flat p-6 rounded-[2.5rem] space-y-6">
              <div className="space-y-5">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">給出幣別</label>
                  <div className="flex gap-3">
                    <div className="neu-inset rounded-2xl px-3 py-2 flex items-center">
                      <select value={offerFrom} onChange={(e) => setOfferFrom(e.target.value as CurrencyCode)} className="bg-transparent border-none font-black text-sm focus:ring-0">
                        {Object.keys(CURRENCY_CONFIG).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 neu-inset rounded-2xl px-4 py-3">
                      <input type="number" value={offerAmountFrom} onChange={(e) => setOfferAmountFrom(parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-none text-lg font-black focus:ring-0" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className="p-3 neu-flat-sm rounded-full"><ArrowRightLeft className="w-4 h-4 text-slate-400 rotate-90" /></div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">得到幣別</label>
                  <div className="flex gap-3">
                    <div className="neu-inset rounded-2xl px-3 py-2 flex items-center">
                      <select value={offerTo} onChange={(e) => setOfferTo(e.target.value as CurrencyCode)} className="bg-transparent border-none font-black text-sm focus:ring-0">
                        {Object.keys(CURRENCY_CONFIG).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 neu-inset rounded-2xl px-4 py-3">
                      <input type="number" value={offerAmountTo} onChange={(e) => setOfferAmountTo(parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-none text-lg font-black focus:ring-0" />
                    </div>
                  </div>
                </div>
              </div>

              <div className={`p-6 rounded-[2rem] flex flex-col items-center gap-3 transition-all ${isBetterForMe ? 'neu-inset' : 'neu-inset'}`}>
                <div className="flex items-center gap-2">
                  {isBetterForMe ? <TrendingUp className="w-5 h-5 text-emerald-500" /> : <TrendingDown className="w-5 h-5 text-rose-500" />}
                  <span className={`font-black text-sm uppercase ${isBetterForMe ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isBetterForMe ? '較市場划算' : '較市場昂貴'}
                  </span>
                </div>
                <div className={`text-5xl font-black ${isBetterForMe ? 'text-emerald-500' : 'text-rose-500'} neu-text-shadow`}>
                  {Math.abs(currentDiffPercent).toFixed(2)}%
                </div>
                <div className="text-[10px] font-bold text-slate-400 text-center uppercase leading-relaxed">
                  市場匯率 1 : {currentMarketRate.toFixed(2)} <br/>
                  友情報價 1 : {currentFriendRate.toFixed(2)}
                </div>
              </div>

              <button 
                onClick={saveTransaction}
                className="w-full py-5 neu-flat neu-button rounded-[1.8rem] text-indigo-600 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <PlusCircle className="w-5 h-5" /> 儲存此筆交易
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Stats Summary */}
            <div className="neu-flat p-6 rounded-[2rem] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 neu-inset rounded-2xl">
                  <DollarSign className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">總盈虧累計 (TWD)</p>
                  <h3 className={`text-2xl font-black ${stats.totalTWD >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {stats.totalTWD >= 0 ? '+' : ''}{stats.totalTWD.toFixed(2)}
                  </h3>
                </div>
              </div>
              <ProfitIcon className={`w-8 h-8 opacity-20 ${stats.totalTWD >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
            </div>

            {/* Dynamic Filter TabBar */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {['ALL', ...Object.keys(CURRENCY_CONFIG)].map(c => (
                <button
                  key={c}
                  onClick={() => setHistoryFilter(c as any)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${historyFilter === c ? 'neu-inset text-indigo-600' : 'neu-flat-sm text-slate-400'}`}
                >
                  {c === 'ALL' ? '全部' : c}
                </button>
              ))}
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="py-20 neu-inset rounded-[2rem] text-center text-slate-300 font-bold italic">尚無交易紀錄</div>
            ) : (
              <div className="space-y-4">
                {filteredTransactions.map(tx => (
                  <div key={tx.id} className="neu-flat p-5 rounded-3xl flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tx.diffPercent > 0 ? 'neu-inset text-emerald-500' : 'neu-inset text-rose-500'}`}>
                        {tx.diffPercent > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-black text-slate-700 text-sm">
                          {tx.fromAmount.toFixed(0)} {tx.fromCode} <ChevronRight className="w-3 h-3 text-slate-300" /> {tx.toAmount.toFixed(0)} {tx.toCode}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                          {tx.date.split(' ')[0]} • 價差 {Math.abs(tx.diffPercent).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    <button onClick={() => deleteTransaction(tx.id)} className="p-3 neu-flat-sm neu-button rounded-xl text-slate-300 hover:text-rose-500 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Navigation TabBar */}
      <nav className="fixed bottom-6 left-6 right-6 h-20 neu-flat rounded-[2rem] flex justify-around items-center px-4 z-50">
        <button onClick={() => setActiveTab('exchange')} className={`flex flex-col items-center gap-1 transition-all p-3 rounded-2xl ${activeTab === 'exchange' ? 'neu-inset text-indigo-600 scale-105' : 'text-slate-400'}`}>
          <Calculator className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">換算</span>
        </button>
        <button onClick={() => setActiveTab('compare')} className={`flex flex-col items-center gap-1 transition-all p-3 rounded-2xl ${activeTab === 'compare' ? 'neu-inset text-indigo-600 scale-105' : 'text-slate-400'}`}>
          <TrendingUp className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">分析</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 transition-all p-3 rounded-2xl ${activeTab === 'history' ? 'neu-inset text-indigo-600 scale-105' : 'text-slate-400'}`}>
          <History className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">歷史</span>
        </button>
      </nav>

      {/* Edit Currency Modal */}
      {isEditingIdx !== null && (
        <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-md z-[100] flex items-center justify-center p-8">
          <div className="neu-flat rounded-[3rem] w-full max-w-xs p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm">切換幣別</h3>
              <button onClick={() => setIsEditingIdx(null)} className="p-2 neu-flat-sm rounded-full active:scale-90 transition-all"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(Object.keys(CURRENCY_CONFIG) as CurrencyCode[]).map(code => {
                const config = CURRENCY_CONFIG[code];
                const isAlreadyVisible = visibleCurrencies.includes(code);
                return (
                  <button 
                    key={code}
                    onClick={() => {
                      const newVisible = [...visibleCurrencies];
                      newVisible[isEditingIdx] = code;
                      setVisibleCurrencies(newVisible);
                      setIsEditingIdx(null);
                    }}
                    className={`p-4 rounded-[1.5rem] flex flex-col items-center gap-2 transition-all ${isAlreadyVisible ? 'neu-inset opacity-40' : 'neu-flat-sm active:neu-inset'}`}
                  >
                    <span className="text-2xl drop-shadow-sm">{config.flag}</span>
                    <span className="text-[10px] font-black text-slate-600">{config.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
