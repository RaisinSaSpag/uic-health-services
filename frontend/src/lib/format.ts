import type { RoleName, RoleRecord, UserRecord } from '../types/hsms';

export function normalizeRoleName(role: unknown): RoleName {
  if (!role) {
    return '';
  }

  if (typeof role === 'string') {
    return role.toLowerCase();
  }

  const roleRecord = role as RoleRecord;

  if (typeof roleRecord.name === 'string') {
    return roleRecord.name.toLowerCase();
  }

  return '';
}

export function userDisplayName(user: Partial<UserRecord> | null | undefined): string {
  if (!user) {
    return 'Unknown user';
  }

  const firstName = user.first_name?.trim() ?? '';
  const lastName = user.last_name?.trim() ?? '';
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName !== '') {
    return fullName;
  }

  if (user.email) {
    return user.email;
  }

  return 'Unknown user';
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function humanizeStatus(status: string | null | undefined): string {
  if (!status) {
    return 'Unknown';
  }

  return status.replaceAll('_', ' ');
}
