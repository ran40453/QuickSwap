
import React from 'react';
import { CurrencyCode, CURRENCY_CONFIG } from '../types';
import { Settings2 } from 'lucide-react';

interface CurrencyCardProps {
  code: CurrencyCode;
  amount: number;
  onAmountChange: (value: number) => void;
  onEditClick: () => void;
  isActive: boolean;
}

const CurrencyCard: React.FC<CurrencyCardProps> = ({ code, amount, onAmountChange, onEditClick, isActive }) => {
  const config = CURRENCY_CONFIG[code];

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  return (
    <div className={`p-4 rounded-3xl transition-all h-full flex flex-col justify-between ${isActive ? 'neu-inset ring-2 ring-indigo-400/20' : 'neu-flat hover:scale-[1.02]'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="text-2xl shrink-0 drop-shadow-sm">{config.flag}</span>
          <div className="overflow-hidden">
            <h3 className="font-bold text-slate-700 leading-tight text-sm truncate">{config.code}</h3>
            <p className="text-[10px] text-slate-500 truncate">{config.name}</p>
          </div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onEditClick(); }}
          className="p-2 neu-flat-sm neu-button rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>
      
      <div className="relative">
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-xs font-bold text-indigo-500">{config.symbol}</span>
          <input
            type="number"
            inputMode="decimal"
            value={amount === 0 ? "" : amount.toFixed(2).replace(/\.00$/, '')}
            onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
            className="w-full text-xl font-black bg-transparent border-none outline-none focus:ring-0 p-0 text-slate-800"
            placeholder="0"
          />
        </div>
        <div className="text-[10px] text-slate-400 font-medium italic truncate">
          ≈ {formatNumber(amount)}
        </div>
      </div>
    </div>
  );
};

export default CurrencyCard;
