export const VENDO_DELETION_REASON_CODES = [
  'wrong_data',
  'duplicate',
  'wrong_movement',
  'no_longer_needed',
  'other',
] as const;

export type VendoDeletionReasonCode = (typeof VENDO_DELETION_REASON_CODES)[number];

export const VENDO_DELETION_REASONS: ReadonlyArray<{
  code: VendoDeletionReasonCode;
  label: string;
}> = [
  { code: 'wrong_data', label: 'Me equivoqué en uno o más datos' },
  { code: 'duplicate', label: 'Envié la solicitud por duplicado' },
  { code: 'wrong_movement', label: 'Seleccioné el tipo de movimiento incorrecto' },
  { code: 'no_longer_needed', label: 'La solicitud ya no es necesaria' },
  { code: 'other', label: 'Otro motivo' },
];

export function vendoDeletionReasonLabel(code?: string | null) {
  return VENDO_DELETION_REASONS.find((reason) => reason.code === code)?.label ?? 'Motivo no especificado';
}
