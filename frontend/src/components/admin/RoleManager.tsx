import React, { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal';

interface MatrixObject {
  key: string;
  label: string;
  category: string;
  icon: string;
  description: string;
  supportedActions: string[];
}

interface ActionMeta {
  key: string;
  label: string;
  description: string;
}

interface RoleItem {
  id: string;
  organization_id?: string;
  name: string;
  display_name: string;
  description?: string;
  is_system: boolean;
  permissions: Record<string, Record<string, boolean>>;
  member_count?: number;
  created_at?: string;
}

interface MemberItem {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  status: string;
  last_login_at?: string;
  created_at: string;
  role: {
    id?: string;
    name: string;
    display_name: string;
    is_system: boolean;
  };
}

export const RoleManager: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'matrix' | 'members'>('matrix');

  // Matrix Data State
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [matrixSchema, setMatrixSchema] = useState<{ objects: MatrixObject[]; actions: ActionMeta[]; categories: string[] }>({
    objects: [],
    actions: [],
    categories: []
  });
  const [editableMatrix, setEditableMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [roleSearch, setRoleSearch] = useState('');
  const [objectSearch, setObjectSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Members State
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState('all');

  // UI Status
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({
    display_name: '',
    description: '',
    clone_from_role_id: ''
  });

  const [isInviteMemberModalOpen, setIsInviteMemberModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role_id: '',
    password: ''
  });

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Fetch Matrix Schema, Roles, and Members
  const loadData = async () => {
    try {
      setLoading(true);
      const [schemaRes, rolesRes, membersRes] = await Promise.all([
        fetch('/api/roles/matrix/schema', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/roles', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/roles/members/list', { credentials: 'include' }).then(r => r.json())
      ]);

      if (schemaRes.success && schemaRes.data) {
        setMatrixSchema(schemaRes.data);
      }

      if (rolesRes.success && rolesRes.data) {
        setRoles(rolesRes.data);
        if (rolesRes.data.length > 0) {
          // Select default (first non-superadmin or first role)
          const defaultRole = rolesRes.data.find((r: RoleItem) => r.name === 'ngo_admin') || rolesRes.data[0];
          setSelectedRole(defaultRole);
          setEditableMatrix(JSON.parse(JSON.stringify(defaultRole.permissions || {})));
        }
      }

      if (membersRes.success && membersRes.data) {
        setMembers(membersRes.data);
      }
    } catch (err: any) {
      console.error('Error loading RBAC roles:', err);
      showToast('Failed to load roles from server: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When selected role changes, reset editable matrix
  const handleSelectRole = (role: RoleItem) => {
    setSelectedRole(role);
    setEditableMatrix(JSON.parse(JSON.stringify(role.permissions || {})));
  };

  // Toggle single action on object
  const handleToggle = (objKey: string, actionKey: string) => {
    if (!selectedRole || selectedRole.is_system) return;

    setEditableMatrix(prev => {
      const objPerms = { ...(prev[objKey] || {}) };
      objPerms[actionKey] = !objPerms[actionKey];
      return {
        ...prev,
        [objKey]: objPerms
      };
    });
  };

  // Row-level batch actions
  const handleSetRowPermissions = (objKey: string, mode: 'all' | 'readonly' | 'none') => {
    if (!selectedRole || selectedRole.is_system) return;

    const targetObj = matrixSchema.objects.find(o => o.key === objKey);
    if (!targetObj) return;

    setEditableMatrix(prev => {
      const newObjPerms: Record<string, boolean> = {};
      targetObj.supportedActions.forEach(act => {
        if (mode === 'all') newObjPerms[act] = true;
        else if (mode === 'readonly') newObjPerms[act] = act === 'read' || act === 'export';
        else newObjPerms[act] = false;
      });
      return {
        ...prev,
        [objKey]: newObjPerms
      };
    });
  };

  // Entire role batch action
  const handleSetAllPermissions = (mode: 'all' | 'readonly' | 'none') => {
    if (!selectedRole || selectedRole.is_system) return;

    const newMatrix: Record<string, Record<string, boolean>> = {};
    matrixSchema.objects.forEach(obj => {
      newMatrix[obj.key] = {};
      obj.supportedActions.forEach(act => {
        if (mode === 'all') newMatrix[obj.key][act] = true;
        else if (mode === 'readonly') newMatrix[obj.key][act] = act === 'read' || act === 'export';
        else newMatrix[obj.key][act] = false;
      });
    });
    setEditableMatrix(newMatrix);
  };

  // Save Role Matrix
  const handleSaveRole = async () => {
    if (!selectedRole) return;
    if (selectedRole.is_system) {
      showToast('System core roles are protected and cannot be modified.', 'error');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          display_name: selectedRole.display_name,
          description: selectedRole.description,
          permissions: editableMatrix
        })
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Role "${selectedRole.display_name}" permissions saved successfully!`);
        // Update state
        setRoles(prev => prev.map(r => r.id === selectedRole.id ? data.data : r));
        setSelectedRole(data.data);
      } else {
        showToast(data.message || 'Failed to save role', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving role matrix', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Create Custom Role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleForm.display_name) return;

    try {
      setSaving(true);
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newRoleForm)
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Role "${data.data.display_name}" created successfully!`);
        setRoles(prev => [...prev, data.data]);
        setSelectedRole(data.data);
        setEditableMatrix(data.data.permissions || {});
        setIsCreateRoleModalOpen(false);
        setNewRoleForm({ display_name: '', description: '', clone_from_role_id: '' });
      } else {
        showToast(data.message || 'Failed to create role', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error creating role', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Custom Role
  const handleDeleteRole = async () => {
    if (!selectedRole || selectedRole.is_system) return;
    if (!window.confirm(`Are you sure you want to permanently delete the custom role "${selectedRole.display_name}"?`)) {
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/roles/${selectedRole.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Role "${selectedRole.display_name}" deleted.`);
        const remaining = roles.filter(r => r.id !== selectedRole.id);
        setRoles(remaining);
        if (remaining.length > 0) {
          handleSelectRole(remaining[0]);
        } else {
          setSelectedRole(null);
        }
      } else {
        showToast(data.message || 'Failed to delete role', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting role', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Invite Team Member
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email) return;

    try {
      setSaving(true);
      const res = await fetch('/api/roles/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(inviteForm)
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Member ${inviteForm.email} invited and assigned!`);
        setIsInviteMemberModalOpen(false);
        setInviteForm({ email: '', first_name: '', last_name: '', phone: '', role_id: '', password: '' });
        // Refresh member list
        const mRes = await fetch('/api/roles/members/list', { credentials: 'include' }).then(r => r.json());
        if (mRes.success) setMembers(mRes.data);
      } else {
        showToast(data.message || 'Failed to invite member', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error inviting member', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Reassign Member Role
  const handleReassignMemberRole = async (memberId: string, newRoleId: string) => {
    try {
      const res = await fetch(`/api/roles/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role_id: newRoleId })
      });
      const data = await res.json();

      if (data.success) {
        showToast('Member role updated.');
        setMembers(prev => prev.map(m => {
          if (m.id === memberId) {
            const targetRole = roles.find(r => r.id === newRoleId);
            return {
              ...m,
              role: {
                id: newRoleId,
                name: targetRole?.name || 'custom',
                display_name: targetRole?.display_name || 'Assigned Role',
                is_system: targetRole?.is_system ?? false
              }
            };
          }
          return m;
        }));
      } else {
        showToast(data.message || 'Failed to update member role', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating member role', 'error');
    }
  };

  // Toggle Member Status (active / suspended)
  const handleToggleMemberStatus = async (memberId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch(`/api/roles/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Member status set to ${newStatus}.`);
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: newStatus } : m));
      } else {
        showToast(data.message || 'Failed to change status', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error changing status', 'error');
    }
  };

  // Remove Member
  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!window.confirm(`Remove ${email} from organization?`)) return;

    try {
      const res = await fetch(`/api/roles/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Member ${email} removed.`);
        setMembers(prev => prev.filter(m => m.id !== memberId));
      } else {
        showToast(data.message || 'Failed to remove member', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error removing member', 'error');
    }
  };

  // Filtered Roles
  const filteredRoles = roles.filter(r => 
    r.display_name.toLowerCase().includes(roleSearch.toLowerCase()) ||
    r.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(roleSearch.toLowerCase()))
  );

  // Filtered Objects for Matrix
  const filteredObjects = matrixSchema.objects.filter(obj => {
    const matchesCategory = selectedCategory === 'all' || obj.category === selectedCategory;
    const matchesSearch = !objectSearch || 
      obj.label.toLowerCase().includes(objectSearch.toLowerCase()) ||
      obj.description.toLowerCase().includes(objectSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Filtered Members
  const filteredMembers = members.filter(m => {
    const matchesSearch = !memberSearch || 
      m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.role?.display_name && m.role.display_name.toLowerCase().includes(memberSearch.toLowerCase()));
    const matchesStatus = memberStatusFilter === 'all' || m.status === memberStatusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontFamily: 'Inter, system-ui' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🛡️</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0F172A' }}>Loading Roles & Permission Matrix...</div>
        <p style={{ fontSize: '0.875rem' }}>Syncing role definitions and tenant member assignments.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif', padding: '24px', color: '#0F172A', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          padding: '12px 20px',
          borderRadius: '8px',
          background: toastMessage.type === 'success' ? '#065F46' : '#991B1B',
          color: '#FFFFFF',
          fontWeight: 600,
          fontSize: '14px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <span>{toastMessage.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.75rem' }}>🛡️</span>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Roles & Permission Matrix
            </h1>
            <span style={{ background: '#F1F5F9', color: '#475569', fontSize: '12px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px' }}>
              RBAC v2.4
            </span>
          </div>
          <p style={{ color: '#64748B', margin: '6px 0 0 0', fontSize: '0.92rem' }}>
            Configure granular object-level CRUD, execution, and export permissions across organization roles and team members.
          </p>
        </div>

        {/* Top Action Tabs */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: '#F1F5F9', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setActiveTab('matrix')}
              style={{
                background: activeTab === 'matrix' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'matrix' ? '#0F172A' : '#64748B',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeTab === 'matrix' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🛡️</span> Role Matrix
            </button>
            <button
              onClick={() => setActiveTab('members')}
              style={{
                background: activeTab === 'members' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'members' ? '#0F172A' : '#64748B',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeTab === 'members' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>👥</span> Team Roster ({members.length})
            </button>
          </div>

          {activeTab === 'matrix' ? (
            <button
              onClick={() => setIsCreateRoleModalOpen(true)}
              style={{
                background: '#0D9488',
                color: '#FFFFFF',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(13,148,136,0.2)'
              }}
            >
              <span>➕</span> Create Custom Role
            </button>
          ) : (
            <button
              onClick={() => setIsInviteMemberModalOpen(true)}
              style={{
                background: '#0D9488',
                color: '#FFFFFF',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(13,148,136,0.2)'
              }}
            >
              <span>➕</span> Invite Member
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          TAB 1: ROLE & PERMISSION MATRIX
          ======================================================== */}
      {activeTab === 'matrix' && (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          
          {/* Left Sidebar: Role Selector */}
          <div style={{ width: '310px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
            
            {/* Search Roles */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search roles..."
                value={roleSearch}
                onChange={e => setRoleSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  fontSize: '13px',
                  outline: 'none',
                  background: '#FFFFFF',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ position: 'absolute', left: '10px', top: '9px', color: '#94A3B8', fontSize: '14px' }}>🔍</span>
            </div>

            {/* Role List Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
              {filteredRoles.map(role => {
                const isSelected = selectedRole?.id === role.id;
                return (
                  <div
                    key={role.id}
                    onClick={() => handleSelectRole(role)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #0D9488' : '1px solid #E2E8F0',
                      background: isSelected ? '#F0FDFA' : '#FFFFFF',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 8px rgba(13,148,136,0.12)' : '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: isSelected ? '#0F766E' : '#0F172A' }}>
                        {role.display_name}
                      </span>
                      {role.is_system ? (
                        <span style={{ fontSize: '11px', background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
                          🔒 System
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', background: '#EFF6FF', color: '#1D4ED8', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
                          ⚙️ Custom
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748B', lineHeight: '1.4' }}>
                      {role.description || 'No description provided.'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#94A3B8' }}>
                      <code>{role.name}</code>
                      <span>👥 {role.member_count ?? 0} assigned</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Area: Matrix Grid */}
          {selectedRole ? (
            <div style={{ flex: 1, background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              
              {/* Role Header Banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '20px', borderBottom: '1px solid #E2E8F0', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#0F172A' }}>
                      {selectedRole.display_name}
                    </h2>
                    {selectedRole.is_system ? (
                      <span style={{ background: '#FEF3C7', color: '#92400E', padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                        🔒 Protected System Role
                      </span>
                    ) : (
                      <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                        ⚙️ Tenant Custom Role
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                    {selectedRole.description || 'Standard non-profit administrative role.'}
                  </p>
                </div>

                {/* Batch Action Buttons */}
                {!selectedRole.is_system ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleSetAllPermissions('all')}
                      style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#334155' }}
                    >
                      ⚡ Grant All
                    </button>
                    <button
                      onClick={() => handleSetAllPermissions('readonly')}
                      style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#334155' }}
                    >
                      👁️ Read Only
                    </button>
                    <button
                      onClick={() => handleSetAllPermissions('none')}
                      style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#334155' }}
                    >
                      🚫 Clear All
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#64748B', background: '#F8FAFC', padding: '6px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    🔒 Permissions locked by platform policy to ensure statutory compliance.
                  </div>
                )}
              </div>

              {/* Filters Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                
                {/* Category Pills */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setSelectedCategory('all')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: selectedCategory === 'all' ? '1px solid #0D9488' : '1px solid #E2E8F0',
                      background: selectedCategory === 'all' ? '#0D9488' : '#F8FAFC',
                      color: selectedCategory === 'all' ? '#FFFFFF' : '#475569'
                    }}
                  >
                    All Categories ({matrixSchema.objects.length})
                  </button>
                  {matrixSchema.categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '16px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: selectedCategory === cat ? '1px solid #0D9488' : '1px solid #E2E8F0',
                        background: selectedCategory === cat ? '#0D9488' : '#F8FAFC',
                        color: selectedCategory === cat ? '#FFFFFF' : '#475569'
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Object Search */}
                <div style={{ position: 'relative', width: '220px' }}>
                  <input
                    type="text"
                    placeholder="Search objects..."
                    value={objectSearch}
                    onChange={e => setObjectSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 30px',
                      borderRadius: '6px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ position: 'absolute', left: '8px', top: '7px', color: '#94A3B8', fontSize: '12px' }}>🔍</span>
                </div>
              </div>

              {/* Matrix Table */}
              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #E2E8F0', color: '#0F172A', fontWeight: 600 }}>
                        Entity Object
                      </th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 600 }}>
                        Category
                      </th>
                      {matrixSchema.actions.map(action => (
                        <th key={action.key} style={{ padding: '12px 10px', borderBottom: '1px solid #E2E8F0', color: '#334155', fontWeight: 600 }} title={action.description}>
                          {action.label}
                        </th>
                      ))}
                      {!selectedRole.is_system && (
                        <th style={{ padding: '12px 10px', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 600 }}>
                          Quick
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredObjects.map((obj, idx) => {
                      const objPerms = editableMatrix[obj.key] || {};
                      const isEven = idx % 2 === 0;

                      return (
                        <tr key={obj.key} style={{ background: isEven ? '#FFFFFF' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                          
                          {/* Object Name & Description */}
                          <td style={{ textAlign: 'left', padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '16px' }}>{obj.icon}</span>
                              <div>
                                <div style={{ fontWeight: 600, color: '#0F172A' }}>{obj.label}</div>
                                <div style={{ fontSize: '11px', color: '#64748B' }}>{obj.description}</div>
                              </div>
                            </div>
                          </td>

                          {/* Category Tag */}
                          <td style={{ textAlign: 'left', padding: '12px 16px' }}>
                            <span style={{ fontSize: '11px', background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 }}>
                              {obj.category}
                            </span>
                          </td>

                          {/* Action Checkboxes */}
                          {matrixSchema.actions.map(action => {
                            const isSupported = obj.supportedActions.includes(action.key);
                            const checked = objPerms[action.key] === true;

                            if (!isSupported) {
                              return (
                                <td key={`${obj.key}-${action.key}`} style={{ padding: '12px 10px', color: '#CBD5E1' }}>
                                  —
                                </td>
                              );
                            }

                            return (
                              <td key={`${obj.key}-${action.key}`} style={{ padding: '12px 10px' }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={selectedRole.is_system}
                                  onChange={() => handleToggle(obj.key, action.key)}
                                  style={{
                                    width: '16px',
                                    height: '16px',
                                    accentColor: '#0D9488',
                                    cursor: selectedRole.is_system ? 'not-allowed' : 'pointer'
                                  }}
                                />
                              </td>
                            );
                          })}

                          {/* Row Quick Actions */}
                          {!selectedRole.is_system && (
                            <td style={{ padding: '12px 10px' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                <button
                                  onClick={() => handleSetRowPermissions(obj.key, 'all')}
                                  title="Grant all actions"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                >
                                  ✅
                                </button>
                                <button
                                  onClick={() => handleSetRowPermissions(obj.key, 'readonly')}
                                  title="Read only"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                >
                                  👁️
                                </button>
                                <button
                                  onClick={() => handleSetRowPermissions(obj.key, 'none')}
                                  title="Revoke all"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                >
                                  ❌
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Action Footer for Custom Roles */}
              {!selectedRole.is_system && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
                  <button
                    onClick={handleDeleteRole}
                    disabled={saving}
                    style={{
                      background: '#FEE2E2',
                      color: '#DC2626',
                      border: '1px solid #FECACA',
                      padding: '9px 18px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Delete Custom Role
                  </button>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      onClick={() => handleSelectRole(selectedRole)}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        padding: '9px 18px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Reset Changes
                    </button>
                    <button
                      onClick={handleSaveRole}
                      disabled={saving}
                      style={{
                        background: '#0D9488',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '9px 24px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(13,148,136,0.25)'
                      }}
                    >
                      {saving ? 'Saving Changes...' : '💾 Save Permission Matrix'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div style={{ flex: 1, padding: '40px', textAlign: 'center', color: '#64748B' }}>
              Select a role to inspect or edit permissions.
            </div>
          )}

        </div>
      )}

      {/* ========================================================
          TAB 2: TEAM MEMBERS & ROLE ROSTER
          ======================================================== */}
      {activeTab === 'members' && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
          
          {/* Members Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Member Search */}
              <div style={{ position: 'relative', width: '280px' }}>
                <input
                  type="text"
                  placeholder="Search by name, email, or role..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ position: 'absolute', left: '10px', top: '8px', color: '#94A3B8' }}>🔍</span>
              </div>

              {/* Status Filter */}
              <select
                value={memberStatusFilter}
                onChange={e => setMemberStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '13px', outline: 'none', background: '#FFFFFF' }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div style={{ fontSize: '13px', color: '#64748B' }}>
              Showing <strong>{filteredMembers.length}</strong> team members
            </div>
          </div>

          {/* Members Table */}
          <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>Team Member</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>Contact</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>Assigned Role</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>Last Active</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member, idx) => {
                  const isEven = idx % 2 === 0;
                  const initials = (member.name || member.email)
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr key={member.id} style={{ background: isEven ? '#FFFFFF' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                      
                      {/* Avatar & Name */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: '#0D9488',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '12px',
                            flexShrink: 0
                          }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0F172A' }}>{member.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>{member.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {member.phone || '—'}
                      </td>

                      {/* Assigned Role Selector */}
                      <td style={{ padding: '12px 16px' }}>
                        <select
                          value={member.role.id || roles.find(r => r.name === member.role.name)?.id || ''}
                          onChange={e => handleReassignMemberRole(member.id, e.target.value)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: '#FFFFFF',
                            color: '#0F172A',
                            cursor: 'pointer'
                          }}
                        >
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.display_name} {r.is_system ? '(System)' : ''}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          onClick={() => handleToggleMemberStatus(member.id, member.status)}
                          style={{
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: member.status === 'active' ? '#DCFCE7' : '#FEE2E2',
                            color: member.status === 'active' ? '#15803D' : '#DC2626'
                          }}
                          title="Click to toggle status"
                        >
                          {member.status === 'active' ? '● Active' : '○ Suspended'}
                        </span>
                      </td>

                      {/* Last Active */}
                      <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '12px' }}>
                        {member.last_login_at ? new Date(member.last_login_at).toLocaleDateString() : 'Never'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleRemoveMember(member.id, member.email)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#EF4444',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          Remove
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ========================================================
          MODAL 1: CREATE CUSTOM ROLE
          ======================================================== */}
      <Modal isOpen={isCreateRoleModalOpen} onClose={() => setIsCreateRoleModalOpen(false)} title="Create Custom Role">
        <form onSubmit={handleCreateRole} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Role Display Name *</label>
            <input 
              type="text" 
              value={newRoleForm.display_name}
              onChange={e => setNewRoleForm({ ...newRoleForm, display_name: e.target.value })}
              placeholder="e.g. Field Operations Coordinator"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
              required 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Description</label>
            <textarea 
              value={newRoleForm.description}
              onChange={e => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
              placeholder="Explain the scope of responsibilities for this role..."
              rows={3}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Clone Permissions From (Optional)</label>
            <select
              value={newRoleForm.clone_from_role_id}
              onChange={e => setNewRoleForm({ ...newRoleForm, clone_from_role_id: e.target.value })}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#FFFFFF', boxSizing: 'border-box' }}
            >
              <option value="">Start with empty matrix</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>
                  {r.display_name} ({r.is_system ? 'System Preset' : 'Custom'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={() => setIsCreateRoleModalOpen(false)} style={{ padding: '9px 16px', border: '1px solid #CBD5E1', background: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ background: '#0D9488', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              {saving ? 'Creating...' : '➕ Create Role'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================
          MODAL 2: INVITE TEAM MEMBER
          ======================================================== */}
      <Modal isOpen={isInviteMemberModalOpen} onClose={() => setIsInviteMemberModalOpen(false)} title="Invite Team Member">
        <form onSubmit={handleInviteMember} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>First Name</label>
              <input 
                type="text" 
                value={inviteForm.first_name}
                onChange={e => setInviteForm({ ...inviteForm, first_name: e.target.value })}
                placeholder="e.g. Priya"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Last Name</label>
              <input 
                type="text" 
                value={inviteForm.last_name}
                onChange={e => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                placeholder="e.g. Sharma"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Email Address *</label>
            <input 
              type="email" 
              value={inviteForm.email}
              onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="priya@organization.org"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
              required 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Phone Number</label>
            <input 
              type="text" 
              value={inviteForm.phone}
              onChange={e => setInviteForm({ ...inviteForm, phone: e.target.value })}
              placeholder="+91 98765 43210"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Assign Role *</label>
            <select
              value={inviteForm.role_id}
              onChange={e => setInviteForm({ ...inviteForm, role_id: e.target.value })}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#FFFFFF', boxSizing: 'border-box' }}
              required
            >
              <option value="">Select a role...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>
                  {r.display_name} ({r.is_system ? 'System Core' : 'Custom'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Temporary Password (Optional)</label>
            <input 
              type="password" 
              value={inviteForm.password}
              onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
              placeholder="Default: Welcome@123"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={() => setIsInviteMemberModalOpen(false)} style={{ padding: '9px 16px', border: '1px solid #CBD5E1', background: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ background: '#0D9488', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              {saving ? 'Inviting...' : '✉️ Send Invitation'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
