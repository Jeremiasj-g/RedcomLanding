// components/navbar/getNavModel.ts
import { NAV_SECTIONS, type NavRuleCtx } from './nav.config';
import type { NavSectionModel } from './types';

type Badges = {
  pendingCount?: number | null;
  unreadNotifs?: number;
};

export function getNavModel(ctx: NavRuleCtx, badges?: Badges): NavSectionModel[] {
  const pendingCount = badges?.pendingCount ?? null;
  const unreadNotifs = badges?.unreadNotifs ?? 0;

  const sections: NavSectionModel[] = NAV_SECTIONS.map((section) => {
    const items = section.items
      .map((it) => {
        const enabled = it.enabledWhen ? it.enabledWhen(ctx) : true;
        const reason = !enabled && it.enabledReason ? it.enabledReason(ctx) : undefined;

        let badge: number | string | null = null;
        if (it.id === 'solicitudes' && pendingCount && pendingCount > 0) {
          badge = pendingCount > 99 ? '99+' : pendingCount;
        }
        if (it.id === 'notificaciones' && unreadNotifs > 0) {
          badge = unreadNotifs > 9 ? '9+' : unreadNotifs;
        }

        return {
          key: it.id,
          label: it.label,
          href: it.href,
          icon: it.icon,
          enabled,
          reason,
          className: it.className,
          badge,
        };
      })
      .filter((item) => item.enabled);

    return {
      key: section.id,
      label: section.title,
      defaultOpen: section.defaultOpen ?? true,
      items,
    };
  }).filter((section) => section.items.length > 0);

  return sections;
}
