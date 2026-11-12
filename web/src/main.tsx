import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from './lib/queryClient';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="bottom-center" dir="rtl" richColors closeButton
        toastOptions={{ className: 'font-sans', style: { fontFamily: 'Heebo, sans-serif' } }}
        offset={{ bottom: 88 }} mobileOffset={{ bottom: 88 }} />
    </QueryClientProvider>
  </React.StrictMode>,
);

// Service worker (PWA + Push)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch((e) => console.warn('SW failed', e));
  });
}
