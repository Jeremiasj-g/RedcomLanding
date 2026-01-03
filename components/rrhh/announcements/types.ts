export type AnnouncementType = 'news' | 'weekly' | 'birthday' | 'important_alert';
export type Severity = 'info' | 'warning' | 'critical';

export const ROLES = ['admin', 'supervisor', 'vendedor', 'rrhh'] as const;

export const TYPE_OPTIONS: { value: AnnouncementType; label: string; hint: string }[] = [
  { value: 'news', label: 'Noticia', hint: 'Comunicado general / novedades' },
  { value: 'weekly', label: 'Semanal', hint: 'Resumen o recordatorios de la semana' },
  { value: 'birthday', label: 'Cumpleaños', hint: 'Festejos / saludo del día' },
  { value: 'important_alert', label: 'Alerta importante (popup)', hint: 'Se muestra como popup en home' },
];

export const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

export type BranchOption = { id: string; label: string; value: string };
