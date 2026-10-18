import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { confirmAction, notifyError, notifyInfo, notifySuccess } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import type { AuditLog, PaginatedResponse, RoleName, UserRecord } from '../types/hsms';

interface AuditFilterState {
  action: string;
  entity_type: string;
  date_from: string;
  date_to: string;
}

const assignableRoles: RoleName[] = ['student', 'employee', 'nurse', 'doctor', 'admin', 'coordinator'];

function roleNameLabel(value: string): string {
  if (value.includes('_')) {
    return value
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function userRoleName(user: UserRecord): string {
  if (typeof user.role === 'string') {
    return user.role;
  }
  if (user.role && typeof user.role === 'object' && typeof user.role.name === 'string') {
    return user.role.name;
  }
  return 'unknown';
}

export function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoleName, setSelectedRoleName] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [assigningRole, setAssigningRole] = useState(false);
  const [isAddOpen, setAddOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [isEditOpen, setEditOpen] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role_name: 'nurse' as RoleName,
    campus_id: '',
    is_active: true,
  });
  const [campuses, setCampuses] = useState<Array<{ id: number; name: string }>>([]);
  const [addForm, setAddForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role_name: 'nurse' as RoleName,
    campus_id: '',
  });
  const [filters, setFilters] = useState<AuditFilterState>({
    action: '',
    entity_type: '',
    date_from: '',
    date_to: '',
  });

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<PaginatedResponse<AuditLog>>('/audit-logs', {
        params: {
          page,
          per_page: 20,
          ...(filters.action ? { action: filters.action } : {}),
          ...(filters.entity_type ? { entity_type: filters.entity_type } : {}),
          ...(filters.date_from ? { date_from: filters.date_from } : {}),
          ...(filters.date_to ? { date_to: filters.date_to } : {}),
        },
      });
      setLogs(response.data.data);
      setLastPage(response.data.last_page);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load audit logs.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  const applyFilters = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setPage(1);
    if (page === 1) {
      void loadAuditLogs();
    }
  };

  const formatPayload = (value: Record<string, unknown> | null | undefined): string => {
    if (!value) return 'N/A';
    return JSON.stringify(value, null, 2);
  };

  const selectedUser = userResults.find((candidate) => String(candidate.id) === selectedUserId) ?? null;
  const selectedUserCurrentRole = selectedUser ? roleNameLabel(userRoleName(selectedUser)) : 'N/A';

  const searchUsers = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmedSearch = userSearch.trim();
    if (trimmedSearch === '') {
      setUserResults([]);
      setSelectedUserId('');
      return;
    }
    setSearchingUsers(true);
    try {
      const response = await api.get<PaginatedResponse<UserRecord>>('/users', {
        params: { search: trimmedSearch, per_page: 20 },
      });
      const users = response.data.data;
      setUserResults(users);
      setSelectedUserId(users.length > 0 ? String(users[0].id) : '');
      setSelectedRoleName('');
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to search users.'), 'Search Failed');
      setUserResults([]);
      setSelectedUserId('');
      setSelectedRoleName('');
    } finally {
      setSearchingUsers(false);
    }
  };

  const assignRole = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (selectedUserId === '' || selectedRoleName === '') {
      void notifyInfo('Select both a user and a role before assigning.', 'Missing Information');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Assign this role?',
      text: `User #${selectedUserId} will be assigned role ${roleNameLabel(selectedRoleName)}.`,
      confirmButtonText: 'Yes, assign role',
    });
    if (!confirmed) return;
    setAssigningRole(true);
    try {
      const response = await api.patch<UserRecord>(`/users/${selectedUserId}/role`, {
        role_name: selectedRoleName,
      });
      const updatedUser = response.data;
      setUserResults((current) =>
        current.map((candidate) => (candidate.id === updatedUser.id ? updatedUser : candidate)),
      );
      void notifySuccess('Role updated successfully.', 'Role Assigned');
      setPage(1);
      void loadAuditLogs();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to update user role.'), 'Update Failed');
    } finally {
      setAssigningRole(false);
    }
  };

  const loadCampusesForAdd = useCallback(async () => {
    try {
      const res = await api.get<Array<{ id: number; name: string }>>('/campuses');
      setCampuses(Array.isArray(res.data) ? res.data : []);
    } catch {
      // non-fatal; campus dropdown stays empty
    }
  }, []);

  const openEditModal = (): void => {
    if (!selectedUser) return;
    setEditForm({
      first_name: selectedUser.first_name ?? '',
      last_name: selectedUser.last_name ?? '',
      email: selectedUser.email ?? '',
      role_name: (userRoleName(selectedUser) as RoleName) ?? 'nurse',
      campus_id: selectedUser.campus_id ? String(selectedUser.campus_id) : '',
      is_active: true,
    });
    setEditOpen(true);
    if (campuses.length === 0) {
      void loadCampusesForAdd();
    }
  };

  const submitEditUser = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedUser) return;
    setEditSubmitting(true);
    try {
      const response = await api.patch<UserRecord>(`/users/${selectedUser.id}`, {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim(),
        role_name: editForm.role_name,
        campus_id: Number(editForm.campus_id),
        is_active: editForm.is_active,
      });
      const updated = response.data;
      setUserResults((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
      );
      void notifySuccess('User updated successfully.', 'Updated');
      setEditOpen(false);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to update user.'), 'Update Failed');
    } finally {
      setEditSubmitting(false);
    }
  };

  const openAddModal = (): void => {
    setAddForm({
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      role_name: 'nurse',
      campus_id: '',
    });
    setAddOpen(true);
    if (campuses.length === 0) {
      void loadCampusesForAdd();
    }
  };

  const submitAddUser = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setAddSubmitting(true);
    try {
      await api.post('/users', {
        first_name: addForm.first_name.trim(),
        last_name: addForm.last_name.trim(),
        email: addForm.email.trim(),
        password: addForm.password,
        role_name: addForm.role_name,
        campus_id: Number(addForm.campus_id),
      });
      void notifySuccess('User created successfully.', 'User Added');
      setAddOpen(false);
      if (userSearch.trim() !== '') {
        const response = await api.get<PaginatedResponse<UserRecord>>('/users', {
          params: { search: userSearch.trim(), per_page: 20 },
        });
        setUserResults(response.data.data);
      }
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to create user.'), 'Create Failed');
    } finally {
      setAddSubmitting(false);
    }
  };

  const deleteSelectedUser = async (): Promise<void> => {
    if (!selectedUser) return;

    const confirmed = await confirmAction({
      title: 'Delete this user?',
      text: `${userDisplayName(selectedUser)} (${selectedUser.email}) will be permanently deleted.`,
      confirmButtonText: 'Yes, delete user',
    });
    if (!confirmed) return;

    setDeletingUserId(selectedUser.id);
    try {
      await api.delete(`/users/${selectedUser.id}`);
      void notifySuccess('User deleted.', 'Deleted');
      setUserResults((current) => current.filter((candidate) => candidate.id !== selectedUser.id));
      setSelectedUserId('');
      setSelectedRoleName('');
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to delete user.'), 'Delete Failed');
    } finally {
      setDeletingUserId(null);
    }
  };

  // ✅ Moved OUT of deleteSelectedUser — top-level component handler
  const handleResetPassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!resetPasswordUserId) return;

    setResettingPassword(true);
    try {
      await api.patch(`/users/${resetPasswordUserId}/password`, {
        password: resetPasswordValue,
      });
      void notifySuccess('Password reset successfully.', 'Password Reset');
      setResetPasswordUserId(null);
      setResetPasswordValue('');
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to reset password.'), 'Reset Failed');
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="page admin-audit-page">
      <section className="panel">
        <h2>User Role Assignment</h2>
        <p className="muted">Search users and assign access roles.</p>

        <form className="form-grid" onSubmit={searchUsers}>
          <label className="field full-width">
            <span>User Search</span>
            <input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Name or email"
            />
          </label>

          <div className="field full-width" style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="button" disabled={searchingUsers} type="submit">
              {searchingUsers ? 'Searching users...' : 'Search Users'}
            </button>
            <button className="button" type="button" onClick={openAddModal} disabled={addSubmitting}>
              + Add User
            </button>
          </div>
        </form>

        {userResults.length > 0 && (
          <form className="form-grid" onSubmit={assignRole}>
            <label className="field full-width">
              <span>Matched Users</span>
              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                required
              >
                <option value="">Select a user</option>
                {userResults.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {userDisplayName(candidate)} ({candidate.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Current Role</span>
              <input readOnly value={selectedUserCurrentRole} />
            </label>

            <label className="field">
              <span>Assign New Role</span>
              <select
                value={selectedRoleName}
                onChange={(event) => setSelectedRoleName(event.target.value)}
                required
              >
                <option value="">Select a role</option>
                {assignableRoles.map((roleName) => (
                  <option key={roleName} value={roleName}>
                    {roleNameLabel(roleName)}
                  </option>
                ))}
              </select>
            </label>

            <div className="field full-width" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="button"
                disabled={assigningRole || selectedUserId === '' || selectedRoleName === ''}
                type="submit"
              >
                {assigningRole ? 'Updating role...' : 'Assign Role'}
              </button>
              <button
                className="button"
                type="button"
                onClick={openEditModal}
                disabled={editSubmitting || selectedUserId === ''}
              >
                Edit User
              </button>
              <button
                className="button"
                type="button"
                onClick={() => void deleteSelectedUser()}
                disabled={deletingUserId !== null || selectedUserId === ''}
              >
                {deletingUserId !== null ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </form>
        )}

        {userSearch.trim() !== '' && !searchingUsers && userResults.length === 0 && (
          <p className="empty-state">No users matched your search.</p>
        )}
      </section>

      <section className="panel">
        <h2>Admin Audit Logs</h2>
        <p className="muted">Filter and inspect critical workflow activity.</p>

        <form className="form-grid" onSubmit={applyFilters}>
          <label className="field">
            <span>Action</span>
            <input
              value={filters.action}
              onChange={(event) =>
                setFilters((current) => ({ ...current, action: event.target.value }))
              }
              placeholder="consultation.completed"
            />
          </label>

          <label className="field">
            <span>Entity Type</span>
            <input
              value={filters.entity_type}
              onChange={(event) =>
                setFilters((current) => ({ ...current, entity_type: event.target.value }))
              }
              placeholder="consultation"
            />
          </label>

          <label className="field">
            <span>Date From</span>
            <input
              type="date"
              value={filters.date_from}
              onChange={(event) =>
                setFilters((current) => ({ ...current, date_from: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>Date To</span>
            <input
              type="date"
              value={filters.date_to}
              onChange={(event) =>
                setFilters((current) => ({ ...current, date_to: event.target.value }))
              }
            />
          </label>

          <div className="field full-width">
            <button className="button" type="submit">
              Apply Filters
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        {loading ? (
          <p className="muted">Loading audit logs...</p>
        ) : logs.length === 0 ? (
          <p className="empty-state">No audit records found.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Old Values</th>
                    <th>New Values</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.id}</td>
                      <td>{formatDateTime(log.created_at)}</td>
                      <td>{userDisplayName(log.user)}</td>
                      <td>{log.action}</td>
                      <td>
                        {log.entity_type}
                        {log.entity_id ? ` #${log.entity_id}` : ''}
                      </td>
                      <td>
                        <pre>{formatPayload(log.old_values)}</pre>
                      </td>
                      <td>
                        <pre>{formatPayload(log.new_values)}</pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pager">
              <button
                className="button ghost"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Previous
              </button>
              <span className="muted small">
                Page {page} of {lastPage}
              </span>
              <button
                className="button ghost"
                disabled={page >= lastPage}
                onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
                type="button"
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>

      {isAddOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => !addSubmitting && setAddOpen(false)}
        >
          <section
            className="panel"
            style={{ maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Add User</h2>
            <p className="muted">Create a new staff or student account.</p>

            <form className="form-grid" onSubmit={submitAddUser}>
              <label className="field">
                <span>First Name</span>
                <input
                  required
                  value={addForm.first_name}
                  onChange={(event) =>
                    setAddForm((current) => ({ ...current, first_name: event.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span>Last Name</span>
                <input
                  required
                  value={addForm.last_name}
                  onChange={(event) =>
                    setAddForm((current) => ({ ...current, last_name: event.target.value }))
                  }
                />
              </label>

              <label className="field full-width">
                <span>Email</span>
                <input
                  required
                  type="email"
                  value={addForm.email}
                  onChange={(event) =>
                    setAddForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </label>

              <label className="field full-width">
                <span>Password</span>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={addForm.password}
                  onChange={(event) =>
                    setAddForm((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span>Role</span>
                <select
                  value={addForm.role_name}
                  onChange={(event) =>
                    setAddForm((current) => ({ ...current, role_name: event.target.value as RoleName }))
                  }
                  required
                >
                  {assignableRoles.map((roleName) => (
                    <option key={roleName} value={roleName}>
                      {roleNameLabel(roleName)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Campus</span>
                <select
                  value={addForm.campus_id}
                  onChange={(event) =>
                    setAddForm((current) => ({ ...current, campus_id: event.target.value }))
                  }
                  required
                >
                  <option value="">Select a campus</option>
                  {campuses.map((campus) => (
                    <option key={campus.id} value={String(campus.id)}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field full-width" style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="button"
                  type="button"
                  onClick={() => setAddOpen(false)}
                  disabled={addSubmitting}
                >
                  Cancel
                </button>
                <button className="button" type="submit" disabled={addSubmitting}>
                  {addSubmitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isEditOpen && selectedUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => !editSubmitting && setEditOpen(false)}
        >
          <section
            className="panel"
            style={{ maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Edit User</h2>
            <p className="muted">
              Editing: <strong>{userDisplayName(selectedUser)}</strong>
            </p>

            <form className="form-grid" onSubmit={submitEditUser}>
              <label className="field">
                <span>First Name</span>
                <input
                  required
                  value={editForm.first_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>Last Name</span>
                <input
                  required
                  value={editForm.last_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </label>

              <label className="field full-width">
                <span>Email</span>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>Role</span>
                <select
                  value={editForm.role_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, role_name: e.target.value as RoleName }))}
                  required
                >
                  {assignableRoles.map((roleName) => (
                    <option key={roleName} value={roleName}>
                      {roleNameLabel(roleName)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Campus</span>
                <select
                  value={editForm.campus_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, campus_id: e.target.value }))}
                  required
                >
                  <option value="">Select a campus</option>
                  {campuses.map((campus) => (
                    <option key={campus.id} value={String(campus.id)}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </label>

              <label
                className="field full-width"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                <span>Active account</span>
              </label>

              <div className="field full-width" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setResetPasswordUserId(selectedUser.id);
                    setResetPasswordValue('');
                  }}
                  disabled={editSubmitting}
                >
                  Reset Password
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={() => setEditOpen(false)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button className="button" type="submit" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ✅ Reset Password modal — rendered inside the component's JSX tree */}
      {resetPasswordUserId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => !resettingPassword && setResetPasswordUserId(null)}
        >
          <section
            className="panel"
            style={{ maxWidth: 400, width: '100%', padding: '1.5rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Reset User Password</h3>
            <form onSubmit={handleResetPassword}>
              <label className="field full-width" style={{ marginBottom: '1rem' }}>
                <span>New Password</span>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="button"
                  onClick={() => setResetPasswordUserId(null)}
                  disabled={resettingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={resettingPassword || resetPasswordValue.length < 6}
                >
                  {resettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}