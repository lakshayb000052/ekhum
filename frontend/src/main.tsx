import React, { Component, ErrorInfo, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '32px', fontFamily: 'Inter, sans-serif', maxWidth: '800px', margin: '40px auto', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '12px' }}>
          <h2 style={{ color: '#DC2626', marginTop: 0 }}>⚠️ Ekhum UI Runtime Error</h2>
          <p style={{ color: '#7F1D1D' }}>{this.state.error?.message}</p>
          <pre style={{ background: '#FFFFFF', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '12px', color: '#B91C1C' }}>
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: '16px', background: '#059669', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            🔄 Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  console.error('Root element #root not found in document.');
}
