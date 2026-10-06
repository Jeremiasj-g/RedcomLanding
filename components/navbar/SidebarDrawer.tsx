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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { NavSectionModel, NavItemModel } from './types';
import { Menu, Sparkles } from 'lucide-react';

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

  const accent = item.enabled
    ? (item.className ?? 'text-white/[0.70]')
    : 'text-white/[0.30]';

  const row = (
    <div
      className={cn(
        'group relative flex min-h-10 items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-[12px] transition-all duration-150',
        active && item.enabled
          ? 'bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.055)]'
          : accent,
        item.enabled
          ? 'hover:bg-white/[0.055] hover:text-white'
          : 'cursor-not-allowed opacity-45',
      )}
    >
      {active && item.enabled ? (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#5ac8fa]" />
      ) : null}

      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            'grid h-6 w-6 shrink-0 place-items-center rounded-[8px] transition',
            active && item.enabled
              ? 'bg-white/[0.055]'
              : 'bg-transparent group-hover:bg-white/[0.035]',
          )}
        >
          {item.icon}
        </span>
        <span className="truncate font-medium">{item.label}</span>
      </div>

      {item.badge ? (
        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-medium text-white/[0.70]">
          {item.badge}
        </span>
      ) : null}
    </div>
  );

  if (!item.enabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div aria-disabled="true">{row}</div>
        </TooltipTrigger>
        <TooltipContent className="border-white/[0.08] bg-[#202126] text-white/[0.86] shadow-xl">
          {item.reason ?? 'Sin acceso'}
        </TooltipContent>
      </Tooltip>
    );
  }

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
  title = 'Navegación',
}: Props) {
  const pathname = usePathname();

  const defaultOpen = Array.isArray(sections)
    ? sections
        .filter((section) => section.defaultOpen !== false)
        .map((section) => section.key)
    : [];

  const onNavigate = () => onOpenChange(false);

  return (
    <TooltipProvider delayDuration={150}>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          className={cn(
            'w-[338px] border-r border-white/[0.08] bg-[#1c2430]/[0.985] p-0 text-white shadow-[24px_0_80px_rgba(0,0,0,.38)] backdrop-blur-2xl sm:w-[352px]',
          )}
        >
          <SheetHeader className="border-b border-white/[0.065] px-4 pb-3 pt-4 pr-12">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-white/[0.08] bg-white/[0.045] text-white/[0.70]">
                <Menu className="h-4 w-4" />
              </div>
              <div className="min-w-0 text-left">
                <SheetTitle className="text-[13px] font-medium tracking-[-0.01em] text-white/[0.92]">
                  {title}
                </SheetTitle>
                <p className="mt-0.5 text-[9px] uppercase tracking-[0.11em] text-white/[0.28]">
                  Redcom Workspace
                </p>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-69px)]">
            <div className="space-y-4 p-3.5">
              <div className="flex items-center gap-2 rounded-[13px] border border-[#0a84ff]/10 bg-[#0a84ff]/[0.045] px-3 py-2.5 text-[10px] text-[#8bc7ff]/70">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>Accesos disponibles según tu rol y sucursales.</span>
              </div>

              <Accordion
                type="multiple"
                defaultValue={defaultOpen}
                className="space-y-2.5"
              >
                {sections.map((section) => (
                  <AccordionItem
                    key={section.key}
                    value={section.key}
                    className="overflow-hidden rounded-[16px] border border-white/[0.055] bg-black/[0.11] px-1.5"
                  >
                    <AccordionTrigger className="px-2.5 py-3 text-[10px] font-medium uppercase tracking-[0.09em] text-white/[0.42] hover:no-underline data-[state=open]:text-white/[0.62]">
                      <div className="flex min-w-0 items-center gap-2">
                        {section.icon ? (
                          <span className="text-white/[0.34]">{section.icon}</span>
                        ) : null}
                        <span className="truncate">{section.label}</span>
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

              <div className="px-2 pb-4 pt-2 text-center text-[9px] text-white/[0.18]">
                REDCOM · Espacio de trabajo
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
