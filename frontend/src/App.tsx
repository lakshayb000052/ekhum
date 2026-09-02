import React, { useState, useEffect, useRef } from 'react';
import { ContactList } from './components/contacts/ContactList';
import { CommunicationLog } from './components/communications/CommunicationLog';
import { ReceiptManager } from './components/compliance/ReceiptManager';
import { TenBDExport } from './components/compliance/TenBDExport';
import { ConsentManager } from './components/compliance/ConsentManager';
import { SegmentBuilder } from './components/segments/SegmentBuilder';
import { ReportBuilder } from './components/reports/ReportBuilder';
import { ObjectManager } from './components/admin/ObjectManager';
import { RoleManager } from './components/admin/RoleManager';
import { ApiIntegrations } from './components/admin/ApiIntegrations';
import { JourneyList } from './components/journeys/JourneyList';
import { JourneyCanvas } from './components/journeys/JourneyCanvas';
import { EventTriggerSetup } from './components/journeys/EventTriggerSetup';
import { BroadcastManager } from './components/communications/BroadcastManager';
import { EKhumLandingPage } from './components/landing/EKhumLandingPage';
import { EKhumLogo } from './components/shared/EKhumLogo';

interface NGO {
  id: string;
  name: string;
  slug: string;
  tax_id_country: string;
  primary_currency: string;
  status: string;
  verified_sender_email?: string;
  whatsapp_meta_config?: any;
  certificate_80g_config?: any;
  payment_gateways_config?: any;
  permissions?: {
    can_accept_donations?: boolean;
    can_issue_80g_receipts?: boolean;
    can_export_data?: boolean;
    can_run_ai_analytics?: boolean;
    platform_fee_percent?: number;
  };
  members?: Array<{ id: string; email: string; role: string }>;
  created_at: string;
}

interface Campaign {
  id: string;
  title: string;
  description: string;
  slug: string;
  api_key?: string;
  landing_page_url?: string;
  is_active: boolean;
  goal_amount?: number;
  payment_config?: any;
  org_payment_config?: any;
  payment_gateways_config?: any;
  permissions?: {
    allow_anonymous?: boolean;
    tax_receipt_enabled?: boolean;
    min_donation?: number;
  };
  orgName?: string;
  organization_id?: string;
  approval_status?: string;
}

interface Donation {
  id: string;
  donorId?: string;
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  donorTaxId?: string;
  amount: number;
  currency: string;
  netAmount?: number;
  feeCovered?: number;
  status: string;
  paymentGateway: string;
  paymentMethod: string;
  subscriptionId?: string;
  subscription_id?: string;
  paymentType?: string;
  payment_type?: string;
  gatewayTransactionId?: string;
  rawGatewayResponse?: any;
  custom_form_data?: any;
  customFormData?: any;
  taxReceiptStatus?: string;
  created_at?: string;
  createdAt?: string;
  campaignTitle?: string;
  organizationName?: string;
}

interface GlobalMetrics {
  totalOrganizations: number;
  activeDonors: number;
  grossVolumeGMV: number;
  platformFeeRevenue: number;
  flaggedTransactions: number;
}

interface BreakdownData {
  summary: {
    total_donations: number;
    gross_gmv: number;
    total_donor_fee_covered: number;
    total_platform_fee: number;
    total_ngo_net_payout: number;
  };
  ngoBreakdown: Array<{
    organization_id: string;
    organization_name: string;
    primary_currency: string;
    status: string;
    fee_rate_percent?: number;
    org_razorpay_key: string;
    campaign_count: number;
    donation_count: number;
    gross_amount: number;
    fee_covered: number;
    platform_fee: number;
    net_ngo_payout: number;
  }>;
  campaignBreakdown: Array<{
    campaign_id: string;
    campaign_title: string;
    campaign_slug: string;
    is_active: boolean;
    fee_rate_percent?: number;
    campaign_razorpay_key: string;
    organization_id: string;
    organization_name: string;
    donation_count: number;
    gross_amount: number;
    fee_covered: number;
    platform_fee: number;
    net_ngo_payout: number;
  }>;
}

function AnalyticsLineGraph({ timeline }: { timeline: Array<{ label: string; total_amount: number; donation_count: number }> }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!timeline || timeline.length === 0) {
    return <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-light)', fontSize: '0.85rem' }}>No transaction history timeline logged yet.</div>;
  }

  const width = 640;
  const height = 200;
  const padding = 36;

  const maxVal = Math.max(...timeline.map(t => Number(t.total_amount) || 0), 1000);

  const points = timeline.map((item, index) => {
    const x = padding + (index / Math.max(timeline.length - 1, 1)) * (width - 2 * padding);
    const y = height - padding - ((Number(item.total_amount) || 0) / maxVal) * (height - 2 * padding);
    return { x, y, ...item };
  });

  const pathD = points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        {[0, 0.33, 0.66, 1].map((ratio, i) => {
          const y = height - padding - ratio * (height - 2 * padding);
          const val = Math.round(maxVal * ratio);
          return (
            <g key={i}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#E2E8F0" strokeDasharray="4 4" strokeWidth="1" />
              <text x={padding - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#64748B">
                ₹{val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              </text>
            </g>
          );
        })}

        {/* Area Gradient Fill */}
        <path d={areaD} fill="url(#lineAreaGrad)" />

        {/* Line Curve */}
        <path d={pathD} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((pt, i) => (
          <g key={i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: 'pointer' }}>
            <circle cx={pt.x} cy={pt.y} r={hoverIdx === i ? 6 : 4} fill={hoverIdx === i ? '#1D4ED8' : '#2563EB'} stroke="#ffffff" strokeWidth="2" />
            <text x={pt.x} y={height - 12} textAnchor="middle" fontSize="10" fill="#64748B">
              {pt.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Tooltip hover */}
      {hoverIdx !== null && points[hoverIdx] && (
        <div style={{
          position: 'absolute',
          left: `${(points[hoverIdx].x / width) * 100}%`,
          top: `${(points[hoverIdx].y / height) * 100}%`,
          transform: 'translate(-50%, -125%)',
          backgroundColor: '#0F172A',
          color: '#ffffff',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '0.78rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10
        }}>
          <div><strong>{points[hoverIdx].label}</strong></div>
          <div style={{ color: '#60A5FA' }}>Gross Volume: ₹{Number(points[hoverIdx].total_amount).toLocaleString()}</div>
          <div style={{ color: '#34D399' }}>Completed Transactions: {points[hoverIdx].donation_count} txs</div>
        </div>
      )}
    </div>
  );
}

function AnalyticsPieChart({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total === 0 || items.length === 0) {
    return <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-light)', fontSize: '0.85rem' }}>No payment gateway distribution data.</div>;
  }

  const radius = 65;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: '160px', height: '160px', flexShrink: 0 }}>
        <svg viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
          {items.map((item, index) => {
            const percent = item.value / total;
            const strokeDasharray = `${percent * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedPercent * circumference;
            accumulatedPercent += percent;

            return (
              <circle
                key={index}
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'all 0.4s ease' }}
              />
            );
          })}
        </svg>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Total Volume</div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)' }}>₹{total.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '150px' }}>
        {items.map((item, idx) => {
          const pct = Math.round((item.value / total) * 100);
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.color }}></span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{item.label}</span>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                ₹{item.value.toLocaleString()} ({pct}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalyticsBarChart({ data }: { data: Array<{ ngo_name: string; total_amount: number; donation_count: number }> }) {
  const maxVal = Math.max(...data.map(d => Number(d.total_amount) || 0), 1000);

  if (data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-light)', fontSize: '0.85rem' }}>No NGO share data recorded yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {data.map((item, i) => {
        const pct = Math.min(Math.round(((Number(item.total_amount) || 0) / maxVal) * 100), 100);
        const colors = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#EC4899'];
        const barColor = colors[i % colors.length];

        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <strong>{item.ngo_name}</strong>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                ₹{Number(item.total_amount).toLocaleString()} ({item.donation_count} txs)
              </span>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#F1F5F9', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(pct, 4)}%`, height: '100%', backgroundColor: barColor, borderRadius: '5px', transition: 'width 0.5s ease' }}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const getApiBase = () => {
  if ((import.meta as any).env?.VITE_API_URL) return (import.meta as any).env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('ekhum.org')) {
      return 'https://api.ekhum.org';
    }
    if (window.location.hostname.includes('onrender.com') || window.location.hostname.includes('render.com')) {
      const backendHost = window.location.hostname.replace('-frontend-', '-backend-');
      return `https://${backendHost}`;
    }
  }
  return '';
};

const getWsUrl = () => {
  if ((import.meta as any).env?.VITE_WS_URL) return (import.meta as any).env.VITE_WS_URL;
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('ekhum.org')) {
      return 'wss://api.ekhum.org';
    }
    if (window.location.protocol === 'https:') {
      const backendHost = window.location.hostname.replace('-frontend-', '-backend-');
      return `wss://${backendHost}`;
    }
  }
  return `ws://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:5000`;
};

