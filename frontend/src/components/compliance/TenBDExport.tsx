import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable, Column } from '../shared/DataTable';
import { KpiCard } from '../shared/KpiCard';

export const TenBDExport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'export' | 'history'>('export');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    record_count: number;
    total_amount: number;
    excluded_count: number;
    filing_status: string;
    missing_pan_records: any[];
  }>({
    record_count: 0,
    total_amount: 0,
    excluded_count: 0,
    filing_status: 'Draft',
    missing_pan_records: []
  });

  useEffect(() => {
    fetchTenBdData();
  }, [activeTab]);

  const fetchTenBdData = async () => {
    setLoading(true);
    try {
      const [statsRes, histRes] = await Promise.all([
        apiFetch('/api/compliance/stats'),
        apiFetch('/api/compliance/10bd/history')
      ]);

      if (statsRes && statsRes.success && statsRes.data) {
        const fy = statsRes.data.current_fy_10bd || {};
        setStats({
          record_count: fy.record_count || 0,
          total_amount: fy.total_amount || 0,
          excluded_count: fy.excluded_count || 0,
          filing_status: fy.filing_status || 'Draft',
          missing_pan_records: statsRes.data.missing_pan_records || []
        });
      }

      if (histRes && histRes.success) {
        setHistory(Array.isArray(histRes.data) ? histRes.data : []);
      }
    } catch (err) {
      console.error('Failed to load 10BD data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateExport = async () => {
    setGenerating(true);
    try {
      const res = await apiFetch('/api/compliance/10bd/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fy: '2023-24' })
      });
      if (res && res.success) {
        window.open('/api/compliance/export/10bd', '_blank');
        fetchTenBdData();
      }
    } catch (err) {
      console.error('Failed to generate export:', err);
    } finally {
      setGenerating(false);
    }
  };

  const historyColumns: Column<any>[] = [
    { header: 'Export Date', accessor: (row) => row.date ? new Date(row.date).toLocaleDateString() : 'N/A' },
    { header: 'FY', accessor: (row) => row.fy || '2023-24' },
    { header: 'Record Count', accessor: (row) => row.record_count || 0 },
    { header: 'Total Amount', accessor: (row) => `₹${Number(row.total_amount || 0).toLocaleString('en-IN')}` },
    { 
      header: 'Status', 
      accessor: (row) => (
        <span style={{ 
          background: row.status === 'filed' ? '#ecfdf5' : '#fef3c7', 
          color: row.status === 'filed' ? '#065f46' : '#92400e', 
          padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' 
        }}>
          {row.status || 'Draft'}
        </span>
      ) 
    },
    {
      header: 'Download',
      accessor: () => (
        <button 
          onClick={() => window.open('/api/compliance/export/10bd', '_blank')}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
        >
          📥 CSV
        </button>
      )
    }
  ];

  const missingPanColumns: Column<any>[] = [
    { header: 'Donor Name', accessor: (row) => row.donor_name || 'Anonymous' },
    { header: 'Email', accessor: (row) => row.email || 'N/A' },
    { header: 'Phone', accessor: (row) => row.phone || 'N/A' },
    { header: 'Amount', accessor: (row) => `₹${Number(row.amount || 0).toLocaleString('en-IN')}` },
    { header: 'Date', accessor: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A' }
  ];

  return (
    <div style={{ fontFamily: 'var(--font-body)', padding: '24px', color: 'var(--secondary)' }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>10BD Export Manager</h1>
      
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('export')}
          style={{ 
            background: 'none', border: 'none', 
            borderBottom: activeTab === 'export' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'export' ? 'var(--primary)' : '#64748b',
            padding: '12px 4px', cursor: 'pointer', fontWeight: 500, fontSize: '16px'
          }}
        >
          Current Export
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{ 
            background: 'none', border: 'none', 
            borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--primary)' : '#64748b',
            padding: '12px 4px', cursor: 'pointer', fontWeight: 500, fontSize: '16px'
          }}
        >
          Export History ({history.length})
        </button>
      </div>

      {activeTab === 'export' && (
        <div>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0, color: 'var(--secondary)' }}>Current FY Status (2023-24)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <KpiCard title="Record Count" value={stats.record_count} />
              <KpiCard title="Total Amount" value={`₹${Number(stats.total_amount || 0).toLocaleString('en-IN')}`} />
              <KpiCard title="Excluded Count (Missing PAN)" value={stats.excluded_count} />
              <KpiCard title="Filing Status" value={stats.filing_status} />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
              <span style={{ fontWeight: 500 }}>Workflow:</span>
              <span style={{ color: stats.filing_status === 'Draft' ? 'var(--primary)' : '#64748b', fontWeight: 600 }}>Draft</span> → 
              <span style={{ color: stats.filing_status === 'Exported' ? 'var(--primary)' : '#64748b', fontWeight: 600 }}>Exported</span> → 
              <span style={{ color: stats.filing_status === 'Filed' ? 'var(--primary)' : '#64748b', fontWeight: 600 }}>Filed</span> → 
              <span style={{ color: stats.filing_status === 'Revised' ? 'var(--primary)' : '#64748b', fontWeight: 600 }}>Revised</span>
            </div>

            <button 
              onClick={handleGenerateExport}
              disabled={generating}
              style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: generating ? 'wait' : 'pointer', fontSize: '15px', fontWeight: 600 }}
            >
              {generating ? '⏳ Generating Export...' : '📥 Generate & Download Form 10BD CSV'}
            </button>
          </div>

          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0, color: 'var(--secondary)' }}>Missing PAN Records ({stats.missing_pan_records.length})</h3>
            <DataTable 
              data={stats.missing_pan_records} 
              columns={missingPanColumns} 
              loading={loading} 
              emptyMessage="No pending donations with missing PAN records found."
            />
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <DataTable 
            data={history} 
            columns={historyColumns} 
            loading={loading} 
            emptyMessage="No prior Form 10BD export filings recorded yet."
          />
        </div>
      )}
    </div>
  );
};
