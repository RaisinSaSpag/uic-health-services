import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, UserPlus, RefreshCw, X, Search } from 'lucide-react';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import type { Campus, PaginatedResponse, UserRecord } from '../types/hsms';

export function CoordinatorUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', password: '', role_name: 'student', campus_id: 1, is_active: true
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, campusRes] = await Promise.all([
        api.get<PaginatedResponse<UserRecord>>('/users', { params: { per_page: 100 } }),
        api.get<Campus[]>('/campuses')
      ]);
      setUsers(usersRes.data.data);
      setCampuses(campusRes.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to load users.'), 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u => 
      u.first_name.toLowerCase().includes(q) || 
      u.last_name.toLowerCase().includes(q) || 
      u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({ first_name: '', last_name: '', email: '', password: '', role_name: 'student', campus_id: campuses[0]?.id || 1, is_active: true });
    setIsModalOpen(true);
  };

  const openEditModal = (u: UserRecord) => {
    setEditingUser(u);
    setFormData({
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      password: '', // Leave blank for edit
      role_name: (typeof u.role === 'string' ? u.role : u.role?.name) || 'student',
      campus_id: u.campus_id || 1,
      is_active: u.is_active ?? true
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) {
        // Update user (No password update here)
        await api.patch(`/users/${editingUser.id}`, {
          first_name: formData.first_name,
          last_name: formData.last_name,
          role_name: formData.role_name,
          campus_id: formData.campus_id,
          is_active: formData.is_active
        });
        void notifySuccess('User updated successfully.', 'Success');
      } else {
        // Create user
        await api.post('/users', formData);
        void notifySuccess('User created successfully.', 'Success');
      }
      setIsModalOpen(false);
      void loadData();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to save user.'), 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2>User Management</h2>
          <p className="muted">Create accounts, manage roles, and deactivate users.</p>
        </div>
        <button className="button primary" onClick={openAddModal} type="button" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserPlus size={16} />
          <span>Add New User</span>
        </button>
      </div>

      <div className="panel mb-4">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ position: 'absolute', left: '10px', top: '10px', color: '#9ca3af' }} size={18} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              style={{ paddingLeft: '35px', width: '100%' }}
            />
          </div>
          <button className="button ghost" onClick={() => void loadData()} type="button" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="panel">
        {loading ? (
          <p className="muted text-center py-8">Loading users...</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Campus</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.first_name} {u.last_name}</td>
                    <td className="muted">{u.email}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {typeof u.role === 'string' ? u.role : u.role?.name}
                    </td>
                    <td>{u.campus_id}</td>
                    <td>
                      <span style={{ color: u.is_active ? 'green' : 'red', fontWeight: 'bold' }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="button ghost sm" onClick={() => openEditModal(u)} title="Edit User" type="button">
                          <Edit3 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <button className="button ghost" onClick={() => setIsModalOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div style={{ display: 'flex', gap: '15px' }}>
                <label style={{ flex: 1 }}>
                  First Name
                  <input type="text" required value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} />
                </label>
                <label style={{ flex: 1 }}>
                  Last Name
                  <input type="text" required value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
                </label>
              </div>
              <label>
                Email (Must be @uic.edu.ph)
                <input type="email" required disabled={!!editingUser} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </label>
              {!editingUser && (
                <label>
                  Temporary Password
                  <input type="password" required minLength={8} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                </label>
              )}
              <div style={{ display: 'flex', gap: '15px' }}>
                <label style={{ flex: 1 }}>
                  Role
                  <select value={formData.role_name} onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}>
                    <option value="student">Student</option>
                    <option value="employee">Employee</option>
                    <option value="nurse">Nurse</option>
                    <option value="doctor">Doctor</option>
                    <option value="coordinator">Coordinator</option>
                  </select>
                </label>
                <label style={{ flex: 1 }}>
                  Campus
                  <select value={formData.campus_id} onChange={(e) => setFormData({ ...formData, campus_id: Number(e.target.value) })}>
                    {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>
              {editingUser && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                  <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                  Account is Active
                </label>
              )}
              <div className="modal-actions">
                <button type="button" className="button ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
