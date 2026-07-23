function normalizeKey(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeSucursal(value) {
  const normalized = normalizeKey(value);
  if (!normalized) return "SIN SUCURSAL";
  if (normalized.includes("CASA CENTRAL") || normalized === "CORRIENTES") return "CASA CENTRAL";
  if (normalized.includes("RESISTENCIA") || normalized === "CHACO") return "SUCURSAL RESISTENCIA";
  if (normalized.includes("POSADAS") || normalized === "MISIONES") return "SUCURSAL POSADAS";
  if (normalized.includes("OBERA")) return "SUCURSAL OBERA";
  if (normalized.includes("REFRIGERADOS")) return "REFRIGERADOS";
  return normalized;
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value).trim().replace(/\s/g, "");
  if (!text) return 0;
  const normalized = text.includes(",") && text.includes(".")
    ? text.replace(/\./g, "").replace(",", ".")
    : text.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function findHeaderRow(rows, predicates, maxRows = 15) {
  const limit = Math.min(rows.length, maxRows);
  for (let index = 0; index < limit; index += 1) {
    const normalized = (rows[index] || []).map(normalizeKey);
    if (predicates.every((predicate) => normalized.some(predicate))) return index;
  }
  return 0;
}

function findHeaderIndex(headers, matcher, fallback = -1) {
  const index = headers.findIndex(matcher);
  return index >= 0 ? index : fallback;
}

function getDropsize(cargo, invoices) {
  return invoices > 0 ? cargo / invoices : null;
}

function aggregateTotalsFromClients(clients) {
  let cargo = 0;
  let invoices = 0;
  Object.values(clients).forEach((client) => {
    cargo += client.cargo;
    invoices += client.invoices;
  });
  return { cargo, invoices, dropsize: getDropsize(cargo, invoices) };
}

function aggregateTotalsFromRoutes(routes) {
  let cargo = 0;
  let invoices = 0;
  let clients = 0;
  Object.values(routes).forEach((route) => {
    const totals = aggregateTotalsFromClients(route.clients);
    cargo += totals.cargo;
    invoices += totals.invoices;
    clients += Object.keys(route.clients).length;
  });
  return { cargo, invoices, clients, dropsize: getDropsize(cargo, invoices) };
}

function aggregateTotalsFromVendors(vendors) {
  let cargo = 0;
  let invoices = 0;
  let clients = 0;
  Object.values(vendors).forEach((vendor) => {
    const totals = aggregateTotalsFromRoutes(vendor.routes);
    cargo += totals.cargo;
    invoices += totals.invoices;
    clients += totals.clients;
  });
  return { cargo, invoices, clients, dropsize: getDropsize(cargo, invoices) };
}

function compareDropsizeDesc(a, b) {
  if (a.dropsize === null && b.dropsize === null) return 0;
  if (a.dropsize === null) return 1;
  if (b.dropsize === null) return -1;
  return b.dropsize - a.dropsize;
}

function dropsizeBadge(value) {
  if (value === null) return '<span class="dropsize-na">N/A</span>';
  return `<span class="dropsize-value">${formatNumber(value)}</span>`;
}

function renderEmpty(message = "Importá los archivos para generar el dashboard") {
  const area = document.getElementById("dropsizeReportArea");
  if (!area) return;
  area.innerHTML = `
    <div class="report-empty dropsize-placeholder">
      <div class="report-empty-icon">↕</div>
      <h2>${escapeHtml(message)}</h2>
      <p>El archivo de ventas se comparte con los demás análisis. Para DROPSIZE también necesitás cargar Detalle personal.</p>
    </div>`;
}

function parseDetailWorkbook(XLSX, workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const headerRow = findHeaderRow(rows, [
    (value) => value.includes("VENDEDOR") || value.includes("DESCRIPCION"),
    (value) => value.includes("SUPERIOR") || value.includes("SUPERVISOR"),
  ]);
  const mapByName = new Map();
  const mapByCode = new Map();

  for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const code = row[0];
    const vendor = row[1];
    const supervisor = row[4];
    const vendorLabel = String(vendor ?? "").trim();
    const supervisorLabel = String(supervisor ?? "").trim() || "Sin supervisor";
    if (vendorLabel) mapByName.set(normalizeKey(vendorLabel), supervisorLabel);
    if (code !== null && code !== undefined && String(code).trim()) {
      mapByCode.set(String(code).trim(), {
        vendorLabel: vendorLabel || null,
        supervisor: supervisorLabel,
      });
    }
  }
  return { mapByName, mapByCode };
}

