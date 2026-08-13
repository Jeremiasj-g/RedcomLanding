import type { Meeting } from './types';

export const mockMeetings: Meeting[] = [
  {
    id: 'demo-corrientes-chaco',
    title: 'Reunión comercial · Corrientes + Chaco',
    date: '2026-08-13T10:00:00-03:00',
    durationMinutes: 64,
    branches: ['Corrientes', 'Chaco'],
    source: 'mock',
    status: 'processed',
    summary: 'Se revisaron objetivos de agosto, problemas de cobertura y cambios en rutas comerciales. Se acordó priorizar clientes sin compra, revisar rutas MAVI y actualizar el tablero antes de la próxima reunión.',
    participants: [
      { id: 'p1', name: 'Gustavo Meza', role: 'Jefe de ventas' },
      { id: 'p2', name: 'Javier Sánchez', role: 'Jefe de ventas' },
      { id: 'p3', name: 'Supervisor Corrientes', role: 'Supervisor' },
      { id: 'p4', name: 'Sistemas', role: 'Soporte / BI' },
    ],
    keyPoints: [
      { id: 'k1', timestampSeconds: 222, title: 'Cobertura Corrientes', description: 'Se detectó una caída de cobertura en rutas MAVI y se pidió revisar clientes sin visita.' },
      { id: 'k2', timestampSeconds: 738, title: 'Clientes sin compra', description: 'Se acordó identificar clientes que no registraron compras durante agosto.' },
      { id: 'k3', timestampSeconds: 1491, title: 'Objetivo Quento Snack', description: 'El equipo planteó dificultades para alcanzar el objetivo actual y se pidió revisar distribución y frecuencia.' },
      { id: 'k4', timestampSeconds: 2287, title: 'Reorganización de rutas', description: 'Se decidió ajustar determinadas rutas y presentar una propuesta antes del viernes.' },
    ],
    actions: [
      { id: 'a1', responsible: 'Gustavo Meza', action: 'Revisar rutas MAVI', deadline: '15/08', status: 'pending', timestampSeconds: 2287 },
      { id: 'a2', responsible: 'Supervisor Corrientes', action: 'Identificar clientes sin compra', deadline: '14/08', status: 'in_progress', timestampSeconds: 738 },
      { id: 'a3', responsible: 'Sistemas', action: 'Actualizar tablero de cobertura', deadline: '16/08', status: 'pending', timestampSeconds: 2510 },
    ],
    transcript: [
      { id: 't1', startSeconds: 0, speaker: 'Gustavo Meza', text: 'Buenos días. La idea es revisar objetivos y los puntos que quedaron pendientes de cobertura.' },
      { id: 't2', startSeconds: 222, speaker: 'Supervisor Corrientes', text: 'Corrientes viene mostrando una baja de cobertura en algunas rutas MAVI y hay clientes que no están siendo visitados.' },
      { id: 't3', startSeconds: 738, speaker: 'Javier Sánchez', text: 'Necesitamos separar los clientes que no compraron durante agosto y revisar cuáles siguen activos.' },
      { id: 't4', startSeconds: 1491, speaker: 'Gustavo Meza', text: 'Con Quento estamos por debajo de lo esperado. Revisemos distribución, frecuencia y cobertura antes de tocar el objetivo.' },
      { id: 't5', startSeconds: 2287, speaker: 'Javier Sánchez', text: 'Propongo reorganizar esas rutas y tener una propuesta cerrada antes del viernes.' },
      { id: 't6', startSeconds: 2510, speaker: 'Sistemas', text: 'Podemos actualizar el tablero con el nuevo corte de clientes y dejarlo disponible para la próxima revisión.' },
    ],
  },
  {
    id: 'demo-misiones',
    title: 'Seguimiento mensual · Misiones',
    date: '2026-08-11T09:30:00-03:00',
    durationMinutes: 48,
    branches: ['Misiones'],
    source: 'mock',
    status: 'processed',
    summary: 'Revisión de objetivos mensuales y cobertura de líneas foco.',
    participants: [{ id: 'p5', name: 'Equipo Misiones', role: 'Sucursal' }],
    keyPoints: [{ id: 'k5', timestampSeconds: 510, title: 'Cobertura Héroes', description: 'Se revisó el avance de cobertura de la línea Héroes.' }],
    actions: [{ id: 'a4', responsible: 'Equipo Misiones', action: 'Actualizar listado de clientes objetivo', status: 'pending' }],
    transcript: [{ id: 't7', startSeconds: 510, speaker: 'Equipo Misiones', text: 'Vamos a actualizar el listado de clientes objetivo antes del próximo cierre.' }],
  },
];

export function getMockMeeting(id: string) {
  return mockMeetings.find((meeting) => meeting.id === id) ?? null;
}
