import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable, Column } from '../shared/DataTable';
import { Modal } from '../shared/Modal';
import { StatusBadge } from '../shared/StatusBadge';

export const SegmentBuilder: React.FC = () => {
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sqlQuery, setSqlQuery] = useState('SELECT id, name, email, phone, city FROM donors WHERE 1=1');
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSegments();
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

  const handlePreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await apiFetch('/api/segments/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlQuery })
      });
      if (res && res.success && Array.isArray(res.data)) {
        setPreviewRows(res.data);
      }
    } catch (err) {
      console.error('Preview query error:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSaveSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          query_rules: sqlQuery
        })
      });
      if (res && res.success) {
        setIsModalOpen(false);
        setName('');
        setDescription('');
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

  const columns: Column<any>[] = [
    { header: 'Segment Name', accessor: 'name' },
    { header: 'Description', accessor: (row) => row.description || 'All dynamic matching donors' },
    { header: 'Active Members', accessor: (row) => <strong>{row.member_count ?? 0} donors</strong> },
    { header: 'Last Synced', accessor: (row) => row.last_refreshed_at || row.created_at ? new Date(row.last_refreshed_at || row.created_at).toLocaleString() : 'N/A' },
    { header: 'Status', accessor: (row) => <StatusBadge status={row.status || 'Active'} /> },
    {
      header: 'Actions',
      accessor: (row) => (
        <button 
          onClick={() => handleRefreshSegment(row.id)}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
        >
          🔄 Sync Count
        </button>
      )
    }
  ];

  return (
    <div style={{ fontFamily: 'var(--font-sans)', padding: '16px', background: '#F8FAFC', minHeight: '100vh', color: '#0F172A' }}>
      {/*   Standard Lightning Header */}
      <div className="slds-page-header" style={{ marginBottom: '16px' }}>
        <div className="slds-page-header__top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="slds-object-icon" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
              🎯
            </div>
            <div>
              <span className="slds-object-eyebrow">Audience Cloud</span>
              <h2 className="slds-object-title">
                Donor Segments & Dynamic Cohorts
              </h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary"
            >
              <span>➕</span>
              <span>Create Segment</span>
            </button>
          </div>
        </div>

        <div className="slds-highlights-ribbon">
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Total Segments</span>
            <span className="slds-highlight-item__value">
              {segments.length} Audiences
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Dynamic Queries</span>
            <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
              Real-time Active
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Targeting Channels</span>
            <span className="slds-highlight-item__value">
              WhatsApp & Email
            </span>
          </div>
        </div>
      </div>

      <div style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '20px' }}>
        <DataTable data={segments} columns={columns} loading={loading} emptyMessage="No segments created yet. Click 'Create Segment' to create your first dynamic donor audience." />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Dynamic Donor Segment">
        <form onSubmit={handleSaveSegment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Segment Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. High Value Donors (>₹10,000)" 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              required 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Description</label>
            <input 
              type="text" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="e.g. Donors who contributed large sum single or recurring gifts" 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Target Query SQL Definition</label>
              <button 
                type="button" 
                onClick={handlePreview}
                disabled={loadingPreview}
                style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '4px 10px', borderRadius: '4px', cursor: loadingPreview ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                {loadingPreview ? '⏳ Running...' : `⚡ Preview Contacts (${previewRows.length})`}
              </button>
            </div>
            <textarea 
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="SELECT id FROM donors WHERE ..."
              style={{ 
                width: '100%', padding: '12px', borderRadius: '6px', 
                background: '#1E293B', color: '#38BDF8', fontFamily: 'monospace',
                border: '1px solid #0F172A', minHeight: '90px',
                fontSize: '13px'
              }}
            />
          </div>

          {previewRows.length > 0 && (
            <div style={{ maxHeight: '140px', overflowY: 'auto', background: '#F8FAFC', padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
              <strong>Matching Donors Preview ({previewRows.length}):</strong>
              {previewRows.map((r, i) => (
                <div key={r.id || i} style={{ padding: '3px 0', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {r.id ? (
                      <a href={`#contact=${r.id}`} target="_blank" rel="noreferrer" style={{ color: '#059669', fontWeight: 600, textDecoration: 'none' }}>
                        {r.name || 'Donor'}
                      </a>
                    ) : (
                      <span>{r.name || 'Donor'}</span>
                    )} ({r.email || r.phone || 'No direct info'})
                  </span>
                  <span style={{ color: '#64748B' }}>{r.city || 'India'}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            <button 
              type="submit" 
              disabled={saving}
              style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: saving ? 'wait' : 'pointer', fontWeight: 600 }}
            >
              {saving ? 'Saving...' : '💾 Save Segment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
