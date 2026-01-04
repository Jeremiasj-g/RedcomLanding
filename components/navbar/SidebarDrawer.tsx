'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { NavSectionModel, NavItemModel } from './types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: NavSectionModel[];
  title?: string;
};

function isActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

function NavRow({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItemModel;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = item.href ? isActive(item.href, pathname) : false;

  // Respeta colores/acento definidos en nav.config.tsx
  const accent = item.enabled ? (item.className ?? 'text-slate-200') : 'text-slate-200';

  const row = (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition',
        active && item.enabled ? 'bg-slate-800/70 text-slate-50' : accent,
        item.enabled ? 'hover:bg-slate-800/60' : 'opacity-40 cursor-not-allowed',
      )}
    >
      <div className="flex items-center gap-2">
        {item.icon}
        <span className="font-medium">{item.label}</span>
      </div>

      {item.badge ? (
        <span className="ml-auto rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-100">
          {item.badge}
        </span>
      ) : null}
    </div>
  );

  // 🚫 Si no está habilitado: no hay Link
  if (!item.enabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div aria-disabled="true">{row}</div>
        </TooltipTrigger>
        <TooltipContent className="border-slate-800 bg-slate-900 text-slate-100">
          {item.reason ?? 'Sin acceso'}
        </TooltipContent>
      </Tooltip>
    );
  }

  // ✅ Si está habilitado pero no tiene href (caso raro): no Link, solo row
  if (!item.href) return row;

  return (
    <Link href={item.href} onClick={onNavigate} className="block">
      {row}
    </Link>
  );
}

export default function SidebarDrawer({
  open,
  onOpenChange,
  sections,
  title = 'Menú',
}: Props) {
  const pathname = usePathname();

  // Todos abiertos por defecto
  const defaultOpen = Array.isArray(sections) ? sections.map((s) => s.key) : [];

  const onNavigate = () => onOpenChange(false);

  return (
    <TooltipProvider delayDuration={150}>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className={cn('w-[340px] border-slate-800 bg-gray-800 text-slate-100', 'p-0')}>
          <SheetHeader className="border-b border-slate-800 px-4 py-3">
            <SheetTitle className="text-sm font-semibold tracking-wide text-slate-200">
              {title}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-56px)]">
            <div className="p-3">
              <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-2">
                {sections.map((section) => (
                  <AccordionItem
                    key={section.key}
                    value={section.key}
                    className="rounded-2xl border border-slate-800 bg-slate-900/40 px-2"
                  >
                    <AccordionTrigger className="px-2 py-2 text-sm font-semibold text-red-100 hover:no-underline">
                      <div className="flex items-center gap-2">
                        {section.icon}
                        <span>{section.label}</span>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="pb-2">
                      <div className="space-y-1">
                        {section.items.map((item) => (
                          <NavRow
                            key={item.key}
                            item={item}
                            pathname={pathname}
                            onNavigate={onNavigate}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
