import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable } from '../shared/DataTable';
import { Modal } from '../shared/Modal';

export const ReportBuilder: React.FC = () => {
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [schemaObjects, setSchemaObjects] = useState<Record<string, any>>({});
  const [activeReport, setActiveReport] = useState<any>(null);

  // Studio / View state
  const [activeTab, setActiveTab] = useState<'studio' | 'saved'>('studio');
  const [reportName, setReportName] = useState('Executive Giving & Revenue Overview');
  const [reportDesc, setReportDesc] = useState('');
  const [selectedObject, setSelectedObject] = useState('donations');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(['id', 'amount', 'currency', 'donor_name', 'campaign_title', 'status', 'created_at']);
  const [filters, setFilters] = useState<Array<{ field: string; operator: string; value: any }>>([
    { field: 'status', operator: 'in', value: ['success', 'paid', 'completed'] }
  ]);
  const [groupByField, setGroupByField] = useState('created_at');
  const [groupByInterval, setGroupByInterval] = useState('month');
  const [isGrouped, setIsGrouped] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'donut' | 'table'>('bar');

  // Preview / Execution Results
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [summaryKpis, setSummaryKpis] = useState<{ totalVolume: number; totalRecords: number; averageTicket: number; successRate: number }>({
    totalVolume: 0,
    totalRecords: 0,
    averageTicket: 0,
    successRate: 100
  });
  const [chartData, setChartData] = useState<{ labels: string[]; values: number[]; series?: Array<{ label: string; value: number; color?: string }> }>({
    labels: [],
    values: [],
    series: []
  });
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  // Config Modal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  useEffect(() => {
    fetchSavedReports();
    fetchPresets();
    fetchSchema();
  }, []);

  useEffect(() => {
    // When schema loads, run initial preview
    handleRunPreview();
  }, [selectedObject]);

  const fetchSavedReports = async () => {
    try {
      const res = await apiFetch('/api/reports');
      if (res && res.success && Array.isArray(res.data)) {
        setSavedReports(res.data);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    }
  };

  const fetchPresets = async () => {
    try {
      const res = await apiFetch('/api/reports/presets');
      if (res && res.success && Array.isArray(res.data)) {
        setPresets(res.data);
      }
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  };

  const fetchSchema = async () => {
    try {
      const res = await apiFetch('/api/reports/schema');
      if (res && res.success && res.data?.objects) {
        setSchemaObjects(res.data.objects);
      }
    } catch (err) {
      console.error('Failed to load schema:', err);
    }
  };

  const handleApplyPreset = (preset: any) => {
    setActiveReport(null);
    setReportName(preset.name);
    setReportDesc(preset.description || '');
    setSelectedObject(preset.primary_object || 'donations');
    setSelectedColumns(preset.columns || ['id', 'amount', 'created_at']);
    setFilters(preset.filters || []);
    setChartType(preset.chart_type || 'bar');
    
    if (preset.group_by && preset.group_by.length > 0) {
      setIsGrouped(true);
      const g = preset.group_by[0];
      if (typeof g === 'object') {
        setGroupByField(g.field);
        setGroupByInterval(g.interval || 'month');
      } else {
        setGroupByField(g);
      }
    } else {
      setIsGrouped(false);
    }

    setActiveTab('studio');
    runReportAdHoc(preset);
  };

  const handleLoadSavedReport = async (report: any) => {
    setActiveReport(report);
    setReportName(report.name);
    setReportDesc(report.description || '');
    setSelectedObject(report.primary_object || 'donations');
    setSelectedColumns(report.columns || ['id', 'created_at']);
    setFilters(report.filters || []);
    setChartType(report.chart_type || 'table');
    setIsGrouped(report.group_by && report.group_by.length > 0);
    setActiveTab('studio');

    setLoadingPreview(true);
    try {
      const res = await apiFetch(`/api/reports/${report.id}/run`, { method: 'POST' });
      if (res && res.success) {
        setPreviewData(res.data || []);
        setRowCount(res.rowCount || 0);
        setSummaryKpis(res.summaryKpis || { totalVolume: 0, totalRecords: 0, averageTicket: 0, successRate: 100 });
        setChartData(res.chartData || { labels: [], values: [], series: [] });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleRunPreview = async () => {
    const reportDef = {
      name: reportName,
      description: reportDesc,
      report_type: isGrouped ? 'summary' : 'tabular',
      primary_object: selectedObject,
      columns: selectedColumns,
      filters,
      group_by: isGrouped ? (['created_at', 'donation_date'].includes(groupByField) ? [{ field: groupByField, interval: groupByInterval }] : [{ field: groupByField }]) : [],
      aggregations: isGrouped ? [
        { field: selectedObject === 'donations' ? 'amount' : 'id', fn: 'SUM', alias: 'total_volume' },
        { field: 'id', fn: 'COUNT', alias: 'record_count' },
        { field: selectedObject === 'donations' ? 'amount' : 'id', fn: 'AVG', alias: 'average_val' }
      ] : [],
      chart_type: chartType
    };
    runReportAdHoc(reportDef);
  };

  const runReportAdHoc = async (def: any) => {
    setLoadingPreview(true);
    try {
      const res = await apiFetch('/api/reports/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(def)
      });
      if (res && res.success) {
        setPreviewData(res.data || []);
        setRowCount(res.rowCount || 0);
        setSummaryKpis(res.summaryKpis || { totalVolume: 0, totalRecords: 0, averageTicket: 0, successRate: 100 });
        setChartData(res.chartData || { labels: [], values: [], series: [] });
      }
    } catch (err) {
      console.error('Preview query error:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSaveReport = async () => {
    if (!reportName) return;
    setSaving(true);
    try {
      const payload = {
        name: reportName,
        description: reportDesc,
        report_type: isGrouped ? 'summary' : 'tabular',
        primary_object: selectedObject,
        columns: selectedColumns,
        filters,
        group_by: isGrouped ? (['created_at', 'donation_date'].includes(groupByField) ? [{ field: groupByField, interval: groupByInterval }] : [{ field: groupByField }]) : [],
        aggregations: isGrouped ? [
          { field: selectedObject === 'donations' ? 'amount' : 'id', fn: 'SUM', alias: 'total_volume' },
          { field: 'id', fn: 'COUNT', alias: 'record_count' }
        ] : [],
        chart_type: chartType,
        folder: 'Custom Reports'
      };

      const res = await apiFetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        alert('Report definition saved successfully to database!');
        fetchSavedReports();
      }
    } catch (err) {
      console.error('Save report error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (activeReport?.id) {
      window.open(`/api/reports/${activeReport.id}/export`, '_blank');
    } else {
      // Stream ad-hoc download
      const headers = selectedColumns.join(',');
      const rows = previewData.map(r => selectedColumns.map(c => `"${r[c] !== undefined ? String(r[c]).replace(/"/g, '""') : ''}"`).join(','));
      const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${reportName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    }
  };

  const currentObjectFields = schemaObjects[selectedObject]?.fields || [];

  // Generate dynamic table columns
  const tableColumns = previewData.length > 0 
    ? Object.keys(previewData[0]).map(col => ({
        header: col.replace(/_/g, ' ').toUpperCase(),
        accessor: (row: any) => {
          const val = row[col];
          if (val === null || val === undefined) return '-';
          if (typeof val === 'boolean') return val ? '✅ Yes' : 'No';
          if (col.includes('amount') || col.includes('revenue') || col.includes('volume') || col.includes('mrr') || col.includes('ltv') || col.includes('gift')) {
            return <strong style={{ color: '#059669' }}>₹{Number(val).toLocaleString('en-IN')}</strong>;
          }
          if (col.includes('date') || col.includes('created_at')) {
            return new Date(val).toLocaleDateString();
          }
          return String(val);
        }
      }))
    : selectedColumns.map(col => ({
        header: col.replace(/_/g, ' ').toUpperCase(),
        accessor: (row: any) => String(row[col] || '-')
      }));

  return (
    <div style={{ fontFamily: 'var(--font-sans)', padding: '16px', background: '#F8FAFC', minHeight: '100vh', color: '#0F172A', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Lightning Header */}
      <div className="slds-page-header">
        <div className="slds-page-header__top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="slds-object-icon" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
              📈
            </div>
            <div>
              <span className="slds-object-eyebrow">Enterprise BI & Analytics</span>
              <h2 className="slds-object-title">
                Custom Report Builder & Analytics Studio
              </h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setIsConfigModalOpen(true)}
              style={{ background: '#FFFFFF', border: '1.5px solid #CBD5E1', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>⚙️</span>
              <span>Edit Query & Filters</span>
            </button>
            <button 
              onClick={handleExportCSV}
              style={{ background: '#FFFFFF', border: '1.5px solid #CBD5E1', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>📥</span>
              <span>Export CSV</span>
            </button>
            <button 
              onClick={handleSaveReport}
              disabled={saving}
              className="btn btn-primary"
            >
              <span>💾</span>
              <span>{saving ? 'Saving...' : 'Save Report'}</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Tiles Ribbon */}
        <div className="slds-highlights-ribbon">
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Aggregated Volume</span>
            <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
              ₹{summaryKpis.totalVolume.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Total Transactions</span>
            <span className="slds-highlight-item__value">
              {summaryKpis.totalRecords.toLocaleString()} Records
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Average Ticket Size</span>
            <span className="slds-highlight-item__value">
              ₹{summaryKpis.averageTicket.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Payment Success Rate</span>
            <span className="slds-highlight-item__value" style={{ color: '#0284C7' }}>
              {summaryKpis.successRate}%
            </span>
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '2px' }}>
        <button 
          onClick={() => setActiveTab('studio')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
            borderBottom: activeTab === 'studio' ? '2px solid #059669' : '2px solid transparent',
            color: activeTab === 'studio' ? '#059669' : '#64748B'
          }}
        >
          📊 Live Visual Studio & Report Preview
        </button>
        <button 
          onClick={() => setActiveTab('saved')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
            borderBottom: activeTab === 'saved' ? '2px solid #059669' : '2px solid transparent',
            color: activeTab === 'saved' ? '#059669' : '#64748B'
          }}
        >
          📁 Saved Reports & Executive Templates ({savedReports.length})
        </button>
      </div>

      {/* Preset Quick-Launcher Bar */}
      <div style={{ background: '#FFFFFF', padding: '14px 18px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <strong style={{ fontSize: '13px', color: '#0F172A' }}>⭐ 1-Click Executive Report Presets</strong>
          <span style={{ fontSize: '11px', color: '#64748B' }}>Instant multi-table relational reports ready for statutory audits & board reviews</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(preset)}
              style={{
                background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '8px 12px',
                borderRadius: '8px', cursor: 'pointer', textAlign: 'left', flexShrink: 0,
                transition: 'all 0.15s'
              }}
            >
              <strong style={{ display: 'block', fontSize: '12px', color: '#0F172A' }}>{preset.name}</strong>
              <span style={{ fontSize: '11px', color: '#64748B' }}>{preset.primary_object.toUpperCase()} • {preset.chart_type}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'studio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Visual Chart Canvas */}
          {chartType !== 'table' && chartData.series && chartData.series.length > 0 && (
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0F172A' }}>
                  {chartType === 'bar' && '📊 Categorical Distribution Chart'}
                  {chartType === 'line' && '📈 Time Trend Series Graph'}
                  {chartType === 'donut' && '🍩 Proportions & Share Breakdown'}
                </h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['bar', 'line', 'donut', 'table'] as const).map(t => (
                    <button 
                      key={t} 
                      onClick={() => setChartType(t)}
                      style={{ 
                        padding: '4px 10px', borderRadius: '4px', border: chartType === t ? '1.5px solid #059669' : '1px solid #CBD5E1', 
                        background: chartType === t ? '#ECFDF5' : '#FFFFFF', color: chartType === t ? '#065F46' : '#64748B',
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive SVG Renderers */}
              {chartType === 'bar' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px 0' }}>
                  {chartData.series.map((item, idx) => {
                    const maxVal = Math.max(...chartData.values, 1);
                    const pct = Math.min(100, Math.round((item.value / maxVal) * 100));
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <strong style={{ color: '#1E293B' }}>{item.label}</strong>
                          <span style={{ fontWeight: 700, color: '#059669' }}>
                            {item.value > 1000 ? `₹${item.value.toLocaleString('en-IN')}` : `${item.value.toLocaleString()} items`}
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '12px', background: '#F1F5F9', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(pct, 4)}%`, height: '100%', background: item.color || '#059669', borderRadius: '6px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {chartType === 'donut' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '20px', padding: '16px 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
                    {chartData.series.map((item, idx) => {
                      const totalSum = chartData.values.reduce((a, b) => a + b, 0);
                      const pct = totalSum > 0 ? Math.round((item.value / totalSum) * 100) : 0;
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: item.color || '#059669' }} />
                            <span>{item.label}</span>
                          </div>
                          <strong>₹{item.value.toLocaleString('en-IN')} ({pct}%)</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabular Data Grid */}
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{reportName} ({rowCount} rows)</h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Primary: <code>{selectedObject}</code> • Grouped: {isGrouped ? 'Yes' : 'No'}</span>
              </div>
              <button 
                onClick={handleRunPreview}
                disabled={loadingPreview}
                style={{ background: '#0F172A', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: loadingPreview ? 'wait' : 'pointer', fontWeight: 600, fontSize: '12px' }}
              >
                {loadingPreview ? '⏳ Executing Query...' : '⚡ Re-Run Query'}
              </button>
            </div>

            <DataTable 
              data={previewData} 
              columns={tableColumns} 
              loading={loadingPreview} 
              emptyMessage="No records matched the criteria. Adjust your filters or database entity." 
            />
          </div>
        </div>
      )}

      {/* Saved Reports Library */}
      {activeTab === 'saved' && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem' }}>📁 Saved Reports & Custom BI Queries</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {savedReports.map(rep => (
              <div 
                key={rep.id} 
                onClick={() => handleLoadSavedReport(rep)}
                style={{ 
                  padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer',
                  transition: 'all 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '14px', color: '#0F172A' }}>{rep.name}</strong>
                  <span style={{ fontSize: '11px', background: '#E2E8F0', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{rep.primary_object}</span>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748B' }}>{rep.description || 'Custom report template'}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8' }}>
                  <span>Last run: {rep.last_run_at ? new Date(rep.last_run_at).toLocaleDateString() : 'Never'}</span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>Run Report ➔</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual Query Builder Modal */}
      <Modal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} title="Configure Report & Visual Analytics Query">
        <form onSubmit={(e) => { e.preventDefault(); setIsConfigModalOpen(false); handleRunPreview(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Report Title</label>
            <input 
              type="text" 
              value={reportName} 
              onChange={e => setReportName(e.target.value)} 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              required 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Step 1: Primary Database Entity</label>
              <select 
                value={selectedObject} 
                onChange={(e) => {
                  setSelectedObject(e.target.value);
                  setSelectedColumns(['id', 'created_at']);
                }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#fff' }}
              >
                {Object.keys(schemaObjects).map(k => (
                  <option key={k} value={k}>{schemaObjects[k].icon} {schemaObjects[k].label} ({k})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Step 2: Visual Chart Type</label>
              <select 
                value={chartType} 
                onChange={(e) => setChartType(e.target.value as any)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#fff' }}
              >
                <option value="bar">📊 Vertical Bar Chart</option>
                <option value="donut">🍩 Donut / Pie Share Breakdown</option>
                <option value="line">📈 Multi-Line Time Trend Graph</option>
                <option value="table">📄 Tabular Data Grid Only</option>
              </select>
            </div>
          </div>

          {/* Group-by and Aggregations */}
          <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <input 
                type="checkbox" 
                id="group_by_chk"
                checked={isGrouped} 
                onChange={e => setIsGrouped(e.target.checked)} 
              />
              <label htmlFor="group_by_chk" style={{ fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                Enable Group-By Dimensional Summary & Aggregation
              </label>
            </div>

            {isGrouped && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Group By Field</label>
                  <select 
                    value={groupByField}
                    onChange={e => setGroupByField(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#fff', fontSize: '12px' }}
                  >
                    {currentObjectFields.map(f => (
                      <option key={f.name} value={f.name}>{f.label} ({f.name})</option>
                    ))}
                  </select>
                </div>

                {['created_at', 'donation_date'].includes(groupByField) && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Time Interval</label>
                    <select 
                      value={groupByInterval}
                      onChange={e => setGroupByInterval(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#fff', fontSize: '12px' }}
                    >
                      <option value="day">Daily</option>
                      <option value="week">Weekly</option>
                      <option value="month">Monthly</option>
                      <option value="quarter">Quarterly</option>
                      <option value="year">Annually</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Select Columns */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Step 3: Select Columns ({selectedColumns.length})</label>
            <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #CBD5E1', padding: '8px 12px', borderRadius: '6px', background: '#FFFFFF', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {currentObjectFields.map(f => (
                <label key={f.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedColumns.includes(f.name)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedColumns([...selectedColumns, f.name]);
                      else setSelectedColumns(selectedColumns.filter(c => c !== f.name));
                    }}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={() => setIsConfigModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
              Apply & Run Query
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
