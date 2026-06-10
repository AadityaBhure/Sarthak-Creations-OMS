'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext({
  settings: null,
  setSettings: () => {},
  loading: true,
  refreshSettings: () => {}
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = () => {
    setLoading(true);
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setSettings(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load global settings", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, setSettings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useGlobalSettings() {
  return useContext(SettingsContext);
}
