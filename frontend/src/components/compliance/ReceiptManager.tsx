import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable, Column } from '../shared/DataTable';
import { Modal } from '../shared/Modal';
import { KpiCard } from '../shared/KpiCard';
import { FormField } from '../shared/FormField';

export const ReceiptManager: React.FC = () => {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total_receipts: number; missing_pan_count: number; voided_count: number }>({
    total_receipts: 0,
    missing_pan_count: 0,
    voided_count: 0
  });
  const [loading, setLoading] = useState(true);
  const [fyFilter, setFyFilter] = useState('2023-24');
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
    { header: 'Donor Name', accessor: 'donor_name' },
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
    <div style={{ fontFamily: 'var(--font-body)', padding: '24px', color: 'var(--secondary)' }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>80G Receipt Management</h1>

      {stats.missing_pan_count > 0 ? (
        <div style={{ background: '#fef3c7', color: '#92400e', padding: '12px 16px', borderRadius: '6px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚠️ <strong>Missing PAN Alert:</strong> There {stats.missing_pan_count === 1 ? 'is 1 receipt' : `are ${stats.missing_pan_count} receipts`} pending generation due to missing PAN numbers.
        </div>
      ) : (
        <div style={{ background: '#ecfdf5', color: '#065f46', padding: '12px 16px', borderRadius: '6px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ✅ <strong>Compliance Verified:</strong> All recorded donations have valid PAN and statutory tax identification.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <KpiCard title="Total Receipts" value={stats.total_receipts} />
        <KpiCard title="Missing PAN Count" value={stats.missing_pan_count} />
        <KpiCard title="Voided Count" value={stats.voided_count} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <select 
          value={fyFilter}
          onChange={(e) => setFyFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff' }}
        >
          <option value="2024-25">FY 2024-25</option>
          <option value="2023-24">FY 2023-24</option>
          <option value="2022-23">FY 2022-23</option>
        </select>
      </div>

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
