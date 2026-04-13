import { useState, useCallback } from 'react';
import { storageService } from '../services/storage';

interface UseDeletePasswordReturn {
  showPasswordModal: boolean;
  passwordInput: string;
  passwordError: string;
  setPasswordInput: (val: string) => void;
  requestDelete: (onConfirm: () => void) => void;
  verifyAndExecute: () => void;
  cancelDelete: () => void;
}

export const useDeletePassword = (): UseDeletePasswordReturn => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requestDelete = useCallback((onConfirm: () => void) => {
    setPendingAction(() => onConfirm);
    setShowPasswordModal(true);
    setPasswordInput('');
    setPasswordError('');
  }, []);

  const verifyAndExecute = useCallback(() => {
    const settings = storageService.getSettings();
    const delPassword = settings.deletePassword || '1234';
    if (passwordInput === delPassword) {
      pendingAction?.();
      setShowPasswordModal(false);
      setPendingAction(null);
      setPasswordInput('');
    } else {
      setPasswordError('كلمة المرور خاطئة');
    }
  }, [passwordInput, pendingAction]);

  const cancelDelete = useCallback(() => {
    setShowPasswordModal(false);
    setPendingAction(null);
    setPasswordInput('');
    setPasswordError('');
  }, []);

  return {
    showPasswordModal,
    passwordInput,
    passwordError,
    setPasswordInput: (val: string) => {
      setPasswordInput(val);
      setPasswordError('');
    },
    requestDelete,
    verifyAndExecute,
    cancelDelete,
  };
};
