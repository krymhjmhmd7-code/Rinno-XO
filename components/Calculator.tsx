import React from 'react';
import { useCalculator } from '../hooks/useCalculator';
import { Delete, Divide, X, Minus, Plus, Equal, Percent } from 'lucide-react';

export const Calculator: React.FC = () => {
    const {
        display,
        previousValue,
        operation,
        inputDigit,
        inputDecimal,
        clear,
        deleteLastDigit,
        toggleSign,
        inputPercent,
        performOperation,
        calculate,
        formatDisplay,
    } = useCalculator();

    const CalcButton: React.FC<{
        onClick: () => void;
        variant?: 'number' | 'operation' | 'action' | 'equals';
        span?: number;
        children: React.ReactNode;
    }> = ({ onClick, variant = 'number', span = 1, children }) => {
        const baseClasses = 'flex items-center justify-center text-2xl font-bold rounded-2xl transition-all duration-200 active:scale-95 select-none';

        const variantClasses = {
            number: 'bg-white hover:bg-gray-50 text-gray-800 shadow-sm border border-gray-100',
            operation: 'bg-primary-100 hover:bg-primary-200 text-primary-700',
            action: 'bg-gray-100 hover:bg-gray-200 text-gray-600',
            equals: 'bg-gradient-to-br from-primary-500 to-blue-600 hover:from-primary-600 hover:to-blue-700 text-white shadow-lg shadow-primary-200',
        };

        return (
            <button
                onClick={onClick}
                className={`${baseClasses} ${variantClasses[variant]} h-16 ${span === 2 ? 'col-span-2' : ''}`}
            >
                {children}
            </button>
        );
    };

    

    return (
        <div className="max-w-md mx-auto">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-br from-primary-500 to-blue-600 p-6 text-white">
                    <h2 className="text-lg font-medium opacity-80 text-center mb-2">الآلة الحاسبة</h2>

                    {/* Previous calculation */}
                    <div className="h-6 text-left opacity-60 text-sm font-medium">
                        {previousValue !== null && operation && (
                            <span>{formatDisplay(previousValue)} {operation}</span>
                        )}
                    </div>

                    {/* Main Display */}
                    <div className="text-left">
                        <span
                            className={`font-black tracking-tight ${display.length > 12 ? 'text-3xl' :
                                    display.length > 8 ? 'text-4xl' : 'text-5xl'
                                }`}
                        >
                            {formatDisplay(display)}
                        </span>
                    </div>
                </div>

                {/* Buttons Grid */}
                <div className="p-4 bg-slate-50">
                    <div className="grid grid-cols-4 gap-3">
                        {/* Row 1 */}
                        <CalcButton onClick={clear} variant="action">C</CalcButton>
                        <CalcButton onClick={toggleSign} variant="action">±</CalcButton>
                        <CalcButton onClick={inputPercent} variant="action">
                            <Percent size={20} />
                        </CalcButton>
                        <CalcButton onClick={() => performOperation('÷')} variant="operation">
                            <Divide size={24} />
                        </CalcButton>

                        {/* Row 2 */}
                        <CalcButton onClick={() => inputDigit('7')}>7</CalcButton>
                        <CalcButton onClick={() => inputDigit('8')}>8</CalcButton>
                        <CalcButton onClick={() => inputDigit('9')}>9</CalcButton>
                        <CalcButton onClick={() => performOperation('×')} variant="operation">
                            <X size={24} />
                        </CalcButton>

                        {/* Row 3 */}
                        <CalcButton onClick={() => inputDigit('4')}>4</CalcButton>
                        <CalcButton onClick={() => inputDigit('5')}>5</CalcButton>
                        <CalcButton onClick={() => inputDigit('6')}>6</CalcButton>
                        <CalcButton onClick={() => performOperation('-')} variant="operation">
                            <Minus size={24} />
                        </CalcButton>

                        {/* Row 4 */}
                        <CalcButton onClick={() => inputDigit('1')}>1</CalcButton>
                        <CalcButton onClick={() => inputDigit('2')}>2</CalcButton>
                        <CalcButton onClick={() => inputDigit('3')}>3</CalcButton>
                        <CalcButton onClick={() => performOperation('+')} variant="operation">
                            <Plus size={24} />
                        </CalcButton>

                        {/* Row 5 */}
                        <CalcButton onClick={deleteLastDigit} variant="action">
                            <Delete size={22} />
                        </CalcButton>
                        <CalcButton onClick={() => inputDigit('0')}>0</CalcButton>
                        <CalcButton onClick={inputDecimal}>.</CalcButton>
                        <CalcButton onClick={calculate} variant="equals">
                            <Equal size={24} />
                        </CalcButton>
                    </div>
                </div>
            </div>
        </div>
    );
};
