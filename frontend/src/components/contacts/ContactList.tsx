import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable } from '../shared/DataTable';
import { Modal } from '../shared/Modal';
import { StatusBadge } from '../shared/StatusBadge';
import { ContactDetail } from './ContactDetail';

export const ContactList: React.FC = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // New Contact Form
  const [formData, setFormData] = useState({
    title: 'Mr.',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    tax_id: '',
    city: '',
    state: '',
    zip_code: '',
    street_address_1: '',
    street_address_2: '',
    country: 'India',
    contact_status: 'donor'
  });

  // Check URL hash on load for deep linking (e.g. #contact=123)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#contact=')) {
        const id = hash.replace('#contact=', '');
        if (id) setSelectedContactId(id);
      } else if (!hash.includes('contact=')) {
        setSelectedContactId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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

  const handlePincodeLookup = async (pincode: string) => {
    setFormData((prev: any) => ({ ...prev, zip_code: pincode }));
    if (pincode && pincode.trim().length === 6) {
      try {
        const res = await apiFetch(`/api/contacts/pincode/${pincode.trim()}`);
        if (res && res.success && res.data) {
          setFormData((prev: any) => ({
            ...prev,
            city: res.data.city || prev.city,
            state: res.data.state || prev.state,
            country: res.data.country || 'India'
          }));
        }
      } catch (e) {}
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
          title: 'Mr.',
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          tax_id: '',
          city: '',
          state: '',
          zip_code: '',
          street_address_1: '',
          street_address_2: '',
          country: 'India',
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
    const headers = [
      'Contact ID', 'Title', 'First Name', 'Last Name', 'Full Name', 
      'Email', 'Mobile', 'PAN Number', 'Status', 
      'Total Monthly Donations', 'Total One-time Donations', 'Total Paid Amount', 
      'First Gift Date', 'First Gift Campaign', 'Last Gift Date', 'Last Gift Campaign', 
      'City', 'State', 'PIN Code', 'Country', 'Multi-NGOs', 'Multi-Campaigns'
    ];
    const rows = contacts.map(c => [
      `"${c.id}"`,
      `"${c.title || ''}"`,
      `"${c.first_name || ''}"`,
      `"${c.last_name || ''}"`,
      `"${c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}"`,
      `"${c.email || ''}"`,
      `"${c.phone || c.mobile || ''}"`,
      `"${c.tax_id || ''}"`,
      `"${c.contact_status || 'donor'}"`,
      Number(c.total_monthly_donations || 0),
      Number(c.total_onetime_donations || 0),
      Number(c.total_paid_amount || 0),
      `"${c.first_gift_date ? new Date(c.first_gift_date).toLocaleDateString() : ''}"`,
      `"${c.first_gift_campaign_title || ''}"`,
      `"${c.last_gift_date ? new Date(c.last_gift_date).toLocaleDateString() : ''}"`,
      `"${c.last_gift_campaign_title || ''}"`,
      `"${c.city || ''}"`,
      `"${c.state || ''}"`,
      `"${c.zip_code || ''}"`,
      `"${c.country || 'India'}"`,
      `"${c.multi_ngo_names || ''}"`,
      `"${c.multi_campaign_titles || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Salesforce_Contacts_360_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredContacts = contacts.filter((c) => {
    const name = (c.name || `${c.first_name || ''} ${c.last_name || ''}`).toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = (c.phone || c.mobile || '').toLowerCase();
    const pan = (c.tax_id || '').toLowerCase();
    const id = (c.id || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return name.includes(search) || email.includes(search) || phone.includes(search) || pan.includes(search) || id.includes(search);
  });

  // If a contact is selected, show Salesforce 360 Contact Detail View
  if (selectedContactId) {
    return (
      <ContactDetail 
        contactId={selectedContactId} 
        onBack={() => {
          setSelectedContactId(null);
          window.location.hash = '';
          fetchContacts();
        }}
      />
    );
  }

  const columns = [
    { 
      key: 'name', 
      label: 'Contact Name & PAN', 
      render: (val: any, row: any) => {
        const displayName = val || `${row.title ? row.title + ' ' : ''}${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Valued Donor';
        return (
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} 
            onClick={() => {
              setSelectedContactId(row.id);
              window.location.hash = `#contact=${row.id}`;
            }}
          >
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px', border: '1px solid #A7F3D0' }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <a 
                href={`#contact=${row.id}`} 
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedContactId(row.id);
                  window.location.hash = `#contact=${row.id}`;
                }}
                style={{ color: '#059669', fontWeight: 700, textDecoration: 'underline', fontSize: '13px', display: 'block' }}
              >
                {displayName}
              </a>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                <code style={{ fontSize: '10px', color: '#64748B' }}>ID: {row.id.substring(0, 8)}</code>
                {row.tax_id && (
                  <span style={{ fontSize: '10px', background: '#F1F5F9', color: '#0F172A', padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace', fontWeight: 700 }}>
                    PAN: {row.tax_id}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      } 
    },
    { key: 'email', label: 'Email Address' },
    { 
      key: 'phone', 
      label: 'Mobile',
      render: (val: any, row: any) => (
        <span>{val || row.mobile || <span style={{ color: '#94A3B8' }}>—</span>}</span>
      )
    },
    { 
      key: 'total_monthly_donations', 
      label: 'Monthly (Count)',
      render: (val: any) => (
        <span style={{ background: '#FDF4FF', color: '#86198F', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '12px' }}>
          {Number(val || 0)}
        </span>
      )
    },
    { 
      key: 'total_paid_amount', 
      label: 'Total Paid (Value)', 
      render: (val: any) => (
        <strong style={{ color: '#059669', fontSize: '13px' }}>
          ₹{Number(val || 0).toLocaleString()}
        </strong>
      )
    },
    { 
      key: 'last_gift_date', 
      label: 'Last Gift', 
      render: (val: any, row: any) => (
        <div>
          <span style={{ fontWeight: 600, display: 'block' }}>{val ? new Date(val).toLocaleDateString() : 'N/A'}</span>
          <span style={{ fontSize: '11px', color: '#64748B' }}>{row.last_gift_campaign_title || 'Direct'}</span>
        </div>
      )
    },
    {
      key: 'multi_ngo_names',
      label: 'NGOs Contributed',
      render: (val: any) => (
        <span style={{ fontSize: '11px', color: '#475569' }}>
          {val || 'Primary NGO'}
        </span>
      )
    },
    { 
      key: 'contact_status', 
      label: 'Status', 
      render: (val: any) => <StatusBadge status={val || 'donor'} /> 
    }
  ];

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '24px', background: '#F8FAFC', minHeight: '100vh', color: '#0F172A' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0F172A' }}>Salesforce Donor Contacts CRM</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Unified 360° Contact Management with Monthly Donations, Multi-Gateway Payments, 80G Tax History, and Indian Postal auto-lookup.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleExportCSV}
            style={{ background: '#FFFFFF', border: '1.5px solid #CBD5E1', color: '#334155', padding: '9px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <span>📥</span>
            <span>Export 360° CSV</span>
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
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', background: '#FFFFFF', padding: '12px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94A3B8' }}>🔍</span>
          <input 
            type="text" 
            placeholder="Search by name, email, mobile phone, PAN, or Contact ID..." 
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
          onRowClick={(row) => {
            setSelectedContactId(row.id);
            window.location.hash = `#contact=${row.id}`;
          }}
        />
      </div>

      {/* MODAL: ADD CONTACT WITH AUTO PINCODE LOOKUP */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Salesforce Contact">
        <form onSubmit={handleCreateContact} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 1.2fr 1.2fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Title</label>
              <select 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: 'white' }}
              >
                <option value="Mr.">Mr.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Ms.">Ms.</option>
                <option value="Dr.">Dr.</option>
                <option value="Prof.">Prof.</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>First Name</label>
              <input 
                type="text" 
                required
                value={formData.first_name} 
                onChange={e => setFormData({...formData, first_name: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Last Name</label>
              <input 
                type="text" 
                value={formData.last_name} 
                onChange={e => setFormData({...formData, last_name: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Email Address</label>
              <input 
                type="email" 
                required
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Mobile (Only numbers)</label>
              <input 
                type="tel" 
                placeholder="9876543210"
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Permanent Account Number (PAN)</label>
              <input 
                type="text" 
                placeholder="ABCDE1234F"
                maxLength={10}
                value={formData.tax_id} 
                onChange={e => setFormData({...formData, tax_id: e.target.value.toUpperCase()})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontFamily: 'monospace', textTransform: 'uppercase' }} 
              />
              <span style={{ fontSize: '11px', color: '#64748B' }}>Required for 80G Tax Certificates & Form 10BD</span>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Status</label>
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
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Street Address 1</label>
            <input 
              type="text" 
              value={formData.street_address_1} 
              onChange={e => setFormData({...formData, street_address_1: e.target.value})} 
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>PIN Code (Auto Lookup)</label>
              <input 
                type="text" 
                maxLength={6}
                placeholder="110001"
                value={formData.zip_code} 
                onChange={e => handlePincodeLookup(e.target.value)} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>City</label>
              <input 
                type="text" 
                value={formData.city} 
                onChange={e => setFormData({...formData, city: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>State</label>
              <input 
                type="text" 
                value={formData.state} 
                onChange={e => setFormData({...formData, state: e.target.value})} 
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
              Save Contact Record
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
