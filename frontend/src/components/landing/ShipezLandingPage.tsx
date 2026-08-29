import React, { useState, useEffect } from 'react';

interface ShipezLandingPageProps {
  onOpenNgoLogin: () => void;
  onOpenAdminLogin: () => void;
  onOpenCheckoutDemo: () => void;
}

export const ShipezLandingPage: React.FC<ShipezLandingPageProps> = ({
  onOpenNgoLogin,
  onOpenAdminLogin,
  onOpenCheckoutDemo,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'embed' | 'api' | 'checkout'>('embed');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [liveSimStep, setLiveSimStep] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCopy = (text: string, tab: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(tab);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const runSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setLiveSimStep(1);
    setTimeout(() => setLiveSimStep(2), 1200);
    setTimeout(() => setLiveSimStep(3), 2400);
    setTimeout(() => setLiveSimStep(4), 3600);
    setTimeout(() => {
      setIsSimulating(false);
    }, 5000);
  };

  const jsSnippet = `<!-- 1. Include EKhum Universal Payment Script -->
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script src="https://ekhum.onrender.com/api/v1/external/embed.js"></script>

<!-- 2. Call EKhum.pay() on Donate Button Click -->
<button onclick="handleDonate()">Donate ₹1,000</button>

<script>
  function handleDonate() {
    EKhum.pay({
      apiKey: "wg_live_test_campaigns_key_123",
      amount: 1000,
      currency: "INR",
      name: "Lakshay Batra",
      email: "donor@example.com",
      phone: "+919876543210",
      taxId: "ABCDE1234F",
      gateway: "razorpay",
      onSuccess: function(res) {
        alert("✅ Donated! 80G Receipt Ref: " + res.receiptNumber);
      }
    });
  }
</script>`;

  const apiSnippet = `POST /api/v1/external/donations/initiate
Host: https://ekhum.onrender.com
x-ekhum-api-key: wg_live_test_campaigns_key_123
Content-Type: application/json

{
  "amount": 2500,
  "currency": "INR",
  "name": "Ananya Sharma",
  "email": "ananya@example.com",
  "phone": "+919811122233",
  "taxId": "BPQPS9988K",
  "customFormData": {
    "campaignSlug": "test_campaigns",
    "notes": "Empower clean water drive"
  }
}`;

  const checkoutSnippet = `https://ekhum.onrender.com/checkout?campaign=test_campaigns`;

  const faqs = [
    {
      q: "How is EKhum 100% free with 0% platform commission?",
      a: "Unlike traditional platforms (Ketto, Milaap, GiveIndia) that deduct 2% to 5% from every donation, EKhum operates as a direct non-profit infrastructure. All donations route directly to your connected Razorpay, Cashfree, or PayU merchant accounts with 0.0% platform fee deduction."
    },
    {
      q: "How does the automated 80G tax receipt generation work?",
      a: "The moment a donor completes a payment via UPI, Card, or Netbanking, EKhum's 80G Compliance Agent generates a statutory Income Tax Act 1961 aligned PDF certificate with cryptographic SHA256 verification and instantly sends it to the donor via WhatsApp and Email."
    },
    {
      q: "Can we use our own WhatsApp Business numbers?",
      a: "Yes! EKhum provides dual WhatsApp engines: standard Meta Cloud API and the high-speed Evolution Go multi-device engine (powered by Baileys). You can pair any number via QR code in 10 seconds with zero approval delays."
    },
    {
      q: "How do we embed the donation form into our existing NGO website?",
      a: "You can simply copy the 1-line JavaScript embed code or use our REST API. Alternatively, use our ready-to-share high-conversion hosted checkout pages."
    },
    {
      q: "Is Form 10BD tax export supported for annual filing?",
      a: "Yes! EKhum automatically compiles all donor PANs, names, tax regimes, addresses, and transaction hashes into a 100% format-compliant Form 10BD CSV ready for 1-click upload to the Income Tax Department portal."
    }
  ];

  return (
    <div style={{ backgroundColor: '#070A0F', color: '#F1F5F9', minHeight: '100vh', fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif", overflowX: 'hidden' }}>
      
      {/* Dynamic Background Glows */}
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '900px', height: '550px', background: 'radial-gradient(circle, rgba(163,230,53,0.12) 0%, rgba(16,185,129,0.05) 45%, transparent 70%)', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }}></div>
      <div style={{ position: 'fixed', bottom: 0, right: '10%', width: '600px', height: '450px', background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, rgba(99,102,241,0.04) 50%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }}></div>

      {/* 1. FLOATING CAPSULE NAVBAR */}
      <header style={{ position: 'fixed', top: '20px', left: 0, right: 0, zIndex: 50, padding: '0 20px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '100%',
          maxWidth: '1200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          borderRadius: '9999px',
          backgroundColor: scrolled ? 'rgba(10, 15, 25, 0.88)' : 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          
          {/* Logo Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 12px', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #A3E635 0%, #10B981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(163, 230, 53, 0.4)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#070A0F" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </div>
            <div>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#FFFFFF' }}>EKhum<span style={{ color: '#A3E635' }}>.ai</span></span>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }} className="hidden-mobile">
            <a href="#ai-workforce" style={{ color: '#94A3B8', fontSize: '0.86rem', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>AI Workforce</a>
            <a href="#features" style={{ color: '#94A3B8', fontSize: '0.86rem', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>Why EKhum</a>
            <a href="#how-it-works" style={{ color: '#94A3B8', fontSize: '0.86rem', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>How It Works</a>
            <a href="#code-embed" style={{ color: '#94A3B8', fontSize: '0.86rem', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>Embed & API</a>
            <a href="#faq" style={{ color: '#94A3B8', fontSize: '0.86rem', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>FAQ</a>
          </nav>

          {/* Right Action Capsule */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            
            {/* Live Concierge Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.75rem',
              color: '#34D399',
              fontWeight: 600
            }} className="hidden-mobile">
              <span style={{ position: 'relative', display: 'flex', width: '8px', height: '8px' }}>
                <span style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#10B981', opacity: 0.75, animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }}></span>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }}></span>
              </span>
              <span>Giving Concierge Active</span>
            </div>

            {/* Admin Direct Access */}
            <button
              onClick={onOpenAdminLogin}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#CBD5E1',
                padding: '7px 14px',
                borderRadius: '9999px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Superadmin Master Access (/admin)"
            >
              👑 Admin
            </button>

            {/* Prominent Login Now Button */}
            <button
              onClick={onOpenNgoLogin}
              style={{
                background: 'linear-gradient(135deg, #A3E635 0%, #4ADE80 100%)',
                color: '#070A0F',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '9999px',
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(163, 230, 53, 0.35)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Login now</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'none',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#FFF',
                padding: '8px',
                borderRadius: '50%',
                cursor: 'pointer'
              }}
              className="show-mobile"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{ position: 'fixed', top: '80px', left: '20px', right: '20px', backgroundColor: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(25px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '20px', padding: '20px', zIndex: 49, display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
          <a href="#ai-workforce" onClick={() => setMobileMenuOpen(false)} style={{ color: '#FFF', textDecoration: 'none', fontSize: '1rem', padding: '8px 0' }}>AI Workforce</a>
          <a href="#features" onClick={() => setMobileMenuOpen(false)} style={{ color: '#FFF', textDecoration: 'none', fontSize: '1rem', padding: '8px 0' }}>Why EKhum</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} style={{ color: '#FFF', textDecoration: 'none', fontSize: '1rem', padding: '8px 0' }}>How It Works</a>
          <a href="#code-embed" onClick={() => setMobileMenuOpen(false)} style={{ color: '#FFF', textDecoration: 'none', fontSize: '1rem', padding: '8px 0' }}>Embed & API</a>
          <a href="#faq" onClick={() => setMobileMenuOpen(false)} style={{ color: '#FFF', textDecoration: 'none', fontSize: '1rem', padding: '8px 0' }}>FAQ</a>
          <hr style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
          <button onClick={() => { setMobileMenuOpen(false); onOpenNgoLogin(); }} style={{ background: 'linear-gradient(135deg, #A3E635 0%, #4ADE80 100%)', color: '#070A0F', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem' }}>Login now (NGO Portal)</button>
          <button onClick={() => { setMobileMenuOpen(false); onOpenAdminLogin(); }} style={{ background: 'rgba(255,255,255,0.1)', color: '#FFF', border: '1px solid rgba(255,255,255,0.2)', padding: '12px', borderRadius: '12px', fontWeight: 600 }}>Superadmin Portal (/admin)</button>
        </div>
      )}

      {/* 2. HERO SECTION */}
      <section style={{ paddingTop: '150px', paddingBottom: '80px', paddingLeft: '20px', paddingRight: '20px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          
          {/* Top Pill Tagline */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 18px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(163, 230, 53, 0.3)',
            boxShadow: '0 0 20px rgba(163, 230, 53, 0.12)',
            marginBottom: '28px'
          }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A3E635' }}>
              ⚡ STILL RUNNING NGO FUNDRAISING ON SPREADSHEETS & MANUAL RECEIPTS?
            </span>
          </div>

          {/* Hero Headline */}
          <h1 style={{
            fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.035em',
            margin: '0 0 24px 0',
            color: '#FFFFFF'
          }}>
            Move your non-profit fundraising<br />
            to <span style={{
              background: 'linear-gradient(135deg, #A3E635 0%, #34D399 50%, #38BDF8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>EKhum.ai</span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            color: '#94A3B8',
            maxWidth: '780px',
            margin: '0 auto 36px auto',
            lineHeight: 1.6,
            fontWeight: 400
          }}>
            The AI-Native Giving & Non-Profit Automation Infrastructure. Deploy autonomous agents to handle instant 80G tax certificates, multi-gateway payments, WhatsApp journeys, and Form 10BD compliance — <strong style={{ color: '#F8FAFC' }}>with 0% platform fees</strong>.
          </p>

          {/* Hero Call to Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '48px' }}>
            <button
              onClick={onOpenNgoLogin}
              style={{
                background: 'linear-gradient(135deg, #A3E635 0%, #4ADE80 100%)',
                color: '#070A0F',
                border: 'none',
                padding: '14px 34px',
                borderRadius: '9999px',
                fontSize: '1.05rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 0 30px rgba(163, 230, 53, 0.45)',
                transition: 'all 0.25s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>Login now</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </button>

            <button
              onClick={onOpenCheckoutDemo}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#F8FAFC',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                padding: '14px 28px',
                borderRadius: '9999px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.25s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>Live Checkout Demo</span>
              <span style={{ fontSize: '1.1rem' }}>↗</span>
            </button>
          </div>

          {/* LIVE SIMULATOR CONSOLE */}
          <div style={{
            maxWidth: '960px',
            margin: '0 auto',
            borderRadius: '24px',
            padding: '24px',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 50px rgba(163, 230, 53, 0.08)',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EF4444' }}></span>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }}></span>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981' }}></span>
                <span style={{ fontSize: '0.82rem', color: '#64748B', marginLeft: '8px', fontFamily: 'monospace' }}>ekhum-agent-orchestrator.exe --realtime</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: '#34D399', backgroundColor: 'rgba(16,185,129,0.15)', padding: '3px 10px', borderRadius: '20px', fontWeight: 600 }}>0.0% Fee Verified</span>
                <button
                  onClick={runSimulation}
                  style={{
                    backgroundColor: isSimulating ? '#059669' : '#A3E635',
                    color: '#070A0F',
                    border: 'none',
                    padding: '5px 14px',
                    borderRadius: '9999px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isSimulating ? 'Processing...' : '▶ Simulate Live Donation'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}>Total GMV Processed</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#A3E635', marginTop: '4px' }}>₹1,48,50,000+</div>
                <div style={{ fontSize: '0.72rem', color: '#34D399', marginTop: '2px' }}>↑ 100% Payout to NGOs</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}>80G Receipts Generated</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8', marginTop: '4px' }}>12,450 Issued</div>
                <div style={{ fontSize: '0.72rem', color: '#60A5FA', marginTop: '2px' }}>10BD Statement Ready</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}>WhatsApp Retention Bot</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ADE80', marginTop: '4px' }}>98.2% Delivered</div>
                <div style={{ fontSize: '0.72rem', color: '#A7F3D0', marginTop: '2px' }}>Multi-Device Baileys Active</div>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#090D16', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.6 }}>
              <div style={{ color: '#64748B' }}>// Real-Time Autonomous Agent Activity Stream</div>
              <div style={{ color: liveSimStep >= 1 ? '#A3E635' : '#475569', marginTop: '6px' }}>
                [00:01.2] 📥 [Event Bus] Inbound Donation Received: ₹5,000 via UPI (Donor: Lakshay Batra, PAN: ABCDE1234F)
              </div>
              <div style={{ color: liveSimStep >= 2 ? '#38BDF8' : '#475569' }}>
                [00:01.5] ⚡ [Payment Router] Direct Settlement Confirmed: Razorpay Rail → Child Help Foundation Account (0% Fee Deducted)
              </div>
              <div style={{ color: liveSimStep >= 3 ? '#F59E0B' : '#475569' }}>
                [00:01.8] 📜 [80G Tax Agent] Digital 80G Certificate Generated: URN-AAATC1234F2180G1 | Hash: 8f9b2c...7a10
              </div>
              <div style={{ color: liveSimStep >= 4 ? '#34D399' : '#475569' }}>
                [00:02.1] 📲 [WhatsApp Bot] Multi-Device Alert Dispatched to +919876543210 with Downloadable PDF Receipt Attached
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 3. SECTION: THE AI NON-PROFIT WORKFORCE */}
      <section id="ai-workforce" style={{ padding: '100px 20px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{ display: 'inline-flex', padding: '4px 14px', borderRadius: '9999px', backgroundColor: 'rgba(163,230,53,0.1)', color: '#A3E635', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
              Autonomous Agents
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.025em', margin: 0 }}>
              The AI Non-Profit Workforce
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '1.05rem', maxWidth: '640px', margin: '14px auto 0 auto' }}>
              Replace repetitive operations, compliance bottlenecks, and disconnected spreadsheets with dedicated autonomous AI agents.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
            
            <div style={{
              padding: '32px',
              borderRadius: '24px',
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '20px' }}>
                  📜
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 10px 0' }}>80G Statutory & Tax Agent</h3>
                <p style={{ color: '#94A3B8', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                  Autonomously compiles and signs official Section 80G tax exemption certificates under the Income Tax Act 1961. Embeds QR verification and automates Form 10BD annual batch filing.
                </p>
              </div>
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#38BDF8', fontWeight: 600 }}>● Instant PDF Dispatch</span>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>SHA256 Signed</span>
              </div>
            </div>

            <div style={{
              padding: '32px',
              borderRadius: '24px',
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(74, 222, 128, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '20px' }}>
                  📲
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 10px 0' }}>WhatsApp Retention Concierge</h3>
                <p style={{ color: '#94A3B8', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                  Executes automated multi-step journeys via Baileys and Meta Cloud API. Dispatches instant donation receipts, re-engages lapsed donors, and recovers abandoned checkouts automatically.
                </p>
              </div>
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#4ADE80', fontWeight: 600 }}>● Multi-Device Baileys v2</span>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>10s QR Pairing</span>
              </div>
            </div>

            <div style={{
              padding: '32px',
              borderRadius: '24px',
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(163, 230, 53, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '20px' }}>
                  ⚡
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 10px 0' }}>Multi-Rail Payment Orchestrator</h3>
                <p style={{ color: '#94A3B8', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                  Dynamically routes transactions between Razorpay, Cashfree, and PayU with instant failover. Enforces 0.0% platform fee deduction so 100% of donor funds reach your NGO bank account.
                </p>
              </div>
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#A3E635', fontWeight: 600 }}>● 0.0% Platform Fee</span>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>UPI + Cards + Netbanking</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 4. SECTION: WHY CHOOSE EKHUM (COMPARISON) */}
      <section id="features" style={{ padding: '80px 20px', backgroundColor: 'rgba(15, 23, 42, 0.3)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.025em', margin: 0 }}>
              Why Leading Non-Profits Choose EKhum
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '1rem', maxWidth: '600px', margin: '12px auto 0 auto' }}>
              Built specifically for high-growth NGOs that want total ownership over donor relationships.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '16px', color: '#94A3B8', fontWeight: 600, fontSize: '0.9rem' }}>Feature / Capability</th>
                  <th style={{ padding: '16px', color: '#EF4444', fontWeight: 600, fontSize: '0.9rem' }}>Traditional Donation Portals</th>
                  <th style={{ padding: '16px', color: '#A3E635', fontWeight: 700, fontSize: '0.95rem', backgroundColor: 'rgba(163,230,53,0.06)', borderRadius: '12px 12px 0 0' }}>EKhum AI Infrastructure</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '16px', fontWeight: 600, color: '#F1F5F9' }}>Platform Commission</td>
                  <td style={{ padding: '16px', color: '#94A3B8' }}>2% to 5% deducted per gift</td>
                  <td style={{ padding: '16px', color: '#A3E635', fontWeight: 700, backgroundColor: 'rgba(163,230,53,0.06)' }}>0.0% (100% Free Forever)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '16px', fontWeight: 600, color: '#F1F5F9' }}>80G Receipt Dispatch</td>
                  <td style={{ padding: '16px', color: '#94A3B8' }}>Manual weekly/monthly PDFs</td>
                  <td style={{ padding: '16px', color: '#A3E635', fontWeight: 700, backgroundColor: 'rgba(163,230,53,0.06)' }}>Instant Automated PDF (&lt;2s)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '16px', fontWeight: 600, color: '#F1F5F9' }}>WhatsApp Journey Engine</td>
                  <td style={{ padding: '16px', color: '#94A3B8' }}>None / Third-party paid add-ons</td>
                  <td style={{ padding: '16px', color: '#A3E635', fontWeight: 700, backgroundColor: 'rgba(163,230,53,0.06)' }}>Built-in Multi-Device & Cloud API</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '16px', fontWeight: 600, color: '#F1F5F9' }}>External Page Integration</td>
                  <td style={{ padding: '16px', color: '#94A3B8' }}>Forced redirect to portal URL</td>
                  <td style={{ padding: '16px', color: '#A3E635', fontWeight: 700, backgroundColor: 'rgba(163,230,53,0.06)' }}>1-Line JS Embed on Any Domain</td>
                </tr>
                <tr>
                  <td style={{ padding: '16px', fontWeight: 600, color: '#F1F5F9' }}>Form 10BD IT Compliance</td>
                  <td style={{ padding: '16px', color: '#94A3B8' }}>Manual spreadsheet cleanup</td>
                  <td style={{ padding: '16px', color: '#A3E635', fontWeight: 700, backgroundColor: 'rgba(163,230,53,0.06)', borderRadius: '0 0 12px 12px' }}>1-Click ITD Validated CSV Export</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </section>

      {/* 5. SECTION: HOW IT WORKS (3-STEP PIPELINE) */}
      <section id="how-it-works" style={{ padding: '100px 20px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{ display: 'inline-flex', padding: '4px 14px', borderRadius: '9999px', backgroundColor: 'rgba(56,189,248,0.1)', color: '#38BDF8', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
              Simple 3-Step Setup
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              Live in Under 5 Minutes
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
            
            <div style={{ padding: '32px', borderRadius: '20px', backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#A3E635', marginBottom: '16px' }}>01</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFF', marginBottom: '10px' }}>Connect NGO & Gateways</h3>
              <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                Enter your NGO registration (80G URN, signatory) and plug in your Razorpay, Cashfree, or PayU merchant keys.
              </p>
            </div>

            <div style={{ padding: '32px', borderRadius: '20px', backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38BDF8', marginBottom: '16px' }}>02</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFF', marginBottom: '10px' }}>Embed or Share Links</h3>
              <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                Drop our lightweight JavaScript snippet onto your campaign landing page or share ready hosted checkout URLs.
              </p>
            </div>

            <div style={{ padding: '32px', borderRadius: '20px', backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#4ADE80', marginBottom: '16px' }}>03</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFF', marginBottom: '10px' }}>Autonomous Execution</h3>
              <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                Every donation automatically triggers instant 80G PDF creation, WhatsApp/Email dispatches, and real-time CRM updates.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 6. SECTION: INTERACTIVE CODE & API PLAYGROUND */}
      <section id="code-embed" style={{ padding: '80px 20px', backgroundColor: 'rgba(15, 23, 42, 0.4)', borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              Developer-First Embed & REST APIs
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '0.95rem', marginTop: '10px' }}>
              Seamless integration with Next.js, WordPress, Webflow, React, or custom landing pages.
            </p>
          </div>

          <div style={{ borderRadius: '20px', backgroundColor: '#090D16', border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setActiveCodeTab('embed')}
                  style={{
                    backgroundColor: activeCodeTab === 'embed' ? 'rgba(163,230,53,0.15)' : 'transparent',
                    color: activeCodeTab === 'embed' ? '#A3E635' : '#94A3B8',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ⚡ 1-Line JS Embed
                </button>
                <button
                  onClick={() => setActiveCodeTab('api')}
                  style={{
                    backgroundColor: activeCodeTab === 'api' ? 'rgba(56,189,248,0.15)' : 'transparent',
                    color: activeCodeTab === 'api' ? '#38BDF8' : '#94A3B8',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  📡 REST API Spec
                </button>
                <button
                  onClick={() => setActiveCodeTab('checkout')}
                  style={{
                    backgroundColor: activeCodeTab === 'checkout' ? 'rgba(74,222,128,0.15)' : 'transparent',
                    color: activeCodeTab === 'checkout' ? '#4ADE80' : '#94A3B8',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  🔗 Hosted Checkout URL
                </button>
              </div>

              <button
                onClick={() => handleCopy(activeCodeTab === 'embed' ? jsSnippet : activeCodeTab === 'api' ? apiSnippet : checkoutSnippet, activeCodeTab)}
                style={{
                  backgroundColor: copiedCode === activeCodeTab ? '#10B981' : 'rgba(255,255,255,0.08)',
                  color: '#FFF',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {copiedCode === activeCodeTab ? '✅ Copied!' : '📋 Copy Code'}
              </button>
            </div>

            <pre style={{ margin: 0, padding: '24px', color: activeCodeTab === 'embed' ? '#38BDF8' : activeCodeTab === 'api' ? '#34D399' : '#FCD34D', fontSize: '0.84rem', lineHeight: 1.6, overflowX: 'auto', fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}>
              {activeCodeTab === 'embed' ? jsSnippet : activeCodeTab === 'api' ? apiSnippet : checkoutSnippet}
            </pre>
          </div>

        </div>
      </section>

      {/* 7. SECTION: FAQ ACCORDION */}
      <section id="faq" style={{ padding: '90px 20px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              Frequently Asked Questions
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                style={{
                  borderRadius: '16px',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  overflow: 'hidden'
                }}
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  style={{
                    width: '100%',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#F1F5F9',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{ fontSize: '1.2rem', color: '#A3E635', transition: 'transform 0.2s', transform: activeFaq === idx ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
                </button>
                {activeFaq === idx && (
                  <div style={{ padding: '0 24px 20px 24px', color: '#94A3B8', fontSize: '0.92rem', lineHeight: 1.6 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 8. HIGH-IMPACT AURORA FOOTER */}
      <footer style={{ position: 'relative', overflow: 'hidden', padding: '100px 20px 40px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        
        <div style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          maxWidth: '900px',
          height: '350px',
          background: 'radial-gradient(ellipse at top, rgba(163, 230, 53, 0.25) 0%, rgba(16, 185, 129, 0.08) 35%, transparent 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none'
        }}></div>

        <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <h2 style={{ fontSize: 'clamp(2.2rem, 4vw, 3.2rem)', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.03em', margin: '0 0 20px 0' }}>
              Ready to automate your giving operations?
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 36px auto' }}>
              Join forward-thinking non-profits scaling individual donations with 0% platform fee and autonomous compliance.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={onOpenNgoLogin}
                style={{
                  background: 'linear-gradient(135deg, #A3E635 0%, #4ADE80 100%)',
                  color: '#070A0F',
                  border: 'none',
                  padding: '16px 38px',
                  borderRadius: '9999px',
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 0 35px rgba(163, 230, 53, 0.5)',
                  transition: 'all 0.25s'
                }}
              >
                Login now →
              </button>
              <button
                onClick={onOpenAdminLogin}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: '#CBD5E1',
                  border: '1px solid rgba(255,255,255,0.15)',
                  padding: '16px 30px',
                  borderRadius: '9999px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Superadmin Portal (/admin)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', paddingTop: '32px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.85rem', color: '#64748B' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 700, color: '#FFF' }}>EKhum.ai</span>
              <span>&copy; {new Date().getFullYear()} EKhum Platform Inc. All rights reserved.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <span style={{ color: '#34D399', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }}></span>
                All Systems Operational
              </span>
              <a href="#top" style={{ color: '#94A3B8', textDecoration: 'none' }}>Back to top ↑</a>
            </div>
          </div>

        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: block !important; }
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>

    </div>
  );
};
