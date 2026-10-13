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

const assignableRoles: RoleName[] = ['student', 'employee', 'nurse', 'doctor', 'admin'];

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
    if (!value) {
      return 'N/A';
    }

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
        params: {
          search: trimmedSearch,
          per_page: 20,
        },
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

    if (!confirmed) {
      return;
    }

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

          <div className="field full-width">
            <button className="button" disabled={searchingUsers} type="submit">
              {searchingUsers ? 'Searching users...' : 'Search Users'}
            </button>
          </div>
        </form>

        {userResults.length > 0 && (
          <form className="form-grid" onSubmit={assignRole}>
            <label className="field full-width">
              <span>Matched Users</span>
              <select
                value={selectedUserId}
                onChange={(event) => {
                  setSelectedUserId(event.target.value);
                }}
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

            <div className="field full-width">
              <button
                className="button"
                disabled={assigningRole || selectedUserId === '' || selectedRoleName === ''}
                type="submit"
              >
                {assigningRole ? 'Updating role...' : 'Assign Role'}
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
                setFilters((current) => ({
                  ...current,
                  action: event.target.value,
                }))
              }
              placeholder="consultation.completed"
            />
          </label>

          <label className="field">
            <span>Entity Type</span>
            <input
              value={filters.entity_type}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  entity_type: event.target.value,
                }))
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
                setFilters((current) => ({
                  ...current,
                  date_from: event.target.value,
                }))
              }
            />
          </label>

          <label className="field">
            <span>Date To</span>
            <input
              type="date"
              value={filters.date_to}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  date_to: event.target.value,
                }))
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
    </div>
  );
}