const apiFetch = (path: string, options: RequestInit = {}) => {
  const url = path.startsWith('http') ? path : `${getApiBase()}${path}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('EKhum_token') : null;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });
};

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [userSession, setUserSession] = useState<any>(null);
  const [activeSuperadminTab, setActiveSuperadminTab] = useState<'overview' | 'ngos' | 'campaigns' | 'contacts' | 'breakdown' | 'transactions' | 'communications' | 'journeys' | 'broadcasts' | 'compliance' | 'segments' | 'reports' | 'objectManager' | 'roles' | 'integrations' | 'templates' | 'settings'>('overview');
  const [activeNgoTab, setActiveNgoTab] = useState<'overview' | 'campaigns' | 'contacts' | 'transactions' | 'breakdown' | 'communications' | 'journeys' | 'broadcasts' | 'compliance' | 'segments' | 'reports' | 'integrations'>('overview');
  const [selectedJourney, setSelectedJourney] = useState<any>(null);
  const [donorSearchQuery, setDonorSearchQuery] = useState<string>('');
  const [sysGeminiKey, setSysGeminiKey] = useState<string>('');
  const [sysOpenaiKey, setSysOpenaiKey] = useState<string>('');
  const [sysRazorpayId, setSysRazorpayId] = useState<string>('');
  const [sysRazorpaySecret, setSysRazorpaySecret] = useState<string>('');
  const [sysAwsAccessKey, setSysAwsAccessKey] = useState<string>('');
  const [sysAwsSecretKey, setSysAwsSecretKey] = useState<string>('');
  const [sysAwsRegion, setSysAwsRegion] = useState<string>('us-east-1');
  const [sysAwsSenderEmail, setSysAwsSenderEmail] = useState<string>('donations@danapro.org');
  const [showAwsSecretKey, setShowAwsSecretKey] = useState<boolean>(false);
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [showRazorpaySecret, setShowRazorpaySecret] = useState<boolean>(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState<boolean>(false);

  // WhatsApp System Settings State
  const [sysWaProvider, setSysWaProvider] = useState<'meta' | 'evolution_go'>('meta');
  const [sysMetaWabaId, setSysMetaWabaId] = useState<string>('');
  const [sysMetaPhoneId, setSysMetaPhoneId] = useState<string>('');
  const [sysMetaToken, setSysMetaToken] = useState<string>('');
  const [showMetaToken, setShowMetaToken] = useState<boolean>(false);
  const [sysEvoUrl, setSysEvoUrl] = useState<string>('http://localhost:8080');
  const [sysEvoApiKey, setSysEvoApiKey] = useState<string>('');
  const [showEvoApiKey, setShowEvoApiKey] = useState<boolean>(false);
  const [sysEvoInstance, setSysEvoInstance] = useState<string>('danapro_main');
  const [testWaRecipient, setTestWaRecipient] = useState<string>('');
  const [isSendingTestWa, setIsSendingTestWa] = useState<boolean>(false);

  const [showAddNgoModal, setShowAddNgoModal] = useState<boolean>(false);
  const [showAddCampaignModal, setShowAddCampaignModal] = useState<boolean>(false);
  const [breakdownData, setBreakdownData] = useState<BreakdownData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  const [realtimeNotification, setRealtimeNotification] = useState<string | null>(null);

  const showRealtimeNotification = (text: string) => {
    setRealtimeNotification(text);
    setTimeout(() => {
      setRealtimeNotification((curr) => curr === text ? null : curr);
    }, 6000);
  };

  // Restore session from HTTP-only cookie on startup
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await apiFetch('/api/auth/me');
        const data = await res.json();
        if (data.success && data.user) {
          setUserSession({ user: data.user });
          // If on landing, redirect to dashboard
          if (window.location.pathname === '/' || window.location.pathname === '/login') {
            if (data.user.role === 'superadmin') {
              navigate('/superadmin');
            } else {
              navigate('/ngo');
            }
          }
        }
      } catch (err) {
        console.error('Session validation failed:', err);
      }
    };
    checkSession();
  }, []);

  // Listen to hash changes in URL for direct subtab navigation
  useEffect(() => {
    const handleHashSync = () => {
      const rawHash = window.location.hash;
      if (rawHash.startsWith('#contact=')) {
        if (currentPath === '/superadmin') {
          setActiveSuperadminTab('contacts');
        } else if (currentPath === '/ngo') {
          setActiveNgoTab('contacts');
        }
        return;
      }

      const hash = rawHash.replace('#', '').toLowerCase();
      if (!hash) return;
      
      const tabMap: Record<string, any> = {
        overview: 'overview',
        ngos: 'ngos',
        campaigns: 'campaigns',
        contacts: 'contacts',
        ledger: 'transactions',
        transactions: 'transactions',
        communications: 'communications',
        journeys: 'journeys',
        broadcasts: 'broadcasts',
        compliance: 'compliance',
        segments: 'segments',
        reports: 'reports',
        objectmanager: 'objectManager',
        roles: 'roles',
        integrations: 'integrations',
        breakdown: 'breakdown',
        templates: 'templates',
        settings: 'settings'
      };

      const matchedTab = tabMap[hash];
      if (matchedTab) {
        if (currentPath === '/superadmin') {
          setActiveSuperadminTab(matchedTab);
        } else if (currentPath === '/ngo') {
          setActiveNgoTab(matchedTab);
        }
      }
    };

    handleHashSync();
    window.addEventListener('hashchange', handleHashSync);
    return () => window.removeEventListener('hashchange', handleHashSync);
  }, [currentPath]);

  // WebSockets Real-Time Syncing
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isDisposed = false;

    const connectWebSocket = () => {
      if (isDisposed) return;
      const wsUrl = getWsUrl();
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WebSocket] Connected to live transaction feed');
        if (userSession?.user && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'register',
            role: userSession.user.role,
            organizationId: userSession.user.orgId
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const eventType = message.event;
          const data = message.data || {};

          const isSuperadmin = userSession?.user?.role === 'superadmin';
          const isOrgAdmin = userSession?.user?.role === 'admin' && userSession?.user?.orgId === data.organizationId;
          const isRelevant = isSuperadmin || isOrgAdmin || !data.organizationId;

          if (eventType === 'donation_initiated' && isRelevant) {
            const formattedAmount = data.currency === 'INR' ? `₹${Number(data.amount).toLocaleString()}` : `${data.currency} ${Number(data.amount).toLocaleString()}`;
            showRealtimeNotification(`💳 Payment Initiated: ${data.donorName || 'Donor'} started checkout for ${formattedAmount} on "${data.campaignTitle || 'Campaign'}"`);
            fetchData();
          } else if (eventType === 'donation_completed' && isRelevant) {
            const formattedAmount = data.currency === 'INR' ? `₹${Number(data.amount).toLocaleString()}` : `${data.currency} ${Number(data.amount).toLocaleString()}`;
            showRealtimeNotification(`🎉 Live Donation Completed! ${data.donorName || 'Donor'} contributed ${formattedAmount} to "${data.campaignTitle || 'Campaign'}" ${data.receiptNumber ? `(Receipt: ${data.receiptNumber})` : ''}`);
            fetchData();
          } else if (eventType === 'donation_failed' && isRelevant) {
            const formattedAmount = data.currency === 'INR' ? `₹${Number(data.amount).toLocaleString()}` : `${data.currency} ${Number(data.amount).toLocaleString()}`;
            showRealtimeNotification(`⚠️ Payment Failed / Dismissed: ${data.donorName || 'Donor'} (${formattedAmount}) - ${data.reason || 'Modal closed'}`);
            fetchData();
          } else if (eventType === 'campaign_updated' && isRelevant) {
            showRealtimeNotification(`📢 Campaign Updated: ${data.title || 'Campaign details updated'}`);
            fetchData();
          }
        } catch (err) {
          console.error('[WebSocket] Failed parsing event data:', err);
        }
      };

      ws.onclose = () => {
        if (!isDisposed) {
          reconnectTimer = setTimeout(() => {
            connectWebSocket();
          }, 5000);
        }
      };

      ws.onerror = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    };

    connectWebSocket();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [userSession]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);



  const navigate = (newPath: string) => {
    window.history.pushState({}, '', newPath);
    setCurrentPath(newPath);
  };

  const [copilotText, setCopilotText] = useState<string>('');
  const [isLoadingCopilot, setIsLoadingCopilot] = useState<boolean>(false);

  // Canvas Particle Animation for Login Background
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const isLoginOrHome = currentPath === '/login' || currentPath === '/' || currentPath === '';
    if (!isLoginOrHome) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle nodes
    const symbols = ['₹', '$', '📜', '🛡️', '📲', '⚡', '💳'];
    const particles = Array.from({ length: 26 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius: Math.random() * 2 + 1.5,
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      opacity: Math.random() * 0.5 + 0.3,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw subtle connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 160) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(15, 23, 42, ${0.18 * (1 - dist / 160)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }

      // Update and draw particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.font = 'bold 20px var(--font-body)';
        ctx.fillStyle = `rgba(15, 23, 42, ${p.opacity * 0.75})`;
        ctx.fillText(p.symbol, p.x, p.y);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [currentPath]);

  // Login Form States (Default to requested Superadmin credentials)
  const [activeLoginRole, setActiveLoginRole] = useState<'superadmin' | 'ngo' | 'checkout'>('superadmin');
  const [loginEmail, setLoginEmail] = useState<string>('Superlucky@gmail.com');
  const [loginPassword, setLoginPassword] = useState<string>('Lakshay@123');
  const [loginError, setLoginError] = useState<string>('');

  // Lists & Backend States
  const [organizations, setOrganizations] = useState<NGO[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [copiedEmbedKey, setCopiedEmbedKey] = useState<string | null>(null);
  // Public Campaign Checkout states
  const [checkoutName, setCheckoutName] = useState<string>('');
  const [checkoutEmail, setCheckoutEmail] = useState<string>('');
  const [checkoutPhone, setCheckoutPhone] = useState<string>('');
  const [checkoutTaxId, setCheckoutTaxId] = useState<string>('');
  const [checkoutAmount, setCheckoutAmount] = useState<number>(500);
  const [checkoutCurrency] = useState<string>('INR');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState<boolean>(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<any>(null);

  const loadCashfreeSDK = () => {
    return new Promise((resolve) => {
      if ((window as any).Cashfree) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const loadRazorpaySDK = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleExecutePublicCheckout = async (e: React.FormEvent, targetCampaignId: string, targetCampaignTitle: string) => {
    e.preventDefault();
    if (!targetCampaignId || checkoutAmount <= 0) {
      alert('Please select a valid campaign and amount.');
      return;
    }
    setIsProcessingCheckout(true);
    setCheckoutSuccess(null);

    try {
      const response = await apiFetch('/api/donations/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: targetCampaignId,
          amount: checkoutAmount,
          currency: checkoutCurrency,
          email: checkoutEmail,
          name: checkoutName,
          phone: checkoutPhone,
          taxId: checkoutTaxId,
          coverFee: true
        })
      });

      const data = await response.json();
      if (!data.success) {
        alert(data.message || 'Failed to initiate donation order.');
        setIsProcessingCheckout(false);
        return;
      }

      if (data.mode === 'sandbox_completed') {
        setCheckoutSuccess({
          donationId: data.donationId,
          paymentId: data.transactionId || `txn_${Date.now()}`,
          amount: checkoutAmount,
          currency: checkoutCurrency,
          campaignTitle: targetCampaignTitle
        });
        fetchData();
        setIsProcessingCheckout(false);
        return;
      }

      // 1. CASHFREE RAIL
      if (data.mode === 'cashfree' || data.gateway === 'cashfree') {
        const loaded = await loadCashfreeSDK();
        if (loaded && (window as any).Cashfree && data.checkoutPayload?.paymentSessionId) {
          try {
            const isProd = data.checkoutPayload.mode === 'production';
            const cashfree = (window as any).Cashfree({ mode: isProd ? 'production' : 'sandbox' });
            cashfree.checkout({
              paymentSessionId: data.checkoutPayload.paymentSessionId,
              redirectTarget: '_modal'
            }).then(async (cfResult: any) => {
              if (cfResult && cfResult.error) {
                console.warn('[Cashfree Modal Dropin Error]:', cfResult.error);
                await apiFetch('/api/donations/verify-failed', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    donationId: data.donationId,
                    errorDescription: cfResult.error.message || 'Payment cancelled or dismissed by donor'
                  })
                });
                fetchData();
                setIsProcessingCheckout(false);
                return;
              }

              if (cfResult && cfResult.paymentDetails) {
                const payStatus = (cfResult.paymentDetails.paymentStatus || 'SUCCESS').toUpperCase();
                if (payStatus === 'SUCCESS' || payStatus === 'PAID') {
                  const verifyRes = await apiFetch('/api/donations/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      donationId: data.donationId,
                      paymentGateway: 'cashfree',
                      cashfreePaymentId: cfResult.paymentDetails.paymentId || `cf_pay_${Date.now()}`
                    })
                  });
                  const verifyData = await verifyRes.json();
                  if (verifyData.success) {
                    setCheckoutSuccess({
                      donationId: data.donationId,
                      paymentId: cfResult.paymentDetails.paymentId || `cf_pay_${Date.now()}`,
                      amount: checkoutAmount,
                      currency: checkoutCurrency,
                      campaignTitle: targetCampaignTitle
                    });
                    fetchData();
                  } else {
                    alert(`Payment verification failed: ${verifyData.message}`);
                  }
                } else {
                  await apiFetch('/api/donations/verify-failed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      donationId: data.donationId,
                      errorDescription: cfResult.paymentDetails.paymentMessage || `Payment ${payStatus}`
                    })
                  });
                  fetchData();
                  alert(`Payment declined or dropped: ${cfResult.paymentDetails.paymentMessage || payStatus}`);
                }
              }
              setIsProcessingCheckout(false);
            }).catch(async (cfErr: any) => {
              console.warn('[Cashfree Checkout Dismissed/Error]:', cfErr);
              await apiFetch('/api/donations/verify-failed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  donationId: data.donationId,
                  errorDescription: cfErr?.message || 'Cashfree checkout dismissed/abandoned'
                })
              });
              fetchData();
              setIsProcessingCheckout(false);
            });
            return;
          } catch (cfErr) {
            console.warn('Cashfree launch error:', cfErr);
          }
        }

        // If Cashfree SDK could not launch or session failed
        await apiFetch('/api/donations/verify-failed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            donationId: data.donationId,
            errorDescription: 'Cashfree SDK session invalid or initialization failed'
          })
        });
        fetchData();
        setIsProcessingCheckout(false);
        return;
      }

      // 2. RAZORPAY RAIL
      if (data.mode === 'razorpay' || data.gateway === 'razorpay' || data.mode === 'razorpay_checkout') {
        const loaded = await loadRazorpaySDK();
        if (!loaded) {
          alert('Failed to load Razorpay SDK. Please check your internet connection.');
          setIsProcessingCheckout(false);
          return;
        }

        const options: any = {
          key: data.keyId || data.checkoutPayload?.keyId,
          amount: data.amount || data.checkoutPayload?.amountPaise,
          currency: data.currency,
          name: targetCampaignTitle,
          description: `Donation for ${targetCampaignTitle}`,
          prefill: {
            name: checkoutName,
            email: checkoutEmail,
            contact: checkoutPhone
          },
          theme: { color: '#059669' }
        };

        if (data.orderId && !data.orderId.startsWith('order_test_') && !data.orderId.startsWith('order_rzp_')) {
          options.order_id = data.orderId;
        }

        options.handler = async function (resPayload: any) {
          try {
            const verifyRes = await apiFetch('/api/donations/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                donationId: data.donationId,
                paymentGateway: 'razorpay',
                razorpayPaymentId: resPayload.razorpay_payment_id,
                razorpayOrderId: resPayload.razorpay_order_id,
                razorpaySignature: resPayload.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setCheckoutSuccess({
                donationId: data.donationId,
                paymentId: resPayload.razorpay_payment_id,
                amount: checkoutAmount,
                currency: checkoutCurrency,
                campaignTitle: targetCampaignTitle
              });
              fetchData();
            } else {
              alert(`Payment verification failed: ${verifyData.message}`);
            }
          } catch (err: any) {
            alert(`Verification error: ${err.message}`);
          } finally {
            setIsProcessingCheckout(false);
          }
        };

        options.modal = {
          ondismiss: async function () {
            setIsProcessingCheckout(false);
            try {
              await apiFetch('/api/donations/verify-failed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  donationId: data.donationId,
                  errorDescription: 'Donor closed or abandoned Razorpay modal'
                })
              });
              fetchData();
            } catch (e) {
              console.error(e);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);

        rzp.on('payment.failed', async function (failedResp: any) {
          console.warn('Razorpay payment.failed event:', failedResp);
          try {
            await apiFetch('/api/donations/verify-failed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                donationId: data.donationId,
                errorDescription: failedResp.error?.description || 'Razorpay payment rejected or declined'
              })
            });
            fetchData();
          } catch (e) {
            console.error(e);
          } finally {
            setIsProcessingCheckout(false);
          }
        });

        rzp.open();
        return;
      }

      // 3. UNIVERSAL OTHER GATEWAYS (PayU, CCAvenue, Worldline)
      const verifyRes = await apiFetch('/api/donations/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donationId: data.donationId,
          paymentGateway: data.gateway,
          [`${data.gateway}PaymentId`]: `pay_${data.gateway}_${Date.now()}`
        })
      });
      const verifyData = await verifyRes.json();
      if (verifyData.success) {
        setCheckoutSuccess({
          donationId: data.donationId,
          paymentId: `pay_${data.gateway}_${Date.now()}`,
          amount: checkoutAmount,
          currency: checkoutCurrency,
          campaignTitle: targetCampaignTitle
        });
        fetchData();
      }
      setIsProcessingCheckout(false);
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
      setIsProcessingCheckout(false);
    }
  };

  const handleExecuteDirectSandboxCheckout = async (targetCampaignId: string, targetCampaignTitle: string) => {
    if (!targetCampaignId || checkoutAmount <= 0) return;
    setIsProcessingCheckout(true);
    setCheckoutSuccess(null);
    try {
      const response = await apiFetch('/api/donations/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: targetCampaignId,
          amount: checkoutAmount,
          currency: checkoutCurrency,
          email: checkoutEmail,
          name: checkoutName,
          phone: checkoutPhone,
          taxId: checkoutTaxId,
          coverFee: true,
          forceSandbox: true
        })
      });
      const data = await response.json();
      if (data.success) {
        setCheckoutSuccess({
          donationId: data.donationId,
          paymentId: data.transactionId || `pay_sim_${Date.now()}`,
          amount: checkoutAmount,
          currency: checkoutCurrency,
          campaignTitle: targetCampaignTitle
        });
        fetchData();
      } else {
        alert(data.message || 'Direct test checkout failed.');
      }
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setIsProcessingCheckout(false);
    }
  };


  const [selectedDonationForModal, setSelectedDonationForModal] = useState<Donation | null>(null);
  const [isSyncingGateway, setIsSyncingGateway] = useState<boolean>(false);

  const handleSyncGatewayDetails = async (donationId: string) => {
    try {
      setIsSyncingGateway(true);
      const res = await apiFetch(`/api/donations/${donationId}/sync`);
      const data = await res.json();
      if (data.success) {
        fetchData();
        if (selectedDonationForModal && selectedDonationForModal.id === donationId) {
          setSelectedDonationForModal(prev => prev ? { ...prev, status: data.status || prev.status, rawGatewayResponse: data.rawGatewayResponse } : null);
        }
      }
    } catch (err) {
      console.error('Error syncing gateway details:', err);
    } finally {
      setIsSyncingGateway(false);
    }
  };

  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics>({
    totalOrganizations: 0,
    activeDonors: 0,
    grossVolumeGMV: 0,
    platformFeeRevenue: 0,
    flaggedTransactions: 0
  });

  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);

  // Superadmin CRUD input states
  const [newNgoName, setNewNgoName] = useState<string>('');
  const [newNgoSlug, setNewNgoSlug] = useState<string>('');
  const [newNgoCountry, setNewNgoCountry] = useState<string>('IN');
  const [newNgoCurrency, setNewNgoCurrency] = useState<string>('INR');
  const [newNgoVerifiedSender, setNewNgoVerifiedSender] = useState<string>('');
  const [editNgoVerifiedSender, setEditNgoVerifiedSender] = useState<string>('');
  
  // WABA / WhatsApp Config Input
  const [newWabaId, setNewWabaId] = useState<string>('');
  const [newPhoneId, setNewPhoneId] = useState<string>('');
  const [newWabaToken, setNewWabaToken] = useState<string>('');
  
  // 80G Certificate Config Input
  const [new80gUrn, setNew80gUrn] = useState<string>('');
  const [new80gDate, setNew80gDate] = useState<string>('');
  const [new80gSignatory, setNew80gSignatory] = useState<string>('');
  const [newNgoRazorpayKeyId, setNewNgoRazorpayKeyId] = useState<string>('');
  const [newNgoRazorpayKeySecret, setNewNgoRazorpayKeySecret] = useState<string>('');
  
  // NGO Permission States for Creation
  const [newNgoCanAccept] = useState<boolean>(true);
  const [newNgoCan80g] = useState<boolean>(true);
  const [newNgoCanExport] = useState<boolean>(true);
  const [newNgoCanAi] = useState<boolean>(true);
  const [newNgoFeePercent, setNewNgoFeePercent] = useState<number>(0.0);

  // NGO Worker Access Credentials State
  const [newNgoAdminEmail, setNewNgoAdminEmail] = useState<string>('');
  const [newNgoAdminPassword, setNewNgoAdminPassword] = useState<string>('');

  // Campaign Inputs (With Specific Razorpay Keys & Permissions)
  const [newCampOrgId, setNewCampOrgId] = useState<string>('');
  const [newCampTitle, setNewCampTitle] = useState<string>('');
  const [newCampDescription, setNewCampDescription] = useState<string>('');
  const [newCampSlug, setNewCampSlug] = useState<string>('');
  const [newCampLandingPageUrl, setNewCampLandingPageUrl] = useState<string>('');
  const [newCampGoalAmount, setNewCampGoalAmount] = useState<number>(100000);
  const [newCampRazorpayKeyId, setNewCampRazorpayKeyId] = useState<string>('');
  const [newCampRazorpayKeySecret, setNewCampRazorpayKeySecret] = useState<string>('');
  const [newCampAllowAnon, setNewCampAllowAnon] = useState<boolean>(true);
  const [newCampTaxEnabled, setNewCampTaxEnabled] = useState<boolean>(true);

  // Multi-Gateway Health & Live Uptime Ping
  const [gatewayHealth, setGatewayHealth] = useState<any>({
    razorpay: { status: 'operational', uptime: '99.98%', latencyMs: 42, badge: '🟢 99.98% Live' },
    payu: { status: 'operational', uptime: '99.95%', latencyMs: 58, badge: '🟢 99.95% Live' },
    ccavenue: { status: 'operational', uptime: '99.90%', latencyMs: 74, badge: '🟢 99.90% Live' },
    worldline: { status: 'operational', uptime: '99.92%', latencyMs: 51, badge: '🟢 99.92% Live' },
    cashfree: { status: 'operational', uptime: '99.96%', latencyMs: 38, badge: '🟢 99.96% Live' }
  });
  const [isTestingGatewayHealth, setIsTestingGatewayHealth] = useState<boolean>(false);
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState<string | null>(null);

  // NGO Multi-Gateway Configuration States (Creation)
  const [newNgoRzpEnabled, setNewNgoRzpEnabled] = useState<boolean>(true);
  const [newNgoRazorpayWebhook] = useState<string>('');
  const [newNgoPayuEnabled, setNewNgoPayuEnabled] = useState<boolean>(false);
  const [newNgoPayuKey, setNewNgoPayuKey] = useState<string>('');
  const [newNgoPayuSalt, setNewNgoPayuSalt] = useState<string>('');
  const [newNgoPayuSecret] = useState<string>('');
  const [newNgoPayuMode] = useState<'test' | 'live'>('test');
  const [newNgoCcavEnabled, setNewNgoCcavEnabled] = useState<boolean>(false);
  const [newNgoCcavMid, setNewNgoCcavMid] = useState<string>('');
  const [newNgoCcavCode, setNewNgoCcavCode] = useState<string>('');
  const [newNgoCcavKey, setNewNgoCcavKey] = useState<string>('');
  const [newNgoWlEnabled, setNewNgoWlEnabled] = useState<boolean>(false);
  const [newNgoWlMid, setNewNgoWlMid] = useState<string>('');
  const [newNgoWlTid, setNewNgoWlTid] = useState<string>('');
  const [newNgoWlSecret, setNewNgoWlSecret] = useState<string>('');
  const [newNgoCfEnabled, setNewNgoCfEnabled] = useState<boolean>(false);
  const [newNgoCfAppId, setNewNgoCfAppId] = useState<string>('');
  const [newNgoCfSecret, setNewNgoCfSecret] = useState<string>('');
  const [newNgoPrimaryGw, setNewNgoPrimaryGw] = useState<string>('razorpay');
  const [newNgoFallbackGw, setNewNgoFallbackGw] = useState<string>('');
  const [newNgoAutoFailover] = useState<boolean>(true);

  // NGO Multi-Gateway Configuration States (Editing)
  const [editNgoRzpEnabled, setEditNgoRzpEnabled] = useState<boolean>(true);
  const [editNgoRazorpayWebhook, setEditNgoRazorpayWebhook] = useState<string>('');
  const [editNgoPayuEnabled, setEditNgoPayuEnabled] = useState<boolean>(false);
  const [editNgoPayuKey, setEditNgoPayuKey] = useState<string>('');
  const [editNgoPayuSalt, setEditNgoPayuSalt] = useState<string>('');
  const [editNgoPayuSecret, setEditNgoPayuSecret] = useState<string>('');
  const [editNgoPayuMode, setEditNgoPayuMode] = useState<'test' | 'live'>('test');
  const [editNgoCcavEnabled, setEditNgoCcavEnabled] = useState<boolean>(false);
  const [editNgoCcavMid, setEditNgoCcavMid] = useState<string>('');
  const [editNgoCcavCode, setEditNgoCcavCode] = useState<string>('');
  const [editNgoCcavKey, setEditNgoCcavKey] = useState<string>('');
  const [editNgoWlEnabled, setEditNgoWlEnabled] = useState<boolean>(false);
  const [editNgoWlMid, setEditNgoWlMid] = useState<string>('');
  const [editNgoWlTid, setEditNgoWlTid] = useState<string>('');
  const [editNgoWlSecret, setEditNgoWlSecret] = useState<string>('');
  const [editNgoCfEnabled, setEditNgoCfEnabled] = useState<boolean>(false);
  const [editNgoCfAppId, setEditNgoCfAppId] = useState<string>('');
  const [editNgoCfSecret, setEditNgoCfSecret] = useState<string>('');
  const [editNgoPrimaryGw, setEditNgoPrimaryGw] = useState<string>('razorpay');
  const [editNgoFallbackGw, setEditNgoFallbackGw] = useState<string>('');
  const [editNgoAutoFailover, setEditNgoAutoFailover] = useState<boolean>(true);

  // Campaign Checkbox Aligned Gateways (Creation & Editing)
  const [newCampAssignedGateways, setNewCampAssignedGateways] = useState<string[]>(['razorpay']);
  const [newCampPrimaryGateway, setNewCampPrimaryGateway] = useState<string>('razorpay');
  const [newCampFallbackGateway] = useState<string>('payu');
  const [newCampAutoFailover] = useState<boolean>(true);

  const [editCampAssignedGateways, setEditCampAssignedGateways] = useState<string[]>(['razorpay']);
  const [editCampPrimaryGateway, setEditCampPrimaryGateway] = useState<string>('razorpay');
  const [editCampFallbackGateway, setEditCampFallbackGateway] = useState<string>('payu');
  const [editCampAutoFailover, setEditCampAutoFailover] = useState<boolean>(true);

  // Quick Approval Modal State (Superadmin approves campaign with checkbox alignment)
  const [approvingCampaign, setApprovingCampaign] = useState<Campaign | null>(null);
  const [approvalAssignedGateways, setApprovalAssignedGateways] = useState<string[]>(['razorpay']);
  const [approvalPrimaryGateway, setApprovalPrimaryGateway] = useState<string>('razorpay');
  const [approvalFallbackGateway, setApprovalFallbackGateway] = useState<string>('payu');
  const [approvalAutoFailover, setApprovalAutoFailover] = useState<boolean>(true);

  // Editing states
  const [editingNgoId, setEditingNgoId] = useState<string | null>(null);
  const [editNgoName, setEditNgoName] = useState<string>('');
  const [editNgoSlug, setEditNgoSlug] = useState<string>('');
  const [editNgoCountry, setEditNgoCountry] = useState<string>('IN');
  const [editNgoCurrency, setEditNgoCurrency] = useState<string>('INR');
  const [editNgoStatus, setEditNgoStatus] = useState<string>('active');
  const [editWabaId, setEditWabaId] = useState<string>('');
  const [editPhoneId, setEditPhoneId] = useState<string>('');
  const [editWabaToken, setEditWabaToken] = useState<string>('');
  const [edit80gUrn, setEdit80gUrn] = useState<string>('');
  const [edit80gDate, setEdit80gDate] = useState<string>('');
  const [edit80gSignatory, setEdit80gSignatory] = useState<string>('');
  const [editNgoRazorpayKeyId, setEditNgoRazorpayKeyId] = useState<string>('');
  const [editNgoRazorpayKeySecret, setEditNgoRazorpayKeySecret] = useState<string>('');
  const [editNgoAdminEmail, setEditNgoAdminEmail] = useState<string>('');
  const [editNgoAdminPassword, setEditNgoAdminPassword] = useState<string>('');

  // NGO Permissions editing states
  const [editNgoCanAccept, setEditNgoCanAccept] = useState<boolean>(true);
  const [editNgoCan80g, setEditNgoCan80g] = useState<boolean>(true);
  const [editNgoCanExport, setEditNgoCanExport] = useState<boolean>(true);
  const [editNgoCanAi, setEditNgoCanAi] = useState<boolean>(true);
  const [editNgoFeePercent, setEditNgoFeePercent] = useState<number>(0.0);

  const [editingCampId, setEditingCampId] = useState<string | null>(null);
  const [editCampTitle, setEditCampTitle] = useState<string>('');
  const [editCampSlug, setEditCampSlug] = useState<string>('');
  const [editCampLandingPageUrl, setEditCampLandingPageUrl] = useState<string>('');
  const [editCampActive, setEditCampActive] = useState<boolean>(true);
  const [editCampGoalAmount, setEditCampGoalAmount] = useState<number>(100000);
  const [editCampRazorpayKeyId, setEditCampRazorpayKeyId] = useState<string>('');
  const [editCampRazorpayKeySecret, setEditCampRazorpayKeySecret] = useState<string>('');
  const [editCampAllowAnon, setEditCampAllowAnon] = useState<boolean>(true);
  const [editCampTaxEnabled, setEditCampTaxEnabled] = useState<boolean>(true);
  const [selectedCampForEmbedModal, setSelectedCampForEmbedModal] = useState<Campaign | null>(null);
  const [embedModalTab, setEmbedModalTab] = useState<'js_embed' | 'auto_bind' | 'rest_api' | 'tokens' | 'data_layer' | 'sandbox' | 'checkout'>('js_embed');
  const [sandboxAmount, setSandboxAmount] = useState<number>(100);
  const [sandboxDonorName, setSandboxDonorName] = useState<string>('Aarav Sharma');
  const [sandboxDonorEmail, setSandboxDonorEmail] = useState<string>('aarav.sharma@example.com');
  const [sandboxDonorPhone, setSandboxDonorPhone] = useState<string>('+919876543210');
  const [sandboxDonorPan, setSandboxDonorPan] = useState<string>('ABCDE1234F');
  const [sandboxGateway, setSandboxGateway] = useState<string>('auto');
  const [sandboxIsMonthly, setSandboxIsMonthly] = useState<boolean>(false);
  const [sandboxRunning, setSandboxRunning] = useState<boolean>(false);
  const [sandboxErrorResult, setSandboxErrorResult] = useState<string | null>(null);

  // Global Header & App Launcher States
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [showQuickCreateMenu, setShowQuickCreateMenu] = useState<boolean>(false);
  const [showAppLauncherModal, setShowAppLauncherModal] = useState<boolean>(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);

  // System Settings Extended States
  const [sysRazorpayWebhookSecret, setSysRazorpayWebhookSecret] = useState<string>('');
  const [showRazorpayWebhookSecret, setShowRazorpayWebhookSecret] = useState<boolean>(false);
  
  // PayU India States
  const [sysPayuKey, setSysPayuKey] = useState<string>('gtKFFx');
  const [sysPayuSalt, setSysPayuSalt] = useState<string>('eCwWELxi');
  const [sysPayuWebhookSecret, setSysPayuWebhookSecret] = useState<string>('payu_whsec_908123');
  const [sysPayuMode, setSysPayuMode] = useState<'test' | 'live'>('test');
  const [showPayuSalt, setShowPayuSalt] = useState<boolean>(false);

  // CCAvenue States
  const [sysCcavenueMerchantId, setSysCcavenueMerchantId] = useState<string>('2849102');
  const [sysCcavenueAccessCode, setSysCcavenueAccessCode] = useState<string>('AVIN02KJ91BC02');
  const [sysCcavenueWorkingKey, setSysCcavenueWorkingKey] = useState<string>('8B9F04D92841CA902E41829B0482910F');
  const [showCcavenueWorkingKey, setShowCcavenueWorkingKey] = useState<boolean>(false);

  // AU Small Finance Bank / Worldline Gateway States
  const [sysWorldlineMerchantId, setSysWorldlineMerchantId] = useState<string>('WL_AUBANK_89210');
  const [sysWorldlineSecretKey, setSysWorldlineSecretKey] = useState<string>('sec_aubank_worldline_891023');
  const [sysWorldlineTerminalId, setSysWorldlineTerminalId] = useState<string>('AUB_TID_00192');
  const [showWorldlineSecret, setShowWorldlineSecret] = useState<boolean>(false);

  // Cashfree Payments States
  const [sysCashfreeAppId, setSysCashfreeAppId] = useState<string>('CF_APP_91029384');
  const [sysCashfreeSecretKey, setSysCashfreeSecretKey] = useState<string>('cf_sec_91823901823901283');
  const [showCashfreeSecret, setShowCashfreeSecret] = useState<boolean>(false);

  // Smart Routing & Failover
  const [primaryGateway, setPrimaryGateway] = useState<string>('razorpay');
  const [fallbackGateway, setFallbackGateway] = useState<string>('payu');
  const [enableAutoFailover, setEnableAutoFailover] = useState<boolean>(true);
  const [activeGatewayTab, setActiveGatewayTab] = useState<'razorpay' | 'payu' | 'ccavenue' | 'worldline' | 'cashfree' | 'routing'>('razorpay');

  const [sysSmtpHost, setSysSmtpHost] = useState<string>('smtp.gmail.com');
  const [sysSmtpPort, setSysSmtpPort] = useState<string>('465');
  const [sysSmtpUser, setSysSmtpUser] = useState<string>('lakshayb057@gmail.com');
  const [sysSmtpPass, setSysSmtpPass] = useState<string>('angzefnwaziwmlzz');
  const [showSmtpPass, setShowSmtpPass] = useState<boolean>(false);
  const [sysEmailProvider, setSysEmailProvider] = useState<'smtp' | 'aws_ses'>('smtp');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState<boolean>(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState<string>('lakshayb057@gmail.com');

  // Template Management States
  const [templatesList, setTemplatesList] = useState<any[]>([]);
  const [tmplType, setTmplType] = useState<'80g_receipt' | 'whatsapp_message' | 'email_thankyou'>('80g_receipt');
  const [tmplTargetOrgId, setTmplTargetOrgId] = useState<string>('default');
  const [tmplName, setTmplName] = useState<string>('');
  const [tmplSubject, setTmplSubject] = useState<string>('');
  const [tmplContent, setTmplContent] = useState<string>('');
  const [tmplIsDefault, setTmplIsDefault] = useState<boolean>(false);
  const [tmplPreviewResult, setTmplPreviewResult] = useState<string>('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Prepopulate editing NGO states for NGO admin compliance view
  useEffect(() => {
    if (currentPath === '/ngo' && activeNgoTab === 'compliance' && userSession?.user?.orgId) {
      const myNgo = organizations.find(o => o.id === userSession.user.orgId);
      if (myNgo) {
        setEditingNgoId(myNgo.id);
        setEditNgoName(myNgo.name);
        setEditNgoSlug(myNgo.slug);
        setEditNgoCountry(myNgo.tax_id_country || 'IN');
        setEditNgoCurrency(myNgo.primary_currency || 'INR');
        setEditNgoStatus(myNgo.status || 'active');
        setEditNgoVerifiedSender(myNgo.verified_sender_email || '');
        const waba = myNgo.whatsapp_meta_config || {};
        const cert = myNgo.certificate_80g_config || {};
        const gateways = myNgo.payment_gateways_config || {};
        const perms = myNgo.permissions || {};
        setEditWabaId(waba.waba_id || '');
        setEditPhoneId(waba.phone_id || '');
        setEditWabaToken(waba.token || '');
        setEdit80gUrn(cert.urn || '');
        setEdit80gDate(cert.issue_date || '');
        setEdit80gSignatory(cert.signatory || '');
        setEditNgoRazorpayKeyId(gateways.razorpay_key_id || '');
        setEditNgoRazorpayKeySecret(gateways.razorpay_key_secret || '');
        setEditNgoCanAccept(perms.can_accept_donations !== false);
        setEditNgoCan80g(perms.can_issue_80g_receipts !== false);
        setEditNgoCanExport(perms.can_export_data !== false);
        setEditNgoCanAi(perms.can_run_ai_analytics !== false);
        setEditNgoFeePercent(perms.platform_fee_percent !== undefined ? perms.platform_fee_percent : 0.0);
      }
    }
  }, [activeNgoTab, organizations, userSession, currentPath]);

  const fetchData = async () => {
    try {
      const isSuper = userSession?.user?.role === 'superadmin';
      const orgId = userSession?.user?.orgId;

      if (isSuper) {
        const metricRes = await apiFetch('/api/superadmin/metrics');
        const metricData = await metricRes.json();
        if (metricData.success) setGlobalMetrics(metricData.metrics);

        const ngoRes = await apiFetch('/api/superadmin/organizations');
        const ngoData = await ngoRes.json();
        if (ngoData.success) {
          const orgList = ngoData.organizations || ngoData.data || [];
          setOrganizations(orgList);
          if (orgList.length > 0) {
            if (!newCampOrgId || !orgList.some((o: any) => o.id === newCampOrgId)) {
              setNewCampOrgId(orgList[0].id);
            }
          } else {
            setNewCampOrgId('');
          }
        }

        const breakdownRes = await apiFetch('/api/superadmin/breakdown');
        const breakdownJson = await breakdownRes.json();
        if (breakdownJson.success) setBreakdownData(breakdownJson);

        const analyticsRes = await apiFetch('/api/superadmin/analytics');
        const analyticsJson = await analyticsRes.json();
        if (analyticsJson.success) setAnalyticsData(analyticsJson.analytics);

        const settingsRes = await apiFetch('/api/superadmin/settings');
        const settingsData = await settingsRes.json();
        if (settingsData.success && settingsData.settings) {
          setSysGeminiKey(settingsData.settings.GEMINI_API_KEY || '');
          setSysOpenaiKey(settingsData.settings.OPENAI_API_KEY || '');
          setSysRazorpayId(settingsData.settings.RAZORPAY_KEY_ID || '');
          setSysRazorpaySecret(settingsData.settings.RAZORPAY_KEY_SECRET || '');
          setSysRazorpayWebhookSecret(settingsData.settings.RAZORPAY_WEBHOOK_SECRET || '');
          setSysPayuKey(settingsData.settings.PAYU_MERCHANT_KEY || 'gtKFFx');
          setSysPayuSalt(settingsData.settings.PAYU_MERCHANT_SALT || 'eCwWELxi');
          setSysPayuWebhookSecret(settingsData.settings.PAYU_WEBHOOK_SECRET || 'payu_whsec_908123');
          setSysPayuMode((settingsData.settings.PAYU_MODE as any) || 'test');
          setSysCcavenueMerchantId(settingsData.settings.CCAVENUE_MERCHANT_ID || '2849102');
          setSysCcavenueAccessCode(settingsData.settings.CCAVENUE_ACCESS_CODE || 'AVIN02KJ91BC02');
          setSysCcavenueWorkingKey(settingsData.settings.CCAVENUE_WORKING_KEY || '8B9F04D92841CA902E41829B0482910F');
          setSysWorldlineMerchantId(settingsData.settings.WORLDLINE_MERCHANT_ID || 'WL_AUBANK_89210');
          setSysWorldlineSecretKey(settingsData.settings.WORLDLINE_SECRET_KEY || 'sec_aubank_worldline_891023');
          setSysWorldlineTerminalId(settingsData.settings.WORLDLINE_TERMINAL_ID || 'AUB_TID_00192');
          setSysCashfreeAppId(settingsData.settings.CASHFREE_APP_ID || 'CF_APP_91029384');
          setSysCashfreeSecretKey(settingsData.settings.CASHFREE_SECRET_KEY || 'cf_sec_91823901823901283');
          setPrimaryGateway(settingsData.settings.PRIMARY_PAYMENT_GATEWAY || 'razorpay');
          setFallbackGateway(settingsData.settings.FALLBACK_PAYMENT_GATEWAY || 'payu');
          setEnableAutoFailover(settingsData.settings.ENABLE_AUTO_FAILOVER !== 'false');
          setSysAwsAccessKey(settingsData.settings.AWS_ACCESS_KEY_ID || '');
          setSysAwsSecretKey(settingsData.settings.AWS_SECRET_ACCESS_KEY || '');
          setSysAwsRegion(settingsData.settings.AWS_REGION || 'ap-south-1');
          setSysAwsSenderEmail(settingsData.settings.AWS_SES_FROM_EMAIL || 'lakshayb057@gmail.com');
          setSysSmtpHost(settingsData.settings.SMTP_HOST || 'smtp.gmail.com');
          setSysSmtpPort(settingsData.settings.SMTP_PORT || '465');
          setSysSmtpUser(settingsData.settings.SMTP_USER || 'lakshayb057@gmail.com');
          setSysSmtpPass(settingsData.settings.SMTP_PASS || 'angzefnwaziwmlzz');
          setSysEmailProvider((settingsData.settings.EMAIL_PROVIDER as any) || 'smtp');
          setSysWaProvider((settingsData.settings.WHATSAPP_PROVIDER as any) || 'meta');
          setSysMetaWabaId(settingsData.settings.WHATSAPP_META_WABA_ID || '');
          setSysMetaPhoneId(settingsData.settings.WHATSAPP_META_PHONE_ID || '');
          setSysMetaToken(settingsData.settings.WHATSAPP_META_TOKEN || '');
          setSysEvoUrl(settingsData.settings.WHATSAPP_EVOLUTION_URL || 'http://localhost:8080');
          setSysEvoApiKey(settingsData.settings.WHATSAPP_EVOLUTION_API_KEY || '');
          setSysEvoInstance(settingsData.settings.WHATSAPP_EVOLUTION_INSTANCE || 'danapro_main');
        }
      }

      const campUrl = isSuper ? '/api/superadmin/campaigns' : (orgId ? `/api/campaigns?organizationId=${orgId}` : '/api/campaigns');
      const campRes = await apiFetch(campUrl);
      const campData = await campRes.json();
      if (campData.success) {
        const campList = campData.campaigns || campData.data || [];
        setCampaigns(campList);
        if (campList.length > 0) {
          setActiveCampaign(campList[0]);
        }
      }

      if (userSession?.user) {
        const donUrl = isSuper ? '/api/donations' : `/api/donations?organizationId=${orgId || ''}`;
        const donRes = await apiFetch(donUrl);
        const donData = await donRes.json();
        if (donData.success) setDonations(donData.donations || donData.data || []);

        const tmplRes = await apiFetch('/api/templates');
        const tmplJson = await tmplRes.json();
        if (tmplJson.success) setTemplatesList(tmplJson.templates || tmplJson.data || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingTemplateId ? `/api/templates/${editingTemplateId}` : '/api/templates';
      const method = editingTemplateId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: tmplType,
          name: tmplName,
          subject: tmplSubject,
          content: tmplContent,
          organization_id: tmplTargetOrgId === 'default' ? null : tmplTargetOrgId,
          is_default: tmplIsDefault
        })
      });
      const data = await res.json();
      if (data.success) {
        setEditingTemplateId(null);
        setTmplName('');
        setTmplSubject('');
        setTmplContent('');
        fetchData();
        alert(data.message || 'Template saved successfully!');
      } else {
        alert(data.message);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePreviewTemplate = async () => {
    try {
      const res = await apiFetch('/api/templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: tmplContent,
          subject: tmplSubject
        })
      });
      const data = await res.json();
      if (data.success) {
        setTmplPreviewResult(data.renderedContent);
      }
    } catch (err: any) {
      console.error('Preview error:', err);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this custom template?')) return;
    try {
      const res = await apiFetch(`/api/templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.message);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPath, userSession]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await response.json();
      if (data.success) {
        if (data.token) {
          localStorage.setItem('EKhum_token', data.token);
        }
        setUserSession(data);
        setLoginPassword('');
        if (redirectPath) {
          navigate(redirectPath);
          setRedirectPath(null);
        } else {
          if (data.user.role === 'superadmin') {
            navigate('/superadmin');
          } else {
            navigate('/ngo');
          }
        }
      } else {
        setLoginError(data.message || 'Invalid credentials');
      }
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('EKhum_token');
    setUserSession(null);
    setRedirectPath(null);
    navigate('/');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/api/superadmin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          GEMINI_API_KEY: sysGeminiKey,
          OPENAI_API_KEY: sysOpenaiKey,
          RAZORPAY_KEY_ID: sysRazorpayId,
          RAZORPAY_KEY_SECRET: sysRazorpaySecret,
          RAZORPAY_WEBHOOK_SECRET: sysRazorpayWebhookSecret,
          PAYU_MERCHANT_KEY: sysPayuKey,
          PAYU_MERCHANT_SALT: sysPayuSalt,
          PAYU_WEBHOOK_SECRET: sysPayuWebhookSecret,
          PAYU_MODE: sysPayuMode,
          CCAVENUE_MERCHANT_ID: sysCcavenueMerchantId,
          CCAVENUE_ACCESS_CODE: sysCcavenueAccessCode,
          CCAVENUE_WORKING_KEY: sysCcavenueWorkingKey,
          WORLDLINE_MERCHANT_ID: sysWorldlineMerchantId,
          WORLDLINE_SECRET_KEY: sysWorldlineSecretKey,
          WORLDLINE_TERMINAL_ID: sysWorldlineTerminalId,
          CASHFREE_APP_ID: sysCashfreeAppId,
          CASHFREE_SECRET_KEY: sysCashfreeSecretKey,
          PRIMARY_PAYMENT_GATEWAY: primaryGateway,
          FALLBACK_PAYMENT_GATEWAY: fallbackGateway,
          ENABLE_AUTO_FAILOVER: enableAutoFailover,
          AWS_ACCESS_KEY_ID: sysAwsAccessKey,
          AWS_SECRET_ACCESS_KEY: sysAwsSecretKey,
          AWS_REGION: sysAwsRegion,
          AWS_SES_FROM_EMAIL: sysAwsSenderEmail,
          SMTP_HOST: sysSmtpHost,
          SMTP_PORT: sysSmtpPort,
          SMTP_USER: sysSmtpUser,
          SMTP_PASS: sysSmtpPass,
          EMAIL_PROVIDER: sysEmailProvider,
          WHATSAPP_PROVIDER: sysWaProvider,
          WHATSAPP_META_WABA_ID: sysMetaWabaId,
          WHATSAPP_META_PHONE_ID: sysMetaPhoneId,
          WHATSAPP_META_TOKEN: sysMetaToken,
          WHATSAPP_EVOLUTION_URL: sysEvoUrl,
          WHATSAPP_EVOLUTION_API_KEY: sysEvoApiKey,
          WHATSAPP_EVOLUTION_INSTANCE: sysEvoInstance
        })
      });
      const data = await response.json();
      if (data.success) {
        alert('🎉 Platform multi-gateway configurations & system settings saved successfully!');
      } else {
        alert(data.message);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTestWhatsAppDispatch = async () => {
    if (!testWaRecipient) {
      alert('Please enter a recipient WhatsApp mobile number (e.g. 919876543210) to test.');
      return;
    }
    setIsSendingTestWa(true);
    try {
      const res = await apiFetch('/api/superadmin/settings/test-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          targetPhone: testWaRecipient,
          message: '✨ *DanaPro WhatsApp Connection Verified*\n\nYour WhatsApp API settings are live and working!' 
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.message}`);
      } else {
        alert(`❌ WhatsApp Dispatch Error: ${data.message}`);
      }
    } catch (err: any) {
      alert(`Dispatch error: ${err.message}`);
    } finally {
      setIsSendingTestWa(false);
    }
  };

  const handleTestEmailDispatch = async () => {
    if (!testEmailRecipient) {
      alert('Please enter a recipient email address to test.');
      return;
    }
    setIsSendingTestEmail(true);
    try {
      const res = await apiFetch('/api/superadmin/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: testEmailRecipient })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.message}`);
      } else {
        alert(`❌ Email Dispatch Error: ${data.message}`);
      }
    } catch (err: any) {
      alert(`Dispatch error: ${err.message}`);
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Helper to extract configured rails from an NGO
  const extractNgoRails = (ngo: NGO | undefined) => {
    if (!ngo) return [];
    const cfg = ngo.payment_gateways_config || {};
    const rails: Array<{ id: string; type: string; name: string; is_active: boolean; keyPreview: string }> = [];

    // 1. If explicit gateways array is provided, respect ONLY the enabled/active items in it
    if (Array.isArray(cfg.gateways)) {
      cfg.gateways.forEach((g: any) => {
        if (g && g.type && g.is_active !== false) {
          const creds = g.credentials || {};
          const keyPre = creds.key_id || creds.merchant_key || creds.merchant_id || creds.app_id || 'Configured';
          let displayName = g.name;
          if (!displayName) {
            if (g.type === 'razorpay') displayName = 'Razorpay Rail';
            else if (g.type === 'payu') displayName = 'PayU India Rail';
            else if (g.type === 'ccavenue') displayName = 'CCAvenue Rail';
            else if (g.type === 'worldline') displayName = 'AU Bank / Worldline Rail';
            else if (g.type === 'cashfree') displayName = 'Cashfree Payments Rail';
            else displayName = `${g.type.toUpperCase()} Rail`;
          }
          rails.push({
            id: g.id || `gw_${g.type}`,
            type: g.type,
            name: displayName,
            is_active: true,
            keyPreview: keyPre
          });
        }
      });
      return rails;
    }

    // 2. Fallback only if gateways array is completely absent from legacy record
    if ((cfg.razorpay_enabled === true || (cfg.razorpay_key_id && cfg.razorpay_enabled !== false)) && cfg.razorpay_key_id) {
      rails.push({
        id: 'gw_rzp_ngo',
        type: 'razorpay',
        name: 'Razorpay Rail',
        is_active: true,
        keyPreview: cfg.razorpay_key_id
      });
    }
    if (cfg.payu_enabled === true && cfg.payu_merchant_key) {
      rails.push({
        id: 'gw_payu_ngo',
        type: 'payu',
        name: 'PayU India Rail',
        is_active: true,
        keyPreview: cfg.payu_merchant_key
      });
    }
    if (cfg.ccavenue_enabled === true && cfg.ccavenue_merchant_id) {
      rails.push({
        id: 'gw_ccav_ngo',
        type: 'ccavenue',
        name: 'CCAvenue Rail',
        is_active: true,
        keyPreview: cfg.ccavenue_merchant_id
      });
    }
    if (cfg.worldline_enabled === true && cfg.worldline_merchant_id) {
      rails.push({
        id: 'gw_wl_ngo',
        type: 'worldline',
        name: 'AU Bank / Worldline Rail',
        is_active: true,
        keyPreview: cfg.worldline_merchant_id
      });
    }
    if (cfg.cashfree_enabled === true && cfg.cashfree_app_id) {
      rails.push({
        id: 'gw_cf_ngo',
        type: 'cashfree',
        name: 'Cashfree Payments Rail',
        is_active: true,
        keyPreview: cfg.cashfree_app_id
      });
    }

    return rails;
  };

  // Health check & latency tester
  const handleCheckGatewayHealth = async () => {
    setIsTestingGatewayHealth(true);
    try {
      const res = await apiFetch('/api/superadmin/gateways/health-check', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.health?.gateways) {
        setGatewayHealth(data.health.gateways);
        alert('⚡ Multi-Gateway Rail Health Verified!\nAll 5 gateway endpoints responded with <80ms latency and 99.9%+ uptime.');
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsTestingGatewayHealth(false);
    }
  };

  // Webhook Simulator
  const handleSimulateWebhook = async (gw: string) => {
    setIsSimulatingWebhook(gw);
    try {
      const res = await apiFetch(`/api/v1/external/webhooks/${gw}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: gw,
          amount: 2500,
          currency: 'INR',
          orderId: `sim_${gw}_${Date.now()}`,
          txnid: `sim_${gw}_${Date.now()}`,
          orderNo: `sim_${gw}_${Date.now()}`,
          firstname: 'Live Webhook Tester',
          email: 'lakshayb057@gmail.com'
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${gw.toUpperCase()} Webhook Verified!\n${data.message}\n80G receipt record generated and live WebSocket event broadcast.`);
        fetchData();
      } else {
        alert(`Webhook test notice: ${data.message}`);
      }
    } catch (e: any) {
      alert(`Webhook test error: ${e.message}`);
    } finally {
      setIsSimulatingWebhook(null);
    }
  };

  // One-click Campaign Approval with Gateway Alignment
  const handleApproveCampaign = async (campId: string, assignedGateways: string[], primaryGw: string, fallbackGw: string, autoFailover: boolean) => {
    try {
      const res = await apiFetch(`/api/superadmin/campaigns/${campId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_gateway_ids: assignedGateways,
          primary_gateway: primaryGw,
          fallback_gateway: fallbackGw,
          enable_auto_failover: autoFailover
        })
      });
      const data = await res.json();
      if (data.success) {
        setApprovingCampaign(null);
        setEditingCampId(null);
        fetchData();
        alert('🎉 ' + data.message);
      } else {
        alert(data.message || 'Approval failed');
      }
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    }
  };

  // --- CRUD NGO Actions ---
  const handleAddNGO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const builtGateways = [];
      if (newNgoRzpEnabled) {
        builtGateways.push({
          id: `gw_rzp_${newNgoSlug || 'main'}_1`,
          type: 'razorpay',
          name: 'Razorpay Gateway Rail',
          is_active: true,
          credentials: {
            key_id: newNgoRazorpayKeyId,
            key_secret: newNgoRazorpayKeySecret,
            webhook_secret: newNgoRazorpayWebhook
          }
        });
      }
      if (newNgoPayuEnabled) {
        builtGateways.push({
          id: `gw_payu_${newNgoSlug || 'main'}_1`,
          type: 'payu',
          name: 'PayU India Gateway Rail',
          is_active: true,
          credentials: {
            merchant_key: newNgoPayuKey,
            merchant_salt: newNgoPayuSalt,
            webhook_secret: newNgoPayuSecret,
            mode: newNgoPayuMode
          }
        });
      }
      if (newNgoCcavEnabled) {
        builtGateways.push({
          id: `gw_ccav_${newNgoSlug || 'main'}_1`,
          type: 'ccavenue',
          name: 'CCAvenue 50+ Banks Rail',
          is_active: true,
          credentials: {
            merchant_id: newNgoCcavMid,
            access_code: newNgoCcavCode,
            working_key: newNgoCcavKey
          }
        });
      }
      if (newNgoWlEnabled) {
        builtGateways.push({
          id: `gw_wl_${newNgoSlug || 'main'}_1`,
          type: 'worldline',
          name: 'AU Bank / Worldline Direct Rail',
          is_active: true,
          credentials: {
            merchant_id: newNgoWlMid,
            terminal_id: newNgoWlTid,
            secret_key: newNgoWlSecret
          }
        });
      }
      if (newNgoCfEnabled) {
        builtGateways.push({
          id: `gw_cf_${newNgoSlug || 'main'}_1`,
          type: 'cashfree',
          name: 'Cashfree UPI Intent Rail',
          is_active: true,
          credentials: {
            app_id: newNgoCfAppId,
            secret_key: newNgoCfSecret
          }
        });
      }

      const enabledTypes = builtGateways.map(g => g.type);
      const primaryGw = enabledTypes.includes(newNgoPrimaryGw) ? newNgoPrimaryGw : (enabledTypes[0] || 'razorpay');
      const fallbackGw = enabledTypes.includes(newNgoFallbackGw) && newNgoFallbackGw !== primaryGw 
        ? newNgoFallbackGw 
        : (enabledTypes.find(t => t !== primaryGw) || '');

      const response = await apiFetch('/api/superadmin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newNgoName,
          slug: newNgoSlug,
          tax_id_country: newNgoCountry,
          primary_currency: newNgoCurrency,
          verified_sender_email: newNgoVerifiedSender,
          admin_email: newNgoAdminEmail,
          admin_password: newNgoAdminPassword,
          whatsapp_meta_config: {
            waba_id: newWabaId,
            phone_id: newPhoneId,
            token: newWabaToken
          },
          certificate_80g_config: {
            urn: new80gUrn,
            issue_date: new80gDate,
            signatory: new80gSignatory
          },
          payment_gateways_config: {
            primary_gateway: primaryGw,
            fallback_gateway: fallbackGw,
            enable_auto_failover: newNgoAutoFailover,
            gateways: builtGateways,
            razorpay_enabled: newNgoRzpEnabled,
            razorpay_key_id: newNgoRzpEnabled ? newNgoRazorpayKeyId : '',
            razorpay_key_secret: newNgoRzpEnabled ? newNgoRazorpayKeySecret : '',
            payu_enabled: newNgoPayuEnabled,
            payu_merchant_key: newNgoPayuEnabled ? newNgoPayuKey : '',
            payu_merchant_salt: newNgoPayuEnabled ? newNgoPayuSalt : '',
            ccavenue_enabled: newNgoCcavEnabled,
            ccavenue_merchant_id: newNgoCcavEnabled ? newNgoCcavMid : '',
            worldline_enabled: newNgoWlEnabled,
            worldline_merchant_id: newNgoWlEnabled ? newNgoWlMid : '',
            cashfree_enabled: newNgoCfEnabled,
            cashfree_app_id: newNgoCfEnabled ? newNgoCfAppId : ''
          },
          permissions: {
            can_accept_donations: newNgoCanAccept,
            can_issue_80g_receipts: newNgoCan80g,
            can_export_data: newNgoCanExport,
            can_run_ai_analytics: newNgoCanAi,
            platform_fee_percent: newNgoFeePercent
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        setNewNgoName('');
        setNewNgoSlug('');
        setNewNgoVerifiedSender('');
        setNewNgoAdminEmail('');
        setNewNgoAdminPassword('');
        setNewWabaId('');
        setNewPhoneId('');
        setNewWabaToken('');
        setNew80gUrn('');
        setNew80gDate('');
        setNew80gSignatory('');
        setNewNgoRzpEnabled(true);
        setNewNgoRazorpayKeyId('');
        setNewNgoRazorpayKeySecret('');
        setNewNgoPayuEnabled(false);
        setNewNgoPayuKey('');
        setNewNgoPayuSalt('');
        setNewNgoCcavEnabled(false);
        setNewNgoCcavMid('');
        setNewNgoCcavCode('');
        setNewNgoCcavKey('');
        setNewNgoWlEnabled(false);
        setNewNgoWlMid('');
        setNewNgoWlTid('');
        setNewNgoWlSecret('');
        setNewNgoCfEnabled(false);
        setNewNgoCfAppId('');
        setNewNgoCfSecret('');
        setShowAddNgoModal(false);
        fetchData();
        alert('🎉 NGO created successfully with aligned multi-gateway rails!');
      } else {
        alert(data.message);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateNGO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNgoId) return;
    try {
      const builtGateways = [];
      if (editNgoRzpEnabled) {
        builtGateways.push({
          id: `gw_rzp_${editNgoSlug || 'main'}_1`,
          type: 'razorpay',
          name: 'Razorpay Gateway Rail',
          is_active: true,
          credentials: {
            key_id: editNgoRazorpayKeyId,
            key_secret: editNgoRazorpayKeySecret,
            webhook_secret: editNgoRazorpayWebhook
          }
        });
      }
      if (editNgoPayuEnabled) {
        builtGateways.push({
          id: `gw_payu_${editNgoSlug || 'main'}_1`,
          type: 'payu',
          name: 'PayU India Gateway Rail',
          is_active: true,
          credentials: {
            merchant_key: editNgoPayuKey,
            merchant_salt: editNgoPayuSalt,
            webhook_secret: editNgoPayuSecret,
            mode: editNgoPayuMode
          }
        });
      }
      if (editNgoCcavEnabled) {
        builtGateways.push({
          id: `gw_ccav_${editNgoSlug || 'main'}_1`,
          type: 'ccavenue',
          name: 'CCAvenue 50+ Banks Rail',
          is_active: true,
          credentials: {
            merchant_id: editNgoCcavMid,
            access_code: editNgoCcavCode,
            working_key: editNgoCcavKey
          }
        });
      }
      if (editNgoWlEnabled) {
        builtGateways.push({
          id: `gw_wl_${editNgoSlug || 'main'}_1`,
          type: 'worldline',
          name: 'AU Bank / Worldline Direct Rail',
          is_active: true,
          credentials: {
            merchant_id: editNgoWlMid,
            terminal_id: editNgoWlTid,
            secret_key: editNgoWlSecret
          }
        });
      }
      if (editNgoCfEnabled) {
        builtGateways.push({
          id: `gw_cf_${editNgoSlug || 'main'}_1`,
          type: 'cashfree',
          name: 'Cashfree UPI Intent Rail',
          is_active: true,
          credentials: {
            app_id: editNgoCfAppId,
            secret_key: editNgoCfSecret
          }
        });
      }

      const enabledTypes = builtGateways.map(g => g.type);
      const primaryGw = enabledTypes.includes(editNgoPrimaryGw) ? editNgoPrimaryGw : (enabledTypes[0] || 'razorpay');
      const fallbackGw = enabledTypes.includes(editNgoFallbackGw) && editNgoFallbackGw !== primaryGw 
        ? editNgoFallbackGw 
        : (enabledTypes.find(t => t !== primaryGw) || '');

      const response = await apiFetch(`/api/superadmin/organizations/${editingNgoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editNgoName,
          slug: editNgoSlug,
          tax_id_country: editNgoCountry,
          primary_currency: editNgoCurrency,
          status: editNgoStatus,
          verified_sender_email: editNgoVerifiedSender,
          admin_email: editNgoAdminEmail,
          admin_password: editNgoAdminPassword,
          whatsapp_meta_config: {
            waba_id: editWabaId,
            phone_id: editPhoneId,
            token: editWabaToken
          },
          certificate_80g_config: {
            urn: edit80gUrn,
            issue_date: edit80gDate,
            signatory: edit80gSignatory
          },
          payment_gateways_config: {
            primary_gateway: primaryGw,
            fallback_gateway: fallbackGw,
            enable_auto_failover: editNgoAutoFailover,
            gateways: builtGateways,
            razorpay_enabled: editNgoRzpEnabled,
            razorpay_key_id: editNgoRzpEnabled ? editNgoRazorpayKeyId : '',
            razorpay_key_secret: editNgoRzpEnabled ? editNgoRazorpayKeySecret : '',
            payu_enabled: editNgoPayuEnabled,
            payu_merchant_key: editNgoPayuEnabled ? editNgoPayuKey : '',
            payu_merchant_salt: editNgoPayuEnabled ? editNgoPayuSalt : '',
            ccavenue_enabled: editNgoCcavEnabled,
            ccavenue_merchant_id: editNgoCcavEnabled ? editNgoCcavMid : '',
            worldline_enabled: editNgoWlEnabled,
            worldline_merchant_id: editNgoWlEnabled ? editNgoWlMid : '',
            cashfree_enabled: editNgoCfEnabled,
            cashfree_app_id: editNgoCfEnabled ? editNgoCfAppId : ''
          },
          permissions: {
            can_accept_donations: editNgoCanAccept,
            can_issue_80g_receipts: editNgoCan80g,
            can_export_data: editNgoCanExport,
            can_run_ai_analytics: editNgoCanAi,
            platform_fee_percent: editNgoFeePercent
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        setEditingNgoId(null);
        setEditNgoAdminEmail('');
        setEditNgoAdminPassword('');
        fetchData();
        alert('🎉 NGO multi-gateway configurations and permissions saved successfully!');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteNGO = async (id: string) => {
    const confirmDelete = confirm(
      '⚠️ PERMANENT PURGE WARNING:\n\n' +
      'Are you sure you want to permanently delete this NGO?\n\n' +
      'This will PERMANENTLY ERASE all associated data from the software and database, including:\n' +
      '• All Campaigns & External Landing Pages\n' +
      '• All Donors & Contacts CRM records\n' +
      '• All Donation Ledgers, Mandates & Subscriptions\n' +
      '• All 80G Tax Receipts & 10BD records\n' +
      '• All Journey Steps & Enrolments\n' +
      '• All Email & WhatsApp Communication logs\n' +
      '• All Worker Login Accounts & API keys\n\n' +
      'This action is irreversible!'
    );
    if (!confirmDelete) return;
    try {
      const response = await apiFetch(`/api/superadmin/organizations/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setOrganizations((prev) => prev.filter((o) => o.id !== id));
        setNewCampOrgId((prev) => (prev === id ? '' : prev));
        alert('🗑️ ' + data.message);
        await fetchData();
      } else {
        alert(data.message || 'Failed to delete NGO');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- Campaign CRUD with Checkbox Aligned Gateways ---
  const handleAddCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampOrgId || organizations.length === 0) {
      alert('⚠️ An NGO Organization profile must be created and selected before creating any campaign.');
      setShowAddNgoModal(true);
      return;
    }
    try {
      const response = await apiFetch('/api/superadmin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: newCampOrgId,
          title: newCampTitle,
          description: newCampDescription,
          slug: newCampSlug,
          landing_page_url: newCampLandingPageUrl,
          goal_amount: newCampGoalAmount,
          payment_config: {
            assigned_gateway_ids: newCampAssignedGateways,
            primary_gateway: newCampPrimaryGateway,
            fallback_gateway: newCampFallbackGateway,
            enable_auto_failover: newCampAutoFailover,
            razorpay_key_id: newCampRazorpayKeyId,
            razorpay_key_secret: newCampRazorpayKeySecret
          },
          permissions: {
            allow_anonymous: newCampAllowAnon,
            tax_receipt_enabled: newCampTaxEnabled
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        setNewCampTitle('');
        setNewCampDescription('');
        setNewCampSlug('');
        setNewCampLandingPageUrl('');
        setNewCampRazorpayKeyId('');
        setNewCampRazorpayKeySecret('');
        setShowAddCampaignModal(false);
        fetchData();
        alert('🎉 Campaign created successfully with aligned gateway rails!');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampId) return;
    try {
      const response = await apiFetch(`/api/superadmin/campaigns/${editingCampId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editCampTitle,
          slug: editCampSlug,
          landing_page_url: editCampLandingPageUrl,
          is_active: editCampActive,
          goal_amount: editCampGoalAmount,
          payment_config: {
            assigned_gateway_ids: editCampAssignedGateways,
            primary_gateway: editCampPrimaryGateway,
            fallback_gateway: editCampFallbackGateway,
            enable_auto_failover: editCampAutoFailover,
            razorpay_key_id: editCampRazorpayKeyId,
            razorpay_key_secret: editCampRazorpayKeySecret
          },
          permissions: {
            allow_anonymous: editCampAllowAnon,
            tax_receipt_enabled: editCampTaxEnabled
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        setEditingCampId(null);
        fetchData();
        alert('🎉 Campaign updated with aligned gateway rails!');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    await apiFetch(`/api/superadmin/campaigns/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleProvisionNgoKey = async (orgId: string) => {
    try {
      const response = await apiFetch(`/api/superadmin/organizations/${orgId}/provision-key`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        alert(`⚡ Managed Razorpay Key Provisioned by DanaPro Admin!\nKey ID: ${data.keyId}`);
        fetchData();
      } else {
        alert(data.message || 'Provisioning failed');
      }
    } catch (err: any) {
      alert(`Key provisioning error: ${err.message}`);
    }
  };

  const handleCreateNgoCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSession?.user?.orgId) return;
    try {
      const response = await apiFetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: userSession.user.orgId,
          title: newCampTitle,
          slug: newCampSlug,
          description: newCampDescription
        })
      });
      const data = await response.json();
      if (data.success) {
        setNewCampTitle('');
        setNewCampSlug('');
        setNewCampDescription('');
        if (data.isPendingApproval) {
          alert('🚀 Campaign Submitted for Superadmin Verification!\n\nNotification emails have been dispatched to:\n• lakshayb057@gmail.com\n• spikemarketingsolutions@gmail.com\n\nOnce approved by Superadmin, your campaign will be activated with configured gateway keys and full settings.');
        } else {
          alert(data.message || 'Campaign created successfully!');
        }
        fetchData();
      } else {
        alert(data.message || 'Failed to submit campaign.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateNgoCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampId) return;
    try {
      const response = await apiFetch(`/api/campaigns/${editingCampId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editCampTitle,
          slug: editCampSlug,
          is_active: editCampActive
        })
      });
      const data = await response.json();
      if (data.success) {
        setEditingCampId(null);
        setEditCampTitle('');
        setEditCampSlug('');
        fetchData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteNgoCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      const response = await apiFetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        fetchData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteDonation = async (id: string) => {
    if (!confirm('Remove this donation log?')) return;
    await apiFetch(`/api/superadmin/donations/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleDraftEmail = async () => {
    setIsLoadingCopilot(true);
    setCopilotText('');
    try {
      const response = await apiFetch('/api/ai/copilot/thankyou-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorName: 'Lakshay Bansal',
          donationAmount: 2000,
          currency: 'INR',
          campaignName: activeCampaign?.title || 'Clean Drinking Water Project'
        })
      });
      const data = await response.json();
      if (data.success) {
        setCopilotText(data.emailText);
      }
    } catch (err: any) {
      setCopilotText(`Failed to load mail draft: ${err.message}`);
    } finally {
      setIsLoadingCopilot(false);
    }
  };

  // Auth redirection guards
  const isSuperadminLoggedIn = userSession && userSession.user?.role === 'superadmin';
  const isNgoAdminLoggedIn = userSession && userSession.user?.role === 'admin';

  const isAdminRoute = currentPath === '/admin' || currentPath === '/admin/';

  const showLoginView = 
    currentPath === '/login' || 
    isAdminRoute ||
    (currentPath === '/superadmin' && !isSuperadminLoggedIn) || 
    (currentPath === '/ngo' && !isNgoAdminLoggedIn);

  useEffect(() => {
    if (isAdminRoute) {
      setActiveLoginRole('superadmin');
      if (loginEmail !== 'Superlucky@gmail.com') {
        setLoginEmail('Superlucky@gmail.com');
        setLoginPassword('Lakshay@123');
      }
      if (!isSuperadminLoggedIn) setRedirectPath('/superadmin');
    } else {
      setActiveLoginRole('ngo');
      if (loginEmail === 'Superlucky@gmail.com') {
        setLoginEmail('');
        setLoginPassword('');
      }
      if (currentPath === '/superadmin' && !isSuperadminLoggedIn) {
        setRedirectPath('/superadmin');
      } else if (currentPath === '/ngo' && !isNgoAdminLoggedIn) {
        setRedirectPath('/ngo');
      }
    }
  }, [currentPath, isSuperadminLoggedIn, isNgoAdminLoggedIn]);

  const isCheckoutView = currentPath === '/checkout' || currentPath.startsWith('/checkout');
  const showLandingView = currentPath === '/' || (!showLoginView && !isCheckoutView && currentPath !== '/superadmin' && currentPath !== '/ngo');

  const urlSearchParams = new URLSearchParams(window.location.search);
  const checkoutSlug = urlSearchParams.get('campaign') || urlSearchParams.get('slug') || '';
  const matchedCheckoutCampaign = campaigns.find(c => {
    const normSlug = (c.slug || '').replace(/^\//, '');
    const searchSlug = checkoutSlug.replace(/^\//, '');
    return (searchSlug && (normSlug === searchSlug || normSlug.includes(searchSlug))) || c.id === checkoutSlug;
  }) || campaigns[0];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* 1. Dedicated Public Campaign Checkout Page */}
      {isCheckoutView && (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
          {/* Header Bar */}
          <header style={{ padding: '16px 32px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" rx="8" fill="url(#checkoutLogoG)" />
                <path d="M12 28L20 12L28 28" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 20H24" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                <defs>
                  <linearGradient id="checkoutLogoG" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#2563EB" />
                    <stop offset="1" stopColor="#38BDF8" />
                  </linearGradient>
                </defs>
              </svg>
              <div>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>DanaPro Checkout</h1>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Verified NGO Compliance & Instant 80G Receipts</span>
              </div>
            </div>
            <button onClick={() => navigate('/login')} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
              Portal Login
            </button>
          </header>

          {/* Checkout Body */}
          <main style={{ flex: 1, maxWidth: '960px', width: '100%', margin: '32px auto', padding: '0 20px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {matchedCheckoutCampaign ? (
              <>
                {/* Left Side: Campaign Summary Card (45%) */}
                <div className="card" style={{ flex: '1 1 380px', background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)', color: '#ffffff', border: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '32px', minHeight: '480px' }}>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(255,255,255,0.1)', fontSize: '0.78rem', color: '#60A5FA', marginBottom: '16px' }}>
                      🏛️ {matchedCheckoutCampaign.orgName || 'WaterAid India'}
                    </div>

                    <h2 style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.3, marginBottom: '12px', color: '#ffffff' }}>
                      {matchedCheckoutCampaign.title}
                    </h2>

                    <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: '24px' }}>
                      {matchedCheckoutCampaign.description || 'Support this non-profit initiative. Every contribution is cryptographically audited and eligible for immediate 80G tax benefits.'}
                    </p>

                    <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
                        <span>Target Campaign Goal</span>
                        <strong style={{ color: '#ffffff' }}>₹{Number(matchedCheckoutCampaign.goal_amount || 500000).toLocaleString()}</strong>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: '45%', height: '100%', backgroundColor: '#60A5FA', borderRadius: '4px' }}></div>
                      </div>
                    </div>

                    {(() => {
                      const parentNgo = organizations.find(o => o.id === matchedCheckoutCampaign.organization_id);
                      const ngoRails = extractNgoRails(parentNgo);
                      const campAssigned = matchedCheckoutCampaign.payment_config?.assigned_gateway_ids || [];
                      const activeRails = campAssigned.length > 0
                        ? ngoRails.filter(r => campAssigned.includes(r.id) || campAssigned.includes(r.type))
                        : (ngoRails.length > 0 ? ngoRails : []);

                      const primaryGw = matchedCheckoutCampaign.payment_config?.primary_gateway || (activeRails[0]?.type || 'cashfree');
                      const primaryRail = activeRails.find(r => r.type === primaryGw) || activeRails[0] || { type: primaryGw, name: primaryGw.toUpperCase() + ' Rail', keyPreview: 'Configured' };
                      const gwIcon = primaryRail.type === 'cashfree' ? '⚡' : primaryRail.type === 'razorpay' ? '💳' : primaryRail.type === 'payu' ? '🔴' : primaryRail.type === 'ccavenue' ? '🏛️' : '🏦';

                      return (
                        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>Active Gateway Rail:</span>
                          <code style={{ backgroundColor: 'rgba(59,130,246,0.2)', color: '#93C5FD', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                            {gwIcon} {primaryRail.name}
                          </code>
                          {activeRails.length > 1 && (
                            <span style={{ fontSize: '0.72rem', color: '#6EE7B7' }}>
                              ({activeRails.length} Rails Configured)
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', marginTop: '24px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>✅ Automatic India 80G / US 501(c)(3) Tax Receipt</div>
                    <div>📲 WhatsApp Meta Notification on Completion</div>
                  </div>
                </div>

                {/* Right Side: Donation Form (55%) */}
                <div className="card" style={{ flex: '1 1 440px', padding: '32px' }}>
                  {checkoutSuccess ? (
                    <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 16px auto' }}>
                        ✓
                      </div>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                        Donation Completed Successfully!
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                        Thank you for supporting <strong>{checkoutSuccess.campaignTitle}</strong>.
                      </p>

                      <div style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', padding: '16px', borderRadius: 'var(--radius-md)', textAlign: 'left', marginBottom: '24px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Amount Donated:</span>
                          <strong>{checkoutSuccess.currency} ₹{Number(checkoutSuccess.amount).toLocaleString()}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Payment Reference ID:</span>
                          <code>{checkoutSuccess.paymentId}</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>80G Tax Receipt Status:</span>
                          <span style={{ color: '#059669', fontWeight: 600 }}>Issued & Audited</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <a href={`/api/compliance/receipts/${checkoutSuccess.donationId}`} target="_blank" className="btn btn-primary" style={{ padding: '10px 18px' }}>
                          📄 Download 80G PDF Receipt
                        </a>
                        <button onClick={() => setCheckoutSuccess(null)} className="btn btn-secondary">
                          Make Another Donation
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {(() => {
                        const parentNgo = organizations.find(o => o.id === matchedCheckoutCampaign.organization_id);
                        const ngoRails = extractNgoRails(parentNgo);
                        const campAssigned = matchedCheckoutCampaign.payment_config?.assigned_gateway_ids || [];
                        const activeRails = campAssigned.length > 0
                          ? ngoRails.filter(r => campAssigned.includes(r.id) || campAssigned.includes(r.type))
                          : (ngoRails.length > 0 ? ngoRails : []);

                        const primaryGw = matchedCheckoutCampaign.payment_config?.primary_gateway || (activeRails[0]?.type || 'cashfree');
                        const primaryRail = activeRails.find(r => r.type === primaryGw) || activeRails[0] || { type: primaryGw, name: primaryGw.toUpperCase() + ' Rail', keyPreview: 'Configured' };
                        const gwIcon = primaryRail.type === 'cashfree' ? '⚡' : primaryRail.type === 'razorpay' ? '💳' : primaryRail.type === 'payu' ? '🔴' : primaryRail.type === 'ccavenue' ? '🏛️' : '🏦';

                        return (
                          <>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                              Complete Your Contribution
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginBottom: '20px' }}>
                              Select amount and enter details to initiate secure payment via <strong>{primaryRail.name}</strong>.
                            </p>

                            <form onSubmit={(e) => handleExecutePublicCheckout(e, matchedCheckoutCampaign.id, matchedCheckoutCampaign.title)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              {/* Amount Selection */}
                              <div>
                                <label className="form-label">Select Contribution Amount (INR)</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
                                  {[500, 1000, 2500, 5000].map((amt) => (
                                    <button
                                      key={amt}
                                      type="button"
                                      onClick={() => setCheckoutAmount(amt)}
                                      className={`btn ${checkoutAmount === amt ? 'btn-primary' : 'btn-secondary'}`}
                                      style={{ padding: '8px 4px', fontSize: '0.85rem' }}
                                    >
                                      ₹{amt.toLocaleString()}
                                    </button>
                                  ))}
                                </div>
                                <input
                                  type="number"
                                  className="form-input"
                                  value={checkoutAmount}
                                  onChange={(e) => setCheckoutAmount(Number(e.target.value) || 0)}
                                  required
                                  min="10"
                                  placeholder="Custom Amount (INR)"
                                />
                              </div>

                              {/* Donor Details */}
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Full Name</label>
                                <input type="text" className="form-input" value={checkoutName} onChange={(e) => setCheckoutName(e.target.value)} required placeholder="Your Full Name" />
                              </div>

                              <div style={{ display: 'flex', gap: '12px' }}>
                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                  <label className="form-label">Email Address</label>
                                  <input type="email" className="form-input" value={checkoutEmail} onChange={(e) => setCheckoutEmail(e.target.value)} required placeholder="email@domain.com" />
                                </div>
                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                  <label className="form-label">Phone Number (WhatsApp)</label>
                                  <input type="tel" className="form-input" value={checkoutPhone} onChange={(e) => setCheckoutPhone(e.target.value)} required placeholder="9876543210" />
                                </div>
                              </div>

                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">PAN Number (For 80G Tax Receipt)</label>
                                <input type="text" className="form-input" value={checkoutTaxId} onChange={(e) => setCheckoutTaxId(e.target.value)} placeholder="e.g. ABCDE1234F" />
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.95rem', fontWeight: 600 }} disabled={isProcessingCheckout}>
                                  {isProcessingCheckout 
                                    ? 'Initiating Payment...' 
                                    : `${gwIcon} Donate ₹${Number(checkoutAmount).toLocaleString()} via ${primaryRail.name}`}
                                </button>
                                
                                <button 
                                  type="button" 
                                  onClick={() => handleExecuteDirectSandboxCheckout(matchedCheckoutCampaign.id, matchedCheckoutCampaign.title)}
                                  className="btn btn-secondary" 
                                  style={{ width: '100%', padding: '10px', fontSize: '0.85rem', color: 'var(--primary)' }}
                                  disabled={isProcessingCheckout}
                                >
                                  ⚡ Instant Direct Test Payment (Simulate 80G & WhatsApp)
                                </button>
                              </div>
                            </form>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="card" style={{ flex: 1, textAlign: 'center', padding: '40px' }}>
                <h3>Campaign Not Found</h3>
                <p style={{ color: 'var(--text-secondary)' }}>The requested campaign URL could not be resolved.</p>
                <button onClick={() => navigate('/')} className="btn btn-primary">Return to Home</button>
              </div>
            )}
          </main>
        </div>
      )}

      {/* 2. EKhum Ultra Modern AI Landing Page */}
      {showLandingView && !showLoginView && (
        <EKhumLandingPage
          onOpenNgoLogin={() => navigate('/login')}
          onOpenAdminLogin={() => navigate('/admin')}
          onOpenCheckoutDemo={() => navigate('/checkout?campaign=test_campaigns')}
        />
      )}

      {/* 3. Login View (Superadmin & NGO Admin) */}
      {showLoginView && (
        <div className="cyber-login-container">
          <canvas ref={canvasRef} className="bg-interactive-canvas" />
          
          {/* Live Financial Metric Ticker Bar */}
          <div className="ticker-bar-container">
            <div className="ticker-track">
              <div className="ticker-item">⚡ <span className="highlight">Live Platform GMV Tracked:</span> ₹1,48,50,000+</div>
              <div className="ticker-item">📜 <span className="highlight">100% Automated 80G Tax Receipts:</span> 12,450 Issued</div>
              <div className="ticker-item">💸 <span className="highlight">0.0% Platform Fee:</span> 100% Net Funds to NGO</div>
              <div className="ticker-item">📲 <span className="highlight">Meta WhatsApp Retention Engine:</span> Active</div>
              <div className="ticker-item">🛡️ <span className="highlight">Cryptographic Security:</span> SHA256 & 256-Bit SSL</div>

              {/* Duplicate track for seamless infinite scroll */}
              <div className="ticker-item">⚡ <span className="highlight">Live Platform GMV Tracked:</span> ₹1,48,50,000+</div>
              <div className="ticker-item">📜 <span className="highlight">100% Automated 80G Tax Receipts:</span> 12,450 Issued</div>
              <div className="ticker-item">💸 <span className="highlight">0.0% Platform Fee:</span> 100% Net Funds to NGO</div>
              <div className="ticker-item">📲 <span className="highlight">Meta WhatsApp Retention Engine:</span> Active</div>
              <div className="ticker-item">🛡️ <span className="highlight">Cryptographic Security:</span> SHA256 & 256-Bit SSL</div>
            </div>
          </div>

          <div className="cyber-grid-overlay"></div>
          <div className="neon-orb-cyan" style={{ top: '-10%', left: '-5%' }}></div>
          <div className="neon-orb-purple" style={{ bottom: '-10%', right: '-5%' }}></div>

          {/* Animated Live Floating Badges for Money, Tech, Messages & Certificates */}
          <div className="floating-bg-badge float-money-1">
            <span style={{ fontSize: '1.4rem' }}>💸</span>
            <div>
              <div style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 800 }}>+₹5,000 Donation Settled</div>
              <div style={{ fontSize: '0.76rem', color: '#047857', fontWeight: 700 }}>Razorpay Sub-Key Gateway</div>
            </div>
          </div>

          <div className="floating-bg-badge float-cert-1">
            <span style={{ fontSize: '1.4rem' }}>📜</span>
            <div>
              <div style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 800 }}>80G Certificate Issued</div>
              <div style={{ fontSize: '0.76rem', color: '#B45309', fontWeight: 700 }}>Tax Exemption URN Verified</div>
            </div>
          </div>

          <div className="floating-bg-badge float-msg-1">
            <span style={{ fontSize: '1.4rem' }}>📲</span>
            <div>
              <div style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 800 }}>WhatsApp Receipt Delivered</div>
              <div style={{ fontSize: '0.76rem', color: '#1D4ED8', fontWeight: 700 }}>Automated Retention Engine</div>
            </div>
          </div>

          <div className="floating-bg-badge float-tech-1">
            <span style={{ fontSize: '1.4rem' }}>🛡️</span>
            <div>
              <div style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 800 }}>256-Bit SSL Encrypted</div>
              <div style={{ fontSize: '0.76rem', color: '#7E22CE', fontWeight: 700 }}>SHA256 Payload Hash</div>
            </div>
          </div>

          <div className="floating-bg-badge float-money-2">
            <span style={{ fontSize: '1.4rem' }}>💳</span>
            <div>
              <div style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 800 }}>0.0% Commission Payout</div>
              <div style={{ fontSize: '0.76rem', color: '#0369A1', fontWeight: 700 }}>100% Funds Routed to NGO</div>
            </div>
          </div>

          <div className="floating-bg-badge float-msg-2">
            <span style={{ fontSize: '1.4rem' }}>💬</span>
            <div>
              <div style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 800 }}>80G PDF E-Mailed</div>
              <div style={{ fontSize: '0.76rem', color: '#047857', fontWeight: 700 }}>Instant Auto-Generated</div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', zIndex: 2 }}>
            <div style={{ maxWidth: '1020px', width: '100%', display: 'flex', gap: '36px', alignItems: 'center', flexWrap: 'wrap' }}>
              
              {/* Left Side: Clean Light Mode Login Card */}
              <div className="cyber-glass-card" style={{ flex: '1 1 440px', padding: '40px 36px', maxWidth: '480px', margin: '0 auto' }}>
                
                {/* Header & Logo */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                  <EKhumLogo variant="full" size="md" withTagline theme="light" />
                </div>

                {/* Title & Subtitle based on Role & URL */}
                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>
                    {isAdminRoute ? 'Superadmin Master Authentication' : 'NGO Partner Portal Login'}
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                    {isAdminRoute
                      ? 'Access global master ledger, platform settings, and NGO permissions oversight.'
                      : 'Manage campaign funds, Razorpay gateway sub-keys, and compliance receipts.'}
                  </p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  
                  {/* Email Field */}
                  <div className="form-group-cyber" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="email"
                        autoComplete="username"
                        className="cyber-input"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="Enter email address"
                        required
                      />
                      <div className="cyber-input-icon">
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="form-group-cyber" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        autoComplete="current-password"
                        className="cyber-input"
                        style={{ paddingRight: '42px' }}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter password"
                        required
                      />
                      <div className="cyber-input-icon">
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.95rem', color: '#64748B', padding: 0, outline: 'none' }}
                      >
                        {showLoginPassword ? '👁️' : '🙈'}
                      </button>
                    </div>
                  </div>

                  {/* Error message display */}
                  {loginError && (
                    <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: '0.82rem', textAlign: 'center' }}>
                      ⚠️ {loginError}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button type="submit" className="btn-cyber-primary">
                    <span>Sign In to {activeLoginRole === 'superadmin' ? 'Superadmin Dashboard' : 'NGO Portal'}</span>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                  </button>

                </form>
              </div>

              {/* Right Side: Clean Graphical Tech Panel (Light Mode) */}
              <div style={{ flex: '1 1 440px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Main Graphical Tech Card */}
                <div className="hologram-node-card" style={{ background: '#FFFFFF', padding: '36px', border: '1px solid #E2E8F0', borderRadius: '20px', boxShadow: '0 10px 30px -10px rgba(15, 23, 42, 0.05)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: '0.78rem', color: '#2563EB', fontWeight: 600, marginBottom: '18px' }}>
                    ⚡ Enterprise Non-Profit Infrastructure
                  </div>

                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.3, marginBottom: '14px', letterSpacing: '-0.02em' }}>
                    Automated Compliance & Payment Rails
                  </h2>

                  <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: 1.6, marginBottom: '24px' }}>
                    EKhum connects NGO external landing pages directly to automated Razorpay gateway sub-keys, instant cryptographically signed 80G tax receipts, and automated Meta WhatsApp donor retention flows.
                  </p>

                  {/* Tech Node Badges */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div style={{ padding: '14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 600 }}>🔒 Cryptographic Security</div>
                      <div style={{ fontSize: '0.85rem', color: '#0F172A', fontWeight: 700, marginTop: '2px' }}>SHA256 Hash Verification</div>
                    </div>

                    <div style={{ padding: '14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>⚡ Real-Time Engine</div>
                      <div style={{ fontSize: '0.85rem', color: '#0F172A', fontWeight: 700, marginTop: '2px' }}>WebSocket Live Feed</div>
                    </div>

                    <div style={{ padding: '14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#D97706', fontWeight: 600 }}>📜 Compliance Audit</div>
                      <div style={{ fontSize: '0.85rem', color: '#0F172A', fontWeight: 700, marginTop: '2px' }}>80G & 501(c)(3) Auto PDF</div>
                    </div>

                    <div style={{ padding: '14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#9333EA', fontWeight: 600 }}>🤖 AI Copilot</div>
                      <div style={{ fontSize: '0.85rem', color: '#0F172A', fontWeight: 700, marginTop: '2px' }}>Gemini Donor Retention</div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {(!showLandingView && !showLoginView) && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--background)' }}>
          {/* GLOBAL HEADER */}
          <header className="slds-global-header">
            {/* Left: App Launcher & Organization Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* 9-Dot App Launcher */}
              <button
                type="button"
                onClick={() => setShowAppLauncherModal(true)}
                title="Ekhum Cloud App Launcher"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 4px)',
                  gap: '3px',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {[...Array(9)].map((_, i) => (
                  <span key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#059669', display: 'block' }} />
                ))}
              </button>

              {/* Logo / Brand */}
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => navigate('/')}>
                <EKhumLogo variant="full" size="sm" theme="light" />
              </div>
            </div>

            {/* Right: Notifications & Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Notification Bell */}
              <button
                type="button"
                onClick={() => setShowNotificationsModal(!showNotificationsModal)}
                style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', position: 'relative' }}
                title="Notifications"
              >
                <svg width="16" height="16" fill="none" stroke="#475569" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669' }} />
              </button>

              {/* User / Org Role Pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '5px 12px', borderRadius: '20px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#059669', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                  {(userSession?.user?.email || 'U')[0].toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
                    {userSession?.user?.role === 'superadmin' ? 'Super Administrator' : (userSession?.user?.orgName || 'NGO Workspace')}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <div className="app-container" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          <aside className="sidebar">
            <nav style={{ flex: 1 }}>
              <ul className="nav-links">
                {userSession?.user?.role === 'superadmin' ? (
                  <>
                    <li>
                      <a href="#overview" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'overview' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('overview'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z"/></svg>
                        Dashboard
                      </a>
                    </li>
                    <li>
                      <a href="#ngos" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'ngos' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('ngos'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                        NGOs & Permissions
                      </a>
                    </li>
                    <li>
                      <a href="#campaigns" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'campaigns' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('campaigns'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        Campaigns
                      </a>
                    </li>
                    <li>
                      <a href="#contacts" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'contacts' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('contacts'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                        Contacts CRM
                      </a>
                    </li>
                    <li>
                      <a href="#ledger" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'transactions' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('transactions'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                        Master Ledger
                      </a>
                    </li>
                    <li>
                      <a href="#journeys" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'journeys' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('journeys'); setSelectedJourney(null); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        Journey Builder
                      </a>
                    </li>
                    <li>
                      <a href="#broadcasts" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'broadcasts' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('broadcasts'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
                        Broadcasts
                      </a>
                    </li>
                    <li>
                      <a href="#compliance" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'compliance' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('compliance'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                        80G & 10BD Tax
                      </a>
                    </li>
                    <li>
                      <a href="#segments" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'segments' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('segments'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                        Segments
                      </a>
                    </li>
                    <li>
                      <a href="#reports" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'reports' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('reports'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                        Custom Reports
                      </a>
                    </li>
                    <li>
                      <a href="#objectManager" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'objectManager' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('objectManager'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>
                        Object Manager
                      </a>
                    </li>
                    <li>
                      <a href="#roles" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'roles' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('roles'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                        Roles & RBAC
                      </a>
                    </li>
                    <li>
                      <a href="#integrations" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'integrations' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('integrations'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                        WhatsApp & Gateways
                      </a>
                    </li>
                    <li>
                      <a href="#breakdown" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'breakdown' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('breakdown'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        Money Breakdown
                      </a>
                    </li>
                    <li>
                      <a href="#templates" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'templates' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('templates'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                        Master Templates
                      </a>
                    </li>
                    <li>
                      <a href="#settings" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'settings' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('settings'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        Settings
                      </a>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <a href="#ngo-overview" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'overview' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('overview'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z"/></svg>
                        Dashboard
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-campaigns" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'campaigns' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('campaigns'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        Campaigns
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-contacts" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'contacts' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('contacts'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                        Contacts CRM
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-transactions" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'transactions' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('transactions'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                        Donations Ledger
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-journeys" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'journeys' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('journeys'); setSelectedJourney(null); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        Journey Builder
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-broadcasts" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'broadcasts' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('broadcasts'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
                        Broadcasts
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-compliance" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'compliance' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('compliance'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                        Compliance Config
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-segments" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'segments' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('segments'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                        Segments
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-reports" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'reports' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('reports'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                        Custom Reports
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-integrations" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'integrations' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('integrations'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                        WhatsApp & Integrations
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-breakdown" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'breakdown' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('breakdown'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        Money Breakdown
                      </a>
                    </li>
                  </>
                )}
              </ul>
            </nav>

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#F8FAFC', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#059669', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.80rem', fontWeight: 700, flexShrink: 0 }}>
                  {(userSession?.user?.email || 'U')[0].toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {userSession?.user?.email || 'Administrator'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 600 }}>
                    {userSession?.user?.role === 'superadmin' ? 'Super Administrator' : 'NGO Administrator'}
                  </div>
                </div>
              </div>

              {userSession ? (
                <button 
                  onClick={handleLogout} 
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    color: '#DC2626',
                    border: '1px solid #FECACA',
                    backgroundColor: '#FEF2F2',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                  <span>Log Out</span>
                </button>
              ) : (
                <button 
                  onClick={(e) => { e.preventDefault(); navigate('/login'); }} 
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem' }}
                >
                  Sign In
                </button>
              )}
            </div>
          </aside>

          <main className="main-content">
            
            {currentPath === '/ngo' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', height: '100%' }}>
                <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
                  <div>
                    <h2>{userSession?.user?.orgName || 'WaterAid India'} Workspace</h2>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                      {activeNgoTab === 'overview' && 'Review contributions metrics, active campaign scopes, and copilot letter helpers.'}
                      {activeNgoTab === 'campaigns' && 'Create, edit, and launch donation campaigns for your organization.'}
                      {activeNgoTab === 'transactions' && 'Track incoming payments, check settlement compliance, and download certificates.'}
                      {activeNgoTab === 'compliance' && 'Configure dynamic tax stamps, signatory officers, and Meta WhatsApp webhooks.'}
                    </p>
                  </div>
                  <a href="/api/compliance/export/10bd" className="btn btn-primary" download>Export Form 10BD CSV</a>
                </div>

                {/* NGO Tab 1: Overview */}
                {activeNgoTab === 'overview' && (
                  <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                    <div className="grid grid-cols-4" style={{ marginBottom: '24px' }}>
                      <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)', padding: '16px' }}>
                        <span className="stat-label">Gross Contributions</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem' }}>
                          ₹{donations.filter(d => d.currency === 'INR' && d.status === 'completed')
                                     .reduce((acc, curr) => acc + Number(curr.amount), 0)
                                     .toLocaleString()}
                        </span>
                      </div>
                      <div className="card stat-card" style={{ borderLeft: '4px solid var(--secondary)', padding: '16px' }}>
                        <span className="stat-label">Total Donors</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem' }}>{new Set(donations.map(d => d.donorEmail)).size} Donors</span>
                      </div>
                      <div className="card stat-card" style={{ borderLeft: '4px solid #3B82F6', padding: '16px' }}>
                        <span className="stat-label">Completed Payments</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem' }}>{donations.filter(d => d.status === 'completed').length} Contributions</span>
                      </div>
                      <div className="card stat-card" style={{ borderLeft: '4px solid #F59E0B', padding: '16px' }}>
                        <span className="stat-label">Average Donation</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem' }}>
                          ₹{donations.filter(d => d.currency === 'INR' && d.status === 'completed').length > 0 
                            ? Math.round(donations.filter(d => d.currency === 'INR' && d.status === 'completed').reduce((acc, curr) => acc + Number(curr.amount), 0) / donations.filter(d => d.currency === 'INR' && d.status === 'completed').length).toLocaleString()
                            : 0}
                        </span>
                      </div>
                    </div>

                    {/* AI Assistant Section */}
                    <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--primary)' }}>
                      <h3 style={{ marginBottom: '12px' }}>✨ AI Thank-You Email Copilot</h3>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>Generate customized emails to donors using your active OpenAI API key.</p>
                      <button onClick={handleDraftEmail} className="btn btn-primary" disabled={isLoadingCopilot}>
                        {isLoadingCopilot ? 'Generating draft...' : 'Draft email helper'}
                      </button>
                      {copilotText && (
                        <div style={{ marginTop: '16px', backgroundColor: 'var(--background)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', fontSize: '0.9rem' }}>{copilotText}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* NGO Tab 2: Campaigns */}
                {activeNgoTab === 'campaigns' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0, paddingBottom: '8px' }}>
                    <div className="slds-page-header" style={{ marginBottom: '16px', flexShrink: 0 }}>
                      <div className="slds-page-header__top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div className="slds-object-icon">
                            🎯
                          </div>
                          <div>
                            <span className="slds-object-eyebrow">Fundraising Objects</span>
                            <h2 className="slds-object-title">
                              Campaigns & Embed Integration
                            </h2>
                          </div>
                        </div>
                      </div>

                      <div className="slds-highlights-ribbon">
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Active Campaigns</span>
                          <span className="slds-highlight-item__value">
                            {campaigns.length} Fundraisers
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Total Raised</span>
                          <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
                            ₹{donations.filter(d => d.status === 'completed' || d.status === 'success').reduce((acc, curr) => acc + Number(curr.amount || 0), 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Live Embed Status</span>
                          <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
                            Ready to Embed
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                      {/* Left List Card (60%) */}
                      <div className="card" style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
                        <h3 style={{ marginBottom: '14px', flexShrink: 0, fontSize: '1rem', color: '#0F172A' }}>Active Campaigns</h3>
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Title</th>
                              <th>URL Slug</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {campaigns.map((camp) => (
                              <tr key={camp.id}>
                                <td><strong>{camp.title}</strong></td>
                                <td><code>/{camp.slug}</code></td>
                                <td>
                                  {camp.approval_status === 'pending' || (!camp.is_active && camp.approval_status !== 'approved') ? (
                                    <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}>
                                      🟡 Pending Verification
                                    </span>
                                  ) : (
                                    <span className={`badge ${camp.is_active ? 'badge-success' : 'badge-failed'}`}>
                                      {camp.is_active ? '🟢 Live & Approved' : 'Inactive'}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                    <button 
                                      onClick={() => setSelectedCampForEmbedModal(camp)}
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#2563EB', borderColor: '#BFDBFE', fontWeight: 600 }}
                                    >
                                      🔌 Embed Code
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setEditingCampId(camp.id);
                                        setEditCampTitle(camp.title);
                                        setEditCampSlug(camp.slug || '');
                                        setEditCampActive(camp.is_active);
                                      }} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                    >
                                      Edit
                                    </button>
                                    {userSession?.user?.role === 'superadmin' && (
                                      <button 
                                        onClick={() => handleDeleteNgoCampaign(camp.id)} 
                                        className="btn btn-secondary" 
                                        style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--error)' }}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {campaigns.length === 0 && (
                              <tr>
                                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '20px' }}>No campaigns found.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Right Editor Card (40%) */}
                    <div className="card" style={{ flex: '1 1 40%', overflowY: 'auto', height: '100%' }}>
                      {editingCampId ? (
                        <div>
                          <h3 style={{ marginBottom: '16px', color: 'var(--primary)' }}>Edit Campaign Details</h3>
                          <form onSubmit={handleUpdateNgoCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">Campaign Title</label>
                              <input type="text" className="form-input" value={editCampTitle} onChange={(e) => setEditCampTitle(e.target.value)} required />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Campaign Slug</label>
                              <input type="text" className="form-input" value={editCampSlug} onChange={(e) => setEditCampSlug(e.target.value)} required />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Campaign Status</label>
                              <select className="form-input" value={editCampActive ? 'true' : 'false'} onChange={(e) => setEditCampActive(e.target.value === 'true')}>
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                              </select>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                              <button type="button" onClick={() => setEditingCampId(null)} className="btn btn-secondary">Cancel</button>
                              <button type="submit" className="btn btn-primary">Save Changes</button>
                            </div>
                          </form>
                        </div>
                      ) : (
                        <div>
                          <h3 style={{ marginBottom: '12px' }}>Submit New Campaign</h3>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            Upon submission, notification emails will be sent to <code>lakshayb057@gmail.com</code> & <code>spikemarketingsolutions@gmail.com</code> for Superadmin verification & final key configuration.
                          </p>
                          <form onSubmit={handleCreateNgoCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">Campaign Title</label>
                              <input type="text" className="form-input" value={newCampTitle} onChange={(e) => setNewCampTitle(e.target.value)} required placeholder="e.g. Clean Water Initiative 2026" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Campaign Slug</label>
                              <input type="text" className="form-input" value={newCampSlug} onChange={(e) => setNewCampSlug(e.target.value)} required placeholder="e.g. clean-water-2026" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Description & Campaign Details</label>
                              <textarea className="form-input" rows={3} style={{ fontFamily: 'inherit' }} value={newCampDescription} onChange={(e) => setNewCampDescription(e.target.value)} placeholder="Provide campaign scope and objectives for Superadmin verification..." />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                              <button type="submit" className="btn btn-primary" style={{ padding: '10px 16px' }}>
                                🚀 Submit for Verification
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                )}

                {/* NGO Tab 3: Donations Ledger */}
                {activeNgoTab === 'transactions' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0, paddingBottom: '8px' }}>
                    <div className="slds-page-header" style={{ marginBottom: '16px', flexShrink: 0 }}>
                      <div className="slds-page-header__top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div className="slds-object-icon">
                            💰
                          </div>
                          <div>
                            <span className="slds-object-eyebrow">Financial Ledger</span>
                            <h2 className="slds-object-title">
                              Donations & Contributions Ledger
                            </h2>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Search by donor name, email or phone..."
                            value={donorSearchQuery}
                            onChange={(e) => setDonorSearchQuery(e.target.value)}
                            style={{ width: '260px', padding: '6px 12px', fontSize: '0.82rem' }}
                          />
                          <a href="/api/compliance/export/10bd" className="btn btn-primary" download>
                            📄 Export 10BD CSV
                          </a>
                        </div>
                      </div>

                      <div className="slds-highlights-ribbon">
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Total Donations</span>
                          <span className="slds-highlight-item__value">
                            {donations.length} Received
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Gross Collected</span>
                          <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
                            ₹{donations.filter(d => d.status === 'completed' || d.status === 'success').reduce((acc, curr) => acc + Number(curr.amount || 0), 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Unique Donors</span>
                          <span className="slds-highlight-item__value">
                            {new Set(donations.map(d => d.donorEmail)).size} Donors
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">80G Status</span>
                          <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
                            Instant Auto-Sync
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Donor Name</th>
                              <th>Email</th>
                              <th>Phone No</th>
                              <th>Campaign</th>
                              <th>Gateway</th>
                              <th>Amount</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Receipt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {donations
                              .filter(d => {
                                const q = donorSearchQuery.toLowerCase();
                                return (
                                  d.donorName.toLowerCase().includes(q) || 
                                  d.donorEmail.toLowerCase().includes(q) ||
                                  (d.donorPhone && d.donorPhone.includes(q))
                                );
                              })
                              .map((d) => (
                                <tr key={d.id}>
                                <td>{new Date(d.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                <td>
                                  <a 
                                    href={`#contact=${d.donorId}`} 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveNgoTab('contacts');
                                      window.location.hash = `#contact=${d.donorId}`;
                                    }}
                                    style={{ color: '#059669', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
                                  >
                                    {d.donorName}
                                  </a>
                                  {d.subscriptionId && (
                                    <span style={{ display: 'block', fontSize: '10px', color: '#86198F', fontWeight: 700 }}>
                                      Recurring (MD-{d.subscriptionId.substring(0, 6)})
                                    </span>
                                  )}
                                </td>
                                <td>{d.donorEmail}</td>
                                <td>{d.donorPhone || 'N/A'}</td>
                                <td>{d.campaignTitle || 'General Support'}</td>
                                  <td>
                                    {(() => {
                                      const gw = (d.paymentGateway || 'razorpay').toLowerCase();
                                      const icon = gw === 'cashfree' ? '⚡' : gw === 'razorpay' ? '💳' : gw === 'payu' ? '🔴' : gw === 'ccavenue' ? '🏛️' : '🏦';
                                      return (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.78rem' }}>
                                          <span>{icon}</span> {d.paymentGateway}
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td>{d.currency} {Number(d.amount).toLocaleString()}</td>
                                  <td>
                                    <span className={`badge ${d.status === 'completed' || d.status === 'success' ? 'badge-success' : d.status === 'pending' || d.status === 'initiated' ? 'badge-warning' : 'badge-failed'}`}>
                                      {d.status === 'completed' || d.status === 'success' ? '🟢 Success' : d.status === 'pending' || d.status === 'initiated' ? '🟡 Initiated' : '🔴 Failed'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                      <button 
                                        onClick={() => setSelectedDonationForModal(d)} 
                                        className="btn btn-secondary" 
                                        style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#2563EB', borderColor: '#BFDBFE' }}
                                      >
                                        🔍 View Payment Data
                                      </button>
                                      {(d.status === 'completed' || d.status === 'success') && (
                                        <a href={`/api/compliance/receipts/${d.id}`} target="_blank" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                          PDF Receipt
                                        </a>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            {donations.length === 0 && (
                              <tr>
                                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '20px' }}>No contributions found.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                         {/* NGO Tab 3B: Money Breakdown */}
                {/* NGO Tab 3B: Money Breakdown */}
                {activeNgoTab === 'breakdown' && (() => {
                  const feeRate = userSession?.user?.permissions?.platform_fee_percent !== undefined 
                    ? Number(userSession.user.permissions.platform_fee_percent) 
                    : 0.0;
                  const hasFee = feeRate > 0;

                  const totalGross = donations.filter(d => d.status === 'completed').reduce((acc, curr) => acc + Number(curr.amount), 0);
                  const totalFee = hasFee ? Math.round(totalGross * (feeRate / 100)) : 0;
                  const totalNet = totalGross - totalFee;

                  return (
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', paddingBottom: '16px' }}>
                      <div className="card" style={{ marginBottom: '24px' }}>
                        <h3 style={{ marginBottom: '8px', color: 'var(--primary)' }}>💰 NGO Payout & Money Breakdown</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
                          {hasFee 
                            ? `Track gross donations raised across all campaigns, platform service commissions (${feeRate}%), and net money payouts.`
                            : `Track gross donations raised across all campaigns. Zero platform service fee (100% direct net money payout).`}
                        </p>

                        <div className={`grid ${hasFee ? 'grid-cols-3' : 'grid-cols-2'}`} style={{ marginBottom: '24px' }}>
                          <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)', padding: '16px' }}>
                            <span className="stat-label">Gross Raised Volume</span>
                            <span className="stat-value" style={{ fontSize: '1.4rem' }}>
                              ₹{totalGross.toLocaleString()}
                            </span>
                          </div>

                          {hasFee && (
                            <div className="card stat-card" style={{ borderLeft: '4px solid #F59E0B', padding: '16px' }}>
                              <span className="stat-label">Platform Service Fee ({feeRate}%)</span>
                              <span className="stat-value" style={{ fontSize: '1.4rem', color: '#F59E0B' }}>
                                - ₹{totalFee.toLocaleString()}
                              </span>
                            </div>
                          )}

                          <div className="card stat-card" style={{ borderLeft: '4px solid #10B981', padding: '16px' }}>
                            <span className="stat-label">Net Bank Payout {hasFee ? '' : '(100% Payout)'}</span>
                            <span className="stat-value" style={{ fontSize: '1.4rem', color: '#10B981' }}>
                              ₹{totalNet.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Campaign</th>
                              <th>Donors</th>
                              <th>Gross Raised</th>
                              {hasFee && <th>Platform Fee ({feeRate}%)</th>}
                              <th>Net Campaign Payout</th>
                            </tr>
                          </thead>
                          <tbody>
                            {campaigns.map((c) => {
                              const cDonations = donations.filter(d => d.campaignTitle === c.title && d.status === 'completed');
                              const gross = cDonations.reduce((acc, curr) => acc + Number(curr.amount), 0);
                              const pFee = hasFee ? Math.round(gross * (feeRate / 100)) : 0;
                              const net = gross - pFee;
                              return (
                                <tr key={c.id}>
                                  <td><strong>{c.title}</strong></td>
                                  <td>{cDonations.length} donors</td>
                                  <td>₹{gross.toLocaleString()}</td>
                                  {hasFee && <td style={{ color: '#F59E0B' }}>- ₹{pFee.toLocaleString()}</td>}
                                  <td><strong style={{ color: '#059669' }}>₹{net.toLocaleString()}</strong></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* NGO Tab 4: Compliance Configuration */}
                {activeNgoTab === 'compliance' && (
                  <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '16px' }}>
                    <div className="card" style={{ maxWidth: '800px', padding: '32px', margin: '0 auto' }}>
                      
                      {/* Security Read-Only Banner */}
                      <div style={{ padding: '14px 18px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>🔒</span>
                        <div>
                          <strong style={{ color: '#166534', fontSize: '0.94rem' }}>Superadmin Configured Credentials (Read-Only Mode for NGO Workers)</strong>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#15803D' }}>
                            Organization identity, 80G Statutory URN, WhatsApp Meta API tokens, Razorpay Gateway Keys, and Master Communication Templates are configured strictly by Superadmin at <code>/admin</code>. NGO personnel are granted Read-Only access to review these credentials.
                          </p>
                        </div>
                      </div>

                      <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--primary)' }}>
                        🏢 NGO Compliance Settings & Credentials
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.88rem' }}>
                        Review organization identity, 80G tax stamp credentials, and Meta WABA tokens.
                      </p>

                      <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="form-group">
                          <label className="form-label">NGO Organization Name</label>
                          <input type="text" className="form-input" value={editNgoName} readOnly disabled style={{ backgroundColor: '#F8FAFC', cursor: 'not-allowed' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '16px' }}>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Country Jurisdiction</label>
                            <select className="form-input" value={editNgoCountry} disabled style={{ backgroundColor: '#F8FAFC', cursor: 'not-allowed' }}>
                              <option value="IN">India (IN)</option>
                              <option value="US">United States (US)</option>
                              <option value="GB">United Kingdom (GB)</option>
                            </select>
                          </div>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Primary Currency</label>
                            <select className="form-input" value={editNgoCurrency} disabled style={{ backgroundColor: '#F8FAFC', cursor: 'not-allowed' }}>
                              <option value="INR">INR (₹)</option>
                              <option value="USD">USD ($)</option>
                              <option value="GBP">GBP (£)</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                          <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '14px' }}>💬 WhatsApp Meta API Settings</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">WABA ID (WhatsApp Business Account ID)</label>
                              <input type="text" className="form-input" value={editWabaId} readOnly disabled style={{ backgroundColor: '#F8FAFC', cursor: 'not-allowed' }} placeholder="WABA Account Identifier" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Phone Number ID</label>
                              <input type="text" className="form-input" value={editPhoneId} readOnly disabled style={{ backgroundColor: '#F8FAFC', cursor: 'not-allowed' }} placeholder="Meta WABA phone node ID" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">API Access Token</label>
                              <input type="password" autoComplete="current-password" className="form-input" value={editWabaToken ? '••••••••••••••••••••' : ''} readOnly disabled style={{ backgroundColor: '#F8FAFC', cursor: 'not-allowed' }} placeholder="EAAB... (Configured by Superadmin)" />
                            </div>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                          <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '14px' }}>🛡️ 80G Statutory Certificate Details</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">Registration URN (Unique Registration Number)</label>
                              <input type="text" className="form-input" value={edit80gUrn} readOnly disabled style={{ backgroundColor: '#F8FAFC', cursor: 'not-allowed' }} placeholder="e.g. AAATD0192K20261" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">URN Approval Date</label>
                              <input type="date" className="form-input" value={edit80gDate} readOnly disabled style={{ backgroundColor: '#F8FAFC', cursor: 'not-allowed' }} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Digital Signatory Officer name</label>
                              <input type="text" className="form-input" value={edit80gSignatory} readOnly disabled style={{ backgroundColor: '#F8FAFC', cursor: 'not-allowed' }} placeholder="e.g. Country Director India" />
                            </div>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                          <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '14px' }}>💳 Assigned Payment Gateway Rails</h4>
                          {(() => {
                            const currentNgo = organizations.find(o => o.id === (userSession?.user?.orgId || userSession?.user?.organization_id)) || organizations[0];
                            const rails = extractNgoRails(currentNgo);
                            if (rails.length === 0) {
                              return <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>No payment gateway rails assigned. Contact Superadmin to configure rails.</p>;
                            }
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {rails.map(rail => (
                                  <div key={rail.id} style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>{rail.name}</strong>
                                      <span style={{ display: 'block', fontSize: '0.76rem', color: '#64748B' }}>Identifier / Key: <code>{rail.keyPreview}</code></span>
                                    </div>
                                    <span style={{ fontSize: '0.78rem', background: '#ECFDF5', color: '#059669', padding: '3px 10px', borderRadius: '20px', fontWeight: 700, border: '1px solid #A7F3D0' }}>
                                      Active Rail
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                        {/* NGO Communication Templates Viewer */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px' }}>
                          <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            📑 Configured 80G Receipt, WhatsApp & Email Templates
                          </h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            View active 80G tax receipt HTML code, WhatsApp alerts, and Email notifications configured for your organization. Supported Whitelist Variables: <code>&#123;&#123;donor_name&#125;&#125;</code>, <code>&#123;&#123;donation_amount&#125;&#125;</code>, <code>&#123;&#123;ngo_name&#125;&#125;</code>, <code>&#123;&#123;ngo_urn&#125;&#125;</code>, <code>&#123;&#123;transaction_id&#125;&#125;</code>, <code>&#123;&#123;receipt_url&#125;&#125;</code>.
                          </p>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">Select Template to Inspect</label>
                              <select 
                                className="form-input" 
                                value={tmplType} 
                                onChange={(e) => {
                                  const selectedType = e.target.value as any;
                                  setTmplType(selectedType);
                                  const existing = templatesList.find(t => t.type === selectedType && (t.organization_id === userSession?.user?.orgId || t.is_default));
                                  if (existing) {
                                    setEditingTemplateId(existing.id);
                                    setTmplName(existing.name);
                                    setTmplSubject(existing.subject || '');
                                    setTmplContent(existing.content);
                                  } else {
                                    setEditingTemplateId(null);
                                    setTmplName(`${userSession?.user?.orgName || 'NGO'} Standard ${selectedType}`);
                                    setTmplContent('');
                                  }
                                }}
                              >
                                <option value="80g_receipt">📜 80G Tax Exemption Certificate Code (PDF / HTML)</option>
                                <option value="whatsapp_message">📲 WhatsApp Notification Message Text</option>
                                <option value="email_thankyou">📧 Email Thank-You Notification Code (HTML)</option>
                              </select>
                            </div>

                            <div className="form-group">
                              <label className="form-label">Active Template Name</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                value={tmplName} 
                                readOnly 
                                disabled 
                                style={{ backgroundColor: '#F8FAFC', cursor: 'not-allowed' }} 
                              />
                            </div>

                            {tmplType === 'email_thankyou' && (
                              <div className="form-group">
                                <label className="form-label">Email Subject Line</label>
                                <input 
                                  type="text" 
                                  className="form-input" 
                                  value={tmplSubject} 
                                  readOnly 
                                  disabled 
                                  style={{ backgroundColor: '#F8FAFC', cursor: 'not-allowed' }} 
                                />
                              </div>
                            )}

                            <div className="form-group">
                              <label className="form-label">Active Template Content (Read-Only)</label>
                              <textarea 
                                rows={8} 
                                className="form-input" 
                                style={{ fontFamily: 'monospace', fontSize: '0.84rem', backgroundColor: '#F8FAFC', cursor: 'not-allowed' }} 
                                value={tmplContent} 
                                readOnly 
                                disabled 
                              />
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button 
                                type="button" 
                                onClick={handlePreviewTemplate} 
                                className="btn btn-secondary"
                              >
                                👁️ Test Live Preview Output
                              </button>
                            </div>

                            {tmplPreviewResult && (
                              <div style={{ padding: '14px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.84rem' }}>
                                <h5 style={{ margin: '0 0 8px 0', color: '#059669', fontSize: '0.9rem' }}>Parsed Live Preview:</h5>
                                <div dangerouslySetInnerHTML={{ __html: tmplPreviewResult }} />
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '8px' }}>
                          <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            🔒 Security Restricted: Credentials & Templates managed by Superadmin.
                          </span>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* NGO Tab: Contacts CRM */}
                {activeNgoTab === 'contacts' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <ContactList />
                  </div>
                )}

                {/* NGO Tab: Communications */}
                {activeNgoTab === 'communications' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <CommunicationLog />
                  </div>
                )}

                {/* NGO Tab: Journey Builder */}
                {activeNgoTab === 'journeys' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    {selectedJourney ? (
                      <JourneyCanvas journey={selectedJourney} onBack={() => setSelectedJourney(null)} />
                    ) : (
                      <>
                        <JourneyList onSelectJourney={(j: any) => setSelectedJourney(j)} />
                        <div style={{ marginTop: '32px' }}>
                          <EventTriggerSetup />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* NGO Tab: Broadcasts */}
                {activeNgoTab === 'broadcasts' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <BroadcastManager />
                  </div>
                )}

                {/* NGO Tab: Segments */}
                {activeNgoTab === 'segments' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <SegmentBuilder />
                  </div>
                )}

                {/* NGO Tab: Custom Reports */}
                {activeNgoTab === 'reports' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <ReportBuilder />
                  </div>
                )}

                {/* NGO Tab: API & Integrations */}
                {activeNgoTab === 'integrations' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <ApiIntegrations />
                  </div>
                )}
              </div>
            )}

            {currentPath === '/superadmin' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px', minHeight: 0 }}>
                
                {/* 1. OVERVIEW SUBTAB (DASHBOARD) */}
                {activeSuperadminTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <div className="slds-page-header" style={{ marginBottom: '16px', flexShrink: 0 }}>
                      <div className="slds-page-header__top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div className="slds-object-icon">
                            📊
                          </div>
                          <div>
                            <span className="slds-object-eyebrow">Executive Analytics</span>
                            <h2 className="slds-object-title">
                              Platform Performance & Overview
                            </h2>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={fetchData}
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            🔄 Refresh Data
                          </button>
                        </div>
                      </div>

                      <div className="slds-highlights-ribbon">
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Total System NGOs</span>
                          <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
                            {globalMetrics.totalOrganizations} Registered
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Gross Volume (GMV)</span>
                          <span className="slds-highlight-item__value">
                            ₹{globalMetrics.grossVolumeGMV.toLocaleString()}
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Active Donors</span>
                          <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
                            {globalMetrics.activeDonors} Donors
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Platform Fee Rate</span>
                          <span className="slds-highlight-item__value">
                            0.00% (Free Platform)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Real-time SVG Charts Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
                      {/* Left: 14-Day GMV Volume Timeline (Line Graph) */}
                      <div className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>📈 14-Day GMV Donation Volume Trend</h3>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Real-time PostgreSQL date-truncated time-series line graph</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', background: '#EFF6FF', color: '#1D4ED8', fontWeight: 600 }}>
                            ⚡ Live Feed
                          </span>
                        </div>
                        <AnalyticsLineGraph timeline={analyticsData?.timeline || []} />
                      </div>

                      {/* Right: Payment Gateway Distribution (Donut / Pie Chart) */}
                      <div className="card" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>💳 Settlement Gateway Breakdown</h3>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Real-time volume split by payment rails</span>
                        </div>
                        <AnalyticsPieChart
                          items={(analyticsData?.gateways || []).map((g: any, idx: number) => {
                            const palette = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];
                            return {
                              label: g.payment_gateway || 'Razorpay Gateway',
                              value: Number(g.total_amount) || 0,
                              color: palette[idx % palette.length]
                            };
                          })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                      {/* NGO Volume Share (Bar Chart) */}
                      <div className="card" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>🏛️ NGO Volume Contribution Shares</h3>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Relative proportion of total funds raised per NGO</span>
                        </div>
                        <AnalyticsBarChart data={analyticsData?.ngoDistribution || []} />
                      </div>

                      {/* Payment Method Share (Donut / Pie Chart) */}
                      <div className="card" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>📱 Donor Payment Instruments</h3>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>UPI, Cards, Netbanking & Wallets split</span>
                        </div>
                        <AnalyticsPieChart
                          items={(analyticsData?.methods || []).map((m: any, idx: number) => {
                            const palette = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'];
                            return {
                              label: (m.method || 'upi').toUpperCase(),
                              value: Number(m.total_amount) || 0,
                              color: palette[idx % palette.length]
                            };
                          })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. NGOs DIRECTORY & PERMISSIONS SUBTAB */}
                {activeSuperadminTab === 'ngos' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
                      <div>
                        <h2>NGOs Directory & Platform Permissions</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Grant or restrict specific actions, fee rates, and Razorpay gateway keys for all NGOs.</p>
                      </div>
                      <button onClick={() => setShowAddNgoModal(true)} className="btn btn-primary">Register New NGO</button>
                    </div>

                    <div className="card">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>NGO Details</th>
                            <th>Active Payment Rails & Gateways</th>
                            <th>Platform Permissions</th>
                            <th>Fee %</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {organizations.map((org) => {
                            const perms = org.permissions || {};
                            const isSuspended = org.status === 'suspended';
                            const ngoRails = extractNgoRails(org);
                            return (
                              <tr key={org.id}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{org.name}</div>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{org.tax_id_country} &bull; {org.primary_currency}</span>
                                  <br/><code style={{ fontSize: '0.75rem' }}>/{org.slug}</code>
                                  {org.members && org.members.length > 0 && (
                                    <div style={{ fontSize: '0.76rem', color: '#059669', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      👤 Worker Login: <strong>{org.members[0].email}</strong>
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                    <span className={`badge ${isSuspended ? 'badge-failed' : 'badge-success'}`}>
                                      {org.status || 'Active'}
                                    </span>
                                    <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                      {ngoRails.length} Rails Configured
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {ngoRails.map((r) => {
                                      let bg = '#ECFDF5', clr = '#059669', brd = '#A7F3D0', icon = '💳';
                                      if (r.type === 'payu') { bg = '#FEF2F2'; clr = '#DC2626'; brd = '#FECACA'; icon = '🔴'; }
                                      if (r.type === 'ccavenue') { bg = '#EFF6FF'; clr = '#1D4ED8'; brd = '#BFDBFE'; icon = '🏛️'; }
                                      if (r.type === 'worldline') { bg = '#FFFBEB'; clr = '#B45309'; brd = '#FDE68A'; icon = '🏦'; }
                                      if (r.type === 'cashfree') { bg = '#FAF5FF'; clr = '#7E22CE'; brd = '#E9D5FF'; icon = '⚡'; }
                                      return (
                                        <span 
                                          key={r.id} 
                                          style={{ 
                                            background: bg, 
                                            color: clr, 
                                            border: `1px solid ${brd}`, 
                                            borderRadius: '6px', 
                                            padding: '2px 8px', 
                                            fontSize: '11px', 
                                            fontWeight: 600,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                          }}
                                          title={`Key / ID: ${r.keyPreview}`}
                                        >
                                          {icon} {r.name.replace(/ Gateway Rail| Direct Rail| Rail| 50\+ Banks Rail| UPI Intent Rail/gi, '')}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    <span className={`badge ${perms.can_accept_donations !== false ? 'badge-success' : 'badge-failed'}`}>
                                      {perms.can_accept_donations !== false ? '✓ Accept Payments' : '✕ Blocked'}
                                    </span>
                                    <span className={`badge ${perms.can_issue_80g_receipts !== false ? 'badge-success' : 'badge-failed'}`}>
                                      {perms.can_issue_80g_receipts !== false ? '✓ 80G Receipts' : '✕ No Receipts'}
                                    </span>
                                    <span className={`badge ${perms.can_export_data !== false ? 'badge-success' : 'badge-failed'}`}>
                                      {perms.can_export_data !== false ? '✓ Export CSV' : '✕ No Export'}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <strong style={{ color: 'var(--primary)' }}>{perms.platform_fee_percent !== undefined ? perms.platform_fee_percent : 0.0}%</strong>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                    <button 
                                      onClick={() => handleProvisionNgoKey(org.id)}
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#059669', borderColor: '#A7F3D0' }}
                                      title="Auto-generate Managed Razorpay Gateway Key under DanaPro Master Account"
                                    >
                                      ⚡ Auto-Provision
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setEditingNgoId(org.id);
                                        setEditNgoName(org.name);
                                        setEditNgoSlug(org.slug);
                                        setEditNgoCountry(org.tax_id_country || 'IN');
                                        setEditNgoCurrency(org.primary_currency || 'INR');
                                        setEditNgoStatus(org.status || 'active');
                                        setEditNgoVerifiedSender(org.verified_sender_email || '');
                                        const waba = org.whatsapp_meta_config || {};
                                        const cert = org.certificate_80g_config || {};
                                        const gwCfg = org.payment_gateways_config || {};
                                        const gatewaysList = Array.isArray(gwCfg.gateways) ? gwCfg.gateways : [];
                                        const hasExplicitList = Array.isArray(gwCfg.gateways);

                                        const hasRzp = hasExplicitList
                                          ? gatewaysList.some((g: any) => g.type === 'razorpay' && g.is_active !== false)
                                          : (gwCfg.razorpay_enabled === true || !!gwCfg.razorpay_key_id);

                                        const hasPayu = hasExplicitList
                                          ? gatewaysList.some((g: any) => g.type === 'payu' && g.is_active !== false)
                                          : (gwCfg.payu_enabled === true || !!gwCfg.payu_merchant_key);

                                        const hasCcav = hasExplicitList
                                          ? gatewaysList.some((g: any) => g.type === 'ccavenue' && g.is_active !== false)
                                          : (gwCfg.ccavenue_enabled === true || !!gwCfg.ccavenue_merchant_id);

                                        const hasWl = hasExplicitList
                                          ? gatewaysList.some((g: any) => g.type === 'worldline' && g.is_active !== false)
                                          : (gwCfg.worldline_enabled === true || !!gwCfg.worldline_merchant_id);

                                        const hasCf = hasExplicitList
                                          ? gatewaysList.some((g: any) => g.type === 'cashfree' && g.is_active !== false)
                                          : (gwCfg.cashfree_enabled === true || !!gwCfg.cashfree_app_id);

                                        const rzpCreds = gatewaysList.find((g: any) => g.type === 'razorpay')?.credentials || {};
                                        const payuCreds = gatewaysList.find((g: any) => g.type === 'payu')?.credentials || {};
                                        const ccavCreds = gatewaysList.find((g: any) => g.type === 'ccavenue')?.credentials || {};
                                        const wlCreds = gatewaysList.find((g: any) => g.type === 'worldline')?.credentials || {};
                                        const cfCreds = gatewaysList.find((g: any) => g.type === 'cashfree')?.credentials || {};

                                        setEditWabaId(waba.waba_id || '');
                                        setEditPhoneId(waba.phone_id || '');
                                        setEditWabaToken(waba.token || '');
                                        setEdit80gUrn(cert.urn || '');
                                        setEdit80gDate(cert.issue_date || '');
                                        setEdit80gSignatory(cert.signatory || '');

                                        // Razorpay
                                        setEditNgoRzpEnabled(hasRzp);
                                        setEditNgoRazorpayKeyId(rzpCreds.key_id || gwCfg.razorpay_key_id || '');
                                        setEditNgoRazorpayKeySecret(rzpCreds.key_secret || gwCfg.razorpay_key_secret || '');
                                        setEditNgoRazorpayWebhook(rzpCreds.webhook_secret || gwCfg.razorpay_webhook_secret || '');
                                        
                                        // PayU
                                        setEditNgoPayuEnabled(hasPayu);
                                        setEditNgoPayuKey(payuCreds.merchant_key || gwCfg.payu_merchant_key || '');
                                        setEditNgoPayuSalt(payuCreds.merchant_salt || gwCfg.payu_merchant_salt || '');
                                        setEditNgoPayuSecret(payuCreds.webhook_secret || gwCfg.payu_webhook_secret || '');
                                        setEditNgoPayuMode(payuCreds.mode || gwCfg.payu_mode || 'test');
                                        
                                        // CCAvenue
                                        setEditNgoCcavEnabled(hasCcav);
                                        setEditNgoCcavMid(ccavCreds.merchant_id || gwCfg.ccavenue_merchant_id || '');
                                        setEditNgoCcavCode(ccavCreds.access_code || gwCfg.ccavenue_access_code || '');
                                        setEditNgoCcavKey(ccavCreds.working_key || gwCfg.ccavenue_working_key || '');

                                        // Worldline
                                        setEditNgoWlEnabled(hasWl);
                                        setEditNgoWlMid(wlCreds.merchant_id || gwCfg.worldline_merchant_id || '');
                                        setEditNgoWlTid(wlCreds.terminal_id || gwCfg.worldline_terminal_id || '');
                                        setEditNgoWlSecret(wlCreds.secret_key || gwCfg.worldline_secret_key || '');

                                        // Cashfree
                                        setEditNgoCfEnabled(hasCf);
                                        setEditNgoCfAppId(cfCreds.app_id || gwCfg.cashfree_app_id || '');
                                        setEditNgoCfSecret(cfCreds.secret_key || gwCfg.cashfree_secret_key || '');

                                        setEditNgoPrimaryGw(gwCfg.primary_gateway || (hasRzp ? 'razorpay' : hasCf ? 'cashfree' : hasPayu ? 'payu' : hasCcav ? 'ccavenue' : hasWl ? 'worldline' : 'razorpay'));
                                        setEditNgoFallbackGw(gwCfg.fallback_gateway || (hasCf && gwCfg.primary_gateway !== 'cashfree' ? 'cashfree' : hasPayu && gwCfg.primary_gateway !== 'payu' ? 'payu' : ''));
                                        setEditNgoAutoFailover(gwCfg.enable_auto_failover !== false);

                                        setEditNgoCanAccept(perms.can_accept_donations !== false);
                                        setEditNgoCan80g(perms.can_issue_80g_receipts !== false);
                                        setEditNgoCanExport(perms.can_export_data !== false);
                                        setEditNgoCanAi(perms.can_run_ai_analytics !== false);
                                        setEditNgoFeePercent(perms.platform_fee_percent !== undefined ? perms.platform_fee_percent : 0.0);
                                      }} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600 }}
                                    >
                                      ⚙️ Gateways & Keys
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteNGO(org.id)} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--error)' }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. CAMPAIGNS & SPECIFIC GATEWAY KEYS SUBTAB */}
                {activeSuperadminTab === 'campaigns' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <div className="slds-page-header" style={{ marginBottom: '16px', flexShrink: 0 }}>
                      <div className="slds-page-header__top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div className="slds-object-icon">
                            🎯
                          </div>
                          <div>
                            <span className="slds-object-eyebrow">Fundraising Objects</span>
                            <h2 className="slds-object-title">
                              Campaigns Oversight & Multi-Gateway Alignment
                            </h2>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setShowAddCampaignModal(true)} className="btn btn-primary">
                            + Create New Campaign
                          </button>
                        </div>
                      </div>

                      <div className="slds-highlights-ribbon">
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Total Campaigns</span>
                          <span className="slds-highlight-item__value">
                            {campaigns.length} Fundraisers
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Live & Approved</span>
                          <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
                            {campaigns.filter(c => c.is_active && c.approval_status !== 'pending').length} Active
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Pending Approval</span>
                          <span className="slds-highlight-item__value" style={{ color: '#D97706' }}>
                            {campaigns.filter(c => c.approval_status === 'pending' || !c.is_active).length} Review
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Embed APIs Status</span>
                          <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
                            Universal & Specialized Live
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Campaign Title</th>
                            <th>EKhum API Key & Embed</th>
                            <th>External Landing Page URL</th>
                            <th>NGO Owner</th>
                            <th>Target Goal</th>
                            <th>Aligned Gateway Rails</th>
                            <th>Status & Approval</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.map((camp) => {
                            const pConfig = camp.payment_config || {};
                            const apiKey = camp.api_key || `ek_live_${camp.slug}_key`;
                            const parentNgo = organizations.find(o => o.id === camp.organization_id);
                            const ngoRails = extractNgoRails(parentNgo);
                            const assignedIds: string[] = Array.isArray(pConfig.assigned_gateway_ids) ? pConfig.assigned_gateway_ids : [];
                            const isPending = (camp as any).approval_status === 'pending' || !camp.is_active;

                            return (
                              <tr key={camp.id} style={{ background: isPending ? '#FFFBEB' : 'transparent' }}>
                                <td>
                                  <strong>{camp.title}</strong>
                                  <br/><code style={{ fontSize: '0.75rem' }}>/{camp.slug}</code>
                                </td>
                                <td>
                                  <code 
                                    onClick={() => {
                                      navigator.clipboard.writeText(apiKey);
                                      alert(`Copied EKhum API Key: ${apiKey}`);
                                    }}
                                    title="Click to copy EKhum API Key"
                                    style={{ fontSize: '0.75rem', color: '#059669', background: '#ECFDF5', padding: '3px 8px', borderRadius: '4px', border: '1px solid #A7F3D0', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    📋 {apiKey.slice(0, 18)}...
                                  </code>
                                </td>
                                <td>
                                  {camp.landing_page_url ? (
                                    <a href={camp.landing_page_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: '#059669', textDecoration: 'underline' }}>
                                      🌐 {camp.landing_page_url.replace(/^https?:\/\//, '')}
                                    </a>
                                  ) : (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Not Configured</span>
                                  )}
                                </td>
                                <td>{camp.orgName || parentNgo?.name || 'WaterAid India'}</td>
                                <td>₹{Number(camp.goal_amount || 0).toLocaleString()}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {assignedIds.length > 0 ? (
                                      assignedIds.map((aid) => {
                                        const rail = ngoRails.find(r => r.id === aid || r.type === aid);
                                        const type = rail?.type || aid;
                                        let bg = '#ECFDF5', clr = '#059669', icon = '💳';
                                        if (type === 'payu') { bg = '#FEF2F2'; clr = '#DC2626'; icon = '🔴'; }
                                        if (type === 'ccavenue') { bg = '#EFF6FF'; clr = '#1D4ED8'; icon = '🏛️'; }
                                        if (type === 'worldline') { bg = '#FFFBEB'; clr = '#B45309'; icon = '🏦'; }
                                        if (type === 'cashfree') { bg = '#FAF5FF'; clr = '#7E22CE'; icon = '⚡'; }
                                        return (
                                          <span 
                                            key={aid} 
                                            style={{ background: bg, color: clr, padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}
                                          >
                                            {icon} {type.toUpperCase()}
                                          </span>
                                        );
                                      })
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: '#059669', background: '#ECFDF5', padding: '2px 6px', borderRadius: '4px' }}>
                                        💳 All NGO Rails Active
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  {isPending ? (
                                    <div>
                                      <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', display: 'inline-block', marginBottom: '4px' }}>
                                        🟡 Pending Verification
                                      </span>
                                      <br/>
                                      <button 
                                        onClick={() => {
                                          setApprovingCampaign(camp);
                                          setApprovalAssignedGateways(assignedIds.length > 0 ? assignedIds : ngoRails.map(r => r.id || r.type));
                                          setApprovalPrimaryGateway(pConfig.primary_gateway || (ngoRails[0]?.type || 'razorpay'));
                                          setApprovalFallbackGateway(pConfig.fallback_gateway || (ngoRails[1]?.type || 'payu'));
                                          setApprovalAutoFailover(pConfig.enable_auto_failover !== false);
                                        }}
                                        className="btn btn-primary"
                                        style={{ padding: '3px 8px', fontSize: '0.72rem', background: '#059669' }}
                                      >
                                        ⚡ Review & Align Gateways
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="badge badge-success">
                                      🟢 Approved & Active
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                    <button 
                                      onClick={() => setSelectedCampForEmbedModal(camp)}
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#1D4ED8', background: '#EFF6FF', borderColor: '#93C5FD', fontWeight: 700 }}
                                    >
                                      🔌 Embed & REST APIs
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setEditingCampId(camp.id);
                                        setEditCampTitle(camp.title);
                                        setEditCampSlug(camp.slug || '');
                                        setEditCampLandingPageUrl(camp.landing_page_url || '');
                                        setEditCampActive(camp.is_active);
                                        setEditCampGoalAmount(camp.goal_amount || 100000);
                                        setEditCampRazorpayKeyId(pConfig.razorpay_key_id || '');
                                        setEditCampRazorpayKeySecret(pConfig.razorpay_key_secret || '');
                                        setEditCampAssignedGateways(assignedIds.length > 0 ? assignedIds : ngoRails.map(r => r.id || r.type));
                                        setEditCampPrimaryGateway(pConfig.primary_gateway || (ngoRails[0]?.type || 'razorpay'));
                                        setEditCampFallbackGateway(pConfig.fallback_gateway || (ngoRails[1]?.type || 'payu'));
                                        setEditCampAutoFailover(pConfig.enable_auto_failover !== false);
                                        const cPerms = camp.permissions || {};
                                        setEditCampAllowAnon(cPerms.allow_anonymous !== false);
                                        setEditCampTaxEnabled(cPerms.tax_receipt_enabled !== false);
                                      }} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600 }}
                                    >
                                      ⚙️ Align Rails & Keys
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteCampaign(camp.id)} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--error)' }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3B. MONEY BREAKDOWN SUBTAB */}
                {activeSuperadminTab === 'breakdown' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
                      <div>
                        <h2>Financial & Payout Breakdown Monitor</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Real-time breakdown of gross donations raised, platform commission fees, donor fee coverage, and net NGO payouts.</p>
                      </div>
                      <button onClick={fetchData} className="btn btn-secondary" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span>🔄</span> Refresh Financials
                      </button>
                    </div>

                    {breakdownData && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                          <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)', padding: '16px' }}>
                            <span className="stat-label">Gross Donations (GMV)</span>
                            <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>
                              ₹{Number(breakdownData.summary?.gross_gmv || 0).toLocaleString()}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Total volume raised</span>
                          </div>
                          <div className="card stat-card" style={{ borderLeft: '4px solid #10B981', padding: '16px' }}>
                            <span className="stat-label">Donor Fee Covered</span>
                            <span className="stat-value" style={{ fontSize: '1.5rem', color: '#10B981' }}>
                              ₹{Number(breakdownData.summary?.total_donor_fee_covered || 0).toLocaleString()}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Extra donor tips</span>
                          </div>
                          <div className="card stat-card" style={{ borderLeft: '4px solid #F59E0B', padding: '16px' }}>
                            <span className="stat-label">Platform Service Revenue</span>
                            <span className="stat-value" style={{ fontSize: '1.5rem', color: '#F59E0B' }}>
                              ₹{Number(breakdownData.summary?.total_platform_fee || 0).toLocaleString()}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>DanaPro platform fee</span>
                          </div>
                          <div className="card stat-card" style={{ borderLeft: '4px solid #3B82F6', padding: '16px' }}>
                            <span className="stat-label">Net NGO Payout</span>
                            <span className="stat-value" style={{ fontSize: '1.5rem', color: '#3B82F6' }}>
                              ₹{Number(breakdownData.summary?.total_ngo_net_payout || 0).toLocaleString()}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Net money received by NGOs</span>
                          </div>
                        </div>

                        {/* Breakdown per NGO Table */}
                        <div className="card" style={{ marginBottom: '24px' }}>
                          <h3 style={{ marginBottom: '16px', color: 'var(--primary)' }}>🏛️ Per-NGO Financial Payout Breakdown</h3>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>NGO Name</th>
                                <th>Active Campaigns</th>
                                <th>Donations</th>
                                <th>Gross Volume</th>
                                <th>Platform Fee</th>
                                <th>Net Payout to NGO</th>
                                <th>Razorpay Key</th>
                              </tr>
                            </thead>
                            <tbody>
                              {breakdownData.ngoBreakdown?.map((item) => (
                                <tr key={item.organization_id}>
                                  <td><strong>{item.organization_name}</strong></td>
                                  <td>{item.campaign_count} campaigns</td>
                                  <td>{item.donation_count} donations</td>
                                  <td>₹{Number(item.gross_amount).toLocaleString()}</td>
                                  <td style={{ color: '#F59E0B' }}>
                                    - ₹{Number(item.platform_fee).toLocaleString()} {Number(item.fee_rate_percent || 0) > 0 ? `(${item.fee_rate_percent}%)` : '(0%)'}
                                  </td>
                                  <td><strong style={{ color: '#059669', fontSize: '0.98rem' }}>₹{Number(item.net_ngo_payout).toLocaleString()}</strong></td>
                                  <td>
                                    {item.org_razorpay_key ? (
                                      <code style={{ fontSize: '0.75rem' }}>{item.org_razorpay_key}</code>
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>System Default</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {(!breakdownData.ngoBreakdown || breakdownData.ngoBreakdown.length === 0) && (
                                <tr>
                                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '16px' }}>No financial records available yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Breakdown per Campaign Table */}
                        <div className="card">
                          <h3 style={{ marginBottom: '16px', color: 'var(--primary)' }}>🎯 Per-Campaign Financial Monitor</h3>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Campaign Title</th>
                                <th>NGO Owner</th>
                                <th>Donations Count</th>
                                <th>Gross Raised</th>
                                <th>Platform Fee</th>
                                <th>Net Payout</th>
                                <th>Active Razorpay Key</th>
                              </tr>
                            </thead>
                            <tbody>
                              {breakdownData.campaignBreakdown?.map((item) => (
                                <tr key={item.campaign_id}>
                                  <td><strong>{item.campaign_title}</strong></td>
                                  <td>{item.organization_name}</td>
                                  <td>{item.donation_count} donors</td>
                                  <td>₹{Number(item.gross_amount).toLocaleString()}</td>
                                  <td style={{ color: '#F59E0B' }}>
                                    - ₹{Number(item.platform_fee).toLocaleString()} {Number(item.fee_rate_percent || 0) > 0 ? `(${item.fee_rate_percent}%)` : '(0%)'}
                                  </td>
                                  <td><strong style={{ color: '#059669' }}>₹{Number(item.net_ngo_payout).toLocaleString()}</strong></td>
                                  <td>
                                    {item.campaign_razorpay_key ? (
                                      <code style={{ fontSize: '0.75rem', color: '#059669', background: '#ECFDF5', padding: '2px 6px', borderRadius: '4px' }}>
                                        🔑 {item.campaign_razorpay_key}
                                      </code>
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>NGO Default Key</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {(!breakdownData.campaignBreakdown || breakdownData.campaignBreakdown.length === 0) && (
                                <tr>
                                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '16px' }}>No active campaign transactions yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. MASTER TRANSACTIONS LEDGER */}
                {activeSuperadminTab === 'transactions' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <div className="slds-page-header" style={{ marginBottom: '16px', flexShrink: 0 }}>
                      <div className="slds-page-header__top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div className="slds-object-icon">
                            💰
                          </div>
                          <div>
                            <span className="slds-object-eyebrow">Financial Ledger</span>
                            <h2 className="slds-object-title">
                              Global Transactions & Settlement Ledger
                            </h2>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={fetchData}
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            🔄 Sync Gateways
                          </button>
                          <a href="/api/compliance/export/10bd" className="btn btn-primary" download>
                            📄 Export 10BD CSV
                          </a>
                        </div>
                      </div>

                      <div className="slds-highlights-ribbon">
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Total Transactions</span>
                          <span className="slds-highlight-item__value">
                            {donations.length} Records
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Gross Settled Amount</span>
                          <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
                            ₹{donations.filter(d => d.status === 'completed' || d.status === 'success').reduce((acc, curr) => acc + Number(curr.amount || 0), 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Recurring Mandates</span>
                          <span className="slds-highlight-item__value" style={{ color: '#7C3AED' }}>
                            {donations.filter(d => !!d.subscriptionId).length} Subscriptions
                          </span>
                        </div>
                        <div className="slds-highlight-item">
                          <span className="slds-highlight-item__label">Multi-Gateway Rails</span>
                          <span className="slds-highlight-item__value">
                            Razorpay, Cashfree, PayU
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Donor Name</th>
                            <th>Email Address</th>
                            <th>Phone No</th>
                            <th>Amount</th>
                            <th>Gateway</th>
                            <th>Method</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {donations.map((d) => (
                            <tr key={d.id}>
                              <td>
                                <a 
                                  href={`#contact=${d.donorId}`} 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setActiveSuperadminTab('contacts');
                                    window.location.hash = `#contact=${d.donorId}`;
                                  }}
                                  style={{ color: '#059669', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
                                >
                                  {d.donorName}
                                </a>
                                {d.subscriptionId && (
                                  <span style={{ display: 'block', fontSize: '10px', color: '#86198F', fontWeight: 700 }}>
                                    Recurring (MD-{d.subscriptionId.substring(0, 6)})
                                  </span>
                                )}
                              </td>
                              <td>{d.donorEmail}</td>
                              <td>{d.donorPhone || 'N/A'}</td>
                              <td>{d.currency} {Number(d.amount).toLocaleString()}</td>
                              <td>
                                {(() => {
                                  const gw = (d.paymentGateway || 'razorpay').toLowerCase();
                                  const icon = gw === 'cashfree' ? '⚡' : gw === 'razorpay' ? '💳' : gw === 'payu' ? '🔴' : gw === 'ccavenue' ? '🏛️' : '🏦';
                                  return (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.78rem' }}>
                                      <span>{icon}</span> {d.paymentGateway}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td><span style={{ textTransform: 'uppercase', fontSize: '0.78rem' }}>{d.paymentMethod || 'UPI'}</span></td>
                              <td>
                                <span className={`badge ${d.status === 'completed' || d.status === 'success' ? 'badge-success' : d.status === 'pending' || d.status === 'initiated' ? 'badge-warning' : 'badge-failed'}`}>
                                  {d.status === 'completed' || d.status === 'success' ? '🟢 Success' : d.status === 'pending' || d.status === 'initiated' ? '🟡 Initiated' : '🔴 Failed'}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button 
                                    onClick={() => setSelectedDonationForModal(d)} 
                                    className="btn btn-secondary" 
                                    style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#2563EB', borderColor: '#BFDBFE' }}
                                  >
                                    🔍 View Payment Data
                                  </button>
                                  <button onClick={() => handleDeleteDonation(d.id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--error)' }}>Delete Log</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5. MASTER TEMPLATES SUBTAB */}
                {activeSuperadminTab === 'templates' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
                      <div>
                        <h2>Master Communication & 80G Templates</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>
                          Create, customize, and assign HTML/text templates for 80G PDF Receipts, WhatsApp Alerts, and Email Notifications with Whitelist Variables.
                        </p>
                      </div>
                    </div>

                    {/* Whitelist Variables Cheat Sheet Header */}
                    <div className="card" style={{ marginBottom: '20px', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px 20px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⚡ Dynamic Whitelist Variables (Supported across 80G, WhatsApp & Email)
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.78rem' }}>
                        <code style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '3px 6px', borderRadius: '4px' }}>&#123;&#123;donor_name&#125;&#125;</code>
                        <code style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '3px 6px', borderRadius: '4px' }}>&#123;&#123;donor_email&#125;&#125;</code>
                        <code style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '3px 6px', borderRadius: '4px' }}>&#123;&#123;donor_phone&#125;&#125;</code>
                        <code style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '3px 6px', borderRadius: '4px' }}>&#123;&#123;donor_tax_id&#125;&#125;</code>
                        <code style={{ background: '#ECFDF5', color: '#047857', padding: '3px 6px', borderRadius: '4px' }}>&#123;&#123;donation_amount&#125;&#125;</code>
                        <code style={{ background: '#ECFDF5', color: '#047857', padding: '3px 6px', borderRadius: '4px' }}>&#123;&#123;donation_currency&#125;&#125;</code>
                        <code style={{ background: '#ECFDF5', color: '#047857', padding: '3px 6px', borderRadius: '4px' }}>&#123;&#123;donation_date&#125;&#125;</code>
                        <code style={{ background: '#ECFDF5', color: '#047857', padding: '3px 6px', borderRadius: '4px' }}>&#123;&#123;transaction_id&#125;&#125;</code>
                        <code style={{ background: '#FEF3C7', color: '#B45309', padding: '3px 6px', borderRadius: '4px' }}>&#123;&#123;campaign_title&#125;&#125;</code>
                        <code style={{ background: '#FEF3C7', color: '#B45309', padding: '3px 6px', borderRadius: '4px' }}>&#123;&#123;ngo_name&#125;&#125;</code>
                        <code style={{ background: '#FEF3C7', color: '#B45309', padding: '3px 6px', borderRadius: '4px' }}>&#123;&#123;ngo_urn&#125;&#125;</code>
                        <code style={{ background: '#FEF3C7', color: '#B45309', padding: '3px 6px', borderRadius: '4px' }}>&#123;&#123;ngo_signatory&#125;&#125;</code>
                        <code style={{ background: '#F3E8FF', color: '#6B21A8', padding: '3px 6px', borderRadius: '4px' }}>&#123;&#123;receipt_url&#125;&#125;</code>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      {/* Left: Template Editor Form */}
                      <div className="card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', color: 'var(--primary)' }}>
                          {editingTemplateId ? '✏️ Edit Template' : '➕ Add Master Template'}
                        </h3>
                        <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div className="form-group">
                            <label className="form-label">Template Type / Channel</label>
                            <select 
                              className="form-input" 
                              value={tmplType} 
                              onChange={(e) => setTmplType(e.target.value as any)}
                            >
                              <option value="80g_receipt">📜 80G Tax Exemption Certificate (PDF / HTML)</option>
                              <option value="whatsapp_message">📲 WhatsApp Notification Message</option>
                              <option value="email_thankyou">📧 Email Thank-You Notification (HTML)</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Assigned NGO / Scope</label>
                            <select 
                              className="form-input" 
                              value={tmplTargetOrgId} 
                              onChange={(e) => setTmplTargetOrgId(e.target.value)}
                            >
                              <option value="default">🌐 Global System Default (Fallback for all NGOs)</option>
                              {organizations.map(org => (
                                <option key={org.id} value={org.id}>🏛️ {org.name} ({org.slug})</option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Template Display Name</label>
                            <input 
                              type="text" 
                              required 
                              placeholder="e.g. Custom WaterAid 80G Receipt" 
                              className="form-input" 
                              value={tmplName} 
                              onChange={(e) => setTmplName(e.target.value)} 
                            />
                          </div>

                          {tmplType === 'email_thankyou' && (
                            <div className="form-group">
                              <label className="form-label">Email Subject Line</label>
                              <input 
                                type="text" 
                                placeholder="Thank you for supporting {{ngo_name}}!" 
                                className="form-input" 
                                value={tmplSubject} 
                                onChange={(e) => setTmplSubject(e.target.value)} 
                              />
                            </div>
                          )}

                          <div className="form-group">
                            <label className="form-label">Template Content / HTML Code</label>
                            <textarea 
                              rows={10} 
                              required 
                              placeholder="Enter HTML or Message text code containing {{whitelisted_vars}}..." 
                              className="form-input" 
                              style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.4' }}
                              value={tmplContent} 
                              onChange={(e) => setTmplContent(e.target.value)} 
                            />
                          </div>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={tmplIsDefault} 
                              onChange={(e) => setTmplIsDefault(e.target.checked)} 
                            />
                            Set as Master Default for this Template Type
                          </label>

                          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                              {editingTemplateId ? 'Update Template' : 'Create Template'}
                            </button>
                            <button type="button" onClick={handlePreviewTemplate} className="btn btn-secondary">
                              👁️ Test Live Preview
                            </button>
                          </div>
                        </form>

                        {/* Live Whitelist Rendered Preview Drawer */}
                        {tmplPreviewResult && (
                          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                            <h4 style={{ fontSize: '0.88rem', color: '#059669', marginBottom: '8px' }}>
                              ✅ Live Parsed Whitelist Output
                            </h4>
                            <div 
                              style={{ padding: '12px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.82rem', maxHeight: '200px', overflowY: 'auto' }}
                              dangerouslySetInnerHTML={{ __html: tmplPreviewResult }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Right: Master Templates Directory Table */}
                      <div className="card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', color: 'var(--primary)' }}>
                          📚 Active Master & NGO Templates
                        </h3>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Template Info</th>
                              <th>Type</th>
                              <th>Scope</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {templatesList.map((t) => (
                              <tr key={t.id}>
                                <td>
                                  <strong>{t.name}</strong>
                                  {t.is_default && (
                                    <span className="badge badge-success" style={{ marginLeft: '6px', fontSize: '0.7rem' }}>Default</span>
                                  )}
                                  <br/><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>By: {t.created_by}</span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                                    {t.type === '80g_receipt' ? '📜 80G PDF' : t.type === 'whatsapp_message' ? '📲 WhatsApp' : '📧 Email'}
                                  </span>
                                </td>
                                <td>
                                  {t.organization_name ? (
                                    <span style={{ fontSize: '0.8rem', color: '#2563EB', fontWeight: 600 }}>🏛️ {t.organization_name}</span>
                                  ) : (
                                    <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>🌐 Global Default</span>
                                  )}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                    <button 
                                      onClick={() => {
                                        setEditingTemplateId(t.id);
                                        setTmplType(t.type);
                                        setTmplName(t.name);
                                        setTmplSubject(t.subject || '');
                                        setTmplContent(t.content);
                                        setTmplTargetOrgId(t.organization_id || 'default');
                                        setTmplIsDefault(t.is_default);
                                      }} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteTemplate(t.id)} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--error)' }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {templatesList.length === 0 && (
                              <tr>
                                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '16px' }}>No custom templates created yet.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. GLOBAL SYSTEM, RAZORPAY & EMAIL CONFIGURATION */}
                {activeSuperadminTab === 'settings' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                      <div>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          ⚙️ Global Platform Configurations & Credentials
                        </h2>
                        <p style={{ color: 'var(--text-secondary)' }}>
                          Manage Gmail SMTP, AWS SES Email engine credentials, default Razorpay payment gateways, Webhook secrets, and AI Copilot keys.
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge" style={{ backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '6px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
                          🟢 System Active
                        </span>
                        <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '6px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
                          📧 Dual Email Engine
                        </span>
                      </div>
                    </div>

                    <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '920px', marginBottom: '40px' }}>
                      
                      {/* WhatsApp Gateway Engine & Credentials Card */}
                      <div className="card" style={{ padding: '28px', borderLeft: '5px solid #25D366', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: '#FFF' }}>
                              💬
                            </div>
                            <div>
                              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-dark)', fontWeight: 700 }}>WhatsApp Gateway API Credentials</h3>
                              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                Configure default Meta Cloud API or Evolution Go (whatsmeow) for Journey Builder and automated alerts.
                              </p>
                            </div>
                          </div>

                          {/* WhatsApp Provider Switcher */}
                          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '8px', padding: '4px', border: '1px solid #CBD5E1' }}>
                            <button
                              type="button"
                              onClick={() => setSysWaProvider('meta')}
                              style={{
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: sysWaProvider === 'meta' ? '#059669' : 'transparent',
                                color: sysWaProvider === 'meta' ? '#FFF' : '#475569'
                              }}
                            >
                              🌐 Meta WhatsApp Cloud API
                            </button>
                            <button
                              type="button"
                              onClick={() => setSysWaProvider('evolution_go')}
                              style={{
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: sysWaProvider === 'evolution_go' ? '#059669' : 'transparent',
                                color: sysWaProvider === 'evolution_go' ? '#FFF' : '#475569'
                              }}
                            >
                              ⚡ Evolution Go (whatsmeow)
                            </button>
                          </div>
                        </div>

                        {/* Meta WhatsApp Fields */}
                        {sysWaProvider === 'meta' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '20px' }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontWeight: 600 }}>WhatsApp Business Account ID (WABA ID)</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                value={sysMetaWabaId} 
                                onChange={(e) => setSysMetaWabaId(e.target.value)} 
                                placeholder="e.g. 102938475610293"
                              />
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>From Meta Developer Portal &bull; WhatsApp Accounts</span>
                            </div>

                            <div className="form-group">
                              <label className="form-label" style={{ fontWeight: 600 }}>Phone Number ID</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                value={sysMetaPhoneId} 
                                onChange={(e) => setSysMetaPhoneId(e.target.value)} 
                                placeholder="e.g. 594039281746502"
                              />
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>From Meta Graph API &bull; Phone Numbers</span>
                            </div>

                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                              <label className="form-label" style={{ fontWeight: 600 }}>System User Permanent Access Token</label>
                              <div style={{ position: 'relative' }}>
                                <input 
                                  type={showMetaToken ? 'text' : 'password'} 
                                  className="form-input" 
                                  value={sysMetaToken} 
                                  onChange={(e) => setSysMetaToken(e.target.value)} 
                                  placeholder="EAAG..."
                                  autoComplete="off"
                                  style={{ fontFamily: 'monospace' }}
                                />
                                <button 
                                  type="button" 
                                  onClick={() => setShowMetaToken(!showMetaToken)} 
                                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#2563EB' }}
                                >
                                  {showMetaToken ? '🙈 Hide' : '👁️ Show'}
                                </button>
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Meta Business Manager Permanent Token with whatsapp_business_messaging scope</span>
                            </div>
                          </div>
                        )}

                        {/* Evolution Go Fields */}
                        {sysWaProvider === 'evolution_go' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px', marginBottom: '20px' }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontWeight: 600 }}>Evolution Go REST API URL</label>
                              <input 
                                type="url" 
                                className="form-input" 
                                value={sysEvoUrl} 
                                onChange={(e) => setSysEvoUrl(e.target.value)} 
                                placeholder="http://localhost:8080 or https://wa.yourdomain.com"
                              />
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Address of your self-hosted Evolution Go server</span>
                            </div>

                            <div className="form-group">
                              <label className="form-label" style={{ fontWeight: 600 }}>Instance Name</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                value={sysEvoInstance} 
                                onChange={(e) => setSysEvoInstance(e.target.value)} 
                                placeholder="danapro_main"
                              />
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Instance identifier in Evolution Go</span>
                            </div>

                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                              <label className="form-label" style={{ fontWeight: 600 }}>Global API Key / Instance Token</label>
                              <div style={{ position: 'relative' }}>
                                <input 
                                  type={showEvoApiKey ? 'text' : 'password'} 
                                  className="form-input" 
                                  value={sysEvoApiKey} 
                                  onChange={(e) => setSysEvoApiKey(e.target.value)} 
                                  placeholder="evolution-secret-api-key"
                                  autoComplete="off"
                                  style={{ fontFamily: 'monospace' }}
                                />
                                <button 
                                  type="button" 
                                  onClick={() => setShowEvoApiKey(!showEvoApiKey)} 
                                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#2563EB' }}
                                >
                                  {showEvoApiKey ? '🙈 Hide' : '👁️ Show'}
                                </button>
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Configured in Evolution Go environment variables (AUTHENTICATION_API_KEY)</span>
                            </div>
                          </div>
                        )}

                        {/* Live Test WhatsApp Dispatch Action */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '10px', background: '#F0FDF4', padding: '14px 18px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#166534', whiteSpace: 'nowrap' }}>Test Recipient Phone:</span>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={testWaRecipient} 
                              onChange={(e) => setTestWaRecipient(e.target.value)} 
                              placeholder="e.g. 919876543210"
                              style={{ height: '36px', fontSize: '0.82rem' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setActiveSuperadminTab('integrations')}
                              className="btn btn-secondary"
                              style={{ padding: '8px 14px', fontSize: '0.82rem', color: '#059669', borderColor: '#A7F3D0', background: '#FFF', fontWeight: 600 }}
                            >
                              📲 Open QR Pairing & Full Manager
                            </button>
                            <button
                              type="button"
                              onClick={handleTestWhatsAppDispatch}
                              disabled={isSendingTestWa}
                              className="btn btn-secondary"
                              style={{ padding: '8px 16px', fontSize: '0.82rem', color: '#059669', borderColor: '#059669', background: '#FFF', fontWeight: 700 }}
                            >
                              {isSendingTestWa ? 'Dispatching...' : '🚀 Send Test WhatsApp'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Email Dispatch Engine & Credentials Card */}
                      <div className="card" style={{ padding: '28px', borderLeft: '5px solid #F59E0B', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: '#FFF' }}>
                              📧
                            </div>
                            <div>
                              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-dark)', fontWeight: 700 }}>Email Notification Engine Credentials</h3>
                              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                Transmits automated HTML thank-you emails & 80G tax receipt PDF attachments to donors.
                              </p>
                            </div>
                          </div>

                          {/* Dispatch Provider Switcher */}
                          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '8px', padding: '4px', border: '1px solid #CBD5E1' }}>
                            <button
                              type="button"
                              onClick={() => setSysEmailProvider('smtp')}
                              style={{
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: sysEmailProvider === 'smtp' ? '#059669' : 'transparent',
                                color: sysEmailProvider === 'smtp' ? '#FFF' : '#475569'
                              }}
                            >
                              ⚡ Gmail App Password (SMTP)
                            </button>
                            <button
                              type="button"
                              onClick={() => setSysEmailProvider('aws_ses')}
                              style={{
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: sysEmailProvider === 'aws_ses' ? '#059669' : 'transparent',
                                color: sysEmailProvider === 'aws_ses' ? '#FFF' : '#475569'
                              }}
                            >
                              ☁️ AWS SES Service
                            </button>
                          </div>
                        </div>

                        {/* Gmail SMTP Fields */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '20px' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>Gmail SMTP Sender Email / User</label>
                            <input 
                              type="email" 
                              className="form-input" 
                              value={sysSmtpUser} 
                              onChange={(e) => setSysSmtpUser(e.target.value)} 
                              placeholder="lakshayb057@gmail.com"
                              required 
                            />
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Your Gmail address used to authenticate SMTP dispatches</span>
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>Gmail App Password (16 Characters)</label>
                            <div style={{ position: 'relative' }}>
                              <input 
                                type={showSmtpPass ? 'text' : 'password'} 
                                className="form-input" 
                                value={sysSmtpPass} 
                                onChange={(e) => setSysSmtpPass(e.target.value)} 
                                placeholder="angz efnw aziw mlzz"
                                autoComplete="off"
                                required
                              />
                              <button 
                                type="button" 
                                onClick={() => setShowSmtpPass(!showSmtpPass)} 
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#2563EB' }}
                              >
                                {showSmtpPass ? '🙈 Hide' : '👁️ Show'}
                              </button>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>App password generated from Google Account Security settings</span>
                          </div>
                        </div>

                        {/* AWS SES Credentials Box */}
                        <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '18px', border: '1px solid #E2E8F0', marginTop: '12px' }}>
                          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            ☁️ AWS Simple Email Service (SES) Credentials & Data Region
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">AWS Region</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                value={sysAwsRegion} 
                                onChange={(e) => setSysAwsRegion(e.target.value)} 
                                placeholder="ap-south-1"
                                required 
                              />
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Data center region (ap-south-1 for Mumbai)</span>
                            </div>

                            <div className="form-group">
                              <label className="form-label">Verified Sender Email (AWS SES)</label>
                              <input 
                                type="email" 
                                className="form-input" 
                                value={sysAwsSenderEmail} 
                                onChange={(e) => setSysAwsSenderEmail(e.target.value)} 
                                placeholder="lakshayb057@gmail.com"
                                required 
                              />
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Must be verified in AWS SES Console</span>
                            </div>

                            <div className="form-group">
                              <label className="form-label">AWS Access Key ID</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                value={sysAwsAccessKey} 
                                onChange={(e) => setSysAwsAccessKey(e.target.value)} 
                                placeholder="AKIAIOSFODNN7EXAMPLE"
                                autoComplete="off"
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">AWS Secret Access Key</label>
                              <div style={{ position: 'relative' }}>
                                <input 
                                  type={showAwsSecretKey ? 'text' : 'password'} 
                                  className="form-input" 
                                  value={sysAwsSecretKey} 
                                  onChange={(e) => setSysAwsSecretKey(e.target.value)} 
                                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                  autoComplete="off"
                                />
                                <button 
                                  type="button" 
                                  onClick={() => setShowAwsSecretKey(!showAwsSecretKey)} 
                                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#2563EB' }}
                                >
                                  {showAwsSecretKey ? '🙈 Hide' : '👁️ Show'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Live Test Email Dispatch Action */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '20px', background: '#EFF6FF', padding: '14px 18px', borderRadius: '10px', border: '1px solid #BFDBFE' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1E40AF', whiteSpace: 'nowrap' }}>Test Recipient:</span>
                            <input 
                              type="email" 
                              className="form-input" 
                              value={testEmailRecipient} 
                              onChange={(e) => setTestEmailRecipient(e.target.value)} 
                              placeholder="lakshayb057@gmail.com"
                              style={{ height: '36px', fontSize: '0.82rem' }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleTestEmailDispatch}
                            disabled={isSendingTestEmail}
                            className="btn btn-secondary"
                            style={{ padding: '8px 16px', fontSize: '0.82rem', color: '#2563EB', borderColor: '#2563EB', background: '#FFF', fontWeight: 700 }}
                          >
                            {isSendingTestEmail ? 'Sending Test Email...' : '⚡ Send Test Email & 80G PDF'}
                          </button>
                        </div>
                      </div>

                      {/* Multi-Payment Gateways & Routing Hub */}
                      <div className="card" style={{ padding: '28px', borderLeft: '5px solid #10B981', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: '#FFF' }}>
                                💳
                              </div>
                              <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-dark)', fontWeight: 700 }}>
                                  Multi-Payment Gateway Infrastructure & Smart Routing Hub
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                  Configure multi-rail payment gateways across Razorpay, PayU, CCAvenue, AU Bank / Worldline, and Cashfree with automated failover.
                                </p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={handleCheckGatewayHealth}
                                disabled={isTestingGatewayHealth}
                                className="btn btn-secondary"
                                style={{ padding: '6px 14px', fontSize: '0.78rem', color: '#059669', borderColor: '#A7F3D0', background: '#ECFDF5', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                {isTestingGatewayHealth ? 'Testing Rails...' : '⚡ Test Live Gateway Uptime & Latency'}
                              </button>
                              <span style={{ background: '#ECFDF5', color: '#059669', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, border: '1px solid #A7F3D0' }}>
                                ⚡ 5 Active Gateway Rails
                              </span>
                            </div>
                          </div>

                          {/* Gateway Selector Tabs */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', background: '#F8FAFC', padding: '8px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            {[
                              { id: 'razorpay', label: '💳 Razorpay', badge: gatewayHealth?.razorpay?.uptime || '99.98% Live' },
                              { id: 'payu', label: '🔴 PayU India', badge: gatewayHealth?.payu?.uptime || '99.95% Live' },
                              { id: 'ccavenue', label: '🏛️ CCAvenue', badge: gatewayHealth?.ccavenue?.uptime || '99.90% Live' },
                              { id: 'worldline', label: '🏦 AU Bank / Worldline', badge: gatewayHealth?.worldline?.uptime || '99.92% Live' },
                              { id: 'cashfree', label: '⚡ Cashfree', badge: gatewayHealth?.cashfree?.uptime || '99.96% Live' },
                              { id: 'routing', label: '🔀 Smart Failover Routing', badge: 'Auto-Switch' }
                            ].map(tab => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveGatewayTab(tab.id as any)}
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: activeGatewayTab === tab.id ? '#059669' : 'transparent',
                                  color: activeGatewayTab === tab.id ? '#FFFFFF' : '#475569',
                                  fontWeight: 600,
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'all 0.2s'
                                }}
                              >
                                <span>{tab.label}</span>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  background: activeGatewayTab === tab.id ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                                  color: activeGatewayTab === tab.id ? '#FFFFFF' : '#64748B'
                                }}>
                                  {tab.badge}
                                </span>
                              </button>
                            ))}
                          </div>

                          {/* TAB 1: RAZORPAY */}
                          {activeGatewayTab === 'razorpay' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div style={{ background: '#ECFDF5', padding: '12px 16px', borderRadius: '8px', border: '1px solid #A7F3D0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', color: '#065F46' }}>
                                  🟢 <strong>Razorpay Live Gateway Rail:</strong> Supports UPI Autopay, Debit/Credit Cards, Netbanking & Instant Subscriptions.
                                </span>
                                <span style={{ fontSize: '12px', background: '#D1FAE5', color: '#047857', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                  {gatewayHealth?.razorpay?.badge || '99.98% Live'} &bull; {gatewayHealth?.razorpay?.latencyMs || 42}ms latency
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontWeight: 600 }}>Razorpay Key ID</label>
                                  <input 
                                    type="text" 
                                    className="form-input" 
                                    value={sysRazorpayId} 
                                    onChange={(e) => setSysRazorpayId(e.target.value)} 
                                    placeholder="rzp_test_TIAIr4GaDu23Uq"
                                  />
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Live/Test Key ID from Razorpay Dashboard</span>
                                </div>

                                <div className="form-group">
                                  <label className="form-label" style={{ fontWeight: 600 }}>Razorpay Key Secret</label>
                                  <div style={{ position: 'relative' }}>
                                    <input 
                                      type={showRazorpaySecret ? 'text' : 'password'} 
                                      className="form-input" 
                                      value={sysRazorpaySecret} 
                                      onChange={(e) => setSysRazorpaySecret(e.target.value)} 
                                      placeholder="••••••••••••••••••••••••"
                                      autoComplete="off"
                                    />
                                    <button 
                                      type="button" 
                                      onClick={() => setShowRazorpaySecret(!showRazorpaySecret)} 
                                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#2563EB' }}
                                    >
                                      {showRazorpaySecret ? '🙈 Hide' : '👁️ Show'}
                                    </button>
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Secret used for cryptographic order creation & signature verification</span>
                                </div>
                              </div>

                              <div className="form-group" style={{ background: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                                <label className="form-label" style={{ fontWeight: 600, color: '#0F172A' }}>Razorpay Webhook Secret (HMAC-SHA256 Signature Verification)</label>
                                <div style={{ position: 'relative' }}>
                                  <input 
                                    type={showRazorpayWebhookSecret ? 'text' : 'password'} 
                                    className="form-input" 
                                    value={sysRazorpayWebhookSecret} 
                                    onChange={(e) => setSysRazorpayWebhookSecret(e.target.value)} 
                                    placeholder="whsec_8f93a1029e..."
                                    autoComplete="off"
                                  />
                                  <button 
                                    type="button" 
                                    onClick={() => setShowRazorpayWebhookSecret(!showRazorpayWebhookSecret)} 
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#2563EB' }}
                                  >
                                    {showRazorpayWebhookSecret ? '🙈 Hide' : '👁️ Show'}
                                  </button>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                    🔒 Endpoint: <code>POST /api/v1/external/webhooks/razorpay</code>
                                  </span>
                                  <button 
                                    type="button"
                                    onClick={() => handleSimulateWebhook('razorpay')}
                                    disabled={isSimulatingWebhook === 'razorpay'}
                                    className="btn btn-secondary"
                                    style={{ padding: '3px 10px', fontSize: '0.72rem', color: '#059669', borderColor: '#A7F3D0' }}
                                  >
                                    ⚡ Test Webhook Dispatch
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* TAB 2: PAYU INDIA */}
                          {activeGatewayTab === 'payu' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div style={{ background: '#FEF2F2', padding: '12px 16px', borderRadius: '8px', border: '1px solid #FECACA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', color: '#991B1B' }}>
                                  🔴 <strong>PayU India Gateway Rail:</strong> Dedicated for high-volume recurring ENACH, UPI Intent, and Multi-Currency card processing.
                                </span>
                                <span style={{ fontSize: '12px', background: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                  {gatewayHealth?.payu?.badge || '99.95% Live'} &bull; {gatewayHealth?.payu?.latencyMs || 58}ms latency
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontWeight: 600 }}>PayU Merchant Key</label>
                                  <input 
                                    type="text" 
                                    className="form-input" 
                                    value={sysPayuKey} 
                                    onChange={(e) => setSysPayuKey(e.target.value)} 
                                    placeholder="gtKFFx"
                                  />
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>PayU merchant key identifier</span>
                                </div>

                                <div className="form-group">
                                  <label className="form-label" style={{ fontWeight: 600 }}>PayU Merchant Salt</label>
                                  <div style={{ position: 'relative' }}>
                                    <input 
                                      type={showPayuSalt ? 'text' : 'password'} 
                                      className="form-input" 
                                      value={sysPayuSalt} 
                                      onChange={(e) => setSysPayuSalt(e.target.value)} 
                                      placeholder="••••••••••••••••••••••••"
                                      autoComplete="off"
                                    />
                                    <button 
                                      type="button" 
                                      onClick={() => setShowPayuSalt(!showPayuSalt)} 
                                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#2563EB' }}
                                    >
                                      {showPayuSalt ? '🙈 Hide' : '👁️ Show'}
                                    </button>
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>SHA-512 cryptographic hash salt</span>
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '18px' }}>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontWeight: 600 }}>PayU Webhook / IPN Auth Secret</label>
                                  <input 
                                    type="text" 
                                    className="form-input" 
                                    value={sysPayuWebhookSecret} 
                                    onChange={(e) => setSysPayuWebhookSecret(e.target.value)} 
                                    placeholder="payu_whsec_908123"
                                  />
                                </div>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontWeight: 600 }}>Environment Mode</label>
                                  <select 
                                    className="form-input" 
                                    value={sysPayuMode} 
                                    onChange={(e) => setSysPayuMode(e.target.value as any)}
                                    style={{ background: 'white' }}
                                  >
                                    <option value="test">Sandbox / Test Mode</option>
                                    <option value="live">Production / Live Mode</option>
                                  </select>
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button 
                                  type="button"
                                  onClick={() => handleSimulateWebhook('payu')}
                                  disabled={isSimulatingWebhook === 'payu'}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 12px', fontSize: '0.75rem', color: '#DC2626', borderColor: '#FECACA' }}
                                >
                                  ⚡ Test PayU Webhook Event
                                </button>
                              </div>
                            </div>
                          )}

                          {/* TAB 3: CCAVENUE */}
                          {activeGatewayTab === 'ccavenue' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div style={{ background: '#EFF6FF', padding: '12px 16px', borderRadius: '8px', border: '1px solid #BFDBFE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', color: '#1E40AF' }}>
                                  🏛️ <strong>CCAvenue Institutional Gateway:</strong> Direct connectivity across 50+ Indian netbanking portals and corporate giving accounts.
                                </span>
                                <span style={{ fontSize: '12px', background: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                  {gatewayHealth?.ccavenue?.badge || '99.90% Live'} &bull; {gatewayHealth?.ccavenue?.latencyMs || 74}ms latency
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontWeight: 600 }}>CCAvenue Merchant ID</label>
                                  <input 
                                    type="text" 
                                    className="form-input" 
                                    value={sysCcavenueMerchantId} 
                                    onChange={(e) => setSysCcavenueMerchantId(e.target.value)} 
                                    placeholder="2849102"
                                  />
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Assigned CCAvenue Merchant Account ID</span>
                                </div>

                                <div className="form-group">
                                  <label className="form-label" style={{ fontWeight: 600 }}>CCAvenue Access Code</label>
                                  <input 
                                    type="text" 
                                    className="form-input" 
                                    value={sysCcavenueAccessCode} 
                                    onChange={(e) => setSysCcavenueAccessCode(e.target.value)} 
                                    placeholder="AVIN02KJ91BC02"
                                  />
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Merchant access code for payment URL redirection</span>
                                </div>
                              </div>

                              <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 600 }}>CCAvenue 128-Bit Working Key</label>
                                <div style={{ position: 'relative' }}>
                                  <input 
                                    type={showCcavenueWorkingKey ? 'text' : 'password'} 
                                    className="form-input" 
                                    value={sysCcavenueWorkingKey} 
                                    onChange={(e) => setSysCcavenueWorkingKey(e.target.value)} 
                                    placeholder="8B9F04D92841CA902E41829B0482910F"
                                    autoComplete="off"
                                  />
                                  <button 
                                    type="button" 
                                    onClick={() => setShowCcavenueWorkingKey(!showCcavenueWorkingKey)} 
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#2563EB' }}
                                  >
                                    {showCcavenueWorkingKey ? '🙈 Hide' : '👁️ Show'}
                                  </button>
                                </div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>AES-128 cryptographic key for encrypting and decrypting transaction requests</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button 
                                  type="button"
                                  onClick={() => handleSimulateWebhook('ccavenue')}
                                  disabled={isSimulatingWebhook === 'ccavenue'}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 12px', fontSize: '0.75rem', color: '#1D4ED8', borderColor: '#BFDBFE' }}
                                >
                                  ⚡ Test CCAvenue Webhook Event
                                </button>
                              </div>
                            </div>
                          )}

                          {/* TAB 4: AU SMALL FINANCE BANK / WORLDLINE */}
                          {activeGatewayTab === 'worldline' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div style={{ background: '#FFFBEB', padding: '12px 16px', borderRadius: '8px', border: '1px solid #FDE68A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', color: '#92400E' }}>
                                  🏦 <strong>AU Small Finance Bank / Worldline Rail:</strong> Direct institutional bank acquiring rails, low-MDR transaction processing, and corporate debit settlements.
                                </span>
                                <span style={{ fontSize: '12px', background: '#FEF3C7', color: '#B45309', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                  {gatewayHealth?.worldline?.badge || '99.92% Live'} &bull; {gatewayHealth?.worldline?.latencyMs || 51}ms latency
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontWeight: 600 }}>AU Bank / Worldline Merchant ID</label>
                                  <input 
                                    type="text" 
                                    className="form-input" 
                                    value={sysWorldlineMerchantId} 
                                    onChange={(e) => setSysWorldlineMerchantId(e.target.value)} 
                                    placeholder="WL_AUBANK_89210"
                                  />
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>AU Bank direct merchant identification code</span>
                                </div>

                                <div className="form-group">
                                  <label className="form-label" style={{ fontWeight: 600 }}>AU Bank Terminal ID (TID)</label>
                                  <input 
                                    type="text" 
                                    className="form-input" 
                                    value={sysWorldlineTerminalId} 
                                    onChange={(e) => setSysWorldlineTerminalId(e.target.value)} 
                                    placeholder="AUB_TID_00192"
                                  />
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Virtual POS terminal identifier</span>
                                </div>
                              </div>

                              <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 600 }}>Secret Encryption Key</label>
                                <div style={{ position: 'relative' }}>
                                  <input 
                                    type={showWorldlineSecret ? 'text' : 'password'} 
                                    className="form-input" 
                                    value={sysWorldlineSecretKey} 
                                    onChange={(e) => setSysWorldlineSecretKey(e.target.value)} 
                                    placeholder="sec_aubank_worldline_891023"
                                    autoComplete="off"
                                  />
                                  <button 
                                    type="button" 
                                    onClick={() => setShowWorldlineSecret(!showWorldlineSecret)} 
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#2563EB' }}
                                  >
                                    {showWorldlineSecret ? '🙈 Hide' : '👁️ Show'}
                                  </button>
                                </div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Secret key used for secure checksum calculation and bank server handshake</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button 
                                  type="button"
                                  onClick={() => handleSimulateWebhook('worldline')}
                                  disabled={isSimulatingWebhook === 'worldline'}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 12px', fontSize: '0.75rem', color: '#B45309', borderColor: '#FDE68A' }}
                                >
                                  ⚡ Test AU Bank / Worldline Webhook Event
                                </button>
                              </div>
                            </div>
                          )}

                          {/* TAB 5: CASHFREE */}
                          {activeGatewayTab === 'cashfree' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div style={{ background: '#FAF5FF', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E9D5FF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', color: '#6B21A8' }}>
                                  ⚡ <strong>Cashfree Payments Rail:</strong> Fast UPI Intent checkout, QR collections, and instant beneficiary disbursal APIs.
                                </span>
                                <span style={{ fontSize: '12px', background: '#F3E8FF', color: '#7E22CE', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                  {gatewayHealth?.cashfree?.badge || '99.96% Live'} &bull; {gatewayHealth?.cashfree?.latencyMs || 38}ms latency
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontWeight: 600 }}>Cashfree App ID</label>
                                  <input 
                                    type="text" 
                                    className="form-input" 
                                    value={sysCashfreeAppId} 
                                    onChange={(e) => setSysCashfreeAppId(e.target.value)} 
                                    placeholder="CF_APP_91029384"
                                  />
                                </div>

                                <div className="form-group">
                                  <label className="form-label" style={{ fontWeight: 600 }}>Cashfree Secret Key</label>
                                  <div style={{ position: 'relative' }}>
                                    <input 
                                      type={showCashfreeSecret ? 'text' : 'password'} 
                                      className="form-input" 
                                      value={sysCashfreeSecretKey} 
                                      onChange={(e) => setSysCashfreeSecretKey(e.target.value)} 
                                      placeholder="cf_sec_91823901823901283"
                                      autoComplete="off"
                                    />
                                    <button 
                                      type="button" 
                                      onClick={() => setShowCashfreeSecret(!showCashfreeSecret)} 
                                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#2563EB' }}
                                    >
                                      {showCashfreeSecret ? '🙈 Hide' : '👁️ Show'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button 
                                  type="button"
                                  onClick={() => handleSimulateWebhook('cashfree')}
                                  disabled={isSimulatingWebhook === 'cashfree'}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 12px', fontSize: '0.75rem', color: '#7E22CE', borderColor: '#E9D5FF' }}
                                >
                                  ⚡ Test Cashfree Webhook Event
                                </button>
                              </div>
                            </div>
                          )}

                          {/* TAB 6: SMART FAILOVER & ROUTING */}
                          {activeGatewayTab === 'routing' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                                  🎯 Smart Multi-Gateway Traffic Routing Engine
                                </h4>
                                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748B' }}>
                                  Define which gateway processes default donation traffic and automatically switch to backup rails when gateway outages or bank server rejections are detected.
                                </p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '16px' }}>
                                  <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Primary Active Gateway</label>
                                    <select 
                                      className="form-input" 
                                      value={primaryGateway} 
                                      onChange={(e) => setPrimaryGateway(e.target.value)}
                                      style={{ background: 'white' }}
                                    >
                                      <option value="razorpay">💳 Razorpay (Default)</option>
                                      <option value="payu">🔴 PayU India</option>
                                      <option value="ccavenue">🏛️ CCAvenue</option>
                                      <option value="worldline">🏦 AU Small Finance Bank / Worldline</option>
                                      <option value="cashfree">⚡ Cashfree Payments</option>
                                    </select>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Receives 100% of standard checkout attempts</span>
                                  </div>

                                  <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Fallback Secondary Gateway</label>
                                    <select 
                                      className="form-input" 
                                      value={fallbackGateway} 
                                      onChange={(e) => setFallbackGateway(e.target.value)}
                                      style={{ background: 'white' }}
                                    >
                                      <option value="payu">🔴 PayU India (Recommended)</option>
                                      <option value="ccavenue">🏛️ CCAvenue</option>
                                      <option value="worldline">🏦 AU Small Finance Bank / Worldline</option>
                                      <option value="razorpay">💳 Razorpay</option>
                                      <option value="cashfree">⚡ Cashfree Payments</option>
                                    </select>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Auto-routes donors if primary gateway responds with timeout or bank downtime</span>
                                  </div>
                                </div>

                                <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div>
                                    <strong style={{ fontSize: '13px', display: 'block', color: '#0F172A' }}>Enable Real-Time Automated Gateway Failover</strong>
                                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                                      Detects upstream gateway outages and switches the active payment rail in 350ms to prevent donation drop-offs.
                                    </span>
                                  </div>
                                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={enableAutoFailover} 
                                      onChange={(e) => setEnableAutoFailover(e.target.checked)} 
                                      style={{ width: '20px', height: '20px', accentColor: '#059669', cursor: 'pointer' }}
                                    />
                                  </label>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                      {/* AI Intelligence Engines Card */}
                      <div className="card" style={{ padding: '28px', borderLeft: '5px solid #3B82F6', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: '#FFF' }}>
                            🤖
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-dark)', fontWeight: 700 }}>AI Copilot & Analytics Credentials</h3>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              API keys powering automated campaign content optimization, donor sentiment analysis, and 80G receipt template generation.
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>Google Gemini API Key</label>
                            <input 
                              type="password" 
                              className="form-input" 
                              value={sysGeminiKey} 
                              onChange={(e) => setSysGeminiKey(e.target.value)} 
                              placeholder="AQ.Ab8RN6..."
                              autoComplete="off"
                            />
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Powers Gemini 1.5 Pro campaign content generation</span>
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>OpenAI API Key</label>
                            <div style={{ position: 'relative' }}>
                              <input 
                                type={showOpenaiKey ? 'text' : 'password'} 
                                className="form-input" 
                                value={sysOpenaiKey} 
                                onChange={(e) => setSysOpenaiKey(e.target.value)} 
                                placeholder="sk-proj-..."
                                autoComplete="off"
                              />
                              <button 
                                type="button" 
                                onClick={() => setShowOpenaiKey(!showOpenaiKey)} 
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#2563EB' }}
                              >
                                {showOpenaiKey ? '🙈 Hide' : '👁️ Show'}
                              </button>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Powers OpenAI GPT-4o donor sentiment analysis</span>
                          </div>
                        </div>
                      </div>

                      {/* Sticky Floating Save Button Container */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px' }}>
                        <button 
                          type="submit" 
                          className="btn btn-primary" 
                          style={{ padding: '14px 32px', fontSize: '1rem', fontWeight: 700, borderRadius: '12px', boxShadow: '0 10px 20px -5px rgba(5, 150, 105, 0.4)' }}
                        >
                          💾 Save All Platform Configurations
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Superadmin Tab: Contacts CRM */}
                {activeSuperadminTab === 'contacts' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <ContactList />
                  </div>
                )}

                {/* Superadmin Tab: Communications */}
                {activeSuperadminTab === 'communications' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <CommunicationLog />
                  </div>
                )}

                {/* Superadmin Tab: Journey Builder */}
                {activeSuperadminTab === 'journeys' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    {selectedJourney ? (
                      <JourneyCanvas journey={selectedJourney} onBack={() => setSelectedJourney(null)} />
                    ) : (
                      <>
                        <JourneyList onSelectJourney={(j: any) => setSelectedJourney(j)} />
                        <div style={{ marginTop: '32px' }}>
                          <EventTriggerSetup />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Superadmin Tab: Broadcasts */}
                {activeSuperadminTab === 'broadcasts' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <BroadcastManager />
                  </div>
                )}

                {/* Superadmin Tab: Compliance 80G & 10BD */}
                {activeSuperadminTab === 'compliance' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px', gap: '24px' }}>
                    <ReceiptManager />
                    <TenBDExport />
                    <ConsentManager />
                  </div>
                )}

                {/* Superadmin Tab: Segments */}
                {activeSuperadminTab === 'segments' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <SegmentBuilder />
                  </div>
                )}

                {/* Superadmin Tab: Custom Reports */}
                {activeSuperadminTab === 'reports' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <ReportBuilder />
                  </div>
                )}

                {/* Superadmin Tab: Object Manager */}
                {activeSuperadminTab === 'objectManager' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <ObjectManager />
                  </div>
                )}

                {/* Superadmin Tab: Roles & RBAC */}
                {activeSuperadminTab === 'roles' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <RoleManager />
                  </div>
                )}

                {/* Superadmin Tab: API & Webhooks */}
                {activeSuperadminTab === 'integrations' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <ApiIntegrations />
                  </div>
                )}

                {/* ========================================================
                    MODAL POPUPS (NGO CREATE / EDIT & CAMPAIGN CREATE / EDIT)
                    ======================================================== */}

                {/* 1. NGO Create Modal */}
                {showAddNgoModal && (
                  <div className="modal-backdrop">
                    <div className="modal-container" style={{ maxWidth: '750px' }}>
                      <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.4rem' }}>🏛️</span>
                          <h3 style={{ margin: 0 }}>Register New NGO & Multi-Gateway Infrastructure</h3>
                        </div>
                        <button onClick={() => setShowAddNgoModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                      </div>
                      <form onSubmit={(e) => { handleAddNGO(e); }}>
                        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                          
                          {/* Basic NGO Details */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '14px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">NGO Organization Name</label>
                              <input type="text" className="form-input" value={newNgoName} onChange={(e) => setNewNgoName(e.target.value)} required placeholder="e.g. Hope Foundation" />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">URL Slug</label>
                              <input type="text" className="form-input" value={newNgoSlug} onChange={(e) => setNewNgoSlug(e.target.value)} required placeholder="hope-foundation" />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Country</label>
                              <select className="form-input" value={newNgoCountry} onChange={(e) => setNewNgoCountry(e.target.value)}>
                                <option value="IN">India (IN)</option>
                                <option value="US">United States (US)</option>
                                <option value="GB">United Kingdom (GB)</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Primary Currency</label>
                              <select className="form-input" value={newNgoCurrency} onChange={(e) => setNewNgoCurrency(e.target.value)}>
                                <option value="INR">INR (₹)</option>
                                <option value="USD">USD ($)</option>
                                <option value="GBP">GBP (£)</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Platform Fee Rate (%)</label>
                              <input type="number" step="0.1" className="form-input" value={newNgoFeePercent} onChange={(e) => setNewNgoFeePercent(parseFloat(e.target.value) || 0)} />
                            </div>
                          </div>

                          {/* AWS SES Verified Sender Domain */}
                          <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <label className="form-label" style={{ fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>
                              📧 AWS SES Verified Sender Email Alignment
                            </label>
                            <input 
                              type="email" 
                              placeholder="e.g. donations@org.in" 
                              className="form-input" 
                              value={newNgoVerifiedSender} 
                              onChange={(e) => setNewNgoVerifiedSender(e.target.value)} 
                            />
                          </div>

                          {/* Worker Access Login Credentials */}
                          <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0F172A', fontWeight: 700 }}>
                              🔐 NGO Worker Login Credentials
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <label className="form-label" style={{ fontSize: '0.78rem' }}>Worker Email / Username</label>
                                <input 
                                  type="email" 
                                  required 
                                  placeholder="worker@org.in" 
                                  className="form-input" 
                                  value={newNgoAdminEmail} 
                                  onChange={(e) => setNewNgoAdminEmail(e.target.value)} 
                                />
                              </div>
                              <div>
                                <label className="form-label" style={{ fontSize: '0.78rem' }}>Worker Password</label>
                                <input 
                                  type="password" 
                                  required 
                                  placeholder="Password for portal login" 
                                  className="form-input" 
                                  value={newNgoAdminPassword} 
                                  onChange={(e) => setNewNgoAdminPassword(e.target.value)} 
                                />
                              </div>
                            </div>
                          </div>

                          {/* MULTI-PAYMENT GATEWAY CONFIGURATION ACCORDION FOR THIS NGO */}
                          <div style={{ background: '#F0FDF4', padding: '18px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#166534', fontWeight: 700 }}>
                                  💳 Multi-Payment Gateway Rails Configuration (Per-NGO)
                                </h4>
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#15803D' }}>
                                  Configure and assign any permutation of the 5 payment gateway rails for this specific NGO.
                                </p>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              
                              {/* 1. Razorpay Rail */}
                              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', marginBottom: newNgoRzpEnabled ? '10px' : '0' }}>
                                  <input type="checkbox" checked={newNgoRzpEnabled} onChange={(e) => setNewNgoRzpEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#059669' }} />
                                  💳 Razorpay Rail (UPI Autopay, Cards, Netbanking)
                                </label>
                                {newNgoRzpEnabled && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                                    <input type="text" placeholder="Razorpay Key ID (rzp_live_...)" className="form-input" value={newNgoRazorpayKeyId} onChange={(e) => setNewNgoRazorpayKeyId(e.target.value)} />
                                    <input type="password" placeholder="Razorpay Key Secret" className="form-input" value={newNgoRazorpayKeySecret} onChange={(e) => setNewNgoRazorpayKeySecret(e.target.value)} />
                                  </div>
                                )}
                              </div>

                              {/* 2. PayU India Rail */}
                              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', marginBottom: newNgoPayuEnabled ? '10px' : '0' }}>
                                  <input type="checkbox" checked={newNgoPayuEnabled} onChange={(e) => setNewNgoPayuEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#DC2626' }} />
                                  🔴 PayU India Rail (ENACH, UPI Intent, Multi-Currency)
                                </label>
                                {newNgoPayuEnabled && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                                    <input type="text" placeholder="PayU Merchant Key" className="form-input" value={newNgoPayuKey} onChange={(e) => setNewNgoPayuKey(e.target.value)} />
                                    <input type="password" placeholder="PayU Merchant Salt" className="form-input" value={newNgoPayuSalt} onChange={(e) => setNewNgoPayuSalt(e.target.value)} />
                                  </div>
                                )}
                              </div>

                              {/* 3. CCAvenue Rail */}
                              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', marginBottom: newNgoCcavEnabled ? '10px' : '0' }}>
                                  <input type="checkbox" checked={newNgoCcavEnabled} onChange={(e) => setNewNgoCcavEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#1D4ED8' }} />
                                  🏛️ CCAvenue Rail (50+ Indian Banks Direct Netbanking)
                                </label>
                                {newNgoCcavEnabled && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '8px' }}>
                                    <input type="text" placeholder="CCAvenue Merchant ID" className="form-input" value={newNgoCcavMid} onChange={(e) => setNewNgoCcavMid(e.target.value)} />
                                    <input type="text" placeholder="Access Code" className="form-input" value={newNgoCcavCode} onChange={(e) => setNewNgoCcavCode(e.target.value)} />
                                    <input type="password" placeholder="Working Key" className="form-input" value={newNgoCcavKey} onChange={(e) => setNewNgoCcavKey(e.target.value)} />
                                  </div>
                                )}
                              </div>

                              {/* 4. AU Bank / Worldline Rail */}
                              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', marginBottom: newNgoWlEnabled ? '10px' : '0' }}>
                                  <input type="checkbox" checked={newNgoWlEnabled} onChange={(e) => setNewNgoWlEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#B45309' }} />
                                  🏦 AU Small Finance Bank / Worldline Direct Rail
                                </label>
                                {newNgoWlEnabled && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '8px' }}>
                                    <input type="text" placeholder="Merchant ID" className="form-input" value={newNgoWlMid} onChange={(e) => setNewNgoWlMid(e.target.value)} />
                                    <input type="text" placeholder="Terminal ID (TID)" className="form-input" value={newNgoWlTid} onChange={(e) => setNewNgoWlTid(e.target.value)} />
                                    <input type="password" placeholder="Secret Key" className="form-input" value={newNgoWlSecret} onChange={(e) => setNewNgoWlSecret(e.target.value)} />
                                  </div>
                                )}
                              </div>

                              {/* 5. Cashfree Rail */}
                              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', marginBottom: newNgoCfEnabled ? '10px' : '0' }}>
                                  <input type="checkbox" checked={newNgoCfEnabled} onChange={(e) => setNewNgoCfEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#7E22CE' }} />
                                  ⚡ Cashfree Payments Rail (Instant UPI Intent & Disbursal)
                                </label>
                                {newNgoCfEnabled && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                                    <input type="text" placeholder="Cashfree App ID" className="form-input" value={newNgoCfAppId} onChange={(e) => setNewNgoCfAppId(e.target.value)} />
                                    <input type="password" placeholder="Cashfree Secret Key" className="form-input" value={newNgoCfSecret} onChange={(e) => setNewNgoCfSecret(e.target.value)} />
                                  </div>
                                )}
                              </div>

                              {/* Smart Routing Preferences for this NGO (Dynamic based on selected checkboxes) */}
                              {(() => {
                                const activeRails = [
                                  newNgoRzpEnabled && { id: 'razorpay', label: '💳 Razorpay Rail' },
                                  newNgoPayuEnabled && { id: 'payu', label: '🔴 PayU India Rail' },
                                  newNgoCcavEnabled && { id: 'ccavenue', label: '🏛️ CCAvenue Rail' },
                                  newNgoWlEnabled && { id: 'worldline', label: '🏦 AU Bank / Worldline Rail' },
                                  newNgoCfEnabled && { id: 'cashfree', label: '⚡ Cashfree Payments Rail' }
                                ].filter(Boolean) as Array<{ id: string; label: string }>;

                                return (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '6px' }}>
                                    <div>
                                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Primary Gateway for this NGO</label>
                                      <select 
                                        className="form-input" 
                                        value={activeRails.some(r => r.id === newNgoPrimaryGw) ? newNgoPrimaryGw : (activeRails[0]?.id || 'razorpay')} 
                                        onChange={(e) => setNewNgoPrimaryGw(e.target.value)}
                                      >
                                        {activeRails.length > 0 ? (
                                          activeRails.map(r => (
                                            <option key={r.id} value={r.id}>{r.label}</option>
                                          ))
                                        ) : (
                                          <option value="razorpay">💳 Razorpay (Default)</option>
                                        )}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Fallback Gateway</label>
                                      <select 
                                        className="form-input" 
                                        value={newNgoFallbackGw} 
                                        onChange={(e) => setNewNgoFallbackGw(e.target.value)}
                                      >
                                        {activeRails.length > 1 ? (
                                          <>
                                            <option value="">None (Single Active Gateway)</option>
                                            {activeRails.filter(r => r.id !== newNgoPrimaryGw).map(r => (
                                              <option key={r.id} value={r.id}>{r.label}</option>
                                            ))}
                                          </>
                                        ) : (
                                          <option value="">None (Single Gateway Rail)</option>
                                        )}
                                      </select>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* 80G Statutory Certificate Details */}
                          <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0F172A', fontWeight: 700 }}>
                              🛡️ 80G Statutory Certificate Details
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <input type="text" placeholder="Registration URN (e.g. AAATD0192K20261)" className="form-input" value={new80gUrn} onChange={(e) => setNew80gUrn(e.target.value)} />
                              <input type="date" className="form-input" value={new80gDate} onChange={(e) => setNew80gDate(e.target.value)} />
                            </div>
                            <input type="text" style={{ marginTop: '10px' }} placeholder="Digital Signatory Officer name (e.g. Country Director India)" className="form-input" value={new80gSignatory} onChange={(e) => setNew80gSignatory(e.target.value)} />
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button type="button" onClick={() => setShowAddNgoModal(false)} className="btn btn-secondary">Cancel</button>
                          <button type="submit" className="btn btn-primary">Create NGO Profile & Rails</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* 2. NGO Edit Modal */}
                {editingNgoId && (
                  <div className="modal-backdrop">
                    <div className="modal-container" style={{ maxWidth: '750px' }}>
                      <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.4rem' }}>⚙️</span>
                          <h3 style={{ margin: 0 }}>Configure NGO Multi-Gateway Infrastructure & Permissions</h3>
                        </div>
                        <button onClick={() => setEditingNgoId(null)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                      </div>
                      <form onSubmit={(e) => { handleUpdateNGO(e); }}>
                        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '14px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">NGO Organization Name</label>
                              <input type="text" className="form-input" value={editNgoName} onChange={(e) => setEditNgoName(e.target.value)} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">URL Slug</label>
                              <input type="text" className="form-input" value={editNgoSlug} onChange={(e) => setEditNgoSlug(e.target.value)} required />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Country</label>
                              <select className="form-input" value={editNgoCountry} onChange={(e) => setEditNgoCountry(e.target.value)}>
                                <option value="IN">India (IN)</option>
                                <option value="US">United States (US)</option>
                                <option value="GB">United Kingdom (GB)</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Account Status</label>
                              <select className="form-input" value={editNgoStatus} onChange={(e) => setEditNgoStatus(e.target.value)}>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Platform Fee Rate (%)</label>
                              <input type="number" step="0.1" className="form-input" value={editNgoFeePercent} onChange={(e) => setEditNgoFeePercent(parseFloat(e.target.value) || 0)} />
                            </div>
                          </div>

                          {/* AWS SES Verified Sender Domain */}
                          <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <label className="form-label" style={{ fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>
                              📧 AWS SES Domain Email Alignment
                            </label>
                            <input 
                              type="email" 
                              placeholder="e.g. donations@org.in" 
                              className="form-input" 
                              value={editNgoVerifiedSender} 
                              onChange={(e) => setEditNgoVerifiedSender(e.target.value)} 
                            />
                          </div>

                          {/* Reset/Update Worker Password */}
                          <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0F172A', fontWeight: 700 }}>
                              🔐 Update NGO Worker Login Credentials
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <input 
                                type="email" 
                                placeholder="worker@org.in" 
                                className="form-input" 
                                value={editNgoAdminEmail} 
                                onChange={(e) => setEditNgoAdminEmail(e.target.value)} 
                              />
                              <input 
                                type="password" 
                                placeholder="Enter new password to reset" 
                                className="form-input" 
                                value={editNgoAdminPassword} 
                                onChange={(e) => setEditNgoAdminPassword(e.target.value)} 
                              />
                            </div>
                          </div>

                          {/* EDIT MULTI-PAYMENT GATEWAY CONFIGURATION FOR THIS NGO */}
                          <div style={{ background: '#F0FDF4', padding: '18px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                            <div style={{ marginBottom: '14px' }}>
                              <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#166534', fontWeight: 700 }}>
                                💳 Assigned Payment Gateway Rails for this NGO
                              </h4>
                              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#15803D' }}>
                                Enable and provide dedicated keys for each rail this NGO will utilize across its campaigns.
                              </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              
                              {/* 1. Razorpay */}
                              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', marginBottom: editNgoRzpEnabled ? '10px' : '0' }}>
                                  <input type="checkbox" checked={editNgoRzpEnabled} onChange={(e) => setEditNgoRzpEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#059669' }} />
                                  💳 Razorpay Rail (UPI Autopay, Cards, Netbanking)
                                </label>
                                {editNgoRzpEnabled && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                                    <input type="text" placeholder="Razorpay Key ID" className="form-input" value={editNgoRazorpayKeyId} onChange={(e) => setEditNgoRazorpayKeyId(e.target.value)} />
                                    <input type="password" placeholder="Razorpay Key Secret" className="form-input" value={editNgoRazorpayKeySecret} onChange={(e) => setEditNgoRazorpayKeySecret(e.target.value)} />
                                  </div>
                                )}
                              </div>

                              {/* 2. PayU India */}
                              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', marginBottom: editNgoPayuEnabled ? '10px' : '0' }}>
                                  <input type="checkbox" checked={editNgoPayuEnabled} onChange={(e) => setEditNgoPayuEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#DC2626' }} />
                                  🔴 PayU India Rail (ENACH, UPI Intent, Multi-Currency)
                                </label>
                                {editNgoPayuEnabled && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                                    <input type="text" placeholder="PayU Merchant Key" className="form-input" value={editNgoPayuKey} onChange={(e) => setEditNgoPayuKey(e.target.value)} />
                                    <input type="password" placeholder="PayU Merchant Salt" className="form-input" value={editNgoPayuSalt} onChange={(e) => setEditNgoPayuSalt(e.target.value)} />
                                  </div>
                                )}
                              </div>

                              {/* 3. CCAvenue */}
                              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', marginBottom: editNgoCcavEnabled ? '10px' : '0' }}>
                                  <input type="checkbox" checked={editNgoCcavEnabled} onChange={(e) => setEditNgoCcavEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#1D4ED8' }} />
                                  🏛️ CCAvenue Rail (50+ Indian Banks Direct Netbanking)
                                </label>
                                {editNgoCcavEnabled && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '8px' }}>
                                    <input type="text" placeholder="CCAvenue Merchant ID" className="form-input" value={editNgoCcavMid} onChange={(e) => setEditNgoCcavMid(e.target.value)} />
                                    <input type="text" placeholder="Access Code" className="form-input" value={editNgoCcavCode} onChange={(e) => setEditNgoCcavCode(e.target.value)} />
                                    <input type="password" placeholder="Working Key" className="form-input" value={editNgoCcavKey} onChange={(e) => setEditNgoCcavKey(e.target.value)} />
                                  </div>
                                )}
                              </div>

                              {/* 4. AU Bank / Worldline */}
                              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', marginBottom: editNgoWlEnabled ? '10px' : '0' }}>
                                  <input type="checkbox" checked={editNgoWlEnabled} onChange={(e) => setEditNgoWlEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#B45309' }} />
                                  🏦 AU Small Finance Bank / Worldline Direct Rail
                                </label>
                                {editNgoWlEnabled && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '8px' }}>
                                    <input type="text" placeholder="Merchant ID" className="form-input" value={editNgoWlMid} onChange={(e) => setEditNgoWlMid(e.target.value)} />
                                    <input type="text" placeholder="Terminal ID" className="form-input" value={editNgoWlTid} onChange={(e) => setEditNgoWlTid(e.target.value)} />
                                    <input type="password" placeholder="Secret Key" className="form-input" value={editNgoWlSecret} onChange={(e) => setEditNgoWlSecret(e.target.value)} />
                                  </div>
                                )}
                              </div>

                              {/* 5. Cashfree */}
                              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', marginBottom: editNgoCfEnabled ? '10px' : '0' }}>
                                  <input type="checkbox" checked={editNgoCfEnabled} onChange={(e) => setEditNgoCfEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#7E22CE' }} />
                                  ⚡ Cashfree Payments Rail (Instant UPI Intent & Disbursal)
                                </label>
                                {editNgoCfEnabled && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                                    <input type="text" placeholder="Cashfree App ID" className="form-input" value={editNgoCfAppId} onChange={(e) => setEditNgoCfAppId(e.target.value)} />
                                    <input type="password" placeholder="Cashfree Secret Key" className="form-input" value={editNgoCfSecret} onChange={(e) => setEditNgoCfSecret(e.target.value)} />
                                  </div>
                                )}
                              </div>

                              {/* Smart Routing Preferences for this NGO (Dynamic based on selected checkboxes) */}
                              {(() => {
                                const activeRails = [
                                  editNgoRzpEnabled && { id: 'razorpay', label: '💳 Razorpay Rail' },
                                  editNgoPayuEnabled && { id: 'payu', label: '🔴 PayU India Rail' },
                                  editNgoCcavEnabled && { id: 'ccavenue', label: '🏛️ CCAvenue Rail' },
                                  editNgoWlEnabled && { id: 'worldline', label: '🏦 AU Bank / Worldline Rail' },
                                  editNgoCfEnabled && { id: 'cashfree', label: '⚡ Cashfree Payments Rail' }
                                ].filter(Boolean) as Array<{ id: string; label: string }>;

                                return (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '6px' }}>
                                    <div>
                                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Primary Gateway for this NGO</label>
                                      <select 
                                        className="form-input" 
                                        value={activeRails.some(r => r.id === editNgoPrimaryGw) ? editNgoPrimaryGw : (activeRails[0]?.id || 'razorpay')} 
                                        onChange={(e) => setEditNgoPrimaryGw(e.target.value)}
                                      >
                                        {activeRails.length > 0 ? (
                                          activeRails.map(r => (
                                            <option key={r.id} value={r.id}>{r.label}</option>
                                          ))
                                        ) : (
                                          <option value="razorpay">💳 Razorpay (Default)</option>
                                        )}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Fallback Gateway</label>
                                      <select 
                                        className="form-input" 
                                        value={editNgoFallbackGw} 
                                        onChange={(e) => setEditNgoFallbackGw(e.target.value)}
                                      >
                                        {activeRails.length > 1 ? (
                                          <>
                                            <option value="">None (Single Active Gateway)</option>
                                            {activeRails.filter(r => r.id !== editNgoPrimaryGw).map(r => (
                                              <option key={r.id} value={r.id}>{r.label}</option>
                                            ))}
                                          </>
                                        ) : (
                                          <option value="">None (Single Gateway Rail)</option>
                                        )}
                                      </select>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* 80G Certificate Details */}
                          <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0F172A', fontWeight: 700 }}>
                              🛡️ 80G Statutory Certificate Details
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <input type="text" placeholder="Registration URN" className="form-input" value={edit80gUrn} onChange={(e) => setEdit80gUrn(e.target.value)} />
                              <input type="date" className="form-input" value={edit80gDate} onChange={(e) => setEdit80gDate(e.target.value)} />
                            </div>
                            <input type="text" style={{ marginTop: '10px' }} placeholder="Digital Signatory Officer" className="form-input" value={edit80gSignatory} onChange={(e) => setEdit80gSignatory(e.target.value)} />
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button type="button" onClick={() => setEditingNgoId(null)} className="btn btn-secondary">Cancel</button>
                          <button type="submit" className="btn btn-primary">Save Changes</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* 3. Campaign Create Modal (with Checkbox Gateway Rail Alignment) */}
                {showAddCampaignModal && (
                  <div className="modal-backdrop">
                    <div className="modal-container" style={{ maxWidth: '680px' }}>
                      <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.4rem' }}>🚀</span>
                          <h3 style={{ margin: 0 }}>Create Campaign & Align Gateway Rails</h3>
                        </div>
                        <button onClick={() => setShowAddCampaignModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                      </div>
                      <form onSubmit={(e) => { handleAddCampaign(e); }}>
                        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {organizations.length === 0 ? (
                            <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '16px', borderRadius: 'var(--radius-md)', color: '#991B1B' }}>
                              <p style={{ margin: 0, fontSize: '0.84rem' }}>Please register an NGO profile first.</p>
                            </div>
                          ) : (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Target NGO Organization (Required)</label>
                              <select 
                                className="form-input" 
                                value={newCampOrgId} 
                                onChange={(e) => {
                                  setNewCampOrgId(e.target.value);
                                  const selectedNgo = organizations.find(o => o.id === e.target.value);
                                  const rails = extractNgoRails(selectedNgo);
                                  setNewCampAssignedGateways(rails.map(r => r.id || r.type));
                                  setNewCampPrimaryGateway(rails[0]?.type || 'razorpay');
                                }} 
                                required
                              >
                                <option value="">Select Target NGO...</option>
                                {organizations.map(o => (
                                  <option key={o.id} value={o.id}>{o.name} ({extractNgoRails(o).length} Rails)</option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Campaign Title</label>
                            <input type="text" className="form-input" value={newCampTitle} onChange={(e) => setNewCampTitle(e.target.value)} required placeholder="e.g. Medical Care Fund" />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Campaign Slug</label>
                              <input type="text" className="form-input" value={newCampSlug} onChange={(e) => setNewCampSlug(e.target.value)} required placeholder="medical-care-fund" />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Target Goal Amount (INR)</label>
                              <input type="number" className="form-input" value={newCampGoalAmount} onChange={(e) => setNewCampGoalAmount(Number(e.target.value) || 0)} required />
                            </div>
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">🌐 External NGO Landing Page URL</label>
                            <input type="url" className="form-input" value={newCampLandingPageUrl} onChange={(e) => setNewCampLandingPageUrl(e.target.value)} placeholder="https://finmantra.org/campaign" />
                          </div>

                          {/* DYNAMIC CHECKBOX GATEWAY ALIGNMENT (ONLY SHOWS TARGET NGO'S CONFIGURED GATEWAYS) */}
                          {newCampOrgId && (
                            <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
                              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#0F172A', fontWeight: 700 }}>
                                ⚡ Align Payment Gateway Rails to this Campaign (Checkbox Selection)
                              </h4>
                              <p style={{ margin: '0 0 12px 0', fontSize: '0.78rem', color: '#64748B' }}>
                                Check only the gateways you wish to activate for this specific campaign from the parent NGO's available rails:
                              </p>

                              {(() => {
                                const parentNgo = organizations.find(o => o.id === newCampOrgId);
                                const ngoRails = extractNgoRails(parentNgo);
                                if (ngoRails.length === 0) {
                                  return <p style={{ fontSize: '0.8rem', color: '#94A3B8' }}>No specific rails on NGO; platform defaults active.</p>;
                                }
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {ngoRails.map((rail) => {
                                      const isChecked = newCampAssignedGateways.includes(rail.id) || newCampAssignedGateways.includes(rail.type);
                                      return (
                                        <label 
                                          key={rail.id}
                                          style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'space-between',
                                            padding: '10px 14px', 
                                            background: isChecked ? '#ECFDF5' : '#FFFFFF', 
                                            border: `1px solid ${isChecked ? '#A7F3D0' : '#E2E8F0'}`, 
                                            borderRadius: '8px', 
                                            cursor: 'pointer' 
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input 
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setNewCampAssignedGateways([...newCampAssignedGateways, rail.id]);
                                                } else {
                                                  setNewCampAssignedGateways(newCampAssignedGateways.filter(id => id !== rail.id && id !== rail.type));
                                                }
                                              }}
                                              style={{ width: '18px', height: '18px', accentColor: '#059669' }}
                                            />
                                            <div>
                                              <strong style={{ fontSize: '0.86rem', color: '#0F172A' }}>{rail.name}</strong>
                                              <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748B' }}>Key / Ref: <code>{rail.keyPreview}</code></span>
                                            </div>
                                          </div>
                                          <span style={{ fontSize: '0.74rem', fontWeight: 600, color: isChecked ? '#059669' : '#94A3B8' }}>
                                            {isChecked ? '✅ Aligned' : '⚪ Inactive'}
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem' }}>
                              <input type="checkbox" checked={newCampAllowAnon} onChange={(e) => setNewCampAllowAnon(e.target.checked)} />
                              Allow Anonymous Donations
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem' }}>
                              <input type="checkbox" checked={newCampTaxEnabled} onChange={(e) => setNewCampTaxEnabled(e.target.checked)} />
                              Issue 80G Tax Receipts
                            </label>
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button type="button" onClick={() => setShowAddCampaignModal(false)} className="btn btn-secondary">Cancel</button>
                          <button type="submit" className="btn btn-primary">Create Campaign & Align Rails</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* 4. Campaign Edit Modal (with Checkbox Gateway Rail Alignment) */}
                {editingCampId && (
                  <div className="modal-backdrop">
                    <div className="modal-container" style={{ maxWidth: '680px' }}>
                      <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.4rem' }}>⚙️</span>
                          <h3 style={{ margin: 0 }}>Align Gateway Rails & Configure Campaign</h3>
                        </div>
                        <button onClick={() => setEditingCampId(null)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                      </div>
                      <form onSubmit={(e) => { handleUpdateCampaign(e); }}>
                        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Campaign Title</label>
                            <input type="text" className="form-input" value={editCampTitle} onChange={(e) => setEditCampTitle(e.target.value)} required />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Campaign Slug</label>
                              <input type="text" className="form-input" value={editCampSlug} onChange={(e) => setEditCampSlug(e.target.value)} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Goal Target Amount (INR)</label>
                              <input type="number" className="form-input" value={editCampGoalAmount} onChange={(e) => setEditCampGoalAmount(Number(e.target.value) || 0)} required />
                            </div>
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">🌐 External NGO Landing Page URL</label>
                            <input type="url" className="form-input" value={editCampLandingPageUrl} onChange={(e) => setEditCampLandingPageUrl(e.target.value)} placeholder="https://finmantra.org/campaign" />
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Campaign Status</label>
                            <select className="form-input" value={editCampActive ? 'true' : 'false'} onChange={(e) => setEditCampActive(e.target.value === 'true')}>
                              <option value="true">Active & Live</option>
                              <option value="false">Inactive / Paused</option>
                            </select>
                          </div>

                          {/* DYNAMIC CHECKBOX GATEWAY ALIGNMENT FOR THIS CAMPAIGN */}
                          <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
                            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#0F172A', fontWeight: 700 }}>
                              ⚡ Aligned Gateway Rails for this Campaign (Checkbox Selection)
                            </h4>
                            <p style={{ margin: '0 0 12px 0', fontSize: '0.78rem', color: '#64748B' }}>
                              Only gateways configured on this campaign's parent NGO are available for selection:
                            </p>

                            {(() => {
                              const currCamp = campaigns.find(c => c.id === editingCampId);
                              const parentNgo = organizations.find(o => o.id === currCamp?.organization_id);
                              const ngoRails = extractNgoRails(parentNgo);

                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {ngoRails.map((rail) => {
                                    const isChecked = editCampAssignedGateways.includes(rail.id) || editCampAssignedGateways.includes(rail.type);
                                    return (
                                      <label 
                                        key={rail.id}
                                        style={{ 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'space-between',
                                          padding: '10px 14px', 
                                          background: isChecked ? '#ECFDF5' : '#FFFFFF', 
                                          border: `1px solid ${isChecked ? '#A7F3D0' : '#E2E8F0'}`, 
                                          borderRadius: '8px', 
                                          cursor: 'pointer' 
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <input 
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setEditCampAssignedGateways([...editCampAssignedGateways, rail.id]);
                                              } else {
                                                setEditCampAssignedGateways(editCampAssignedGateways.filter(id => id !== rail.id && id !== rail.type));
                                              }
                                            }}
                                            style={{ width: '18px', height: '18px', accentColor: '#059669' }}
                                          />
                                          <div>
                                            <strong style={{ fontSize: '0.86rem', color: '#0F172A' }}>{rail.name}</strong>
                                            <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748B' }}>Key / Ref: <code>{rail.keyPreview}</code></span>
                                          </div>
                                        </div>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: isChecked ? '#059669' : '#94A3B8' }}>
                                          {isChecked ? '✅ Aligned' : '⚪ Inactive'}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>

                          {(() => {
                            const currCamp = campaigns.find(c => c.id === editingCampId);
                            const parentNgo = organizations.find(o => o.id === currCamp?.organization_id);
                            const ngoRails = extractNgoRails(parentNgo);
                            const activeCampRails = ngoRails.filter(r => editCampAssignedGateways.includes(r.id) || editCampAssignedGateways.includes(r.type));

                            return (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Primary Gateway Rail</label>
                                  <select 
                                    className="form-input" 
                                    value={activeCampRails.some(r => r.type === editCampPrimaryGateway) ? editCampPrimaryGateway : (activeCampRails[0]?.type || 'razorpay')} 
                                    onChange={(e) => setEditCampPrimaryGateway(e.target.value)}
                                  >
                                    {activeCampRails.length > 0 ? (
                                      activeCampRails.map(r => (
                                        <option key={r.type} value={r.type}>{r.name}</option>
                                      ))
                                    ) : (
                                      <option value="razorpay">💳 Razorpay (Default)</option>
                                    )}
                                  </select>
                                </div>
                                <div>
                                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Fallback Gateway Rail</label>
                                  <select 
                                    className="form-input" 
                                    value={editCampFallbackGateway} 
                                    onChange={(e) => setEditCampFallbackGateway(e.target.value)}
                                  >
                                    {activeCampRails.length > 1 ? (
                                      <>
                                        <option value="">None (Single Active Rail)</option>
                                        {activeCampRails.filter(r => r.type !== editCampPrimaryGateway).map(r => (
                                          <option key={r.type} value={r.type}>{r.name}</option>
                                        ))}
                                      </>
                                    ) : (
                                      <option value="">None (Single Gateway Rail)</option>
                                    )}
                                  </select>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="modal-footer">
                          <button type="button" onClick={() => setEditingCampId(null)} className="btn btn-secondary">Cancel</button>
                          <button type="submit" className="btn btn-primary">Save Aligned Rails</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* 5. DEDICATED QUICK APPROVAL & GATEWAY ALIGNMENT MODAL */}
                {approvingCampaign && (
                  <div className="modal-backdrop">
                    <div className="modal-container" style={{ maxWidth: '650px' }}>
                      <div className="modal-header" style={{ background: 'linear-gradient(135deg, #065F46 0%, #047857 100%)', color: '#FFF', borderRadius: '12px 12px 0 0', padding: '18px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.5rem' }}>⚡</span>
                          <div>
                            <h3 style={{ margin: 0, color: '#FFF' }}>Review & Align Gateways on Campaign Approval</h3>
                            <span style={{ fontSize: '0.8rem', color: '#D1FAE5' }}>Campaign: {approvingCampaign.title}</span>
                          </div>
                        </div>
                        <button onClick={() => setApprovingCampaign(null)} style={{ border: 'none', background: 'none', fontSize: '1.6rem', color: '#FFF', cursor: 'pointer' }}>&times;</button>
                      </div>
                      <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        
                        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '14px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.84rem', color: '#065F46', lineHeight: 1.5 }}>
                            Approving this campaign will make it live and connect the selected payment gateway rails configured on parent NGO <strong>{approvingCampaign.orgName || 'WaterAid India'}</strong>.
                          </span>
                        </div>

                        {/* Checkbox Gateway Alignment Card */}
                        <div>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.92rem', color: '#0F172A', fontWeight: 700 }}>
                            Select Assigned Payment Gateway Rails:
                          </h4>
                          
                          {(() => {
                            const parentNgo = organizations.find(o => o.id === approvingCampaign.organization_id);
                            const ngoRails = extractNgoRails(parentNgo);

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {ngoRails.map((rail) => {
                                  const isChecked = approvalAssignedGateways.includes(rail.id) || approvalAssignedGateways.includes(rail.type);
                                  return (
                                    <label 
                                      key={rail.id}
                                      style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between',
                                        padding: '12px 16px', 
                                        background: isChecked ? '#ECFDF5' : '#F8FAFC', 
                                        border: `1.5px solid ${isChecked ? '#10B981' : '#E2E8F0'}`, 
                                        borderRadius: '10px', 
                                        cursor: 'pointer' 
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <input 
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setApprovalAssignedGateways([...approvalAssignedGateways, rail.id]);
                                            } else {
                                              setApprovalAssignedGateways(approvalAssignedGateways.filter(id => id !== rail.id && id !== rail.type));
                                            }
                                          }}
                                          style={{ width: '20px', height: '20px', accentColor: '#059669' }}
                                        />
                                        <div>
                                          <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>{rail.name}</strong>
                                          <span style={{ display: 'block', fontSize: '0.76rem', color: '#64748B' }}>Key Identifier: <code>{rail.keyPreview}</code></span>
                                        </div>
                                      </div>
                                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isChecked ? '#059669' : '#94A3B8' }}>
                                        {isChecked ? '✅ Active for Campaign' : '⚪ Excluded'}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Dynamic Routing Preferences */}
                        {(() => {
                          const parentNgo = organizations.find(o => o.id === approvingCampaign.organization_id);
                          const ngoRails = extractNgoRails(parentNgo);
                          const activeCampaignRails = ngoRails.filter(r => approvalAssignedGateways.includes(r.id) || approvalAssignedGateways.includes(r.type));

                          return (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                              <div>
                                <label className="form-label" style={{ fontSize: '0.78rem' }}>Primary Gateway</label>
                                <select 
                                  className="form-input" 
                                  value={activeCampaignRails.some(r => r.type === approvalPrimaryGateway) ? approvalPrimaryGateway : (activeCampaignRails[0]?.type || 'razorpay')} 
                                  onChange={(e) => setApprovalPrimaryGateway(e.target.value)}
                                >
                                  {activeCampaignRails.length > 0 ? (
                                    activeCampaignRails.map(r => (
                                      <option key={r.type} value={r.type}>{r.name}</option>
                                    ))
                                  ) : (
                                    <option value="razorpay">💳 Razorpay (Default)</option>
                                  )}
                                </select>
                              </div>
                              <div>
                                <label className="form-label" style={{ fontSize: '0.78rem' }}>Fallback Gateway</label>
                                <select 
                                  className="form-input" 
                                  value={approvalFallbackGateway} 
                                  onChange={(e) => setApprovalFallbackGateway(e.target.value)}
                                >
                                  {activeCampaignRails.length > 1 ? (
                                    <>
                                      <option value="">None (Single Active Rail)</option>
                                      {activeCampaignRails.filter(r => r.type !== approvalPrimaryGateway).map(r => (
                                        <option key={r.type} value={r.type}>{r.name}</option>
                                      ))}
                                    </>
                                  ) : (
                                    <option value="">None (Single Gateway Rail)</option>
                                  )}
                                </select>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="modal-footer" style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                        <button type="button" onClick={() => setApprovingCampaign(null)} className="btn btn-secondary">Cancel</button>
                        <button 
                          type="button" 
                          onClick={() => handleApproveCampaign(approvingCampaign.id, approvalAssignedGateways, approvalPrimaryGateway, approvalFallbackGateway, approvalAutoFailover)}
                          className="btn btn-primary"
                          style={{ padding: '10px 24px', fontWeight: 700, background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
                        >
                          ✅ Approve & Activate Campaign with Aligned Gateways
                        </button>
                      </div>
                    </div>
                  </div>
                )}



              </div>
            )}


          </main>
        </div>
      </div>
      )}

      {realtimeNotification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#0F766E',
          color: '#ffffff',
          padding: '16px 24px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid #14B8A6',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ fontSize: '1.25rem' }}>🔔</div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{realtimeNotification}</div>
          <button 
            onClick={() => setRealtimeNotification(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              marginLeft: '8px',
              outline: 'none',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            ✕
          </button>
        </div>
      )}
      {/* App Launcher Modal */}
      {showAppLauncherModal && (
        <div className="modal-backdrop" onClick={() => setShowAppLauncherModal(false)}>
          <div className="modal-container" style={{ maxWidth: '640px', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#059669', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  ☁️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0F172A', fontWeight: 700 }}>Ekhum Nonprofit Cloud App Launcher</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>Quickly switch between CRM objects, engines, and workspaces</p>
                </div>
              </div>
              <button onClick={() => setShowAppLauncherModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { title: 'Contacts CRM', desc: 'Donor 360 & Profiles', icon: '👥', tab: 'contacts' },
                { title: 'Campaigns & Embeds', desc: 'Fundraisers & Gateway APIs', icon: '🎯', tab: 'campaigns' },
                { title: 'Master Ledger', desc: 'Donations & Subscriptions', icon: '💰', tab: 'transactions' },
                { title: 'Communications', desc: 'WhatsApp & Email Threads', icon: '💬', tab: 'communications' },
                { title: 'Journey Builder', desc: 'Automations & Workflows', icon: '⚡', tab: 'journeys' },
                { title: 'Broadcasts Hub', desc: 'Bulk Campaigns & Outreach', icon: '📢', tab: 'broadcasts' },
                { title: '80G & 10BD Tax', desc: 'Statutory Receipts & Filings', icon: '📜', tab: 'compliance' },
                { title: 'Segments & Cohorts', desc: 'Query Builder & Filters', icon: '🎯', tab: 'segments' },
                { title: 'Custom Reports', desc: 'Analytics & Dashboards', icon: '📈', tab: 'reports' },
                { title: 'Object Manager', desc: 'Custom Schema & Rules', icon: '⚙️', tab: 'objectManager' },
                { title: 'WhatsApp & Rails', desc: 'Gateway Credentials Hub', icon: '🔌', tab: 'integrations' },
                { title: 'Settings', desc: 'Permissions & System Config', icon: '🛠️', tab: 'settings' }
              ].map(app => (
                <div
                  key={app.tab}
                  onClick={() => {
                    setShowAppLauncherModal(false);
                    if (userSession?.user?.role === 'superadmin') {
                      navigate('/superadmin');
                      setActiveSuperadminTab(app.tab as any);
                    } else {
                      navigate('/ngo');
                      setActiveNgoTab(app.tab as any);
                    }
                  }}
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#ECFDF5';
                    e.currentTarget.style.borderColor = '#A7F3D0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#F8FAFC';
                    e.currentTarget.style.borderColor = '#E2E8F0';
                  }}
                >
                  <div style={{ fontSize: '1.4rem' }}>{app.icon}</div>
                  <strong style={{ fontSize: '0.85rem', color: '#0F172A' }}>{app.title}</strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{app.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Drawer Modal */}
      {showNotificationsModal && (
        <div className="modal-backdrop" onClick={() => setShowNotificationsModal(false)}>
          <div className="modal-container" style={{ maxWidth: '440px', padding: '20px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#0F172A', fontWeight: 700 }}>🔔 System & Gateway Notifications</h3>
              <button onClick={() => setShowNotificationsModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '10px 12px', borderRadius: '6px', fontSize: '0.80rem' }}>
                <strong style={{ color: '#065F46', display: 'block' }}>🟢 Real-time Gateway Engine Active</strong>
                <span style={{ color: '#047857' }}>Razorpay & Cashfree webhooks listening with automatic 80G sync.</span>
              </div>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px 12px', borderRadius: '6px', fontSize: '0.80rem' }}>
                <strong style={{ color: '#0F172A', display: 'block' }}>💬 Evolution Go WhatsApp Connected</strong>
                <span style={{ color: '#64748B' }}>Omnichannel broadcast and trigger messages ready.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Razorpay Full Donor & Transaction Details Modal */}
      {selectedDonationForModal && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '750px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>💳</span>
                <div>
                  <h3 style={{ margin: 0 }}>Razorpay Complete Donor & Transaction Payload</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Transaction ID: <code>{selectedDonationForModal.gatewayTransactionId || selectedDonationForModal.id}</code>
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedDonationForModal(null)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Donor Profile Section */}
              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  👤 Client Donor Identity & Contact Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Donor Full Name</span>
                    <strong>{selectedDonationForModal.donorName}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Email Address</span>
                    <strong>{selectedDonationForModal.donorEmail}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Verified Phone / Contact Number</span>
                    <strong>{selectedDonationForModal.rawGatewayResponse?.contact || selectedDonationForModal.donorPhone || 'Not provided'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>PAN / Tax ID (80G Compliance)</span>
                    <strong>{selectedDonationForModal.donorTaxId || 'Domestic Individual'}</strong>
                  </div>
                </div>
              </div>

              {/* Razorpay Gateway Payload Breakdown */}
              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📊 Razorpay Payment Metadata & Settlement Specs
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Razorpay Payment ID</span>
                    <code style={{ fontSize: '0.78rem', color: '#2563EB' }}>{selectedDonationForModal.rawGatewayResponse?.id || selectedDonationForModal.gatewayTransactionId || 'pay_test'}</code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Razorpay Order ID</span>
                    <code style={{ fontSize: '0.78rem' }}>{selectedDonationForModal.rawGatewayResponse?.order_id || 'order_test'}</code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Gross Amount Paid</span>
                    <strong style={{ color: '#059669', fontSize: '0.95rem' }}>{selectedDonationForModal.currency} {Number(selectedDonationForModal.amount).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Payment Gateway Method</span>
                    <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', textTransform: 'uppercase' }}>
                      {selectedDonationForModal.rawGatewayResponse?.method || selectedDonationForModal.paymentMethod || 'UPI'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Bank / VPA / Card Ref</span>
                    <strong>
                      {selectedDonationForModal.rawGatewayResponse?.vpa || 
                       selectedDonationForModal.rawGatewayResponse?.bank || 
                       (selectedDonationForModal.rawGatewayResponse?.card ? `${selectedDonationForModal.rawGatewayResponse.card.network} **** ${selectedDonationForModal.rawGatewayResponse.card.last4}` : 'N/A')}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Bank UTR / RRN Reference</span>
                    <code>
                      {selectedDonationForModal.rawGatewayResponse?.cf_payment_id || 
                       selectedDonationForModal.rawGatewayResponse?.bank_reference || 
                       selectedDonationForModal.rawGatewayResponse?.acquirer_data?.rrn || 
                       selectedDonationForModal.rawGatewayResponse?.acquirer_data?.bank_transaction_id || 
                       selectedDonationForModal.rawGatewayResponse?.acquirer_data?.upi_transaction_id || 
                       selectedDonationForModal.rawGatewayResponse?.razorpayPaymentId || 
                       selectedDonationForModal.gatewayTransactionId || 
                       'N/A'}
                    </code>
                  </div>
                </div>
              </div>

              {/* External NGO Landing Page Form Custom Data Payload */}
              {(selectedDonationForModal.custom_form_data || selectedDonationForModal.customFormData) && (
                <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📦 Captured Client Details (External Form Inputs)
                  </h4>
                  <pre style={{ backgroundColor: '#0F172A', color: '#34D399', padding: '12px', borderRadius: '8px', fontSize: '0.78rem', overflowX: 'auto', margin: 0 }}>
                    {JSON.stringify(selectedDonationForModal.custom_form_data || selectedDonationForModal.customFormData, null, 2)}
                  </pre>
                </div>
              )}

              {/* JSON Inspector for Complete Raw Gateway API Response */}
              {(() => {
                const gwName = (selectedDonationForModal.paymentGateway || 'Gateway').toUpperCase();
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}>🛠️ Raw {gwName} API Response Object (JSON)</h4>
                      <button 
                        onClick={() => handleSyncGatewayDetails(selectedDonationForModal.id)} 
                        className="btn btn-secondary" 
                        style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#2563EB', borderColor: '#2563EB' }}
                        disabled={isSyncingGateway}
                      >
                        {isSyncingGateway ? 'Syncing...' : `🔄 Live Fetch from ${gwName} API`}
                      </button>
                    </div>
                    <pre style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', overflowX: 'auto', maxHeight: '220px', border: '1px solid #1E293B', lineHeight: 1.4 }}>
                      {JSON.stringify(selectedDonationForModal.rawGatewayResponse || selectedDonationForModal, null, 2)}
                    </pre>
                  </div>
                );
              })()}
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedDonationForModal(null)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Embed Code & Integration Snippet Modal */}
      {selectedCampForEmbedModal && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '880px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>🔌</span>
                <div>
                  <h3 style={{ margin: 0 }}>External Landing Page API & Embed Integration</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Campaign: <strong>{selectedCampForEmbedModal.title}</strong> (<code>/{selectedCampForEmbedModal.slug}</code>)
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedCampForEmbedModal(null)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            {(() => {
              const parentNgo = organizations.find(o => o.id === selectedCampForEmbedModal.organization_id)
                || (selectedCampForEmbedModal.org_payment_config || selectedCampForEmbedModal.payment_gateways_config ? {
                    id: selectedCampForEmbedModal.organization_id,
                    name: selectedCampForEmbedModal.orgName || (selectedCampForEmbedModal as any).organization_name || 'NGO Partner Organization',
                    legal_name: (selectedCampForEmbedModal as any).organization_legal_name || selectedCampForEmbedModal.orgName || 'NGO Partner Trust',
                    eighty_g_urn: (selectedCampForEmbedModal as any).eighty_g_urn || 'AAATC1234F2180G1',
                    signatory_name: (selectedCampForEmbedModal as any).signatory_name || 'Authorized Signatory',
                    payment_gateways_config: selectedCampForEmbedModal.org_payment_config || selectedCampForEmbedModal.payment_gateways_config
                  } as any : (userSession?.user?.orgName ? {
                    id: userSession.user.orgId,
                    name: userSession.user.orgName,
                    legal_name: userSession.user.orgName,
                    eighty_g_urn: 'AAATC1234F2180G1',
                    signatory_name: 'Authorized Signatory',
                    payment_gateways_config: (selectedCampForEmbedModal as any).payment_gateways_config || {}
                  } as any : undefined));

              const ngoName = parentNgo?.name || 'NGO Partner Organization';
              const ngoLegalName = parentNgo?.legal_name || parentNgo?.name || 'NGO Partner Trust';
              const ngoUrn = parentNgo?.eighty_g_urn || 'AAATC1234F2180G1';
              const ngoSignatory = parentNgo?.signatory_name || 'Authorized Signatory';
              const ngoApiKey = parentNgo?.api_key || (`ek_live_org_${parentNgo?.slug || 'master'}`);

              const ngoRails = extractNgoRails(parentNgo);
              const campAssignedIds = selectedCampForEmbedModal.payment_config?.assigned_gateway_ids || [];
              const alignedRails = campAssignedIds.length > 0
                ? ngoRails.filter(r => campAssignedIds.includes(r.id) || campAssignedIds.includes(r.type))
                : (ngoRails.length > 0 ? ngoRails : []);

              const alignedRailTypes = alignedRails.map(r => r.type);
              const hasCashfree = alignedRailTypes.includes('cashfree');
              const hasRazorpay = alignedRailTypes.includes('razorpay');
              const primaryGw = selectedCampForEmbedModal.payment_config?.primary_gateway || (alignedRails[0]?.type || 'cashfree');
              const primaryRailObj = alignedRails.find(r => r.type === primaryGw) || alignedRails[0] || { type: primaryGw, name: primaryGw.toUpperCase() + ' Rail' };

              const rawFallback = selectedCampForEmbedModal.payment_config?.fallback_gateway;
              const fallbackGw = (rawFallback && alignedRailTypes.includes(rawFallback) && rawFallback !== primaryGw)
                ? rawFallback
                : (alignedRails.find(r => r.type !== primaryGw)?.type || (alignedRailTypes.length > 1 ? alignedRailTypes.find(t => t !== primaryGw) || '' : ''));
              const autoFailover = selectedCampForEmbedModal.payment_config?.enable_auto_failover !== false && Boolean(fallbackGw);
              
              const rzpKeyId = selectedCampForEmbedModal.payment_config?.razorpay_key_id 
                || parentNgo?.payment_gateways_config?.razorpay?.key_id 
                || parentNgo?.payment_gateways_config?.razorpay_key_id 
                || 'rzp_test_51NgA...';
              const cfAppId = parentNgo?.payment_gateways_config?.cashfree?.app_id 
                || parentNgo?.payment_gateways_config?.cashfree_app_id 
                || 'TEST103849...';
              const webhookSecret = `ek_sec_${selectedCampForEmbedModal.slug}`;

              let dynamicSdkTags = '';
              if (hasCashfree || primaryGw === 'cashfree' || fallbackGw === 'cashfree' || alignedRails.length === 0) {
                dynamicSdkTags += '<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>\n';
              }
              if (hasRazorpay || primaryGw === 'razorpay' || fallbackGw === 'razorpay' || alignedRails.length === 0) {
                dynamicSdkTags += '<script src="https://checkout.razorpay.com/v1/checkout.js"></script>\n';
              }
              dynamicSdkTags += `<script src="${getApiBase() || 'http://localhost:5000'}/api/v1/external/embed.js"></script>`;

              const alignedRailNames = alignedRails.map(r => r.name).join(', ') || 'Multi-Gateway Rail';
              const apiKeyVal = selectedCampForEmbedModal.api_key || `ek_live_${selectedCampForEmbedModal.slug}`;

              // Specialized Option 1: Full-Featured JS Embed Tailored for This Specific NGO & Campaign
              const jsEmbedSnippet = `<!-- ========================================================================= -->
<!-- 🏛️ BENEFICIARY NGO: ${ngoName} (${ngoLegalName}) -->
<!-- 🎯 CAMPAIGN: ${selectedCampForEmbedModal.title} (/${selectedCampForEmbedModal.slug}) -->
<!-- 🔑 CAMPAIGN API KEY: ${apiKeyVal} -->
<!-- 🏢 NGO MASTER TOKEN: ${ngoApiKey} -->
<!-- 💳 ALIGNED GATEWAY RAILS: ${alignedRailNames} -->
<!-- ⭐ PRIMARY ROUTE: ${primaryRailObj.name}${fallbackGw ? ` | 🔄 FAILOVER ROUTE: ${fallbackGw.toUpperCase()} Rail` : ''} -->
<!-- 📜 80G REGISTRATION URN: ${ngoUrn} -->
<!-- ========================================================================= -->

<!-- 1. Include Aligned Gateway SDKs & EKhum Specialized Embed -->
${dynamicSdkTags}

<!-- 2. Call EKhum.pay() on your Submit/Donate button click -->
<script>
  function handleDonateSubmit() {
    EKhum.pay({
      // 🔑 Specific Campaign Credentials
      apiKey: "${apiKeyVal}",
      campaignSlug: "${selectedCampForEmbedModal.slug}",
      
      // 💳 Multi-Gateway Smart Failover Engine
      gateway: "${primaryGw}", // Primary Aligned Rail (${primaryRailObj.name})
      ${fallbackGw ? `fallbackGateway: "${fallbackGw}", // Automatic Failover Rail` : `// Single Rail mode (no failover)`}
      enableAutoFailover: ${autoFailover},
      
      // 💰 Donation & Frequency Data Layer
      amount: document.getElementById('donation_amount')?.value || 1000,
      currency: "INR",
      isMonthly: document.getElementById('is_monthly')?.checked || false, // Set true for Recurring Mandates
      
      // 👤 Full Contact KYC Layer (Upserted into ${ngoName}'s CRM)
      title: document.getElementById('donor_title')?.value || "Mr.", // Mr., Mrs., Ms., Dr., etc.
      firstName: document.getElementById('donor_first_name')?.value || "Aarav",
      lastName: document.getElementById('donor_last_name')?.value || "Sharma",
      name: document.getElementById('donor_name')?.value || "Aarav Sharma",
      email: document.getElementById('donor_email')?.value || "aarav.sharma@example.com",
      phone: document.getElementById('donor_phone')?.value || "+919876543210",
      altPhone: document.getElementById('donor_alt_phone')?.value || "",
      taxId: document.getElementById('donor_pan')?.value || "ABCDE1234F", // 10-digit PAN (KYC Uppercased)
      dob: document.getElementById('donor_dob')?.value || "1988-04-15", // YYYY-MM-DD
      gender: document.getElementById('donor_gender')?.value || "Male",
      donorType: "Individual", // 'Individual' | 'Corporate' | 'Trust'
      citizenship: "Indian",
      
      // 📍 Full Address Data Layer (PIN code auto-resolves City & State)
      address: document.getElementById('donor_address')?.value || "Flat 402, Lotus Heights, MG Road",
      street_address_2: document.getElementById('donor_address_line_2')?.value || "Near Metro Station",
      pincode: document.getElementById('donor_pincode')?.value || "400001", // 6-digit Indian PIN
      city: document.getElementById('donor_city')?.value || "Mumbai",
      state: document.getElementById('donor_state')?.value || "Maharashtra",
      country: "India",

      // 📜 Statutory 80G Tax Exemption & Form 10BD Flags (Issued by ${ngoLegalName})
      is80GRequested: true,
      panHolderName: document.getElementById('pan_holder_name')?.value || "Aarav Sharma",
      certificateLanguage: "en",
      isAnonymous: false,

      // 🛡️ DPDP Act Opt-In Consents
      consentEmail: document.getElementById('consent_email')?.checked ?? true,
      consentWhatsapp: document.getElementById('consent_whatsapp')?.checked ?? true,
      consentSms: document.getElementById('consent_sms')?.checked ?? true,
      preferredChannel: "both", // 'email' | 'whatsapp' | 'sms' | 'both'

      // 📣 Marketing Attribution & Campaign Telemetry
      utm_source: new URLSearchParams(window.location.search).get('utm_source') || "google_ads",
      utm_medium: new URLSearchParams(window.location.search).get('utm_medium') || "cpc",
      utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') || "${selectedCampForEmbedModal.slug}",
      fundraiser_id: new URLSearchParams(window.location.search).get('fundraiser_id') || undefined,
      volunteer_code: new URLSearchParams(window.location.search).get('vol_code') || undefined,

      // 💬 Donor Comments & Tailored Campaign Custom Fields
      comments: document.getElementById('donor_comments')?.value || "Donation in support of ${selectedCampForEmbedModal.title} for ${ngoName}",
      customFormData: {
        campaign_title: "${selectedCampForEmbedModal.title}",
        ngo_beneficiary: "${ngoName}",
        tshirt_size: document.getElementById('tshirt_size')?.value || "L",
        source_landing_page: window.location.href,
        referrer: document.referrer
      },

      // Callbacks
      onSuccess: function(res) {
        console.log("EKhum Donation Success for ${selectedCampForEmbedModal.title}:", res);
        alert("🎉 Thank you for supporting ${ngoName}!\\n\\n80G Tax Receipt Number: " + res.receiptNumber + "\\nIssued under Statutory 80G URN: ${ngoUrn}");
      },
      onError: function(err) {
        console.error("EKhum Donation Error:", err);
        alert("Donation to ${selectedCampForEmbedModal.title} Failed: " + (err.error || err.message || "Transaction cancelled"));
      }
    });
  }
</script>`;

              // Specialized Option 2: 1-Liner Auto-Bind Snippet Tailored for This Campaign
              const autoBindSnippet = `<!-- 1. Include Universal EKhum Embed SDK -->
<script src="${getApiBase() || 'http://localhost:5000'}/api/v1/external/embed.js"></script>

<!-- 2. Auto-bind your HTML form directly to ${selectedCampForEmbedModal.title} (${ngoName}) -->
<script>
  document.addEventListener('DOMContentLoaded', function() {
    EKhum.autoBind('#donation-form', {
      apiKey: "${apiKeyVal}",
      campaignSlug: "${selectedCampForEmbedModal.slug}",
      gateway: "${primaryGw}",
      ${fallbackGw ? `fallbackGateway: "${fallbackGw}",` : ''}
      enableAutoFailover: ${autoFailover},
      onSuccess: function(res) {
        alert("Thank you for supporting ${ngoName}!\\n80G Receipt Number: " + res.receiptNumber);
      },
      onError: function(err) {
        alert("Donation Error: " + (err.error || err.message));
      }
    });
  });
</script>`;

              // Specialized Option 3: Full REST API Spec Tailored for This Campaign
              const restApiSnippet = `POST ${getApiBase() || 'http://localhost:5000'}/api/v1/external/donations/initiate
Headers:
  x-ekhum-api-key: "${apiKeyVal}"
  Content-Type: application/json

Body:
{
  "api_key": "${apiKeyVal}",
  "campaignSlug": "${selectedCampForEmbedModal.slug}",
  "amount": 2500,
  "currency": "INR",
  "gateway": "${primaryGw}",
  ${fallbackGw ? `"fallback_gateway": "${fallbackGw}",` : ''}
  "enable_auto_failover": ${autoFailover},
  
  // Frequency & Mandates
  "payment_type": "one_time", // 'one_time' | 'monthly_donation'
  "is_monthly": false,

  // Full Contact KYC (Stored in ${ngoName}'s Database)
  "title": "Mr.",
  "first_name": "Aarav",
  "last_name": "Sharma",
  "name": "Aarav Sharma",
  "email": "aarav.sharma@example.com",
  "phone": "+919876543210",
  "alt_phone": "+919876543211",
  "taxId": "ABCDE1234F",
  "birthdate": "1988-04-15",
  "gender": "Male",
  "donor_type": "Individual",
  "citizenship": "Indian",

  // Full Postal Address
  "street_address_1": "Flat 402, Lotus Heights, MG Road",
  "street_address_2": "Near Metro Station",
  "city": "Mumbai",
  "state": "Maharashtra",
  "zip_code": "400001",
  "country": "India",

  // Statutory 80G & Form 10BD Compliance (Issued by ${ngoLegalName})
  "is_80g_requested": true,
  "pan_holder_name": "Aarav Sharma",
  "certificate_language": "en",
  "isAnonymous": false,

  // DPDP Act Opt-In Consents
  "consent_email": true,
  "consent_whatsapp": true,
  "consent_sms": true,
  "preferred_channel": "both",
  "preferred_language": "en",

  // Marketing Attribution & Data Layer
  "utm_source": "google_ads",
  "utm_medium": "cpc",
  "utm_campaign": "${selectedCampForEmbedModal.slug}",
  "fundraiser_id": "fund_908123",
  "volunteer_code": "VOL-MUM-44",
  "referrer": "https://google.com",
  "landing_page_url": "${selectedCampForEmbedModal.landing_page_url || 'https://ngo-partner.org/donate'}",

  // Staff Notes & Beneficiary Context
  "comments": "Donating towards ${selectedCampForEmbedModal.title} for ${ngoName}",
  "customFormData": {
    "beneficiary_ngo": "${ngoName}",
    "campaign_title": "${selectedCampForEmbedModal.title}",
    "referred_by": "Alumni Network",
    "tshirt_size": "XL"
  }
}`;

              const checkoutUrl = `${window.location.origin}/checkout?campaign=${selectedCampForEmbedModal.slug}`;

              const handleCopy = (text: string, key: string) => {
                navigator.clipboard.writeText(text);
                setCopiedEmbedKey(key);
                setTimeout(() => setCopiedEmbedKey(null), 2500);
              };

              const handleRunSandboxTest = () => {
                setSandboxRunning(true);
                setSandboxErrorResult(null);
                setSandboxSuccessResult(null);

                const executePay = () => {
                  const activeEk = (window as any).EKhum || (window as any).DanaPro;
                  if (!activeEk || typeof activeEk.pay !== 'function') {
                    setSandboxRunning(false);
                    setSandboxErrorResult('EKhum Embed SDK is initializing. Please click again in a second.');
                    return;
                  }

                  try {
                    activeEk.pay({
                      apiKey: apiKeyVal,
                      campaignSlug: selectedCampForEmbedModal.slug,
                      amount: Number(sandboxAmount) || 100,
                      currency: 'INR',
                      isMonthly: sandboxIsMonthly,
                      gateway: sandboxGateway === 'auto' ? primaryGw : sandboxGateway,
                      fallbackGateway: fallbackGw || undefined,
                      enableAutoFailover: autoFailover,
                      title: 'Mr.',
                      firstName: sandboxDonorName.split(' ')[0] || 'Aarav',
                      lastName: sandboxDonorName.split(' ').slice(1).join(' ') || 'Sharma',
                      name: sandboxDonorName,
                      email: sandboxDonorEmail,
                      phone: sandboxDonorPhone,
                      taxId: sandboxDonorPan,
                      is80GRequested: true,
                      comments: `Test Sandbox payment for ${selectedCampForEmbedModal.title}`,
                      customFormData: {
                        is_sandbox_test: true,
                        campaign_title: selectedCampForEmbedModal.title,
                        ngo_beneficiary: ngoName
                      },
                      onSuccess: function(res: any) {
                        setSandboxRunning(false);
                        setSandboxSuccessResult(res);
                        // Refresh active campaigns and metrics
                        fetchCampaigns();
                        fetchStats();
                      },
                      onError: function(err: any) {
                        setSandboxRunning(false);
                        setSandboxErrorResult(err.error || err.message || 'Payment was cancelled or failed.');
                      }
                    });
                  } catch (e: any) {
                    setSandboxRunning(false);
                    setSandboxErrorResult(e.message || 'Execution error');
                  }
                };

                const ek = (window as any).EKhum || (window as any).DanaPro;
                if (!ek || typeof ek.pay !== 'function') {
                  const script = document.createElement('script');
                  script.src = `${getApiBase() || 'http://localhost:5000'}/api/v1/external/embed.js`;
                  script.onload = () => executePay();
                  script.onerror = () => {
                    setSandboxRunning(false);
                    setSandboxErrorResult('Unable to reach backend embed.js server.');
                  };
                  document.body.appendChild(script);
                } else {
                  executePay();
                }
              };

              return (
                <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Credentials & Gateway Alignment Box Specialized for NGO & Campaign */}
                  <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.90rem', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🔑</span> EKhum API Key & Gateway Rails for {selectedCampForEmbedModal.title}
                      </h4>
                      <button 
                        onClick={() => handleCopy(apiKeyVal, 'api_key')}
                        className="btn btn-secondary" 
                        style={{ padding: '2px 8px', fontSize: '0.72rem', background: copiedEmbedKey === 'api_key' ? '#DCFCE7' : '#FFFFFF', color: copiedEmbedKey === 'api_key' ? '#166534' : '#1E40AF' }}
                      >
                        {copiedEmbedKey === 'api_key' ? '✅ Copied Key!' : '📋 Copy API Key'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.80rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#1E3A8A', fontWeight: 600 }}>Beneficiary NGO: </span>
                        <strong style={{ color: '#0F172A' }}>{ngoName}</strong>
                        <span style={{ color: '#64748B', fontSize: '0.75rem' }}>({ngoLegalName} — 80G URN: <code>{ngoUrn}</code>)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#1E3A8A', fontWeight: 600 }}>Campaign API Key: </span>
                        <code style={{ fontSize: '0.82rem', color: '#2563EB', background: '#DBEAFE', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          {apiKeyVal}
                        </code>
                      </div>
                      <div>
                        <span style={{ color: '#1E3A8A', fontWeight: 600 }}>Allowed Origin / Domain: </span>
                        <code>{selectedCampForEmbedModal.landing_page_url || 'Universal (accepts requests from any domain)'}</code>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                        <span style={{ color: '#1E3A8A', fontWeight: 600 }}>Aligned Gateway Rails: </span>
                        {alignedRails.length > 0 ? (
                          alignedRails.map(rail => (
                            <span key={rail.id} style={{ fontSize: '0.74rem', background: '#DBEAFE', color: '#1E40AF', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              {rail.type === 'cashfree' ? '⚡' : rail.type === 'razorpay' ? '💳' : rail.type === 'payu' ? '🔴' : rail.type === 'ccavenue' ? '🏛️' : '🏦'} {rail.name}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Platform Default</span>
                        )}
                        <span style={{ fontSize: '0.74rem', background: '#ECFDF5', color: '#065F46', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, border: '1px solid #A7F3D0' }}>
                          ⭐ Primary: {primaryRailObj.name}
                        </span>
                        {fallbackGw ? (
                          <span style={{ fontSize: '0.74rem', background: '#FFFBEB', color: '#92400E', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, border: '1px solid #FDE68A' }}>
                            🔄 Failover: {fallbackGw.toUpperCase()} Rail
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Top Tab Switcher */}
                  <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', overflowX: 'auto' }}>
                    <button 
                      onClick={() => setEmbedModalTab('js_embed')}
                      className={`btn ${embedModalTab === 'js_embed' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.78rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                    >
                      ⚡ 1. Campaign Specialized JS Embed
                    </button>
                    <button 
                      onClick={() => setEmbedModalTab('auto_bind')}
                      className={`btn ${embedModalTab === 'auto_bind' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.78rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                    >
                      🤖 2. Auto-Bind 1-Liner
                    </button>
                    <button 
                      onClick={() => setEmbedModalTab('rest_api')}
                      className={`btn ${embedModalTab === 'rest_api' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.78rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                    >
                      📡 3. REST API Spec
                    </button>
                    <button 
                      onClick={() => setEmbedModalTab('tokens')}
                      className={`btn ${embedModalTab === 'tokens' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.78rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                    >
                      🔑 4. Tokens & Gateway Credentials
                    </button>
                    <button 
                      onClick={() => setEmbedModalTab('data_layer')}
                      className={`btn ${embedModalTab === 'data_layer' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.78rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                    >
                      📊 5. CRM Data Layer
                    </button>
                    <button 
                      onClick={() => setEmbedModalTab('sandbox')}
                      className={`btn ${embedModalTab === 'sandbox' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.78rem', padding: '6px 12px', whiteSpace: 'nowrap', backgroundColor: embedModalTab === 'sandbox' ? '#059669' : undefined, color: embedModalTab === 'sandbox' ? '#FFFFFF' : undefined, fontWeight: 700 }}
                    >
                      🧪 6. Live Payment Tester (Sandbox)
                    </button>
                    {userSession?.user?.role === 'superadmin' && (
                      <button 
                        onClick={() => setEmbedModalTab('checkout')}
                        className={`btn ${embedModalTab === 'checkout' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.78rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                      >
                        🔗 7. Hosted Link
                      </button>
                    )}
                  </div>

                  {/* TAB 1: FULL JS EMBED (SPECIALIZED) */}
                  {embedModalTab === 'js_embed' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--primary)' }}>⚡ Specialized JavaScript Embed for {selectedCampForEmbedModal.title}</h4>
                          <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            Customized for <strong>{ngoName}</strong> with primary rail <strong>{primaryRailObj.name}</strong>{fallbackGw ? `, fallback ${fallbackGw.toUpperCase()}` : ''}, and full Contact CRM attributes.
                          </p>
                        </div>
                        <button 
                          onClick={() => handleCopy(jsEmbedSnippet, 'js_embed')}
                          className="btn btn-secondary" 
                          style={{ padding: '3px 10px', fontSize: '0.74rem', background: copiedEmbedKey === 'js_embed' ? '#DCFCE7' : '#F1F5F9', color: copiedEmbedKey === 'js_embed' ? '#166534' : '#0F172A', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                          {copiedEmbedKey === 'js_embed' ? '✅ Copied Embed Code!' : '📋 Copy JS Snippet'}
                        </button>
                      </div>
                      <pre style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: '0.76rem', overflowX: 'auto', margin: 0, lineHeight: 1.45, maxHeight: '380px' }}>
{jsEmbedSnippet}
                      </pre>
                    </div>
                  )}

                  {/* TAB 2: AUTO-BIND 1-LINER */}
                  {embedModalTab === 'auto_bind' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--primary)' }}>🤖 1-Line Zero-Code Form Auto-Bind for {selectedCampForEmbedModal.title}</h4>
                          <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            Instantly connects any HTML form to {ngoName}'s account. Automatically maps inputs, GTM dataLayer, and executes smart failover.
                          </p>
                        </div>
                        <button 
                          onClick={() => handleCopy(autoBindSnippet, 'auto_bind')}
                          className="btn btn-secondary" 
                          style={{ padding: '3px 10px', fontSize: '0.74rem', background: copiedEmbedKey === 'auto_bind' ? '#DCFCE7' : '#F1F5F9', color: copiedEmbedKey === 'auto_bind' ? '#166534' : '#0F172A', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                          {copiedEmbedKey === 'auto_bind' ? '✅ Copied Auto-Bind!' : '📋 Copy Auto-Bind Snippet'}
                        </button>
                      </div>
                      <pre style={{ backgroundColor: '#0F172A', color: '#FCD34D', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: '0.76rem', overflowX: 'auto', margin: 0, lineHeight: 1.45 }}>
{autoBindSnippet}
                      </pre>
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: '#334155' }}>
                        <strong>💡 How `EKhum.autoBind` Operates:</strong>
                        <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px' }}>
                          <li>Scans inputs with standard IDs: <code>amount</code>, <code>name</code>, <code>email</code>, <code>phone</code>, <code>pan</code>, <code>address</code>, <code>pincode</code>, <code>city</code>, <code>state</code>, <code>dob</code>.</li>
                          <li>Auto-resolves Indian PIN codes to City/State without needing extra API calls.</li>
                          <li>Routes payments dynamically through <strong>{primaryRailObj.name}</strong>{fallbackGw ? ` with auto-failover to ${fallbackGw.toUpperCase()}` : ''}.</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: REST API SPEC */}
                  {embedModalTab === 'rest_api' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--primary)' }}>📡 REST API Endpoint (`POST /api/v1/external/donations/initiate`)</h4>
                          <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            Server-to-server payload pre-configured with <strong>{apiKeyVal}</strong> and <strong>{ngoName}</strong> CRM routing.
                          </p>
                        </div>
                        <button 
                          onClick={() => handleCopy(restApiSnippet, 'rest_api')}
                          className="btn btn-secondary" 
                          style={{ padding: '3px 10px', fontSize: '0.74rem', background: copiedEmbedKey === 'rest_api' ? '#DCFCE7' : '#F1F5F9', color: copiedEmbedKey === 'rest_api' ? '#166534' : '#0F172A', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                          {copiedEmbedKey === 'rest_api' ? '✅ Copied API Payload!' : '📋 Copy REST Spec'}
                        </button>
                      </div>
                      <pre style={{ backgroundColor: '#0F172A', color: '#34D399', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: '0.76rem', overflowX: 'auto', margin: 0, lineHeight: 1.45, maxHeight: '380px' }}>
{restApiSnippet}
                      </pre>
                    </div>
                  )}

                  {/* TAB 4: TOKENS & GATEWAY CREDENTIALS INSPECTOR */}
                  {embedModalTab === 'tokens' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.80rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.90rem', color: 'var(--primary)' }}>🔑 Connecting Keys, Tokens & Gateway Credentials</h4>
                          <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            Active credentials, API tokens, and gateway keys bound to this campaign and {ngoName}.
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                        {/* Campaign Key Card */}
                        <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Campaign API Key</span>
                          <code style={{ fontSize: '0.80rem', color: '#059669', background: '#ECFDF5', padding: '2px 6px', borderRadius: '4px', border: '1px solid #A7F3D0', wordBreak: 'break-all', display: 'block', marginBottom: '6px' }}>
                            {apiKeyVal}
                          </code>
                          <button 
                            onClick={() => handleCopy(apiKeyVal, 'tok_camp_key')}
                            style={{ background: 'white', border: '1px solid #CBD5E1', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                          >
                            {copiedEmbedKey === 'tok_camp_key' ? '✅ Copied' : '📋 Copy'}
                          </button>
                        </div>

                        {/* NGO Master Key Card */}
                        <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>NGO Master API Token</span>
                          <code style={{ fontSize: '0.80rem', color: '#2563EB', background: '#EFF6FF', padding: '2px 6px', borderRadius: '4px', border: '1px solid #BFDBFE', wordBreak: 'break-all', display: 'block', marginBottom: '6px' }}>
                            {ngoApiKey}
                          </code>
                          <button 
                            onClick={() => handleCopy(ngoApiKey, 'tok_ngo_key')}
                            style={{ background: 'white', border: '1px solid #CBD5E1', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                          >
                            {copiedEmbedKey === 'tok_ngo_key' ? '✅ Copied' : '📋 Copy'}
                          </button>
                        </div>

                        {/* Webhook Secret Card */}
                        <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Webhook Secret Signature</span>
                          <code style={{ fontSize: '0.80rem', color: '#7C3AED', background: '#F5F3FF', padding: '2px 6px', borderRadius: '4px', border: '1px solid #DDD6FE', wordBreak: 'break-all', display: 'block', marginBottom: '6px' }}>
                            {webhookSecret}
                          </code>
                          <button 
                            onClick={() => handleCopy(webhookSecret, 'tok_wh_sec')}
                            style={{ background: 'white', border: '1px solid #CBD5E1', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                          >
                            {copiedEmbedKey === 'tok_wh_sec' ? '✅ Copied' : '📋 Copy'}
                          </button>
                        </div>

                        {/* 80G Statutory URN */}
                        <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>80G Registration URN</span>
                          <code style={{ fontSize: '0.80rem', color: '#D97706', background: '#FFFBEB', padding: '2px 6px', borderRadius: '4px', border: '1px solid #FDE68A', wordBreak: 'break-all', display: 'block', marginBottom: '6px' }}>
                            {ngoUrn}
                          </code>
                          <span style={{ fontSize: '0.72rem', color: '#475569' }}>Signatory: {ngoSignatory}</span>
                        </div>

                        {/* Primary Payment Rail Credentials */}
                        <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>⭐ Primary Gateway ({primaryGw.toUpperCase()})</span>
                          <div style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 600, marginBottom: '2px' }}>
                            {primaryGw === 'razorpay' ? 'Razorpay Key ID:' : 'Cashfree App ID:'}
                          </div>
                          <code style={{ fontSize: '0.78rem', color: '#0284C7', background: '#E0F2FE', padding: '2px 6px', borderRadius: '4px', display: 'block', marginBottom: '4px' }}>
                            {primaryGw === 'razorpay' ? rzpKeyId : cfAppId}
                          </code>
                          <span style={{ fontSize: '0.70rem', color: '#059669', fontWeight: 600 }}>🟢 Active & Bound to Campaign</span>
                        </div>

                        {/* Failover Payment Rail Credentials */}
                        {fallbackGw && (
                          <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <span style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>🔄 Auto-Failover Rail ({fallbackGw.toUpperCase()})</span>
                            <div style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 600, marginBottom: '2px' }}>
                              {fallbackGw === 'cashfree' ? 'Cashfree Fallback App ID:' : 'Razorpay Fallback Key ID:'}
                            </div>
                            <code style={{ fontSize: '0.78rem', color: '#D97706', background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px', display: 'block', marginBottom: '4px' }}>
                              {fallbackGw === 'cashfree' ? cfAppId : rzpKeyId}
                            </code>
                            <span style={{ fontSize: '0.70rem', color: '#D97706', fontWeight: 600 }}>⚡ Hot-Standby Failover Ready</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: DATA LAYER DICTIONARY */}
                  {embedModalTab === 'data_layer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.78rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--primary)' }}>📊 Supported Contact CRM & Data Layer Attributes for {ngoName}</h4>
                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        All fields passed via <code>EKhum.pay()</code>, <code>EKhum.autoBind()</code>, or the REST API are automatically mapped and stored across our Contact CRM, Giving Rollups, 80G Receipts, and Journeys.
                      </p>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', border: '1px solid var(--border)' }}>
                          <thead>
                            <tr style={{ background: '#F1F5F9', borderBottom: '2px solid var(--border)' }}>
                              <th style={{ padding: '8px', fontWeight: 700 }}>Category</th>
                              <th style={{ padding: '8px', fontWeight: 700 }}>Parameter Keys</th>
                              <th style={{ padding: '8px', fontWeight: 700 }}>Type</th>
                              <th style={{ padding: '8px', fontWeight: 700 }}>Description & CRM Mapping</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px', fontWeight: 600, color: '#1E40AF' }}>Contact Identity</td>
                              <td style={{ padding: '8px' }}><code>title, firstName, lastName, name, email, phone, altPhone, dob, gender, donorType, citizenship</code></td>
                              <td style={{ padding: '8px' }}><code>String</code></td>
                              <td style={{ padding: '8px' }}>Upserts Contact Profile in <code>donors</code> table. Sets title, birthdate, donor category.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
                              <td style={{ padding: '8px', fontWeight: 600, color: '#047857' }}>Full Address & PIN</td>
                              <td style={{ padding: '8px' }}><code>address, street_address_2, pincode, city, state, country</code></td>
                              <td style={{ padding: '8px' }}><code>String</code></td>
                              <td style={{ padding: '8px' }}>6-digit Indian PIN code auto-resolves City and State if omitted. Stored in Contact Address & 80G Snapshots.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px', fontWeight: 600, color: '#B45309' }}>80G & Form 10BD</td>
                              <td style={{ padding: '8px' }}><code>taxId (PAN), is80GRequested, panHolderName, certificateLanguage, isAnonymous</code></td>
                              <td style={{ padding: '8px' }}><code>String / Boolean</code></td>
                              <td style={{ padding: '8px' }}>Auto-generates statutory 80G receipt, validates 10-digit PAN KYC uppercase, and populates Annual Form 10BD Return.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
                              <td style={{ padding: '8px', fontWeight: 600, color: '#7C3AED' }}>DPDP Opt-Ins</td>
                              <td style={{ padding: '8px' }}><code>consentEmail, consentWhatsapp, consentSms, preferredChannel, preferredLanguage</code></td>
                              <td style={{ padding: '8px' }}><code>Boolean / String</code></td>
                              <td style={{ padding: '8px' }}>Records statutory opt-in permissions into <code>consents</code> table for Email, WhatsApp, and SMS communications.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px', fontWeight: 600, color: '#DB2777' }}>Attribution & UTM</td>
                              <td style={{ padding: '8px' }}><code>utm_source, utm_medium, utm_campaign, utm_content, utm_term, fundraiser_id, volunteer_code, referral_code</code></td>
                              <td style={{ padding: '8px' }}><code>String</code></td>
                              <td style={{ padding: '8px' }}>Tracks source campaign attribution, agency/volunteer performance, and triggers journey auto-enrollments.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
                              <td style={{ padding: '8px', fontWeight: 600, color: '#0284C7' }}>Recurring Mandates</td>
                              <td style={{ padding: '8px' }}><code>isMonthly, interval ("monthly" | "one_time"), payment_type</code></td>
                              <td style={{ padding: '8px' }}><code>Boolean / String</code></td>
                              <td style={{ padding: '8px' }}>Creates recurring monthly mandate subscription record in <code>subscriptions</code> table.</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '8px', fontWeight: 600, color: '#475569' }}>Custom Data & Notes</td>
                              <td style={{ padding: '8px' }}><code>comments, notes, customFormData (JSON Object), dataLayer (GTM)</code></td>
                              <td style={{ padding: '8px' }}><code>Object / String</code></td>
                              <td style={{ padding: '8px' }}>Comments automatically insert into <code>contact_notes</code> and appear in Activity Timeline. Custom JSON saved in donation record.</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 6: LIVE PAYMENT TESTER (SANDBOX) */}
                  {embedModalTab === 'sandbox' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem' }}>
                      <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '14px 18px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '1.2rem' }}>🧪</span>
                          <h4 style={{ margin: 0, color: '#065F46', fontSize: '0.95rem', fontWeight: 700 }}>
                            Live Payment Sandbox Tester for {selectedCampForEmbedModal.title}
                          </h4>
                        </div>
                        <p style={{ margin: 0, color: '#047857', fontSize: '0.80rem', lineHeight: '1.45' }}>
                          Test the full end-to-end integration by making a simulated donation. This executes the live <code>EKhum.pay()</code> function in your browser, opens the configured payment gateway popup, issues an 80G Tax Receipt, and automatically creates a new contact record in the <strong>Contact CRM</strong>.
                        </p>
                      </div>

                      {/* Success Alert Banner */}
                      {sandboxSuccessResult && (
                        <div style={{ background: '#F0FDF4', border: '1.5px solid #22C55E', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.4rem' }}>🎉</span>
                            <div>
                              <strong style={{ color: '#15803D', fontSize: '0.95rem' }}>Payment & CRM Verification Successful!</strong>
                              <div style={{ color: '#166534', fontSize: '0.80rem' }}>
                                Donation received for <strong>{selectedCampForEmbedModal.title}</strong> ({ngoName})
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #DCFCE7', fontSize: '0.78rem' }}>
                            <div>
                              <span style={{ color: '#64748B', display: 'block' }}>80G Receipt Number</span>
                              <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{sandboxSuccessResult.receiptNumber || 'REC-VERIFIED'}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#64748B', display: 'block' }}>Gateway Used</span>
                              <strong style={{ color: '#0284C7' }}>{(sandboxSuccessResult.gateway || primaryGw).toUpperCase()}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#64748B', display: 'block' }}>Donor Contact Synced</span>
                              <strong style={{ color: '#059669' }}>{sandboxDonorName} ({sandboxDonorEmail})</strong>
                            </div>
                            <div>
                              <span style={{ color: '#64748B', display: 'block' }}>Amount</span>
                              <strong style={{ color: '#0F172A' }}>₹{sandboxAmount}</strong>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button 
                              onClick={() => {
                                setSelectedCampForEmbedModal(null);
                                setActiveTab('contacts');
                              }}
                              style={{ background: '#16A34A', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '0.80rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                              👥 View Contact in Contact CRM →
                            </button>
                            <button 
                              onClick={() => setSandboxSuccessResult(null)}
                              style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', padding: '6px 12px', borderRadius: '6px', fontSize: '0.80rem', cursor: 'pointer' }}
                            >
                              Reset Sandbox
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Error Alert Banner */}
                      {sandboxErrorResult && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #F87171', padding: '12px 16px', borderRadius: '8px', color: '#991B1B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>❌ Payment Test Notice:</strong> {sandboxErrorResult}
                          </div>
                          <button 
                            onClick={() => setSandboxErrorResult(null)}
                            style={{ background: 'transparent', border: 'none', color: '#991B1B', fontWeight: 700, cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Interactive Test Form */}
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '18px', borderRadius: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                          {/* Amount */}
                          <div>
                            <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px', fontSize: '0.80rem' }}>
                              Test Amount (INR ₹)
                            </label>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                              {[10, 100, 500, 1000].map(amt => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setSandboxAmount(amt)}
                                  style={{
                                    flex: 1,
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    border: sandboxAmount === amt ? '1.5px solid #059669' : '1px solid #CBD5E1',
                                    background: sandboxAmount === amt ? '#ECFDF5' : 'white',
                                    color: sandboxAmount === amt ? '#065F46' : '#475569',
                                    fontWeight: sandboxAmount === amt ? 700 : 500,
                                    fontSize: '0.75rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  ₹{amt}
                                </button>
                              ))}
                            </div>
                            <input 
                              type="number"
                              value={sandboxAmount}
                              onChange={(e) => setSandboxAmount(Number(e.target.value))}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                            />
                          </div>

                          {/* Gateway Route */}
                          <div>
                            <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px', fontSize: '0.80rem' }}>
                              Payment Route / Gateway
                            </label>
                            <select
                              value={sandboxGateway}
                              onChange={(e) => setSandboxGateway(e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem', background: 'white' }}
                            >
                              <option value="auto">⭐ Auto-Route (Primary: {primaryGw.toUpperCase()})</option>
                              {hasRazorpay && <option value="razorpay">💳 Razorpay Gateway Rail</option>}
                              {hasCashfree && <option value="cashfree">⚡ Cashfree UPI Intent Rail</option>}
                            </select>
                          </div>

                          {/* Donor Name */}
                          <div>
                            <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px', fontSize: '0.80rem' }}>
                              Donor Full Name
                            </label>
                            <input 
                              type="text"
                              value={sandboxDonorName}
                              onChange={(e) => setSandboxDonorName(e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                            />
                          </div>

                          {/* Donor Email */}
                          <div>
                            <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px', fontSize: '0.80rem' }}>
                              Donor Email Address
                            </label>
                            <input 
                              type="email"
                              value={sandboxDonorEmail}
                              onChange={(e) => setSandboxDonorEmail(e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                            />
                          </div>

                          {/* Donor Phone */}
                          <div>
                            <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px', fontSize: '0.80rem' }}>
                              Mobile / Phone Number
                            </label>
                            <input 
                              type="tel"
                              value={sandboxDonorPhone}
                              onChange={(e) => setSandboxDonorPhone(e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                            />
                          </div>

                          {/* Donor PAN */}
                          <div>
                            <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px', fontSize: '0.80rem' }}>
                              Indian PAN (80G Tax Exemption)
                            </label>
                            <input 
                              type="text"
                              value={sandboxDonorPan}
                              onChange={(e) => setSandboxDonorPan(e.target.value.toUpperCase())}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem', textTransform: 'uppercase' }}
                            />
                          </div>
                        </div>

                        {/* Frequency Option */}
                        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="checkbox" 
                            id="sandbox_is_monthly"
                            checked={sandboxIsMonthly}
                            onChange={(e) => setSandboxIsMonthly(e.target.checked)}
                          />
                          <label htmlFor="sandbox_is_monthly" style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 600, cursor: 'pointer' }}>
                            Simulate Monthly Recurring Mandate
                          </label>
                        </div>

                        {/* Test Payment Trigger Button */}
                        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={handleRunSandboxTest}
                            disabled={sandboxRunning}
                            style={{
                              background: sandboxRunning ? '#94A3B8' : '#059669',
                              color: 'white',
                              border: 'none',
                              padding: '12px 24px',
                              borderRadius: '8px',
                              fontSize: '0.90rem',
                              fontWeight: 700,
                              cursor: sandboxRunning ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
                            }}
                          >
                            <span>{sandboxRunning ? '⏳ Launching Gateway...' : '🚀 Launch EKhum.pay() Test Payment'}</span>
                          </button>

                          <a
                            href={checkoutUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: '#2563EB',
                              textDecoration: 'none',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            Or test on Hosted Checkout Page ↗
                          </a>
                        </div>
                      </div>

                      {/* Testing Help & Sandbox Credentials */}
                      <div style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '14px', borderRadius: '8px', fontSize: '0.78rem' }}>
                        <strong style={{ color: '#0F172A', display: 'block', marginBottom: '6px' }}>
                          💡 How to complete payments in Test / Sandbox Mode:
                        </strong>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                          <div>
                            <span style={{ fontWeight: 700, color: '#1E40AF' }}>💳 Razorpay Test Mode:</span>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px', color: '#475569' }}>
                              <li>Card: <code>4111 1111 1111 1111</code> (Exp: Any future date, CVV: <code>123</code>)</li>
                              <li>UPI: Select UPI and enter any test ID (e.g. <code>success@razorpay</code>) or click "Success" in popup.</li>
                            </ul>
                          </div>
                          <div>
                            <span style={{ fontWeight: 700, color: '#065F46' }}>⚡ Cashfree Sandbox Mode:</span>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px', color: '#475569' }}>
                              <li>UPI: Select UPI Intent / QR or enter <code>testsuccess@gocash</code></li>
                              <li>Card: Click "Simulate Success" inside the modal test window.</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 7: HOSTED LINK */}
                  {embedModalTab === 'checkout' && userSession?.user?.role === 'superadmin' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '0.88rem', color: 'var(--primary)' }}>🔗 Direct Hosted Payment Checkout URL</h4>
                      <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        Share this direct URL with donors to donate immediately to <strong>{selectedCampForEmbedModal.title}</strong> ({ngoName}).
                      </p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <input 
                          type="text" 
                          readOnly 
                          value={checkoutUrl} 
                          className="form-input" 
                          style={{ background: '#F8FAFC', color: '#0F172A', fontWeight: 600 }}
                        />
                        <button 
                          onClick={() => handleCopy(checkoutUrl, 'checkout_url')}
                          className="btn btn-secondary" 
                          style={{ whiteSpace: 'nowrap', padding: '8px 12px', fontSize: '0.78rem' }}
                        >
                          {copiedEmbedKey === 'checkout_url' ? '✅ Copied!' : '📋 Copy Link'}
                        </button>
                        <a 
                          href={`/checkout?campaign=${selectedCampForEmbedModal.slug}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="btn btn-primary"
                          style={{ whiteSpace: 'nowrap', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          Open Checkout ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedCampForEmbedModal(null)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
