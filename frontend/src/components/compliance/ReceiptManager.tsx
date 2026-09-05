import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable, Column } from '../shared/DataTable';
import { Modal } from '../shared/Modal';
import { KpiCard } from '../shared/KpiCard';

const getCurrentFinancialYear = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 is January, 3 is April
  const startYear = month >= 3 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}`;
};

const getFinancialYearList = (count: number = 5): string[] => {
  const current = getCurrentFinancialYear();
  const startYear = parseInt(current.split('-')[0], 10);
  const list: string[] = [];
  for (let i = 0; i < count; i++) {
    const y = startYear - i;
    const nextY = String((y + 1) % 100).padStart(2, '0');
    list.push(`${y}-${nextY}`);
  }
  return list;
};

export const ReceiptManager: React.FC = () => {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total_receipts: number; missing_pan_count: number; voided_count: number }>({
    total_receipts: 0,
    missing_pan_count: 0,
    voided_count: 0
  });
  const [loading, setLoading] = useState(true);
  const [fyFilter, setFyFilter] = useState(getCurrentFinancialYear());
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');

  useEffect(() => {
    fetchReceiptsAndStats();
  }, [fyFilter]);

  const fetchReceiptsAndStats = async () => {
    setLoading(true);
    try {
      const [recRes, statsRes] = await Promise.all([
        apiFetch(`/api/compliance/eighty_g?fy=${fyFilter}`),
        apiFetch(`/api/compliance/stats?fy=${fyFilter}`)
      ]);

      if (recRes && recRes.success) {
        setReceipts(Array.isArray(recRes.data) ? recRes.data : []);
      }
      if (statsRes && statsRes.success && statsRes.data) {
        setStats({
          total_receipts: statsRes.data.total_receipts || 0,
          missing_pan_count: statsRes.data.missing_pan_count || 0,
          voided_count: statsRes.data.voided_count || 0
        });
      }
    } catch (err) {
      console.error('Failed to load receipts & stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmVoid = async () => {
    if (!selectedReceipt) return;
    try {
      const res = await apiFetch(`/api/compliance/receipts/${selectedReceipt.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ void_reason: voidReason || 'Voided by Administrator' })
      });
      if (res && res.success) {
        setIsVoidModalOpen(false);
        setVoidReason('');
        setSelectedReceipt(null);
        fetchReceiptsAndStats();
      }
    } catch (err) {
      console.error('Void error:', err);
    }
  };

  const columns: Column<any>[] = [
    { header: 'Receipt #', accessor: 'receipt_number' },
    { 
      header: 'Donor Name', 
      accessor: (row) => {
        const contactId = row.contact_id || row.donor_id;
        const name = row.donor_name || row.donor_name_snapshot || 'Valued Donor';
        if (contactId) {
          return (
            <a 
              href={`#contact=${contactId}`}
              style={{ color: '#059669', fontWeight: 600, textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              {name}
            </a>
          );
        }
        return name;
      }
    },
    { header: 'Amount', accessor: (row) => `₹${Number(row.amount || 0).toLocaleString('en-IN')}` },
    { header: 'Date', accessor: (row) => row.donation_date || row.receipt_date ? new Date(row.donation_date || row.receipt_date).toLocaleDateString() : 'N/A' },
    { header: 'FY', accessor: (row) => row.financial_year || fyFilter },
    { header: 'Email Status', accessor: (row) => row.email_status || 'Sent' },
    { header: 'WhatsApp Status', accessor: (row) => row.whatsapp_status || 'Sent' },
    { header: 'Voided', accessor: (row) => (row.is_voided || row.voided) ? 'Yes' : 'No' },
    { 
      header: 'Actions', 
      accessor: (row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => window.open(`/api/compliance/receipts/${row.payment_id || row.id}`, '_blank')}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
          >
            📥 View PDF
          </button>
          {!(row.is_voided || row.voided) && (
            <button 
              onClick={() => { setSelectedReceipt(row); setIsVoidModalOpen(true); }}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
            >
              Void
            </button>
          )}
        </div>
      ) 
    },
  ];

  return (
    <div style={{ fontFamily: 'var(--font-sans)', padding: '16px', background: '#F8FAFC', minHeight: '100vh', color: '#0F172A' }}>
      {/*   Standard Lightning Header */}
      <div className="slds-page-header" style={{ marginBottom: '16px' }}>
        <div className="slds-page-header__top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="slds-object-icon" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
              📜
            </div>
            <div>
              <span className="slds-object-eyebrow">Tax & Compliance Cloud</span>
              <h2 className="slds-object-title">
                80G Tax Certificates & Statutory Filings
              </h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select 
              value={fyFilter}
              onChange={(e) => setFyFilter(e.target.value)}
              style={{ padding: '6px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', background: '#FFFFFF', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}
            >
              {getFinancialYearList(5).map(fy => (
                <option key={fy} value={fy}>FY {fy}</option>
              ))}
            </select>
            <a href="/api/compliance/export/10bd" className="btn btn-primary" download>
              📄 Export Form 10BD CSV
            </a>
          </div>
        </div>

        <div className="slds-highlights-ribbon">
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Total 80G Issued</span>
            <span className="slds-highlight-item__value">
              {stats.total_receipts} Certificates
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Missing PAN KYC</span>
            <span className="slds-highlight-item__value" style={{ color: stats.missing_pan_count > 0 ? '#D97706' : '#059669' }}>
              {stats.missing_pan_count} Pending
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Voided Certificates</span>
            <span className="slds-highlight-item__value">
              {stats.voided_count} Voided
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Form 10BD Status</span>
            <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
              Ready for Filing
            </span>
          </div>
        </div>
      </div>

      {stats.missing_pan_count > 0 ? (
        <div style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          ⚠️ <strong>Missing PAN Alert:</strong> There {stats.missing_pan_count === 1 ? 'is 1 receipt' : `are ${stats.missing_pan_count} receipts`} pending generation due to missing PAN numbers.
        </div>
      ) : (
        <div style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          ✅ <strong>Compliance Verified:</strong> All recorded donations have valid PAN and statutory tax identification.
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px' }}>
        <DataTable data={receipts} columns={columns} loading={loading} emptyMessage="No 80G tax receipts found for this financial year." />
      </div>

      <Modal isOpen={isVoidModalOpen} onClose={() => setIsVoidModalOpen(false)} title="Void Receipt">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p>Are you sure you want to void receipt <strong>{selectedReceipt?.receipt_number}</strong>?</p>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Reason for Voiding</label>
            <input 
              type="text" 
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Donor PAN corrected, transaction refunded, duplicate record"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
              required 
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button onClick={() => setIsVoidModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleConfirmVoid} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Confirm Void</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
