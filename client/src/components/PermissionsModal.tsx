import React, { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import api from '../lib/api';
import { apiErrorMessage } from '../lib/errors';
import toast from 'react-hot-toast';

interface PermissionItem {
  key: string;
  label: string;
}
interface PermissionGroup {
  group: string;
  permissions: PermissionItem[];
}

interface Props {
  userId: string;
  userName: string;
  onClose: () => void;
}

/**
 * Lets an admin grant/revoke granular permissions for one staff member —
 * "add student", "view student", "manage staff", etc. — independent of
 * their role. This is what actually controls who can see/do what, and is
 * what fixes data that one user creates not showing up for another.
 */
export default function PermissionsModal({ userId, userName, onClose }: Props) {
  const [catalog, setCatalog] = useState<PermissionGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catalogRes, userRes] = await Promise.all([
          api.get('/admin/permissions/catalog'),
          api.get(`/admin/users/${userId}/permissions`),
        ]);
        if (cancelled) return;
        setCatalog(catalogRes.data.catalog || []);
        setSelected(new Set(userRes.data.permissions || []));
      } catch (err: any) {
        toast.error(apiErrorMessage(err, 'Failed to load permissions'));
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: PermissionGroup, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      group.permissions.forEach(p => { checked ? next.add(p.key) : next.delete(p.key); });
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/users/${userId}/permissions`, {
        permissions: Array.from(selected),
        reason: reason.trim() || undefined,
      });
      toast.success(`Permissions updated for ${userName}`);
      onClose();
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Failed to update permissions'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} /> Permissions — {userName}
          </h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
        ) : (
          <>
            <div style={{ maxHeight: '55vh', overflowY: 'auto', padding: '4px 2px' }}>
              {catalog.map(group => {
                const allChecked = group.permissions.every(p => selected.has(p.key));
                return (
                  <div key={group.group} style={{ marginBottom: 18 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: '1.5px solid #e5e7eb', paddingBottom: 6, marginBottom: 8,
                    }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#166534', textTransform: 'uppercase' }}>
                        {group.group}
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#6b7280', cursor: 'pointer' }}>
                        <input type="checkbox" checked={allChecked} onChange={e => toggleGroup(group, e.target.checked)} />
                        Select all
                      </label>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                      {group.permissions.map(p => (
                        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600 }}>Reason (optional, for audit log)</label>
              <input
                type="text"
                className="form-control"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Promoted to handle companies for Data Science programme"
                style={{ marginTop: 4 }}
              />
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
