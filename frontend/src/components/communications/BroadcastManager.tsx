import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { StatusBadge } from '../shared/StatusBadge';
import { KpiCard } from '../shared/KpiCard';
import { Modal } from '../shared/Modal';
import { DataTable } from '../shared/DataTable';

export const BroadcastManager: React.FC = () => {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [segments, setSegments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    channel: 'email',
    segment_id: '',
    template_id: '',
    schedule_type: 'now',
    scheduled_at: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bcRes, segRes, tplRes] = await Promise.all([
        apiFetch('/api/broadcasts'),
        apiFetch('/api/segments'),
        apiFetch('/api/templates')
      ]);

      if (bcRes && bcRes.success) setBroadcasts(Array.isArray(bcRes.data) ? bcRes.data : []);
      if (segRes && segRes.success) setSegments(Array.isArray(segRes.data) ? segRes.data : []);
      if (tplRes && tplRes.success) setTemplates(Array.isArray(tplRes.data) ? tplRes.data : []);
    } catch (err) {
      console.error('Failed to load broadcasts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        channel: formData.channel,
        segment_id: formData.segment_id,
        template_id: formData.template_id,
        scheduled_at: formData.schedule_type === 'now' ? new Date().toISOString() : formData.scheduled_at,
        status: formData.schedule_type === 'now' ? 'sending' : 'scheduled'
      };

      const data = await apiFetch('/api/broadcasts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (data && data.success) {
        setIsModalOpen(false);
        setFormData({
          name: '',
          channel: 'email',
          segment_id: '',
          template_id: '',
          schedule_type: 'now',
          scheduled_at: ''
        });
        fetchData();
      }
    } catch (err) {
      console.error('Failed to create broadcast:', err);
    }
  };

  const updateStatus = async (id: string, action: 'send' | 'pause') => {
    try {
      const url = action === 'send' ? `/api/broadcasts/${id}/send` : `/api/broadcasts/${id}/pause`;
      const method = action === 'send' ? 'POST' : 'PUT';
      const data = await apiFetch(url, { method });
      if (data && data.success) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to update broadcast status:', err);
    }
  };

  const deleteBroadcast = async (id: string) => {
    if (!confirm('Are you sure you want to delete this broadcast?')) return;
    try {
      const data = await apiFetch(`/api/broadcasts/${id}`, { method: 'DELETE' });
      if (data && data.success) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to delete broadcast:', err);
    }
  };

  const broadcastList = Array.isArray(broadcasts) ? broadcasts : [];

  const columns = [
    { 
      key: 'broadcast_name', 
      label: 'Broadcast Name', 
      render: (val: any, row: any) => {
        const title = val || row.name || 'Untitled Broadcast';
        return <strong style={{ color: '#059669' }}>{title}</strong>;
      } 
    },
    { 
      key: 'channel', 
      label: 'Channel',
      render: (val: any) => (
        <span style={{ 
          background: val === 'whatsapp' ? '#DCFCE7' : '#EFF6FF', 
          color: val === 'whatsapp' ? '#15803D' : '#1D4ED8', 
          padding: '3px 8px', 
          borderRadius: '4px', 
          fontSize: '12px',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {val === 'whatsapp' ? '💬 WhatsApp' : '📧 Email'}
        </span>
      )
    },
    { 
      key: 'status', 
      label: 'Status', 
      render: (val: any) => <StatusBadge status={val || 'draft'} /> 
    },
    { 
      key: 'total_recipients', 
      label: 'Targeted', 
      render: (val: any, row: any) => val || row.recipient_count || 0 
    },
    { 
      key: 'sent_count', 
      label: 'Sent', 
      render: (val: any) => val || 0 
    },
    { 
      key: 'delivered_count', 
      label: 'Delivered', 
      render: (val: any) => val || 0 
    },
    { 
      key: 'opened_count', 
      label: 'Opened / Read', 
      render: (val: any, row: any) => val || row.read_count || 0 
    },
    { 
      key: 'created_at', 
      label: 'Created', 
      render: (val: any) => val ? new Date(val).toLocaleDateString() : 'N/A' 
    },
    { 
      key: 'actions', 
      label: 'Actions', 
      render: (_: any, row: any) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          {row.status === 'draft' || row.status === 'scheduled' ? (
            <button onClick={() => updateStatus(row.id, 'send')} style={{ padding: '4px 10px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Send</button>
          ) : null}
          {row.status === 'sending' ? (
            <button onClick={() => updateStatus(row.id, 'pause')} style={{ padding: '4px 10px', background: '#F59E0B', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Pause</button>
          ) : null}
          <button onClick={() => deleteBroadcast(row.id)} style={{ padding: '4px 10px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Delete</button>
        </div>
      ) 
    }
  ];

  const total = broadcastList.length;
  const sent = broadcastList.filter(b => b.status === 'completed' || b.status === 'sent').length;
  const scheduled = broadcastList.filter(b => b.status === 'scheduled').length;
  const draft = broadcastList.filter(b => b.status === 'draft').length;

  return (
    <div style={{ padding: '16px', background: '#F8FAFC', minHeight: '100vh', color: '#0F172A', fontFamily: 'var(--font-sans)' }}>
      {/*   Standard Lightning Header */}
      <div className="slds-page-header" style={{ marginBottom: '16px' }}>
        <div className="slds-page-header__top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="slds-object-icon" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
              📢
            </div>
            <div>
              <span className="slds-object-eyebrow">Outreach Studio</span>
              <h2 className="slds-object-title">
                Broadcast Studio & Segment Campaigns
              </h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary"
            >
              <span>📢</span>
              <span>New Broadcast</span>
            </button>
          </div>
        </div>

        <div className="slds-highlights-ribbon">
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Total Broadcasts</span>
            <span className="slds-highlight-item__value">
              {total} Campaigns
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Dispatched</span>
            <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
              {sent} Sent
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Scheduled</span>
            <span className="slds-highlight-item__value" style={{ color: '#0284C7' }}>
              {scheduled} Scheduled
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Drafts</span>
            <span className="slds-highlight-item__value">
              {draft} Drafts
            </span>
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <DataTable columns={columns} data={broadcastList} loading={loading} emptyMessage="No broadcasts found. Click 'New Broadcast' to create one." />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Broadcast Campaign">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Broadcast Name</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="e.g. Year-End Giving Appeal"
              required 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Channel</label>
            <select 
              value={formData.channel} 
              onChange={e => setFormData({...formData, channel: e.target.value})} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none', background: 'white' }}
            >
              <option value="email">📧 Email Newsletter / Blast</option>
              <option value="whatsapp">💬 WhatsApp Broadcast Template</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Target Donor Segment</label>
            <select 
              value={formData.segment_id} 
              onChange={e => setFormData({...formData, segment_id: e.target.value})} 
              required 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none', background: 'white' }}
            >
              <option value="">Select Audience Segment...</option>
              {segments.map(s => <option key={s.id} value={s.id}>{s.segment_name || s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Content Template *</label>
            <select 
              value={formData.template_id} 
              onChange={e => setFormData({...formData, template_id: e.target.value})} 
              required 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none', background: 'white' }}
            >
              <option value="">-- Select {formData.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} Template --</option>
              {templates
                .filter(t => formData.channel === 'whatsapp' ? t.type.includes('whatsapp') : (t.type.includes('email') || t.type === 'email_thankyou' || !t.type.includes('whatsapp')))
                .map(t => (
                  <option key={t.id} value={t.id}>
                    {t.is_default ? '⭐ [Default] ' : t.organization_name ? `🏛️ [${t.organization_name}] ` : ''}{t.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Dispatch Schedule</label>
            <div style={{ display: 'flex', gap: '20px', padding: '6px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="radio" name="schedule_type" value="now" checked={formData.schedule_type === 'now'} onChange={e => setFormData({...formData, schedule_type: e.target.value})} />
                <span>Send Immediately</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="radio" name="schedule_type" value="later" checked={formData.schedule_type === 'later'} onChange={e => setFormData({...formData, schedule_type: e.target.value})} />
                <span>Schedule for Specific Date/Time</span>
              </label>
            </div>
          </div>
          {formData.schedule_type === 'later' && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Scheduled Date & Time</label>
              <input 
                type="datetime-local" 
                value={formData.scheduled_at} 
                onChange={e => setFormData({...formData, scheduled_at: e.target.value})} 
                required 
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none' }} 
              />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 18px', border: '1px solid #CBD5E1', background: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
            <button type="submit" style={{ padding: '10px 22px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Create Broadcast</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
