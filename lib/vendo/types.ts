import type { VendoDeletionReasonCode } from './deletionReasons';

export type VendoMovementType = 'alta' | 'baja';
export type VendoRequestStatus = 'pending' | 'accepted' | 'rejected';
export type VendoEmailStatus = 'pending' | 'sent' | 'partial' | 'failed' | 'no_recipients';

export type VendoRequest = {
  id: string;
  branch_code: string;
  branch_name: string;
  first_name: string;
  last_name: string;
  movement_type: VendoMovementType;
  imei: string;
  phone: string;
  vendor_email: string;
  reason: string;
  requested_by: string;
  requester_name: string;
  requester_email: string;
  requester_role: string | null;
  requester_branches: string[];
  status: VendoRequestStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  review_note: string | null;
  deletion_requested_at: string | null;
  deletion_requested_by: string | null;
  deletion_reason_code: VendoDeletionReasonCode | null;
  deletion_reason_note: string | null;
  reply_started_at: string | null;
  reply_started_by: string | null;
  reply_started_by_name: string | null;
  // Campos anteriores conservados por compatibilidad con datos ya creados.
  seen_at: string | null;
  seen_by: string | null;
  email_status: VendoEmailStatus;
  email_sent_at: string | null;
  email_recipients: string[];
  email_error: string | null;
  created_at: string;
  updated_at: string;
};