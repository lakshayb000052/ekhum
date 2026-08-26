import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable, Column } from '../shared/DataTable';
import { Modal } from '../shared/Modal';

export const ObjectManager: React.FC = () => {
  const [objects, setObjects] = useState<any[]>([]);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Fields');

  // New Custom Field form
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [savingField, setSavingField] = useState(false);

  useEffect(() => {
    fetchObjects();
  }, []);

  useEffect(() => {
    if (selectedObject?.name) {
      fetchFields(selectedObject.name);
    }
  }, [selectedObject]);

  const fetchObjects = async () => {
    setLoadingObjects(true);
    try {
      const res = await apiFetch('/api/object-manager/objects');
      if (res && res.success && Array.isArray(res.data)) {
        setObjects(res.data);
        if (res.data.length > 0 && !selectedObject) {
          setSelectedObject(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load database objects:', err);
    } finally {
      setLoadingObjects(false);
    }
  };

  const fetchFields = async (tableName: string) => {
    setLoadingFields(true);
    try {
      const res = await apiFetch(`/api/object-manager/objects/${tableName}/fields`);
      if (res && res.success && Array.isArray(res.data)) {
        setFields(res.data);
      }
    } catch (err) {
      console.error('Failed to load fields:', err);
    } finally {
      setLoadingFields(false);
    }
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObject?.name || !newFieldName) return;
    setSavingField(true);
    try {
      const res = await apiFetch(`/api/object-manager/objects/${selectedObject.name}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_name: newFieldName,
          label: newFieldLabel || newFieldName,
          type: newFieldType
        })
      });
      if (res && res.success) {
        setIsModalOpen(false);
        setNewFieldName('');
        setNewFieldLabel('');
        fetchFields(selectedObject.name);
        fetchObjects();
      }
    } catch (err) {
      console.error('Failed to save field:', err);
    } finally {
      setSavingField(false);
    }
  };

  const fieldColumns: Column<any>[] = [
    { header: 'Field Name (Column)', accessor: 'name' },
    { header: 'Label', accessor: 'label' },
    { 
      header: 'Data Type', 
      accessor: (row) => (
        <span style={{ background: '#F1F5F9', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
          {row.type}
        </span>
      ) 
    },
    { header: 'Required', accessor: (row) => row.required ? '✅ Yes' : 'Optional' },
    { 
      header: 'Classification', 
      accessor: (row) => (
        <span style={{ 
          background: row.is_system ? '#EFF6FF' : '#ECFDF5', 
          color: row.is_system ? '#1D4ED8' : '#059669', 
          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 
        }}>
          {row.is_system ? 'System Core' : 'Custom Schema'}
        </span>
      ) 
    }
  ];

  return (
    <div style={{ fontFamily: 'var(--font-body)', padding: '24px', color: 'var(--secondary)', display: 'flex', gap: '24px', height: 'calc(100vh - 120px)' }}>
      
      {/* Left Panel - Object List */}
      <div style={{ width: '320px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#F8FAFC' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: '1.1rem' }}>Database Entities</h2>
          <span style={{ fontSize: '12px', color: '#64748B' }}>PostgreSQL Tables & Entities ({objects.length})</span>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {loadingObjects ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>Loading tables...</div>
          ) : (
            objects.map(obj => (
              <div 
                key={obj.name}
                onClick={() => setSelectedObject(obj)}
                style={{
                  padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                  background: selectedObject?.name === obj.name ? '#F1F5F9' : 'transparent',
                  border: selectedObject?.name === obj.name ? '1px solid #CBD5E1' : '1px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{obj.icon}</span>
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block', color: '#0F172A' }}>{obj.label}</strong>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>{obj.name}</span>
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#475569', background: '#E2E8F0', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                  {obj.fields} cols
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Object Detail */}
      <div style={{ flex: 1, background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedObject ? (
          <>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
              <div>
                <h1 style={{ fontFamily: 'var(--font-heading)', margin: '0 0 4px 0', fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{selectedObject.icon}</span> 
                  <span>{selectedObject.label}</span>
                  <code style={{ fontSize: '0.8rem', background: '#E2E8F0', padding: '2px 6px', borderRadius: '4px', fontWeight: 400 }}>{selectedObject.name}</code>
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>{selectedObject.description}</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                ➕ Add Custom Field
              </button>
            </div>

            <div style={{ padding: '0 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '24px' }}>
              {['Fields', 'Schema Details'].map(tab => (
                <button 
                  key={tab} onClick={() => setActiveTab(tab)}
                  style={{ 
                    background: 'none', border: 'none', padding: '14px 4px', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                    borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeTab === tab ? 'var(--primary)' : '#64748b'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              {activeTab === 'Fields' && (
                <DataTable data={fields} columns={fieldColumns} loading={loadingFields} emptyMessage="No column definitions found." />
              )}
              {activeTab === 'Schema Details' && (
                <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', lineHeight: '1.6' }}>
                  <h3 style={{ margin: '0 0 12px 0' }}>PostgreSQL Table: <code>{selectedObject.name}</code></h3>
                  <p>This table is managed directly in PostgreSQL and indexed for high-volume transactions and compliance auditing.</p>
                  <div><strong>Total Columns:</strong> {fields.length}</div>
                  <div><strong>System Key:</strong> Primary UUID (gen_random_uuid())</div>
                  <div><strong>Foreign Key Cascades:</strong> Managed via PostgreSQL Engine</div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>Select an object to inspect schema.</div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Add Field to ${selectedObject?.label || 'Object'}`}>
        <form onSubmit={handleSaveField} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Field Name (SQL Column)</label>
            <input 
              type="text" 
              value={newFieldName}
              onChange={e => setNewFieldName(e.target.value)}
              placeholder="e.g. donor_priority_tier" 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
              required 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Field Display Label</label>
            <input 
              type="text" 
              value={newFieldLabel}
              onChange={e => setNewFieldLabel(e.target.value)}
              placeholder="e.g. Donor Priority Tier" 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Data Type</label>
            <select 
              value={newFieldType}
              onChange={e => setNewFieldType(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff' }}
            >
              <option value="text">Text (VARCHAR/TEXT)</option>
              <option value="number">Number (NUMERIC/INTEGER)</option>
              <option value="date">Date & Time (TIMESTAMP)</option>
              <option value="boolean">Checkbox (BOOLEAN)</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={savingField} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: savingField ? 'wait' : 'pointer', fontWeight: 600 }}>
              {savingField ? 'Adding Column...' : '💾 Save Field'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
