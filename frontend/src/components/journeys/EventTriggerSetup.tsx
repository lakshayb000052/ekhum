import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { Modal } from '../shared/Modal';
import { DataTable } from '../shared/DataTable';

export const EventTriggerSetup: React.FC = () => {
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState('');
  const [testForm, setTestForm] = useState({ contact_id: '', payload: '{\n  "amount": 1000\n}' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [typesRes, journeysRes, eventsRes] = await Promise.all([
        apiFetch('/api/events/types'),
        apiFetch('/api/journeys'),
        apiFetch('/api/events')
      ]);

      if (typesRes && typesRes.success) setEventTypes(Array.isArray(typesRes.data) ? typesRes.data : []);
      if (journeysRes && journeysRes.success) setJourneys(Array.isArray(journeysRes.data) ? journeysRes.data : []);
      if (eventsRes && eventsRes.success) setRecentEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
    } catch (err) {
      console.error('Failed to load event data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getJourneysForEvent = (typeId: string) => {
    const list = Array.isArray(journeys) ? journeys : [];
    return list.filter(j => j.entry_type === 'event' && j.entry_event_type === typeId);
  };

  const handleOpenTest = (typeId: string) => {
    setSelectedEventType(typeId);
    setTestForm({ contact_id: '', payload: '{\n  "amount": 1000\n}' });
    setIsTestModalOpen(true);
  };

  const fireTestEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(testForm.payload);
      } catch (e) {
        alert('Invalid JSON payload. Please ensure valid JSON formatting.');
        return;
      }

      const data = await apiFetch('/api/events/fire', {
        method: 'POST',
        body: JSON.stringify({
          event_type: selectedEventType,
          contact_id: testForm.contact_id || null,
          payload: parsedPayload
        })
      });

      if (data && data.success) {
        alert('✅ Test event dispatched successfully! Matching journeys have been triggered.');
        setIsTestModalOpen(false);
        const eventsRes = await apiFetch('/api/events');
        if (eventsRes && eventsRes.success) setRecentEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
      } else {
        alert(`❌ Error: ${data?.error || data?.message || 'Failed to dispatch test event'}`);
      }
    } catch (err: any) {
      console.error('Failed to fire event:', err);
      alert(`❌ Error dispatching test event: ${err.message}`);
    }
  };

  const eventColumns = [
    { 
      key: 'event_type', 
      label: 'Event Type',
      render: (val: any) => <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '12px' }}>⚡ {val}</span>
    },
    { 
      key: 'contact_id', 
      label: 'Contact ID / Phone',
      render: (val: any) => val ? <code style={{ fontSize: '12px' }}>{val.substring(0, 13)}...</code> : <span style={{ color: '#94A3B8' }}>Auto-Matched</span>
    },
    { 
      key: 'payload', 
      label: 'Payload', 
      render: (val: any) => <pre style={{ margin: 0, fontSize: '11px', color: '#334155', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{JSON.stringify(val)}</pre> 
    },
    { 
      key: 'occurred_at', 
      label: 'Triggered At', 
      render: (val: any) => val ? new Date(val).toLocaleString() : 'N/A' 
    }
  ];

  return (
    <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚡</span>
          <span>Event Trigger Engine</span>
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
          Real-time system events that automatically trigger matching donor automation journeys across WhatsApp and Email.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>Loading system event triggers...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {eventTypes.map((et: any) => {
              const typeId = et.id || et;
              const matchedJourneys = getJourneysForEvent(typeId);
              return (
                <div key={typeId} style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ height: '8px', width: '8px', borderRadius: '50%', background: matchedJourneys.length > 0 ? '#10B981' : '#94A3B8' }}></span>
                      <strong style={{ fontSize: '14px', color: '#0F172A' }}>{et.label || typeId}</strong>
                    </div>
                    <code style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '8px' }}>{typeId}</code>
                    <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#475569' }}>{et.description || 'Configured system event trigger.'}</p>
                    
                    <div style={{ marginBottom: '14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Active Linked Journeys:</span>
                      {matchedJourneys.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                          {matchedJourneys.map(j => (
                            <span key={j.id} style={{ background: '#DCFCE7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                              {j.journey_name || j.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>No journeys linked yet</p>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleOpenTest(typeId)}
                    style={{ width: '100%', padding: '7px 12px', background: '#FFFFFF', border: '1.5px solid #059669', color: '#059669', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <span>🚀</span>
                    <span>Fire Test Event</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div>
            <h3 style={{ marginBottom: '12px', fontSize: '1.1rem', fontWeight: 600 }}>Recent System Events Log</h3>
            <DataTable columns={eventColumns} data={recentEvents} emptyMessage="No recent events fired." />
          </div>
        </>
      )}

      <Modal isOpen={isTestModalOpen} onClose={() => setIsTestModalOpen(false)} title={`Fire Test Event: ${selectedEventType}`}>
        <form onSubmit={fireTestEvent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Target Contact (Phone / Email / ID - Optional)</label>
            <input 
              type="text" 
              value={testForm.contact_id} 
              onChange={e => setTestForm({...testForm, contact_id: e.target.value})} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none' }} 
              placeholder="e.g. +91 8296886832, donor@example.com, or leave empty for auto-test"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Event Payload (JSON)</label>
            <textarea 
              value={testForm.payload} 
              onChange={e => setTestForm({...testForm, payload: e.target.value})} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none', height: '120px', fontFamily: 'monospace', fontSize: '13px' }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button 
              type="button" 
              onClick={() => setIsTestModalOpen(false)} 
              style={{ padding: '10px 18px', border: '1px solid #CBD5E1', background: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              style={{ padding: '10px 22px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              Dispatch Event
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
