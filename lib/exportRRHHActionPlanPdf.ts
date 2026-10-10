import { jsPDF } from 'jspdf';

import type { RRHHActionPlanRow } from '@/lib/rrhhActionPlans';
import {
  formatMoney,
  formatPercent,
  parseNullableNumber,
  type CategoriaHistoryPoint,
  type CategoriaHistorySummary,
} from '@/utils/categoriaHistory';

const BRANCH_LABELS: Record<string, string> = {
  corrientes_masivos: 'Corrientes - Masivos',
  corrientes_refrigerados: 'Corrientes - Refrigerados',
  chaco_masivos: 'Chaco',
  misiones_masivos: 'Misiones',
  obera_masivos: 'Obera',
};

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Sin empezar',
  in_progress: 'En progreso',
  done: 'Finalizado',
  cancelled: 'Cancelado',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

function safeText(value: unknown) {
  return String(value ?? '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function dateLabel(value?: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return safeText(value);

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function generatedAtLabel() {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
}

function completionPercent(row: RRHHActionPlanRow) {
  if (!row.checklist_total) return 0;
  return Math.round((row.checklist_done / row.checklist_total) * 100);
}

function decodeTodoLabel(text?: string) {
  const raw = String(text ?? '').trim();

  if (!raw.startsWith('§§')) {
    return { group: null as string | null, label: raw };
  }

  const second = raw.indexOf('§§', 2);
  if (second < 0) {
    return { group: null as string | null, label: raw };
  }

  return {
    group: raw.slice(2, second).trim() || null,
    label: raw.slice(second + 2).trim(),
  };
}

function fileSafeName(value: string) {
  return safeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function exportRRHHActionPlanPdf(params: {
  item: RRHHActionPlanRow;
  history: CategoriaHistoryPoint[];
  summary: CategoriaHistorySummary | null;
}) {
  const { item, history, summary } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const footerY = pageHeight - 9;

  let y = 16;
  let pageNumber = 1;

  const line = (color = 225) => {
    doc.setDrawColor(color);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  const footer = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(145, 152, 165);
    doc.text('Redcom S.A. - Seguimiento RRHH - Solo lectura', margin, footerY);
    doc.text(
      `Pagina ${pageNumber}`,
      pageWidth - margin,
      footerY,
      { align: 'right' },
    );
  };

  const ensureSpace = (needed: number) => {
    if (y + needed <= footerY - 5) return;

    footer();
    doc.addPage();
    pageNumber += 1;
    y = 16;
  };

  const sectionTitle = (eyebrow: string, title: string) => {
    ensureSpace(18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(79, 70, 229);
    doc.text(safeText(eyebrow).toUpperCase(), margin, y);

    y += 5;
    doc.setFontSize(13);
    doc.setTextColor(23, 31, 45);
    doc.text(safeText(title), margin, y);
    y += 7;
  };

  const keyValue = (
    label: string,
    value: string | number,
    x: number,
    top: number,
    width: number,
  ) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(145, 152, 165);
    doc.text(safeText(label).toUpperCase(), x, top);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(23, 31, 45);
    const text = doc.splitTextToSize(safeText(value), width);
    doc.text(text, x, top + 5);
  };

  // Header
  doc.setFillColor(247, 248, 250);
  doc.roundedRect(margin, y, contentWidth, 32, 4, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(79, 70, 229);
  doc.text('EXPEDIENTE DE SEGUIMIENTO RRHH', margin + 6, y + 7);

  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(
    safeText(item.task_title || item.project_name),
    contentWidth - 45,
  );
  doc.text(titleLines, margin + 6, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${safeText(item.project_name)} | ID vendedor ${safeText(item.seller_id)} | ${safeText(
      BRANCH_LABELS[item.branch_key] ?? item.branch_key,
    )}`,
    margin + 6,
    y + 27,
  );

  doc.setFillColor(238, 242, 255);
  doc.roundedRect(pageWidth - margin - 37, y + 6, 31, 10, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(67, 56, 202);
  doc.text('SOLO LECTURA', pageWidth - margin - 21.5, y + 12.5, {
    align: 'center',
  });

  y += 39;

  // Executive metrics
  const gap = 4;
  const metricWidth = (contentWidth - gap * 3) / 4;
  const metricTop = y;

  keyValue('Estado', STATUS_LABELS[item.task_status] ?? item.task_status, margin, metricTop, metricWidth);
  keyValue('Avance', `${completionPercent(item)}%`, margin + metricWidth + gap, metricTop, metricWidth);
  keyValue('Fecha limite', dateLabel(item.task_due_date), margin + (metricWidth + gap) * 2, metricTop, metricWidth);
  keyValue('Prioridad', PRIORITY_LABELS[item.task_priority] ?? item.task_priority, margin + (metricWidth + gap) * 3, metricTop, metricWidth);

  y += 19;
  line();

  // Seller
  sectionTitle('Vendedor', `ID ${item.seller_id} - ${item.seller_name}`);

  const sellerMetricTop = y;
  keyValue('Categoria actual', item.seller_category || 'Sin categoria', margin, sellerMetricTop, metricWidth);
  keyValue(
    'Eficiencia',
    formatPercent(parseNullableNumber(item.seller_efficiency)),
    margin + metricWidth + gap,
    sellerMetricTop,
    metricWidth,
  );
  keyValue(
    'Efectividad',
    formatPercent(parseNullableNumber(item.seller_effectiveness)),
    margin + (metricWidth + gap) * 2,
    sellerMetricTop,
    metricWidth,
  );
  keyValue(
    'Facturacion',
    formatMoney(parseNullableNumber(item.seller_billing)),
    margin + (metricWidth + gap) * 3,
    sellerMetricTop,
    metricWidth,
  );
  y += 19;

  if (summary) {
    doc.setFillColor(250, 250, 252);
    doc.roundedRect(margin, y, contentWidth, 16, 3, 3, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Promedio historico: eficiencia ${formatPercent(summary.avgEficiencia)} | efectividad ${formatPercent(
        summary.avgEfectividad,
      )} | mejor categoria ${safeText(summary.bestCategoriaLabel || '-')}`,
      margin + 5,
      y + 7,
    );
    doc.text(
      `Mejor facturacion: ${formatMoney(summary.bestFacturacion)}`,
      margin + 5,
      y + 12,
    );
    y += 22;
  }

  line();

  // Responsibles
  sectionTitle('Ejecucion', 'Responsables directos');

  if (!item.assignees.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Sin responsables asignados.', margin, y);
    y += 7;
  } else {
    for (const assignee of item.assignees) {
      ensureSpace(11);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(
        safeText(assignee.full_name || assignee.email || 'Sin nombre'),
        margin,
        y,
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        safeText(
          [assignee.role, assignee.email].filter(Boolean).join(' | ') ||
            'Sin informacion adicional',
        ),
        margin,
        y + 4.2,
      );

      y += 9;
    }
  }

  line();

  // Context
  sectionTitle('Proyecto', 'Contexto del seguimiento');

  const contextBlocks = [
    ['Resumen', item.task_summary || 'Sin resumen registrado.'],
    ['Descripcion', item.task_description || 'Sin descripcion registrada.'],
  ] as const;

  for (const [label, value] of contextBlocks) {
    const lines = doc.splitTextToSize(safeText(value), contentWidth);
    ensureSpace(9 + lines.length * 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(145, 152, 165);
    doc.text(label.toUpperCase(), margin, y);

    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 5;
  }

  line();

  // Checklist
  sectionTitle(
    'Trabajo operativo',
    `Checklist del plan - ${item.checklist_done}/${item.checklist_total} completados`,
  );

  if (!item.checklist_items.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Este plan no tiene pasos internos cargados.', margin, y);
    y += 7;
  } else {
    let lastGroup = '';

    item.checklist_items.forEach((todo) => {
      const decoded = decodeTodoLabel(todo.text);
      const group = decoded.group || 'Sin grupo';

      if (group !== lastGroup) {
        ensureSpace(9);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(99, 102, 241);
        doc.text(safeText(group).toUpperCase(), margin, y);
        y += 5;
        lastGroup = group;
      }

      const labelLines = doc.splitTextToSize(
        safeText(decoded.label || 'Sin descripcion'),
        contentWidth - 10,
      );
      ensureSpace(5 + labelLines.length * 4);

      doc.setDrawColor(todo.done ? 16 : 203, todo.done ? 185 : 213, todo.done ? 129 : 225);
      doc.circle(margin + 2, y - 1, 1.3, todo.done ? 'F' : 'S');

      doc.setFont('helvetica', todo.done ? 'normal' : 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(todo.done ? 148 : 71, todo.done ? 163 : 85, todo.done ? 184 : 105);
      doc.text(labelLines, margin + 7, y);
      y += labelLines.length * 4 + 3;
    });
  }

  line();

  // Recent historical evolution
  sectionTitle('Historico', 'Efectividad mensual reciente');

  const recentHistory = history.slice(-6);

  if (!recentHistory.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Sin historico disponible.', margin, y);
    y += 7;
  } else {
    for (const point of recentHistory) {
      ensureSpace(9);

      const value = point.efectividad ?? 0;
      const pct = Math.max(0, Math.min(100, value));

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(safeText(point.periodLabel), margin, y);

      const barX = margin + 32;
      const barWidth = contentWidth - 62;
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(barX, y - 2.2, barWidth, 2.6, 1.3, 1.3, 'F');

      doc.setFillColor(99, 102, 241);
      doc.roundedRect(
        barX,
        y - 2.2,
        Math.max(0.5, (barWidth * pct) / 100),
        2.6,
        1.3,
        1.3,
        'F',
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(
        formatPercent(point.efectividad),
        pageWidth - margin,
        y,
        { align: 'right' },
      );

      y += 7;
    }
  }

  ensureSpace(18);
  y += 3;
  line();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(145, 152, 165);
  doc.text(
    `Documento generado: ${safeText(generatedAtLabel())}`,
    margin,
    y,
  );
  y += 4;
  doc.text(
    'La informacion de este documento refleja el estado disponible al momento de la exportacion.',
    margin,
    y,
  );

  footer();

  const filename = fileSafeName(
    `Plan-accion-${item.seller_id}-${item.seller_name || item.task_title}`,
  );

  doc.save(`${filename || 'plan-accion-rrhh'}.pdf`);
}
