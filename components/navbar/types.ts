import type React from 'react';

export type UserRole = 'admin' | 'supervisor' | 'vendedor' | 'rrhh' | 'jdv' | string;

export type NavItemModel = {
  key: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;

  // permisos
  enabled: boolean;
  reason?: string;

  // UI
  className?: string; // ✅ colores/acento (text-sky-300, text-emerald-300, etc.)
  badge?: number | string | null;
};

export type NavSectionModel = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  items: NavItemModel[];
};
