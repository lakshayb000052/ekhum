import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { Modal } from '../shared/Modal';
import { KpiCard } from '../shared/KpiCard';
import { StatusBadge } from '../shared/StatusBadge';

export const JourneyCanvas: React.FC<{ journey: any; onBack: () => void }> = ({ journey, onBack }) => {
  const journeyId = journey?.id;
  const journeyTitle = journey?.journey_name || journey?.name || 'Untitled Journey';
  
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  const [templates, setTemplates] = useState<any[]>([]);
  const [, setEventTypes] = useState<any[]>([]);
  
  const [stepForm, setStepForm] = useState({
    step_type: 'send_email',
    name: 'Send Email Notification',
    wait_duration_minutes: 1440,
    template_id: '',
    config: {} as any
  });

  const [activeTab, setActiveTab] = useState<'canvas' | 'enrolments' | 'stats'>('canvas');
  const [enrolments, setEnrolments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ entered: 0, active: 0, completed: 0, goal_achieved: 0 });

  useEffect(() => {
    if (journeyId) {
      fetchCanvas();
      fetchTemplates();
      fetchEventTypes();
      fetchStats();
    }
  }, [journeyId]);

  const fetchCanvas = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/journeys/${journeyId}/canvas`);
      if (data && data.success && data.data) {
        const rawSteps = data.data.steps || [];
        setSteps(rawSteps.map((s: any, idx: number) => ({
          ...s,
          step_type: s.step_type || 'send_email',
          name: s.name || formatStepName(s.step_type),
          step_order: s.step_order || idx + 1,
          config: s.config || {}
        })));
      }
    } catch (err) {
      console.error('Failed to fetch canvas:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const orgQuery = journey?.organization_id ? `?organizationId=${journey.organization_id}` : '';
      const data = await apiFetch(`/api/templates${orgQuery}`);
      if (data && data.success) {
        setTemplates(Array.isArray(data.data) ? data.data : (data.templates || []));
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const fetchEventTypes = async () => {
    try {
      const data = await apiFetch('/api/events/types');
      if (data && data.success) setEventTypes(Array.isArray(data.data) ? data.data : []);
    } catch (err) {}
  };

  const fetchStats = async () => {
    try {
      const data = await apiFetch(`/api/journeys/${journeyId}/stats`);
      if (data && data.success) setStats(data.data || {});
    } catch (err) {}
  };

  const fetchEnrolments = async () => {
    try {
      const data = await apiFetch(`/api/journeys/${journeyId}/enrolments`);
      if (data && data.success) setEnrolments(Array.isArray(data.data) ? data.data : []);
    } catch (err) {}
  };

  useEffect(() => {
    if (activeTab === 'enrolments') {
      fetchEnrolments();
    }
  }, [activeTab]);

  const formatStepName = (type: string) => {
    switch (type) {
      case 'send_email': return 'Send Email';
      case 'send_whatsapp': return 'Send WhatsApp Message';
      case 'wait': return 'Wait / Delay';
      case 'condition_split': return 'Conditional Branch';
      case 'update_field': return 'Update Donor Record';
      case 'goal_check': return 'Goal Achievement Check';
      default: return 'Custom Step';
    }
  };

  const handleSaveCanvas = async () => {
    setSaving(true);
    try {
      const payloadSteps = steps.map((s, idx) => ({
        step_order: idx + 1,
        step_type: s.step_type,
        wait_duration_minutes: s.wait_duration_minutes || (s.step_type === 'wait' ? 1440 : null),
        template_id: s.template_id || null,
        condition_expression: s.condition_expression || null,
        config: s.config || {}
      }));

      const data = await apiFetch(`/api/journeys/${journeyId}/canvas`, {
        method: 'PUT',
        body: JSON.stringify({ steps: payloadSteps })
      });

      if (data && data.success) {
        alert('Journey canvas saved successfully!');
        fetchCanvas();
      }
    } catch (err) {
      console.error('Failed to save canvas:', err);
      alert('Error saving journey canvas');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const isCurrentlyActive = journey?.status === 'active';
    try {
      const endpoint = isCurrentlyActive ? `/api/journeys/${journeyId}/pause` : `/api/journeys/${journeyId}/activate`;
      const method = isCurrentlyActive ? 'PUT' : 'POST';
      const data = await apiFetch(endpoint, { method });
      if (data && data.success) {
        fetchCanvas();
      }
    } catch (err) {
      console.error('Failed to toggle journey status:', err);
    }
  };

  const [testing, setTesting] = useState(false);

  const handleTestFire = async () => {
    setTesting(true);
    try {
      const data = await apiFetch(`/api/journeys/${journeyId}/test-fire`, { method: 'POST' });
      if (data && data.success) {
        alert(data.message || '✅ Test trigger executed! Contact enrolled and Step 1 dispatched.');
        fetchStats();
        fetchEnrolments();
      } else {
        alert(data?.error || data?.message || 'Failed to trigger test.');
      }
    } catch (err: any) {
      alert(err.message || 'Error triggering test.');
    } finally {
      setTesting(false);
    }
  };

  const handleOpenAdd = (index: number) => {
    setModalMode('add');
    setEditingIndex(index);
    setStepForm({
      step_type: 'send_email',
      name: 'Send Email Notification',
      wait_duration_minutes: 1440,
      template_id: templates[0]?.id || '',
      config: {}
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (index: number) => {
    setModalMode('edit');
    setEditingIndex(index);
    const curr = steps[index];
    setStepForm({
      step_type: curr.step_type || 'send_email',
      name: curr.name || formatStepName(curr.step_type),
      wait_duration_minutes: curr.wait_duration_minutes || 1440,
      template_id: curr.template_id || '',
      config: curr.config ? JSON.parse(JSON.stringify(curr.config)) : {}
    });
    setIsModalOpen(true);
  };

  const handleDeleteStep = (index: number) => {
    if (!confirm('Are you sure you want to remove this step?')) return;
    const newSteps = [...steps];
    newSteps.splice(index, 1);
    setSteps(newSteps);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const newSteps = [...steps];
    if (modalMode === 'add') {
      newSteps.splice(editingIndex ?? newSteps.length, 0, stepForm as any);
    } else if (editingIndex !== null) {
      newSteps[editingIndex] = { ...newSteps[editingIndex], ...stepForm };
    }
    setSteps(newSteps);
    setIsModalOpen(false);
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'send_email': return '📧';
      case 'send_whatsapp': return '💬';
      case 'wait': return '⏳';
      case 'condition_split': return '🔀';
      case 'update_field': return '🏷️';
      case 'goal_check': return '🎯';
      default: return '⚙️';
    }
  };

  const stepCardStyle = {
    background: '#FFFFFF',
    border: '1.5px solid #E2E8F0',
    borderRadius: '12px',
    padding: '16px 20px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    width: '420px',
    margin: '0 auto',
    transition: 'all 0.2s ease'
  };

  const connectorStyle = {
    width: '2px',
    height: '24px',
    background: '#CBD5E1',
    margin: '0 auto'
  };

  const addBtnStyle = {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#FFFFFF',
    color: '#059669',
    border: '2px solid #059669',
    fontSize: '18px',
    fontWeight: 700 as const,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  };

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', color: '#0F172A', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top Header Bar */}
      <div style={{ padding: '16px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={onBack} 
            style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>←</span>
            <span>Back to Journeys</span>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{journeyTitle}</h2>
              <StatusBadge status={journey?.status || 'draft'} />
            </div>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Entry Trigger: {journey?.entry_type === 'event' ? `⚡ ${journey?.entry_event_type || 'Event'}` : (journey?.entry_type || 'Manual')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={handleTestFire}
            disabled={testing}
            style={{ 
              background: '#F0FDF4', 
              color: '#059669', 
              border: '1px solid #BBF7D0', 
              padding: '10px 16px', 
              borderRadius: '8px', 
              fontWeight: 700, 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px' 
            }}
            title="Execute test simulation on this journey"
          >
            <span>{testing ? '🔄 Testing...' : '🧪 Test-Fire Flow'}</span>
          </button>
          <button 
            onClick={handleToggleActive}
            style={{ 
              background: journey?.status === 'active' ? '#FEF3C7' : '#DCFCE7', 
              color: journey?.status === 'active' ? '#92400E' : '#166534', 
              border: `1px solid ${journey?.status === 'active' ? '#FDE68A' : '#BBF7D0'}`, 
              padding: '10px 16px', 
              borderRadius: '8px', 
              fontWeight: 700, 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px' 
            }}
          >
            <span>{journey?.status === 'active' ? '⏸️ Pause Journey' : '🚀 Publish & Activate Flow'}</span>
          </button>
          <button 
            onClick={handleSaveCanvas} 
            disabled={saving} 
            style={{ background: '#059669', color: '#FFFFFF', padding: '10px 20px', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.2)' }}
          >
            <span>💾</span>
            <span>{saving ? 'Saving...' : 'Save Flow Canvas'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <KpiCard title="Total Enrolled" value={String(stats.entered || journey?.enrolled_count || 0)} />
        <KpiCard title="Currently In-Flight" value={String(stats.active || 0)} />
        <KpiCard title="Completed" value={String(stats.completed || 0)} />
        <KpiCard title="Goal Conversion" value={stats.entered > 0 ? `${Math.round((stats.goal_achieved / stats.entered) * 100)}%` : '0%'} />
      </div>

      {/* View Tabs */}
      <div style={{ padding: '12px 24px', display: 'flex', gap: '10px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <button 
          onClick={() => setActiveTab('canvas')} 
          style={{ 
            padding: '6px 16px', 
            border: '1px solid',
            borderColor: activeTab === 'canvas' ? '#059669' : '#CBD5E1', 
            background: activeTab === 'canvas' ? '#059669' : '#FFFFFF', 
            color: activeTab === 'canvas' ? '#FFFFFF' : '#475569', 
            borderRadius: '20px', 
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          🎨 Visual Flow Canvas
        </button>
        <button 
          onClick={() => setActiveTab('enrolments')} 
          style={{ 
            padding: '6px 16px', 
            border: '1px solid',
            borderColor: activeTab === 'enrolments' ? '#059669' : '#CBD5E1', 
            background: activeTab === 'enrolments' ? '#059669' : '#FFFFFF', 
            color: activeTab === 'enrolments' ? '#FFFFFF' : '#475569', 
            borderRadius: '20px', 
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          👥 Enrolled Donors ({enrolments.length})
        </button>
      </div>

      {/* Canvas Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '40px 24px', background: '#F8FAFC' }}>
        {activeTab === 'canvas' ? (
          loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>Loading journey steps...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Entry Node */}
              <div style={{ ...stepCardStyle, border: '2px solid #059669', background: '#F0FDF4', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#059669', fontWeight: 700, letterSpacing: '0.5px' }}>JOURNEY ENTRY TRIGGER</div>
                <h3 style={{ margin: '6px 0 0 0', fontSize: '1rem', color: '#065F46', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span>🎯</span>
                  <span>{journey?.entry_type === 'event' ? `Event: ${journey?.entry_event_type || 'contact.created'}` : `Segment: ${journey?.entry_type || 'Manual'}`}</span>
                </h3>
              </div>
              
              <div style={connectorStyle}></div>
              <button style={addBtnStyle} onClick={() => handleOpenAdd(0)} title="Add step here">+</button>
              <div style={connectorStyle}></div>

              {/* Journey Step Cards */}
              {steps.map((step, index) => (
                <React.Fragment key={step.id || index}>
                  <div style={stepCardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '22px' }}>{getStepIcon(step.step_type)}</span>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#0F172A', display: 'block' }}>
                            {step.name || formatStepName(step.step_type)}
                          </strong>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>
                            Step {index + 1} • {formatStepName(step.step_type)}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          onClick={() => handleOpenEdit(index)} 
                          style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                          title="Edit step configuration"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteStep(index)} 
                          style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#DC2626' }}
                          title="Delete step"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Step details badge */}
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: '#F8FAFC', borderRadius: '6px', fontSize: '12px', color: '#475569' }}>
                      {step.step_type === 'send_email' && (
                        <span>📧 Email Template: <strong>{templates.find(t => t.id === step.template_id || t.id === step.config?.template_id)?.name || 'Default Email Template'}</strong></span>
                      )}
                      {step.step_type === 'send_whatsapp' && (
                        <span>💬 WhatsApp Template: <strong>{templates.find(t => t.id === step.template_id || t.id === step.config?.template_id || t.name === step.config?.template_name)?.name || step.config?.template_name || 'Default WhatsApp Template'}</strong></span>
                      )}
                      {step.step_type === 'wait' && (
                        <span>⏳ Wait Duration: <strong>{step.wait_duration_minutes || 1440} minutes ({Math.round((step.wait_duration_minutes || 1440) / 60)} hrs)</strong></span>
                      )}
                      {step.step_type === 'condition_split' && (
                        <span>🔀 If: <strong>{step.condition_expression?.field || 'total_paid_amount'} {step.condition_expression?.operator || '>'} {step.condition_expression?.value || '0'}</strong></span>
                      )}
                      {step.step_type === 'update_field' && (
                        <span>🏷️ Set <strong>{step.config?.field_name || 'status'}</strong> = <strong>{step.config?.field_value || 'VIP'}</strong></span>
                      )}
                      {step.step_type === 'goal_check' && (
                        <span>🎯 Goal Event: <strong>{step.config?.goal_event || 'donation.completed'}</strong></span>
                      )}
                    </div>
                  </div>
                  
                  <div style={connectorStyle}></div>
                  <button style={addBtnStyle} onClick={() => handleOpenAdd(index + 1)} title="Add step here">+</button>
                  <div style={connectorStyle}></div>
                </React.Fragment>
              ))}
              
              {/* Flow End Node */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0F172A', color: '#FFFFFF', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                <span>🏁</span>
                <span>Journey Complete</span>
              </div>
            </div>
          )
        ) : (
          <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', maxWidth: '800px', margin: '0 auto' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700 }}>Enrolled Contacts History</h3>
            {enrolments.length === 0 ? (
              <p style={{ color: '#64748B', fontSize: '14px' }}>No contacts enrolled yet. When triggers fire, enrolled contacts will appear here.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {enrolments.map((e, i) => (
                  <div key={e.id || i} style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#0F172A' }}>{e.donor_name || `Contact: ${e.contact_id}`}</strong>
                      <span style={{ fontSize: '12px', color: '#64748B', display: 'block' }}>Entered: {new Date(e.entered_at || e.created_at).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {e.goal_achieved && <span style={{ background: '#DCFCE7', color: '#15803D', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>🎯 Goal Achieved</span>}
                      <StatusBadge status={e.status || 'active'} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step Config Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalMode === 'add' ? 'Add Flow Step' : 'Configure Flow Step'}>
        <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Action / Step Type</label>
            <select 
              value={stepForm.step_type} 
              onChange={e => setStepForm({...stepForm, step_type: e.target.value, name: formatStepName(e.target.value)})} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none', background: 'white' }}
            >
              <option value="send_email">📧 Send Email</option>
              <option value="send_whatsapp">💬 Send WhatsApp Message</option>
              <option value="wait">⏳ Wait / Time Delay</option>
              <option value="condition_split">🔀 Conditional Branch</option>
              <option value="update_field">🏷️ Update Donor Field</option>
              <option value="goal_check">🎯 Goal Check</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Step Label</label>
            <input 
              type="text" 
              value={stepForm.name} 
              onChange={e => setStepForm({...stepForm, name: e.target.value})} 
              required 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none' }} 
            />
          </div>
          
          {stepForm.step_type === 'send_email' && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>
                Email Template *
              </label>
              <select 
                value={stepForm.template_id || stepForm.config?.template_id || ''} 
                onChange={e => {
                  const val = e.target.value;
                  const selectedT = templates.find(t => t.id === val);
                  setStepForm({
                    ...stepForm, 
                    template_id: val,
                    config: { ...stepForm.config, template_id: val, template_name: selectedT?.name || '' }
                  });
                }} 
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none', background: 'white', fontWeight: 500 }}
              >
                <option value="">-- Select NGO Aligned Email Template --</option>
                {templates.filter(t => t.type.includes('email') || t.type === 'email_thankyou').map(t => (
                  <option key={t.id} value={t.id}>
                    {t.is_default ? '⭐ [Default] ' : t.organization_name ? `🏛️ [${t.organization_name}] ` : '📧 '}
                    {t.name}
                  </option>
                ))}
                {templates.filter(t => !t.type.includes('email') && !t.type.includes('whatsapp') && !t.type.includes('80g')).map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                ))}
              </select>
              <span style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                Template with dynamic placeholders (e.g. &#123;&#123;donor_name&#125;&#125;, &#123;&#123;donation_amount&#125;&#125;, &#123;&#123;receipt_url&#125;&#125;).
              </span>
            </div>
          )}

          {stepForm.step_type === 'send_whatsapp' && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>
                WhatsApp Template *
              </label>
              <select 
                value={stepForm.template_id || stepForm.config?.template_id || stepForm.config?.template_name || ''} 
                onChange={e => {
                  const val = e.target.value;
                  const selectedT = templates.find(t => t.id === val || t.name === val);
                  setStepForm({
                    ...stepForm,
                    template_id: selectedT ? selectedT.id : val,
                    config: {
                      ...stepForm.config,
                      template_id: selectedT ? selectedT.id : val,
                      template_name: selectedT ? selectedT.name : val
                    }
                  });
                }} 
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none', background: 'white', fontWeight: 500 }}
              >
                <option value="">-- Select NGO Aligned WhatsApp Template --</option>
                {templates.filter(t => t.type.includes('whatsapp')).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.is_default ? '⭐ [Default] ' : t.organization_name ? `🏛️ [${t.organization_name}] ` : '📱 '}
                    {t.name}
                  </option>
                ))}
                {templates.filter(t => t.type.includes('whatsapp')).length === 0 && (
                  <>
                    <option value="Default WhatsApp Payment Success Alert">📲 Default WhatsApp Payment Success Alert</option>
                    <option value="Default WhatsApp Payment Initiated Alert">⌛ Default WhatsApp Payment Initiated Alert</option>
                    <option value="Instant VIP Donor Thank-You & WhatsApp Receipt">📱 Instant VIP Donor Thank-You & WhatsApp Receipt</option>
                    <option value="Monthly Recurring Donor Appreciation Alert">🔁 Monthly Recurring Donor Appreciation Alert</option>
                  </>
                )}
              </select>
              <span style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                Select an approved WhatsApp message template aligned to this NGO workspace.
              </span>
            </div>
          )}

          {stepForm.step_type === 'wait' && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Wait Duration (Minutes)</label>
              <input 
                type="number" 
                value={stepForm.wait_duration_minutes || 1440} 
                onChange={e => setStepForm({...stepForm, wait_duration_minutes: Number(e.target.value)})} 
                placeholder="1440 = 24 hours"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none' }} 
              />
              <span style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', display: 'block' }}>Tip: 60 = 1 hour, 1440 = 1 day, 10080 = 1 week</span>
            </div>
          )}

          {stepForm.step_type === 'condition_split' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Donor Field</label>
                <input 
                  type="text" 
                  value={stepForm.config?.field || 'total_paid_amount'} 
                  onChange={e => setStepForm({...stepForm, config: {...stepForm.config, field: e.target.value}})} 
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Operator</label>
                <select 
                  value={stepForm.config?.operator || 'greater_than'} 
                  onChange={e => setStepForm({...stepForm, config: {...stepForm.config, operator: e.target.value}})} 
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: 'white' }}
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Does Not Equal</option>
                  <option value="greater_than">Greater Than (&gt;)</option>
                  <option value="less_than">Less Than (&lt;)</option>
                  <option value="contains">Contains</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Compare Value</label>
                <input 
                  type="text" 
                  value={stepForm.config?.value || '5000'} 
                  onChange={e => setStepForm({...stepForm, config: {...stepForm.config, value: e.target.value}})} 
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
                />
              </div>
            </div>
          )}

          {stepForm.step_type === 'goal_check' && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Goal Event</label>
              <select 
                value={stepForm.config?.goal_event || 'donation.completed'} 
                onChange={e => setStepForm({...stepForm, config: {...stepForm.config, goal_event: e.target.value}})} 
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none', background: 'white' }}
              >
                <option value="donation.completed">Donation Completed</option>
                <option value="subscription.created">Subscription Created</option>
                <option value="campaign.signup">Campaign Signup</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
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
              Apply Step
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
