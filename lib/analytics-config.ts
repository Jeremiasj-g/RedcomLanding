export type AnalyticsEmbedSection = 'dashboard' | 'heatmap' | 'workbook';

export type AnalyticsScopeKey =
  | 'corrientes_masivos'
  | 'corrientes_refrigerados'
  | 'corrientes_refrigerados_kilos'
  | 'chaco'
  | 'misiones'
  | 'obera'
  | 'gerencia';

export type AnalyticsEmbedSettingRow = {
  id?: string;
  section: AnalyticsEmbedSection;
  scope_key: AnalyticsScopeKey;
  url: string;
  updated_by?: string | null;
  updated_by_name?: string | null;
  updated_at?: string | null;
};

export type AnalyticsScopeDefinition = {
  key: AnalyticsScopeKey;
  label: string;
  shortLabel: string;
  description: string;
  sections: AnalyticsEmbedSection[];
};

export const ANALYTICS_SCOPE_DEFINITIONS: AnalyticsScopeDefinition[] = [
  {
    key: 'corrientes_masivos',
    label: 'Corrientes · Masivos',
    shortLabel: 'Corrientes Masivos',
    description: 'Visualizaciones comerciales de la operación masiva de Corrientes.',
    sections: ['dashboard', 'heatmap', 'workbook'],
  },
  {
    key: 'corrientes_refrigerados',
    label: 'Corrientes · Refrigerados',
    shortLabel: 'Refrigerados',
    description: 'Visualizaciones comerciales de Corrientes Refrigerados.',
    sections: ['dashboard', 'heatmap', 'workbook'],
  },
  {
    key: 'corrientes_refrigerados_kilos',
    label: 'Refrigerados · Kilos',
    shortLabel: 'Refrigerados Kilos',
    description: 'Vista adicional para análisis de kilos de Refrigerados.',
    sections: ['dashboard', 'heatmap'],
  },
  {
    key: 'chaco',
    label: 'Chaco · Masivos',
    shortLabel: 'Chaco',
    description: 'Visualizaciones comerciales de la sucursal Resistencia.',
    sections: ['dashboard', 'heatmap', 'workbook'],
  },
  {
    key: 'misiones',
    label: 'Misiones · Masivos',
    shortLabel: 'Misiones',
    description: 'Visualizaciones comerciales de la sucursal Posadas.',
    sections: ['dashboard', 'heatmap', 'workbook'],
  },
  {
    key: 'obera',
    label: 'Oberá · Masivos',
    shortLabel: 'Oberá',
    description: 'Visualizaciones comerciales de la sucursal Oberá.',
    sections: ['dashboard', 'heatmap', 'workbook'],
  },
  {
    key: 'gerencia',
    label: 'Gerencia · Consolidado',
    shortLabel: 'Gerencia',
    description: 'Vista consolidada utilizada por Gerencia.',
    sections: ['dashboard', 'heatmap', 'workbook'],
  },
];

export const LEGACY_LOOKER_ID_TO_SCOPE: Record<string, AnalyticsScopeKey> = {
  masivos: 'corrientes_masivos',
  refrigerados: 'corrientes_refrigerados',
  refrigeradosKilos: 'corrientes_refrigerados_kilos',
  chaco: 'chaco',
  misiones: 'misiones',
  obera: 'obera',
  gerencia: 'gerencia',
};

export type WorkbookPresentation = {
  title: string;
  description: string;
  buttonLabel: string;
  accentColor: string;
};

export const WORKBOOK_PRESENTATION: Partial<Record<AnalyticsScopeKey, WorkbookPresentation>> = {
  corrientes_masivos: {
    title: 'Tablero de Corrientes',
    description: 'Visualizá el tablero trimestral de Corrientes',
    buttonLabel: 'Abrir tablero',
    accentColor: '#FFF6BD',
  },
  corrientes_refrigerados: {
    title: 'Tablero de Refrigerados',
    description: 'Visualizá el tablero trimestral de Refrigerados',
    buttonLabel: 'Abrir tablero',
    accentColor: '#FFF6BD',
  },
  chaco: {
    title: 'Tablero de Resistencia',
    description: 'Visualizá el tablero trimestral de Resistencia',
    buttonLabel: 'Abrir tablero',
    accentColor: '#FFF6BD',
  },
  misiones: {
    title: 'Tablero de Misiones',
    description: 'Visualizá el tablero trimestral de Misiones',
    buttonLabel: 'Abrir tablero',
    accentColor: '#FFF6BD',
  },
  obera: {
    title: 'Tablero de Oberá',
    description: 'Visualizá el tablero trimestral de Oberá',
    buttonLabel: 'Abrir tablero',
    accentColor: '#FFF6BD',
  },
  gerencia: {
    title: 'Tablero de Gerencia',
    description: 'Visualizá el tablero trimestral de Gerencia',
    buttonLabel: 'Abrir tablero',
    accentColor: '#FFF6BD',
  },
};

