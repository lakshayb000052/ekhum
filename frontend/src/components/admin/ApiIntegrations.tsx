import React, { useState, useEffect } from 'react';
import { DataTable } from '../shared/DataTable';
import { Modal } from '../shared/Modal';
import { StatusBadge } from '../shared/StatusBadge';
import { apiFetch } from '../shared/api';

export const ApiIntegrations: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'whatsapp' | 'email' | 'keys' | 'webhooks' | 'docs'>('overview');
  
  // Organization selector for Superadmin
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  // Overview Gateways State
  const [gateways, setGateways] = useState<any[]>([]);
  const [loadingGateways, setLoadingGateways] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // Communications State
  const [commLoading, setCommLoading] = useState(false);
  const [savingComm, setSavingComm] = useState(false);
  const [commFeedback, setCommFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // WhatsApp Config State
  const [waProvider, setWaProvider] = useState<'meta' | 'evolution_go' | 'none'>('evolution_go');
  const [metaWabaId, setMetaWabaId] = useState('');
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  
  const [evoApiUrl, setEvoApiUrl] = useState('http://localhost:8080');
  const [evoApiKey, setEvoApiKey] = useState('evolution-global-key-here');
  const [evoInstanceName, setEvoInstanceName] = useState('danapro_main');
  const [evoState, setEvoState] = useState<string | null>(null);
  const [checkingEvoState, setCheckingEvoState] = useState(false);

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrIsOffline, setQrIsOffline] = useState(false);
  const [qrIsConnected, setQrIsConnected] = useState(false);
  const [qrErrorDetail, setQrErrorDetail] = useState<string | null>(null);
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [instanceInitFeedback, setInstanceInitFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // WhatsApp Test Sender State
  const [testWaPhone, setTestWaPhone] = useState('8295886832');
  const [testWaMessage, setTestWaMessage] = useState('✨ *DanaPro Test Message*\n\nYour WhatsApp gateway is active and ready to deliver journey alerts! 🚀');
  const [sendingTestWa, setSendingTestWa] = useState(false);
  const [testWaResult, setTestWaResult] = useState<{ success: boolean; message: string } | null>(null);

  // Email Config State
  const [emailProvider, setEmailProvider] = useState<'ses' | 'smtp' | 'none'>('ses');
  const [emailSenderName, setEmailSenderName] = useState('DanaPro NGO');
  const [emailFromAddress, setEmailFromAddress] = useState('donations@danapro.org');
  const [emailReplyTo, setEmailReplyTo] = useState('');
  
  const [sesRegion, setSesRegion] = useState('ap-south-1');
  const [sesAccessKey, setSesAccessKey] = useState('');
  const [sesSecretKey, setSesSecretKey] = useState('');

  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);

  // Email Test Sender State
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testEmailSubject, setTestEmailSubject] = useState('DanaPro Email Gateway Connection Test');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyFormData, setKeyFormData] = useState({
    name: '',
    description: '',
    rate_limit_per_minute: 60,
    scopes: ['donations:read', 'contacts:read']
  });

  // Webhooks state
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [webhookFormData, setWebhookFormData] = useState({
    name: '',
    webhook_url: '',
    events_subscribed: ['donation.completed', 'mandate.failed']
  });

  useEffect(() => {
    checkUserRole();
    fetchGatewaysOverview();
    fetchApiKeys();
    fetchWebhooks();
  }, []);

  const checkUserRole = async () => {
    try {
      const orgData = await apiFetch('/api/superadmin/organizations');
      if (orgData && orgData.success && Array.isArray(orgData.organizations)) {
        setIsSuperadmin(true);
        setOrganizations(orgData.organizations);
        if (orgData.organizations.length > 0) {
          const firstOrgId = orgData.organizations[0].id;
          setSelectedOrgId(firstOrgId);
          fetchCommunications(firstOrgId);
        }
      } else {
        setIsSuperadmin(false);
        fetchCommunications();
      }
    } catch {
      setIsSuperadmin(false);
      fetchCommunications();
    }
  };

  const fetchGatewaysOverview = async () => {
    setLoadingGateways(true);
    try {
      const orgQuery = selectedOrgId ? `?organizationId=${selectedOrgId}` : '';
      const data = await apiFetch(`/api/integrations/gateways/overview${orgQuery}`);
      if (data && data.success && Array.isArray(data.gateways)) {
        setGateways(data.gateways);
      } else {
        setGateways([]);
      }
    } catch (err) {
      console.error('Failed to load gateways overview:', err);
      setGateways([]);
    } finally {
      setLoadingGateways(false);
    }
  };

  const handleDisconnectGateway = async (gateway: any) => {
    const confirmMsg = `Are you sure you want to disconnect and delete the ${gateway.type.toUpperCase()} gateway for ${gateway.organizationName}?\n\nThis will terminate active WhatsApp/Email sessions.`;
    if (!confirm(confirmMsg)) return;

    setDisconnectingId(gateway.id);
    try {
      const data = await apiFetch('/api/integrations/gateways/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: gateway.organizationId,
          type: gateway.type
        })
      });

      if (data && data.success) {
        setGateways(prev => prev.filter(g => g.id !== gateway.id));
        alert(`✅ ${data.message || 'Gateway disconnected successfully!'}`);
        await fetchGatewaysOverview();
        if (selectedOrgId === gateway.organizationId) {
          await fetchCommunications(selectedOrgId);
        }
      } else {
        alert(`❌ Failed: ${data?.message || 'Error disconnecting gateway'}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setDisconnectingId(null);
    }
  };

  const fetchCommunications = async (orgId?: string) => {
    setCommLoading(true);
    setCommFeedback(null);
    try {
      const url = orgId ? `/api/integrations/communications?organizationId=${orgId}` : '/api/integrations/communications';
      const data = await apiFetch(url);
      if (data && data.success && data.data) {
        const { whatsapp_config, email_config, organization_name } = data.data;
        const defaultOrgInstance = organization_name ? organization_name.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'danapro_main';
        
        // WhatsApp
        if (whatsapp_config) {
          setWaProvider(whatsapp_config.provider || 'evolution_go');
          if (whatsapp_config.meta) {
            setMetaWabaId(whatsapp_config.meta.waba_id || '');
            setMetaPhoneId(whatsapp_config.meta.phone_id || '');
            setMetaToken(whatsapp_config.meta.token || '');
          }
          if (whatsapp_config.evolution_go) {
            setEvoApiUrl(whatsapp_config.evolution_go.api_url || 'http://localhost:8080');
            setEvoApiKey(whatsapp_config.evolution_go.api_key || 'evolution-global-key-here');
            setEvoInstanceName(whatsapp_config.evolution_go.instance_name || defaultOrgInstance);
          }
        }

        // Email
        if (email_config) {
          setEmailProvider(email_config.provider || 'ses');
          setEmailSenderName(email_config.sender_name || '');
          setEmailFromAddress(email_config.from_email || '');
          setEmailReplyTo(email_config.reply_to || '');

          if (email_config.ses) {
            setSesRegion(email_config.ses.region || 'ap-south-1');
            setSesAccessKey(email_config.ses.access_key_id || '');
            setSesSecretKey(email_config.ses.secret_access_key || '');
          }
          if (email_config.smtp) {
            setSmtpHost(email_config.smtp.host || 'smtp.gmail.com');
            setSmtpPort(email_config.smtp.port || 587);
            setSmtpUser(email_config.smtp.user || '');
            setSmtpPass(email_config.smtp.pass || '');
            setSmtpSecure(Boolean(email_config.smtp.secure));
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load communication settings:', err);
    } finally {
      setCommLoading(false);
    }
  };

  const handleOrgChange = (newOrgId: string) => {
    setSelectedOrgId(newOrgId);
    fetchCommunications(newOrgId);
  };

  const handleSaveCommunications = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingComm(true);
    setCommFeedback(null);

    const payload = {
      organization_id: selectedOrgId || undefined,
      whatsapp_config: {
        provider: waProvider,
        meta: {
          waba_id: metaWabaId,
          phone_id: metaPhoneId,
          token: metaToken
        },
        evolution_go: {
          api_url: evoApiUrl,
          api_key: evoApiKey,
          instance_name: evoInstanceName
        }
      },
      email_config: {
        provider: emailProvider,
        sender_name: emailSenderName,
        from_email: emailFromAddress,
        reply_to: emailReplyTo,
        ses: {
          region: sesRegion,
          access_key_id: sesAccessKey,
          secret_access_key: sesSecretKey
        },
        smtp: {
          host: smtpHost,
          port: Number(smtpPort) || 587,
          user: smtpUser,
          pass: smtpPass,
          secure: smtpSecure
        }
      }
    };

    try {
      const data = await apiFetch('/api/integrations/communications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (data && data.success) {
        setCommFeedback({ type: 'success', message: '✅ Communication Gateways successfully updated and active!' });
        fetchGatewaysOverview();
      } else {
        setCommFeedback({ type: 'error', message: data?.message || 'Failed to save communication configurations.' });
      }
    } catch (err: any) {
      setCommFeedback({ type: 'error', message: err.message || 'Error saving communication configurations.' });
    } finally {
      setSavingComm(false);
    }
  };

  const handleCheckEvoStatus = async () => {
    setCheckingEvoState(true);
    setEvoState(null);
    try {
      const data = await apiFetch('/api/integrations/whatsapp/evolution/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: selectedOrgId || undefined,
          api_url: evoApiUrl,
          api_key: evoApiKey,
          instance_name: evoInstanceName
        })
      });
      if (data && data.success) {
        setEvoState(data.state || 'connected');
      } else {
        setEvoState(data?.error ? `error: ${data.error}` : 'disconnected');
      }
    } catch (err: any) {
      setEvoState('unreachable');
    } finally {
      setCheckingEvoState(false);
    }
  };

  const handleOpenQrModal = async () => {
    setIsQrModalOpen(true);
    setLoadingQr(true);
    setQrCodeData(null);
    setQrIsOffline(false);
    setQrIsConnected(false);
    setQrErrorDetail(null);
    setQrMessage(null);
    setInstanceInitFeedback(null);

    try {
      const data = await apiFetch('/api/integrations/whatsapp/evolution/qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: selectedOrgId || undefined,
          api_url: evoApiUrl,
          api_key: evoApiKey,
          instance_name: evoInstanceName
        })
      });
      
      if (data && data.success) {
        if (data.qrcode) {
          setQrCodeData(data.qrcode);
        } else if (data.isConnected) {
          setQrIsConnected(true);
          setQrMessage(data.message || 'Instance is already connected & paired with WhatsApp!');
        }
      } else {
        setQrIsOffline(Boolean(data?.isOffline));
        setQrErrorDetail(data?.error || data?.message || 'Unable to retrieve QR code from Evolution Go.');
      }
    } catch (err: any) {
      setQrIsOffline(true);
      setQrErrorDetail(err.message || 'Connection error to Evolution Go server.');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleCreateInstance = async () => {
    setCreatingInstance(true);
    setInstanceInitFeedback(null);
    try {
      const data = await apiFetch('/api/integrations/whatsapp/evolution/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: selectedOrgId || undefined,
          api_url: evoApiUrl,
          api_key: evoApiKey,
          instance_name: evoInstanceName
        })
      });
      if (data && data.success) {
        setInstanceInitFeedback({ success: true, message: `✅ Instance [${evoInstanceName}] initialized successfully! Requesting QR code...` });
        setTimeout(() => {
          handleOpenQrModal();
        }, 1000);
      } else {
        setInstanceInitFeedback({ success: false, message: `❌ ${data?.error || data?.message || 'Failed to initialize instance.'}` });
      }
    } catch (err: any) {
      setInstanceInitFeedback({ success: false, message: `❌ Exception: ${err.message}` });
    } finally {
      setCreatingInstance(false);
    }
  };

  const handleLogoutInstance = async () => {
    if (!confirm(`Are you sure you want to disconnect instance [${evoInstanceName}] from WhatsApp and generate a new pairing QR code?`)) return;
    setLoadingQr(true);
    setQrIsConnected(false);
    setQrCodeData(null);
    try {
      await apiFetch('/api/integrations/whatsapp/evolution/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: selectedOrgId || undefined,
          api_url: evoApiUrl,
          api_key: evoApiKey,
          instance_name: evoInstanceName
        })
      });
      fetchGatewaysOverview();
      setTimeout(() => {
        handleOpenQrModal();
      }, 1000);
    } catch (err: any) {
      alert(`Error logging out: ${err.message}`);
      setLoadingQr(false);
    }
  };

  const handleGenerateMockQr = () => {
    const mockPayload = `2@DanaProPairing_${Date.now()}_${evoInstanceName}_SecretMockKey`;
    setQrCodeData(mockPayload);
    setQrIsOffline(false);
    setQrErrorDetail(null);
    setQrMessage('🧪 Dev Pairing Simulator Active. Point camera to test QR layout.');
  };

  const handleSendTestWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testWaPhone) return;
    setSendingTestWa(true);
    setTestWaResult(null);
    try {
      const data = await apiFetch('/api/integrations/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: selectedOrgId || undefined,
          phone: testWaPhone,
          message: testWaMessage,
          provider: waProvider,
          api_url: evoApiUrl,
          api_key: evoApiKey,
          instance_name: evoInstanceName,
          meta: {
            waba_id: metaWabaId,
            phone_id: metaPhoneId,
            token: metaToken
          }
        })
      });
      if (data && data.success) {
        setTestWaResult({ success: true, message: `✅ ${data.message || 'WhatsApp message delivered successfully!'}` });
      } else {
        setTestWaResult({ success: false, message: `❌ ${data?.error || data?.message || 'Failed to dispatch WhatsApp message.'}` });
      }
    } catch (err: any) {
      setTestWaResult({ success: false, message: `❌ ${err.message}` });
    } finally {
      setSendingTestWa(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailAddress) return;
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const data = await apiFetch('/api/integrations/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: selectedOrgId || undefined,
          email: testEmailAddress,
          subject: testEmailSubject
        })
      });
      if (data && data.success) {
        setTestEmailResult({ success: true, message: `✅ ${data.message || 'Test email dispatched successfully!'}` });
      } else {
        setTestEmailResult({ success: false, message: `❌ ${data?.error || data?.message || 'Failed to dispatch test email.'}` });
      }
    } catch (err: any) {
      setTestEmailResult({ success: false, message: `❌ Exception: ${err.message}` });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const fetchApiKeys = async () => {
    setKeysLoading(true);
    try {
      const data = await apiFetch('/api/integrations/keys');
      if (data && data.success) {
        setApiKeys(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      console.error('Failed to load API keys:', err);
    } finally {
      setKeysLoading(false);
    }
  };

  const fetchWebhooks = async () => {
    setWebhooksLoading(true);
    try {
      const data = await apiFetch('/api/integrations');
      if (data && data.success) {
        setWebhooks(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      console.error('Failed to load webhooks:', err);
    } finally {
      setWebhooksLoading(false);
    }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiFetch('/api/integrations/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...keyFormData,
          organization_id: selectedOrgId || undefined
        })
      });
      if (data && data.success && data.data) {
        setCreatedKey(data.data.full_key || data.data.key_prefix);
        fetchApiKeys();
      }
    } catch (err) {
      console.error('Failed to generate key:', err);
      alert('Error generating API key');
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? Applications using this key will be disconnected immediately.')) return;
    try {
      const data = await apiFetch(`/api/integrations/keys/${id}`, { method: 'DELETE' });
      if (data && data.success) {
        fetchApiKeys();
      }
    } catch (err) {
      console.error('Failed to revoke key:', err);
    }
  };

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiFetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...webhookFormData,
          organization_id: selectedOrgId || undefined
        })
      });
      if (data && data.success) {
        setIsWebhookModalOpen(false);
        setWebhookFormData({
          name: '',
          webhook_url: '',
          events_subscribed: ['donation.completed', 'mandate.failed']
        });
        fetchWebhooks();
      }
    } catch (err) {
      console.error('Failed to add webhook:', err);
      alert('Error saving webhook');
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook endpoint?')) return;
    try {
      const data = await apiFetch(`/api/integrations/${id}`, { method: 'DELETE' });
      if (data && data.success) {
        fetchWebhooks();
      }
    } catch (err) {
      console.error('Failed to delete webhook:', err);
    }
  };

  const availableScopes = [
    { id: 'donations:read', label: 'Donations: Read' },
    { id: 'donations:write', label: 'Donations: Write' },
    { id: 'contacts:read', label: 'Contacts / Donors: Read' },
    { id: 'contacts:write', label: 'Contacts: Write' },
    { id: 'mandates:read', label: 'Mandates & Subscriptions: Read' },
    { id: 'reports:read', label: 'Reports: Read' }
  ];

  const availableEvents = [
    'donation.completed',
    'donation.failed',
    'subscription.created',
    'subscription.cancelled',
    'mandate.created',
    'mandate.failed',
    'contact.created',
    'receipt.generated'
  ];

  const keyColumns = [
    { 
      key: 'name', 
      label: 'Key Name', 
      render: (val: any, row: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0F172A' }}>{val}</div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>{row.description || 'No description'}</div>
        </div>
      ) 
    },
    { 
      key: 'key_prefix', 
      label: 'Key Prefix', 
      render: (val: any) => (
        <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#0F172A', fontWeight: 600 }}>
          {val}...
        </code>
      ) 
    },
    { 
      key: 'scopes', 
      label: 'Permissions / Scopes', 
      render: (val: any) => {
        let list: string[] = [];
        try {
          list = typeof val === 'string' ? JSON.parse(val) : (Array.isArray(val) ? val : []);
        } catch (e) {
          list = [String(val)];
        }
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {list.map((sc, idx) => (
              <span key={idx} style={{ background: '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                {sc}
              </span>
            ))}
          </div>
        );
      } 
    },
    { 
      key: 'status', 
      label: 'Status', 
      render: (val: any) => <StatusBadge status={val || 'active'} /> 
    },
    { 
      key: 'created_at', 
      label: 'Created', 
      render: (val: any) => val ? new Date(val).toLocaleDateString() : 'N/A' 
    },
    { 
      key: 'actions', 
      label: 'Actions', 
      render: (_: any, row: any) => (
        row.status !== 'revoked' ? (
          <button 
            onClick={() => handleRevokeKey(row.id)} 
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            Revoke
          </button>
        ) : (
          <span style={{ color: '#94A3B8', fontSize: '12px' }}>Revoked</span>
        )
      ) 
    }
  ];

  const webhookColumns = [
    { 
      key: 'name', 
      label: 'Webhook Name', 
      render: (val: any) => <strong style={{ color: '#0F172A' }}>{val}</strong> 
    },
    { 
      key: 'webhook_url', 
      label: 'Endpoint URL', 
      render: (val: any) => (
        <code style={{ background: '#F8FAFC', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#0369A1', wordBreak: 'break-all' }}>
          {val}
        </code>
      ) 
    },
    { 
      key: 'events_subscribed', 
      label: 'Subscribed Events', 
      render: (val: any) => {
        let list: string[] = [];
        try {
          list = typeof val === 'string' ? JSON.parse(val) : (Array.isArray(val) ? val : []);
        } catch (e) {
          list = [String(val)];
        }
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {list.map((ev, idx) => (
              <span key={idx} style={{ background: '#ECFDF5', color: '#059669', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                ⚡ {ev}
              </span>
            ))}
          </div>
        );
      } 
    },
    { 
      key: 'status', 
      label: 'Status', 
      render: (val: any) => <StatusBadge status={val || 'active'} /> 
    },
    { 
      key: 'actions', 
      label: 'Actions', 
      render: (_: any, row: any) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => handleDeleteWebhook(row.id)} 
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
          >
            Delete
          </button>
        </div>
      ) 
    }
  ];

  return (
    <div style={{ padding: '24px', background: '#F8FAFC', minHeight: '100vh', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>Communication & API Gateways</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Manage linked WhatsApp devices, Evolution Go sessions, Meta API tokens, and AWS SES/SMTP mailers across all NGOs.
          </p>
        </div>

        {/* Superadmin NGO Switcher */}
        {isSuperadmin && organizations.length > 0 && (
          <div style={{ background: 'white', padding: '8px 16px', borderRadius: '10px', border: '1.5px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>🏢 Selected NGO:</span>
            <select 
              value={selectedOrgId} 
              onChange={e => handleOrgChange(e.target.value)}
              style={{ border: 'none', background: '#F1F5F9', padding: '6px 12px', borderRadius: '6px', fontWeight: 700, color: '#0F172A', outline: 'none', cursor: 'pointer' }}
            >
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0', marginBottom: '24px', background: 'white', padding: '8px 16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', flexWrap: 'wrap' }}>
        {[
          { key: 'overview', label: '📱 Connected Devices & Gateways', count: gateways.length },
          { key: 'whatsapp', label: '💬 WhatsApp Setup & Pairing' },
          { key: 'email', label: '✉️ Email Delivery (SES / SMTP)' },
          { key: 'keys', label: '🔑 API Keys', count: apiKeys.length },
          { key: 'webhooks', label: '⚡ Webhooks', count: webhooks.length },
          { key: 'docs', label: '📖 Developer Docs' }
        ].map(tab => (
          <button 
            key={tab.key} 
            onClick={() => {
              setActiveTab(tab.key as any);
              if (tab.key === 'overview') fetchGatewaysOverview();
            }}
            style={{ 
              background: activeTab === tab.key ? '#059669' : 'transparent', 
              color: activeTab === tab.key ? '#FFFFFF' : '#64748B',
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: 600, 
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span style={{ 
                background: activeTab === tab.key ? 'rgba(255,255,255,0.25)' : '#F1F5F9', 
                color: activeTab === tab.key ? '#FFFFFF' : '#475569', 
                padding: '1px 6px', 
                borderRadius: '10px', 
                fontSize: '11px' 
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 0: CONNECTED GATEWAYS OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Metrics Summary Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Active WhatsApp Devices</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💬</span>
                <span>{gateways.filter(g => g.type === 'whatsapp' && g.status === 'connected').length}</span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748B' }}>/ {gateways.filter(g => g.type === 'whatsapp').length} Configured</span>
              </div>
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Email Delivery Channels</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284C7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✉️</span>
                <span>{gateways.filter(g => g.type === 'email' && g.status === 'connected').length}</span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748B' }}>Active Channels</span>
              </div>
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Live Engine Status</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
                <span>Evolution Go Microservice Online</span>
              </div>
            </div>
          </div>

          {/* Connected Gateways Table */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>Active WhatsApp & Email Gateway Connections</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                  Live overview of all WhatsApp accounts, paired mobile devices, and email delivery routes assigned to NGOs.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={fetchGatewaysOverview} 
                  disabled={loadingGateways}
                  style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#334155', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                >
                  🔄 Refresh List
                </button>
                <button 
                  onClick={() => setActiveTab('whatsapp')}
                  style={{ background: '#059669', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                >
                  + Connect New Gateway
                </button>
              </div>
            </div>

            {loadingGateways ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                ⏳ Loading connected gateway devices...
              </div>
            ) : gateways.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📲</div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>No Gateway Connections Configured Yet</h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748B' }}>
                  Pair your WhatsApp number or enter AWS SES/SMTP credentials to start sending automated receipts and messages.
                </p>
                <button 
                  onClick={() => setActiveTab('whatsapp')}
                  style={{ background: '#059669', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                >
                  Pair WhatsApp via QR Code
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                      <th style={{ padding: '12px 16px' }}>Organization (NGO)</th>
                      <th style={{ padding: '12px 16px' }}>Gateway Type</th>
                      <th style={{ padding: '12px 16px' }}>Provider Engine</th>
                      <th style={{ padding: '12px 16px' }}>Connected Account / Phone</th>
                      <th style={{ padding: '12px 16px' }}>Instance / Identifier</th>
                      <th style={{ padding: '12px 16px' }}>Live Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gateways.map((g) => (
                      <tr key={g.id} style={{ borderBottom: '1px solid #E2E8F0', transition: 'background 0.15s' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <strong style={{ color: '#0F172A', display: 'block' }}>{g.organizationName}</strong>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>slug: {g.organizationSlug}</span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ 
                            background: g.type === 'whatsapp' ? '#ECFDF5' : '#E0F2FE', 
                            color: g.type === 'whatsapp' ? '#065F46' : '#0369A1', 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            fontWeight: 700, 
                            fontSize: '11px' 
                          }}>
                            {g.type === 'whatsapp' ? '💬 WhatsApp' : '✉️ Email'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#334155', fontWeight: 600 }}>
                          {g.providerLabel}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {g.connectedPhone ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0F172A' }}>
                              <span style={{ color: '#059669' }}>●</span>
                              <span>{g.connectedPhone}</span>
                            </div>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '12px' }}>Awaiting scan</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#0369A1' }}>
                            {g.identifier}
                          </code>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ 
                            background: g.status === 'connected' ? '#DCFCE7' : g.status === 'connecting' ? '#FEF3C7' : '#FEE2E2',
                            color: g.status === 'connected' ? '#166534' : g.status === 'connecting' ? '#92400E' : '#991B1B',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>{g.status === 'connected' ? '🟢 Active & Linked' : g.status === 'connecting' ? '🟡 Connecting' : '🔴 Inactive / Offline'}</span>
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button 
                              onClick={() => {
                                handleOrgChange(g.organizationId);
                                setActiveTab(g.type as any);
                              }}
                              style={{ padding: '4px 10px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '6px', color: '#334155', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              ⚙️ Edit
                            </button>
                            <button 
                              onClick={() => handleDisconnectGateway(g)}
                              disabled={disconnectingId === g.id}
                              style={{ padding: '4px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#DC2626', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              {disconnectingId === g.id ? 'Disconnecting...' : '🔌 Disconnect & Delete'}
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
        </div>
      )}

      {/* TAB 1: WHATSAPP GATEWAY */}
      {activeTab === 'whatsapp' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
          {/* Main Config Card */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>WhatsApp Gateway Configuration</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                  Choose whether this NGO dispatches WhatsApp messages via Official Meta Cloud API or Evolution Go (whatsmeow).
                </p>
              </div>
            </div>

            {commFeedback && (
              <div style={{ 
                padding: '12px 16px', 
                borderRadius: '8px', 
                marginBottom: '20px', 
                fontSize: '13px', 
                fontWeight: 600,
                background: commFeedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                color: commFeedback.type === 'success' ? '#065F46' : '#991B1B',
                border: `1px solid ${commFeedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`
              }}>
                {commFeedback.message}
              </div>
            )}

            <form onSubmit={handleSaveCommunications}>
              {/* Provider Radio Toggle */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#334155', marginBottom: '10px' }}>
                  Select Active WhatsApp Provider:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {/* Meta Option */}
                  <div 
                    onClick={() => setWaProvider('meta')}
                    style={{ 
                      border: `2px solid ${waProvider === 'meta' ? '#059669' : '#E2E8F0'}`,
                      background: waProvider === 'meta' ? '#F0FDF4' : '#FFFFFF',
                      padding: '14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <input 
                        type="radio" 
                        name="waProvider" 
                        checked={waProvider === 'meta'} 
                        onChange={() => setWaProvider('meta')}
                        style={{ accentColor: '#059669' }}
                      />
                      <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>Meta WhatsApp Cloud API</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748B', lineHeight: '1.4' }}>
                      Official enterprise API hosted on Meta Graph. Verified sender trust.
                    </p>
                  </div>

                  {/* Evolution Go Option */}
                  <div 
                    onClick={() => setWaProvider('evolution_go')}
                    style={{ 
                      border: `2px solid ${waProvider === 'evolution_go' ? '#059669' : '#E2E8F0'}`,
                      background: waProvider === 'evolution_go' ? '#F0FDF4' : '#FFFFFF',
                      padding: '14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <input 
                        type="radio" 
                        name="waProvider" 
                        checked={waProvider === 'evolution_go'} 
                        onChange={() => setWaProvider('evolution_go')}
                        style={{ accentColor: '#059669' }}
                      />
                      <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>Evolution Go (whatsmeow)</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748B', lineHeight: '1.4' }}>
                      Self-hosted Golang microservice with live QR code mobile pairing.
                    </p>
                  </div>

                  {/* Disabled Option */}
                  <div 
                    onClick={() => setWaProvider('none')}
                    style={{ 
                      border: `2px solid ${waProvider === 'none' ? '#EF4444' : '#E2E8F0'}`,
                      background: waProvider === 'none' ? '#FEF2F2' : '#FFFFFF',
                      padding: '14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <input 
                        type="radio" 
                        name="waProvider" 
                        checked={waProvider === 'none'} 
                        onChange={() => setWaProvider('none')}
                        style={{ accentColor: '#EF4444' }}
                      />
                      <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>🚫 Disabled (None)</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748B', lineHeight: '1.4' }}>
                      Disable WhatsApp dispatch for this NGO. No messages or receipts sent via WhatsApp.
                    </p>
                  </div>
                </div>
              </div>

              {/* META CONFIG FIELDS */}
              {waProvider === 'meta' && (
                <div style={{ background: '#F8FAFC', padding: '18px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Meta WhatsApp Credentials</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>WhatsApp Business Account ID (WABA ID)</label>
                      <input 
                        type="text" 
                        value={metaWabaId} 
                        onChange={e => setMetaWabaId(e.target.value)}
                        placeholder="e.g. 102938475610293"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Phone Number ID</label>
                      <input 
                        type="text" 
                        value={metaPhoneId} 
                        onChange={e => setMetaPhoneId(e.target.value)}
                        placeholder="e.g. 594039281746502"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Permanent System User Access Token</label>
                    <input 
                      type="password" 
                      value={metaToken} 
                      onChange={e => setMetaToken(e.target.value)}
                      placeholder="EAAG..."
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              )}

              {/* EVOLUTION GO CONFIG FIELDS */}
              {waProvider === 'evolution_go' && (
                <div style={{ background: '#F8FAFC', padding: '18px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Evolution Go Endpoint & Instance Settings</h4>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        type="button" 
                        onClick={handleCheckEvoStatus} 
                        disabled={checkingEvoState}
                        style={{ background: '#E0F2FE', color: '#0284C7', border: '1px solid #BAE6FD', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {checkingEvoState ? 'Checking...' : '🔍 Ping Status'}
                      </button>
                      <button 
                        type="button" 
                        onClick={handleOpenQrModal} 
                        style={{ background: '#059669', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        📲 Pair QR Code
                      </button>
                    </div>
                  </div>

                  {evoState && (
                    <div style={{ marginBottom: '14px', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: evoState === 'open' || evoState === 'connected' ? '#DCFCE7' : '#FEF3C7', color: evoState === 'open' || evoState === 'connected' ? '#166534' : '#92400E' }}>
                      Instance Status: {evoState}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Evolution Go REST API URL</label>
                      <input 
                        type="url" 
                        value={evoApiUrl} 
                        onChange={e => setEvoApiUrl(e.target.value)}
                        placeholder="http://localhost:8080 or https://wa.yourdomain.com"
                        required
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Instance Identifier Name</label>
                      <input 
                        type="text" 
                        value={evoInstanceName} 
                        onChange={e => setEvoInstanceName(e.target.value)}
                        placeholder="suite_test_foundation"
                        required
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Global API Key / Instance Token</label>
                    <input 
                      type="password" 
                      value={evoApiKey} 
                      onChange={e => setEvoApiKey(e.target.value)}
                      placeholder="evolution-global-key-here"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={savingComm || commLoading}
                style={{ 
                  background: '#059669', 
                  color: 'white', 
                  border: 'none', 
                  padding: '12px 24px', 
                  borderRadius: '8px', 
                  fontWeight: 700, 
                  fontSize: '14px', 
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
                }}
              >
                {savingComm ? 'Saving Settings...' : '💾 Save WhatsApp Gateway Configuration'}
              </button>
            </form>
          </div>

          {/* Test Dispatch Card */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>🧪 Live WhatsApp Test Dispatcher</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748B' }}>
              Dispatch a live WhatsApp test message using the active provider ({waProvider === 'meta' ? 'Meta Cloud API' : 'Evolution Go'}).
            </p>

            {testWaResult && (
              <div style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                marginBottom: '16px', 
                fontSize: '12px', 
                fontWeight: 600,
                background: testWaResult.success ? '#ECFDF5' : '#FEF2F2',
                color: testWaResult.success ? '#065F46' : '#991B1B',
                border: `1px solid ${testWaResult.success ? '#A7F3D0' : '#FECACA'}`
              }}>
                {testWaResult.message}
              </div>
            )}

            <form onSubmit={handleSendTestWhatsApp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Recipient Mobile Number</label>
                <input 
                  type="text" 
                  value={testWaPhone} 
                  onChange={e => setTestWaPhone(e.target.value)}
                  placeholder="e.g. 8295886832"
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Test Message Content</label>
                <textarea 
                  rows={4}
                  value={testWaMessage} 
                  onChange={e => setTestWaMessage(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', fontFamily: 'sans-serif' }}
                />
              </div>
              <button 
                type="submit" 
                disabled={sendingTestWa}
                style={{ 
                  background: '#0F172A', 
                  color: 'white', 
                  border: 'none', 
                  padding: '10px 16px', 
                  borderRadius: '6px', 
                  fontWeight: 600, 
                  fontSize: '13px', 
                  cursor: 'pointer' 
                }}
              >
                {sendingTestWa ? 'Sending...' : '🚀 Dispatch Test WhatsApp'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: EMAIL DELIVERY */}
      {activeTab === 'email' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
          {/* Main Config Card */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>Email Delivery Gateway Configuration</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                Configure per-NGO email credentials (AWS SES or Custom SMTP) to ensure 80G tax receipts and journey emails are sent under the NGO's official identity.
              </p>
            </div>

            {commFeedback && (
              <div style={{ 
                padding: '12px 16px', 
                borderRadius: '8px', 
                marginBottom: '20px', 
                fontSize: '13px', 
                fontWeight: 600,
                background: commFeedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                color: commFeedback.type === 'success' ? '#065F46' : '#991B1B',
                border: `1px solid ${commFeedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`
              }}>
                {commFeedback.message}
              </div>
            )}

            <form onSubmit={handleSaveCommunications}>
              {/* Sender Identities */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Sender Display Name</label>
                  <input 
                    type="text" 
                    value={emailSenderName} 
                    onChange={e => setEmailSenderName(e.target.value)}
                    placeholder="e.g. ChildFund India"
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>From Email Address</label>
                  <input 
                    type="email" 
                    value={emailFromAddress} 
                    onChange={e => setEmailFromAddress(e.target.value)}
                    placeholder="donations@yourngo.org"
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Provider Radio Toggle */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#334155', marginBottom: '10px' }}>
                  Select Active Email Provider:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {/* SES Option */}
                  <div 
                    onClick={() => setEmailProvider('ses')}
                    style={{ 
                      border: `2px solid ${emailProvider === 'ses' ? '#059669' : '#E2E8F0'}`,
                      background: emailProvider === 'ses' ? '#F0FDF4' : '#FFFFFF',
                      padding: '14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <input 
                        type="radio" 
                        name="emailProvider" 
                        checked={emailProvider === 'ses'} 
                        onChange={() => setEmailProvider('ses')}
                        style={{ accentColor: '#059669' }}
                      />
                      <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>AWS SES Cloud Mail</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748B', lineHeight: '1.4' }}>
                      High deliverability, scalable cloud mail infrastructure.
                    </p>
                  </div>

                  {/* SMTP Option */}
                  <div 
                    onClick={() => setEmailProvider('smtp')}
                    style={{ 
                      border: `2px solid ${emailProvider === 'smtp' ? '#059669' : '#E2E8F0'}`,
                      background: emailProvider === 'smtp' ? '#F0FDF4' : '#FFFFFF',
                      padding: '14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <input 
                        type="radio" 
                        name="emailProvider" 
                        checked={emailProvider === 'smtp'} 
                        onChange={() => setEmailProvider('smtp')}
                        style={{ accentColor: '#059669' }}
                      />
                      <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>Custom SMTP Server</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748B', lineHeight: '1.4' }}>
                      Gmail Workspace, Mailgun, SendGrid, or private mail server.
                    </p>
                  </div>

                  {/* Disabled Option */}
                  <div 
                    onClick={() => setEmailProvider('none')}
                    style={{ 
                      border: `2px solid ${emailProvider === 'none' ? '#EF4444' : '#E2E8F0'}`,
                      background: emailProvider === 'none' ? '#FEF2F2' : '#FFFFFF',
                      padding: '14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <input 
                        type="radio" 
                        name="emailProvider" 
                        checked={emailProvider === 'none'} 
                        onChange={() => setEmailProvider('none')}
                        style={{ accentColor: '#EF4444' }}
                      />
                      <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>🚫 Disabled (None)</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748B', lineHeight: '1.4' }}>
                      Disable email dispatch for this NGO. No automated emails or receipts sent.
                    </p>
                  </div>
                </div>
              </div>

              {/* SES CONFIG FIELDS */}
              {emailProvider === 'ses' && (
                <div style={{ background: '#F8FAFC', padding: '18px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>AWS SES Configuration (Optional Custom Keys)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>AWS Region</label>
                      <input 
                        type="text" 
                        value={sesRegion} 
                        onChange={e => setSesRegion(e.target.value)}
                        placeholder="ap-south-1"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>AWS Access Key ID (leave empty for platform default)</label>
                      <input 
                        type="text" 
                        value={sesAccessKey} 
                        onChange={e => setSesAccessKey(e.target.value)}
                        placeholder="AKIA..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>AWS Secret Access Key</label>
                    <input 
                      type="password" 
                      value={sesSecretKey} 
                      onChange={e => setSesSecretKey(e.target.value)}
                      placeholder="Secret access key..."
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              )}

              {/* SMTP CONFIG FIELDS */}
              {emailProvider === 'smtp' && (
                <div style={{ background: '#F8FAFC', padding: '18px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>SMTP Server Credentials</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>SMTP Host</label>
                      <input 
                        type="text" 
                        value={smtpHost} 
                        onChange={e => setSmtpHost(e.target.value)}
                        placeholder="smtp.mailgun.org or smtp.gmail.com"
                        required
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>SMTP Port</label>
                      <input 
                        type="number" 
                        value={smtpPort} 
                        onChange={e => setSmtpPort(Number(e.target.value))}
                        placeholder="587"
                        required
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>SMTP Username</label>
                      <input 
                        type="text" 
                        value={smtpUser} 
                        onChange={e => setSmtpUser(e.target.value)}
                        placeholder="user@yourdomain.com"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>SMTP Password / App Password</label>
                      <input 
                        type="password" 
                        value={smtpPass} 
                        onChange={e => setSmtpPass(e.target.value)}
                        placeholder="••••••••••••"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={smtpSecure} 
                      onChange={e => setSmtpSecure(e.target.checked)}
                      style={{ accentColor: '#059669' }}
                    />
                    <span>Use SSL/TLS secure connection (Port 465)</span>
                  </label>
                </div>
              )}

              <button 
                type="submit" 
                disabled={savingComm || commLoading}
                style={{ 
                  background: '#059669', 
                  color: 'white', 
                  border: 'none', 
                  padding: '12px 24px', 
                  borderRadius: '8px', 
                  fontWeight: 700, 
                  fontSize: '14px', 
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
                }}
              >
                {savingComm ? 'Saving Settings...' : '💾 Save Email Gateway Configuration'}
              </button>
            </form>
          </div>

          {/* Test Email Dispatch Card */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>🧪 Live Email Test Dispatcher</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748B' }}>
              Dispatch a test verification email to verify delivery through the active provider ({emailProvider.toUpperCase()}).
            </p>

            {testEmailResult && (
              <div style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                marginBottom: '16px', 
                fontSize: '12px', 
                fontWeight: 600,
                background: testEmailResult.success ? '#ECFDF5' : '#FEF2F2',
                color: testEmailResult.success ? '#065F46' : '#991B1B',
                border: `1px solid ${testEmailResult.success ? '#A7F3D0' : '#FECACA'}`
              }}>
                {testEmailResult.message}
              </div>
            )}

            <form onSubmit={handleSendTestEmail} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Recipient Email</label>
                <input 
                  type="email" 
                  value={testEmailAddress} 
                  onChange={e => setTestEmailAddress(e.target.value)}
                  placeholder="donor@example.com"
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Subject Line</label>
                <input 
                  type="text" 
                  value={testEmailSubject} 
                  onChange={e => setTestEmailSubject(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
              <button 
                type="submit" 
                disabled={sendingTestEmail}
                style={{ 
                  background: '#0F172A', 
                  color: 'white', 
                  border: 'none', 
                  padding: '10px 16px', 
                  borderRadius: '6px', 
                  fontWeight: 600, 
                  fontSize: '13px', 
                  cursor: 'pointer' 
                }}
              >
                {sendingTestEmail ? 'Dispatching...' : '🚀 Send Test Email'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: API KEYS */}
      {activeTab === 'keys' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>Active API Credentials</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                Use these Bearer tokens to authenticate external API requests to DanaPro endpoints.
              </p>
            </div>
            <button 
              onClick={() => { setCreatedKey(null); setIsKeyModalOpen(true); }}
              style={{ background: '#059669', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              + Generate New API Key
            </button>
          </div>

          <DataTable 
            columns={keyColumns} 
            data={apiKeys} 
            loading={keysLoading} 
            emptyMessage="No API keys generated yet. Click '+ Generate New API Key' to create one."
          />
        </div>
      )}

      {/* TAB 4: WEBHOOKS */}
      {activeTab === 'webhooks' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>Registered Webhook Listeners</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                Receive real-time HTTP POST event notifications whenever donations complete, mandates fail, or contacts are created.
              </p>
            </div>
            <button 
              onClick={() => setIsWebhookModalOpen(true)}
              style={{ background: '#059669', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              + Register Webhook
            </button>
          </div>

          <DataTable 
            columns={webhookColumns} 
            data={webhooks} 
            loading={webhooksLoading} 
            emptyMessage="No webhooks registered yet. Click '+ Register Webhook' to add an endpoint."
          />
        </div>
      )}

      {/* TAB 5: DOCS */}
      {activeTab === 'docs' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', fontWeight: 700, color: '#0F172A' }}>DanaPro API & Developer Quickstart</h2>
          <p style={{ color: '#64748B', lineHeight: '1.6', fontSize: '0.95rem' }}>
            DanaPro exposes authenticated REST endpoints and multi-provider communication hooks to seamlessly connect external donation channels, journey triggers, and custom CRM syncs.
          </p>

          <div style={{ margin: '24px 0' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>1. Authenticating API Requests</h3>
            <p style={{ color: '#475569', fontSize: '0.9rem' }}>Pass your generated API key in the <code>Authorization</code> header:</p>
            <pre style={{ background: '#0F172A', color: '#38BDF8', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '13px' }}>
{`curl -X GET https://api.danapro.org/api/donations \\
  -H "Authorization: Bearer ek_live_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json"`}
            </pre>
          </div>

          <div style={{ margin: '24px 0' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>2. Dispatching Journey & WhatsApp Webhook Events</h3>
            <p style={{ color: '#475569', fontSize: '0.9rem' }}>All journey steps configured with <code>send_whatsapp</code> dynamically route through the NGO's active provider (Meta or Evolution Go).</p>
          </div>
        </div>
      )}

      {/* MODAL: QR CODE SCANNER (EVOLUTION GO) */}
      <Modal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} title="📲 Scan WhatsApp Pairing QR Code">
        <div style={{ textAlign: 'center', padding: '12px' }}>
          <p style={{ color: '#475569', fontSize: '0.9rem', margin: '0 0 16px 0', fontWeight: 500 }}>
            Open WhatsApp on your phone → <strong>Linked Devices</strong> → <strong>Link a Device</strong> → Point camera at this QR code.
          </p>

          {loadingQr && (
            <div style={{ padding: '40px', color: '#059669', fontWeight: 600 }}>
              ⏳ Connecting to Evolution Go instance [{evoInstanceName}] and generating QR code...
            </div>
          )}

          {instanceInitFeedback && (
            <div style={{ 
              marginBottom: '16px', 
              padding: '10px 14px', 
              borderRadius: '8px', 
              fontSize: '12px', 
              fontWeight: 600,
              background: instanceInitFeedback.success ? '#ECFDF5' : '#FEF2F2',
              color: instanceInitFeedback.success ? '#065F46' : '#991B1B',
              border: `1px solid ${instanceInitFeedback.success ? '#A7F3D0' : '#FECACA'}`
            }}>
              {instanceInitFeedback.message}
            </div>
          )}

          {!loadingQr && qrIsConnected && (
            <div style={{ padding: '24px', background: '#ECFDF5', border: '1.5px solid #A7F3D0', borderRadius: '12px', color: '#065F46', marginBottom: '16px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎉</div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 700 }}>Instance Connected & Paired!</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#047857' }}>
                {qrMessage || 'This Evolution Go instance is actively linked with WhatsApp. You can send journey messages immediately.'}
              </p>
            </div>
          )}

          {!loadingQr && qrCodeData && !qrIsConnected && (
            <div>
              {qrMessage && (
                <div style={{ marginBottom: '12px', fontSize: '12px', color: '#0284C7', background: '#E0F2FE', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}>
                  {qrMessage}
                </div>
              )}
              <div style={{ display: 'inline-block', padding: '16px', background: 'white', borderRadius: '12px', border: '2px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                {qrCodeData.startsWith('data:image') || qrCodeData.startsWith('http') ? (
                  <img src={qrCodeData} alt="WhatsApp QR" style={{ width: '260px', height: '260px' }} />
                ) : (
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrCodeData)}`} alt="WhatsApp QR" style={{ width: '260px', height: '260px' }} />
                )}
              </div>
              <p style={{ fontSize: '11px', color: '#64748B', marginTop: '8px' }}>
                QR code refreshes automatically every 30 seconds.
              </p>
            </div>
          )}

          {!loadingQr && !qrCodeData && !qrIsConnected && (
            <div style={{ textAlign: 'left', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '18px', color: '#991B1B' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <strong style={{ fontSize: '14px' }}>Evolution Go Instance Unavailable</strong>
              </div>
              
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', lineHeight: '1.4' }}>
                {qrErrorDetail || `Unable to reach Evolution Go microservice at ${evoApiUrl}.`}
              </p>

              {qrIsOffline && (
                <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #FCA5A5', marginTop: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#7F1D1D', display: 'block', marginBottom: '6px' }}>
                    🚀 How to start Evolution Go locally or on your server:
                  </span>
                  <div style={{ background: '#0F172A', color: '#38BDF8', padding: '8px 10px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace', overflowX: 'auto', marginBottom: '8px' }}>
                    docker run -d -p 8080:8080 -e AUTHENTICATION_API_KEY={evoApiKey || 'evolution-key'} lakshayb057/evolution-go-whatsapp
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Or run directly from source: <code>go run main.go</code> inside your cloned <code>evolution-go-whatsapp</code> repo.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px' }}>
            {qrIsConnected && (
              <button 
                type="button" 
                onClick={handleLogoutInstance}
                style={{ padding: '8px 16px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
              >
                🔌 Disconnect & Re-Pair
              </button>
            )}

            <button 
              type="button" 
              onClick={handleCreateInstance}
              disabled={creatingInstance}
              style={{ padding: '8px 16px', background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
            >
              {creatingInstance ? 'Initializing...' : '✨ Initialize / Create Instance'}
            </button>

            <button 
              type="button" 
              onClick={handleOpenQrModal}
              disabled={loadingQr}
              style={{ padding: '8px 16px', background: '#E0F2FE', color: '#0284C7', border: '1px solid #BAE6FD', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
            >
              🔄 Refresh QR Code
            </button>

            {!qrCodeData && (
              <button 
                type="button" 
                onClick={handleGenerateMockQr}
                style={{ padding: '8px 14px', background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
              >
                🧪 Dev Simulator QR
              </button>
            )}

            <button 
              type="button" 
              onClick={() => setIsQrModalOpen(false)}
              style={{ padding: '8px 18px', background: '#0F172A', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: GENERATE API KEY */}
      <Modal isOpen={isKeyModalOpen} onClose={() => setIsKeyModalOpen(false)} title="Generate New API Key">
        {createdKey ? (
          <div>
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
              <strong style={{ color: '#065F46', display: 'block', marginBottom: '6px' }}>🎉 Key Generated Successfully!</strong>
              <p style={{ margin: 0, fontSize: '13px', color: '#047857' }}>
                Copy and store this API key safely now. You will not be able to view the full secret key again.
              </p>
            </div>
            <div style={{ background: '#0F172A', color: '#38BDF8', padding: '12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '13px', wordBreak: 'break-all', marginBottom: '16px' }}>
              {createdKey}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => { setIsKeyModalOpen(false); setCreatedKey(null); }} style={{ padding: '8px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleGenerateKey} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Key Name / Label</label>
              <input 
                type="text" 
                value={keyFormData.name} 
                onChange={e => setKeyFormData({...keyFormData, name: e.target.value})} 
                placeholder="e.g. Website Donation Form, Zapier Bridge"
                required 
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Description (Optional)</label>
              <input 
                type="text" 
                value={keyFormData.description} 
                onChange={e => setKeyFormData({...keyFormData, description: e.target.value})} 
                placeholder="What this integration is used for"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Select Permitted Scopes</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                {availableScopes.map(sc => (
                  <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={keyFormData.scopes.includes(sc.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setKeyFormData({...keyFormData, scopes: [...keyFormData.scopes, sc.id]});
                        } else {
                          setKeyFormData({...keyFormData, scopes: keyFormData.scopes.filter(s => s !== sc.id)});
                        }
                      }}
                      style={{ accentColor: '#059669' }}
                    />
                    <span>{sc.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button type="button" onClick={() => setIsKeyModalOpen(false)} style={{ padding: '10px 18px', border: '1px solid #CBD5E1', background: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
              <button type="submit" style={{ padding: '10px 22px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Generate Key</button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: ADD WEBHOOK */}
      <Modal isOpen={isWebhookModalOpen} onClose={() => setIsWebhookModalOpen(false)} title="Register Webhook Endpoint">
        <form onSubmit={handleAddWebhook} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Webhook Identifier Name</label>
            <input 
              type="text" 
              value={webhookFormData.name} 
              onChange={e => setWebhookFormData({...webhookFormData, name: e.target.value})} 
              placeholder="e.g. Slack Donation Alerts, Accounting Webhook"
              required 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Payload Destination URL (HTTPS)</label>
            <input 
              type="url" 
              value={webhookFormData.webhook_url} 
              onChange={e => setWebhookFormData({...webhookFormData, webhook_url: e.target.value})} 
              placeholder="https://your-server.org/api/webhooks/danapro"
              required 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', outline: 'none' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Subscribed System Events</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              {availableEvents.map(ev => (
                <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={webhookFormData.events_subscribed.includes(ev)}
                    onChange={e => {
                      if (e.target.checked) {
                        setWebhookFormData({...webhookFormData, events_subscribed: [...webhookFormData.events_subscribed, ev]});
                      } else {
                        setWebhookFormData({...webhookFormData, events_subscribed: webhookFormData.events_subscribed.filter(s => s !== ev)});
                      }
                    }}
                    style={{ accentColor: '#059669' }}
                  />
                  <span>⚡ {ev}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" onClick={() => setIsWebhookModalOpen(false)} style={{ padding: '10px 18px', border: '1px solid #CBD5E1', background: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
            <button type="submit" style={{ padding: '10px 22px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Save Webhook</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
