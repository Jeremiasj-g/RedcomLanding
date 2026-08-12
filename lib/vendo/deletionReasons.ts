export const VENDO_DELETION_REASONS = [
  { code: 'wrong_data', label: 'Me equivoqué en uno o más datos' },
  { code: 'duplicate', label: 'Envié la solicitud por duplicado' },
  { code: 'wrong_movement', label: 'Seleccioné el tipo de movimiento incorrecto' },
  { code: 'no_longer_needed', label: 'La solicitud ya no es necesaria' },
  { code: 'other', label: 'Otro motivo' },
] as const;

export const VENDO_DELETION_REASON_CODES = VENDO_DELETION_REASONS.map((reason) => reason.code) as [
  'wrong_data',
  'duplicate',
  'wrong_movement',
  'no_longer_needed',
  'other',
];

export type VendoDeletionReasonCode = (typeof VENDO_DELETION_REASONS)[number]['code'];

export function vendoDeletionReasonLabel(code?: string | null) {
  return VENDO_DELETION_REASONS.find((reason) => reason.code === code)?.label ?? 'Motivo no especificado';
}