export const ANALYTICS_DEFAULT_URLS: Record<
  AnalyticsEmbedSection,
  Partial<Record<AnalyticsScopeKey, string>>
> = {
  dashboard: {
    corrientes_masivos:
      'https://datastudio.google.com/embed/reporting/2ecfc88c-9070-4498-8a28-75a1fb347c26/page/9jv2F',
    corrientes_refrigerados:
      'https://datastudio.google.com/embed/reporting/02c9a8a8-1e04-46ab-a655-14f32933d372/page/VQ02F',
    corrientes_refrigerados_kilos: '',
    chaco:
      'https://datastudio.google.com/embed/reporting/0ade1098-b0d4-464d-8921-ce34ee5aa6ca/page/35y2F',
    misiones:
      'https://datastudio.google.com/embed/reporting/fea1c84b-03f7-40f4-bd9f-59b362e5ed1f/page/BKz2F',
    obera:
      'https://datastudio.google.com/embed/reporting/5d398019-4654-4c01-b587-03f5137b71a2/page/Cdz2F',
    gerencia:
      'https://datastudio.google.com/embed/reporting/448cb6d2-7c09-4ceb-8205-bb71ad87f355/page/knZ3F',
  },
  heatmap: {
    corrientes_masivos:
      'https://datastudio.google.com/embed/reporting/8b4b18c4-21b2-4fba-b1d1-be4dd1b28c51/page/uLA3F',
    corrientes_refrigerados: '',
    corrientes_refrigerados_kilos: '',
    chaco:
      'https://datastudio.google.com/embed/reporting/e7c3de2e-a16b-4a6f-99dc-57a858c25549/page/5TA3F',
    misiones:
      'https://datastudio.google.com/embed/reporting/53d95184-a8df-42fd-983a-ca944a7622dd/page/8tA3F',
    obera:
      'https://datastudio.google.com/embed/reporting/151511b7-a341-4061-8605-2598e26d1cf3/page/75A3F',
    gerencia: '',
  },
  workbook: {
    corrientes_masivos:
      'https://onedrive.live.com/edit?cid=e002e7d72e5a47f0&id=E002E7D72E5A47F0!sf37e86de3a974df9bc681f334cebaf36&resid=E002E7D72E5A47F0!sf37e86de3a974df9bc681f334cebaf36&ithint=file%2Cxlsx&embed=1&em=2&ActiveCell=%27volumen%27!A10&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True%2CTrue%22%3E%3C%2Fiframe%3E&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9lMDAyZTdkNzJlNWE0N2YwL0lRVGVobjd6bHpyNVRieG9Iek5NNjY4MkFWQjN5U2hTWDgzVTllNDZuNHBMZEFZP2VtPTImQWN0aXZlQ2VsbD0ndm9sdW1lbichQTEwJndkSGlkZUdyaWRsaW5lcz1UcnVlJndkSGlkZUhlYWRlcnM9VHJ1ZSZ3ZEluQ29uZmlndXJhdG9yPVRydWUiPjwvaWZyYW1lPg&wdo=2',
    corrientes_refrigerados: '',
    chaco:
      'https://onedrive.live.com/edit?cid=e002e7d72e5a47f0&id=E002E7D72E5A47F0!sf11df9e8a0674c2581499b9acde5ef65&resid=E002E7D72E5A47F0!sf11df9e8a0674c2581499b9acde5ef65&ithint=file%2Cxlsx&embed=1&em=2&AllowTyping=True&ActiveCell=%27facturacion%27!A10&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True%2CTrue%22%3E%3C%2Fiframe%3E&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9lMDAyZTdkNzJlNWE0N2YwL0lRVG8tUjN4WjZBbFRJRkptNXJONWU5bEFTN0dYZ1dqaUVzOVJSeTVPcVJuYVB3P2VtPTImQWxsb3dUeXBpbmc9VHJ1ZSZBY3RpdmVDZWxsPSdmYWN0dXJhY2lvbichQTEwJndkSGlkZUdyaWRsaW5lcz1UcnVlJndkSGlkZUhlYWRlcnM9VHJ1ZSZ3ZEluQ29uZmlndXJhdG9yPVRydWUiPjwvaWZyYW1lPg&wdo=2',
    misiones:
      'https://onedrive.live.com/edit?cid=e002e7d72e5a47f0&id=E002E7D72E5A47F0!seb9aade87072492fb49eeff2cdba0130&resid=E002E7D72E5A47F0!seb9aade87072492fb49eeff2cdba0130&ithint=file%2Cxlsx&embed=1&em=2&AllowTyping=True&ActiveCell=%27volumen%27!A11&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True%2CTrue%22%3E%3C%2Fiframe%3E&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9lMDAyZTdkNzJlNWE0N2YwL0lRVG9yWnJyY25BdlNiU2U3X0xOdWdFd0FiR3dGUUJORFc2M21JNm5qaGlNTENJP2VtPTImQWxsb3dUeXBpbmc9VHJ1ZSZBY3RpdmVDZWxsPSd2b2x1bWVuJyFBMTEmd2RIaWRlR3JpZGxpbmVzPVRydWUmd2RIaWRlSGVhZGVycz1UcnVlJndkSW5Db25maWd1cmF0b3I9VHJ1ZSZ3ZEluQ29uZmlndXJhdG9yPVRydWUiPjwvaWZyYW1lPg&wdo=2',
    obera:
      'https://onedrive.live.com/edit?cid=e002e7d72e5a47f0&id=E002E7D72E5A47F0!sef5ea314d07d4bd19dcf380fc016bcaa&resid=E002E7D72E5A47F0!sef5ea314d07d4bd19dcf380fc016bcaa&ithint=file%2Cxlsx&embed=1&em=2&AllowTyping=True&ActiveCell=%27volumen%27!A11&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True%2CTrue%22%3E%3C%2Fiframe%3E&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9lMDAyZTdkNzJlNWE0N2YwL0lRUVVvMTd2ZmREUlM1M1BPQV9BRnJ5cUFTZlZmVXVqbmhyWXQ1aE1RWjN6U1FVP2VtPTImQWxsb3dUeXBpbmc9VHJ1ZSZBY3RpdmVDZWxsPSd2b2x1bWVuJyFBMTEmd2RIaWRlR3JpZGxpbmVzPVRydWUmd2RIaWRlSGVhZGVycz1UcnVlJndkSW5Db25maWd1cmF0b3I9VHJ1ZSZ3ZEluQ29uZmlndXJhdG9yPVRydWUiPjwvaWZyYW1lPg&wdo=2',
    gerencia:
      'https://onedrive.live.com/edit?cid=e002e7d72e5a47f0&id=E002E7D72E5A47F0!s098998047ee141bfb5d363207336f703&resid=E002E7D72E5A47F0!s098998047ee141bfb5d363207336f703&ithint=file%2Cxlsx&embed=1&em=2&AllowTyping=True&ActiveCell=%27Volumen%27!A11&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True%2CTrue%22%3E%3C%2Fiframe%3E&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9lMDAyZTdkNzJlNWE0N2YwL0lRUUVtSWtKNFg2X1FiWFRZeUJ6TnZjREFjNkpRNGFGOFBVd2J3SVNlcXVMNEcwP2VtPTImQWxsb3dUeXBpbmc9VHJ1ZSZBY3RpdmVDZWxsPSdWb2x1bWVuJyFBMTEmd2RIaWRlR3JpZGxpbmVzPVRydWUmd2RIaWRlSGVhZGVycz1UcnVlJndkSW5Db25maWd1cmF0b3I9VHJ1ZSZ3ZEluQ29uZmlndXJhdG9yPVRydWUiPjwvaWZyYW1lPg&wdo=2',
  },
};

export function analyticsSettingKey(
  section: AnalyticsEmbedSection,
  scopeKey: AnalyticsScopeKey,
) {
  return `${section}:${scopeKey}`;
}

export function getDefaultAnalyticsUrl(
  section: AnalyticsEmbedSection,
  scopeKey: AnalyticsScopeKey,
) {
  return ANALYTICS_DEFAULT_URLS[section]?.[scopeKey] ?? '';
}

export function getAnalyticsScopeForLookerId(lookerId: string): AnalyticsScopeKey {
  return LEGACY_LOOKER_ID_TO_SCOPE[lookerId] ?? 'corrientes_masivos';
}

export function getScopesForSection(section: AnalyticsEmbedSection) {
  return ANALYTICS_SCOPE_DEFINITIONS.filter((scope) => scope.sections.includes(section));
}
