import { useLocation } from 'react-router-dom';

export interface InventoryBasePath {
  basePath: string;
  isDoctor: boolean;
  isNurse: boolean;
}

/**
 * Detects the current inventory context (nurse or doctor).
 * Returns the appropriate base path for inventory navigation.
 *
 * - /nurse/inventory/* → basePath = '/nurse/inventory', isNurse = true
 * - /doctor/inventory/* → basePath = '/doctor/inventory', isDoctor = true
 * - fallback → '/nurse/inventory' (defensive default)
 */
export function useInventoryBasePath(): InventoryBasePath {
  const location = useLocation();
  const path = location.pathname;

  if (path.startsWith('/doctor/inventory')) {
    return { basePath: '/doctor/inventory', isDoctor: true, isNurse: false };
  }

  if (path.startsWith('/nurse/inventory')) {
    return { basePath: '/nurse/inventory', isDoctor: false, isNurse: true };
  }

  return { basePath: '/nurse/inventory', isDoctor: false, isNurse: true };
}