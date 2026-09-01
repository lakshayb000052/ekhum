import React, { useState, useEffect, useRef } from 'react';
import { EKhumLogo } from '../shared/EKhumLogo';

interface EKhumLandingPageProps {
  onOpenNgoLogin: () => void;
  onOpenAdminLogin?: () => void;
  onOpenCheckoutDemo?: () => void;
}

type PageKey =
  | 'index'
  | 'index-text'
  | 'platform'
  | 'campaigns'
  | 'compliance'
  | 'engagement'
  | 'intelligence'
  | 'ledger'
  | 'pricing'
  | 'about'
  | 'demo';

export const EKhumLandingPage: React.FC<EKhumLandingPageProps> = ({
  onOpenNgoLogin,
}) => {
  const [currentPage, setCurrentPage] = useState<PageKey>('index');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [featuresDropdownOpen, setFeaturesDropdownOpen] = useState(false);
  const [homeDropdownOpen, setHomeDropdownOpen] = useState(false);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08 }
      );
      reveals.forEach((el) => observer.observe(el));
    } else {
      reveals.forEach((el) => el.classList.add('is-visible'));
    }
  }, [currentPage]);

  const navigateTo = (page: PageKey) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
    setFeaturesDropdownOpen(false);
    setHomeDropdownOpen(false);
  };

  const handleMouseEnterDropdown = (type: 'features' | 'home') => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    if (type === 'features') {
      setFeaturesDropdownOpen(true);
      setHomeDropdownOpen(false);
    } else {
      setHomeDropdownOpen(true);
      setFeaturesDropdownOpen(false);
    }
  };

  const handleMouseLeaveDropdown = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setFeaturesDropdownOpen(false);
      setHomeDropdownOpen(false);
    }, 180);
  };

  const isFeatureActive = ['campaigns', 'compliance', 'engagement', 'intelligence', 'ledger'].includes(currentPage);
  const isHomeActive = ['index', 'index-text'].includes(currentPage);

  return (
    <div className="ekhum-landing-root">
      <style>{`
        :root {
          --bg: #F8FAFC;
          --bg-soft: #F1F5F9;
          --panel: #FFFFFF;
          --panel-strong: #FFFFFF;
          --panel-light: #ECFDF5;
          --text: #0F172A;
          --text-dark: #0F172A;
          --muted: #475569;
          --muted-dark: #64748B;
          --line: #E2E8F0;
          --accent: #059669;
          --accent-soft: #10B981;
          --mint: #059669;
          --signal: #10B981;
          --danger: #EF4444;
          --radius-xl: 36px;
          --radius-lg: 24px;
          --radius-md: 18px;
          --shadow: 0 24px 60px -15px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.03);
          --content: min(1240px, calc(100% - 2.5rem));
          --ease-spring: cubic-bezier(0.22, 1, 0.36, 1);
        }

        .ekhum-landing-root {
          margin: 0;
          font-family: "Manrope", "Plus Jakarta Sans", "Avenir Next", sans-serif;
          background:
            radial-gradient(circle at top left, rgba(5, 150, 105, 0.06), transparent 26%),
            radial-gradient(circle at 85% 16%, rgba(16, 185, 129, 0.06), transparent 26%),
            linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 45%, #F1F5F9 100%);
          color: var(--text);
          line-height: 1.55;
          overflow-x: hidden;
          min-height: 100vh;
          position: relative;
        }

        /* Boxes background layer */
        .boxes-bg-layer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background-size: 36px 36px;
          background-image:
            linear-gradient(to right, rgba(15, 23, 42, 0.045) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15, 23, 42, 0.045) 1px, transparent 1px);
          mask-image: radial-gradient(circle at 50% 35%, black 65%, transparent 100%);
          -webkit-mask-image: radial-gradient(circle at 50% 35%, black 65%, transparent 100%);
        }

        .container {
          width: var(--content);
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        /* ================= FIXED HEADER ================= */
        .site-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          width: 100%;
          z-index: 100;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          background: rgba(255, 255, 255, 0.96);
          border-bottom: 1px solid rgba(226, 232, 240, 0.9);
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
        }

        .landing-main-content {
          padding-top: 72px;
        }

        .nav-shell {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 0;
          gap: 1.5rem;
        }

        .brand {
          display: inline-flex;
          align-items: center;
          gap: 0.85rem;
          cursor: pointer;
          flex-shrink: 0;
          text-decoration: none;
        }

        .brand-mark {
          width: 2.5rem;
          height: 2.5rem;
          display: grid;
          place-items: center;
          border-radius: 14px;
          background: linear-gradient(135deg, #059669 0%, #10B981 100%);
          color: #FFFFFF;
          font-weight: 900;
          font-size: 1.15rem;
          box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3);
          transition: transform 0.2s ease;
        }

        .brand:hover .brand-mark {
          transform: scale(1.05);
        }

        .brand-copy {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
        }

        .brand-copy strong {
          font-size: 1.15rem;
          letter-spacing: -0.02em;
          color: #0F172A;
          font-weight: 800;
        }

        .brand-copy small {
          color: #059669;
          font-size: 0.68rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-weight: 700;
        }

        /* Nav Links Island Container */
        .modern-nav-island {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          background: rgba(241, 245, 249, 0.75);
          border: 1px solid rgba(226, 232, 240, 0.9);
          padding: 4px 6px;
          border-radius: 9999px;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
        }

        .nav-item-btn {
          background: transparent;
          border: none;
          color: #475569;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          padding: 7px 15px;
          border-radius: 9999px;
          transition: color 0.15s ease, background 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          position: relative;
        }

        .nav-item-btn:hover {
          color: #059669;
          background: rgba(255, 255, 255, 0.8);
        }

        .nav-item-btn.active {
          color: #059669;
          background: #FFFFFF;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
        }

        .dropdown-chevron {
          width: 12px;
          height: 12px;
          transition: transform 0.2s ease;
        }

        .dropdown-open .dropdown-chevron {
          transform: rotate(180deg);
        }

        /* Floating Dropdown Menus */
        .dropdown-menu-wrapper {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 20px;
          box-shadow: 0 20px 50px -10px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.04);
          padding: 10px;
          z-index: 120;
        }

        .features-dropdown-grid {
          width: 480px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .dropdown-card {
          padding: 10px 12px;
          border-radius: 12px;
          background: #F8FAFC;
          border: 1px solid transparent;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .dropdown-card:hover {
          background: #ECFDF5;
          border-color: #A7F3D0;
          transform: translateY(-1px);
        }

        .dropdown-card.active {
          background: #ECFDF5;
          border-color: #059669;
        }

        .card-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          display: grid;
          place-items: center;
          font-size: 0.9rem;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .card-content strong {
          display: block;
          font-size: 0.86rem;
          color: #0F172A;
          font-weight: 700;
        }

        .card-content p {
          margin: 2px 0 0 0;
          font-size: 0.74rem;
          color: #64748B;
          line-height: 1.35;
        }

        .home-dropdown-list {
          width: 240px;
          display: grid;
          gap: 4px;
        }

        /* Right Header Action */
        .nav-right-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .login-btn-premium {
          background: linear-gradient(135deg, #059669 0%, #10B981 100%);
          color: #FFFFFF;
          border: none;
          padding: 9px 24px;
          border-radius: 9999px;
          font-size: 0.92rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(5, 150, 105, 0.3);
          transition: all 0.25s var(--ease-spring);
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .login-btn-premium:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 22px rgba(5, 150, 105, 0.45);
        }

        .nav-mobile-toggle {
          display: none;
          padding: 0.55rem 0.9rem;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #FFFFFF;
          color: var(--text);
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
        }

        /* Hero styling */
        .hero-section {
          padding: 5.5rem 0 3.5rem;
          position: relative;
          z-index: 1;
        }

        .hero-grid,
        .split-hero,
        .section-dark-grid,
        .footer-grid {
          display: grid;
          gap: 2rem;
        }

        .hero-grid {
          grid-template-columns: 1.05fr 0.95fr;
          align-items: center;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.22em;
          color: var(--accent);
          font-weight: 800;
        }

        .eyebrow::before {
          content: "";
          width: 2.75rem;
          height: 2px;
          background: currentColor;
        }

        .eyebrow.light {
          color: var(--accent);
        }

        h1,
        h2,
        h3 {
          margin: 0;
          font-family: "Nunito", "Manrope", sans-serif;
          line-height: 1.02;
          letter-spacing: 0.03em;
          text-transform: none;
          color: var(--text);
        }

        h1 {
          font-size: clamp(3.9rem, 8vw, 7.4rem);
          max-width: 9ch;
          margin-top: 1rem;
          font-weight: 900;
        }

        h2 {
          font-size: clamp(2.6rem, 5vw, 4.8rem);
          max-width: 13ch;
          font-weight: 800;
        }

        h3 {
          font-size: clamp(1.4rem, 2vw, 2rem);
          font-weight: 800;
        }

        .hero-subhead,
        .prose-block p,
        .pillar-card p,
        .timeline-item p,
        .module-card p,
        .footer-note,
        .narrative-card p,
        .cta-panel p,
        .detail-copy p,
        .detail-list p,
        .page-hero p,
        .dark p {
          color: var(--muted);
          font-size: 1.04rem;
        }

        .hero-subhead {
          max-width: 58ch;
          margin: 1.4rem 0 0;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-top: 2rem;
        }

        .button {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 3.5rem;
          padding: 0.95rem 1.75rem;
          border-radius: 999px;
          border: 1px solid transparent;
          background: linear-gradient(135deg, #059669, #10B981);
          color: #FFFFFF;
          font-weight: 800;
          box-shadow: 0 12px 30px rgba(5, 150, 105, 0.25);
          cursor: pointer;
          transition:
            transform 380ms var(--ease-spring),
            box-shadow 380ms var(--ease-spring),
            background 380ms var(--ease-spring);
        }

        .button:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 18px 40px rgba(5, 150, 105, 0.35);
        }

        .button.secondary {
          background: #FFFFFF;
          color: var(--text);
          border-color: var(--line);
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }

        .button.secondary:hover {
          background: #F8FAFC;
          border-color: #94A3B8;
        }

        .proof-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 2rem;
        }

        .proof-strip span,
        .tech-points span {
          padding: 0.7rem 0.9rem;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #FFFFFF;
          color: var(--text);
          font-size: 0.88rem;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.02);
        }

        .headline-wide {
          letter-spacing: 0.055em;
        }

        /* Stable dashboard frame without mouse tilt */
        .dashboard-frame {
          position: relative;
          padding: 1.4rem;
          border-radius: var(--radius-xl);
          background: #FFFFFF;
          border: 1px solid var(--line);
          box-shadow: var(--shadow);
          overflow: hidden;
        }

        .dashboard-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .dashboard-top small,
        .stream-card small,
        .detail-label {
          display: block;
          color: var(--accent);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-weight: 800;
        }

        .dashboard-top strong {
          display: block;
          margin-top: 0.35rem;
          font-size: 1.3rem;
          color: var(--text);
          font-weight: 800;
        }

        .status-pill {
          padding: 0.55rem 0.85rem;
          border-radius: 999px;
          background: #ECFDF5;
          color: var(--accent);
          font-size: 0.82rem;
          font-weight: 800;
          border: 1px solid #A7F3D0;
        }

        .dashboard-stream {
          display: grid;
          gap: 0.85rem;
        }

        /* Flat stream card with NO hover translation */
        .stream-card {
          padding: 1rem 1rem 1.05rem;
          border-radius: 22px;
          background: #F8FAFC;
          border: 1px solid #F1F5F9;
        }

        .stream-card strong {
          display: block;
          margin-top: 0.35rem;
          font-size: 1.05rem;
          color: var(--text);
          font-weight: 800;
        }

        .stream-card p {
          margin: 0.45rem 0 0;
          color: var(--muted);
          font-size: 0.86rem;
        }

        .stream-card.accent {
          background: linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%);
          border: 1px solid #A7F3D0;
        }

        .section {
          padding: 4.5rem 0;
          position: relative;
          z-index: 1;
        }

        .section-head {
          margin-bottom: 2rem;
        }

        .section-head h2 {
          margin-top: 0.95rem;
        }

        .narrative-grid,
        .pillar-grid,
        .module-grid,
        .detail-grid,
        .metrics-row {
          display: grid;
          gap: 1.25rem;
        }

        .narrative-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .narrative-card,
        .pillar-card,
        .module-card,
        .timeline-item,
        .detail-card,
        .cta-panel,
        .detail-side,
        .page-hero-card {
          border-radius: var(--radius-xl);
          border: 1px solid var(--line);
          background: #FFFFFF;
          box-shadow: var(--shadow);
        }

        .narrative-card {
          padding: 2rem;
          min-height: 220px;
        }

        .narrative-card.dark {
          background: #ECFDF5;
          border-color: #A7F3D0;
        }

        .narrative-card.dark p {
          color: #064E3B;
          font-weight: 500;
        }

        .split-hero,
        .section-dark-grid,
        .footer-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: start;
        }

        .prose-block {
          padding-top: 1.25rem;
        }

        .prose-block p + p {
          margin-top: 1rem;
        }

        .pillar-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .pillar-card {
          padding: 1.5rem;
          transition:
            transform 380ms var(--ease-spring),
            background 380ms var(--ease-spring),
            border-color 380ms var(--ease-spring);
        }

        .pillar-card:hover,
        .module-card:hover,
        .detail-card:hover {
          transform: translateY(-8px);
          border-color: #059669;
        }

        .pillar-card span {
          color: var(--accent);
          font-size: 0.8rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 800;
          background: #ECFDF5;
          padding: 4px 10px;
          border-radius: 999px;
        }

        .pillar-card h3 {
          margin-top: 0.9rem;
          margin-bottom: 0.8rem;
          font-size: 1.3rem;
        }

        .flow-section {
          background: #FFFFFF;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
        }

        .flow-layout {
          display: grid;
          grid-template-columns: 0.72fr 1.28fr;
          gap: 2rem;
        }

        .flow-copy {
          position: sticky;
          top: 6rem;
          align-self: start;
        }

        .flow-timeline {
          display: grid;
          gap: 1rem;
        }

        .timeline-item {
          display: grid;
          grid-template-columns: 72px 1fr;
          gap: 1rem;
          padding: 1.35rem 1.35rem 1.4rem;
          background: #F8FAFC;
          border: 1px solid var(--line);
          transition: all 0.2s ease;
        }

        .timeline-item:hover {
          background: #ECFDF5;
          border-color: #A7F3D0;
        }

        .timeline-item span {
          display: grid;
          place-items: center;
          width: 3.4rem;
          height: 3.4rem;
          border-radius: 18px;
          background: #059669;
          color: #FFFFFF;
          font-weight: 800;
          font-size: 1rem;
        }

        .timeline-item h3 {
          margin-bottom: 0.35rem;
          font-size: 1.15rem;
        }

        .module-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .module-card {
          display: block;
          padding: 1.55rem;
          cursor: pointer;
          text-align: left;
          transition:
            transform 380ms var(--ease-spring),
            border-color 380ms var(--ease-spring),
            background 380ms var(--ease-spring);
        }

        .module-card small {
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.17em;
          font-size: 0.72rem;
          font-weight: 800;
        }

        .module-card h3 {
          margin-top: 0.8rem;
          margin-bottom: 0.75rem;
          font-size: 1.35rem;
        }

        .section-dark {
          background: #FFFFFF;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
        }

        .tech-points {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 1.25rem;
        }

        .tech-points span {
          background: #ECFDF5;
          border-color: #A7F3D0;
          color: #059669;
          font-weight: 700;
        }

        .cta-panel {
          padding: 2.8rem;
          text-align: left;
          background: #0F172A;
          color: #FFFFFF;
          box-shadow: 0 32px 80px rgba(15, 23, 42, 0.2);
        }

        .cta-panel h2 {
          margin: 1rem 0 0;
          color: #FFFFFF;
        }

        .cta-panel p {
          max-width: 720px;
          margin: 1rem 0 0;
          color: #94A3B8;
        }

        .cta-panel .hero-actions {
          justify-content: flex-start;
        }

        .page-hero {
          padding: 4.5rem 0 2.4rem;
        }

        .page-hero-card {
          padding: 2.4rem;
          background: #FFFFFF;
          border: 1px solid var(--line);
        }

        .page-hero-card h1 {
          max-width: 14ch;
        }

        .page-layout {
          display: grid;
          grid-template-columns: 0.82fr 1.18fr;
          gap: 2rem;
        }

        .detail-side {
          position: sticky;
          top: 6rem;
          align-self: start;
          padding: 1.8rem;
          background: #F8FAFC;
        }

        .detail-side strong {
          display: block;
          margin-top: 0.6rem;
          font-size: 1.25rem;
          color: var(--text);
          font-weight: 800;
        }

        .detail-side p {
          color: var(--muted);
        }

        .detail-side ul {
          margin: 1rem 0 0;
          padding-left: 1.2rem;
          color: var(--text);
          line-height: 1.8;
        }

        .detail-card {
          padding: 2rem;
        }

        .detail-card h2 {
          font-size: clamp(2rem, 4vw, 3.2rem);
          margin-top: 0.9rem;
        }

        .detail-card p {
          max-width: 68ch;
        }

        .detail-list {
          display: grid;
          gap: 1rem;
          margin-top: 1.3rem;
        }

        .detail-list article {
          padding: 1rem 0 0;
          border-top: 1px solid var(--line);
        }

        .detail-list strong {
          display: block;
          margin-bottom: 0.35rem;
          font-size: 1.05rem;
          color: var(--text);
        }

        .detail-list p {
          margin: 0;
          color: var(--muted);
        }

        .metrics-row {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 1.2rem;
        }

        .metric-card {
          padding: 1.2rem;
          border-radius: 20px;
          background: #F8FAFC;
          border: 1px solid var(--line);
        }

        .metric-card strong {
          display: block;
          margin-top: 0.35rem;
          font-size: 1.6rem;
          color: #059669;
        }

        .site-footer {
          padding: 3rem 0 4rem;
          border-top: 1px solid var(--line);
          background: #FFFFFF;
          position: relative;
          z-index: 1;
        }

        .footer-links {
          display: flex;
          flex-wrap: wrap;
          gap: 0.85rem 1.1rem;
          justify-content: flex-end;
          align-content: start;
        }

        .footer-links button {
          background: none;
          border: none;
          color: var(--muted);
          cursor: pointer;
          font-size: 0.92rem;
          padding: 4px 8px;
          transition: color 0.2s ease;
        }

        .footer-links button:hover {
          color: #059669;
        }

        .reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 900ms var(--ease-spring), transform 900ms var(--ease-spring);
        }

        .reveal.is-visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* Mobile Drawer */
        .mobile-drawer {
          display: none;
        }

        @media (max-width: 960px) {
          .modern-nav-island {
            display: none !important;
          }

          .nav-mobile-toggle {
            display: inline-flex !important;
          }

          .mobile-drawer {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 16px;
            background: #FFFFFF;
            border-top: 1px solid var(--line);
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          }

          .mobile-drawer button {
            text-align: left;
            padding: 10px 14px;
            font-size: 0.95rem;
            font-weight: 600;
            color: #334155;
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 12px;
            cursor: pointer;
          }

          .mobile-drawer button.active {
            background: #ECFDF5;
            color: #059669;
            border-color: #A7F3D0;
            font-weight: 700;
          }
        }

        @media (max-width: 1080px) {
          .hero-grid,
          .split-hero,
          .section-dark-grid,
          .flow-layout,
          .page-layout,
          .footer-grid,
          .narrative-grid,
          .pillar-grid,
          .module-grid,
          .metrics-row {
            grid-template-columns: 1fr;
          }

          .flow-copy,
          .detail-side {
            position: static;
          }
        }

        @media (max-width: 860px) {
          .hero-section,
          .section {
            padding-top: 4rem;
          }

          h1 {
            font-size: clamp(3rem, 14vw, 5rem);
          }

          h2 {
            max-width: none;
          }
        }
      `}</style>

      {/* Background Box Grid Pattern */}
      <div className="boxes-bg-layer" />

      {/* ========================================================================= */}
      {/* 1. FIXED TOP NAVBAR (MODERN GLASSMORPHISM ISLAND & GROUPED NAVIGATION)    */}
      {/* ========================================================================= */}
      <header className="site-header">
        <div className="container nav-shell">
          {/* Brand Mark (Left) */}
          <div className="brand" onClick={() => navigateTo('index')}>
            <EKhumLogo variant="full" size="sm" withTagline theme="light" />
          </div>

          {/* Centered Modern Navigation Island */}
          <nav className="modern-nav-island">
            {/* Home dropdown item */}
            <div
              style={{ position: 'relative' }}
              onMouseEnter={() => handleMouseEnterDropdown('home')}
              onMouseLeave={handleMouseLeaveDropdown}
            >
              <button
                className={`nav-item-btn ${isHomeActive ? 'active' : ''} ${homeDropdownOpen ? 'dropdown-open' : ''}`}
                onClick={() => navigateTo('index')}
              >
                <span>Home</span>
                <svg className="dropdown-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {homeDropdownOpen && (
                <div className="dropdown-menu-wrapper home-dropdown-list">
                  <div
                    className={`dropdown-card ${currentPage === 'index' ? 'active' : ''}`}
                    onClick={() => navigateTo('index')}
                  >
                    <div className="card-icon">🌟</div>
                    <div className="card-content">
                      <strong>Visual Home</strong>
                      <p>Full narrative experience</p>
                    </div>
                  </div>
                  <div
                    className={`dropdown-card ${currentPage === 'index-text' ? 'active' : ''}`}
                    onClick={() => navigateTo('index-text')}
                  >
                    <div className="card-icon">📝</div>
                    <div className="card-content">
                      <strong>Text Home</strong>
                      <p>Direct argument & flow</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Platform Item */}
            <button
              className={`nav-item-btn ${currentPage === 'platform' ? 'active' : ''}`}
              onClick={() => navigateTo('platform')}
            >
              Platform
            </button>

            {/* Features Dropdown Item */}
            <div
              style={{ position: 'relative' }}
              onMouseEnter={() => handleMouseEnterDropdown('features')}
              onMouseLeave={handleMouseLeaveDropdown}
            >
              <button
                className={`nav-item-btn ${isFeatureActive ? 'active' : ''} ${featuresDropdownOpen ? 'dropdown-open' : ''}`}
                onClick={() => navigateTo('campaigns')}
              >
                <span>Features</span>
                <svg className="dropdown-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {featuresDropdownOpen && (
                <div className="dropdown-menu-wrapper features-dropdown-grid">
                  <div
                    className={`dropdown-card ${currentPage === 'campaigns' ? 'active' : ''}`}
                    onClick={() => navigateTo('campaigns')}
                  >
                    <div className="card-icon">🚀</div>
                    <div className="card-content">
                      <strong>Campaigns</strong>
                      <p>Cause appeals & approvals</p>
                    </div>
                  </div>

                  <div
                    className={`dropdown-card ${currentPage === 'compliance' ? 'active' : ''}`}
                    onClick={() => navigateTo('compliance')}
                  >
                    <div className="card-icon">📜</div>
                    <div className="card-content">
                      <strong>80G & Compliance</strong>
                      <p>Real-time receipts & 10BD</p>
                    </div>
                  </div>

                  <div
                    className={`dropdown-card ${currentPage === 'engagement' ? 'active' : ''}`}
                    onClick={() => navigateTo('engagement')}
                  >
                    <div className="card-icon">💬</div>
                    <div className="card-content">
                      <strong>Donor Engagement</strong>
                      <p>WhatsApp & branded email</p>
                    </div>
                  </div>

                  <div
                    className={`dropdown-card ${currentPage === 'intelligence' ? 'active' : ''}`}
                    onClick={() => navigateTo('intelligence')}
                  >
                    <div className="card-icon">🧠</div>
                    <div className="card-content">
                      <strong>AI & Metrics</strong>
                      <p>Contextual copilot & stats</p>
                    </div>
                  </div>

                  <div
                    className={`dropdown-card ${currentPage === 'ledger' ? 'active' : ''}`}
                    onClick={() => navigateTo('ledger')}
                    style={{ gridColumn: 'span 2' }}
                  >
                    <div className="card-icon">📊</div>
                    <div className="card-content">
                      <strong>Ledger & Payouts</strong>
                      <p>Searchable records, gross/net attribution & financial clarity</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pricing Item */}
            <button
              className={`nav-item-btn ${currentPage === 'pricing' ? 'active' : ''}`}
              onClick={() => navigateTo('pricing')}
            >
              Pricing
            </button>

            {/* About Item */}
            <button
              className={`nav-item-btn ${currentPage === 'about' ? 'active' : ''}`}
              onClick={() => navigateTo('about')}
            >
              About
            </button>

            {/* Book Demo Item */}
            <button
              className={`nav-item-btn ${currentPage === 'demo' ? 'active' : ''}`}
              onClick={() => navigateTo('demo')}
              style={{ color: '#059669', fontWeight: 700 }}
            >
              Demo
            </button>
          </nav>

          {/* Right Action: Mobile Toggle + Login Button */}
          <div className="nav-right-actions">
            <button
              className="nav-mobile-toggle"
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? '✕ Close' : '☰ Menu'}
            </button>

            <button
              className="login-btn-premium"
              onClick={onOpenNgoLogin}
            >
              <span>Login</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-drawer">
            <button className={currentPage === 'index' ? 'active' : ''} onClick={() => navigateTo('index')}>
              🌟 Visual Home
            </button>
            <button className={currentPage === 'index-text' ? 'active' : ''} onClick={() => navigateTo('index-text')}>
              📝 Text Home
            </button>
            <button className={currentPage === 'platform' ? 'active' : ''} onClick={() => navigateTo('platform')}>
              ⚡ Platform
            </button>
            <button className={currentPage === 'campaigns' ? 'active' : ''} onClick={() => navigateTo('campaigns')}>
              🚀 Campaigns
            </button>
            <button className={currentPage === 'compliance' ? 'active' : ''} onClick={() => navigateTo('compliance')}>
              📜 80G & Compliance
            </button>
            <button className={currentPage === 'engagement' ? 'active' : ''} onClick={() => navigateTo('engagement')}>
              💬 Donor Engagement
            </button>
            <button className={currentPage === 'intelligence' ? 'active' : ''} onClick={() => navigateTo('intelligence')}>
              🧠 AI & Metrics
            </button>
            <button className={currentPage === 'ledger' ? 'active' : ''} onClick={() => navigateTo('ledger')}>
              📊 Ledger & Payouts
            </button>
            <button className={currentPage === 'pricing' ? 'active' : ''} onClick={() => navigateTo('pricing')}>
              🏷️ Pricing
            </button>
            <button className={currentPage === 'about' ? 'active' : ''} onClick={() => navigateTo('about')}>
              🏛️ About
            </button>
            <button className={currentPage === 'demo' ? 'active' : ''} onClick={() => navigateTo('demo')}>
              📅 Book Demo
            </button>
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* 2. RENDER SELECTED PAGE CONTENT                                           */}
      {/* ========================================================================= */}
      <main className="landing-main-content">
        {/* ============================== PAGE 1: INDEX (VISUAL HOME) ============================== */}
        {currentPage === 'index' && (
          <div key="page-index">
            {/* Hero */}
            <section className="hero-section">
              <div className="container hero-grid">
                <div className="hero-copy reveal">
                  <span className="eyebrow">Ekhum</span>
                  <h1 className="headline-wide">For the greater good.</h1>
                  <p className="hero-subhead">
                    Ekhum is the fundraising infrastructure platform that helps charities launch
                    campaigns, automate 80G receipts, acknowledge donors instantly, prepare Form
                    10BD data, and run donor operations with the precision the sector deserves.
                  </p>
                  <div className="hero-actions">
                    <button className="button" onClick={() => navigateTo('demo')}>
                      Book a walkthrough
                    </button>
                    <button className="button secondary" onClick={() => navigateTo('platform')}>
                      See the platform
                    </button>
                  </div>
                  <div className="proof-strip">
                    <span>Campaign launch</span>
                    <span>Automated 80G</span>
                    <span>WhatsApp receipts</span>
                    <span>Form 10BD ready</span>
                    <span>AI-assisted follow-up</span>
                    <span>Ledger & payouts</span>
                  </div>
                </div>

                <div className="hero-visual reveal">
                  <div className="dashboard-frame">
                    <div className="dashboard-top">
                      <div>
                        <small>Platform Story</small>
                        <strong>How Ekhum moves the work</strong>
                      </div>
                      <span className="status-pill">Live flow</span>
                    </div>
                    <div className="dashboard-stream">
                      <article className="stream-card" onClick={() => navigateTo('campaigns')} style={{ cursor: 'pointer' }}>
                        <small>Campaigns</small>
                        <strong>Live appeals, launched faster</strong>
                        <p>Cause pages, custom slugs, and approvals managed from one system.</p>
                      </article>
                      <article className="stream-card" onClick={() => navigateTo('platform')} style={{ cursor: 'pointer' }}>
                        <small>Payments</small>
                        <strong>Donations enter a real operating chain</strong>
                        <p>One contribution triggers receipts, donor messaging, ledger updates, and reporting prep.</p>
                      </article>
                      <article className="stream-card" onClick={() => navigateTo('compliance')} style={{ cursor: 'pointer' }}>
                        <small>80G & Compliance</small>
                        <strong>Proof created in real time</strong>
                        <p>Certificates generated instantly and filing data kept ready across the year.</p>
                      </article>
                      <article className="stream-card" onClick={() => navigateTo('engagement')} style={{ cursor: 'pointer' }}>
                        <small>Donor trust</small>
                        <strong>WhatsApp and email carry the moment forward</strong>
                        <p>Acknowledgement lands while the gift still feels immediate.</p>
                      </article>
                      <article className="stream-card" onClick={() => navigateTo('intelligence')} style={{ cursor: 'pointer' }}>
                        <small>Intelligence</small>
                        <strong>AI sharpens follow-up without replacing judgment</strong>
                        <p>Draft faster, review carefully, and keep communication personal.</p>
                      </article>
                      <article className="stream-card accent" onClick={() => navigateTo('ledger')} style={{ cursor: 'pointer' }}>
                        <small>Clarity</small>
                        <strong>Ledger, payouts, and reporting stay clean</strong>
                        <p>Gross, net, donor records, and campaign attribution remain coherent.</p>
                      </article>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Why It Matters & Platform Layer */}
            <section className="section">
              <div className="container page-layout">
                <aside className="detail-side reveal">
                  <span className="detail-label">Why it matters</span>
                  <strong>Most charities have tools. What they do not have is continuity.</strong>
                  <p>
                    The campaign tool does not talk to the receipting workflow. The donor message
                    sits elsewhere. The ledger is rebuilt later. Compliance becomes a separate
                    project.
                  </p>
                  <ul>
                    <li>Campaign launch day</li>
                    <li>Donation spikes</li>
                    <li>March receipt requests</li>
                    <li>Auditor follow-up</li>
                    <li>Donor support queries months later</li>
                  </ul>
                </aside>
                <div className="detail-grid">
                  <article className="detail-card reveal">
                    <span className="detail-label">Platform</span>
                    <h2>The operating layer for modern charity fundraising.</h2>
                    <p>
                      Ekhum brings together campaign launch, donations, 80G automation, donor
                      acknowledgements, compliance preparation, AI-assisted communication, and
                      ledger visibility in one connected platform.
                    </p>
                  </article>
                </div>
              </div>
            </section>

            {/* What Greater Looks Like */}
            <section className="section">
              <div className="container">
                <div className="section-head reveal">
                  <span className="eyebrow">What greater looks like</span>
                  <h2 className="headline-wide">Greater efficiency. Greater compliance. Greater trust.</h2>
                </div>
                <div className="pillar-grid">
                  <article className="pillar-card reveal">
                    <span>01</span>
                    <h3>Greater efficiency</h3>
                    <p>Replace fragmented workflows with one operating flow. Less manual work. Less duplication. Less follow-up chaos.</p>
                  </article>
                  <article className="pillar-card reveal">
                    <span>02</span>
                    <h3>Greater compliance</h3>
                    <p>Automate 80G receipting and keep Form 10BD data structured and ready, instead of rebuilding donor records at filing time.</p>
                  </article>
                  <article className="pillar-card reveal">
                    <span>03</span>
                    <h3>Greater donor trust</h3>
                    <p>Acknowledge donors when the gift is still fresh, with timely receipts and communication that makes the act of giving feel complete.</p>
                  </article>
                  <article className="pillar-card reveal">
                    <span>04</span>
                    <h3>Greater visibility</h3>
                    <p>See campaign performance, donor records, payouts, and transaction history from one place instead of three tools and a spreadsheet trail.</p>
                  </article>
                </div>
              </div>
            </section>

            {/* Flow */}
            <section className="section flow-section">
              <div className="container flow-layout">
                <div className="flow-copy reveal">
                  <span className="eyebrow">One donation, fully handled</span>
                  <h2 className="headline-wide">Captured. Confirmed. Compliant.</h2>
                  <p>Ekhum turns the messy work after a donation into a clean, automated, intelligent operating flow.</p>
                </div>
                <div className="flow-timeline">
                  <article className="timeline-item reveal"><span>01</span><div><h3>Donation captured</h3><p>The payment lands and the system starts moving immediately.</p></div></article>
                  <article className="timeline-item reveal"><span>02</span><div><h3>80G generated</h3><p>Your configured details and signatory turn into proof in real time.</p></div></article>
                  <article className="timeline-item reveal"><span>03</span><div><h3>Donor acknowledged</h3><p>WhatsApp and email carry thanks, proof, and the next step while trust is warm.</p></div></article>
                  <article className="timeline-item reveal"><span>04</span><div><h3>Ledger updated</h3><p>Campaign, donor, amount, gateway, and status are recorded cleanly.</p></div></article>
                  <article className="timeline-item reveal"><span>05</span><div><h3>Form 10BD prepared</h3><p>The reporting trail stays ready all year instead of becoming a March rebuild.</p></div></article>
                </div>
              </div>
            </section>

            {/* Modules Grid */}
            <section className="section">
              <div className="container">
                <div className="section-head reveal">
                  <span className="eyebrow">What Ekhum does</span>
                  <h2 className="headline-wide">One platform. A whole system moving.</h2>
                </div>
                <div className="module-grid">
                  <div className="module-card reveal" onClick={() => navigateTo('campaigns')}>
                    <small>Greater campaigns</small>
                    <h3>Launch live appeals faster.</h3>
                    <p>Cause-based pages, approval flow, custom URLs, one-time and monthly giving.</p>
                  </div>
                  <div className="module-card reveal" onClick={() => navigateTo('compliance')}>
                    <small>Greater compliance</small>
                    <h3>Automate the work March usually punishes.</h3>
                    <p>80G generation, delivery, structured donor records, Form 10BD readiness.</p>
                  </div>
                  <div className="module-card reveal" onClick={() => navigateTo('engagement')}>
                    <small>Greater donor trust</small>
                    <h3>Reply while the gift still feels immediate.</h3>
                    <p>WhatsApp receipts, branded email acknowledgement, stronger post-donation momentum.</p>
                  </div>
                  <div className="module-card reveal" onClick={() => navigateTo('intelligence')}>
                    <small>Greater intelligence</small>
                    <h3>Use AI where it sharpens the team.</h3>
                    <p>Faster donor follow-up, contextual drafts, metrics leadership actually asks for.</p>
                  </div>
                  <div className="module-card reveal" onClick={() => navigateTo('ledger')}>
                    <small>Greater clarity</small>
                    <h3>Keep donors, payouts, and records coherent.</h3>
                    <p>Searchable histories, campaign-wise gross versus net, fewer loose ends.</p>
                  </div>
                  <div className="module-card reveal" onClick={() => navigateTo('pricing')}>
                    <small>Greater value</small>
                    <h3>Understand the full operating cost clearly.</h3>
                    <p>One fee. One operating model. Less fragmentation hiding in the process.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* The Sharper Edge */}
            <section className="section section-dark">
              <div className="container section-dark-grid">
                <div className="reveal">
                  <span className="eyebrow light">The sharper edge</span>
                  <h2 className="headline-wide">Not just automated. Architected.</h2>
                </div>
                <div className="reveal prose-block">
                  <p>Ekhum is not simply a donation page with extra steps. It is a workflow engine for fundraising operations: campaign management, real-time receipting, channel-based donor communication, structured compliance output, searchable records, and AI-assisted drafting in one coordinated architecture.</p>
                  <div className="tech-points">
                    <span>Real-time 80G generation</span>
                    <span>Structured compliance outputs</span>
                    <span>Campaign-wise gross and net visibility</span>
                    <span>Searchable transaction records</span>
                    <span>AI support where writing speed matters</span>
                  </div>
                </div>
              </div>
            </section>

            {/* The Need */}
            <section className="section">
              <div className="container reveal">
                <div className="section-head">
                  <span className="eyebrow">The need</span>
                  <h2 className="headline-wide">Too much good work is trapped in bad operations.</h2>
                </div>
                <div className="narrative-grid">
                  <div className="narrative-card"><p>Charities are asked to move fast, stay compliant, reassure donors, report cleanly, and keep teams focused on impact. Yet the machinery behind fundraising is still too often stitched together by hand.</p></div>
                  <div className="narrative-card dark"><p>A donation comes in. Then the real work starts: receipts, acknowledgements, ledger entries, payout checks, donor lookups, filing prep. The mission moves forward. The system lags behind.</p></div>
                </div>
              </div>
            </section>

            {/* Why Ekhum Exists */}
            <section className="section">
              <div className="container split-hero">
                <div className="reveal">
                  <span className="eyebrow">Why Ekhum exists</span>
                  <h2 className="headline-wide">Because charity infrastructure should be as serious as charity ambition.</h2>
                </div>
                <div className="reveal prose-block">
                  <p>We built Ekhum around a simple conviction: the sector should not have to choose between heart and horsepower. Good causes deserve operational systems that are faster, sharper, and more dependable.</p>
                  <p>The Greater Good is not a slogan here. It is the operating idea. If a charity can launch faster, respond faster, reconcile faster, and file faster, it can raise better, retain trust better, and serve its cause better.</p>
                </div>
              </div>
            </section>

            {/* CTA */}
            <section className="section">
              <div className="container cta-panel reveal">
                <span className="eyebrow" style={{ color: '#34D399' }}>Ready when you are</span>
                <h2 className="headline-wide">Good causes deserve greater systems.</h2>
                <p>Ekhum helps charities run with more precision, more confidence, and more momentum, so the good they exist to do is not slowed down by the systems behind it.</p>
                <div className="hero-actions">
                  <button className="button" onClick={() => navigateTo('demo')}>
                    Book a live walkthrough
                  </button>
                  <button className="button secondary" onClick={() => navigateTo('about')} style={{ color: '#FFFFFF', borderColor: 'rgba(255, 255, 255, 0.2)', background: 'rgba(255, 255, 255, 0.08)' }}>
                    Why we built this
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============================== PAGE 2: INDEX-TEXT (TEXT HOME) ============================== */}
        {currentPage === 'index-text' && (
          <div key="page-index-text">
            <section className="hero-section">
              <div className="container page-hero-card reveal">
                <span className="eyebrow">Ekhum</span>
                <h1 className="headline-wide">For the greater good.</h1>
                <p className="hero-subhead">
                  Ekhum is the fundraising infrastructure platform that helps charities launch
                  campaigns, automate 80G receipts, acknowledge donors instantly, prepare Form
                  10BD data, and run donor operations with the precision the sector deserves.
                </p>
                <div className="hero-actions">
                  <button className="button" onClick={() => navigateTo('demo')}>Book a walkthrough</button>
                  <button className="button secondary" onClick={() => navigateTo('platform')}>See the platform</button>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="container page-layout">
                <aside className="detail-side reveal">
                  <span className="detail-label">Why it matters</span>
                  <strong>Most charities have tools. What they do not have is continuity.</strong>
                  <p>
                    The campaign tool does not talk to the receipting workflow. The donor message
                    sits elsewhere. The ledger is rebuilt later. Compliance becomes a separate project.
                  </p>
                  <ul>
                    <li>Campaign launch day</li>
                    <li>Donation spikes</li>
                    <li>March receipt requests</li>
                    <li>Auditor follow-up</li>
                    <li>Donor support queries months later</li>
                  </ul>
                </aside>
                <div className="detail-grid">
                  <article className="detail-card reveal">
                    <span className="detail-label">Platform</span>
                    <h2>The operating layer for modern charity fundraising.</h2>
                    <p>
                      Ekhum brings together campaign launch, donations, 80G automation, donor
                      acknowledgements, compliance preparation, AI-assisted communication, and
                      ledger visibility in one connected platform.
                    </p>
                  </article>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="container">
                <div className="section-head reveal">
                  <span className="eyebrow">What greater looks like</span>
                  <h2 className="headline-wide">Greater efficiency. Greater compliance. Greater trust.</h2>
                </div>
                <div className="pillar-grid">
                  <article className="pillar-card reveal"><span>01</span><h3>Greater efficiency</h3><p>Replace fragmented workflows with one operating flow. Less manual work. Less duplication. Less follow-up chaos.</p></article>
                  <article className="pillar-card reveal"><span>02</span><h3>Greater compliance</h3><p>Automate 80G receipting and keep Form 10BD data structured and ready, instead of rebuilding donor records at filing time.</p></article>
                  <article className="pillar-card reveal"><span>03</span><h3>Greater donor trust</h3><p>Acknowledge donors when the gift is still fresh, with timely receipts and communication that makes the act of giving feel complete.</p></article>
                  <article className="pillar-card reveal"><span>04</span><h3>Greater visibility</h3><p>See campaign performance, donor records, payouts, and transaction history from one place instead of three tools and a spreadsheet trail.</p></article>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="container">
                <div className="section-head reveal">
                  <span className="eyebrow">What Ekhum does</span>
                  <h2 className="headline-wide">One platform. A whole system moving.</h2>
                </div>
                <div className="module-grid">
                  <div className="module-card reveal" onClick={() => navigateTo('campaigns')}><small>Greater campaigns</small><h3>Launch live appeals faster.</h3><p>Cause-based pages, approval flow, custom URLs, one-time and monthly giving.</p></div>
                  <div className="module-card reveal" onClick={() => navigateTo('compliance')}><small>Greater compliance</small><h3>Automate the work March usually punishes.</h3><p>80G generation, delivery, structured donor records, Form 10BD readiness.</p></div>
                  <div className="module-card reveal" onClick={() => navigateTo('engagement')}><small>Greater donor trust</small><h3>Reply while the gift still feels immediate.</h3><p>WhatsApp receipts, branded email acknowledgement, stronger post-donation momentum.</p></div>
                  <div className="module-card reveal" onClick={() => navigateTo('intelligence')}><small>Greater intelligence</small><h3>Use AI where it sharpens the team.</h3><p>Faster donor follow-up, contextual drafts, metrics leadership actually asks for.</p></div>
                  <div className="module-card reveal" onClick={() => navigateTo('ledger')}><small>Greater clarity</small><h3>Keep donors, payouts, and records coherent.</h3><p>Searchable histories, campaign-wise gross versus net, fewer loose ends.</p></div>
                  <div className="module-card reveal" onClick={() => navigateTo('pricing')}><small>Greater value</small><h3>Understand the full operating cost clearly.</h3><p>One fee. One operating model. Less fragmentation hiding in the process.</p></div>
                </div>
              </div>
            </section>

            <section className="section section-dark">
              <div className="container section-dark-grid">
                <div className="reveal">
                  <span className="eyebrow light">The sharper edge</span>
                  <h2 className="headline-wide">Not just automated. Architected.</h2>
                </div>
                <div className="reveal prose-block">
                  <p>Ekhum is not simply a donation page with extra steps. It is a workflow engine for fundraising operations: campaign management, real-time receipting, channel-based donor communication, structured compliance output, searchable records, and AI-assisted drafting in one coordinated architecture.</p>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="container reveal">
                <div className="section-head">
                  <span className="eyebrow">The need</span>
                  <h2 className="headline-wide">Too much good work is trapped in bad operations.</h2>
                </div>
                <div className="narrative-grid">
                  <div className="narrative-card"><p>Charities are asked to move fast, stay compliant, reassure donors, report cleanly, and keep teams focused on impact. Yet the machinery behind fundraising is still too often stitched together by hand.</p></div>
                  <div className="narrative-card dark"><p>A donation comes in. Then the real work starts: receipts, acknowledgements, ledger entries, payout checks, donor lookups, filing prep. The mission moves forward. The system lags behind.</p></div>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="container split-hero">
                <div className="reveal">
                  <span className="eyebrow">Why Ekhum exists</span>
                  <h2 className="headline-wide">Because charity infrastructure should be as serious as charity ambition.</h2>
                </div>
                <div className="reveal prose-block">
                  <p>We built Ekhum around a simple conviction: the sector should not have to choose between heart and horsepower. Good causes deserve operational systems that are faster, sharper, and more dependable.</p>
                  <p>The Greater Good is not a slogan here. It is the operating idea. If a charity can launch faster, respond faster, reconcile faster, and file faster, it can raise better, retain trust better, and serve its cause better.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============================== PAGE 3: PLATFORM ============================== */}
        {currentPage === 'platform' && (
          <div key="page-platform">
            <section className="page-hero">
              <div className="container page-hero-card reveal">
                <span className="eyebrow">Platform</span>
                <h1>The operating layer for modern charity fundraising.</h1>
                <p>
                  Ekhum brings together campaign launch, donations, 80G automation, donor
                  acknowledgements, compliance preparation, AI-assisted communication, and ledger
                  visibility in one connected platform.
                </p>
              </div>
            </section>

            <section className="section">
              <div className="container page-layout">
                <aside className="detail-side reveal">
                  <span className="detail-label">Why it matters</span>
                  <strong>Most charities have tools. What they do not have is continuity.</strong>
                  <p>
                    The campaign tool does not talk to the receipting workflow. The donor message
                    sits elsewhere. The ledger is rebuilt later. Compliance becomes a separate
                    project.
                  </p>
                  <ul>
                    <li>Campaign launch day</li>
                    <li>Donation spikes</li>
                    <li>March receipt requests</li>
                    <li>Auditor follow-up</li>
                    <li>Donor support queries months later</li>
                  </ul>
                </aside>
                <div className="detail-grid">
                  <article className="detail-card reveal">
                    <span className="detail-label">The missing layer</span>
                    <h2>Not another tool. The chain that holds the work together.</h2>
                    <p>
                      Ekhum creates continuity across the full post-donation chain. A campaign
                      goes live. A payment lands. A receipt is issued. The donor is thanked. The
                      ledger is updated. Compliance data is kept ready. The system moves in order,
                      and the data stays intact.
                    </p>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Connected architecture</span>
                    <h2>One platform. Multiple pressure points removed.</h2>
                    <div className="detail-list">
                      <article>
                        <strong>Campaign launch</strong>
                        <p>Go live faster, with cleaner approvals and campaign-wise visibility.</p>
                      </article>
                      <article>
                        <strong>Donation operations</strong>
                        <p>Automate the work that usually begins after the donor clicks pay.</p>
                      </article>
                      <article>
                        <strong>Compliance flow</strong>
                        <p>Keep 80G and Form 10BD outputs structured instead of reconstructed later.</p>
                      </article>
                      <article>
                        <strong>Donor trust</strong>
                        <p>Reply while the act of giving is still fresh, not days after the moment has passed.</p>
                      </article>
                    </div>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Outcome</span>
                    <h2>One system. Many operational headaches gone.</h2>
                    <p>
                      When the full chain works as one, charities become easier to run, easier to
                      trust, and easier to scale. That is the real platform value.
                    </p>
                  </article>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============================== PAGE 4: CAMPAIGNS ============================== */}
        {currentPage === 'campaigns' && (
          <div key="page-campaigns">
            <section className="page-hero">
              <div className="container page-hero-card reveal">
                <span className="eyebrow">Campaigns</span>
                <h1>Greater campaigns.</h1>
                <p>
                  Launch cause-based fundraising pages quickly, manage approvals cleanly, and run
                  one-time and monthly giving from the same platform.
                </p>
              </div>
            </section>
            <section className="section">
              <div className="container page-layout">
                <aside className="detail-side reveal">
                  <span className="detail-label">Need</span>
                  <strong>Campaign momentum should not die in the setup.</strong>
                  <p>
                    New appeals often arrive with urgency. Teams should not have to wait for dev
                    cycles, queue management, or fractured workflows before they can raise.
                  </p>
                </aside>
                <div className="detail-grid">
                  <article className="detail-card reveal">
                    <span className="detail-label">Why this matters</span>
                    <h2>Go live while the moment still matters.</h2>
                    <p>
                      Ekhum shortens the distance between need and launch. Create cause-based
                      pages, define the URL, manage approval, and take one-time or monthly
                      donations from one flow.
                    </p>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Feature set</span>
                    <div className="detail-list">
                      <article><strong>Dedicated campaign URLs</strong><p>Run multiple causes side by side with clean slugs and campaign-wise reporting.</p></article>
                      <article><strong>Go live fast</strong><p>Launch when the campaign is ready, not when the backlog clears.</p></article>
                      <article><strong>Pause when needed</strong><p>Update campaign status cleanly as an appeal changes or closes.</p></article>
                      <article><strong>Monthly and one-time together</strong><p>Let donors choose the giving rhythm without sending them into separate systems.</p></article>
                      <article><strong>Approval flow</strong><p>Route submissions and review to the right team before anything goes public.</p></article>
                    </div>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Outcome</span>
                    <h2>Greater urgency. Less friction.</h2>
                    <p>That is how fundraising teams stay close to the moment instead of getting buried in setup work.</p>
                  </article>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============================== PAGE 5: COMPLIANCE ============================== */}
        {currentPage === 'compliance' && (
          <div key="page-compliance">
            <section className="page-hero">
              <div className="container page-hero-card reveal">
                <span className="eyebrow">80G & Compliance</span>
                <h1>Greater compliance.</h1>
                <p>
                  Turn 80G and Form 10BD from recurring manual strain into a built-in operational
                  strength.
                </p>
              </div>
            </section>
            <section className="section">
              <div className="container page-layout">
                <aside className="detail-side reveal">
                  <span className="detail-label">Need</span>
                  <strong>The paperwork after generosity should not punish the team.</strong>
                  <p>
                    When receipting is manual, donors wait, staff scramble, and filing season
                    becomes an exercise in rebuilding the year from fragments.
                  </p>
                </aside>
                <div className="detail-grid">
                  <article className="detail-card reveal">
                    <span className="detail-label">Real-time flow</span>
                    <h2>The receipt should not be a later problem.</h2>
                    <p>
                      When a donation is confirmed, Ekhum generates the 80G certificate in real
                      time using your configured registration details and signatory. The donor gets
                      proof quickly. Your team does not rebuild the same document by hand.
                    </p>
                    <div className="detail-list">
                      <article><strong>Configure once</strong><p>Your 80G details live in the workspace, not in memory and inboxes.</p></article>
                      <article><strong>Generate instantly</strong><p>The certificate is created as the donation confirms.</p></article>
                      <article><strong>Deliver automatically</strong><p>The donor receives proof without manual chasing.</p></article>
                      <article><strong>Keep Form 10BD ready</strong><p>Reporting fields stay prepared throughout the year.</p></article>
                    </div>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Year-end relief</span>
                    <h2>March should feel orderly, not desperate.</h2>
                    <p>
                      Ekhum prepares the reporting trail as donations happen. That means less
                      reconstruction, less manual correction, and less filing-season chaos for
                      finance and operations teams.
                    </p>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Outcome</span>
                    <h2>Compliant by default. Calmer by design.</h2>
                    <p>That is what real infrastructure feels like inside a charity operation.</p>
                  </article>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============================== PAGE 6: ENGAGEMENT ============================== */}
        {currentPage === 'engagement' && (
          <div key="page-engagement">
            <section className="page-hero">
              <div className="container page-hero-card reveal">
                <span className="eyebrow">Donor Engagement</span>
                <h1>Greater donor trust.</h1>
                <p>Acknowledge the donor quickly, clearly, and in the channels that actually get seen.</p>
              </div>
            </section>
            <section className="section">
              <div className="container page-layout">
                <aside className="detail-side reveal">
                  <span className="detail-label">Need</span>
                  <strong>Silence after a donation is not neutral.</strong>
                  <p>
                    The moment after payment matters. It decides whether the gift feels complete,
                    whether the donor feels seen, and whether the relationship moves forward or stalls.
                  </p>
                </aside>
                <div className="detail-grid">
                  <article className="detail-card reveal">
                    <span className="detail-label">Why it matters</span>
                    <h2>Receipts are functional. Acknowledgement is strategic.</h2>
                    <p>
                      Ekhum handles both. WhatsApp and email messages can carry proof, thanks, and
                      next steps using your organisation’s setup, your templates, and your donor data.
                    </p>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Feature set</span>
                    <div className="detail-list">
                      <article><strong>Instant WhatsApp receipts</strong><p>Deliver proof quickly in the channel donors are most likely to notice.</p></article>
                      <article><strong>Branded email acknowledgement</strong><p>Keep the experience aligned with your organisation, not a generic system voice.</p></article>
                      <article><strong>Template control</strong><p>Use your own wording, your own structure, and your own message logic.</p></article>
                      <article><strong>Follow-up support</strong><p>Recover failed or incomplete payment journeys with clearer communication.</p></article>
                    </div>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Outcome</span>
                    <h2>Faster thanks. Stronger retention.</h2>
                    <p>Operational speed becomes donor trust when the response feels immediate and real.</p>
                  </article>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============================== PAGE 7: INTELLIGENCE ============================== */}
        {currentPage === 'intelligence' && (
          <div key="page-intelligence">
            <section className="page-hero">
              <div className="container page-hero-card reveal">
                <span className="eyebrow">AI & Metrics</span>
                <h1>Greater intelligence.</h1>
                <p>Use AI where it sharpens the team: faster donor follow-up, better drafting, and clearer visibility into fundraising performance.</p>
              </div>
            </section>
            <section className="section">
              <div className="container page-layout">
                <aside className="detail-side reveal">
                  <span className="detail-label">Need</span>
                  <strong>Not every message should start from a blank page.</strong>
                  <p>
                    Fundraising teams know what they want to say. What they often lack is time.
                    Better context and faster drafting give time back without cheapening the message.
                  </p>
                </aside>
                <div className="detail-grid">
                  <article className="detail-card reveal">
                    <span className="detail-label">AI support</span>
                    <h2>A first draft with context.</h2>
                    <p>
                      Ekhum’s AI copilot can use the actual record attached to the gift: cause,
                      amount, giving history, and donor details. That makes the draft more useful
                      than generic automation and far faster than writing every message from scratch.
                    </p>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Human review</span>
                    <h2>Human in charge. Always.</h2>
                    <p>
                      Nothing about donor trust should feel synthetic by accident. Ekhum uses AI as
                      support, not substitution. The team reviews what matters before it goes out.
                    </p>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Leadership view</span>
                    <h2>Greater visibility at a glance.</h2>
                    <div className="metrics-row">
                      <div className="metric-card"><small style={{ color: '#059669', fontWeight: 800 }}>Metric</small><strong>Gross</strong><p>Contributions tracked clearly.</p></div>
                      <div className="metric-card"><small style={{ color: '#059669', fontWeight: 800 }}>Metric</small><strong>Donors</strong><p>Total supporters visible at a glance.</p></div>
                      <div className="metric-card"><small style={{ color: '#059669', fontWeight: 800 }}>Metric</small><strong>Payments</strong><p>Completed transactions without manual collation.</p></div>
                      <div className="metric-card"><small style={{ color: '#059669', fontWeight: 800 }}>Metric</small><strong>Average gift</strong><p>Campaign performance that leadership can actually use.</p></div>
                    </div>
                  </article>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============================== PAGE 8: LEDGER ============================== */}
        {currentPage === 'ledger' && (
          <div key="page-ledger">
            <section className="page-hero">
              <div className="container page-hero-card reveal">
                <span className="eyebrow">Ledger & Payouts</span>
                <h1>Greater clarity.</h1>
                <p>Keep donors, transactions, campaign attribution, and payout visibility in one searchable record instead of scattered across inboxes, sheets, and memory.</p>
              </div>
            </section>
            <section className="section">
              <div className="container page-layout">
                <aside className="detail-side reveal">
                  <span className="detail-label">Need</span>
                  <strong>If the record is messy, the operation is slower.</strong>
                  <p>
                    Every missing field, every delayed lookup, every manual payout check adds drag.
                    Clean fundraising operations depend on clean records.
                  </p>
                </aside>
                <div className="detail-grid">
                  <article className="detail-card reveal">
                    <span className="detail-label">Searchable record</span>
                    <h2>One ledger. Fewer loose ends.</h2>
                    <p>
                      Ekhum records the core trail around every contribution: donor details,
                      campaign, amount, gateway, status, and receipt access. That makes donor
                      support faster, reporting cleaner, and audits less painful.
                    </p>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Payout visibility</span>
                    <h2>Know gross. Know net. Know what moved.</h2>
                    <p>
                      Campaign-wise gross and net visibility gives finance and fundraising teams a
                      common view of what is actually happening, instead of separate interpretations
                      from separate systems.
                    </p>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Outcome</span>
                    <h2>Audit-ready. Team-ready. Growth-ready.</h2>
                    <p>One searchable ledger changes how quickly the team can answer questions and move with confidence.</p>
                  </article>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============================== PAGE 9: PRICING ============================== */}
        {currentPage === 'pricing' && (
          <div key="page-pricing">
            <section className="page-hero">
              <div className="container page-hero-card reveal">
                <span className="eyebrow">Pricing</span>
                <h1>Greater value. One clear fee.</h1>
                <p>One platform fee covers campaign infrastructure, 80G automation, donor messaging, AI drafting support, reporting visibility, and the ledger layer that keeps the operation coherent.</p>
              </div>
            </section>
            <section className="section">
              <div className="container page-layout">
                <aside className="detail-side reveal">
                  <span className="detail-label">Commercial model</span>
                  <strong>One fee for the whole platform.</strong>
                  <p>The platform fee applies to funds raised. Payment gateway charges remain separate and are defined by the gateway provider.</p>
                </aside>
                <div className="detail-grid">
                  <article className="detail-card reveal">
                    <span className="detail-label">Price</span>
                    <h2>8% platform fee on funds raised.</h2>
                    <p>
                      Setup and onboarding are scoped with your organisation in advance. The point
                      is not to multiply line items. It is to replace fragmented operational cost
                      with one coherent system.
                    </p>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Why this matters</span>
                    <h2>Cheaper than fragmentation. Smarter than patchwork.</h2>
                    <p>
                      The real cost in fundraising operations is often not one visible bill. It is
                      the accumulation of disconnected tools, manual corrections, donor delay,
                      compliance strain, and staff time. Ekhum reduces that hidden cost by bringing
                      the system together.
                    </p>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Outcome</span>
                    <h2>Pay for coherence, not chaos.</h2>
                    <p>That is the simplest way to explain the value to operations, finance, and leadership together.</p>
                  </article>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============================== PAGE 10: ABOUT ============================== */}
        {currentPage === 'about' && (
          <div key="page-about">
            <section className="page-hero">
              <div className="container page-hero-card reveal">
                <span className="eyebrow">About</span>
                <h1>Built from the problem, not around it.</h1>
                <p>Ekhum comes out of real work in fundraising and communications, where the same breakdowns kept showing up: disconnected workflows, hand-built receipts, weak donor follow-up, and year-end reporting pain.</p>
              </div>
            </section>
            <section className="section">
              <div className="container page-layout">
                <aside className="detail-side reveal">
                  <span className="detail-label">Origin</span>
                  <strong>We kept seeing good organisations slowed by bad systems.</strong>
                  <p>That is why Ekhum exists. Not as abstract software. As a direct response to operational drag inside real charity work.</p>
                </aside>
                <div className="detail-grid">
                  <article className="detail-card reveal">
                    <span className="detail-label">Observation</span>
                    <h2>The problem was never the mission. It was the machinery around it.</h2>
                    <p>
                      Strong charities were losing time to handoffs, duplication, silence after
                      donations, and compliance strain. That pattern repeated often enough to make
                      one thing clear: the sector needed sharper infrastructure.
                    </p>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Ambition</span>
                    <h2>The ambition is bigger than admin.</h2>
                    <p>
                      Yes, Ekhum automates tasks. But the purpose is not automation for its own
                      sake. The purpose is to make the sector more capable, more trusted, more
                      effective, and better equipped to grow impact without multiplying friction.
                    </p>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Belief</span>
                    <h2>Good organisations deserve greater infrastructure.</h2>
                    <p>That belief sits underneath every workflow, every feature, and every line of the platform.</p>
                  </article>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============================== PAGE 11: DEMO ============================== */}
        {currentPage === 'demo' && (
          <div key="page-demo">
            <section className="page-hero">
              <div className="container page-hero-card reveal">
                <span className="eyebrow">Book a Demo</span>
                <h1>See one donation handled end to end.</h1>
                <p>We will show you how Ekhum manages campaigns, payments, 80G automation, donor communication, compliance output, and ledger records in one live workflow.</p>
              </div>
            </section>
            <section className="section">
              <div className="container page-layout">
                <aside className="detail-side reveal">
                  <span className="detail-label">Best way to start</span>
                  <strong>Bring one real campaign. We will show you the rest.</strong>
                  <p>The strongest demo starts with a real fundraising need: an active appeal, an operational bottleneck, or a compliance pain point.</p>
                </aside>
                <div className="detail-grid">
                  <article className="detail-card reveal">
                    <span className="detail-label">What you will see</span>
                    <div className="detail-list">
                      <article><strong>Campaign launch workflow</strong><p>How a new appeal gets created, approved, and published.</p></article>
                      <article><strong>Donation flow</strong><p>How Ekhum handles the operational chain the moment a donor gives.</p></article>
                      <article><strong>Compliance flow</strong><p>How 80G and Form 10BD readiness are built into the year, not left to the end.</p></article>
                      <article><strong>Ledger and reporting</strong><p>How teams search, trace, and answer questions without operational drift.</p></article>
                    </div>
                  </article>
                  <article className="detail-card reveal">
                    <span className="detail-label">Next step</span>
                    <h2>Book a walkthrough.</h2>
                    <p>
                      Experience the live donation processing chain, 80G generation, and real-time ledger accounting.
                    </p>
                    <div className="hero-actions">
                      <button className="button" onClick={onOpenNgoLogin}>
                        Login to Portal
                      </button>
                      <button className="button secondary" onClick={() => navigateTo('index')}>
                        Back to home
                      </button>
                    </div>
                  </article>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 3. SITE FOOTER WITH ALL PAGE LINKS                                        */}
      {/* ========================================================================= */}
      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <div className="brand" onClick={() => navigateTo('index')}>
              <EKhumLogo variant="full" size="sm" withTagline theme="light" />
            </div>
            <p className="footer-note" style={{ marginTop: '1rem' }}>Fundraising infrastructure for charities that want more flow, more trust, and more operational strength behind every donation.</p>
          </div>
          <div className="footer-links">
            <button onClick={() => navigateTo('index')}>Visual Home</button>
            <button onClick={() => navigateTo('index-text')}>Text Home</button>
            <button onClick={() => navigateTo('platform')}>Platform</button>
            <button onClick={() => navigateTo('campaigns')}>Campaigns</button>
            <button onClick={() => navigateTo('compliance')}>Compliance</button>
            <button onClick={() => navigateTo('engagement')}>Engagement</button>
            <button onClick={() => navigateTo('intelligence')}>AI & Metrics</button>
            <button onClick={() => navigateTo('ledger')}>Ledger</button>
            <button onClick={() => navigateTo('pricing')}>Pricing</button>
            <button onClick={() => navigateTo('about')}>About</button>
            <button onClick={() => navigateTo('demo')}>Book Demo</button>
          </div>
        </div>
      </footer>
    </div>
  );
};
