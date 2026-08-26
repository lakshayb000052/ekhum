import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { KpiCard } from '../shared/KpiCard';
import { DataTable } from '../shared/DataTable';

export const JourneyStats: React.FC<{ journeyId: string }> = ({ journeyId }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [journeyId]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/journeys/${journeyId}/stats`);
      if (res && res.success && res.data) {
        setStats(res.data);
      } else {
        setStats({
          funnel: { entered: 0, active: 0, completed: 0, goal_achieved: 0 },
          steps: [],
          channels: {
            email: { sent: 0, delivered: 0, opened: 0 },
            whatsapp: { sent: 0, delivered: 0, read: 0 }
          }
        });
      }
    } catch (err) {
      console.error('Failed to load journey stats:', err);
      setStats({
        funnel: { entered: 0, active: 0, completed: 0, goal_achieved: 0 },
        steps: [],
        channels: {
          email: { sent: 0, delivered: 0, opened: 0 },
          whatsapp: { sent: 0, delivered: 0, read: 0 }
        }
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading journey analytics...</div>;
  }

  const emailSent = stats.channels?.email?.sent || 0;
  const emailOpened = stats.channels?.email?.opened || 0;
  const emailOpenRate = emailSent > 0 ? Math.round((emailOpened / emailSent) * 100) : 0;

  const waSent = stats.channels?.whatsapp?.sent || 0;
  const waRead = stats.channels?.whatsapp?.read || 0;
  const waReadRate = waSent > 0 ? Math.round((waRead / waSent) * 100) : 0;

  const stepColumns = [
    { header: 'Step Name', accessor: 'name' },
    { header: 'Step Type', accessor: 'type' },
    { header: 'Processed Count', accessor: 'processed' },
    { header: 'Estimated Duration', accessor: 'avg_time' }
  ];

  return (
    <div style={{ padding: '24px', background: '#f8fafc', color: '#0F172A' }}>
      <h2 style={{ marginBottom: '24px', fontSize: '1.5rem', fontWeight: 700 }}>Journey Analytics & Funnel</h2>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', color: '#334155' }}>Funnel Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <KpiCard title="Entered Donors" value={stats.funnel?.entered ?? 0} />
          <KpiCard title="Active In-Flight" value={stats.funnel?.active ?? 0} />
          <KpiCard title="Completed Journey" value={stats.funnel?.completed ?? 0} />
          <KpiCard title="Goal Achieved" value={stats.funnel?.goal_achieved ?? 0} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#0F172A', fontSize: '1.05rem' }}>📧 Email Channel Performance</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
            <span>Sent:</span> <strong>{emailSent}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
            <span>Delivered:</span> <strong>{stats.channels?.email?.delivered || 0}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
            <span>Opened:</span> <strong>{emailOpened}</strong>
          </div>
          <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginTop: '12px' }}>
            <div style={{ height: '100%', width: `${emailOpenRate}%`, background: '#059669' }}></div>
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'right', marginTop: '6px' }}>
            {emailOpenRate}% Open Rate
          </p>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#0F172A', fontSize: '1.05rem' }}>💬 WhatsApp Channel Performance</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
            <span>Sent:</span> <strong>{waSent}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
            <span>Delivered:</span> <strong>{stats.channels?.whatsapp?.delivered || 0}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
            <span>Read:</span> <strong>{waRead}</strong>
          </div>
          <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginTop: '12px' }}>
            <div style={{ height: '100%', width: `${waReadRate}%`, background: '#059669' }}></div>
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'right', marginTop: '6px' }}>
            {waReadRate}% Read Rate
          </p>
        </div>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#0F172A', fontSize: '1.05rem' }}>Step-by-Step Execution Breakdown</h3>
        <DataTable columns={stepColumns} data={stats.steps || []} emptyMessage="No steps configured for this journey yet." />
      </div>
    </div>
  );
};
