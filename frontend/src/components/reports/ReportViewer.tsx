import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable } from '../shared/DataTable';

export const ReportViewer: React.FC<{ report?: any; reportId?: string }> = ({ report, reportId }) => {
  const [reportData, setReportData] = useState<any>(report || null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const targetId = report?.id || reportId;

  useEffect(() => {
    if (targetId) {
      runReport(targetId);
    }
  }, [targetId]);

  const runReport = async (id: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/reports/${id}/run`, { method: 'POST' });
      if (res && res.success) {
        setReportData(res.report);
        setResults(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Failed to execute report:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!reportData && !targetId) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h3>No Report Selected</h3>
        <p>Choose a custom report from the Report Builder to execute queries and view data visualizations.</p>
      </div>
    );
  }

  const columns = Array.isArray(reportData?.columns) && reportData.columns.length > 0
    ? reportData.columns.map((col: string) => ({
        header: col.replace(/_/g, ' ').toUpperCase(),
        accessor: (row: any) => {
          const val = row[col];
          if (val === null || val === undefined) return '-';
          if (typeof val === 'boolean') return val ? 'Yes' : 'No';
          if (col.includes('date') || col.includes('created_at')) return new Date(val).toLocaleDateString();
          if (col === 'amount') return `₹${Number(val).toLocaleString('en-IN')}`;
          return String(val);
        }
      }))
    : [
        { header: 'ID', accessor: 'id' },
        { header: 'Amount / Value', accessor: (r: any) => r.amount ? `₹${r.amount}` : (r.name || '-') },
        { header: 'Created At', accessor: (r: any) => r.created_at ? new Date(r.created_at).toLocaleDateString() : '-' }
      ];

  return (
    <div style={{ fontFamily: 'var(--font-body)', padding: '24px', color: 'var(--secondary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', margin: '0 0 8px 0', fontSize: '1.4rem' }}>{reportData?.name || 'Custom SQL Report'}</h1>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '13px' }}>{reportData?.description || `Live report querying ${reportData?.primary_object || 'donations'}`}</p>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Last Executed: {reportData?.last_run_at ? new Date(reportData.last_run_at).toLocaleString() : 'Just now'}</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {targetId && (
            <button 
              onClick={() => runReport(targetId)}
              disabled={loading}
              style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: loading ? 'wait' : 'pointer', fontWeight: 600 }}
            >
              {loading ? 'Refreshing...' : '🔄 Refresh Live Data'}
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Query Results ({results.length} records)</h3>
        <DataTable 
          data={results} 
          columns={columns} 
          loading={loading} 
          emptyMessage="No records matched the report query criteria."
        />
      </div>
    </div>
  );
};
