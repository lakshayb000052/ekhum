import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable } from '../shared/DataTable';
import { Modal } from '../shared/Modal';
import { StatusBadge } from '../shared/StatusBadge';

export const ContactList: React.FC = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  
  // New Contact Form
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    tax_id: '',
    city: '',
    state: '',
    zip_code: '',
    address: '',
    contact_status: 'donor'
  });

  useEffect(() => {
    fetchContacts();
  }, [statusFilter]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const url = statusFilter === 'All' ? '/api/contacts' : `/api/contacts?status=${statusFilter}`;
      const response = await apiFetch(url);
      if (response && response.success) {
        setContacts(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (response && response.success) {
        setIsAddModalOpen(false);
        setFormData({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          tax_id: '',
          city: '',
          state: '',
          zip_code: '',
          address: '',
          contact_status: 'donor'
        });
        fetchContacts();
      }
    } catch (error) {
      console.error('Failed to create contact:', error);
    }
  };

  const handleExportCSV = () => {
    if (contacts.length === 0) return;
    const headers = ['Name', 'Email', 'Phone', 'PAN / Tax ID', 'Status', 'Total Paid', 'Last Gift Date', 'City', 'State', 'Acquisition Source'];
    const rows = contacts.map(c => [
      `"${c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}"`,
      `"${c.email || ''}"`,
      `"${c.phone || ''}"`,
      `"${c.tax_id || ''}"`,
      `"${c.contact_status || 'donor'}"`,
      Number(c.total_paid_amount || 0),
      `"${c.last_gift_date ? new Date(c.last_gift_date).toLocaleDateString() : ''}"`,
      `"${c.city || ''}"`,
      `"${c.state || ''}"`,
      `"${c.acquisition_source || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EKhum_Contacts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredContacts = contacts.filter((c) => {
    const name = (c.name || `${c.first_name || ''} ${c.last_name || ''}`).toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    const pan = (c.tax_id || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return name.includes(search) || email.includes(search) || phone.includes(search) || pan.includes(search);
  });

  const columns = [
    { 
      key: 'name', 
      label: 'Donor Name', 
      render: (val: any, row: any) => {
        const displayName = val || `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Anonymous Donor';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setSelectedContact(row)}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EFF6FF', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <strong style={{ color: '#059669', display: 'block' }}>{displayName}</strong>
              {row.tax_id && (
                <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                  PAN: {row.tax_id}
                </span>
              )}
            </div>
          </div>
        );
      } 
    },
    { key: 'email', label: 'Email Address' },
    { 
      key: 'phone', 
      label: 'Mobile / Phone',
      render: (val: any) => val ? <span>{val}</span> : <span style={{ color: '#94A3B8' }}>—</span>
    },
    { 
      key: 'contact_status', 
      label: 'Status', 
      render: (val: any) => <StatusBadge status={val || 'donor'} /> 
    },
    { 
      key: 'total_paid_amount', 
      label: 'Total Paid (₹)', 
      render: (val: any) => (
        <strong style={{ color: '#0F172A' }}>
          ₹{Number(val || 0).toLocaleString()}
        </strong>
      )
    },
    { 
      key: 'last_gift_date', 
      label: 'Last Gift Date', 
      render: (val: any) => val ? new Date(val).toLocaleDateString() : 'N/A' 
    },
    { 
      key: 'acquisition_source', 
      label: 'Acquisition Source',
      render: (val: any) => (
        <span style={{ background: '#F1F5F9', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>
          {val || 'Direct Web Giving'}
        </span>
      )
    }
  ];

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '24px', background: '#F8FAFC', minHeight: '100vh', color: '#0F172A' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>Donor Contacts CRM</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Unified 360° database with Indian PAN KYC, address records, and lifetime gift histories.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleExportCSV}
            style={{ background: '#FFFFFF', border: '1.5px solid #CBD5E1', color: '#334155', padding: '9px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <span>📥</span>
            <span>Export CSV</span>
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '9px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.2)' }}
          >
            <span>➕</span>
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', background: '#FFFFFF', padding: '12px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94A3B8' }}>🔍</span>
          <input 
            type="text" 
            placeholder="Search by donor name, email, mobile phone, or PAN..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1.5px solid #CBD5E1', borderRadius: '6px', outline: 'none', fontSize: '13px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Filter:</span>
          {['All', 'donor', 'lead', 'lapsed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: statusFilter === st ? '#059669' : '#CBD5E1',
                background: statusFilter === st ? '#059669' : '#FFFFFF',
                color: statusFilter === st ? '#FFFFFF' : '#475569',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <DataTable 
          data={filteredContacts} 
          columns={columns} 
          loading={loading}
          emptyMessage="No contacts found matching your query."
          onRowClick={(row) => setSelectedContact(row)}
        />
      </div>

      {/* MODAL: ADD CONTACT */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Donor Contact">
        <form onSubmit={handleCreateContact} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>First Name</label>
              <input 
                type="text" 
                required
                value={formData.first_name} 
                onChange={e => setFormData({...formData, first_name: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Last Name</label>
              <input 
                type="text" 
                required
                value={formData.last_name} 
                onChange={e => setFormData({...formData, last_name: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Email Address</label>
              <input 
                type="email" 
                required
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Phone / WhatsApp Number</label>
              <input 
                type="tel" 
                placeholder="+91 9876543210"
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Permanent Account Number (PAN)</label>
              <input 
                type="text" 
                placeholder="ABCDE1234F"
                maxLength={10}
                value={formData.tax_id} 
                onChange={e => setFormData({...formData, tax_id: e.target.value.toUpperCase()})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontFamily: 'monospace', textTransform: 'uppercase' }} 
              />
              <span style={{ fontSize: '11px', color: '#64748B' }}>Required for 80G Tax Certificates and Form 10BD</span>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Contact Status</label>
              <select 
                value={formData.contact_status} 
                onChange={e => setFormData({...formData, contact_status: e.target.value})}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: 'white' }}
              >
                <option value="donor">Active Donor</option>
                <option value="lead">Prospective Lead</option>
                <option value="lapsed">Lapsed Donor</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Street Address</label>
            <input 
              type="text" 
              value={formData.address} 
              onChange={e => setFormData({...formData, address: e.target.value})} 
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>City</label>
              <input 
                type="text" 
                value={formData.city} 
                onChange={e => setFormData({...formData, city: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>State</label>
              <input 
                type="text" 
                value={formData.state} 
                onChange={e => setFormData({...formData, state: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>PIN Code</label>
              <input 
                type="text" 
                maxLength={6}
                value={formData.zip_code} 
                onChange={e => setFormData({...formData, zip_code: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button 
              type="button" 
              onClick={() => setIsAddModalOpen(false)} 
              style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: 'white', borderRadius: '6px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              style={{ padding: '8px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Save Contact
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CONTACT DETAIL 360 PROFILE */}
      {selectedContact && (
        <Modal isOpen={!!selectedContact} onClose={() => setSelectedContact(null)} title={`Donor Profile: ${selectedContact.name || `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header badges */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div>
                <strong style={{ fontSize: '16px', color: '#0F172A', display: 'block' }}>{selectedContact.name || `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`}</strong>
                <span style={{ fontSize: '13px', color: '#64748B' }}>{selectedContact.email} • {selectedContact.phone || 'No phone'}</span>
              </div>
              <StatusBadge status={selectedContact.contact_status || 'donor'} />
            </div>

            {/* Financial Highlights Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div style={{ background: '#ECFDF5', padding: '12px', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#047857', fontWeight: 700 }}>Total Donated</span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#065F46', marginTop: '2px' }}>₹{Number(selectedContact.total_paid_amount || 0).toLocaleString()}</div>
              </div>
              <div style={{ background: '#EFF6FF', padding: '12px', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#1D4ED8', fontWeight: 700 }}>Gift Count</span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#1E40AF', marginTop: '2px' }}>{selectedContact.total_gift_count_paid || 1} Gift(s)</div>
              </div>
              <div style={{ background: '#FFFBEB', padding: '12px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#B45309', fontWeight: 700 }}>Last Gift Date</span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#92400E', marginTop: '4px' }}>
                  {selectedContact.last_gift_date ? new Date(selectedContact.last_gift_date).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            </div>

            {/* Address & KYC */}
            <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>Indian Statutory & KYC Data</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                <div><strong>PAN / Tax ID:</strong> <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>{selectedContact.tax_id || 'Not Provided'}</code></div>
                <div><strong>Country:</strong> {selectedContact.country || 'India (IN)'}</div>
                <div><strong>City & State:</strong> {selectedContact.city || '—'}, {selectedContact.state || '—'}</div>
                <div><strong>PIN Code:</strong> {selectedContact.zip_code || '—'}</div>
                <div style={{ gridColumn: 'span 2' }}><strong>Full Address:</strong> {selectedContact.street_address_1 || '—'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setSelectedContact(null)}
                style={{ padding: '8px 18px', background: '#0F172A', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Close Profile
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
