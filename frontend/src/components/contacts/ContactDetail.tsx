import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { KpiCard } from '../shared/KpiCard';
import { StatusBadge } from '../shared/StatusBadge';
import { DataTable, Column } from '../shared/DataTable';
import { Modal } from '../shared/Modal';
import { Contact, Communication, Consent, JourneyEnrolment } from '../types';

export const ContactDetail: React.FC<{ contactId: string }> = ({ contactId }) => {
  const [contact, setContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const res = await apiFetch(`/api/contacts/${contactId}`);
        if (res.success) setContact(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchContact();
  }, [contactId]);

  if (loading) return <div>Loading...</div>;
  if (!contact) return <div>Contact not found</div>;

  const tabs = ['Overview', 'Donations', 'Communications', 'Consents', 'Journeys'];

  return (
    <div style={{ fontFamily: 'var(--font-body)', padding: '24px', color: 'var(--secondary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', margin: 0 }}>{contact.first_name} {contact.last_name}</h1>
            <StatusBadge status={contact.contact_status} />
          </div>
          <div style={{ display: 'flex', gap: '16px', color: '#64748b' }}>
            <span>📧 {contact.email}</span>
            <span>📱 {contact.mobile}</span>
            <span>Channel: {contact.preferred_channel || 'None'}</span>
          </div>
        </div>
        <button style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Edit Contact</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
        {tabs.map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ 
              background: 'none', 
              border: 'none', 
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--primary)' : '#64748b',
              padding: '12px 4px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '16px'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <KpiCard title="Total Donated" value={`₹${contact.total_donated || 0}`} />
            <KpiCard title="Gift Count" value={contact.gift_count || 0} />
            <KpiCard title="Active Subscriptions" value={contact.active_subscriptions || 0} />
            <KpiCard title="First Gift" value={contact.first_gift_date ? new Date(contact.first_gift_date).toLocaleDateString() : 'N/A'} />
          </div>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0 }}>Contact Fields</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div><strong>PAN:</strong> {contact.pan_number || 'N/A'}</div>
              <div><strong>DOB:</strong> {contact.date_of_birth ? new Date(contact.date_of_birth).toLocaleDateString() : 'N/A'}</div>
              <div><strong>Address:</strong> {contact.address_line_1 || 'N/A'}</div>
              <div><strong>City:</strong> {contact.city || 'N/A'}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Donations' && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <DataTable data={[]} columns={[{header: 'Date', accessor: 'date'}, {header: 'Amount', accessor: 'amount'}, {header: 'Status', accessor: 'status'}]} loading={false} />
        </div>
      )}

      {activeTab === 'Communications' && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
           <DataTable data={[]} columns={[{header: 'Date', accessor: 'date'}, {header: 'Channel', accessor: 'channel'}, {header: 'Status', accessor: 'status'}]} loading={false} />
        </div>
      )}

      {activeTab === 'Consents' && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
           <DataTable data={[]} columns={[{header: 'Channel', accessor: 'channel'}, {header: 'Status', accessor: 'status'}]} loading={false} />
        </div>
      )}

      {activeTab === 'Journeys' && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
           <DataTable data={[]} columns={[{header: 'Journey Name', accessor: 'name'}, {header: 'Enrolled On', accessor: 'date'}, {header: 'Status', accessor: 'status'}]} loading={false} />
        </div>
      )}
    </div>
  );
};
