import React from 'react';
import { X } from 'lucide-react';
import { useCalculator } from '../hooks/useCalculator';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (total: number) => void;
}

export const CalculatorModal: React.FC<CalculatorModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const {
    display,
    previousValue,
    operation,
    inputDigit,
    inputDecimal,
    clear,
    performOperation,
    calculate
  } = useCalculator();

  if (!isOpen) return null;

  const handleConfirm = () => {
    const value = parseFloat(display) || 0;
    onConfirm(value);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Calculator Header */}
        <div className="bg-gradient-to-br from-primary-500 to-blue-600 p-4 text-white">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm opacity-80">الآلة الحاسبة</span>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
              <X size={18} />
            </button>
          </div>
          <div className="text-left h-6 text-sm opacity-60">
            {previousValue !== null && operation && (
              <span>{previousValue} {operation}</span>
            )}
          </div>
          <div className="text-left text-4xl font-black truncate">{display}</div>
        </div>

        {/* Calculator Buttons */}
        <div className="p-3 bg-slate-50 grid grid-cols-4 gap-2">
          {/* Row 1 */}
          <button onClick={() => performOperation('-')} className="h-14 rounded-xl bg-orange-100 hover:bg-orange-200 font-bold text-2xl text-orange-700">−</button>
          <button onClick={clear} className="h-14 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-xl text-gray-600">C</button>
          <button onClick={() => performOperation('÷')} className="h-14 rounded-xl bg-primary-100 hover:bg-primary-200 font-bold text-xl text-primary-700">÷</button>
          <button onClick={() => performOperation('×')} className="h-14 rounded-xl bg-primary-100 hover:bg-primary-200 font-bold text-xl text-primary-700">×</button>

          {/* Row 2 */}
          <button onClick={() => performOperation('+')} className="h-14 rounded-xl bg-orange-100 hover:bg-orange-200 font-bold text-2xl text-orange-700">+</button>
          <button onClick={() => inputDigit('7')} className="h-14 rounded-xl bg-white hover:bg-gray-50 font-bold text-xl text-gray-800 shadow-sm border">7</button>
          <button onClick={() => inputDigit('8')} className="h-14 rounded-xl bg-white hover:bg-gray-50 font-bold text-xl text-gray-800 shadow-sm border">8</button>
          <button onClick={() => inputDigit('9')} className="h-14 rounded-xl bg-white hover:bg-gray-50 font-bold text-xl text-gray-800 shadow-sm border">9</button>

          {/* Row 3 */}
          <button onClick={inputDecimal} className="h-14 rounded-xl bg-white hover:bg-gray-50 font-bold text-xl text-gray-800 shadow-sm border">.</button>
          <button onClick={() => inputDigit('4')} className="h-14 rounded-xl bg-white hover:bg-gray-50 font-bold text-xl text-gray-800 shadow-sm border">4</button>
          <button onClick={() => inputDigit('5')} className="h-14 rounded-xl bg-white hover:bg-gray-50 font-bold text-xl text-gray-800 shadow-sm border">5</button>
          <button onClick={() => inputDigit('6')} className="h-14 rounded-xl bg-white hover:bg-gray-50 font-bold text-xl text-gray-800 shadow-sm border">6</button>

          {/* Row 4 */}
          <button onClick={() => inputDigit('0')} className="h-14 rounded-xl bg-white hover:bg-gray-50 font-bold text-xl text-gray-800 shadow-sm border">0</button>
          <button onClick={() => inputDigit('1')} className="h-14 rounded-xl bg-white hover:bg-gray-50 font-bold text-xl text-gray-800 shadow-sm border">1</button>
          <button onClick={() => inputDigit('2')} className="h-14 rounded-xl bg-white hover:bg-gray-50 font-bold text-xl text-gray-800 shadow-sm border">2</button>
          <button onClick={() => inputDigit('3')} className="h-14 rounded-xl bg-white hover:bg-gray-50 font-bold text-xl text-gray-800 shadow-sm border">3</button>

          {/* Row 5 */}
          <button onClick={calculate} className="h-14 rounded-xl bg-primary-500 hover:bg-primary-600 font-bold text-2xl text-white col-span-2">=</button>
          <button onClick={handleConfirm} className="h-14 rounded-xl bg-green-500 hover:bg-green-600 font-bold text-xl text-white col-span-2">OK</button>
        </div>
      </div>
    </div>
  );
};
