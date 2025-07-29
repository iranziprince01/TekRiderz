import React, { useState, useEffect } from 'react';
import { CheckCircle, Smartphone } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const PWAStatus: React.FC = () => {
  const { t } = useLanguage();
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkIfInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches || 
          (window.navigator as any).standalone === true) {
        setIsInstalled(true);
        return true;
      }
      return false;
    };

    // Check on mount
    checkIfInstalled();

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!isInstalled) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-40">
      <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
        <span className="text-xs font-medium text-green-700 dark:text-green-300">
          {t('pwa.offline.available') || 'Available offline'}
        </span>
      </div>
    </div>
  );
};

export default PWAStatus; 