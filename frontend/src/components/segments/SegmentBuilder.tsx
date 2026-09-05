import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable, Column } from '../shared/DataTable';
import { Modal } from '../shared/Modal';
import { StatusBadge } from '../shared/StatusBadge';

export const SegmentBuilder: React.FC = () => {
  const [segments, setSegments] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view tab
  const [activeViewTab, setActiveViewTab] = useState<'segments' | 'cohorts'>('segments');
  const [selectedCohort, setSelectedCohort] = useState<any>(null);
  const [cohortMatrix, setCohortMatrix] = useState<any>(null);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  // Create / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotTargetSegment, setSnapshotTargetSegment] = useState<any>(null);
  const [snapshotTag, setSnapshotTag] = useState('');
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  // Segment Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [segmentType, setSegmentType] = useState<'dynamic' | 'cohort'>('dynamic');
  const [combinator, setCombinator] = useState<'AND' | 'OR'>('AND');
  const [rules, setRules] = useState<Array<{ field: string; operator: string; value: any }>>([
    { field: 'total_paid_amount', operator: 'gte', value: 5000 }
  ]);
  const [suppressionApplied, setSuppressionApplied] = useState(true);

  // Preview state
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewStats, setPreviewStats] = useState<{ count: number; totalLtv: number; avgGift: number }>({ count: 0, totalLtv: 0, avgGift: 0 });
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSegments();
    fetchPresets();
    fetchFields();
  }, []);

  const fetchSegments = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/segments');
      if (res && res.success) {
        setSegments(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Failed to load segments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPresets = async () => {
    try {
      const res = await apiFetch('/api/segments/presets');
      if (res && res.success && Array.isArray(res.data)) {
        setPresets(res.data);
      }
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  };

  const fetchFields = async () => {
    try {
      const res = await apiFetch('/api/segments/fields');
      if (res && res.success && Array.isArray(res.data)) {
        setAvailableFields(res.data);
      }
    } catch (err) {
      console.error('Failed to load segment fields:', err);
    }
  };

  const handleApplyPreset = (preset: any) => {
    setName(preset.name);
    setDescription(preset.description || '');
    setSegmentType(preset.type || 'dynamic');
    if (preset.rules_json) {
      setCombinator(preset.rules_json.combinator || 'AND');
      setRules(preset.rules_json.rules || []);
    }
    handleRunLivePreview(preset.rules_json);
  };

  const handleRunLivePreview = async (rulesOverride?: any) => {
    setLoadingPreview(true);
    try {
      const targetRulesJson = rulesOverride || {
        combinator,
        rules
      };

      const res = await apiFetch('/api/segments/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules_json: targetRulesJson,
          suppression_applied: suppressionApplied
        })
      });

      if (res && res.success) {
        setPreviewRows(Array.isArray(res.data) ? res.data : []);
        setPreviewStats({
          count: res.count || 0,
          totalLtv: res.totalLtv || 0,
          avgGift: res.avgGift || 0
        });
      }
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleAddRule = () => {
    setRules([...rules, { field: 'total_paid_amount', operator: 'gte', value: 1000 }]);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleUpdateRule = (index: number, key: string, val: any) => {
    const updated = [...rules];
    (updated[index] as any)[key] = val;
    setRules(updated);
  };

  const handleSaveSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        type: segmentType,
        rules_json: {
          combinator,
          rules
        },
        suppression_applied: suppressionApplied
      };

      const res = await apiFetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        setIsModalOpen(false);
        setName('');
        setDescription('');
        setRules([{ field: 'total_paid_amount', operator: 'gte', value: 5000 }]);
        setPreviewRows([]);
        fetchSegments();
      }
    } catch (err) {
      console.error('Failed to save segment:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshSegment = async (id: string) => {
    try {
      const res = await apiFetch(`/api/segments/${id}/refresh`, { method: 'POST' });
      if (res && res.success) {
        fetchSegments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCohortRetention = async (segment: any) => {
    setSelectedCohort(segment);
    setActiveViewTab('cohorts');
    setLoadingMatrix(true);
    try {
      const res = await apiFetch(`/api/segments/${segment.id}/cohort-retention`);
      if (res && res.success) {
        setCohortMatrix(res.data);
      }
    } catch (err) {
      console.error('Failed to load retention matrix:', err);
    } finally {
      setLoadingMatrix(false);
    }
  };

  const handleOpenSnapshotModal = (segment: any) => {
    setSnapshotTargetSegment(segment);
    setSnapshotTag(`Freeze-${new Date().toISOString().split('T')[0]}`);
    setIsSnapshotModalOpen(true);
  };

  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotTargetSegment || !snapshotTag) return;
    setSavingSnapshot(true);
    try {
      const res = await apiFetch(`/api/segments/${snapshotTargetSegment.id}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: snapshotTag })
      });
      if (res && res.success) {
        alert(res.message || 'Cohort frozen successfully!');
        setIsSnapshotModalOpen(false);
        fetchSegments();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleExportCSV = (segmentId: string) => {
    window.open(`/api/segments/${segmentId}/export`, '_blank');
  };

  const totalMembersAllSegments = segments.reduce((sum, s) => sum + (Number(s.member_count) || 0), 0);
  const totalLtvAllSegments = segments.reduce((sum, s) => sum + (Number(s.total_ltv) || 0), 0);

  const columns: Column<any>[] = [
    { 
      header: 'Audience Segment Name', 
      accessor: (row) => (
        <div>
          <strong style={{ color: '#0F172A', fontSize: '13px', display: 'block' }}>{row.name || row.segment_name}</strong>
          <span style={{ fontSize: '12px', color: '#64748B' }}>{row.description || 'Dynamic targeted criteria'}</span>
        </div>
      ) 
    },
    { 
      header: 'Type', 
      accessor: (row) => (
        <span style={{ 
          background: row.type === 'cohort' ? '#EFF6FF' : '#ECFDF5', 
          color: row.type === 'cohort' ? '#1D4ED8' : '#059669', 
          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' 
        }}>
          {row.type || 'Dynamic'}
        </span>
      ) 
    },
    { 
      header: 'Active Donors', 
      accessor: (row) => (
        <div>
          <strong style={{ color: '#059669', fontSize: '13px' }}>{row.member_count ?? 0} donors</strong>
          <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>₹{Number(row.total_ltv || 0).toLocaleString('en-IN')} LTV</span>
        </div>
      ) 
    },
    { 
      header: 'Last Evaluated', 
      accessor: (row) => row.last_refreshed_at ? new Date(row.last_refreshed_at).toLocaleString() : 'Live' 
    },
    { header: 'Status', accessor: (row) => <StatusBadge status={row.status || 'Active'} /> },
    {
      header: 'Actions & Cohorts',
      accessor: (row) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={() => handleRefreshSegment(row.id)}
            title="Recalculate live audience count"
            style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
          >
            🔄 Sync
          </button>
          <button 
            onClick={() => handleOpenCohortRetention(row)}
            title="Inspect cohort retention progression"
            style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
          >
            📈 Cohort Matrix
          </button>
          <button 
            onClick={() => handleOpenSnapshotModal(row)}
            title="Freeze snapshot of members at this timestamp"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
          >
            ❄️ Freeze
          </button>
          <button 
            onClick={() => handleExportCSV(row.id)}
            title="Export CSV for Form 10BD and marketing"
            style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
          >
            📥 CSV
          </button>
        </div>
      )
    }
  ];

  return (
    <div style={{ fontFamily: 'var(--font-sans)', padding: '16px', background: '#F8FAFC', minHeight: '100vh', color: '#0F172A', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Lightning Header */}
      <div className="slds-page-header">
        <div className="slds-page-header__top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="slds-object-icon" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
              🎯
            </div>
            <div>
              <span className="slds-object-eyebrow">Audience Cloud & BI</span>
              <h2 className="slds-object-title">
                Donor Segments & Dynamic Cohorts
              </h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => {
                setIsModalOpen(true);
                handleRunLivePreview();
              }}
              className="btn btn-primary"
            >
              <span>➕</span>
              <span>Create New Segment</span>
            </button>
          </div>
        </div>

        <div className="slds-highlights-ribbon">
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Active Segments</span>
            <span className="slds-highlight-item__value">
              {segments.length} Audiences
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Targetable Donors</span>
            <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
              {totalMembersAllSegments.toLocaleString()} Donors
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Cumulative Audience LTV</span>
            <span className="slds-highlight-item__value">
              ₹{totalLtvAllSegments.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Downstream Channels</span>
            <span className="slds-highlight-item__value">
              WhatsApp, Email & Journeys
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '2px' }}>
        <button 
          onClick={() => setActiveViewTab('segments')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
            borderBottom: activeViewTab === 'segments' ? '2px solid #059669' : '2px solid transparent',
            color: activeViewTab === 'segments' ? '#059669' : '#64748B'
          }}
        >
          🎯 All Segments & Presets ({segments.length})
        </button>
        {selectedCohort && (
          <button 
            onClick={() => setActiveViewTab('cohorts')}
            style={{ 
              background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              borderBottom: activeViewTab === 'cohorts' ? '2px solid #059669' : '2px solid transparent',
              color: activeViewTab === 'cohorts' ? '#059669' : '#64748B'
            }}
          >
            📈 Cohort Matrix: {selectedCohort.name}
          </button>
        )}
      </div>

      {activeViewTab === 'segments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Smart Non-Profit Presets Bar */}
          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <strong style={{ fontSize: '13px', color: '#0F172A' }}>⭐ 1-Click Non-Profit Smart Presets</strong>
              <span style={{ fontSize: '11px', color: '#64748B' }}>Click any template to quick-create an audience</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    handleApplyPreset(preset);
                    setIsModalOpen(true);
                  }}
                  style={{
                    background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '8px 14px',
                    borderRadius: '8px', cursor: 'pointer', textAlign: 'left', flexShrink: 0,
                    transition: 'all 0.15s'
                  }}
                >
                  <strong style={{ display: 'block', fontSize: '12px', color: '#0F172A' }}>{preset.name}</strong>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>{preset.type.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Segments Table */}
          <div style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '20px' }}>
            <DataTable 
              data={segments} 
              columns={columns} 
              loading={loading} 
              emptyMessage="No segments created yet. Click 'Create New Segment' or select a Smart Preset above." 
            />
          </div>
        </div>
      )}

      {/* Cohort Retention Matrix Tab */}
      {activeViewTab === 'cohorts' && selectedCohort && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Cohort Retention Analysis</span>
              <h2 style={{ margin: '4px 0', fontSize: '1.4rem', color: '#0F172A' }}>{selectedCohort.name}</h2>
              <p style={{ margin: 0, color: '#64748B', fontSize: '13px' }}>{selectedCohort.description}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => handleOpenSnapshotModal(selectedCohort)}
                style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                ❄️ Freeze Historical Snapshot
              </button>
              <button 
                onClick={() => handleExportCSV(selectedCohort.id)}
                style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                📥 Export Cohort CSV
              </button>
            </div>
          </div>

          {loadingMatrix ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '12px' }}>Calculating retention matrix...</div>
          ) : cohortMatrix ? (
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>📈 Donor Retention & LTV Progression ($M_0$ to $M_{12}$)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
                {cohortMatrix.retentionMatrix?.map((m: any, idx: number) => {
                  const rate = m.retentionRatePercent;
                  const bg = rate >= 70 ? '#DCFCE7' : (rate >= 40 ? '#EFF6FF' : '#FEF3C7');
                  const text = rate >= 70 ? '#15803D' : (rate >= 40 ? '#1D4ED8' : '#B45309');
                  return (
                    <div key={idx} style={{ background: bg, border: `1px solid ${text}33`, padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>{m.month}</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: text }}>{rate}%</div>
                      <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px' }}>{m.retainedCount} Donors</div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>₹{Number(m.cumulativeLtv || 0).toLocaleString('en-IN')} LTV</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Visual Rule Builder Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Build Dynamic Donor Audience Segment">
        <form onSubmit={handleSaveSegment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Segment Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g. VIP Major Donors (>₹25,000)" 
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Segment Type</label>
              <select 
                value={segmentType}
                onChange={e => setSegmentType(e.target.value as any)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#fff' }}
              >
                <option value="dynamic">Dynamic Real-Time Audience</option>
                <option value="cohort">Time-Window Cohort</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Description</label>
            <input 
              type="text" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="e.g. Donors who made high-sum gifts or recurring mandates" 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
            />
          </div>

          {/* Visual Condition Builder */}
          <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <strong style={{ fontSize: '13px' }}>Match Criteria:</strong>
                <select 
                  value={combinator}
                  onChange={e => setCombinator(e.target.value as any)}
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontWeight: 700 }}
                >
                  <option value="AND">ALL conditions must match (AND)</option>
                  <option value="OR">ANY condition may match (OR)</option>
                </select>
              </div>
              <button 
                type="button"
                onClick={handleAddRule}
                style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                ➕ Add Filter Condition
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rules.map((rule, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#FFFFFF', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                  <select 
                    value={rule.field}
                    onChange={e => handleUpdateRule(idx, 'field', e.target.value)}
                    style={{ flex: 2, padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#fff' }}
                  >
                    {availableFields.map(f => (
                      <option key={f.name} value={f.name}>[{f.category}] {f.label}</option>
                    ))}
                  </select>

                  <select 
                    value={rule.operator}
                    onChange={e => handleUpdateRule(idx, 'operator', e.target.value)}
                    style={{ flex: 1.5, padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#fff' }}
                  >
                    <option value="gte">&gt;= (Greater or Equal)</option>
                    <option value="gt">&gt; (Greater than)</option>
                    <option value="lte">&lt;= (Less or Equal)</option>
                    <option value="lt">&lt; (Less than)</option>
                    <option value="equals">= (Equals)</option>
                    <option value="not_equals">!= (Not Equals)</option>
                    <option value="contains">Contains Text</option>
                    <option value="is_true">Is True (Yes)</option>
                    <option value="is_false">Is False (No)</option>
                    <option value="within_past_days">Within Past X Days</option>
                    <option value="more_than_days_ago">More than X Days Ago</option>
                  </select>

                  {!['is_true', 'is_false'].includes(rule.operator) && (
                    <input 
                      type="text" 
                      value={rule.value ?? ''}
                      onChange={e => handleUpdateRule(idx, 'value', e.target.value)}
                      placeholder="Value..."
                      style={{ flex: 1.5, padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  )}

                  {rules.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => handleRemoveRule(idx)}
                      style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={suppressionApplied}
                  onChange={e => setSuppressionApplied(e.target.checked)}
                />
                <span>Auto-suppress opted-out, bounced, and withdrawn contacts</span>
              </label>

              <button 
                type="button" 
                onClick={() => handleRunLivePreview()}
                disabled={loadingPreview}
                style={{ background: '#0F172A', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: loadingPreview ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                {loadingPreview ? '⏳ Running...' : `⚡ Test Query (${previewStats.count} Donors)`}
              </button>
            </div>
          </div>

          {/* Live Preview Bar */}
          <div style={{ background: '#F1F5F9', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-around', textAlign: 'center', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Matching Audience</span>
              <strong style={{ color: '#059669', fontSize: '1.2rem' }}>{previewStats.count} Donors</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Combined LTV</span>
              <strong style={{ fontSize: '1.2rem' }}>₹{previewStats.totalLtv.toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Average Gift</span>
              <strong style={{ fontSize: '1.2rem' }}>₹{previewStats.avgGift.toLocaleString('en-IN')}</strong>
            </div>
          </div>

          {/* Preview rows */}
          {previewRows.length > 0 && (
            <div style={{ maxHeight: '140px', overflowY: 'auto', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '8px', fontSize: '12px' }}>
              {previewRows.slice(0, 10).map((r, i) => (
                <div key={r.id || i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span>
                    <strong>{r.display_name || r.name || 'Supporter'}</strong> ({r.email || r.phone || 'No direct phone'})
                  </span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>₹{Number(r.total_paid_amount || 0).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 22px', borderRadius: '6px', cursor: saving ? 'wait' : 'pointer', fontWeight: 600 }}>
              {saving ? 'Saving...' : '💾 Save Segment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Freeze Snapshot Modal */}
      <Modal isOpen={isSnapshotModalOpen} onClose={() => setIsSnapshotModalOpen(false)} title={`Freeze Snapshot of "${snapshotTargetSegment?.name}"`}>
        <form onSubmit={handleSaveSnapshot} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            Freezing a cohort captures the current matching donor list at this exact timestamp for historical retention analysis.
          </p>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Snapshot Tag / Label</label>
            <input 
              type="text" 
              value={snapshotTag}
              onChange={e => setSnapshotTag(e.target.value)}
              placeholder="e.g. Q1-2026-Baseline" 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              required 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={() => setIsSnapshotModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={savingSnapshot} style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: savingSnapshot ? 'wait' : 'pointer', fontWeight: 600 }}>
              {savingSnapshot ? 'Freezing...' : '❄️ Freeze Snapshot'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
