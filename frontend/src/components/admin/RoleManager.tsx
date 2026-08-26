import React, { useState } from 'react';
import { Modal } from '../shared/Modal';

const DEFAULT_ROLES = ['Super Admin', 'NGO Admin', 'NGO Manager', 'NGO Auditor / Viewer'];
const OBJECTS = ['Contacts', 'Donations', 'Campaigns', 'Subscriptions', 'Mandates', '80G Compliance', 'Broadcasts'];
const ACTIONS = ['Create', 'Read', 'Update', 'Delete', 'Export', 'Approve'];

export const RoleManager: React.FC = () => {
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [selectedRole, setSelectedRole] = useState(DEFAULT_ROLES[1]);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isSystemRole = ['Super Admin', 'NGO Admin'].includes(selectedRole);

  const getPermKey = (role: string, obj: string, act: string) => `${role}:${obj}:${act}`;

  const isChecked = (obj: string, act: string) => {
    if (selectedRole === 'Super Admin' || selectedRole === 'NGO Admin') return true;
    const key = getPermKey(selectedRole, obj, act);
    if (permissions[key] !== undefined) return permissions[key];
    if (selectedRole === 'NGO Auditor / Viewer') return act === 'Read' || act === 'Export';
    if (selectedRole === 'NGO Manager') return act !== 'Delete';
    return true;
  };

  const handleToggle = (obj: string, act: string) => {
    if (isSystemRole) return;
    const key = getPermKey(selectedRole, obj, act);
    setPermissions(prev => ({
      ...prev,
      [key]: !isChecked(obj, act)
    }));
    setSaveSuccess(false);
  };

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName) return;
    if (!roles.includes(newRoleName)) {
      setRoles([...roles, newRoleName]);
      setSelectedRole(newRoleName);
    }
    setNewRoleName('');
    setIsCreateModalOpen(false);
  };

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div style={{ fontFamily: 'var(--font-body)', padding: '24px', color: 'var(--secondary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', margin: 0 }}>Roles & Permission Matrix</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Configure granular object-level CRUD and export permissions across administrative and field roles.
          </p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          ➕ Create Custom Role
        </button>
      </div>

      <div style={{ display: 'flex', gap: '24px' }}>
        
        {/* Role List */}
        <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {roles.map(role => (
            <button
              key={role}
              onClick={() => { setSelectedRole(role); setSaveSuccess(false); }}
              style={{
                textAlign: 'left', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                border: selectedRole === role ? '1px solid var(--primary)' : '1px solid #e2e8f0',
                background: selectedRole === role ? 'var(--primary)' : '#fff',
                color: selectedRole === role ? '#fff' : '#0F172A',
                fontWeight: 600,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}
            >
              <span>{role}</span>
              {['Super Admin', 'NGO Admin'].includes(role) && (
                <span style={{ fontSize: '11px', background: selectedRole === role ? 'rgba(255,255,255,0.2)' : '#F1F5F9', color: selectedRole === role ? '#fff' : '#475569', padding: '2px 6px', borderRadius: '4px' }}>System</span>
              )}
            </button>
          ))}
        </div>

        {/* Permission Matrix */}
        <div style={{ flex: 1, background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: '1.25rem' }}>Role Matrix: {selectedRole}</h2>
            {isSystemRole ? (
              <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                🔒 System Core Role (Locked)
              </span>
            ) : (
              <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                ⚙️ Custom Role
              </span>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid #e2e8f0', color: '#0F172A' }}>Entity Object</th>
                  {ACTIONS.map(action => (
                    <th key={action} style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 600, fontSize: '13px' }}>{action}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {OBJECTS.map(obj => (
                  <tr key={obj} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ textAlign: 'left', padding: '14px 12px', fontWeight: 600, color: '#1E293B', fontSize: '14px' }}>{obj}</td>
                    {ACTIONS.map(action => (
                      <td key={`${obj}-${action}`} style={{ padding: '14px 12px' }}>
                        <label style={{ display: 'inline-flex', cursor: isSystemRole ? 'not-allowed' : 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked(obj, action)}
                            disabled={isSystemRole}
                            onChange={() => handleToggle(obj, action)}
                            style={{ 
                              width: '18px', height: '18px', cursor: isSystemRole ? 'not-allowed' : 'pointer',
                              accentColor: 'var(--primary)'
                            }} 
                          />
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {!isSystemRole && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
              {saveSuccess && <span style={{ color: '#059669', fontWeight: 600, fontSize: '14px' }}>✅ Role permissions saved successfully!</span>}
              <button 
                onClick={handleSave}
                style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
              >
                💾 Save Role Matrix
              </button>
            </div>
          )}
        </div>

      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Custom Role">
        <form onSubmit={handleCreateRole} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Role Name</label>
            <input 
              type="text" 
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              placeholder="e.g. Field Operations Coordinator"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              required 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={() => setIsCreateModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: '#fff', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
              ➕ Create Role
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
