import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { StatusBadge } from '../shared/StatusBadge';
import { Modal } from '../shared/Modal';
import { Contact, MonthlyDonation } from '../types';

interface ContactDetailProps {
  contactId: string;
  onBack?: () => void;
  onNavigateContact?: (id: string) => void;
}

export const ContactDetail: React.FC<ContactDetailProps> = ({ contactId, onBack }) => {
  const [contact, setContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Monthly Donations' | 'Payments' | 'Payments on Monthly Donation' | '80G History' | '10 BD History' | 'Email Communication History' | 'WhatsApp Communication History'>('Overview');
  const [loading, setLoading] = useState(true);
  const [selectedMonthlyDonation, setSelectedMonthlyDonation] = useState<MonthlyDonation | null>(null);
  const [filterSubscriptionId, setFilterSubscriptionId] = useState<string | null>(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddMonthlyModalOpen, setIsAddMonthlyModalOpen] = useState(false);
  const [isManageMonthlyModalOpen, setIsManageMonthlyModalOpen] = useState(false);
  const [isSendCommModalOpen, setIsSendCommModalOpen] = useState(false);
  const [commChannel, setCommChannel] = useState<'email' | 'whatsapp'>('email');

  // Edit Form State
  const [editForm, setEditForm] = useState<any>({});
  const [monthlyForm, setMonthlyForm] = useState<any>({
    amount: 1000,
    payment_gateway: 'razorpay',
    payment_method: 'upi_autopay',
    bank_name: 'HDFC Bank',
    signup_date: new Date().toISOString().split('T')[0],
    next_payment_due_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]
  });
  const [manageForm, setManageForm] = useState<any>({
    action: 'pause',
    paused_period: 3,
    upgraded_value: 2000,
    amount: 500,
    end_reason: 'Donor requested cancellation',
    helpdesk_ticket_id: ''
  });
  const [commForm, setCommForm] = useState<any>({
    subject: 'Thank you for your continued support',
    message: '',
    template_name: 'ad_hoc_update'
  });

  const fetchContact = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/contacts/${contactId}`);
      if (res && res.success) {
        setContact(res.data);
        setEditForm({
          title: res.data.title || 'Mr.',
          first_name: res.data.first_name || '',
          last_name: res.data.last_name || '',
          email: res.data.email || '',
          phone: res.data.phone || res.data.mobile || '',
          birthdate: res.data.birthdate ? res.data.birthdate.split('T')[0] : '',
          tax_id: res.data.tax_id || res.data.pan_number || '',
          street_address_1: res.data.street_address_1 || res.data.address_line_1 || '',
          street_address_2: res.data.street_address_2 || res.data.address_line_2 || '',
          city: res.data.city || '',
          state: res.data.state || '',
          zip_code: res.data.zip_code || res.data.pincode || '',
          country: res.data.country || 'India',
          contact_status: res.data.contact_status || 'donor'
        });
      }
    } catch (err) {
      console.error('Error fetching contact 360:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contactId) {
      fetchContact();
    }
  }, [contactId]);

  // Handle PIN Code auto-fill
  const handlePincodeChange = async (pincode: string) => {
    setEditForm((prev: any) => ({ ...prev, zip_code: pincode }));
    if (pincode && pincode.trim().length === 6) {
      try {
        const res = await apiFetch(`/api/contacts/pincode/${pincode.trim()}`);
        if (res && res.success && res.data) {
          setEditForm((prev: any) => ({
            ...prev,
            city: res.data.city || prev.city,
            state: res.data.state || prev.state,
            country: res.data.country || 'India'
          }));
        }
      } catch (e) {}
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      if (res && res.success) {
        setIsEditModalOpen(false);
        fetchContact();
      }
    } catch (err) {
      console.error('Failed to update contact:', err);
    }
  };

  const handleCreateMonthlyDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/contacts/${contactId}/monthly-donations`, {
        method: 'POST',
        body: JSON.stringify(monthlyForm)
      });
      if (res && res.success) {
        setIsAddMonthlyModalOpen(false);
        fetchContact();
      }
    } catch (err) {
      console.error('Failed to create monthly donation:', err);
    }
  };

  const handleManageMonthlyDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMonthlyDonation) return;
    try {
      const res = await apiFetch(`/api/contacts/monthly-donations/${selectedMonthlyDonation.id}`, {
        method: 'PUT',
        body: JSON.stringify(manageForm)
      });
      if (res && res.success) {
        setIsManageMonthlyModalOpen(false);
        fetchContact();
      }
    } catch (err) {
      console.error('Failed to manage monthly donation:', err);
    }
  };

  const handleSendCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/communications/send', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: contactId,
          channel: commChannel,
          subject_line: commForm.subject,
          message: commForm.message,
          template_name: commForm.template_name
        })
      });
      if (res && res.success) {
        setIsSendCommModalOpen(false);
        setCommForm({ subject: '', message: '', template_name: 'ad_hoc_update' });
        fetchContact();
      }
    } catch (err) {
      console.error('Failed to send communication:', err);
    }
  };

  const handleDrilldownMonthlyPayments = (sub: MonthlyDonation) => {
    setSelectedMonthlyDonation(sub);
    setFilterSubscriptionId(sub.id);
    setActiveTab('Payments on Monthly Donation');
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
        Loading 360° Salesforce Contact Profile...
      </div>
    );
  }

  if (!contact) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h3>Contact Record Not Found</h3>
        {onBack && (
          <button onClick={onBack} style={{ padding: '8px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Back to Contact List
          </button>
        )}
      </div>
    );
  }

  const monthlyDonations = contact.monthly_donations || [];
  const payments = contact.payments || [];
  const eightyGReceipts = contact.eighty_g_receipts || [];
  const tenBDHistory = contact.ten_bd_history || [];
  const emailComms = contact.email_communications || [];
  const whatsappComms = contact.whatsapp_communications || [];
  const summary = contact.summary || {};

  const filteredMonthlyPayments = filterSubscriptionId 
    ? payments.filter(p => p.subscription_id === filterSubscriptionId || p.monthly_donation_id === filterSubscriptionId)
    : payments.filter(p => p.subscription_id || p.payment_type === 'monthly_donation');

  const tabs: Array<'Overview' | 'Monthly Donations' | 'Payments' | 'Payments on Monthly Donation' | '80G History' | '10 BD History' | 'Email Communication History' | 'WhatsApp Communication History'> = [
    'Overview',
    'Monthly Donations',
    'Payments',
    'Payments on Monthly Donation',
    '80G History',
    '10 BD History',
    'Email Communication History',
    'WhatsApp Communication History'
  ];

  return (
    <div style={{ fontFamily: 'Inter, -apple-system, system-ui, sans-serif', padding: '24px', background: '#F8FAFC', minHeight: '100vh', color: '#0F172A' }}>
      
      {/* Top Breadcrumb & Salesforce Header Card */}
      <div style={{ background: '#FFFFFF', padding: '20px 24px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* Contact Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {onBack && (
              <button 
                onClick={onBack}
                style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}
              >
                <span>⬅</span>
                <span>Back</span>
              </button>
            )}
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #059669 0%, #0F172A 100%)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '22px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              {(contact.first_name || contact.name || 'D').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#0F172A' }}>
                  {contact.title ? `${contact.title} ` : ''}{contact.first_name || ''} {contact.last_name || ''}
                </h1>
                <StatusBadge status={contact.contact_status || 'donor'} />
                {contact.tax_id && (
                  <span style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace' }}>
                    PAN: {contact.tax_id}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '13px', color: '#64748B', flexWrap: 'wrap' }}>
                <span>🆔 <strong>Contact ID:</strong> <code>{contact.id}</code></span>
                <span>📧 {contact.email || 'No email'}</span>
                <span>📱 {contact.phone || contact.mobile || 'No mobile'}</span>
                <span>📍 {contact.city || 'City'}, {contact.state || 'State'} {contact.zip_code || ''}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => {
                setCommChannel('whatsapp');
                setIsSendCommModalOpen(true);
              }}
              style={{ background: '#25D366', color: '#FFFFFF', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>💬</span>
              <span>Send WhatsApp</span>
            </button>
            <button 
              onClick={() => {
                setCommChannel('email');
                setIsSendCommModalOpen(true);
              }}
              style={{ background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>✉️</span>
              <span>Send Email</span>
            </button>
            <button 
              onClick={() => setIsAddMonthlyModalOpen(true)}
              style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>🔄</span>
              <span>Add Monthly Donation</span>
            </button>
            <button 
              onClick={() => setIsEditModalOpen(true)}
              style={{ background: '#FFFFFF', border: '1.5px solid #CBD5E1', color: '#334155', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>✏️</span>
              <span>Edit Contact</span>
            </button>
          </div>
        </div>

        {/* Lifetime Giving KPI Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          <div style={{ background: '#ECFDF5', padding: '12px 14px', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#047857', fontWeight: 700 }}>Total Paid Amount</span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#065F46', marginTop: '2px' }}>₹{Number(contact.total_paid_amount || summary.total_donated || 0).toLocaleString()}</div>
          </div>
          <div style={{ background: '#EFF6FF', padding: '12px 14px', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#1D4ED8', fontWeight: 700 }}>Total Gift Count (Paid)</span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1E40AF', marginTop: '2px' }}>{contact.total_gift_count_paid || summary.gift_count || 0} Tx(s)</div>
          </div>
          <div style={{ background: '#FDF4FF', padding: '12px 14px', borderRadius: '8px', border: '1px solid #F5D0FE' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#86198F', fontWeight: 700 }}>Monthly Donations</span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#701A75', marginTop: '2px' }}>{monthlyDonations.length} Mandate(s)</div>
          </div>
          <div style={{ background: '#FFFBEB', padding: '12px 14px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#B45309', fontWeight: 700 }}>First Gift Date</span>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#92400E', marginTop: '4px' }}>
              {contact.first_gift_date ? new Date(contact.first_gift_date).toLocaleDateString() : 'N/A'}
            </div>
            <div style={{ fontSize: '11px', color: '#B45309', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contact.first_gift_campaign_title || 'Direct Donation'}
            </div>
          </div>
          <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#475569', fontWeight: 700 }}>Last Gift Date</span>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
              {contact.last_gift_date ? new Date(contact.last_gift_date).toLocaleDateString() : 'N/A'}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contact.last_gift_campaign_title || 'Direct Donation'}
            </div>
          </div>
        </div>

        {/* Multi-NGO & Campaign Summary Pill */}
        {(contact.multi_ngo_names || contact.multi_campaign_titles) && (
          <div style={{ marginTop: '14px', background: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {contact.multi_ngo_names && (
              <div>
                <strong style={{ color: '#475569' }}>NGOs Contributed To:</strong>{' '}
                <span style={{ color: '#059669', fontWeight: 700 }}>{contact.multi_ngo_names}</span>
              </div>
            )}
            {contact.multi_campaign_titles && (
              <div>
                <strong style={{ color: '#475569' }}>Campaigns Contributed To:</strong>{' '}
                <span style={{ color: '#2563EB', fontWeight: 700 }}>{contact.multi_campaign_titles}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Salesforce Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #E2E8F0', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        {tabs.map((tab) => {
          let count = 0;
          if (tab === 'Monthly Donations') count = monthlyDonations.length;
          if (tab === 'Payments') count = payments.length;
          if (tab === 'Payments on Monthly Donation') count = filteredMonthlyPayments.length;
          if (tab === '80G History') count = eightyGReceipts.length;
          if (tab === '10 BD History') count = tenBDHistory.length;
          if (tab === 'Email Communication History') count = emailComms.length;
          if (tab === 'WhatsApp Communication History') count = whatsappComms.length;

          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'Payments on Monthly Donation' && !filterSubscriptionId && monthlyDonations.length > 0) {
                  setFilterSubscriptionId(monthlyDonations[0].id);
                  setSelectedMonthlyDonation(monthlyDonations[0]);
                }
              }}
              style={{
                background: isActive ? '#FFFFFF' : 'transparent',
                border: '1px solid',
                borderColor: isActive ? '#CBD5E1 #CBD5E1 #FFFFFF #CBD5E1' : 'transparent',
                borderTop: isActive ? '3px solid #059669' : '3px solid transparent',
                borderRadius: '8px 8px 0 0',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#059669' : '#64748B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{tab}</span>
              {tab !== 'Overview' && (
                <span style={{ background: isActive ? '#ECFDF5' : '#F1F5F9', color: isActive ? '#059669' : '#64748B', padding: '2px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW (Contact Object Details & KYC) */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
          
          {/* Left Column: Identity & KYC */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, letterSpacing: '0.5px' }}>
                👤 Contact Identity & Statutory Details
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Contact ID</span>
                  <code style={{ background: '#F1F5F9', padding: '3px 6px', borderRadius: '4px', fontWeight: 600 }}>{contact.id}</code>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Title & Full Name</span>
                  <strong style={{ color: '#0F172A' }}>{contact.title || ''} {contact.first_name || ''} {contact.last_name || ''}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Mobile (Only numbers)</span>
                  <span style={{ fontWeight: 600 }}>{contact.phone || contact.mobile || '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Email</span>
                  <span style={{ fontWeight: 600 }}>{contact.email || '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Date of Birth (Calendar)</span>
                  <span>{contact.birthdate || contact.date_of_birth ? new Date(contact.birthdate || contact.date_of_birth!).toLocaleDateString() : '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Permanent Account Number (PAN)</span>
                  <code style={{ background: '#ECFDF5', color: '#065F46', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                    {contact.tax_id || contact.pan_number || 'Not Provided'}
                  </code>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Contact Status</span>
                  <StatusBadge status={contact.contact_status || 'donor'} />
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Parent Organization</span>
                  <span>{contact.organization_name || 'Primary NGO'}</span>
                </div>
              </div>
            </div>

            {/* Address & Postal Details */}
            <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, letterSpacing: '0.5px' }}>
                🏠 Address & Postal Records
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Street Address 1</span>
                  <span>{contact.street_address_1 || contact.address_line_1 || contact.address || '—'}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Street Address 2 (Landmark)</span>
                  <span>{contact.street_address_2 || contact.address_line_2 || '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>City (with ZIP API)</span>
                  <span>{contact.city || '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>State (with ZIP API)</span>
                  <span>{contact.state || '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>ZIP Code (PIN Code)</span>
                  <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>{contact.zip_code || contact.pincode || '—'}</code>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Country</span>
                  <span>{contact.country || 'India'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Lifetime Giving Rollups */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, letterSpacing: '0.5px' }}>
                📊 Lifetime Giving Statistics
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: '#64748B' }}>Total Monthly Donation (Count)</span>
                  <strong>{contact.total_monthly_donations || monthlyDonations.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: '#64748B' }}>Total One-time Donation (Count)</span>
                  <strong>{contact.total_onetime_donations || payments.filter(p => p.payment_type === 'one_time').length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: '#64748B' }}>Total Paid Amount (Value)</span>
                  <strong style={{ color: '#059669', fontSize: '15px' }}>₹{Number(contact.total_paid_amount || summary.total_donated || 0).toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: '#64748B' }}>Total Gift Count (Paid)</span>
                  <strong>{contact.total_gift_count_paid || summary.gift_count || 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: '#64748B' }}>Last Gift Amount (Paid)</span>
                  <strong>₹{Number(contact.last_gift_amount_paid || (payments[0]?.amount || 0)).toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: '#64748B' }}>First Gift Date</span>
                  <span>{contact.first_gift_date ? new Date(contact.first_gift_date).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: '#64748B' }}>First Gift Campaign</span>
                  <span style={{ color: '#2563EB', fontWeight: 600 }}>{contact.first_gift_campaign_title || 'Direct Web Giving'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: '#64748B' }}>Last Gift Date</span>
                  <span>{contact.last_gift_date ? new Date(contact.last_gift_date).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Last Gift Campaign</span>
                  <span style={{ color: '#2563EB', fontWeight: 600 }}>{contact.last_gift_campaign_title || 'Direct Web Giving'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MONTHLY DONATION OBJECT */}
      {activeTab === 'Monthly Donations' && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Monthly Donation Objects ({monthlyDonations.length})</h3>
            <button 
              onClick={() => setIsAddMonthlyModalOpen(true)}
              style={{ background: '#059669', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              ➕ Create Monthly Donation
            </button>
          </div>
          
          {monthlyDonations.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No recurring monthly donations registered for this contact yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '10px 14px' }}>Monthly Donation ID</th>
                    <th style={{ padding: '10px 14px' }}>Signup Campaign</th>
                    <th style={{ padding: '10px 14px' }}>Amount</th>
                    <th style={{ padding: '10px 14px' }}>Signup Date</th>
                    <th style={{ padding: '10px 14px' }}>Paid / Attempted</th>
                    <th style={{ padding: '10px 14px' }}>Gateway & Method</th>
                    <th style={{ padding: '10px 14px' }}>Bank Name</th>
                    <th style={{ padding: '10px 14px' }}>Next Due Date</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Helpdesk Ticket</th>
                    <th style={{ padding: '10px 14px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyDonations.map((sub) => (
                    <tr key={sub.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <a 
                          href={`#monthly-donation=${sub.id}`} 
                          onClick={(e) => { e.preventDefault(); handleDrilldownMonthlyPayments(sub); }}
                          style={{ color: '#059669', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'monospace' }}
                        >
                          {sub.monthly_donation_id || sub.id.substring(0, 8)}
                        </a>
                      </td>
                      <td style={{ padding: '12px 14px' }}>{sub.signup_campaign_title || sub.campaign_title || 'General Fund'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ color: '#059669', fontSize: '13px' }}>₹{Number(sub.amount).toLocaleString()}</strong>
                        {sub.value_upgrade && (
                          <span style={{ display: 'block', fontSize: '10px', color: '#047857' }}>⬆ Upgraded</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>{sub.signup_date ? new Date(sub.signup_date).toLocaleDateString() : 'N/A'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ color: '#059669' }}>{sub.total_paid_installments || 0}</strong> / {sub.total_installments_attempted || 0}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          {sub.payment_gateway?.toUpperCase()} ({sub.payment_method?.toUpperCase()})
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>{sub.bank_name || sub.mandate_bank_name || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>{sub.next_payment_due_date ? new Date(sub.next_payment_due_date).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={sub.status} />
                        {sub.paused && <span style={{ display: 'block', fontSize: '10px', color: '#B45309' }}>Paused ({sub.paused_period || 0}m)</span>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {sub.helpdesk_ticket_id ? (
                          <div>
                            <code>{sub.helpdesk_ticket_id}</code>
                            <span style={{ display: 'block', fontSize: '10px', color: '#64748B' }}>{sub.helpdesk_status || 'Open'}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            onClick={() => handleDrilldownMonthlyPayments(sub)}
                            style={{ padding: '4px 8px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            title="View Payments on this Monthly Donation"
                          >
                            💳 Payments
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedMonthlyDonation(sub);
                              setIsManageMonthlyModalOpen(true);
                            }}
                            style={{ padding: '4px 8px', background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            ⚙️ Modify
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENT OBJECT (All Transactions) */}
      {activeTab === 'Payments' && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Payment Objects ({payments.length})</h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Includes all One-time & Monthly Installments</span>
          </div>

          {payments.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No payments logged for this contact yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '10px 14px' }}>Payment Date</th>
                    <th style={{ padding: '10px 14px' }}>Amount</th>
                    <th style={{ padding: '10px 14px' }}>Payment Type</th>
                    <th style={{ padding: '10px 14px' }}>Monthly Donation Hyperlink</th>
                    <th style={{ padding: '10px 14px' }}>Contact Hyperlink</th>
                    <th style={{ padding: '10px 14px' }}>Payment Campaign</th>
                    <th style={{ padding: '10px 14px' }}>PAN Card</th>
                    <th style={{ padding: '10px 14px' }}>Gateway & Method</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>80G Email</th>
                    <th style={{ padding: '10px 14px' }}>80G WhatsApp</th>
                    <th style={{ padding: '10px 14px' }}>80G PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const isSuccess = p.status === 'completed' || p.status === 'paid' || p.status === 'success';
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <strong>{p.created_at || p.payment_date ? new Date(p.created_at || p.payment_date!).toLocaleDateString() : '—'}</strong>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748B' }}>
                            {p.created_at ? new Date(p.created_at).toLocaleTimeString() : ''}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <strong style={{ color: isSuccess ? '#059669' : '#DC2626', fontSize: '13px' }}>
                            ₹{Number(p.amount).toLocaleString()}
                          </strong>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: p.payment_type === 'monthly_donation' ? '#FDF4FF' : '#EFF6FF', color: p.payment_type === 'monthly_donation' ? '#86198F' : '#1D4ED8', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            {p.payment_type === 'monthly_donation' ? 'Monthly Donation' : 'One-time Donation'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {p.subscription_id ? (
                            <a 
                              href={`#monthly-donation=${p.subscription_id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                setFilterSubscriptionId(p.subscription_id!);
                                setActiveTab('Payments on Monthly Donation');
                              }}
                              style={{ color: '#059669', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'monospace' }}
                            >
                              MD-{p.subscription_id.substring(0, 6)}
                            </a>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <a 
                            href={`#contact=${contact.id}`}
                            onClick={(e) => { e.preventDefault(); setActiveTab('Overview'); }}
                            style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            {contact.first_name || contact.name || 'Contact Profile'}
                          </a>
                        </td>
                        <td style={{ padding: '12px 14px' }}>{p.payment_campaign_title || p.campaign_title || 'General Fund'}</td>
                        <td style={{ padding: '12px 14px' }}>
                          {p.pan_card ? (
                            <span style={{ color: '#059669', fontWeight: 700 }}>✅ Yes</span>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>❌ No</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {p.payment_gateway?.toUpperCase()} ({p.payment_method?.toUpperCase()})
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <StatusBadge status={p.status} />
                          {p.failure_reason && (
                            <span style={{ display: 'block', fontSize: '10px', color: '#DC2626', maxWidth: '140px' }}>
                              {p.failure_reason}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {p.eighty_g_sent_email ? '✅' : '❌'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {p.eighty_g_sent_whatsapp ? '✅' : '❌'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {isSuccess && (
                            <a 
                              href={p.receipt_pdf_url || `/api/compliance/receipts/${p.id}`} 
                              target="_blank" 
                              rel="noreferrer"
                              style={{ color: '#2563EB', fontWeight: 700, textDecoration: 'underline' }}
                            >
                              📄 {p.receipt_number || 'PDF'}
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PAYMENTS ON MONTHLY DONATION HYPERLINK */}
      {activeTab === 'Payments on Monthly Donation' && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                💳 Payments on Monthly Donation Hyperlink
              </h3>
              <span style={{ fontSize: '12px', color: '#64748B' }}>
                Filtered Installment Payments for Mandate: <code>{filterSubscriptionId ? filterSubscriptionId : 'All Subscriptions'}</code>
              </span>
            </div>
            {filterSubscriptionId && (
              <button 
                onClick={() => setFilterSubscriptionId(null)}
                style={{ padding: '4px 10px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
              >
                Clear Mandate Filter
              </button>
            )}
          </div>

          {filteredMonthlyPayments.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No monthly installment payments found for this mandate filter.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '10px 14px' }}>Installment Date</th>
                    <th style={{ padding: '10px 14px' }}>Amount</th>
                    <th style={{ padding: '10px 14px' }}>Monthly Donation Hyperlink</th>
                    <th style={{ padding: '10px 14px' }}>Gateway & Method</th>
                    <th style={{ padding: '10px 14px' }}>Transaction ID</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>80G Sent Email</th>
                    <th style={{ padding: '10px 14px' }}>80G Sent WhatsApp</th>
                    <th style={{ padding: '10px 14px' }}>80G Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMonthlyPayments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <strong>{new Date(p.created_at || p.payment_date!).toLocaleDateString()}</strong>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ color: '#059669', fontSize: '13px' }}>₹{Number(p.amount).toLocaleString()}</strong>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ color: '#059669', fontWeight: 700, fontFamily: 'monospace' }}>
                          MD-{(p.subscription_id || filterSubscriptionId || '').substring(0, 6)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          {p.payment_gateway?.toUpperCase()} ({p.payment_method?.toUpperCase()})
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <code>{p.gateway_transaction_id || p.id.substring(0, 10)}</code>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={p.status} />
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {p.eighty_g_sent_email ? '✅' : '❌'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {p.eighty_g_sent_whatsapp ? '✅' : '❌'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <a 
                          href={p.receipt_pdf_url || `/api/compliance/receipts/${p.id}`} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ color: '#2563EB', fontWeight: 700, textDecoration: 'underline' }}
                        >
                          📄 {p.receipt_number || 'Download 80G'}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: 80G HISTORY */}
      {activeTab === '80G History' && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>80G Tax Exemption Certificates ({eightyGReceipts.length})</h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Section 80G(5) Statutory Tax Certificates</span>
          </div>

          {eightyGReceipts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No 80G tax receipts issued to this contact yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '10px 14px' }}>Receipt Number</th>
                    <th style={{ padding: '10px 14px' }}>Financial Year</th>
                    <th style={{ padding: '10px 14px' }}>Donation Date</th>
                    <th style={{ padding: '10px 14px' }}>Amount</th>
                    <th style={{ padding: '10px 14px' }}>Donor PAN Snapshot</th>
                    <th style={{ padding: '10px 14px' }}>Email Sent Status</th>
                    <th style={{ padding: '10px 14px' }}>WhatsApp Sent Status</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Download</th>
                  </tr>
                </thead>
                <tbody>
                  {eightyGReceipts.map((rec) => (
                    <tr key={rec.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ fontFamily: 'monospace', color: '#0F172A' }}>{rec.receipt_number}</strong>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          {rec.financial_year || rec.fy}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>{new Date(rec.donation_date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ color: '#059669', fontSize: '13px' }}>₹{Number(rec.amount).toLocaleString()}</strong>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <code>{rec.donor_pan_snapshot || rec.donor_pan || 'PAN_PENDING'}</code>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={rec.email_delivery_status || rec.email_status || 'delivered'} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={rec.whatsapp_delivery_status || rec.whatsapp_status || 'delivered'} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {rec.voided || rec.is_voided ? (
                          <span style={{ color: '#DC2626', fontWeight: 700 }}>⛔ Voided</span>
                        ) : (
                          <span style={{ color: '#059669', fontWeight: 700 }}>✅ Valid</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <a 
                          href={rec.pdf_url || `/api/compliance/receipts/${rec.payment_id || rec.donation_id || rec.id}`} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '4px 10px', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}
                        >
                          📥 PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: 10 BD HISTORY */}
      {activeTab === '10 BD History' && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Form 10BD Statutory Tax History</h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Annual Return of Donations filed with Income Tax Department</span>
          </div>

          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: '#ECFDF5', padding: '14px', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#047857', fontWeight: 700 }}>PAN Compliance Status</span>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#065F46', marginTop: '4px' }}>
                  {contact.tax_id ? '✅ 100% Compliant (PAN Linked)' : '⚠️ PAN Missing (Excluded from 10BD)'}
                </div>
              </div>
              <div style={{ background: '#EFF6FF', padding: '14px', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#1D4ED8', fontWeight: 700 }}>Eligible 80G Contribution</span>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#1E40AF', marginTop: '4px' }}>
                  ₹{Number(contact.total_paid_amount || 0).toLocaleString()}
                </div>
              </div>
              <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#475569', fontWeight: 700 }}>Latest Filing Status</span>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
                  {tenBDHistory[0]?.filing_status?.toUpperCase() || 'DRAFT READY'}
                </div>
              </div>
            </div>

            {tenBDHistory.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '10px 14px' }}>Financial Year</th>
                    <th style={{ padding: '10px 14px' }}>Records Count</th>
                    <th style={{ padding: '10px 14px' }}>Total Amount</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Export File</th>
                  </tr>
                </thead>
                <tbody>
                  {tenBDHistory.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 14px' }}><strong>{item.financial_year || item.fy}</strong></td>
                      <td style={{ padding: '12px 14px' }}>{item.record_count} Donors</td>
                      <td style={{ padding: '12px 14px' }}><strong style={{ color: '#059669' }}>₹{Number(item.total_amount).toLocaleString()}</strong></td>
                      <td style={{ padding: '12px 14px' }}><StatusBadge status={item.filing_status || item.status || 'draft'} /></td>
                      <td style={{ padding: '12px 14px' }}>
                        <a href="/api/compliance/export/10bd" target="_blank" rel="noreferrer" style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'underline' }}>
                          📥 Download CSV
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: EMAIL COMMUNICATION HISTORY */}
      {activeTab === 'Email Communication History' && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Email Communications History ({emailComms.length})</h3>
            <button 
              onClick={() => {
                setCommChannel('email');
                setIsSendCommModalOpen(true);
              }}
              style={{ background: '#2563EB', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              ✉️ Send Ad-hoc Email
            </button>
          </div>

          {emailComms.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No email communications sent to this contact yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '10px 14px' }}>Sent Date</th>
                    <th style={{ padding: '10px 14px' }}>Subject Line</th>
                    <th style={{ padding: '10px 14px' }}>Trigger / Type</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Message ID</th>
                  </tr>
                </thead>
                <tbody>
                  {emailComms.map((em) => (
                    <tr key={em.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <strong>{new Date(em.sent_at || em.created_at || em.date!).toLocaleDateString()}</strong>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748B' }}>
                          {new Date(em.sent_at || em.created_at || em.date!).toLocaleTimeString()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ color: '#0F172A' }}>{em.subject_line || em.subject || 'Thank You for Supporting'}</strong>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          {em.communication_type || em.trigger_type || 'donation_success'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={em.status || 'delivered'} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <code style={{ fontSize: '11px' }}>{em.ses_message_id ? em.ses_message_id.substring(0, 16) + '...' : 'ses_msg_direct'}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 8: WHATSAPP COMMUNICATION HISTORY */}
      {activeTab === 'WhatsApp Communication History' && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>WhatsApp Communications History ({whatsappComms.length})</h3>
            <button 
              onClick={() => {
                setCommChannel('whatsapp');
                setIsSendCommModalOpen(true);
              }}
              style={{ background: '#25D366', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              💬 Send Ad-hoc WhatsApp
            </button>
          </div>

          {whatsappComms.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No WhatsApp messages dispatched to this contact yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '10px 14px' }}>Dispatched Date</th>
                    <th style={{ padding: '10px 14px' }}>Recipient Number</th>
                    <th style={{ padding: '10px 14px' }}>Template Name</th>
                    <th style={{ padding: '10px 14px' }}>Trigger / Type</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Meta Message ID</th>
                  </tr>
                </thead>
                <tbody>
                  {whatsappComms.map((wa) => (
                    <tr key={wa.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <strong>{new Date(wa.sent_at || wa.created_at || wa.date!).toLocaleDateString()}</strong>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748B' }}>
                          {new Date(wa.sent_at || wa.created_at || wa.date!).toLocaleTimeString()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <strong>{wa.recipient_number || wa.recipient_phone || contact.phone || '—'}</strong>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <code style={{ background: '#ECFDF5', color: '#065F46', padding: '2px 6px', borderRadius: '4px' }}>
                          {wa.template_name || wa.message_template || 'donation_success_alert'}
                        </code>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          {wa.communication_type || wa.trigger_type || 'instant_80g_alert'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={wa.status || 'delivered'} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <code style={{ fontSize: '11px' }}>{wa.meta_message_id ? wa.meta_message_id.substring(0, 16) + '...' : 'wamid.HBgM...'}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: EDIT CONTACT */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Salesforce Contact Record">
        <form onSubmit={handleSaveContact} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 1.2fr 1.2fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Title</label>
              <select 
                value={editForm.title} 
                onChange={e => setEditForm({...editForm, title: e.target.value})}
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
                value={editForm.first_name} 
                onChange={e => setEditForm({...editForm, first_name: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Last Name</label>
              <input 
                type="text" 
                value={editForm.last_name} 
                onChange={e => setEditForm({...editForm, last_name: e.target.value})} 
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
                value={editForm.email} 
                onChange={e => setEditForm({...editForm, email: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Mobile (Only numbers)</label>
              <input 
                type="tel" 
                value={editForm.phone} 
                onChange={e => setEditForm({...editForm, phone: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Date of Birth (Calendar)</label>
              <input 
                type="date" 
                value={editForm.birthdate} 
                onChange={e => setEditForm({...editForm, birthdate: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>PAN Number (PAN format)</label>
              <input 
                type="text" 
                maxLength={10}
                placeholder="ABCDE1234F"
                value={editForm.tax_id} 
                onChange={e => setEditForm({...editForm, tax_id: e.target.value.toUpperCase()})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontFamily: 'monospace', textTransform: 'uppercase' }} 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Street Address 1</label>
            <input 
              type="text" 
              value={editForm.street_address_1} 
              onChange={e => setEditForm({...editForm, street_address_1: e.target.value})} 
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Street Address 2 (Landmark)</label>
            <input 
              type="text" 
              value={editForm.street_address_2} 
              onChange={e => setEditForm({...editForm, street_address_2: e.target.value})} 
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>ZIP Code (PIN Code)</label>
              <input 
                type="text" 
                maxLength={6}
                value={editForm.zip_code} 
                onChange={e => handlePincodeChange(e.target.value)} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>City</label>
              <input 
                type="text" 
                value={editForm.city} 
                onChange={e => setEditForm({...editForm, city: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>State</label>
              <input 
                type="text" 
                value={editForm.state} 
                onChange={e => setEditForm({...editForm, state: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button 
              type="button" 
              onClick={() => setIsEditModalOpen(false)} 
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

      {/* MODAL: ADD MONTHLY DONATION */}
      <Modal isOpen={isAddMonthlyModalOpen} onClose={() => setIsAddMonthlyModalOpen(false)} title="Register Monthly Donation Mandate">
        <form onSubmit={handleCreateMonthlyDonation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Recurring Amount (₹)</label>
              <input 
                type="number" 
                required
                value={monthlyForm.amount} 
                onChange={e => setMonthlyForm({...monthlyForm, amount: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Payment Gateway</label>
              <select 
                value={monthlyForm.payment_gateway} 
                onChange={e => setMonthlyForm({...monthlyForm, payment_gateway: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: 'white' }}
              >
                <option value="razorpay">RAZORPAY</option>
                <option value="payu">PAYU</option>
                <option value="ccavenue">CC AVENUE</option>
                <option value="worldline">WORLDLINE</option>
                <option value="cashfree">CASHFREE</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Payment Method</label>
              <select 
                value={monthlyForm.payment_method} 
                onChange={e => setMonthlyForm({...monthlyForm, payment_method: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: 'white' }}
              >
                <option value="upi_autopay">UPI AUTOPAY</option>
                <option value="enach">ENACH</option>
                <option value="card">CARD AUTOPAY</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Bank Name</label>
              <input 
                type="text" 
                placeholder="HDFC Bank, ICICI Bank, SBI..." 
                value={monthlyForm.bank_name} 
                onChange={e => setMonthlyForm({...monthlyForm, bank_name: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Signup Date (Calendar)</label>
              <input 
                type="date" 
                value={monthlyForm.signup_date} 
                onChange={e => setMonthlyForm({...monthlyForm, signup_date: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Next Payment Due Date</label>
              <input 
                type="date" 
                value={monthlyForm.next_payment_due_date} 
                onChange={e => setMonthlyForm({...monthlyForm, next_payment_due_date: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button 
              type="button" 
              onClick={() => setIsAddMonthlyModalOpen(false)} 
              style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: 'white', borderRadius: '6px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              style={{ padding: '8px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Register Mandate
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: MANAGE MONTHLY DONATION (Pause / Upgrade / Cancel) */}
      {selectedMonthlyDonation && (
        <Modal isOpen={isManageMonthlyModalOpen} onClose={() => setIsManageMonthlyModalOpen(false)} title={`Manage Mandate: ${selectedMonthlyDonation.id.substring(0, 8)}`}>
          <form onSubmit={handleManageMonthlyDonation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Select Action</label>
              <select 
                value={manageForm.action} 
                onChange={e => setManageForm({...manageForm, action: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: 'white', fontWeight: 700 }}
              >
                <option value="pause">⏸️ Pause Monthly Donation</option>
                <option value="resume">▶️ Resume / Save Mandate (Active)</option>
                <option value="upgrade">⬆️ Upgrade Recurring Value</option>
                <option value="downgrade">⬇️ Downgrade Recurring Value</option>
                <option value="cancel">🛑 Cancel Mandate</option>
              </select>
            </div>

            {manageForm.action === 'pause' && (
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Pause Period (Number in months)</label>
                <input 
                  type="number" 
                  value={manageForm.paused_period} 
                  onChange={e => setManageForm({...manageForm, paused_period: e.target.value})} 
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
                />
              </div>
            )}

            {manageForm.action === 'upgrade' && (
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Upgraded Value (₹/month)</label>
                <input 
                  type="number" 
                  value={manageForm.upgraded_value} 
                  onChange={e => setManageForm({...manageForm, upgraded_value: e.target.value})} 
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
                />
              </div>
            )}

            {manageForm.action === 'downgrade' && (
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>New Reduced Value (₹/month)</label>
                <input 
                  type="number" 
                  value={manageForm.amount} 
                  onChange={e => setManageForm({...manageForm, amount: e.target.value})} 
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
                />
              </div>
            )}

            {manageForm.action === 'cancel' && (
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Cancellation Reason (Free text)</label>
                <input 
                  type="text" 
                  value={manageForm.end_reason} 
                  onChange={e => setManageForm({...manageForm, end_reason: e.target.value})} 
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Helpdesk Ticket ID (Unique system generated ID)</label>
              <input 
                type="text" 
                placeholder="HD-109281"
                value={manageForm.helpdesk_ticket_id} 
                onChange={e => setManageForm({...manageForm, helpdesk_ticket_id: e.target.value})} 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button 
                type="button" 
                onClick={() => setIsManageMonthlyModalOpen(false)} 
                style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: 'white', borderRadius: '6px', cursor: 'pointer' }}
              >
                Close
              </button>
              <button 
                type="submit" 
                style={{ padding: '8px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Execute Action
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: DISPATCH COMMUNICATION */}
      <Modal isOpen={isSendCommModalOpen} onClose={() => setIsSendCommModalOpen(false)} title={`Dispatch ${commChannel === 'whatsapp' ? 'WhatsApp' : 'Email'} to ${contact.first_name || contact.name}`}>
        <form onSubmit={handleSendCommunication} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Recipient</label>
            <input 
              type="text" 
              disabled 
              value={commChannel === 'whatsapp' ? (contact.phone || contact.mobile || '') : (contact.email || '')} 
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#F8FAFC' }} 
            />
          </div>

          {commChannel === 'email' ? (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Subject Line</label>
                <input 
                  type="text" 
                  required
                  value={commForm.subject} 
                  onChange={e => setCommForm({...commForm, subject: e.target.value})} 
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Email Body (HTML / Text)</label>
                <textarea 
                  rows={5}
                  value={commForm.message} 
                  onChange={e => setCommForm({...commForm, message: e.target.value})} 
                  placeholder="Dear Supporter, thank you for being a part of our mission..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontFamily: 'sans-serif' }} 
                />
              </div>
            </>
          ) : (
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>WhatsApp Message Content</label>
              <textarea 
                rows={4}
                value={commForm.message} 
                onChange={e => setCommForm({...commForm, message: e.target.value})} 
                placeholder="Dear donor, thank you for your generous contribution..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontFamily: 'sans-serif' }} 
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button 
              type="button" 
              onClick={() => setIsSendCommModalOpen(false)} 
              style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: 'white', borderRadius: '6px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              style={{ padding: '8px 20px', background: commChannel === 'whatsapp' ? '#25D366' : '#2563EB', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Send Message
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
