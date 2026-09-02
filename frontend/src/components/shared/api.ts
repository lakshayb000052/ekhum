import { useState, useCallback } from 'react';

export const getApiBase = () => {
  if ((import.meta as any).env?.VITE_API_URL) return (import.meta as any).env.VITE_API_URL;
  return '';
};

export const getWsUrl = () => {
  const base = getApiBase();
  if (base) return base.replace('http://', 'ws://').replace('https://', 'wss://');
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return '';
};

export const apiFetch = async (path: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('EKhum_token');
  const headers: any = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const response = await fetch(`${getApiBase()}${path}`, { 
    ...options, 
    headers, 
    credentials: 'include' 
  });
  
  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }
  
  if (!response.ok) {
    throw new Error(data?.error || data?.message || 'API request failed');
  }
  
  return data;
};

export function useApi<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (path: string, options?: RequestInit) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch(path, options);
      setData(result.data || result);
      return result;
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, execute };
}

export const downloadFile = async (path: string, filename: string) => {
  try {
    const token = localStorage.getItem('EKhum_token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await fetch(`${getApiBase()}${path}`, {
      headers,
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('File download failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    console.error('Download error:', err);
  }
};
