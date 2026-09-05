import React, { useState, useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { DataTable, Column } from '../shared/DataTable';
import { Modal } from '../shared/Modal';

export const ObjectManager: React.FC = () => {
  const [objects, setObjects] = useState<any[]>([]);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [schemaGraph, setSchemaGraph] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [loadingObjects, setLoadingObjects] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [activeTab, setActiveTab] = useState<'fields' | 'designer' | 'details'>('fields');

  // Modals
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [isObjectModalOpen, setIsObjectModalOpen] = useState(false);

  // New Field Form
  const [fieldName, setFieldName] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [isRequired, setIsRequired] = useState(false);
  const [picklistOptions, setPicklistOptions] = useState('');
  const [lookupTarget, setLookupTarget] = useState('donors');
  const [helpText, setHelpText] = useState('');
  const [savingField, setSavingField] = useState(false);

  // New Object Form
  const [newObjName, setNewObjName] = useState('');
  const [newObjLabelSingular, setNewObjLabelSingular] = useState('');
  const [newObjLabelPlural, setNewObjLabelPlural] = useState('');
  const [newObjDesc, setNewObjDesc] = useState('');
  const [newObjIcon, setNewObjIcon] = useState('🧩');
  const [savingObject, setSavingObject] = useState(false);

  useEffect(() => {
    fetchObjects();
    fetchSchemaGraph();
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

  const fetchSchemaGraph = async () => {
    try {
      const res = await apiFetch('/api/object-manager/schema-graph');
      if (res && res.success && res.data) {
        setSchemaGraph(res.data);
      }
    } catch (err) {
      console.error('Failed to load schema graph:', err);
    }
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObject?.name || !fieldName) return;
    setSavingField(true);
    try {
      const picklistArr = fieldType === 'picklist' 
        ? picklistOptions.split(',').map(s => s.trim()).filter(Boolean) 
        : [];

      const res = await apiFetch(`/api/object-manager/objects/${selectedObject.name}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_name: fieldName,
          field_label: fieldLabel || fieldName,
          field_type: fieldType,
          is_required: isRequired,
          picklist_values: picklistArr,
          lookup_target_object: fieldType === 'lookup' ? lookupTarget : null,
          help_text: helpText || null
        })
      });

      if (res && res.success) {
        setIsFieldModalOpen(false);
        setFieldName('');
        setFieldLabel('');
        setPicklistOptions('');
        setHelpText('');
        fetchFields(selectedObject.name);
        fetchObjects();
        fetchSchemaGraph();
      }
    } catch (err) {
      console.error('Failed to save field:', err);
    } finally {
      setSavingField(false);
    }
  };

  const handleCreateObject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObjName || !newObjLabelSingular) return;
    setSavingObject(true);
    try {
      const res = await apiFetch('/api/object-manager/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          object_name: newObjName,
          label_singular: newObjLabelSingular,
          label_plural: newObjLabelPlural || `${newObjLabelSingular}s`,
          description: newObjDesc,
          icon: newObjIcon
        })
      });

      if (res && res.success) {
        setIsObjectModalOpen(false);
        setNewObjName('');
        setNewObjLabelSingular('');
        setNewObjLabelPlural('');
        setNewObjDesc('');
        fetchObjects();
        fetchSchemaGraph();
      }
    } catch (err) {
      console.error('Failed to create custom object:', err);
    } finally {
      setSavingObject(false);
    }
  };

  const fieldColumns: Column<any>[] = [
    { 
      header: 'Field Label & Column', 
      accessor: (row) => (
        <div>
          <strong style={{ color: '#0F172A', display: 'block' }}>{row.label}</strong>
          <code style={{ fontSize: '11px', color: '#64748B' }}>{row.name}</code>
        </div>
      )
    },
    { 
      header: 'Data Type', 
      accessor: (row) => {
        const typeColors: Record<string, { bg: string; text: string }> = {
          currency: { bg: '#DCFCE7', text: '#15803D' },
          number: { bg: '#EFF6FF', text: '#1D4ED8' },
          date: { bg: '#FEF3C7', text: '#B45309' },
          datetime: { bg: '#FEF3C7', text: '#B45309' },
          boolean: { bg: '#F3E8FF', text: '#7E22CE' },
          picklist: { bg: '#FCE7F3', text: '#BE185D' },
          lookup: { bg: '#E0F2FE', text: '#0369A1' },
          text: { bg: '#F1F5F9', text: '#334155' }
        };
        const c = typeColors[row.type] || typeColors.text;
        return (
          <span style={{ background: c.bg, color: c.text, padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
            {row.type}
          </span>
        );
      } 
    },
    { 
      header: 'Attributes / Options', 
      accessor: (row) => {
        if (row.type === 'picklist' && row.picklistValues?.length > 0) {
          return <span style={{ fontSize: '11px', color: '#475569' }}>Options: {row.picklistValues.slice(0, 3).join(', ')}{row.picklistValues.length > 3 ? '...' : ''}</span>;
        }
        if (row.type === 'lookup') {
          return <span style={{ fontSize: '11px', color: '#0369A1' }}>🔗 References: {row.lookupTargetObject || 'Object'}</span>;
        }
        return row.required ? <span style={{ color: '#DC2626', fontWeight: 600, fontSize: '12px' }}>Required *</span> : <span style={{ color: '#94A3B8', fontSize: '12px' }}>Optional</span>;
      }
    },
    { 
      header: 'Classification', 
      accessor: (row) => (
        <span style={{ 
          background: row.isSystem ? '#EFF6FF' : '#ECFDF5', 
          color: row.isSystem ? '#1D4ED8' : '#059669', 
          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 
        }}>
          {row.isSystem ? '🔒 System Core' : '✨ Custom Schema'}
        </span>
      ) 
    }
  ];

  return (
    <div style={{ fontFamily: 'var(--font-sans)', padding: '16px', background: '#F8FAFC', minHeight: '100vh', color: '#0F172A', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Lightning Header */}
      <div className="slds-page-header">
        <div className="slds-page-header__top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="slds-object-icon" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
              ⚙️
            </div>
            <div>
              <span className="slds-object-eyebrow">Data Architecture Studio</span>
              <h2 className="slds-object-title">
                Object Manager & Schema Designer
              </h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setIsObjectModalOpen(true)}
              style={{ background: '#FFFFFF', border: '1.5px solid #CBD5E1', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>🧩</span>
              <span>New Custom Object</span>
            </button>
            <button 
              onClick={() => setIsFieldModalOpen(true)}
              className="btn btn-primary"
            >
              <span>➕</span>
              <span>Add Custom Field</span>
            </button>
          </div>
        </div>

        <div className="slds-highlights-ribbon">
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Registered Objects</span>
            <span className="slds-highlight-item__value">
              {objects.length} Entities
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Active Selected Object</span>
            <span className="slds-highlight-item__value" style={{ color: '#059669' }}>
              {selectedObject?.label || 'None'}
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Total Fields / Columns</span>
            <span className="slds-highlight-item__value">
              {fields.length} Fields
            </span>
          </div>
          <div className="slds-highlight-item">
            <span className="slds-highlight-item__label">Database Engine</span>
            <span className="slds-highlight-item__value">
              PostgreSQL 16 (Multi-Tenant)
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* Left Panel - Entity Explorer */}
        <div style={{ width: '320px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>Database Entities</h2>
              <span style={{ fontSize: '11px', color: '#64748B' }}>PostgreSQL Schemas & Custom Objects</span>
            </div>
            <span style={{ fontSize: '11px', background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
              {objects.length}
            </span>
          </div>

          <div style={{ overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            {loadingObjects ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>Loading tables...</div>
            ) : (
              objects.map(obj => {
                const isSelected = selectedObject?.name === obj.name;
                return (
                  <div 
                    key={obj.name}
                    onClick={() => setSelectedObject(obj)}
                    style={{
                      padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                      background: isSelected ? '#ECFDF5' : 'transparent',
                      border: isSelected ? '1px solid #A7F3D0' : '1px solid transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.25rem' }}>{obj.icon}</span>
                      <div>
                        <strong style={{ fontSize: '13px', display: 'block', color: isSelected ? '#065F46' : '#0F172A' }}>{obj.label}</strong>
                        <code style={{ fontSize: '11px', color: '#64748B' }}>{obj.name}</code>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: '#475569', background: '#E2E8F0', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, display: 'inline-block' }}>
                        {obj.fieldCount} cols
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel - Schema Details & ER Designer */}
        <div style={{ flex: 1, background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedObject ? (
            <>
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
                <div>
                  <h1 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{selectedObject.icon}</span> 
                    <span>{selectedObject.label}</span>
                    <code style={{ fontSize: '0.8rem', background: '#E2E8F0', padding: '2px 8px', borderRadius: '4px', fontWeight: 400 }}>{selectedObject.name}</code>
                    {selectedObject.isCustom && (
                      <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>Custom Entity</span>
                    )}
                  </h1>
                  <p style={{ margin: 0, color: '#64748B', fontSize: '13px' }}>{selectedObject.description}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={() => setIsFieldModalOpen(true)}
                    style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                  >
                    ➕ Add Custom Field
                  </button>
                </div>
              </div>

              {/* View Tabs */}
              <div style={{ padding: '0 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '24px' }}>
                {[
                  { id: 'fields', label: `Fields & Columns (${fields.length})` },
                  { id: 'designer', label: '🕸️ Schema Visualizer & ER Diagram' },
                  { id: 'details', label: '⚙️ Table & Storage Details' }
                ].map(tab => (
                  <button 
                    key={tab.id} 
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{ 
                      background: 'none', border: 'none', padding: '14px 4px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                      borderBottom: activeTab === tab.id ? '2px solid #059669' : '2px solid transparent',
                      color: activeTab === tab.id ? '#059669' : '#64748B'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
                {activeTab === 'fields' && (
                  <DataTable data={fields} columns={fieldColumns} loading={loadingFields} emptyMessage="No column definitions found." />
                )}

                {activeTab === 'designer' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
                      <h4 style={{ margin: '0 0 6px 0', color: '#0F172A' }}>🕸️ Relational Schema Designer</h4>
                      <p style={{ margin: 0, color: '#64748B' }}>
                        Live relationship graph of all database entities with primary and foreign key links. All entities can be queried seamlessly across Segments and Reports.
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                      {schemaGraph.nodes.map(node => (
                        <div 
                          key={node.id} 
                          style={{ 
                            background: '#FFFFFF', borderRadius: '8px', border: node.id === selectedObject.name ? '2px solid #059669' : '1px solid #CBD5E1', 
                            boxShadow: '0 2px 4px rgba(0,0,0,0.04)', overflow: 'hidden'
                          }}
                        >
                          <div style={{ padding: '10px 14px', background: node.id === selectedObject.name ? '#ECFDF5' : '#F1F5F9', borderBottom: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{node.icon}</span>
                              <span>{node.label}</span>
                            </strong>
                            <code style={{ fontSize: '11px', color: '#64748B' }}>{node.id}</code>
                          </div>
                          <div style={{ padding: '10px', maxHeight: '160px', overflowY: 'auto', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {node.fields.slice(0, 8).map((f: any) => (
                              <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px dashed #F1F5F9' }}>
                                <span style={{ color: f.isSystem ? '#0F172A' : '#059669' }}>{f.name}</span>
                                <span style={{ color: '#94A3B8', fontSize: '10px' }}>{f.type}</span>
                              </div>
                            ))}
                            {node.fields.length > 8 && (
                              <div style={{ fontSize: '11px', color: '#64748B', textAlign: 'center', paddingTop: '4px' }}>
                                + {node.fields.length - 8} more fields...
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>🔗 Connected Foreign Key Relationships ({schemaGraph.edges.length})</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                        {schemaGraph.edges.map((edge, idx) => (
                          <div key={idx} style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong>{edge.source}</strong> ➔ <strong>{edge.target}</strong>
                              <span style={{ color: '#64748B', marginLeft: '8px' }}>via <code>{edge.foreignKey}</code></span>
                            </div>
                            <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '11px' }}>
                              {edge.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'details' && (
                  <div style={{ padding: '20px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', lineHeight: '1.8' }}>
                    <h3 style={{ margin: '0 0 12px 0' }}>PostgreSQL Storage Specs: <code>{selectedObject.name}</code></h3>
                    <div><strong>Table Identifier:</strong> <code>public.{selectedObject.name}</code></div>
                    <div><strong>Primary Key:</strong> UUID (Gen Random UUID v4)</div>
                    <div><strong>Tenant Isolation:</strong> Partitioned / Filtered via <code>organization_id</code></div>
                    <div><strong>Total Registered Fields:</strong> {fields.length} Column Definitions</div>
                    <div><strong>Active Records:</strong> {selectedObject.recordCount} rows in database</div>
                    <div><strong>Schema Type:</strong> {selectedObject.isCustom ? 'User-Defined Custom Entity' : 'Core Statutory System Table'}</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>Select an object to inspect schema.</div>
          )}
        </div>
      </div>

      {/* Add Custom Field Modal */}
      <Modal isOpen={isFieldModalOpen} onClose={() => setIsFieldModalOpen(false)} title={`Add Field to ${selectedObject?.label || 'Object'}`}>
        <form onSubmit={handleSaveField} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Field Name (SQL Column Identifier)</label>
            <input 
              type="text" 
              value={fieldName}
              onChange={e => setFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="e.g. donor_tier_vip" 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontFamily: 'monospace' }}
              required 
            />
            <span style={{ fontSize: '11px', color: '#64748B' }}>Will be added as a physical column in PostgreSQL table <code>{selectedObject?.name}</code></span>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Field Display Label</label>
            <input 
              type="text" 
              value={fieldLabel}
              onChange={e => setFieldLabel(e.target.value)}
              placeholder="e.g. VIP Donor Tier" 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              required 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Data Type</label>
            <select 
              value={fieldType}
              onChange={e => setFieldType(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#fff' }}
            >
              <option value="text">📝 Text (Short String)</option>
              <option value="textarea">📄 Long Text / Description</option>
              <option value="currency">💰 Currency (INR ₹)</option>
              <option value="number">🔢 Number (Integer / Decimal)</option>
              <option value="date">📅 Date</option>
              <option value="datetime">⏰ Date & Time</option>
              <option value="boolean">☑️ Checkbox (Boolean True/False)</option>
              <option value="picklist">📋 Picklist / Dropdown Select</option>
              <option value="email">📧 Email Address</option>
              <option value="phone">📞 Phone Number</option>
              <option value="url">🔗 Web Link (URL)</option>
              <option value="lookup">🔍 Lookup Relationship (Foreign Key)</option>
            </select>
          </div>

          {fieldType === 'picklist' && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Picklist Options (Comma Separated)</label>
              <input 
                type="text" 
                value={picklistOptions}
                onChange={e => setPicklistOptions(e.target.value)}
                placeholder="e.g. Platinum, Gold, Silver, Bronze" 
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                required 
              />
            </div>
          )}

          {fieldType === 'lookup' && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Target Lookup Object</label>
              <select 
                value={lookupTarget}
                onChange={e => setLookupTarget(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#fff' }}
              >
                {objects.map(o => (
                  <option key={o.name} value={o.name}>{o.icon} {o.label} ({o.name})</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
            <input 
              type="checkbox" 
              id="is_req_check"
              checked={isRequired}
              onChange={e => setIsRequired(e.target.checked)}
            />
            <label htmlFor="is_req_check" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Mandatory Field (Required)</label>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Help Text / Documentation</label>
            <input 
              type="text" 
              value={helpText}
              onChange={e => setHelpText(e.target.value)}
              placeholder="Instructions or validation guide for staff" 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button type="button" onClick={() => setIsFieldModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={savingField} style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: savingField ? 'wait' : 'pointer', fontWeight: 600 }}>
              {savingField ? 'Adding Column...' : '💾 Add Custom Field'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Custom Object Modal */}
      <Modal isOpen={isObjectModalOpen} onClose={() => setIsObjectModalOpen(false)} title="Create New Custom Object">
        <form onSubmit={handleCreateObject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Object API Name</label>
            <input 
              type="text" 
              value={newObjName}
              onChange={e => setNewObjName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="e.g. volunteer_assignments" 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontFamily: 'monospace' }}
              required 
            />
            <span style={{ fontSize: '11px', color: '#64748B' }}>PostgreSQL table <code>c_{newObjName || 'name'}</code> will be provisioned</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Singular Label</label>
              <input 
                type="text" 
                value={newObjLabelSingular}
                onChange={e => setNewObjLabelSingular(e.target.value)}
                placeholder="e.g. Volunteer Assignment" 
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Plural Label</label>
              <input 
                type="text" 
                value={newObjLabelPlural}
                onChange={e => setNewObjLabelPlural(e.target.value)}
                placeholder="e.g. Volunteer Assignments" 
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Entity Icon</label>
            <input 
              type="text" 
              value={newObjIcon}
              onChange={e => setNewObjIcon(e.target.value)}
              placeholder="e.g. 🤝, 📦, 🏥, 🏆" 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Description</label>
            <textarea 
              value={newObjDesc}
              onChange={e => setNewObjDesc(e.target.value)}
              placeholder="Purpose of this database entity" 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', minHeight: '60px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button type="button" onClick={() => setIsObjectModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={savingObject} style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: savingObject ? 'wait' : 'pointer', fontWeight: 600 }}>
              {savingObject ? 'Provisioning Table...' : '🚀 Create Entity'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
