import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable, Column } from '../shared/DataTable';
import { Modal } from '../shared/Modal';
import { FormField } from '../shared/FormField';
import { StatusBadge } from '../shared/StatusBadge';

export const ConsentManager: React.FC = () => {
  const [consents, setConsents] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Form State
  const [formData, setFormData] = useState({
    contact_id: '',
    channel: 'Email',
    source: 'Web Checkout Form',
    consent_text: 'I consent to receive donation receipts and campaign updates via email/WhatsApp.'
  });

  useEffect(() => {
    fetchConsents();
    fetchContacts();
  }, []);

  const fetchConsents = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/consent');
      if (res && res.success) setConsents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch consents:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await apiFetch('/api/contacts');
      if (res && res.success) setContacts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleWithdraw = async (id: string) => {
    if (!confirm('Are you sure you want to withdraw consent for this contact?')) return;
    try {
      const res = await apiFetch(`/api/consent/${id}/withdraw`, { method: 'PUT' });
      if (res && res.success) {
        fetchConsents();
      }
    } catch (err) {
      console.error('Withdraw error:', err);
    }
  };

  const handleSaveConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: formData.contact_id,
          channel: formData.channel,
          status: 'Active',
          source: formData.source
        })
      });
      if (res && res.success) {
        setIsModalOpen(false);
        setFormData({
          contact_id: '',
          channel: 'Email',
          source: 'Web Checkout Form',
          consent_text: 'I consent to receive donation receipts and campaign updates via email/WhatsApp.'
        });
        fetchConsents();
      }
    } catch (err) {
      console.error('Save consent error:', err);
    }
  };

  const filteredConsents = consents.filter(c => {
    const channelMatch = selectedChannel === 'All' || (c.channel || '').toLowerCase() === selectedChannel.toLowerCase();
    const statusMatch = selectedStatus === 'All' || (c.status || '').toLowerCase() === selectedStatus.toLowerCase();
    return channelMatch && statusMatch;
  });

  const columns: Column<any>[] = [
    { header: 'Contact Name', accessor: (row) => row.contact_name || row.donor_name || 'Anonymous Donor' },
    { header: 'Email / Phone', accessor: (row) => row.contact_email || row.contact_phone || 'N/A' },
    { header: 'Channel', accessor: 'channel' },
    { header: 'Status', accessor: (row) => <StatusBadge status={row.status || 'Active'} /> },
    { header: 'Source', accessor: (row) => row.source || 'Direct Opt-In' },
    { header: 'Captured At', accessor: (row) => row.created_at || row.captured_at ? new Date(row.created_at || row.captured_at).toLocaleString() : 'N/A' },
    { header: 'Withdrawn At', accessor: (row) => row.withdrawn_at ? new Date(row.withdrawn_at).toLocaleString() : '-' },
    { 
      header: 'Actions', 
      accessor: (row) => (row.status || '').toLowerCase() === 'active' ? (
        <button 
          onClick={() => handleWithdraw(row.id)}
          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
        >
          Withdraw
        </button>
      ) : null
    },
  ];

  return (
    <div style={{ fontFamily: 'var(--font-body)', padding: '24px', color: 'var(--secondary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', margin: 0 }}>Consent Management</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Track and audit DPDP Act / GDPR statutory opt-in and consent permissions across communication channels.
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          ➕ Record Consent
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <select 
          value={selectedChannel}
          onChange={(e) => setSelectedChannel(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff' }}
        >
          <option value="All">All Channels</option>
          <option value="Email">Email</option>
          <option value="WhatsApp">WhatsApp</option>
        </select>
        <select 
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff' }}
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Withdrawn">Withdrawn</option>
        </select>
      </div>

      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px' }}>
        <DataTable data={filteredConsents} columns={columns} loading={loading} emptyMessage="No consent records logged yet." />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Contact Consent">
        <form onSubmit={handleSaveConsent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Select Contact / Donor</label>
            <select 
              required
              value={formData.contact_id} 
              onChange={e => setFormData({ ...formData, contact_id: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff' }}
            >
              <option value="">-- Choose Contact --</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email || c.phone || 'No direct contact'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Channel</label>
            <select 
              value={formData.channel} 
              onChange={e => setFormData({ ...formData, channel: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff' }} 
              required
            >
              <option value="Email">Email</option>
              <option value="WhatsApp">WhatsApp</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Source / Form Origin</label>
            <input 
              type="text" 
              value={formData.source} 
              onChange={e => setFormData({ ...formData, source: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
              required 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Consent Text Shown</label>
            <textarea 
              value={formData.consent_text} 
              onChange={e => setFormData({ ...formData, consent_text: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', minHeight: '70px' }} 
              required 
            />
          </div>
          <button 
            type="submit" 
            style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, marginTop: '8px' }}
          >
            💾 Save Consent Record
          </button>
        </form>
      </Modal>
    </div>
  );
};
