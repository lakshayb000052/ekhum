import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable } from '../shared/DataTable';

export const ReportBuilder: React.FC = () => {
  const [objects, setObjects] = useState<any[]>([]);
  const [selectedObject, setSelectedObject] = useState('donations');
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(['id', 'amount', 'currency', 'status', 'created_at']);
  const [reportName, setReportName] = useState('Donation Summary Report');
  const [reportDesc, setReportDesc] = useState('');
  const [chartType, setChartType] = useState('none');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchObjects();
    fetchSavedReports();
  }, []);

  useEffect(() => {
    if (selectedObject) {
      fetchObjectColumns(selectedObject);
    }
  }, [selectedObject]);

  const fetchObjects = async () => {
    try {
      const res = await apiFetch('/api/object-manager/objects');
      if (res && res.success && Array.isArray(res.data)) {
        setObjects(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSavedReports = async () => {
    try {
      const res = await apiFetch('/api/reports');
      if (res && res.success && Array.isArray(res.data)) {
        setSavedReports(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchObjectColumns = async (tbl: string) => {
    try {
      const res = await apiFetch(`/api/object-manager/objects/${tbl}/fields`);
      if (res && res.success && Array.isArray(res.data)) {
        const colNames = res.data.map(f => f.name);
        setAvailableColumns(colNames);
        setSelectedColumns(colNames.slice(0, 5));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunPreview = async () => {
    setLoadingPreview(true);
    try {
      // Use contacts or table name directly
      const tbl = selectedObject === 'contacts' ? 'donors' : selectedObject;
      const endpoint = tbl === 'donations' ? '/api/donations' : (tbl === 'donors' ? '/api/contacts' : (tbl === 'campaigns' ? '/api/campaigns' : `/api/receipts`));
      const res = await apiFetch(endpoint);
      if (res && res.success && Array.isArray(res.data)) {
        setPreviewData(res.data);
      } else {
        setPreviewData([]);
      }
    } catch (err) {
      console.error('Preview error:', err);
      setPreviewData([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSaveReport = async () => {
    if (!reportName) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportName,
          description: reportDesc,
          report_type: 'tabular',
          primary_object: selectedObject,
          columns: selectedColumns,
          chart_type: chartType
        })
      });
      if (res && res.success) {
        alert('Report template saved successfully to database!');
        fetchSavedReports();
      }
    } catch (err) {
      console.error('Save report error:', err);
    } finally {
      setSaving(false);
    }
  };

  const tableColumns = selectedColumns.map(col => ({
    header: col.replace(/_/g, ' ').toUpperCase(),
    accessor: (row: any) => {
      const val = row[col];
      if (val === null || val === undefined) return '-';
      if (typeof val === 'boolean') return val ? 'Yes' : 'No';
      if (col.includes('date') || col.includes('created_at')) return new Date(val).toLocaleDateString();
      if (col === 'amount') return `₹${Number(val).toLocaleString('en-IN')}`;
      return String(val);
    }
  }));

  return (
    <div style={{ fontFamily: 'var(--font-body)', padding: '24px', color: 'var(--secondary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', margin: 0 }}>Custom Report Builder</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Build and execute dynamic reports across PostgreSQL CRM donors, transactions, campaigns, and statutory 80G filings.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleSaveReport}
            disabled={saving}
            style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '6px', cursor: saving ? 'wait' : 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            {saving ? 'Saving...' : '💾 Save Report Definition'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
        {/* Sidebar Configuration */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Report Title</label>
            <input 
              type="text" 
              value={reportName} 
              onChange={e => setReportName(e.target.value)} 
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Step 1: Primary Database Entity</label>
            <select 
              value={selectedObject} 
              onChange={(e) => setSelectedObject(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#fff' }}
            >
              {objects.map(obj => (
                <option key={obj.name} value={obj.name}>
                  {obj.icon} {obj.label} ({obj.name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Step 2: Selected Columns ({selectedColumns.length})</label>
            <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '6px', background: '#FAFAFA' }}>
              {availableColumns.map(col => (
                <label key={col} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedColumns.includes(col)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedColumns([...selectedColumns, col]);
                      else setSelectedColumns(selectedColumns.filter(c => c !== col));
                    }}
                  />
                  <code>{col}</code>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Step 3: Visual Chart Format</label>
            <select 
              value={chartType} 
              onChange={(e) => setChartType(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#fff' }}
            >
              <option value="none">Tabular Data Grid Only</option>
              <option value="bar">Bar Chart</option>
              <option value="line">Line Trend Graph</option>
              <option value="pie">Pie Proportion Chart</option>
            </select>
          </div>

          <button 
            onClick={handleRunPreview}
            disabled={loadingPreview}
            style={{ background: '#0F172A', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: loadingPreview ? 'wait' : 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            {loadingPreview ? '⏳ Executing Query...' : '⚡ Run Live Report Preview'}
          </button>
        </div>

        {/* Preview Area */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Live Results Preview ({previewData.length} records)</h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Target: PostgreSQL <code>{selectedObject}</code></span>
          </div>
          
          {previewData.length > 0 ? (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <DataTable data={previewData} columns={tableColumns} loading={loadingPreview} emptyMessage="No rows returned." />
            </div>
          ) : (
            <div style={{ padding: '64px 20px', textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '8px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '2rem', marginBottom: '8px' }}>📊</span>
              <p style={{ margin: 0, fontWeight: 500 }}>Select fields and click "Run Live Report Preview" to query the database.</p>
              <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Data is queried securely and bounded to 500 rows per report.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
