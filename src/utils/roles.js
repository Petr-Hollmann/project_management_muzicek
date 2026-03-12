/**
 * Role utilities — single source of truth for role checks.
 *
 * Hierarchy:
 *   admin (super-admin) > supervisor > installer > pending
 *
 * - isPrivileged : admin OR supervisor  → access to all admin features
 * - isSuperAdmin : admin only           → manage other admin/supervisor accounts
 */

export const APP_ROLES = {
  ADMIN:      'admin',
  SUPERVISOR: 'supervisor',
  INSTALLER:  'installer',
  PENDING:    'pending',
};

/** Returns true for admin and supervisor (both have full privileged access). */
export const isPrivileged = (user) =>
  ['admin', 'supervisor'].includes(user?.app_role);

/** Returns true only for the top-level admin (super-admin). */
export const isSuperAdmin = (user) => user?.app_role === 'admin';

/** Human-readable role label. */
export const getRoleLabel = (role) => {
  switch (role) {
    case 'admin':      return 'Administrátor';
    case 'supervisor': return 'Supervisor';
    case 'installer':  return 'Montážník';
    case 'pending':    return 'Čekající';
    default:           return role ?? '—';
  }
};
