import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';
import { Modal } from '../shared/Modal';
import { KpiCard } from '../shared/KpiCard';

export const CommunicationLog: React.FC = () => {
  const [activeChannel, setActiveChannel] = useState<'All' | 'Email' | 'WhatsApp'>('All');
  const [logs, setLogs] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  // Send Message Form
  const [sendForm, setSendForm] = useState({
    contact_id: '',
    channel: 'email',
    subject_line: '',
    template_name: 'thank_you_email',
    message: ''
  });

  useEffect(() => {
    fetchLogs();
    fetchContacts();
  }, [activeChannel]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const endpoint = activeChannel === 'All' ? '/api/communications' : `/api/communications?channel=${activeChannel}`;
      const res = await apiFetch(endpoint);
      if (res && res.success) {
        setLogs(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Failed to load communication logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await apiFetch('/api/contacts');
      if (res && res.success) {
        setContacts(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/communications/send', {
        method: 'POST',
        body: JSON.stringify(sendForm)
      });
      if (res && res.success) {
        setIsSendModalOpen(false);
        setSendForm({
          contact_id: '',
          channel: 'email',
          subject_line: '',
          template_name: 'thank_you_email',
          message: ''
        });
        fetchLogs();
      }
    } catch (err) {
      console.error('Send error:', err);
    }
  };

  const totalDelivered = logs.filter(l => l.status === 'delivered' || l.status === 'opened' || l.status === 'read').length;
  const deliveryRate = logs.length > 0 ? `${Math.round((totalDelivered / logs.length) * 100)}%` : '100%';
  const totalOpened = logs.filter(l => l.opened_at || l.read_at || l.status === 'opened' || l.status === 'read').length;
  const openRate = logs.length > 0 ? `${Math.round((totalOpened / logs.length) * 100)}%` : '0%';
  const totalBounced = logs.filter(l => l.status === 'bounced' || l.status === 'failed').length;
  const bounceRate = logs.length > 0 ? `${((totalBounced / logs.length) * 100).toFixed(1)}%` : '0.0%';

  const columns = [
    { 
      key: 'channel', 
      label: 'Channel', 
      render: (val: any, row: any) => {
        const isWa = (val || row.channel || '').toLowerCase() === 'whatsapp';
        return (
          <span style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            background: isWa ? '#ECFDF5' : '#EFF6FF', 
            color: isWa ? '#059669' : '#1D4ED8', 
            padding: '4px 10px', 
            borderRadius: '6px', 
            fontWeight: 700, 
            fontSize: '12px' 
          }}>
            {isWa ? '💬 WhatsApp' : '📧 Email'}
          </span>
        );
      } 
    },
    { 
      key: 'recipient_name', 
      label: 'Recipient Donor', 
      render: (val: any, row: any) => {
        const contactId = row.contact_id;
        const name = val || 'Donor Partner';
        return (
          <div>
            {contactId ? (
              <a 
                href={`#contact=${contactId}`}
                style={{ color: '#059669', fontWeight: 700, textDecoration: 'none', display: 'block' }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                {name}
              </a>
            ) : (
              <strong style={{ color: '#0F172A', display: 'block' }}>{name}</strong>
            )}
            <span style={{ fontSize: '12px', color: '#64748B' }}>{row.recipient_email || row.recipient_phone || (contactId ? `ID: ${contactId.substring(0, 8)}` : '')}</span>
          </div>
        );
      } 
    },
    { 
      key: 'subject_line', 
      label: 'Subject / Template', 
      render: (val: any, row: any) => (
        <span style={{ fontSize: '13px', color: '#334155' }}>
          {val || row.template_name || row.communication_type || 'Notification'}
        </span>
      ) 
    },
    { 
      key: 'trigger_type', 
      label: 'Trigger Mode', 
      render: (val: any) => (
        <span style={{ background: '#F1F5F9', color: '#475569', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
          ⚡ {val || 'journey'}
        </span>
      ) 
    },
    { 
      key: 'status', 
      label: 'Delivery Status', 
      render: (val: any) => <StatusBadge status={val || 'delivered'} /> 
    },
    { 
      key: 'created_at', 
      label: 'Dispatched At', 
      render: (val: any) => val ? new Date(val).toLocaleString() : 'N/A' 
    }
  ];

  return (
    <div style={{ fontFamily: 'var(--font-sans)', padding: '16px', background: '#F8FAFC', minHeight: '100vh', color: '#0F172A' }}>
      {/*   Standard Lightning Header */}
      <div className="slds-page-header" style={{ marginBottom: '16px' }}>
        <div className="slds-page-header__top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="slds-object-icon" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
              💬
            </div>
            <div>
              <span className="slds-object-eyebrow">Service & Outreach Cloud</span>
              <h2 className="slds-object-title">
                Communications Hub & Omnichannel Dispatch Logs
              </h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setIsSendModalOpen(true)}
              className="btn btn-primary"
            >
              <span>🚀</span>
              <span>Send Ad-Hoc Message</span>
            </button>
          </div>
        </div>

        <div className="slds-highlights-ribbon">
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Total Dispatches</span>
            <span className="slds-highlight-item__value">
              {logs.length} Messages
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Delivery Rate</span>
            <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
              {deliveryRate}
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Open / Read Rate</span>
            <span className="slds-highlight-item__value" style={{ color: '#0284C7' }}>
              {openRate}
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Bounce Rate</span>
            <span className="slds-highlight-item__value" style={{ color: bounceRate === '0.0%' ? '#059669' : '#DC2626' }}>
              {bounceRate}
            </span>
          </div>
        </div>
      </div>

      {/* Channel Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#FFFFFF', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', width: 'fit-content' }}>
        {(['All', 'Email', 'WhatsApp'] as const).map(channel => (
          <button 
            key={channel}
            onClick={() => setActiveChannel(channel)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              background: activeChannel === channel ? '#059669' : 'transparent',
              color: activeChannel === channel ? '#FFFFFF' : '#64748B',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {channel === 'All' ? '🌐 All Channels' : channel === 'Email' ? '📧 Email Only' : '💬 WhatsApp Only'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <DataTable 
          data={logs} 
          columns={columns} 
          loading={loading}
          emptyMessage="No communication dispatches found."
          onRowClick={(row) => setSelectedLog(row)}
        />
      </div>

      {/* MODAL: LOG DETAILS */}
      {selectedLog && (
        <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Communication Dispatch Audit">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div>
                <strong style={{ fontSize: '15px', color: '#0F172A', display: 'block' }}>{selectedLog.recipient_name || 'Donor'}</strong>
                <span style={{ fontSize: '12px', color: '#64748B' }}>{selectedLog.recipient_email || selectedLog.recipient_phone}</span>
              </div>
              <StatusBadge status={selectedLog.status || 'delivered'} />
            </div>

            <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
              <div style={{ marginBottom: '8px' }}><strong>Channel:</strong> {selectedLog.channel === 'whatsapp' ? '💬 Meta WhatsApp Business API' : '📧 AWS SES Transactional Email'}</div>
              <div style={{ marginBottom: '8px' }}><strong>Subject / Template:</strong> {selectedLog.subject_line || selectedLog.template_name || 'Standard Notice'}</div>
              <div><strong>Trigger Origin:</strong> {selectedLog.trigger_type || 'journey'}</div>
            </div>

            <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>Delivery Timeline</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div style={{ color: '#475569' }}>⏱️ <strong>Queued:</strong> {new Date(selectedLog.created_at).toLocaleString()}</div>
                {selectedLog.sent_at && <div style={{ color: '#2563EB' }}>📤 <strong>Dispatched:</strong> {new Date(selectedLog.sent_at).toLocaleString()}</div>}
                {selectedLog.delivered_at && <div style={{ color: '#059669' }}>✅ <strong>Delivered to Carrier:</strong> {new Date(selectedLog.delivered_at).toLocaleString()}</div>}
                {selectedLog.opened_at && <div style={{ color: '#7C3AED' }}>👀 <strong>Read / Opened:</strong> {new Date(selectedLog.opened_at).toLocaleString()}</div>}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setSelectedLog(null)} 
                style={{ padding: '8px 18px', background: '#0F172A', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Close Audit
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: SEND AD-HOC MESSAGE */}
      <Modal isOpen={isSendModalOpen} onClose={() => setIsSendModalOpen(false)} title="Dispatch Ad-Hoc Message">
        <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Select Recipient Donor</label>
            <select 
              required
              value={sendForm.contact_id} 
              onChange={e => setSendForm({...sendForm, contact_id: e.target.value})}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: 'white' }}
            >
              <option value="">-- Choose Donor --</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name || `${c.first_name || ''} ${c.last_name || ''}`} ({c.email || c.phone || 'No contact info'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Channel</label>
              <select 
                value={sendForm.channel} 
                onChange={e => setSendForm({...sendForm, channel: e.target.value})}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: 'white' }}
              >
                <option value="email">📧 Transactional Email</option>
                <option value="whatsapp">💬 WhatsApp Message</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Template</label>
              <select 
                value={sendForm.template_name} 
                onChange={e => setSendForm({...sendForm, template_name: e.target.value})}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: 'white' }}
              >
                <option value="thank_you_email">Thank You Notice</option>
                <option value="welcome_email">Welcome Onboarding</option>
                <option value="reminder_email">Payment Reminder</option>
                <option value="custom_message">Custom Message</option>
              </select>
            </div>
          </div>

          {sendForm.channel === 'email' && (
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Subject Line</label>
              <input 
                type="text" 
                value={sendForm.subject_line} 
                onChange={e => setSendForm({...sendForm, subject_line: e.target.value})} 
                placeholder="Thank you for your generous child sponsorship gift!"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Custom Message Body (Optional)</label>
            <textarea 
              rows={4}
              value={sendForm.message} 
              onChange={e => setSendForm({...sendForm, message: e.target.value})} 
              placeholder="Dear {{donor_name}}, we wanted to personally update you on our program impact..."
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', resize: 'vertical' }} 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button 
              type="button" 
              onClick={() => setIsSendModalOpen(false)} 
              style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: 'white', borderRadius: '6px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              style={{ padding: '8px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              🚀 Dispatch Now
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
