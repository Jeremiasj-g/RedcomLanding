'use client';

import type { ElementType, ReactNode } from 'react';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import { useAnalyticsConfig } from '@/components/analytics/AnalyticsConfigProvider';
import {
  WORKBOOK_PRESENTATION,
  type AnalyticsScopeKey,
} from '@/lib/analytics-config';

type ConfiguredWorkbookCardProps = {
  scopeKey: AnalyticsScopeKey;
  icon?: ReactNode | ElementType;
  className?: string;
};

export default function ConfiguredWorkbookCard({
  scopeKey,
  icon,
  className,
}: ConfiguredWorkbookCardProps) {
  const { getUrl } = useAnalyticsConfig();
  const presentation = WORKBOOK_PRESENTATION[scopeKey];

  if (!presentation) return null;

  return (
    <FullScreenEmbedCard
      {...presentation}
      embedUrl={getUrl('workbook', scopeKey)}
      icon={icon}
      className={className}
    />
  );
}
