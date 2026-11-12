import type { RoleName, RoleRecord, UserRecord } from '../types/hsms';

export function normalizeRoleName(role: unknown): RoleName {
  if (!role) {
    return 'student'; // 🚨 P4-13 FIX: Default to a valid role instead of ''
  }

  if (typeof role === 'string') {
    const lower = role.toLowerCase() as RoleName;
    return ['student', 'employee', 'nurse', 'doctor', 'coordinator'].includes(lower) ? lower : 'student';
  }

  const roleRecord = role as RoleRecord;

  if (typeof roleRecord.name === 'string') {
    const lower = roleRecord.name.toLowerCase() as RoleName;
    return ['student', 'employee', 'nurse', 'doctor', 'coordinator'].includes(lower) ? lower : 'student';
  }

  return 'student'; // 🚨 P4-13 FIX: Default to a valid role instead of ''
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

// 🚨 TIMEZONE FIX: Appends 'Z' to force UTC conversion to local time
export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'N/A';
  }

  // If the string from the database doesn't have a timezone indicator, treat it as UTC
  const safeValue = value.endsWith('Z') || value.includes('+') ? value : `${value}Z`;
  const date = new Date(safeValue);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true, // Ensure it shows AM/PM clearly
  }).format(date);
}

export function humanizeStatus(status: string | null | undefined): string {
  if (!status) {
    return 'Unknown';
  }

  return status.replaceAll('_', ' ');
}