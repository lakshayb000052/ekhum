import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { StatusBadge } from '../shared/StatusBadge';
import { KpiCard } from '../shared/KpiCard';
import { Modal } from '../shared/Modal';
import { DataTable } from '../shared/DataTable';

export const JourneyList: React.FC<{ onSelectJourney: (journey: any) => void }> = ({ onSelectJourney }) => {
  const [journeys, setJourneys] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgFilter, setSelectedOrgFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    organization_id: '',
    entry_type: 'event',
    entry_event_type: 'contact.created',
    re_entry_allowed: false
  });
  const [eventTypes, setEventTypes] = useState<any[]>([]);

  useEffect(() => {
    fetchJourneys();
    fetchEventTypes();
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const data = await apiFetch('/api/superadmin/organizations');
      if (data && data.success && Array.isArray(data.data)) {
        setOrganizations(data.data);
        if (data.data.length > 0 && !formData.organization_id) {
          setFormData(prev => ({ ...prev, organization_id: data.data[0].id }));
        }
      }
    } catch {
      // Ignored for non-superadmin users
    }
  };

  const fetchJourneys = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/journeys');
      if (data && data.success) {
        setJourneys(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      console.error('Failed to load journeys:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEventTypes = async () => {
    try {
      const data = await apiFetch('/api/events/types');
      if (data && data.success) {
        setEventTypes(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      console.error('Failed to load event types:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        journey_name: formData.name,
        description: formData.description,
        entry_type: formData.entry_type,
        entry_event_type: formData.entry_event_type,
        re_entry_allowed: formData.re_entry_allowed
      };
      if (formData.organization_id) {
        payload.organization_id = formData.organization_id;
      }

      const data = await apiFetch('/api/journeys', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (data && data.success) {
        setIsModalOpen(false);
        setFormData({
          name: '',
          description: '',
          organization_id: organizations.length > 0 ? organizations[0].id : '',
          entry_type: 'event',
          entry_event_type: 'contact.created',
          re_entry_allowed: false
        });
        fetchJourneys();
      } else {
        alert(data?.error || data?.message || 'Failed to create journey.');
      }
    } catch (err: any) {
      console.error('Failed to create journey:', err);
      alert(err.message || 'Error creating journey');
    }
  };

  const updateStatus = async (id: string, action: 'activate' | 'pause') => {
    try {
      const url = action === 'activate' ? `/api/journeys/${id}/activate` : `/api/journeys/${id}/pause`;
      const method = action === 'activate' ? 'POST' : 'PUT';
      const data = await apiFetch(url, { method });
      if (data && data.success) {
        fetchJourneys();
      }
    } catch (err) {
      console.error('Failed to update journey status:', err);
    }
  };

  const duplicateJourney = async (id: string) => {
    try {
      const data = await apiFetch(`/api/journeys/${id}/duplicate`, { method: 'POST' });
      if (data && data.success) {
        alert(data.message || '✅ Journey duplicated successfully!');
        fetchJourneys();
      } else {
        alert(data?.error || data?.message || 'Failed to duplicate journey.');
      }
    } catch (err: any) {
      alert(err.message || 'Error duplicating journey.');
    }
  };

  const testFireJourney = async (id: string, name: string) => {
    try {
      const data = await apiFetch(`/api/journeys/${id}/test-fire`, { method: 'POST' });
      if (data && data.success) {
        alert(data.message || `✅ Test event fired for "${name}"!`);
        fetchJourneys();
      } else {
        alert(data?.error || data?.message || 'Failed to test-fire journey.');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing test-fire.');
    }
  };

  const deleteJourney = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this journey and all its steps?')) return;
    try {
      const data = await apiFetch(`/api/journeys/${id}`, { method: 'DELETE' });
      if (data && data.success) {
        fetchJourneys();
      } else {
        alert(data?.error || data?.message || 'Failed to delete journey.');
      }
    } catch (err: any) {
      console.error('Failed to delete journey:', err);
      alert(err.message || 'Error deleting journey.');
    }
  };

  const journeyList = Array.isArray(journeys) ? journeys : [];
  const filteredJourneys = journeyList.filter(j => {
    const matchesStatus = filter === 'All' || (j.status || '').toLowerCase() === filter.toLowerCase();
    const matchesOrg = selectedOrgFilter === 'all' || j.organization_id === selectedOrgFilter;
    return matchesStatus && matchesOrg;
  });

  const columns: any[] = [
    { 
      key: 'journey_name', 
      label: 'Journey Name', 
      render: (val: any, row: any) => {
        const title = val || row.name || 'Untitled Journey';
        return (
          <div 
            style={{ cursor: 'pointer', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }} 
            onClick={() => onSelectJourney(row)}
          >
            <span>🧭</span>
            <span>{title}</span>
          </div>
        );
      } 
    }
  ];

  if (organizations.length > 0) {
    columns.push({
      key: 'organization_name',
      label: 'Assigned NGO',
      render: (val: any, row: any) => {
        const orgName = val || row.organization_id || 'Global / Superadmin';
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', background: '#F1F5F9', color: '#0F172A', fontSize: '12px', fontWeight: 600 }}>
            <span>🏛️</span> {orgName}
          </span>
        );
      }
    });
  }

  columns.push(
    { 
      key: 'entry_type', 
      label: 'Entry Trigger',
      render: (val: any, row: any) => {
        if (row.entry_event_type) return <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>⚡ {row.entry_event_type}</span>;
        return <span style={{ background: '#F1F5F9', color: '#475569', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{val || 'Manual'}</span>;
      }
    },
    { 
      key: 'status', 
      label: 'Status', 
      render: (val: any) => <StatusBadge status={val || 'draft'} /> 
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
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
          <button 
            onClick={() => onSelectJourney(row)}
            style={{ padding: '6px 12px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            Open Canvas
          </button>
          {row.status !== 'active' ? (
            <button 
              onClick={() => updateStatus(row.id, 'activate')} 
              style={{ padding: '6px 10px', background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              Activate
            </button>
          ) : (
            <button 
              onClick={() => updateStatus(row.id, 'pause')} 
              style={{ padding: '6px 10px', background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              Pause
            </button>
          )}
          <button 
            onClick={() => testFireJourney(row.id, row.journey_name || row.name)} 
            style={{ padding: '6px 10px', background: '#F0FDF4', color: '#059669', border: '1px solid #BBF7D0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
            title="Test fire this journey"
          >
            🧪 Test
          </button>
          <button 
            onClick={() => duplicateJourney(row.id)} 
            style={{ padding: '6px 10px', background: '#F8FAFC', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
            title="Duplicate journey"
          >
            📋 Copy
          </button>
          <button 
            onClick={() => deleteJourney(row.id)} 
            style={{ padding: '6px 10px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
          >
            Delete
          </button>
        </div>
      ) 
    }
  );

  const total = filteredJourneys.length;
  const active = filteredJourneys.filter(j => j.status === 'active').length;
  const draft = filteredJourneys.filter(j => j.status === 'draft').length;

  return (
    <div style={{ padding: '16px', background: '#F8FAFC', minHeight: '100vh', color: '#0F172A', fontFamily: 'var(--font-sans)' }}>
      {/*   Standard Lightning Header */}
      <div className="slds-page-header" style={{ marginBottom: '16px' }}>
        <div className="slds-page-header__top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="slds-object-icon" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
              ⚡
            </div>
            <div>
              <span className="slds-object-eyebrow">Automation Cloud</span>
              <h2 className="slds-object-title">
                Donor Journey Builder & Lifecycle Automations
              </h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {organizations.length > 0 && (
              <select
                value={selectedOrgFilter}
                onChange={e => setSelectedOrgFilter(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', background: '#FFFFFF', fontWeight: 600, color: '#1E293B' }}
              >
                <option value="all">🏛️ All NGO Workspaces</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            )}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary"
            >
              <span>➕</span>
              <span>Create New Journey</span>
            </button>
          </div>
        </div>

        <div className="slds-highlights-ribbon">
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Total Journeys</span>
            <span className="slds-highlight-item__value">
              {total} Workflows
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Active Automated</span>
            <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
              {active} Active
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Drafts</span>
            <span className="slds-highlight-item__value">
              {draft} Drafts
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Channels</span>
            <span className="slds-highlight-item__value">
              WhatsApp & AWS SES
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        {['All', 'Active', 'Draft', 'Paused'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setFilter(tab)}
            style={{ 
              padding: '6px 16px', 
              background: filter === tab ? '#059669' : '#FFFFFF', 
              color: filter === tab ? '#FFFFFF' : '#64748B',
              border: '1px solid',
              borderColor: filter === tab ? '#059669' : '#E2E8F0',
              borderRadius: '20px', 
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={filteredJourneys} 
          loading={loading}
          emptyMessage="No journeys found. Click 'Create New Journey' to build one."
          onRowClick={(row) => onSelectJourney(row)}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Donor Journey">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {organizations.length > 0 && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Assigned NGO Workspace *</label>
              <select
                value={formData.organization_id}
                onChange={e => setFormData({ ...formData, organization_id: e.target.value })}
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none', background: 'white', fontWeight: 600 }}
              >
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>🏛️ {org.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Journey Name</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="e.g. Welcome Series, Lapsed Winback"
              required 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Description</label>
            <textarea 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              placeholder="What does this journey achieve?"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Trigger Type</label>
            <select 
              value={formData.entry_type} 
              onChange={e => setFormData({...formData, entry_type: e.target.value})} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none', background: 'white' }}
            >
              <option value="event">Real-Time Event (Triggered instantly on event)</option>
              <option value="segment">Segment-Based (Triggered on segment members)</option>
              <option value="manual">Manual (Enrolled on demand)</option>
            </select>
          </div>
          {formData.entry_type === 'event' && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Entry Event Type</label>
              <select 
                value={formData.entry_event_type} 
                onChange={e => setFormData({...formData, entry_event_type: e.target.value})} 
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none', background: 'white' }}
              >
                {eventTypes.length > 0 ? (
                  eventTypes.map(t => (
                    <option key={t.id || t} value={t.id || t}>
                      {t.label ? `${t.label} (${t.id})` : t}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="contact.created">Contact Created (New Donor)</option>
                    <option value="donation.completed">Donation Completed</option>
                    <option value="donation.failed">Donation Failed</option>
                    <option value="subscription.created">Subscription Created</option>
                  </>
                )}
              </select>
            </div>
          )}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#334155' }}>
              <input 
                type="checkbox" 
                checked={formData.re_entry_allowed} 
                onChange={e => setFormData({...formData, re_entry_allowed: e.target.checked})} 
                style={{ width: '16px', height: '16px', accentColor: '#059669' }}
              />
              <span>Allow contact re-entry into this journey multiple times</span>
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              style={{ padding: '10px 18px', border: '1px solid #CBD5E1', background: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              style={{ padding: '10px 22px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              Create Journey
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
