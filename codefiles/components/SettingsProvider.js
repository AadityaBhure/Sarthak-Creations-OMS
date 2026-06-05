'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext({
  settings: null,
  loading: true
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setSettings(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load global settings", err);
        setLoading(false);
      });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useGlobalSettings() {
  return useContext(SettingsContext);
}
