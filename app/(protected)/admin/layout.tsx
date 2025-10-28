'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, UserPlus, ClipboardList, type LucideIcon } from 'lucide-react';
import RequireAdmin from '@/app/auth/RequireAdmin';

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;                 // <— FIX: tipamos con LucideIcon
  match?: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  { href: '/admin', label: 'Usuarios', icon: Users, match: (p) => p === '/admin' || p.startsWith('/admin/usuario') },
  { href: '/admin/new', label: 'Crear usuario', icon: UserPlus },
  { href: '/admin/solicitudes', label: 'Solicitudes', icon: ClipboardList, match: (p) => p.startsWith('/admin/solicitudes') },
];

function isActiveTab(tab: Tab, pathname: string) {
  return tab.match ? tab.match(pathname) : pathname === tab.href;
}

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? 'page' : undefined}
      className={[
        'group relative inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
        active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900',
      ].join(' ')}
    >
      {/* LucideIcon acepta className directamente */}
      <Icon className={`h-4 w-4 ${active ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`} />
      <span>{tab.label}</span>
      <span
        className={[
          'absolute left-3 right-3 -bottom-[6px] h-[3px] rounded-full transition-all',
          active ? 'bg-slate-900' : 'bg-transparent group-hover:bg-slate-300',
        ].join(' ')}
      />
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <RequireAdmin>
      <div className="mx-auto max-w-7xl py-8">
        <nav className="relative overflow-x-auto" aria-label="Navegación de administración">
          <div className="rounded-2xl border border-slate-200 bg-white px-2 py-4 shadow-sm">
            <div className="flex items-center gap-1">
              {TABS.map((tab) => (
                <TabLink key={tab.href} tab={tab} active={isActiveTab(tab, pathname)} />
              ))}
            </div>
          </div>
          <div className="mt-4 h-px w-full bg-slate-200/70" />
        </nav>

        <main className="pt-4">{children}</main>
      </div>
    </RequireAdmin>
  );
}
