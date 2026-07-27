import type { VendoMovementType, VendoRequest } from './types';

export const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

// Web3Forms documenta la Access Key como un identificador público del formulario.
// En producción puede reemplazarse mediante NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY.
export const DEFAULT_WEB3FORMS_ACCESS_KEY = 'ee2bb86c-251a-41d0-82d2-29c6e92c00a8';

export type VendoWeb3FormsInput = {
  requestId: string;
  branchName: string;
  firstName: string;
  lastName: string;
  movementType: VendoMovementType;
  imei: string;
  phone: string;
  vendorEmail: string;
  reason: string;
  requesterName: string;
  requesterEmail: string;
  requesterRole?: string | null;
  requesterBranches?: string[];
  createdAt: string;
};

export type VendoWeb3FormsPayload = Record<string, string> & {
  access_key: string;
  subject: string;
  from_name: string;
  replyto: string;
  message: string;
};

export function getWeb3FormsAccessKey() {
  return String(
    process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY || DEFAULT_WEB3FORMS_ACCESS_KEY,
  ).trim();
}

export function buildVendoEmailSubject(input: Pick<VendoWeb3FormsInput, 'movementType' | 'firstName' | 'lastName' | 'branchName'>) {
  const movement = input.movementType.toUpperCase();
  const vendorName = `${input.firstName} ${input.lastName}`.trim();
  return `Dispositivo para dar de ${movement} de ${vendorName}, Sucursal ${input.branchName.toUpperCase()}`;
}

export function buildVendoEmailMessage(input: VendoWeb3FormsInput) {
  const movement = input.movementType.toUpperCase();
  const vendorName = `${input.firstName} ${input.lastName}`.trim();
  const formattedDate = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Cordoba',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(new Date(input.createdAt));
  const requesterBranches = (input.requesterBranches ?? []).join(', ') || 'Sin sucursales informadas';
  const closing = input.movementType === 'alta'
    ? 'cuando el dispositivo se encuentre habilitado.'
    : 'cuando el dispositivo se encuentre inactivo.';

  return [
    'Buenos días. A continuación se informan los datos del nuevo registro',
    'en la planilla de Dispositivos VENDO.',
    '',
    'Datos del Dispositivo VENDO',
    `Fecha: ${formattedDate}`,
    `Sucursal: ${input.branchName.toUpperCase()}`,
    '',
    `Operación: ${movement}`,
    `Vendedor: ${vendorName}`,
    '',
    `Cod de Aplicación / IMEI: ${input.imei}`,
    `Número de Celular: ${input.phone}`,
    '',
    `Correo electrónico: ${input.vendorEmail}`,
    `Motivo del movimiento: ${input.reason}`,
    '',
    `Solicitud registrada por: ${input.requesterName}`,
    `Correo del solicitante: ${input.requesterEmail}`,
    `Rol del solicitante: ${input.requesterRole || 'Sin rol informado'}`,
    `Sucursales del solicitante: ${requesterBranches}`,
    '',
    `En breve se le estará comunicando ${closing}`,
    '',
    'Que tenga un buen día. Saludos.',
    '',
    `ID interno de solicitud: ${input.requestId}`,
  ].join('\n');
}

export function buildVendoWeb3FormsPayload(
  input: VendoWeb3FormsInput,
  accessKey = getWeb3FormsAccessKey(),
): VendoWeb3FormsPayload {
  const replyEmail = input.requesterEmail || input.vendorEmail;

  return {
    access_key: accessKey,
    subject: buildVendoEmailSubject(input),
    from_name: `${input.requesterName || 'REDCOM'} · Solicitud VENDO`,
    // Se usa replyto, en vez del campo email, para que Web3Forms no muestre
    // una fila "Email" adicional y el botón Responder apunte al solicitante.
    replyto: replyEmail,
    message: buildVendoEmailMessage(input),
  };
}

export function buildVendoWeb3FormsPayloadFromRequest(request: VendoRequest) {
  return buildVendoWeb3FormsPayload({
    requestId: request.id,
    branchName: request.branch_name,
    firstName: request.first_name,
    lastName: request.last_name,
    movementType: request.movement_type,
    imei: request.imei,
    phone: request.phone,
    vendorEmail: request.vendor_email,
    reason: request.reason,
    requesterName: request.requester_name,
    requesterEmail: request.requester_email,
    requesterRole: request.requester_role,
    requesterBranches: request.requester_branches,
    createdAt: request.created_at,
  });
}

export async function submitVendoWeb3Forms(payload: VendoWeb3FormsPayload) {
  const response = await fetch(WEB3FORMS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { message: raw };
  }

  const success = response.ok && data?.success === true;
  const message = String(
    data?.message
      ?? data?.body?.message
      ?? data?.error
      ?? (success ? 'Web3Forms aceptó la solicitud.' : `Web3Forms respondió con estado ${response.status}.`),
  );

  if (!success) {
    throw new Error(message);
  }

  return { message, data };
}
