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
  const [activeTab, setActiveTab] = useState<
    'Details' | 'Monthly Donations' | 'Payments' | '80G History' | '10 BD History' | 'Email History' | 'WhatsApp History' | 'Journeys' | 'Activity Feed' | 'Consent Management'
  >('Details');
  const [loading, setLoading] = useState(true);
  const [selectedMonthlyDonation, setSelectedMonthlyDonation] = useState<MonthlyDonation | null>(null);

  // Activity Timeline & Notes
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [availableJourneys, setAvailableJourneys] = useState<any[]>([]);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddMonthlyModalOpen, setIsAddMonthlyModalOpen] = useState(false);
  const [isManageMonthlyModalOpen, setIsManageMonthlyModalOpen] = useState(false);
  const [isSendCommModalOpen, setIsSendCommModalOpen] = useState(false);
  const [isOfflineDonationModalOpen, setIsOfflineDonationModalOpen] = useState(false);
  const [isEnrollJourneyModalOpen, setIsEnrollJourneyModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [commChannel, setCommChannel] = useState<'email' | 'whatsapp'>('email');

  // Forms
  const [editForm, setEditForm] = useState<any>({});
  const [pinLookupStatus, setPinLookupStatus] = useState<{ loading: boolean; success: boolean; text?: string }>({ loading: false, success: false });

  const [monthlyForm, setMonthlyForm] = useState<any>({
    amount: '',
    payment_gateway: 'RAZORPAY',
    payment_method: 'UPI AUTOPAY',
    bank_name: '',
    signup_date: new Date().toISOString().split('T')[0],
    next_payment_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const [manageForm, setManageForm] = useState<any>({
    action: 'pause',
    paused_period: 3,
    upgraded_value: '',
    amount: '',
    end_reason: '',
    helpdesk_ticket_id: ''
  });

  const [commForm, setCommForm] = useState<any>({
    subject: '',
    message: '',
    template_name: ''
  });

  const [offlineForm, setOfflineForm] = useState<any>({
    amount: '',
    payment_method: 'CHEQUE',
    payment_date: new Date().toISOString().split('T')[0],
    gateway_transaction_id: '',
    generate_receipt: true,
    notes: ''
  });

  const [noteForm, setNoteForm] = useState<any>({
    title: '',
    content: '',
    note_type: 'general_note'
  });

  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');

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

  const fetchTimeline = async () => {
    setLoadingTimeline(true);
    try {
      const res = await apiFetch(`/api/contacts/${contactId}/timeline`);
      if (res && res.success) {
        setTimeline(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const fetchJourneys = async () => {
    try {
      const res = await apiFetch('/api/journeys');
      if (res && res.success && Array.isArray(res.data)) {
        setAvailableJourneys(res.data);
        if (res.data.length > 0) setSelectedJourneyId(res.data[0].id);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (contactId) {
      fetchContact();
      fetchTimeline();
      fetchJourneys();
    }
  }, [contactId]);

  // Handle PIN Code auto-fill
  const handlePincodeChange = async (pincode: string) => {
    setEditForm((prev: any) => ({ ...prev, zip_code: pincode }));
    const trimmed = pincode.trim();
    if (trimmed.length === 6 && /^\d{6}$/.test(trimmed)) {
      setPinLookupStatus({ loading: true, success: false });
      try {
        const res = await apiFetch(`/api/contacts/pincode/${trimmed}`);
        if (res && res.success && res.data) {
          setEditForm((prev: any) => ({
            ...prev,
            city: res.data.city || prev.city,
            state: res.data.state || prev.state,
            country: res.data.country || 'India'
          }));
          setPinLookupStatus({
            loading: false,
            success: true,
            text: `📍 ${res.data.city || 'Verified'}, ${res.data.state || 'India'}`
          });
          return;
        }
      } catch (e) {}
      setPinLookupStatus({ loading: false, success: false, text: 'Custom PIN' });
    } else {
      setPinLookupStatus({ loading: false, success: false });
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res && res.success) {
        setIsEditModalOpen(false);
        fetchContact();
        fetchTimeline();
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(monthlyForm)
      });
      if (res && res.success) {
        setIsAddMonthlyModalOpen(false);
        fetchContact();
        fetchTimeline();
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manageForm)
      });
      if (res && res.success) {
        setIsManageMonthlyModalOpen(false);
        fetchContact();
        fetchTimeline();
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
        headers: { 'Content-Type': 'application/json' },
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
        setCommForm({ subject: 'Thank you for your generous contribution', message: '', template_name: 'donation_thank_you_80g' });
        fetchContact();
        fetchTimeline();
      }
    } catch (err) {
      console.error('Failed to send communication:', err);
    }
  };

  const handleCreateOfflineDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/contacts/${contactId}/offline-donation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offlineForm)
      });
      if (res && res.success) {
        setIsOfflineDonationModalOpen(false);
        setOfflineForm({
          amount: 5000,
          payment_method: 'CHEQUE',
          payment_date: new Date().toISOString().split('T')[0],
          gateway_transaction_id: '',
          generate_receipt: true,
          notes: ''
        });
        fetchContact();
        fetchTimeline();
      }
    } catch (err) {
      console.error('Offline donation error:', err);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/contacts/${contactId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteForm)
      });
      if (res && res.success) {
        setIsNoteModalOpen(false);
        setNoteForm({ title: '', content: '', note_type: 'general_note' });
        fetchContact();
        fetchTimeline();
      }
    } catch (err) {
      console.error('Note error:', err);
    }
  };

  const handleEnrollJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJourneyId) return;
    try {
      const res = await apiFetch(`/api/contacts/${contactId}/enroll-journey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journey_id: selectedJourneyId })
      });
      if (res && res.success) {
        setIsEnrollJourneyModalOpen(false);
        fetchContact();
        fetchTimeline();
      }
    } catch (err) {
      console.error('Journey enroll error:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#706E6B', fontSize: '13px' }}>
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔄</div>
        Loading   360 record page...
      </div>
    );
  }

  if (!contact) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <h3>Contact Record Not Found</h3>
        {onBack && (
          <button onClick={onBack} style={{ padding: '8px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
            &larr; Back to Contacts List
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
  const journeys = contact.journeys || [];
  const notes = contact.notes || [];
  const consents = contact.consents || [];
  const summary = contact.summary || {};

  const totalPaid = Number(contact.total_paid_amount || summary.total_donated || 0);
  const donorTier = contact.donor_tier || summary.donor_tier || 'Bronze';
  const lifecycleStage = contact.donor_lifecycle_stage || summary.donor_lifecycle_stage || 'lead';

  const tabs: Array<'Details' | 'Monthly Donations' | 'Payments' | '80G History' | '10 BD History' | 'Email History' | 'WhatsApp History' | 'Journeys' | 'Activity Feed' | 'Consent Management'> = [
    'Details',
    'Monthly Donations',
    'Payments',
    '80G History',
    '10 BD History',
    'Email History',
    'WhatsApp History',
    'Journeys',
    'Activity Feed',
    'Consent Management'
  ];

  // Lifecycle Chevron Stages
  const lifecycleStages = [
    { id: 'lead', label: 'Prospect / Lead' },
    { id: 'first_time', label: 'First-Time Donor' },
    { id: 'active_regular', label: 'Active Regular' },
    { id: 'monthly_retained', label: 'Monthly Retained' },
    { id: 'major_donor', label: 'Major Champion' },
    { id: 'lapsed', label: 'Lapsed' }
  ];

  const currentStageIndex = lifecycleStages.findIndex(s => s.id === lifecycleStage);

  return (
    <div style={{ fontFamily: 'var(--font-sans)', background: '#F8FAFC', minHeight: '100vh', padding: '16px', color: '#0F172A' }}>
      
      {/*   Standard Highlights Panel (Header Card) */}
      <div style={{ background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '16px 20px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* Record Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ 
              width: '44px', 
              height: '44px', 
              borderRadius: '8px', 
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#FFFFFF', 
              fontSize: '22px', 
              fontWeight: 'bold',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)'
            }}>
              👤
            </div>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em' }}>
                Contact 360 &bull; {contact.organization_name || 'Primary NGO'}
              </div>
              <h1 style={{ margin: '1px 0 0 0', fontSize: '22px', fontWeight: 700, color: '#0F172A' }}>
                {contact.title ? `${contact.title} ` : ''}{contact.first_name || ''} {contact.last_name || ''}
              </h1>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                Record ID: <code>{contact.id}</code>
              </div>
            </div>
          </div>

          {/*   Standard Quick Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={() => {
                setCommChannel('whatsapp');
                setIsSendCommModalOpen(true);
              }}
              style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', color: '#059669', padding: '6px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              💬 WhatsApp
            </button>
            <button 
              onClick={() => {
                setCommChannel('email');
                setIsSendCommModalOpen(true);
              }}
              style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', color: '#059669', padding: '6px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              ✉️ Email
            </button>
            <button 
              onClick={() => setIsOfflineDonationModalOpen(true)}
              style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', color: '#059669', padding: '6px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              💳 Log Offline Donation
            </button>
            <button 
              onClick={() => setIsAddMonthlyModalOpen(true)}
              style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', color: '#059669', padding: '6px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              🔄 New Mandate
            </button>
            <button 
              onClick={() => setIsNoteModalOpen(true)}
              style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', color: '#059669', padding: '6px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              📝 Log Note / Call
            </button>
            <button 
              onClick={() => setIsEnrollJourneyModalOpen(true)}
              style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', color: '#7C3AED', padding: '6px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              🚀 Enroll Journey
            </button>
            <button 
              onClick={() => setIsEditModalOpen(true)}
              style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', color: '#059669', padding: '6px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              ✏️ Edit
            </button>
            {onBack && (
              <button 
                onClick={onBack}
                style={{ background: '#059669', border: 'none', color: '#FFFFFF', padding: '6px 16px', borderRadius: '4px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                &larr; Contacts List
              </button>
            )}
          </div>
        </div>

        {/* Highlights Field Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Email</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#059669', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={contact.email || ''}>
              {contact.email || '—'}
            </span>
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Mobile Phone</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={contact.phone || contact.mobile || ''}>
              {contact.phone || contact.mobile || '—'}
            </span>
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>PAN Number</span>
            <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: '#0F172A', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contact.tax_id && contact.tax_id !== 'PAN_PENDING' ? contact.tax_id : <span style={{ color: '#D97706', fontSize: '11px', fontWeight: 600 }}>Missing PAN</span>}
            </span>
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Lifetime Giving</span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#059669', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>₹{totalPaid.toLocaleString()}</span>
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Active Mandates</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#701A75', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {monthlyDonations.filter(m => m.status === 'active').length} Active
            </span>
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Donor Tier</span>
            <span style={{ 
              display: 'inline-block',
              fontSize: '11px', 
              fontWeight: 700, 
              padding: '2px 8px', 
              borderRadius: '4px',
              background: donorTier === 'Platinum' ? '#F3E8FF' : donorTier === 'Gold' ? '#FEF3C7' : donorTier === 'Silver' ? '#F1F5F9' : '#FEF2F2',
              color: donorTier === 'Platinum' ? '#7E22CE' : donorTier === 'Gold' ? '#B45309' : donorTier === 'Silver' ? '#475569' : '#991B1B',
              border: '1px solid rgba(0,0,0,0.08)'
            }}>
              🏆 {donorTier} Tier
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Status</span>
            <StatusBadge status={contact.contact_status || 'donor'} />
          </div>
        </div>

        {/*   Donor Lifecycle Guidance Chevron Path */}
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #DDDBDA' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#706E6B', fontWeight: 700, marginBottom: '6px' }}>
            Donor Lifecycle Stage
          </div>
          <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', border: '1px solid #DDDBDA', background: '#F8FAFC' }}>
            {lifecycleStages.map((stage, idx) => {
              const isCurrent = stage.id === lifecycleStage;
              const isPast = currentStageIndex > idx;
              return (
                <div 
                  key={stage.id} 
                  style={{ 
                    flex: 1, 
                    padding: '8px 10px', 
                    textAlign: 'center', 
                    fontSize: '11.5px', 
                    fontWeight: isCurrent ? 700 : 500,
                    background: isCurrent ? '#059669' : isPast ? '#DCFCE7' : '#F8FAFC',
                    color: isCurrent ? '#FFFFFF' : isPast ? '#166534' : '#64748B',
                    borderRight: idx < lifecycleStages.length - 1 ? '1px solid #DDDBDA' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  {isPast && <span>✓</span>}
                  {isCurrent && <span>📍</span>}
                  <span>{stage.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/*   Standard Navigation Tabs */}
      <div style={{ background: '#FFFFFF', borderRadius: '4px', border: '1px solid #DDDBDA', marginBottom: '12px', boxShadow: '0 2px 2px 0 rgba(0, 0, 0, 0.05)' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #DDDBDA', overflowX: 'auto' }}>
          {tabs.map((tab) => {
            let count = 0;
            if (tab === 'Monthly Donations') count = monthlyDonations.length;
            if (tab === 'Payments') count = payments.length;
            if (tab === '80G History') count = eightyGReceipts.length;
            if (tab === '10 BD History') count = tenBDHistory.length;
            if (tab === 'Email History') count = emailComms.length;
            if (tab === 'WhatsApp History') count = whatsappComms.length;
            if (tab === 'Journeys') count = journeys.length;
            if (tab === 'Activity Feed') count = timeline.length;
            if (tab === 'Consent Management') count = consents.length;

            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: '#FFFFFF',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #059669' : '3px solid transparent',
                  padding: '12px 16px',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#059669' : '#706E6B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{tab}</span>
                {tab !== 'Details' && (
                  <span style={{ background: isActive ? '#E0E5EA' : '#F3F2F2', color: '#181818', padding: '1px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB CONTENT */}
        <div style={{ padding: '20px' }}>
          
          {/* TAB: DETAILS */}
          {activeTab === 'Details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Section 1: Contact Information */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#181818', background: '#FAFAFB', padding: '8px 12px', border: '1px solid #DDDBDA', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>▼</span>
                  <span>Contact Information</span>
                </div>
                <div style={{ border: '1px solid #DDDBDA', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', background: '#FFFFFF' }}>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Contact ID</span>
                    <code>{contact.id}</code>
                  </div>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Title &amp; Full Name</span>
                    <strong>{contact.title ? `${contact.title} ` : ''}{contact.first_name || ''} {contact.last_name || ''}</strong>
                  </div>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Mobile Phone</span>
                    <span>{contact.phone || contact.mobile || '—'}</span>
                  </div>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Email</span>
                    <span style={{ color: '#059669' }}>{contact.email || '—'}</span>
                  </div>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Date of Birth</span>
                    <span>{contact.birthdate || contact.date_of_birth ? new Date(contact.birthdate || contact.date_of_birth!).toLocaleDateString() : '—'}</span>
                  </div>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Permanent Account Number (PAN)</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{contact.tax_id || contact.pan_number || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Parent Organization</span>
                    <span>{contact.organization_name || 'Primary NGO'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Preferred Channel &amp; Language</span>
                    <span>{contact.preferred_channel || 'Both'} &bull; {contact.preferred_language || 'English'}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Address Information */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#181818', background: '#FAFAFB', padding: '8px 12px', border: '1px solid #DDDBDA', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>▼</span>
                  <span>Address Information</span>
                </div>
                <div style={{ border: '1px solid #DDDBDA', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', background: '#FFFFFF' }}>
                  <div style={{ gridColumn: 'span 2', borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Street Address Line 1</span>
                    <span>{contact.street_address_1 || contact.address_line_1 || contact.address || '—'}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2', borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Street Address Line 2</span>
                    <span>{contact.street_address_2 || contact.address_line_2 || '—'}</span>
                  </div>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>City</span>
                    <span>{contact.city || '—'}</span>
                  </div>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>State</span>
                    <span>{contact.state || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>PIN / ZIP Code</span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{contact.zip_code || contact.pincode || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Country</span>
                    <span>{contact.country || 'India'}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Giving Rollups & Analytics */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#181818', background: '#FAFAFB', padding: '8px 12px', border: '1px solid #DDDBDA', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>▼</span>
                  <span>Giving Rollups &amp; Metrics</span>
                </div>
                <div style={{ border: '1px solid #DDDBDA', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '13px', background: '#FFFFFF' }}>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Total Lifetime Paid</span>
                    <strong style={{ color: '#04844B', fontSize: '15px' }}>₹{totalPaid.toLocaleString()}</strong>
                  </div>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Completed Gifts Count</span>
                    <span>{contact.total_gift_count_paid || summary.gift_count || payments.length} gifts</span>
                  </div>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Average Gift Size</span>
                    <strong>₹{Number(summary.average_gift_amount || (payments.length > 0 ? Math.round(totalPaid / payments.length) : 0)).toLocaleString()}</strong>
                  </div>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Largest Gift Amount</span>
                    <span>{summary.largest_gift_amount ? `₹${Number(summary.largest_gift_amount).toLocaleString()}` : '—'}</span>
                  </div>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>First Gift Date</span>
                    <span>{contact.first_gift_date ? new Date(contact.first_gift_date).toLocaleDateString() : '—'}</span>
                  </div>
                  <div style={{ borderBottom: '1px solid #F3F2F2', paddingBottom: '8px' }}>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Last Gift Date</span>
                    <span>{contact.last_gift_date ? new Date(contact.last_gift_date).toLocaleDateString() : '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>NGOs Contributed</span>
                    <span>{contact.multi_ngo_names || 'Primary NGO'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Campaigns Contributed</span>
                    <span>{contact.multi_campaign_titles || 'Direct'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#706E6B', display: 'block', fontSize: '12px' }}>Days Since Last Gift</span>
                    <span>{summary.days_since_last_gift !== undefined && summary.days_since_last_gift !== null ? `${summary.days_since_last_gift} days ago` : '—'}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB: MONTHLY DONATIONS */}
          {activeTab === 'Monthly Donations' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Monthly Donation Mandates ({monthlyDonations.length})</h3>
                <button 
                  onClick={() => setIsAddMonthlyModalOpen(true)}
                  style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '6px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                >
                  ➕ New Mandate
                </button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', border: '1px solid #DDDBDA' }}>
                <thead>
                  <tr style={{ background: '#FAFAFB', borderBottom: '1px solid #DDDBDA', color: '#514F4D', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>Mandate ID</th>
                    <th style={{ padding: '8px 12px' }}>Amount</th>
                    <th style={{ padding: '8px 12px' }}>Gateway</th>
                    <th style={{ padding: '8px 12px' }}>Method</th>
                    <th style={{ padding: '8px 12px' }}>Bank Name</th>
                    <th style={{ padding: '8px 12px' }}>Next Debit Due</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyDonations.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#706E6B' }}>No monthly donation mandates registered.</td>
                    </tr>
                  ) : (
                    monthlyDonations.map((sub, idx) => (
                      <tr key={sub.id} style={{ borderBottom: '1px solid #DDDBDA', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFB' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <code style={{ fontWeight: 700 }}>MD-{sub.id.substring(0, 8)}</code>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#04844B' }}>
                          ₹{Number(sub.amount).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 12px' }}>{sub.payment_gateway || 'RAZORPAY'}</td>
                        <td style={{ padding: '8px 12px' }}>{sub.payment_method || 'UPI AUTOPAY'}</td>
                        <td style={{ padding: '8px 12px' }}>{sub.bank_name || sub.mandate_bank_name || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {sub.next_payment_due_date ? new Date(sub.next_payment_due_date).toLocaleDateString() : 'Active'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <StatusBadge status={sub.status || 'active'} />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <button 
                            onClick={() => {
                              setSelectedMonthlyDonation(sub);
                              setIsManageMonthlyModalOpen(true);
                            }}
                            style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', color: '#059669', padding: '4px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: PAYMENTS */}
          {activeTab === 'Payments' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Payments Ledger ({payments.length})</h3>
                <button 
                  onClick={() => setIsOfflineDonationModalOpen(true)}
                  style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '6px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                >
                  💳 Log Offline Payment
                </button>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', border: '1px solid #DDDBDA' }}>
                <thead>
                  <tr style={{ background: '#FAFAFB', borderBottom: '1px solid #DDDBDA', color: '#514F4D', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>Date</th>
                    <th style={{ padding: '8px 12px' }}>Amount</th>
                    <th style={{ padding: '8px 12px' }}>Type</th>
                    <th style={{ padding: '8px 12px' }}>Gateway &amp; Reference</th>
                    <th style={{ padding: '8px 12px' }}>Method</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                    <th style={{ padding: '8px 12px' }}>80G Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#706E6B' }}>No payment records found.</td>
                    </tr>
                  ) : (
                    payments.map((p, idx) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #DDDBDA', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFB' }}>
                        <td style={{ padding: '8px 12px' }}>
                          {p.created_at || p.payment_date ? new Date(p.created_at || p.payment_date!).toLocaleDateString() : 'N/A'}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#04844B' }}>
                          ₹{Number(p.amount).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {p.subscription_id || p.monthly_donation_id ? `Monthly Mandate` : 'One-time Donation'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span>{p.payment_gateway || 'RAZORPAY'}</span> &bull; <code>{p.gateway_transaction_id || p.id.substring(0, 10)}</code>
                        </td>
                        <td style={{ padding: '8px 12px' }}>{p.payment_method || 'UPI'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ color: p.status === 'completed' || p.status === 'paid' ? '#04844B' : '#C23934', fontWeight: 700 }}>
                            {p.status === 'completed' || p.status === 'paid' ? 'Paid' : p.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {p.receipt_number ? <span style={{ fontWeight: 600 }}>{p.receipt_number}</span> : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: 80G HISTORY */}
          {activeTab === '80G History' && (
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700 }}>80G Statutory Tax Exemption Certificates ({eightyGReceipts.length})</h3>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', border: '1px solid #DDDBDA' }}>
                <thead>
                  <tr style={{ background: '#FAFAFB', borderBottom: '1px solid #DDDBDA', color: '#514F4D', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>Receipt #</th>
                    <th style={{ padding: '8px 12px' }}>FY</th>
                    <th style={{ padding: '8px 12px' }}>Date</th>
                    <th style={{ padding: '8px 12px' }}>Amount</th>
                    <th style={{ padding: '8px 12px' }}>Email Delivery</th>
                    <th style={{ padding: '8px 12px' }}>WhatsApp Delivery</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Download</th>
                  </tr>
                </thead>
                <tbody>
                  {eightyGReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#706E6B' }}>No 80G receipts issued yet.</td>
                    </tr>
                  ) : (
                    eightyGReceipts.map((r, idx) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #DDDBDA', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFB' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{r.receipt_number}</td>
                        <td style={{ padding: '8px 12px' }}>{r.financial_year}</td>
                        <td style={{ padding: '8px 12px' }}>{r.donation_date ? new Date(r.donation_date).toLocaleDateString() : 'N/A'}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#04844B' }}>₹{Number(r.amount).toLocaleString()}</td>
                        <td style={{ padding: '8px 12px' }}>{r.email_delivery_status || 'delivered'}</td>
                        <td style={{ padding: '8px 12px' }}>{r.whatsapp_delivery_status || 'delivered'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <button 
                            onClick={() => window.open(`/api/compliance/receipts/${r.payment_id || r.id}`, '_blank')}
                            style={{ background: 'none', border: 'none', color: '#059669', fontWeight: 600, cursor: 'pointer' }}
                          >
                            PDF 📥
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: 10 BD HISTORY */}
          {activeTab === '10 BD History' && (
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700 }}>Form 10BD History ({tenBDHistory.length})</h3>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', border: '1px solid #DDDBDA' }}>
                <thead>
                  <tr style={{ background: '#FAFAFB', borderBottom: '1px solid #DDDBDA', color: '#514F4D', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>ARN / Ref</th>
                    <th style={{ padding: '8px 12px' }}>Financial Year</th>
                    <th style={{ padding: '8px 12px' }}>Filing Date</th>
                    <th style={{ padding: '8px 12px' }}>Total Amount</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tenBDHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#706E6B' }}>
                        Eligible for upcoming Form 10BD annual return.
                      </td>
                    </tr>
                  ) : (
                    tenBDHistory.map((t, idx) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #DDDBDA', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFB' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{t.acknowledgement_number || `ITD-${t.id.substring(0, 8)}`}</td>
                        <td style={{ padding: '8px 12px' }}>{t.financial_year}</td>
                        <td style={{ padding: '8px 12px' }}>{t.filing_date ? new Date(t.filing_date).toLocaleDateString() : 'N/A'}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#04844B' }}>₹{Number(t.total_amount || totalPaid).toLocaleString()}</td>
                        <td style={{ padding: '8px 12px' }}>Verified</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: EMAIL HISTORY */}
          {activeTab === 'Email History' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Email Communications ({emailComms.length})</h3>
                <button 
                  onClick={() => { setCommChannel('email'); setIsSendCommModalOpen(true); }}
                  style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '6px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                >
                  ✉️ Compose Email
                </button>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', border: '1px solid #DDDBDA' }}>
                <thead>
                  <tr style={{ background: '#FAFAFB', borderBottom: '1px solid #DDDBDA', color: '#514F4D', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>Date</th>
                    <th style={{ padding: '8px 12px' }}>Subject Line</th>
                    <th style={{ padding: '8px 12px' }}>Type</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {emailComms.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#706E6B' }}>No emails sent yet.</td>
                    </tr>
                  ) : (
                    emailComms.map((e, idx) => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #DDDBDA', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFCFF' }}>
                        <td style={{ padding: '8px 12px' }}>{e.sent_at || e.created_at ? new Date(e.sent_at || e.created_at!).toLocaleString() : 'Recent'}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{e.subject_line || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{e.communication_type || 'Event'}</td>
                        <td style={{ padding: '8px 12px' }}>{e.status || 'delivered'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: WHATSAPP HISTORY */}
          {activeTab === 'WhatsApp History' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>WhatsApp Communications ({whatsappComms.length})</h3>
                <button 
                  onClick={() => { setCommChannel('whatsapp'); setIsSendCommModalOpen(true); }}
                  style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '6px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                >
                  💬 Send WhatsApp
                </button>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', border: '1px solid #DDDBDA' }}>
                <thead>
                  <tr style={{ background: '#FAFAFB', borderBottom: '1px solid #DDDBDA', color: '#514F4D', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>Date</th>
                    <th style={{ padding: '8px 12px' }}>Template</th>
                    <th style={{ padding: '8px 12px' }}>Phone Number</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {whatsappComms.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#706E6B' }}>No WhatsApp communications sent yet.</td>
                    </tr>
                  ) : (
                    whatsappComms.map((w, idx) => (
                      <tr key={w.id} style={{ borderBottom: '1px solid #DDDBDA', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFCFF' }}>
                        <td style={{ padding: '8px 12px' }}>{w.sent_at || w.created_at ? new Date(w.sent_at || w.created_at!).toLocaleString() : 'Recent'}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{w.template_name || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{w.recipient_number || contact.phone}</td>
                        <td style={{ padding: '8px 12px' }}>{w.status || 'delivered'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: JOURNEYS */}
          {activeTab === 'Journeys' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Automated Marketing &amp; Retention Journeys ({journeys.length})</h3>
                <button 
                  onClick={() => setIsEnrollJourneyModalOpen(true)}
                  style={{ background: '#7C3AED', color: '#FFFFFF', border: 'none', padding: '6px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                >
                  🚀 Enroll In Journey
                </button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', border: '1px solid #DDDBDA' }}>
                <thead>
                  <tr style={{ background: '#FAFAFB', borderBottom: '1px solid #DDDBDA', color: '#514F4D', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>Journey Name</th>
                    <th style={{ padding: '8px 12px' }}>Entered Date</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                    <th style={{ padding: '8px 12px' }}>Goal Achieved</th>
                  </tr>
                </thead>
                <tbody>
                  {journeys.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#706E6B' }}>No active journey enrolments for this contact.</td>
                    </tr>
                  ) : (
                    journeys.map((j, idx) => (
                      <tr key={j.id} style={{ borderBottom: '1px solid #DDDBDA', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFB' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{j.journey_name || 'Donor Retention Journey'}</td>
                        <td style={{ padding: '8px 12px' }}>{new Date(j.entered_at).toLocaleDateString()}</td>
                        <td style={{ padding: '8px 12px' }}><StatusBadge status={j.status} /></td>
                        <td style={{ padding: '8px 12px' }}>{j.goal_achieved ? '✅ Yes' : 'Pending'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: ACTIVITY FEED & NOTES (  Timeline) */}
          {activeTab === 'Activity Feed' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>  360° Activity Feed</h3>
                <button 
                  onClick={() => setIsNoteModalOpen(true)}
                  style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '6px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                >
                  📝 Log Note / Call
                </button>
              </div>

              {loadingTimeline ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#706E6B' }}>Loading timeline events...</div>
              ) : timeline.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#706E6B' }}>No activities logged yet.</div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {timeline.map((item) => (
                    <div key={item.id} style={{ position: 'relative', background: '#FFFFFF', border: '1px solid #DDDBDA', borderRadius: '6px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <div style={{ 
                        position: 'absolute', 
                        left: '-37px', 
                        top: '12px', 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '50%', 
                        background: item.color || '#059669', 
                        color: '#FFFFFF', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontSize: '12px'
                      }}>
                        {item.icon || '📌'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '13px', color: '#181818' }}>{item.title}</strong>
                        <span style={{ fontSize: '11px', color: '#706E6B' }}>{new Date(item.timestamp).toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#4B5563' }}>
                        {item.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: CONSENT MANAGEMENT */}
          {activeTab === 'Consent Management' && (
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700 }}>Consent Management & Opt-In Permissions (DPDP Act / GDPR)</h3>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', border: '1px solid #DDDBDA' }}>
                <thead>
                  <tr style={{ background: '#FAFAFB', borderBottom: '1px solid #DDDBDA', color: '#514F4D', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>Channel</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                    <th style={{ padding: '8px 12px' }}>Source</th>
                    <th style={{ padding: '8px 12px' }}>Captured Date</th>
                  </tr>
                </thead>
                <tbody>
                  {consents.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#706E6B' }}>
                        Default transactional donation consent active.
                      </td>
                    </tr>
                  ) : (
                    consents.map((c, idx) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #DDDBDA', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFB' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{c.channel}</td>
                        <td style={{ padding: '8px 12px' }}><StatusBadge status={c.status} /></td>
                        <td style={{ padding: '8px 12px' }}>{c.source || 'Checkout Form'}</td>
                        <td style={{ padding: '8px 12px' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Active'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      {/* MODAL: EDIT CONTACT */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Contact">
        <form onSubmit={handleSaveContact} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 1.2fr 1.2fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Title</label>
              <select 
                value={editForm.title} 
                onChange={e => setEditForm({...editForm, title: e.target.value})}
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
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>First Name</label>
              <input 
                type="text" 
                value={editForm.first_name} 
                onChange={e => setEditForm({...editForm, first_name: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Last Name</label>
              <input 
                type="text" 
                value={editForm.last_name} 
                onChange={e => setEditForm({...editForm, last_name: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Email Address</label>
              <input 
                type="email" 
                value={editForm.email} 
                onChange={e => setEditForm({...editForm, email: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Mobile Number</label>
              <input 
                type="tel" 
                value={editForm.phone} 
                onChange={e => setEditForm({...editForm, phone: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>PAN Number</label>
              <input 
                type="text" 
                maxLength={10}
                value={editForm.tax_id} 
                onChange={e => setEditForm({...editForm, tax_id: e.target.value.toUpperCase()})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', fontFamily: 'monospace', textTransform: 'uppercase', boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Date of Birth</label>
              <input 
                type="date" 
                value={editForm.birthdate} 
                onChange={e => setEditForm({...editForm, birthdate: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Street Address Line 1</label>
            <input 
              type="text" 
              value={editForm.street_address_1} 
              onChange={e => setEditForm({...editForm, street_address_1: e.target.value})}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>PIN Code</label>
              <input 
                type="text" 
                maxLength={6}
                value={editForm.zip_code} 
                onChange={e => handlePincodeChange(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #059669', fontWeight: 700, fontFamily: 'monospace', boxSizing: 'border-box' }} 
              />
              {pinLookupStatus.text && <div style={{ fontSize: '10.5px', color: '#04844B', marginTop: '2px' }}>{pinLookupStatus.text}</div>}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>City</label>
              <input 
                type="text" 
                value={editForm.city} 
                onChange={e => setEditForm({...editForm, city: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>State</label>
              <input 
                type="text" 
                value={editForm.state} 
                onChange={e => setEditForm({...editForm, state: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ADD MONTHLY MANDATE */}
      <Modal isOpen={isAddMonthlyModalOpen} onClose={() => setIsAddMonthlyModalOpen(false)} title="New Monthly Mandate">
        <form onSubmit={handleCreateMonthlyDonation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Monthly Amount (₹) *</label>
            <input 
              type="number" 
              required
              min={100}
              value={monthlyForm.amount} 
              onChange={e => setMonthlyForm({...monthlyForm, amount: Number(e.target.value)})}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #059669', fontSize: '14px', fontWeight: 700, boxSizing: 'border-box' }} 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Payment Gateway</label>
              <select 
                value={monthlyForm.payment_gateway} 
                onChange={e => setMonthlyForm({...monthlyForm, payment_gateway: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA' }}
              >
                <option value="RAZORPAY">Razorpay</option>
                <option value="PAYU">PayU</option>
                <option value="CC AVENUE">CCAvenue</option>
                <option value="WORLDLINE">Worldline</option>
                <option value="CASHFREE">Cashfree</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Payment Method</label>
              <select 
                value={monthlyForm.payment_method} 
                onChange={e => setMonthlyForm({...monthlyForm, payment_method: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA' }}
              >
                <option value="UPI AUTOPAY">UPI AutoPay</option>
                <option value="ENACH">eNACH / Mandate</option>
                <option value="CARD">Card Standing Instruction</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Bank Name</label>
              <input 
                type="text" 
                value={monthlyForm.bank_name} 
                onChange={e => setMonthlyForm({...monthlyForm, bank_name: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Start Date</label>
              <input 
                type="date" 
                value={monthlyForm.signup_date} 
                onChange={e => setMonthlyForm({...monthlyForm, signup_date: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setIsAddMonthlyModalOpen(false)} style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
              Save Mandate
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: MANAGE MANDATE */}
      <Modal isOpen={isManageMonthlyModalOpen} onClose={() => setIsManageMonthlyModalOpen(false)} title={`Manage Mandate MD-${selectedMonthlyDonation?.id?.substring(0, 8)}`}>
        <form onSubmit={handleManageMonthlyDonation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Action</label>
            <select 
              value={manageForm.action} 
              onChange={e => setManageForm({...manageForm, action: e.target.value})}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA' }}
            >
              <option value="pause">Pause Mandate</option>
              <option value="resume">Resume Mandate</option>
              <option value="upgrade">Upgrade Value</option>
              <option value="downgrade">Downgrade Value</option>
              <option value="cancel">Cancel Mandate</option>
            </select>
          </div>

          {manageForm.action === 'pause' && (
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Pause Months</label>
              <input 
                type="number" 
                min={1}
                max={6}
                value={manageForm.paused_period} 
                onChange={e => setManageForm({...manageForm, paused_period: Number(e.target.value)})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA' }} 
              />
            </div>
          )}

          {(manageForm.action === 'upgrade' || manageForm.action === 'downgrade') && (
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>New Amount (₹)</label>
              <input 
                type="number" 
                min={100}
                value={manageForm.amount} 
                onChange={e => setManageForm({...manageForm, amount: Number(e.target.value)})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #059669' }} 
              />
            </div>
          )}

          {manageForm.action === 'cancel' && (
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>End Reason</label>
              <input 
                type="text" 
                value={manageForm.end_reason} 
                onChange={e => setManageForm({...manageForm, end_reason: e.target.value})}
                placeholder="Reason for cancellation"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA' }} 
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Helpdesk Ticket ID</label>
            <input 
              type="text" 
              placeholder="e.g. TICKET-101"
              value={manageForm.helpdesk_ticket_id} 
              onChange={e => setManageForm({...manageForm, helpdesk_ticket_id: e.target.value})}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA' }} 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setIsManageMonthlyModalOpen(false)} style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
              Update Mandate
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: LOG OFFLINE DONATION */}
      <Modal isOpen={isOfflineDonationModalOpen} onClose={() => setIsOfflineDonationModalOpen(false)} title="Log Offline / Manual Donation">
        <form onSubmit={handleCreateOfflineDonation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Amount (₹) *</label>
              <input 
                type="number" 
                required
                min={1}
                value={offlineForm.amount} 
                onChange={e => setOfflineForm({...offlineForm, amount: Number(e.target.value)})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #059669', fontSize: '14px', fontWeight: 700, boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Payment Method</label>
              <select 
                value={offlineForm.payment_method} 
                onChange={e => setOfflineForm({...offlineForm, payment_method: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA' }}
              >
                <option value="CHEQUE">Cheque / Demand Draft</option>
                <option value="NEFT_RTGS">NEFT / RTGS / IMPS</option>
                <option value="CASH">Cash Donation</option>
                <option value="DIRECT_UPI">Direct Bank UPI</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Payment Date</label>
              <input 
                type="date" 
                value={offlineForm.payment_date} 
                onChange={e => setOfflineForm({...offlineForm, payment_date: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Cheque / UTR / Reference No</label>
              <input 
                type="text" 
                placeholder="e.g. CHQ-994821 or UTR-3049"
                value={offlineForm.gateway_transaction_id} 
                onChange={e => setOfflineForm({...offlineForm, gateway_transaction_id: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Internal Staff Notes</label>
            <textarea 
              rows={2}
              placeholder="e.g. Received via physical cheque from gala event"
              value={offlineForm.notes} 
              onChange={e => setOfflineForm({...offlineForm, notes: e.target.value})}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box', fontFamily: 'inherit' }} 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="checkbox" 
              id="gen80g"
              checked={offlineForm.generate_receipt} 
              onChange={e => setOfflineForm({...offlineForm, generate_receipt: e.target.checked})} 
            />
            <label htmlFor="gen80g" style={{ fontSize: '13px', fontWeight: 600, color: '#065F46' }}>
              Automatically generate official 80G Tax Exemption Certificate
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setIsOfflineDonationModalOpen(false)} style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
              Record Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: LOG NOTE / CALL */}
      <Modal isOpen={isNoteModalOpen} onClose={() => setIsNoteModalOpen(false)} title="Log Note or Call Log">
        <form onSubmit={handleCreateNote} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Type</label>
            <select 
              value={noteForm.note_type} 
              onChange={e => setNoteForm({...noteForm, note_type: e.target.value})}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA' }}
            >
              <option value="general_note">General Staff Note</option>
              <option value="call_log">Phone Call Log</option>
              <option value="meeting">In-Person Meeting</option>
              <option value="task_followup">Follow-Up Task</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Subject / Title *</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Donor stewardship call & thank you"
              value={noteForm.title} 
              onChange={e => setNoteForm({...noteForm, title: e.target.value})}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Details / Summary *</label>
            <textarea 
              rows={4}
              required
              placeholder="Enter details of the discussion, action items, or feedback..."
              value={noteForm.content} 
              onChange={e => setNoteForm({...noteForm, content: e.target.value})}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box', fontFamily: 'inherit' }} 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setIsNoteModalOpen(false)} style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
              Save Note
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ENROLL IN JOURNEY */}
      <Modal isOpen={isEnrollJourneyModalOpen} onClose={() => setIsEnrollJourneyModalOpen(false)} title="Enroll Contact into Journey">
        <form onSubmit={handleEnrollJourney} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Select Marketing / Retention Journey</label>
            {availableJourneys.length === 0 ? (
              <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '4px', color: '#64748B', fontSize: '13px' }}>
                No active journeys found. Please create a journey in the Journey Builder.
              </div>
            ) : (
              <select 
                value={selectedJourneyId} 
                onChange={e => setSelectedJourneyId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #7C3AED', fontWeight: 600 }}
              >
                {availableJourneys.map(j => (
                  <option key={j.id} value={j.id}>{j.journey_name || j.name}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setIsEnrollJourneyModalOpen(false)} style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
            <button 
              type="submit" 
              disabled={availableJourneys.length === 0}
              style={{ background: '#7C3AED', color: '#FFFFFF', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
            >
              Enroll Now
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: DIRECT COMMUNICATION */}
      <Modal isOpen={isSendCommModalOpen} onClose={() => setIsSendCommModalOpen(false)} title={`Send ${commChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}`}>
        <form onSubmit={handleSendCommunication} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {commChannel === 'whatsapp' ? (
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Template</label>
              <select 
                value={commForm.template_name} 
                onChange={e => setCommForm({...commForm, template_name: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA' }}
              >
                <option value="donation_thank_you_80g">donation_thank_you_80g</option>
                <option value="monthly_mandate_active">monthly_mandate_active</option>
                <option value="ad_hoc_update">ad_hoc_update</option>
              </select>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Subject Line</label>
              <input 
                type="text" 
                required
                value={commForm.subject} 
                onChange={e => setCommForm({...commForm, subject: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box' }} 
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Message</label>
            <textarea 
              rows={4}
              placeholder="Enter message content..."
              value={commForm.message} 
              onChange={e => setCommForm({...commForm, message: e.target.value})}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDDBDA', boxSizing: 'border-box', fontFamily: 'inherit' }} 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setIsSendCommModalOpen(false)} style={{ background: '#FFFFFF', border: '1px solid #DDDBDA', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
              Send
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
