// components/navbar/nav.config.tsx
import React from 'react';
import {
  Sparkles,
  CalendarDays,
  ListChecks,
  Shield,
  ClipboardList,
  Hammer,
  Building2,
  LayoutDashboard,
  BadgeCheck,
} from 'lucide-react';

export type NavRuleCtx = {
  logged: boolean;
  isActive: boolean;
  role: string; // 'admin' | 'supervisor' | 'jdv' | 'rrhh' | 'vendedor' | etc
  branches: string[]; // lower-case
};

export type NavItemConfig = {
  id: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;

  // si querés "mostrar siempre", pero deshabilitar según permisos:
  enabledWhen?: (ctx: NavRuleCtx) => boolean;
  enabledReason?: (ctx: NavRuleCtx) => string;

  // 👇 colores/acento (lo que estás pidiendo)
  className?: string;
};

export type NavSectionConfig = {
  id: string;
  title: string;
  items: NavItemConfig[];
  defaultOpen?: boolean; // abiertos por defecto
};

const mustBeLoggedActive = (ctx: NavRuleCtx) => ctx.logged && ctx.isActive;

const roleIn = (roles: string[]) => (ctx: NavRuleCtx) => roles.includes(ctx.role);

const hasBranch = (branch: string) => (ctx: NavRuleCtx) =>
  ctx.branches.includes(branch.toLowerCase());

export const NAV_SECTIONS: NavSectionConfig[] = [
  // 1) Sucursales
  {
    id: 'branches',
    title: 'Sucursales',
    defaultOpen: true,
    items: [
      {
        id: 'ctes-masivos',
        label: 'Corrientes',
        href: '/corrientes/masivos',
        icon: <Building2 className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && hasBranch('corrientes')(ctx),
        enabledReason: () => 'No tenés la sucursal Corrientes',
        className: 'text-slate-100',
      },
      {
        id: 'ctes-refrigerados',
        label: 'Refrigerados',
        href: '/corrientes/refrigerados',
        icon: <Building2 className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && hasBranch('refrigerados')(ctx),
        enabledReason: () => 'No tenés la sucursal Refrigerados',
        className: 'text-slate-100',
      },
      {
        id: 'chaco',
        label: 'Chaco',
        href: '/chaco',
        icon: <Building2 className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && hasBranch('chaco')(ctx),
        enabledReason: () => 'No tenés la sucursal Chaco',
        className: 'text-slate-100',
      },
      {
        id: 'misiones',
        label: 'Misiones',
        href: '/misiones',
        icon: <Building2 className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && hasBranch('misiones')(ctx),
        enabledReason: () => 'No tenés la sucursal Misiones',
        className: 'text-slate-100',
      },
      {
        id: 'obera',
        label: 'Oberá',
        href: '/obera',
        icon: <Building2 className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && hasBranch('obera')(ctx),
        enabledReason: () => 'No tenés la sucursal Oberá',
        className: 'text-slate-100',
      },
    ],
  },

  // 2) Herramientas (antes “links principales” con colores)
  {
    id: 'tools',
    title: 'Espacio de trabajo',
    defaultOpen: true,
    items: [
      {
        id: 'novedades',
        label: 'Novedades',
        href: '/novedades',
        icon: <Sparkles className="h-4 w-4" />,
        enabledWhen: () => true, // visible siempre (pública)
        enabledReason: () => '',
        // ✅ color original
        className: 'text-violet-300 hover:text-violet-100 hover:bg-violet-500/10',
      },
/*       {
        id: 'tableros',
        label: 'Tableros',
        href: '/tableros',
        icon: <LayoutDashboard className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx),
        enabledReason: () => 'Debés iniciar sesión para acceder a Tableros',
        className: 'text-pink-300 hover:text-pink-100 hover:bg-pink-300/10',
      }, */
      {
        id: 'mis-tareas',
        label: 'Mis tareas',
        href: '/tareas',
        icon: <CalendarDays className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && ['admin', 'supervisor', 'jdv'].includes(ctx.role),
        enabledReason: () => 'Solo Admin / Supervisor / JDV',
        // ✅ color original
        className: 'text-sky-300 hover:text-sky-200',
      },
      {
        id: 'proyectos',
        label: 'Proyectos',
        href: '/proyectos',
        icon: <ListChecks className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && ['admin', 'supervisor', 'jdv'].includes(ctx.role),
        enabledReason: () => 'Solo Admin / Supervisor / JDV',
        // ✅ color original
        className: 'text-emerald-300 hover:text-emerald-200',
      },
      {
        id: 'foco',
        label: 'Focos',
        href: '/focos',
        icon: <ListChecks className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx),
        enabledReason: () => '',
        // ✅ color original
        className: 'text-red-300 hover:text-red-200',
      },
      {
        id: 'ccc-calificados',
        label: 'CCC Calificados',
        href: '/ccc-calificados',
        icon: <BadgeCheck className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && ['admin', 'jdv', 'supervisor'].includes(ctx.role),
        enabledReason: () => 'Solo Admin / JDV / Supervisor',
        className: 'text-orange-300 hover:text-orange-200 hover:bg-orange-500/10',
      },
    ],
  },

  // 3) Panel (con colores originales)
  {
    id: 'panel',
    title: 'Panel',
    defaultOpen: true,
    items: [
      {
        id: 'panel-rrhh',
        label: 'Panel de recursos humanos',
        href: '/rrhh',
        icon: <Sparkles className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && ['admin', 'rrhh'].includes(ctx.role),
        enabledReason: () => 'Solo Admin o RRHH',
        // ✅ color original RRHH
        className: 'text-violet-300 hover:text-violet-100 hover:bg-violet-500/10',
      },
      {
        id: 'panel-tareas',
        label: 'Panel de tareas',
        href: '/tareas/panel-tareas',
        icon: <ListChecks className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && ['admin', 'jdv'].includes(ctx.role),
        enabledReason: () => 'Solo Admin / Supervisor',
        // ✅ color original panel tareas
        className: 'text-sky-300 hover:text-sky-200',
      },
      {
        id: 'panel-admin',
        label: 'Panel de administrador',
        href: '/admin',
        icon: <Shield className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && roleIn(['admin'])(ctx),
        enabledReason: () => 'Solo Admin',
        // ✅ color original admin panel
        className: 'text-amber-300 hover:text-amber-200',
      },
      {
        id: 'panel-focos',
        label: 'Panel de focos',
        href: '/focos/panel',
        icon: <Shield className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && roleIn(['admin','supervisor', 'jdv'])(ctx),
        enabledReason: () => 'Solo Admin / Supervisor',
        // ✅ color original admin panel
        className: 'text-red-300 hover:text-red-200',
      },
    ],
  },

  // 4) Admin (Solicitudes + Recursos)
  {
    id: 'admin',
    title: 'Admin',
    defaultOpen: true,
    items: [
      {
        id: 'solicitudes',
        label: 'Solicitudes',
        href: '/admin/solicitudes',
        icon: <ClipboardList className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && roleIn(['admin'])(ctx),
        enabledReason: () => 'Solo Admin',
        className: 'text-slate-100',
      },
      {
        id: 'recursos',
        label: 'Recursos',
        href: '/gerencia',
        icon: <Hammer className="h-4 w-4" />,
        enabledWhen: (ctx) => mustBeLoggedActive(ctx) && roleIn(['admin'])(ctx),
        enabledReason: () => 'Solo Admin',
        className: 'text-slate-100',
      },
    ],
  },
];
