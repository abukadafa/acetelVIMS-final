import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIosPrompt, setIsIosPrompt] = useState(false);

  useEffect(() => {
    // Hide if already running as a standalone app or native Capacitor app
    if (Capacitor.isNativePlatform()) return;
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) return;

    // Detect iOS Safari (does not support beforeinstallprompt)
    const isIos = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase()) && !(window as any).MSStream;
    if (isIos) {
      // Only show iOS prompt once per session
      if (!sessionStorage.getItem('acetel_ios_prompt_shown')) {
        setTimeout(() => {
          setIsIosPrompt(true);
          setShowPrompt(true);
        }, 3000);
      }
    }

    // Standard Android/Chrome PWA prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!sessionStorage.getItem('acetel_pwa_prompt_shown')) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
    dismissPrompt();
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    sessionStorage.setItem(isIosPrompt ? 'acetel_ios_prompt_shown' : 'acetel_pwa_prompt_shown', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(80px + env(safe-area-inset-bottom))', // Above bottom nav if any
      left: '50%',
      transform: 'translateX(-50%)',
      width: '90%',
      maxWidth: '400px',
      backgroundColor: 'var(--bg-2)',
      border: '1px solid var(--border)',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
      borderRadius: '12px',
      padding: '16px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '8px', color: 'var(--primary)' }}>
            {isIosPrompt ? <Share size={24} /> : <Download size={24} />}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Install ACETEL App</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-3)' }}>
              {isIosPrompt ? 'Add to Home Screen for the best experience' : 'Install for offline access and native performance'}
            </p>
          </div>
        </div>
        <button onClick={dismissPrompt} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px' }}>
          <X size={20} />
        </button>
      </div>

      {isIosPrompt ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', background: 'var(--bg-1)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          Tap the <strong>Share</strong> button at the bottom of your screen, then tap <strong>Add to Home Screen</strong>.
        </div>
      ) : (
        <button 
          onClick={handleInstallClick}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Install App Now
        </button>
      )}
    </div>
  );
}