function parseSalesWorkbook(XLSX, workbook, selectedSucursal, detailMaps) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (!rows.length) throw new Error("El archivo de ventas está vacío.");

  const headerRow = findHeaderRow(rows, [
    (value) => value.includes("CLIENTE"),
    (value) => value.includes("VENDEDOR"),
    (value) => value.includes("CARGO"),
  ]);
  const headers = (rows[headerRow] || []).map(normalizeKey);

  const routeMarker = headers.findIndex((header) => header === "RUTA");
  const indices = {
    client: findHeaderIndex(headers, (header) => header === "CLIENTES" || header === "CLIENTE", 3),
    clientCode: findHeaderIndex(headers, (header) => header.includes("COD. CLIENTE") || header === "COD CLIENTE", -1),
    route: routeMarker >= 0 ? routeMarker + 1 : findHeaderIndex(headers, (header) => header.includes("DESCRIPCION RUTA"), 9),
    vendor: findHeaderIndex(headers, (header) => header.includes("DESCRIPCION VENDEDOR"), 15),
    vendorCode: findHeaderIndex(headers, (header) => header === "VENDEDOR" || header.includes("CODIGO VENDEDOR"), -1),
    cargo: findHeaderIndex(headers, (header) => header.includes("CANTIDADES") && header.includes("CARGO"), -1),
    invoices: findHeaderIndex(headers, (header) => header.includes("FACTURA"), -1),
    branch: findHeaderIndex(headers, (header) => header === "SUCURSAL" || header.includes("DESCRIPCION SUCURSAL"), -1),
  };

  if (indices.cargo < 0) throw new Error('No se encontró la columna "Cantidades CON Cargo".');
  if (indices.invoices < 0) throw new Error('No se encontró la columna de "Cantidad de Facturas".');

  const selected = normalizeSucursal(selectedSucursal);
  const structure = {};
  let includedRows = 0;

  for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const branchLabel = indices.branch >= 0 ? String(row[indices.branch] ?? "").trim() : selectedSucursal;
    const normalizedBranch = normalizeSucursal(branchLabel || selectedSucursal);
    if (selected && normalizedBranch !== selected) continue;

    const vendorRaw = row[indices.vendor];
    const vendorCodeRaw = indices.vendorCode >= 0 ? row[indices.vendorCode] : null;
    const vendorByCode = vendorCodeRaw !== null && vendorCodeRaw !== undefined
      ? detailMaps.mapByCode.get(String(vendorCodeRaw).trim())
      : null;
    const vendorLabel = String(vendorRaw ?? vendorByCode?.vendorLabel ?? "").trim() || "Sin vendedor";
    const supervisorLabel = detailMaps.mapByName.get(normalizeKey(vendorLabel))
      || vendorByCode?.supervisor
      || "Sin supervisor";

    const clientRaw = row[indices.client];
    if (clientRaw === null || clientRaw === undefined || String(clientRaw).trim() === "") continue;
    const clientCodeRaw = indices.clientCode >= 0 ? row[indices.clientCode] : null;
    const clientLabelRaw = String(clientRaw).trim();
    const clientLabel = clientCodeRaw !== null && clientCodeRaw !== undefined && String(clientCodeRaw).trim()
      ? `${clientLabelRaw} #${String(clientCodeRaw).trim()}`
      : clientLabelRaw;
    const routeLabel = String(row[indices.route] ?? "").trim() || "Sin ruta";
    const cargo = safeNumber(row[indices.cargo]);
    const invoices = safeNumber(row[indices.invoices]);
    if (cargo === 0 && invoices === 0) continue;

    if (!structure[supervisorLabel]) structure[supervisorLabel] = { vendors: {} };
    const supervisor = structure[supervisorLabel];
    const vendorKey = normalizeKey(vendorLabel);
    if (!supervisor.vendors[vendorKey]) {
      supervisor.vendors[vendorKey] = { label: vendorLabel, routes: {} };
    }
    const vendor = supervisor.vendors[vendorKey];
    if (!vendor.routes[routeLabel]) vendor.routes[routeLabel] = { label: routeLabel, clients: {} };
    const route = vendor.routes[routeLabel];
    const clientKey = normalizeKey(clientLabel);
    if (!route.clients[clientKey]) {
      route.clients[clientKey] = { label: clientLabel, cargo: 0, invoices: 0 };
    }
    route.clients[clientKey].cargo += cargo;
    route.clients[clientKey].invoices += invoices;
    includedRows += 1;
  }

  if (!includedRows) {
    throw new Error("No se encontraron movimientos válidos para la sucursal seleccionada.");
  }
  return structure;
}

