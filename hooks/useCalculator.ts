import { useState, useCallback } from 'react';

export const useCalculator = () => {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = useCallback((digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  }, [display, waitingForOperand]);

  const inputDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  }, [display, waitingForOperand]);

  const clear = useCallback(() => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  }, []);

  const deleteLastDigit = useCallback(() => {
    if (display.length === 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  }, [display]);

  const toggleSign = useCallback(() => {
    const value = parseFloat(display);
    if (value !== 0) {
      setDisplay(String(-value));
    }
  }, [display]);

  const inputPercent = useCallback(() => {
    const value = parseFloat(display);
    setDisplay(String(value / 100));
  }, [display]);

  const performCalc = (op: string, a: number, b: number): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  const performOperation = useCallback((nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(display);
    } else if (operation) {
      const currentValue = parseFloat(previousValue);
      const result = performCalc(operation, currentValue, inputValue);
      const resultString = String(parseFloat(result.toFixed(10)));
      setDisplay(resultString);
      setPreviousValue(resultString);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  }, [display, operation, previousValue]);

  const calculate = useCallback(() => {
    if (!operation || previousValue === null) return;

    const inputValue = parseFloat(display);
    const currentValue = parseFloat(previousValue);
    const result = performCalc(operation, currentValue, inputValue);
    const resultString = String(parseFloat(result.toFixed(10)));
    setDisplay(resultString);
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(true);
  }, [display, operation, previousValue]);

  const formatDisplay = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    if (Math.abs(num) >= 1000) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 10 });
    }
    return value;
  };

  return {
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
  };
};
