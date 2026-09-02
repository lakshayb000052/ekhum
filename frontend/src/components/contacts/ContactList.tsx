import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../shared/api';
import { StatusBadge } from '../shared/StatusBadge';
import { Modal } from '../shared/Modal';
import { ContactDetail } from './ContactDetail';

export const ContactList: React.FC = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [listView, setListView] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Sorting
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // New Contact Modal
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
  const [newContactForm, setNewContactForm] = useState<any>({
    title: 'Mr.',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    tax_id: '',
    birthdate: '',
    street_address_1: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'India',
    contact_status: 'donor'
  });
  const [pinLookupStatus, setPinLookupStatus] = useState<{ loading: boolean; text?: string }>({ loading: false });

  // URL Hash listener for direct deep-linking (e.g. #contact=123)
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
  }, [listView]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (listView !== 'all') queryParams.append('listView', listView);
      const endpoint = `/api/contacts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await apiFetch(endpoint);
      if (response && response.success) {
        setContacts(Array.isArray(response.data) ? response.data : []);
        setLastRefreshed(new Date());
        setSelectedIds([]);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle PIN Code auto-fill
  const handlePincodeChange = async (pincode: string) => {
    setNewContactForm((prev: any) => ({ ...prev, zip_code: pincode }));
    const trimmed = pincode.trim();
    if (trimmed.length === 6 && /^\d{6}$/.test(trimmed)) {
      setPinLookupStatus({ loading: true });
      try {
        const res = await apiFetch(`/api/contacts/pincode/${trimmed}`);
        if (res && res.success && res.data) {
          setNewContactForm((prev: any) => ({
            ...prev,
            city: res.data.city || prev.city,
            state: res.data.state || prev.state,
            country: res.data.country || 'India'
          }));
          setPinLookupStatus({
            loading: false,
            text: `📍 ${res.data.city || 'Verified'}, ${res.data.state || 'India'}`
          });
          return;
        }
      } catch (e) {}
      setPinLookupStatus({ loading: false, text: 'Custom PIN' });
    } else {
      setPinLookupStatus({ loading: false });
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContactForm)
      });
      if (res && res.success) {
        setIsNewContactModalOpen(false);
        setNewContactForm({
          title: 'Mr.',
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          tax_id: '',
          birthdate: '',
          street_address_1: '',
          city: '',
          state: '',
          zip_code: '',
          country: 'India',
          contact_status: 'donor'
        });
        fetchContacts();
      }
    } catch (err) {
      console.error('Failed to create contact:', err);
    }
  };

  // Sorting Handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Search & Sort Filter
  const filteredAndSortedContacts = useMemo(() => {
    let result = [...contacts];

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter((c) => {
        const name = (c.name || `${c.first_name || ''} ${c.last_name || ''}`).toLowerCase();
        const email = (c.email || '').toLowerCase();
        const phone = (c.phone || c.mobile || '').toLowerCase();
        const pan = (c.tax_id || '').toLowerCase();
        const id = (c.id || '').toLowerCase();
        const city = (c.city || '').toLowerCase();
        const ngo = (c.multi_ngo_names || '').toLowerCase();
        const campaign = (c.multi_campaign_titles || '').toLowerCase();

        return name.includes(search) || email.includes(search) || phone.includes(search) || pan.includes(search) || id.includes(search) || city.includes(search) || ngo.includes(search) || campaign.includes(search);
      });
    }

    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'name') {
        valA = (a.name || `${a.first_name || ''} ${a.last_name || ''}`).toLowerCase();
        valB = (b.name || `${b.first_name || ''} ${b.last_name || ''}`).toLowerCase();
      } else if (sortField === 'total_paid_amount') {
        valA = Number(a.total_paid_amount || 0);
        valB = Number(b.total_paid_amount || 0);
      } else if (sortField === 'total_monthly_donations') {
        valA = Number(a.total_monthly_donations || 0);
        valB = Number(b.total_monthly_donations || 0);
      } else if (sortField === 'last_gift_date' || sortField === 'created_at') {
        valA = a[sortField] ? new Date(a[sortField]).getTime() : 0;
        valB = b[sortField] ? new Date(b[sortField]).getTime() : 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [contacts, searchTerm, sortField, sortAsc]);

  // Bulk Selection
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredAndSortedContacts.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleExportCSV = (onlySelected = false) => {
    const dataToExport = onlySelected 
      ? contacts.filter(c => selectedIds.includes(c.id))
      : filteredAndSortedContacts;

    if (dataToExport.length === 0) return;

    const headers = [
      'Contact ID', 'Title', 'First Name', 'Last Name', 'Full Name', 
      'Email', 'Mobile', 'PAN Number', 'Status', 'Donor Tier', 'Lifecycle Stage',
      'Total Monthly Mandates', 'Total One-time Donations', 'Total Paid Amount (INR)', 
      'First Gift Date', 'First Gift Campaign', 'Last Gift Date', 'Last Gift Campaign', 
      'City', 'State', 'PIN Code', 'Country', 'Multi-NGOs', 'Multi-Campaigns'
    ];

    const rows = dataToExport.map(c => {
      const paid = Number(c.total_paid_amount || 0);
      return [
        `"${c.id}"`,
        `"${c.title || ''}"`,
        `"${c.first_name || ''}"`,
        `"${c.last_name || ''}"`,
        `"${c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}"`,
        `"${c.email || ''}"`,
        `"${c.phone || c.mobile || ''}"`,
        `"${c.tax_id || ''}"`,
        `"${c.contact_status || 'donor'}"`,
        `"${c.donor_tier || 'Bronze'}"`,
        `"${c.donor_lifecycle_stage || 'lead'}"`,
        Number(c.total_monthly_donations || 0),
        Number(c.total_onetime_donations || 0),
        paid,
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
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', ` _Contacts_${listView}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // If a contact is selected, show   360 Contact Detail View
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

  return (
    <div style={{ fontFamily: 'var(--font-sans)', background: '#F8FAFC', minHeight: '100vh', padding: '16px', color: '#0F172A' }}>
      
      {/*   Standard Lightning Header */}
      <div style={{ background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '14px 18px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          
          {/* Object Header Info +   List View Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '8px', 
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#FFFFFF', 
              fontSize: '20px',
              fontWeight: 'bold',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)'
            }}>
              👤
            </div>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em' }}>
                Contacts CRM
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select 
                  value={listView}
                  onChange={(e) => setListView(e.target.value)}
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#0F172A',
                    border: '1px solid transparent',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#CBD5E1')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                >
                  <option value="all">All Contacts</option>
                  <option value="active_donors">Active Donors</option>
                  <option value="monthly_donors">Monthly / Recurring Mandates</option>
                  <option value="major_donors">Major / High-Value Champions (₹25k+)</option>
                  <option value="leads">Prospects &amp; Leads</option>
                  <option value="lapsed">Lapsed Donors (&gt; 180 Days)</option>
                  <option value="missing_pan">Missing PAN KYC</option>
                </select>
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '1px' }}>
                {filteredAndSortedContacts.length} items &bull; Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/*   Standard Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            
            {/* Search Input */}
            <div style={{ position: 'relative', width: '240px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '8px', color: '#706E6B', fontSize: '13px' }}>🔍</span>
              <input 
                type="text" 
                placeholder="Search this list..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '7px 10px 7px 32px', 
                  border: '1px solid #DDDBDA', 
                  borderRadius: '4px', 
                  fontSize: '13px', 
                  outline: 'none',
                  background: '#FFFFFF',
                  color: '#181818',
                  boxSizing: 'border-box'
                }}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  style={{ position: 'absolute', right: '8px', top: '7px', background: 'none', border: 'none', color: '#706E6B', cursor: 'pointer', fontSize: '12px' }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* New Contact Button */}
            <button 
              onClick={() => setIsNewContactModalOpen(true)}
              style={{ 
                background: '#059669', 
                border: '1px solid #047857', 
                color: '#FFFFFF', 
                borderRadius: '4px', 
                padding: '7px 14px', 
                cursor: 'pointer', 
                fontSize: '13px', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>➕</span>
              <span>New Contact</span>
            </button>

            {/* Refresh Button */}
            <button 
              onClick={fetchContacts}
              title="Refresh List"
              style={{ 
                background: '#FFFFFF', 
                border: '1px solid #DDDBDA', 
                borderRadius: '4px', 
                padding: '7px 12px', 
                cursor: 'pointer', 
                fontSize: '13px', 
                color: '#059669', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>↻</span>
            </button>

            {/* Export Button */}
            <button 
              onClick={() => handleExportCSV(false)}
              style={{ 
                background: '#FFFFFF', 
                border: '1px solid #DDDBDA', 
                borderRadius: '4px', 
                padding: '7px 14px', 
                cursor: 'pointer', 
                fontSize: '13px', 
                color: '#059669', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📥</span>
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Bulk Action Bar (When rows are selected) */}
        {selectedIds.length > 0 && (
          <div style={{ marginTop: '12px', padding: '8px 12px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#065F46' }}>
              ✓ {selectedIds.length} contact{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => handleExportCSV(true)}
                style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Export Selected ({selectedIds.length})
              </button>
              <button 
                onClick={() => setSelectedIds([])}
                style={{ background: '#FFFFFF', color: '#374151', border: '1px solid #D1D5DB', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
              >
                Deselect All
              </button>
            </div>
          </div>
        )}
      </div>

      {/*   Standard Table Container */}
      <div style={{ background: '#FFFFFF', borderRadius: '6px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)', overflowX: 'auto', width: '100%' }}>
        
        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
            <div style={{ fontSize: '26px', marginBottom: '8px' }}>🔄</div>
            Loading   contact records...
          </div>
        ) : filteredAndSortedContacts.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
            No contact records matching <strong>"{listView}"</strong> found.
          </div>
        ) : (
          <table style={{ width: '100%', minWidth: '1120px', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 14px', width: '42px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.length === filteredAndSortedContacts.length && filteredAndSortedContacts.length > 0}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th 
                  onClick={() => handleSort('name')}
                  style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', width: '220px', cursor: 'pointer' }}
                >
                  Name {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th 
                  onClick={() => handleSort('email')}
                  style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', width: '230px', cursor: 'pointer' }}
                >
                  Email {sortField === 'email' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', width: '140px' }}>
                  Phone
                </th>
                <th style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', width: '130px' }}>
                  PAN Number
                </th>
                <th 
                  onClick={() => handleSort('total_paid_amount')}
                  style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', width: '120px', cursor: 'pointer' }}
                >
                  Total Paid {sortField === 'total_paid_amount' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th 
                  onClick={() => handleSort('total_monthly_donations')}
                  style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', width: '110px', cursor: 'pointer' }}
                >
                  Mandates {sortField === 'total_monthly_donations' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th 
                  onClick={() => handleSort('last_gift_date')}
                  style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', width: '120px', cursor: 'pointer' }}
                >
                  Last Gift {sortField === 'last_gift_date' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', width: '108px', textAlign: 'center' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedContacts.map((row, idx) => {
                const displayName = row.name || `${row.title ? row.title + ' ' : ''}${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Contact';
                const totalPaid = Number(row.total_paid_amount || row.summary?.total_donated || 0);
                const mandates = Number(row.total_monthly_donations || 0);
                const isSelected = selectedIds.includes(row.id);

                return (
                  <tr 
                    key={row.id}
                    style={{ 
                      borderBottom: '1px solid #E2E8F0', 
                      background: isSelected ? '#ECFDF5' : idx % 2 === 0 ? '#FFFFFF' : '#FAFAFB',
                      transition: 'background-color 0.1s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#F0FDF4';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFB';
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => handleToggleSelect(row.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>

                    {/* Name Column */}
                    <td 
                      style={{ padding: '12px 14px', overflow: 'hidden' }}
                      onClick={() => {
                        setSelectedContactId(row.id);
                        window.location.hash = `#contact=${row.id}`;
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <a 
                          href={`#contact=${row.id}`} 
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedContactId(row.id);
                            window.location.hash = `#contact=${row.id}`;
                          }}
                          style={{ color: '#059669', fontWeight: 700, fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', maxWidth: '140px' }}
                          title={displayName}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {displayName}
                        </a>
                        {row.donor_tier && row.donor_tier !== 'Bronze' && (
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: 700, 
                            padding: '1px 5px', 
                            borderRadius: '3px',
                            background: row.donor_tier === 'Platinum' ? '#F3E8FF' : '#FEF3C7',
                            color: row.donor_tier === 'Platinum' ? '#7E22CE' : '#B45309',
                            border: `1px solid ${row.donor_tier === 'Platinum' ? '#D8B4FE' : '#FDE68A'}`,
                            flexShrink: 0
                          }}>
                            {row.donor_tier}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        ID: {row.id.substring(0, 8)} {row.city ? `• ${row.city}` : ''}
                      </div>
                    </td>

                    {/* Email */}
                    <td 
                      style={{ padding: '12px 14px', fontSize: '13px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={row.email || ''}
                      onClick={() => {
                        setSelectedContactId(row.id);
                        window.location.hash = `#contact=${row.id}`;
                      }}
                    >
                      {row.email || <span style={{ color: '#94A3B8' }}>—</span>}
                    </td>

                    {/* Phone */}
                    <td 
                      style={{ padding: '12px 14px', fontSize: '13px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title={row.phone || row.mobile || ''}
                      onClick={() => {
                        setSelectedContactId(row.id);
                        window.location.hash = `#contact=${row.id}`;
                      }}
                    >
                      {row.phone || row.mobile || <span style={{ color: '#94A3B8' }}>—</span>}
                    </td>

                    {/* PAN */}
                    <td 
                      style={{ padding: '12px 14px', fontSize: '12.5px', fontFamily: 'monospace', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}
                      onClick={() => {
                        setSelectedContactId(row.id);
                        window.location.hash = `#contact=${row.id}`;
                      }}
                    >
                      {row.tax_id && row.tax_id !== 'PAN_PENDING' ? (
                        <span>{row.tax_id}</span>
                      ) : (
                        <span style={{ color: '#D97706', fontSize: '11px', fontWeight: 600 }}>Missing PAN</span>
                      )}
                    </td>

                    {/* Total Paid */}
                    <td 
                      style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}
                      onClick={() => {
                        setSelectedContactId(row.id);
                        window.location.hash = `#contact=${row.id}`;
                      }}
                    >
                      ₹{totalPaid.toLocaleString()}
                    </td>

                    {/* Monthly Mandates */}
                    <td 
                      style={{ padding: '12px 14px', fontSize: '13px', color: '#0F172A', whiteSpace: 'nowrap' }}
                      onClick={() => {
                        setSelectedContactId(row.id);
                        window.location.hash = `#contact=${row.id}`;
                      }}
                    >
                      {mandates > 0 ? (
                        <span style={{ fontWeight: 700, color: '#701A75', background: '#FDF4FF', padding: '2px 6px', borderRadius: '4px', border: '1px solid #F5D0FE' }}>
                          {mandates} Active
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>0</span>
                      )}
                    </td>

                    {/* Last Gift */}
                    <td 
                      style={{ padding: '12px 14px', fontSize: '12px', color: '#0F172A', overflow: 'hidden' }}
                      onClick={() => {
                        setSelectedContactId(row.id);
                        window.location.hash = `#contact=${row.id}`;
                      }}
                    >
                      {row.last_gift_date ? (
                        <div>
                          <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{new Date(row.last_gift_date).toLocaleDateString()}</div>
                          <div style={{ fontSize: '10.5px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.last_gift_campaign_title || 'Direct'}>
                            {row.last_gift_campaign_title || 'Direct'}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td 
                      style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}
                      onClick={() => {
                        setSelectedContactId(row.id);
                        window.location.hash = `#contact=${row.id}`;
                      }}
                    >
                      <StatusBadge status={row.contact_status || 'donor'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Table Footer */}
        <div style={{ padding: '10px 16px', background: '#FAFAFB', borderTop: '1px solid #DDDBDA', fontSize: '12px', color: '#706E6B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{filteredAndSortedContacts.length} of {contacts.length} total records displayed</span>
          <span>Click any contact to open   360° record page.</span>
        </div>
      </div>

      {/* MODAL: NEW CONTACT KYC */}
      <Modal isOpen={isNewContactModalOpen} onClose={() => setIsNewContactModalOpen(false)} title="Create New Contact">
        <form onSubmit={handleCreateContact} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 1.2fr 1.2fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Title</label>
              <select 
                value={newContactForm.title} 
                onChange={e => setNewContactForm({...newContactForm, title: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA' }}
              >
                <option value="Mr.">Mr.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Ms.">Ms.</option>
                <option value="Dr.">Dr.</option>
                <option value="Prof.">Prof.</option>
                <option value="Shri">Shri</option>
                <option value="Smt.">Smt.</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>First Name *</label>
              <input 
                type="text" 
                required
                value={newContactForm.first_name} 
                onChange={e => setNewContactForm({...newContactForm, first_name: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Last Name</label>
              <input 
                type="text" 
                value={newContactForm.last_name} 
                onChange={e => setNewContactForm({...newContactForm, last_name: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Email Address *</label>
              <input 
                type="email" 
                required
                value={newContactForm.email} 
                onChange={e => setNewContactForm({...newContactForm, email: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Mobile Number</label>
              <input 
                type="tel" 
                value={newContactForm.phone} 
                onChange={e => setNewContactForm({...newContactForm, phone: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>PAN Number (10 Digits)</label>
              <input 
                type="text" 
                maxLength={10}
                placeholder="e.g. ABCDE1234F"
                value={newContactForm.tax_id} 
                onChange={e => setNewContactForm({...newContactForm, tax_id: e.target.value.toUpperCase()})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', fontFamily: 'monospace', textTransform: 'uppercase', boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Date of Birth</label>
              <input 
                type="date" 
                value={newContactForm.birthdate} 
                onChange={e => setNewContactForm({...newContactForm, birthdate: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Street Address</label>
            <input 
              type="text" 
              value={newContactForm.street_address_1} 
              onChange={e => setNewContactForm({...newContactForm, street_address_1: e.target.value})}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>PIN Code</label>
              <input 
                type="text" 
                maxLength={6}
                value={newContactForm.zip_code} 
                onChange={e => handlePincodeChange(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #059669', fontWeight: 700, fontFamily: 'monospace', boxSizing: 'border-box' }} 
              />
              {pinLookupStatus.text && <div style={{ fontSize: '10.5px', color: '#04844B', marginTop: '2px' }}>{pinLookupStatus.text}</div>}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>City</label>
              <input 
                type="text" 
                value={newContactForm.city} 
                onChange={e => setNewContactForm({...newContactForm, city: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>State</label>
              <input 
                type="text" 
                value={newContactForm.state} 
                onChange={e => setNewContactForm({...newContactForm, state: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setIsNewContactModalOpen(false)} style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
              Create Contact
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