function flattenRows(structure) {
  const rows = [];
  Object.entries(structure).forEach(([supervisorName, supervisor]) => {
    Object.values(supervisor.vendors).forEach((vendor) => {
      Object.values(vendor.routes).forEach((route) => {
        Object.values(route.clients).forEach((client) => {
          const dropsize = getDropsize(client.cargo, client.invoices);
          rows.push([
            supervisorName,
            vendor.label,
            route.label,
            client.label,
            formatNumber(client.cargo),
            formatNumber(client.invoices),
            dropsize === null ? "N/A" : formatNumber(dropsize),
          ]);
        });
      });
    });
  });
  return rows;
}

function exportCsv(structure) {
  const rows = [
    ["Supervisor", "Vendedor", "Ruta", "Cliente", "Cantidades CON Cargo", "Cantidad de Facturas", "Dropsize"],
    ...flattenRows(structure),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "dropsize_export.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function renderStructure(structure, branchLabel) {
  const area = document.getElementById("dropsizeReportArea");
  if (!area) return;
  area.innerHTML = "";

  const supervisorRows = Object.entries(structure)
    .map(([name, supervisor]) => ({ name, supervisor, ...aggregateTotalsFromVendors(supervisor.vendors) }))
    .sort(compareDropsizeDesc);
  const totalCargo = supervisorRows.reduce((sum, row) => sum + row.cargo, 0);
  const totalInvoices = supervisorRows.reduce((sum, row) => sum + row.invoices, 0);
  const totalClients = supervisorRows.reduce((sum, row) => sum + row.clients, 0);
  const total = {
    cargo: totalCargo,
    invoices: totalInvoices,
    clients: totalClients,
    dropsize: getDropsize(totalCargo, totalInvoices),
  };
  const routeCount = supervisorRows.reduce(
    (count, supervisor) => count + Object.values(supervisor.supervisor.vendors).reduce(
      (vendorCount, vendor) => vendorCount + Object.keys(vendor.routes).length,
      0,
    ),
    0,
  );

  area.innerHTML = `
    <div class="dropsize-kpis kpi-summary">
      <div class="kpi-card" style="--kc:var(--red)">
        <div class="k-label">Dropsize general</div>
        <div class="k-value">${total.dropsize === null ? "N/A" : formatNumber(total.dropsize)}</div>
        <div class="k-sub">Cantidades con cargo / cantidad de facturas</div>
      </div>
      <div class="kpi-card" style="--kc:var(--green)">
        <div class="k-label">Cantidades con cargo</div>
        <div class="k-value">${formatNumber(total.cargo)}</div>
        <div class="k-sub">total acumulado de la sucursal</div>
      </div>
      <div class="kpi-card" style="--kc:var(--amber)">
        <div class="k-label">Cantidad de facturas</div>
        <div class="k-value">${formatNumber(total.invoices)}</div>
        <div class="k-sub">documentos utilizados en el cálculo</div>
      </div>
      <div class="kpi-card" style="--kc:var(--dark)">
        <div class="k-label">Clientes evaluados</div>
        <div class="k-value">${total.clients.toLocaleString("es-AR")}</div>
        <div class="k-sub">${supervisorRows.length} supervisores · ${routeCount} rutas</div>
      </div>
    </div>

    <div class="dropsize-summary-card">
      <div>
        <span class="dropsize-summary-label">Sucursal analizada</span>
        <strong>${escapeHtml(branchLabel)}</strong>
      </div>
      <div class="dropsize-summary-metric">
        <span>Dropsize</span>
        ${dropsizeBadge(total.dropsize)}
      </div>
      <div class="dropsize-summary-metric">
        <span>Con cargo</span>
        <strong>${formatNumber(total.cargo)}</strong>
      </div>
      <div class="dropsize-summary-metric">
        <span>Facturas</span>
        <strong>${formatNumber(total.invoices)}</strong>
      </div>
    </div>

    <div class="dropsize-toolbar">
      <div class="dropsize-filters">
        <label>Supervisor<input type="text" id="dropsizeFilterSupervisor" placeholder="Filtrar por supervisor" /></label>
        <label>Ruta<input type="text" id="dropsizeFilterRoute" placeholder="Filtrar por ruta" /></label>
        <button type="button" class="ghost" id="dropsizeApplyFilters">Aplicar filtros</button>
      </div>
      <div class="dropsize-actions">
        <button type="button" class="ghost" id="dropsizeExpandAll">Expandir todo</button>
        <button type="button" class="ghost" id="dropsizeCollapseAll">Colapsar todo</button>
        <button type="button" class="dropsize-export" id="dropsizeExportCsv" title="Exportar CSV" aria-label="Exportar DROPSIZE a CSV">CSV</button>
      </div>
    </div>

    <div class="toolbar dropsize-detail-heading">
      <div>
        <div class="title">Detalle por Supervisor — Dropsize</div>
        <div class="subtitle">Ordenado de mayor a menor dropsize</div>
      </div>
    </div>
    <div id="dropsizeHierarchy"></div>`;

  const hierarchyArea = area.querySelector("#dropsizeHierarchy");
  const supervisorInput = area.querySelector("#dropsizeFilterSupervisor");
  const routeInput = area.querySelector("#dropsizeFilterRoute");

  function renderHierarchy() {
    const supervisorFilter = normalizeKey(supervisorInput.value);
    const routeFilter = normalizeKey(routeInput.value);
    hierarchyArea.innerHTML = "";

    supervisorRows.forEach((supervisorRow, supervisorIndex) => {
      if (supervisorFilter && !normalizeKey(supervisorRow.name).includes(supervisorFilter)) return;
      const vendors = Object.values(supervisorRow.supervisor.vendors)
        .map((vendor) => ({ vendor, ...aggregateTotalsFromRoutes(vendor.routes) }))
        .sort(compareDropsizeDesc);

      const vendorHtml = vendors.map((vendorRow, vendorIndex) => {
        const routes = Object.values(vendorRow.vendor.routes)
          .map((route) => ({ route, ...aggregateTotalsFromClients(route.clients) }))
          .filter((routeRow) => !routeFilter || normalizeKey(routeRow.route.label).includes(routeFilter))
          .sort(compareDropsizeDesc);
        if (!routes.length) return "";

        const routeHtml = routes.map((routeRow, routeIndex) => {
          const clients = Object.values(routeRow.route.clients)
            .map((client) => ({ ...client, dropsize: getDropsize(client.cargo, client.invoices) }))
            .sort(compareDropsizeDesc);
          return `
            <div class="ruta-card dropsize-route-card" data-dropsize-card>
              <div class="ruta-head" data-dropsize-toggle>
                <div class="ruta-title"><span class="arrow">▶</span><h5>${escapeHtml(routeRow.route.label)}</h5></div>
                <div class="metrics-chips">
                  <span class="metric-chip clients"><b>${clients.length}</b> clientes</span>
                  <span class="metric-chip units"><b>${formatNumber(routeRow.cargo)}</b> con cargo</span>
                  <span class="metric-chip fulfilled"><b>${formatNumber(routeRow.invoices)}</b> facturas</span>
                  <span class="metric-chip progress">Dropsize <b>${routeRow.dropsize === null ? "N/A" : formatNumber(routeRow.dropsize)}</b></span>
                </div>
              </div>
              <div class="ruta-body">
                <div class="dropsize-table-wrap">
                  <table class="cli-table dropsize-table">
                    <thead><tr><th>Cliente</th><th>Cant. con Cargo</th><th>Facturas</th><th>Dropsize</th></tr></thead>
                    <tbody>
                      ${clients.map((client) => `
                        <tr>
                          <td>${escapeHtml(client.label)}</td>
                          <td>${formatNumber(client.cargo)}</td>
                          <td>${formatNumber(client.invoices)}</td>
                          <td>${dropsizeBadge(client.dropsize)}</td>
                        </tr>`).join("")}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>`;
        }).join("");

        return `
          <div class="vend-card dropsize-vendor-card" data-dropsize-card>
            <div class="vend-head" data-dropsize-toggle>
              <div class="vend-title"><span class="arrow">▶</span><h4>${escapeHtml(vendorRow.vendor.label)}</h4></div>
              <div class="metrics-chips">
                <span class="metric-chip clients"><b>${vendorRow.clients}</b> clientes</span>
                <span class="metric-chip units"><b>${formatNumber(vendorRow.cargo)}</b> con cargo</span>
                <span class="metric-chip fulfilled"><b>${formatNumber(vendorRow.invoices)}</b> facturas</span>
                <span class="metric-chip progress">Dropsize <b>${vendorRow.dropsize === null ? "N/A" : formatNumber(vendorRow.dropsize)}</b></span>
              </div>
            </div>
            <div class="vend-body">${routeHtml}</div>
          </div>`;
      }).filter(Boolean).join("");

      if (!vendorHtml) return;
      const supervisorCard = document.createElement("div");
      supervisorCard.className = `sup-card dropsize-supervisor-card${supervisorRow.name === "Sin supervisor" ? " no-sup" : ""}`;
      supervisorCard.dataset.dropsizeCard = "";
      supervisorCard.innerHTML = `
        <div class="sup-head" data-dropsize-toggle>
          <div class="sup-title"><span class="arrow">▶</span><h3>${escapeHtml(supervisorRow.name)}</h3></div>
          <div class="metrics-chips">
            <span class="metric-chip clients"><b>${supervisorRow.clients}</b> clientes</span>
            <span class="metric-chip units"><b>${formatNumber(supervisorRow.cargo)}</b> con cargo</span>
            <span class="metric-chip fulfilled"><b>${formatNumber(supervisorRow.invoices)}</b> facturas</span>
            <span class="metric-chip progress">Dropsize <b>${supervisorRow.dropsize === null ? "N/A" : formatNumber(supervisorRow.dropsize)}</b></span>
          </div>
        </div>
        <div class="sup-body">${vendorHtml}</div>`;
      hierarchyArea.appendChild(supervisorCard);
      if (supervisorIndex === 0) supervisorCard.classList.add("open");
    });

    hierarchyArea.querySelectorAll("[data-dropsize-toggle]").forEach((header) => {
      header.addEventListener("click", () => {
        const card = header.closest("[data-dropsize-card]");
        if (card) card.classList.toggle("open");
      });
    });

    if (!hierarchyArea.children.length) {
      hierarchyArea.innerHTML = '<div class="database-message error">No hay resultados que coincidan con los filtros aplicados.</div>';
    }
  }

  renderHierarchy();
  area.querySelector("#dropsizeApplyFilters").addEventListener("click", renderHierarchy);
  [supervisorInput, routeInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") renderHierarchy();
    });
  });
  area.querySelector("#dropsizeExpandAll").addEventListener("click", () => {
    hierarchyArea.querySelectorAll("[data-dropsize-card]").forEach((card) => card.classList.add("open"));
  });
  area.querySelector("#dropsizeCollapseAll").addEventListener("click", () => {
    hierarchyArea.querySelectorAll("[data-dropsize-card]").forEach((card) => card.classList.remove("open"));
  });
  area.querySelector("#dropsizeExportCsv").addEventListener("click", () => exportCsv(structure));
}

export async function processDropsizeDashboard({
  XLSX,
  salesWorkbook,
  detailWorkbook,
  selectedSucursal,
  branchLabel,
}) {
  if (!salesWorkbook) throw new Error("No se pudo leer el archivo de ventas para DROPSIZE.");
  if (!detailWorkbook) throw new Error("Cargá el archivo Detalle personal para generar DROPSIZE.");
  const detailMaps = parseDetailWorkbook(XLSX, detailWorkbook);
  const structure = parseSalesWorkbook(XLSX, salesWorkbook, selectedSucursal, detailMaps);
  renderStructure(structure, branchLabel || selectedSucursal || "Sucursal seleccionada");
  return structure;
}

export function resetDropsizeDashboard() {
  renderEmpty();
}

export function setDropsizeEmptyState(message) {
  renderEmpty(message);
}
