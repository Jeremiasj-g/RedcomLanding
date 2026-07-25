import type { VendoMovementType } from './types';

type VendoEmailInput = {
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
  createdAt: string;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export function buildVendoEmail(input: VendoEmailInput) {
  const movement = input.movementType.toUpperCase();
  const vendorName = `${input.firstName} ${input.lastName}`.trim();
  const subject = `Dispositivo para dar de ${movement} de ${vendorName}, Sucursal ${input.branchName.toUpperCase()}`;
  const formattedDate = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Cordoba',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(new Date(input.createdAt));

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:7px 0;color:#64748b;font-size:13px;vertical-align:top;width:190px;">${escapeHtml(label)}</td>
      <td style="padding:7px 0;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`;

  const html = `
<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08);">
            <tr>
              <td style="background:#1d1d1f;padding:22px 28px;border-bottom:4px solid #b91c1c;">
                <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#fca5a5;font-weight:700;">REDCOM · Solicitud VENDO</div>
                <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.35;">${escapeHtml(subject)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 18px;color:#334155;font-size:14px;line-height:1.65;">Buenos días. A continuación se informan los datos de una nueva solicitud para la planilla de dispositivos VENDO.</p>

                <div style="margin:0 0 18px;padding:16px 18px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9a3412;font-weight:700;">Datos del dispositivo VENDO</div>
                  <div style="margin-top:7px;color:#7c2d12;font-size:14px;">${escapeHtml(formattedDate)}</div>
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  ${row('Sucursal', input.branchName)}
                  ${row('Operación', movement)}
                  ${row('Vendedor', vendorName)}
                  ${row('IMEI / código de aplicación', input.imei)}
                  ${row('Número de celular', input.phone)}
                  ${row('Correo electrónico', input.vendorEmail)}
                  ${row('Motivo del movimiento', input.reason)}
                </table>

                <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e2e8f0;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:700;">Solicitado por</div>
                  <div style="margin-top:8px;font-size:14px;color:#0f172a;font-weight:700;">${escapeHtml(input.requesterName)}</div>
                  <div style="margin-top:3px;font-size:13px;color:#475569;">${escapeHtml(input.requesterEmail)}${input.requesterRole ? ` · ${escapeHtml(input.requesterRole)}` : ''}</div>
                </div>

                <p style="margin:24px 0 0;color:#334155;font-size:14px;line-height:1.65;">La solicitud quedó registrada en el panel de administración. El alta o la baja deberá completarse manualmente en el sistema VENDO.</p>
                <p style="margin:16px 0 0;color:#334155;font-size:14px;">Que tenga un buen día. Saludos.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    subject,
    '',
    'Buenos días. A continuación se informan los datos de una nueva solicitud para la planilla de dispositivos VENDO.',
    '',
    `Fecha: ${formattedDate}`,
    `Sucursal: ${input.branchName}`,
    `Operación: ${movement}`,
    `Vendedor: ${vendorName}`,
    `IMEI / código de aplicación: ${input.imei}`,
    `Número de celular: ${input.phone}`,
    `Correo electrónico: ${input.vendorEmail}`,
    `Motivo del movimiento: ${input.reason}`,
    '',
    `Solicitado por: ${input.requesterName} (${input.requesterEmail})`,
    '',
    'La solicitud quedó registrada en el panel de administración. El alta o la baja deberá completarse manualmente en el sistema VENDO.',
  ].join('\n');

  return { subject, html, text };
}
