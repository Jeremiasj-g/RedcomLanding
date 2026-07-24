function normalizeKey(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}


function normalizePersonCode(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";
  const normalizedNumber = Number(text.replace(",", "."));
  if (Number.isFinite(normalizedNumber) && /^\d+(?:[.,]0+)?$/.test(text)) {
    return String(Math.trunc(normalizedNumber));
  }
  return normalizeKey(text);
}

function personNameAliases(value) {
  const base = normalizeKey(value);
  if (!base) return [];
  const aliases = new Set([base]);
  const withoutLeadingCode = base
    .replace(/^\(?\d+\)?\s*[-–—:]\s*/, "")
    .replace(/^\(?\d+\)?\s+/, "")
    .trim();
  if (withoutLeadingCode) aliases.add(withoutLeadingCode);
  const withoutBranchTag = withoutLeadingCode.replace(/\s*\([^)]{1,14}\)\s*$/, "").trim();
  if (withoutBranchTag) aliases.add(withoutBranchTag);
  const withoutRoleWords = withoutBranchTag
    .replace(/\b(JEFE DE VENTAS|JEFE VENTAS|JDV|SUPERVISOR|SUP\.?|VENDEDOR)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutRoleWords) aliases.add(withoutRoleWords);
  return Array.from(aliases).filter(Boolean);
}

function isManagerRole(role, label = "") {
  const value = normalizeKey(`${role || ""} ${label || ""}`);
  return value.includes("JEFE DE VENTAS")
    || value.includes("JEFE VENTAS")
    || /\bJDV\b/.test(value)
    || value.includes("GERENTE COMERCIAL")
    || value.includes("GERENTE");
}

function isSupervisorRole(role, label = "") {
  const value = normalizeKey(`${role || ""} ${label || ""}`);
  return value.includes("SUPERVISOR") || /\bSUP\.?\b/.test(value);
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

function normalizeDetailBranch(branchValue, salesForceValue) {
  const salesForce = normalizeKey(salesForceValue);
  // El archivo real usa "ESQUEMA REGRIGERADOS" (con esa grafía).
  // Se toma como una sucursal lógica independiente de Casa Central.
  if (salesForce.includes("REFRIGER") || salesForce.includes("REGRIGER")) {
    return "REFRIGERADOS";
  }
  return normalizeSucursal(branchValue);
}

const DROPSIZE_LINES = {
  "QUENTO SNACK": { label: "Quento Snacks", cls: "quento" },
  "HEROE": { label: "Héroe Limpieza", cls: "heroe" },
};

let lastSelectedDropsizeLine = null;

function normalizeLinea(value) {
  const normalized = normalizeKey(value);
  if (normalized.includes("QUENTO")) return "QUENTO SNACK";
  if (normalized.includes("HEROE")) return "HEROE";
  return normalized;
}

function detectDropsizeLine(row, indices) {
  const candidates = [
    indices.line >= 0 ? row[indices.line] : null,
    indices.lineDetail >= 0 ? row[indices.lineDetail] : null,
    indices.articleDescription >= 0 ? row[indices.articleDescription] : null,
    indices.article >= 0 ? row[indices.article] : null,
  ];
  return normalizeLinea(candidates.filter((value) => value !== null && value !== undefined).join(" | "));
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

function getAccordionBody(card) {
  return Array.from(card?.children || []).find((child) =>
    child.classList?.contains("sup-body")
    || child.classList?.contains("vend-body")
    || child.classList?.contains("ruta-body"),
  ) || null;
}

function setAccordionOpen(card, shouldOpen, immediate = false) {
  if (!card) return;
  const body = getAccordionBody(card);
  if (!body) {
    card.classList.toggle("open", shouldOpen);
    return;
  }

  if (body.__cccAccordionEnd) {
    body.removeEventListener("transitionend", body.__cccAccordionEnd);
    body.__cccAccordionEnd = null;
  }

  const wasOpen = card.classList.contains("open");
  const before = window.getComputedStyle(body);
  const startHeight = body.getBoundingClientRect().height;
  const startPaddingTop = Number.parseFloat(before.paddingTop) || 0;
  const startPaddingBottom = Number.parseFloat(before.paddingBottom) || 0;

  card.classList.toggle("open", shouldOpen);

  if (immediate) {
    body.style.transition = "";
    body.style.height = "";
    body.style.paddingTop = "";
    body.style.paddingBottom = "";
    body.style.opacity = "";
    body.style.overflow = "";
    return;
  }

  const after = window.getComputedStyle(body);
  const endPaddingTop = shouldOpen ? (Number.parseFloat(after.paddingTop) || 0) : 0;
  const endPaddingBottom = shouldOpen ? (Number.parseFloat(after.paddingBottom) || 0) : 0;
  const endHeight = shouldOpen ? body.scrollHeight : 0;

  body.style.transition = "none";
  body.style.height = `${startHeight}px`;
  body.style.paddingTop = `${startPaddingTop}px`;
  body.style.paddingBottom = `${startPaddingBottom}px`;
  body.style.opacity = wasOpen ? "1" : "0";
  body.style.overflow = "hidden";
  body.getBoundingClientRect();
  body.style.transition = "height 320ms cubic-bezier(.4,0,.2,1), padding-top 320ms cubic-bezier(.4,0,.2,1), padding-bottom 320ms cubic-bezier(.4,0,.2,1), opacity 220ms ease";
  body.style.height = `${endHeight}px`;
  body.style.paddingTop = `${endPaddingTop}px`;
  body.style.paddingBottom = `${endPaddingBottom}px`;
  body.style.opacity = shouldOpen ? "1" : "0";

  const onEnd = (event) => {
    if (event.target !== body || event.propertyName !== "height") return;
    body.removeEventListener("transitionend", onEnd);
    body.__cccAccordionEnd = null;
    body.style.transition = "";
    body.style.height = "";
    body.style.paddingTop = "";
    body.style.paddingBottom = "";
    body.style.opacity = "";
    body.style.overflow = "";
  };
  body.__cccAccordionEnd = onEnd;
  body.addEventListener("transitionend", onEnd);
}

function toggleAccordionCard(card) {
  setAccordionOpen(card, !card.classList.contains("open"));
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


function aggregateTotalsFromSupervisors(supervisors) {
  let cargo = 0;
  let invoices = 0;
  let clients = 0;
  Object.values(supervisors).forEach((supervisor) => {
    const totals = aggregateTotalsFromVendors(supervisor.vendors);
    cargo += totals.cargo;
    invoices += totals.invoices;
    clients += totals.clients;
  });
  return { cargo, invoices, clients, dropsize: getDropsize(cargo, invoices) };
}

function aggregateTotalsFromManagers(managers) {
  let cargo = 0;
  let invoices = 0;
  let clients = 0;
  Object.values(managers).forEach((manager) => {
    const totals = aggregateTotalsFromSupervisors(manager.supervisors);
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
    (value) => value === "DESCRIPCION" || value.includes("VENDEDOR") || value.includes("NOMBRE"),
    (value) => value === "SUPERIOR" || value.includes("SUPERVISOR") || value.includes("JEFE"),
    (value) => value === "CARGO" || value.includes("PUESTO") || value === "ROL",
  ], 40);
  const headers = (rows[headerRow] || []).map(normalizeKey);
  const indices = {
    cancelled: findHeaderIndex(headers, (header) => header === "ANULADO" || header === "ANULADA", -1),
    code: findHeaderIndex(headers, (header) => header === "CODIGO" || header === "COD." || header.includes("LEGAJO") || header === "ID", 1),
    name: findHeaderIndex(headers, (header) => header === "DESCRIPCION" || header === "NOMBRE" || header === "VENDEDOR" || header.includes("PERSONAL"), 2),
    branch: findHeaderIndex(headers, (header) => header === "SUCURSAL" || header.includes("DESCRIPCION SUCURSAL"), 4),
    salesForce: findHeaderIndex(headers, (header) => header.includes("FUERZA DE VENTA") || header.includes("FUERZA VENTA"), 5),
    superior: findHeaderIndex(headers, (header) => header === "SUPERIOR" || header.includes("SUPERVISOR") || header.includes("JEFE"), 9),
    role: findHeaderIndex(headers, (header) => header === "CARGO" || header.includes("PUESTO") || header === "ROL" || header.includes("FUNCION"), 10),
  };

  const people = [];
  const peopleByName = new Map();
  const peopleByCode = new Map();
  const peopleByBranchName = new Map();
  const peopleByBranchCode = new Map();

  const getBranchMap = (root, branch) => {
    const key = normalizeSucursal(branch);
    if (!root.has(key)) root.set(key, new Map());
    return root.get(key);
  };

  const registerNameAlias = (rootMap, alias, person) => {
    if (!alias) return;
    if (!rootMap.has(alias)) rootMap.set(alias, []);
    rootMap.get(alias).push(person);
  };

  const registerCode = (rootMap, code, person) => {
    if (!code) return;
    if (!rootMap.has(code)) rootMap.set(code, []);
    rootMap.get(code).push(person);
  };

  const isCancelled = (value) => {
    const normalized = normalizeKey(value);
    return normalized === "TRUE" || normalized === "SI" || normalized === "S" || normalized === "1";
  };

  for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    if (indices.cancelled >= 0 && isCancelled(row[indices.cancelled])) continue;

    const code = indices.code >= 0 ? row[indices.code] : null;
    const name = indices.name >= 0 ? row[indices.name] : null;
    const superior = indices.superior >= 0 ? row[indices.superior] : null;
    const role = indices.role >= 0 ? row[indices.role] : null;
    const branchRaw = indices.branch >= 0 ? row[indices.branch] : null;
    const salesForceRaw = indices.salesForce >= 0 ? row[indices.salesForce] : null;
    const label = String(name ?? "").trim();
    if (!label) continue;

    const branch = normalizeDetailBranch(branchRaw, salesForceRaw);
    const person = {
      code: normalizePersonCode(code),
      label,
      superiorLabel: String(superior ?? "").trim(),
      role: String(role ?? "").trim(),
      branch,
      salesForce: String(salesForceRaw ?? "").trim(),
    };
    people.push(person);

    const branchNames = getBranchMap(peopleByBranchName, branch);
    personNameAliases(label).forEach((alias) => {
      registerNameAlias(peopleByName, alias, person);
      registerNameAlias(branchNames, alias, person);
    });

    if (person.code) {
      registerCode(peopleByCode, person.code, person);
      registerCode(getBranchMap(peopleByBranchCode, branch), person.code, person);
    }
  }

  const selectBestPerson = (candidates, expectedRole = null) => {
    if (!candidates?.length) return null;
    if (expectedRole === "vendor") {
      return candidates.find((person) => normalizeKey(person.role).includes("VENDEDOR")) || candidates[0];
    }
    if (expectedRole === "superior") {
      return candidates.find((person) => isSupervisorRole(person.role, person.label) || isManagerRole(person.role, person.label)) || candidates[0];
    }
    return candidates[0];
  };

  const findPersonByName = (value, branch, expectedRole = null) => {
    const branchMap = peopleByBranchName.get(normalizeSucursal(branch));
    for (const alias of personNameAliases(value)) {
      const branchMatch = selectBestPerson(branchMap?.get(alias), expectedRole);
      if (branchMatch) return branchMatch;
      const globalCandidates = peopleByName.get(alias);
      if (globalCandidates?.length === 1) return globalCandidates[0];
      const roleMatch = selectBestPerson(globalCandidates, expectedRole);
      if (roleMatch) return roleMatch;
    }
    return null;
  };

  const findPersonByCode = (value, branch, expectedRole = null) => {
    const code = normalizePersonCode(value);
    if (!code) return null;
    const branchCandidates = peopleByBranchCode.get(normalizeSucursal(branch))?.get(code);
    const branchMatch = selectBestPerson(branchCandidates, expectedRole);
    if (branchMatch) return branchMatch;
    const globalCandidates = peopleByCode.get(code);
    // Los códigos se repiten entre sucursales. Solo se usa el fallback global
    // cuando el código identifica inequívocamente a una única persona.
    if (globalCandidates?.length === 1) return globalCandidates[0];
    return null;
  };

  const resolveHierarchy = (vendorLabel, vendorCode, branchValue) => {
    const branch = normalizeSucursal(branchValue);
    // El nombre se prioriza sobre el código porque el archivo real reutiliza
    // códigos de personal entre Casa Central, Posadas, Resistencia y Oberá.
    const vendorPerson = findPersonByName(vendorLabel, branch, "vendor")
      || findPersonByCode(vendorCode, branch, "vendor");
    const chain = [];
    const seen = new Set();
    let current = vendorPerson;
    let superiorLabel = current?.superiorLabel || "";

    for (let depth = 0; superiorLabel && depth < 8; depth += 1) {
      const superiorPerson = findPersonByName(superiorLabel, current?.branch || branch, "superior");
      const resolvedLabel = String(superiorPerson?.label || superiorLabel).trim();
      const key = `${normalizeSucursal(superiorPerson?.branch || current?.branch || branch)}::${normalizeKey(resolvedLabel)}`;
      if (!normalizeKey(resolvedLabel) || seen.has(key)) break;
      seen.add(key);
      chain.push({
        label: resolvedLabel,
        role: superiorPerson?.role || "",
        person: superiorPerson,
      });
      current = superiorPerson;
      superiorLabel = current?.superiorLabel || "";
    }

    let supervisorIndex = chain.findIndex((item) => isSupervisorRole(item.role, item.label));
    const firstIsManager = chain.length > 0 && isManagerRole(chain[0].role, chain[0].label);
    if (supervisorIndex < 0 && chain.length && !firstIsManager) supervisorIndex = 0;

    const supervisorLabel = supervisorIndex >= 0
      ? chain[supervisorIndex].label
      : "Sin supervisor";

    let managerItem = chain.find((item, index) => index > supervisorIndex && isManagerRole(item.role, item.label));
    if (!managerItem && firstIsManager) managerItem = chain[0];

    return {
      vendorLabel: vendorPerson?.label || String(vendorLabel || "").trim() || "Sin vendedor",
      supervisorLabel,
      managerLabel: managerItem?.label || null,
      matched: Boolean(vendorPerson),
      chain,
      branch,
    };
  };

  return {
    people,
    peopleByName,
    peopleByCode,
    peopleByBranchName,
    peopleByBranchCode,
    resolveHierarchy,
  };
}

function parseSalesWorkbook(XLSX, workbook, selectedSucursal, detailMaps, requestedLineCode) {
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
  const articleMarker = headers.findIndex((header) => header === "ARTICULOS");
  const brandMarker = headers.findIndex((header) => header === "MARCA");
  const exactCargoIndex = headers.findIndex((header) => header === "CANTIDADES CON CARGO");
  const exactInvoiceIndex = headers.findIndex((header) => header === "CANTIDAD DE FACTURAS");
  const indices = {
    client: findHeaderIndex(headers, (header) => header === "CLIENTES" || header === "CLIENTE", 3),
    clientCode: findHeaderIndex(headers, (header) => header.includes("COD. CLIENTE") || header === "COD CLIENTE", -1),
    route: routeMarker >= 0 ? routeMarker + 1 : findHeaderIndex(headers, (header) => header.includes("DESCRIPCION RUTA"), 9),
    vendor: findHeaderIndex(headers, (header) => header.includes("DESCRIPCION VENDEDOR"), 15),
    vendorCode: findHeaderIndex(headers, (header) => header === "VENDEDOR" || header.includes("CODIGO VENDEDOR"), -1),
    cargo: exactCargoIndex >= 0
      ? exactCargoIndex
      : findHeaderIndex(headers, (header) => header.includes("CANTIDADES") && header.includes("CON") && header.includes("CARGO") && !header.includes("SIN"), -1),
    invoices: exactInvoiceIndex >= 0
      ? exactInvoiceIndex
      : findHeaderIndex(headers, (header) => header.includes("CANTIDAD") && header.includes("FACTURA"), -1),
    branch: findHeaderIndex(headers, (header) => header === "SUCURSAL" || header.includes("DESCRIPCION SUCURSAL"), -1),
    article: articleMarker,
    articleDescription: articleMarker >= 0
      ? articleMarker + 2
      : findHeaderIndex(headers, (header) => header.includes("DESCRIPCION ARTICULO"), -1),
    line: brandMarker >= 0
      ? brandMarker + 1
      : findHeaderIndex(headers, (header) => header === "DESCRIPCION.3" || header.includes("LINEA"), -1),
    lineDetail: brandMarker >= 0 ? brandMarker + 2 : -1,
  };

  if (indices.cargo < 0) throw new Error('No se encontró la columna "Cantidades CON Cargo".');
  if (indices.invoices < 0) throw new Error('No se encontró la columna "Cantidad de Facturas".');
  if (indices.line < 0 && indices.articleDescription < 0 && indices.article < 0) {
    throw new Error('No se encontraron columnas para distinguir los artículos de Quento y Héroe.');
  }

  const selected = normalizeSucursal(selectedSucursal);
  const branchRows = [];
  const detectedLines = new Set();

  for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const branchLabel = indices.branch >= 0 ? String(row[indices.branch] ?? "").trim() : selectedSucursal;
    const normalizedBranch = normalizeSucursal(branchLabel || selectedSucursal);
    if (selected && normalizedBranch !== selected) continue;

    const lineCode = detectDropsizeLine(row, indices);
    if (DROPSIZE_LINES[lineCode]) detectedLines.add(lineCode);
    branchRows.push({ row, lineCode, normalizedBranch });
  }

  const lineasDetectadas = Array.from(detectedLines);
  if (!lineasDetectadas.length) {
    throw new Error("No se encontraron movimientos de Quento Snacks o Héroe en la sucursal seleccionada.");
  }

  const normalizedRequest = normalizeLinea(requestedLineCode);
  const selectedLineCode = DROPSIZE_LINES[normalizedRequest]
    ? normalizedRequest
    : (lastSelectedDropsizeLine && lineasDetectadas.includes(lastSelectedDropsizeLine)
      ? lastSelectedDropsizeLine
      : lineasDetectadas[0]);

  const structure = { managers: {} };
  let includedRows = 0;
  const matchedVendors = new Set();
  const unmatchedVendors = new Set();

  branchRows.forEach(({ row, lineCode, normalizedBranch }) => {
    if (lineCode !== selectedLineCode) return;

    const vendorRaw = row[indices.vendor];
    const vendorCodeRaw = indices.vendorCode >= 0 ? row[indices.vendorCode] : null;
    const hierarchy = detailMaps.resolveHierarchy(vendorRaw, vendorCodeRaw, normalizedBranch);
    const vendorLabel = hierarchy.vendorLabel;
    const supervisorLabel = hierarchy.supervisorLabel || "Sin supervisor";
    const managerLabel = hierarchy.managerLabel;
    if (hierarchy.matched) matchedVendors.add(normalizeKey(vendorLabel));
    else unmatchedVendors.add(normalizeKey(vendorLabel));

    const clientRaw = row[indices.client];
    if (clientRaw === null || clientRaw === undefined || String(clientRaw).trim() === "") return;
    const clientCodeRaw = indices.clientCode >= 0 ? row[indices.clientCode] : null;
    const clientLabelRaw = String(clientRaw).trim();
    const clientLabel = clientCodeRaw !== null && clientCodeRaw !== undefined && String(clientCodeRaw).trim()
      ? `${clientLabelRaw} #${String(clientCodeRaw).trim()}`
      : clientLabelRaw;
    const routeLabel = String(row[indices.route] ?? "").trim() || "Sin ruta";
    const cargo = safeNumber(row[indices.cargo]);
    const invoices = safeNumber(row[indices.invoices]);
    if (cargo === 0 && invoices === 0) return;

    const managerKey = managerLabel ? normalizeKey(managerLabel) : "__SIN_JEFE__";
    if (!structure.managers[managerKey]) {
      structure.managers[managerKey] = { label: managerLabel, supervisors: {} };
    }
    const manager = structure.managers[managerKey];
    const supervisorKey = normalizeKey(supervisorLabel) || "SIN SUPERVISOR";
    if (!manager.supervisors[supervisorKey]) {
      manager.supervisors[supervisorKey] = { label: supervisorLabel, vendors: {} };
    }
    const supervisor = manager.supervisors[supervisorKey];
    const vendorKey = normalizeKey(vendorLabel) || "SIN VENDEDOR";
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
  });

  return {
    structure,
    lineasDetectadas,
    selectedLineCode,
    includedRows,
    hierarchyStats: {
      matchedVendors: matchedVendors.size,
      unmatchedVendors: unmatchedVendors.size,
    },
  };
}

function flattenRows(structure) {
  const rows = [];
  Object.values(structure.managers || {}).forEach((manager) => {
    Object.values(manager.supervisors).forEach((supervisor) => {
      Object.values(supervisor.vendors).forEach((vendor) => {
        Object.values(vendor.routes).forEach((route) => {
          Object.values(route.clients).forEach((client) => {
            const dropsize = getDropsize(client.cargo, client.invoices);
            rows.push([
              manager.label || "",
              supervisor.label,
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
  });
  return rows;
}

function exportCsv(structure, lineInfo) {
  const rows = [
    ["Línea", "Jefe de ventas", "Supervisor", "Vendedor", "Ruta", "Cliente", "Cantidades CON Cargo", "Cantidad de Facturas", "Dropsize"],
    ...flattenRows(structure).map((row) => [lineInfo.label, ...row]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `dropsize_${lineInfo.cls}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function renderStructure(structure, branchLabel, context) {
  const area = document.getElementById("dropsizeReportArea");
  if (!area) return;

  const {
    lineasDetectadas,
    selectedLineCode,
    onLineChange,
    hierarchyStats = {},
  } = context;
  const lineInfo = DROPSIZE_LINES[selectedLineCode] || DROPSIZE_LINES["QUENTO SNACK"];
  const managerRows = Object.values(structure.managers || {})
    .map((manager) => ({ manager, label: manager.label, ...aggregateTotalsFromSupervisors(manager.supervisors) }))
    .sort(compareDropsizeDesc);
  const hasManagerLevel = managerRows.some((row) => Boolean(row.label));
  const managerCount = managerRows.filter((row) => Boolean(row.label)).length;
  const supervisorRows = managerRows.flatMap((managerRow) => Object.values(managerRow.manager.supervisors)
    .map((supervisor) => ({ supervisor, name: supervisor.label, managerLabel: managerRow.label, ...aggregateTotalsFromVendors(supervisor.vendors) })));
  const total = aggregateTotalsFromManagers(structure.managers || {});
  const supervisorCount = supervisorRows.length;
  const routeCount = supervisorRows.reduce(
    (count, supervisorRow) => count + Object.values(supervisorRow.supervisor.vendors).reduce(
      (vendorCount, vendor) => vendorCount + Object.keys(vendor.routes).length,
      0,
    ),
    0,
  );
  const missingSelectedLine = !lineasDetectadas.includes(selectedLineCode);
  const hierarchySummary = `${hasManagerLevel ? `${managerCount} jefe${managerCount === 1 ? "" : "s"} de ventas · ` : ""}${supervisorCount} supervisor${supervisorCount === 1 ? "" : "es"} · ${routeCount} rutas`;
  const hierarchyTitle = hasManagerLevel
    ? `Detalle por Jefe de ventas y Supervisor — Dropsize ${escapeHtml(lineInfo.label)}`
    : `Detalle por Supervisor — Dropsize ${escapeHtml(lineInfo.label)}`;

  area.innerHTML = `
    <div class="linea-selector-panel dropsize-line-selector">
      <label for="dropsizeLineaObjetivoSelect">Línea objetivo</label>
      <select id="dropsizeLineaObjetivoSelect">
        ${Object.entries(DROPSIZE_LINES).map(([code, info]) => `
          <option value="${code}" ${code === selectedLineCode ? "selected" : ""}>${info.label} · dropsize</option>
        `).join("")}
      </select>
    </div>
    <div class="linea-badge ${lineInfo.cls}">Línea seleccionada: ${lineInfo.label} · Dropsize calculado solo con sus unidades y facturas</div>
    ${missingSelectedLine ? `<div class="database-message error dropsize-line-warning">No se detectaron movimientos de ${lineInfo.label} en el archivo para esta sucursal.</div>` : ""}
    ${hierarchyStats.unmatchedVendors ? `<div class="database-message dropsize-hierarchy-warning">${hierarchyStats.unmatchedVendors} vendedor${hierarchyStats.unmatchedVendors === 1 ? "" : "es"} no pudieron vincularse con Detalle personal y se muestran bajo “Sin supervisor”.</div>` : ""}
    ${!supervisorRows.length ? "" : `
      <div class="dropsize-kpis kpi-summary">
        <div class="kpi-card" style="--kc:var(--red)">
          <div class="k-label">Dropsize ${escapeHtml(lineInfo.label)}</div>
          <div class="k-value">${total.dropsize === null ? "N/A" : formatNumber(total.dropsize)}</div>
          <div class="k-sub">unidades con cargo / facturas de ${escapeHtml(lineInfo.label)}</div>
        </div>
        <div class="kpi-card" style="--kc:var(--green)">
          <div class="k-label">Unidades con cargo</div>
          <div class="k-value">${formatNumber(total.cargo)}</div>
          <div class="k-sub">total exclusivo de ${escapeHtml(lineInfo.label)}</div>
        </div>
        <div class="kpi-card" style="--kc:var(--amber)">
          <div class="k-label">Facturas de la línea</div>
          <div class="k-value">${formatNumber(total.invoices)}</div>
          <div class="k-sub">boletas/ventas que componen el cálculo</div>
        </div>
        <div class="kpi-card" style="--kc:var(--dark)">
          <div class="k-label">Clientes evaluados</div>
          <div class="k-value">${total.clients.toLocaleString("es-AR")}</div>
          <div class="k-sub">${hierarchySummary}</div>
        </div>
      </div>

      <div class="dropsize-summary-card">
        <div>
          <span class="dropsize-summary-label">Sucursal analizada</span>
          <strong>${escapeHtml(branchLabel)}</strong>
        </div>
        <div class="dropsize-summary-metric">
          <span>Línea</span>
          <strong>${escapeHtml(lineInfo.label)}</strong>
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
          <label>${hasManagerLevel ? "Jefe / Supervisor" : "Supervisor"}<input type="text" id="dropsizeFilterSupervisor" placeholder="Filtrar por ${hasManagerLevel ? "jefe o supervisor" : "supervisor"}" /></label>
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
          <div class="title">${hierarchyTitle}</div>
          <div class="subtitle">Jerarquía tomada de Detalle personal · ordenado de mayor a menor</div>
        </div>
      </div>
      <div id="dropsizeHierarchy"></div>
    `}
    ${!supervisorRows.length ? `<div class="report-empty dropsize-placeholder compact"><div class="report-empty-icon">↕</div><h2>Sin datos para ${escapeHtml(lineInfo.label)}</h2><p>Elegí otra línea objetivo o verificá que el archivo de ventas contenga movimientos de esta línea para la sucursal seleccionada.</p></div>` : ""}`;

  const lineSelector = area.querySelector("#dropsizeLineaObjetivoSelect");
  lineSelector?.addEventListener("change", (event) => {
    lastSelectedDropsizeLine = event.target.value;
    onLineChange(event.target.value);
  });

  if (!supervisorRows.length) return;

  const hierarchyArea = area.querySelector("#dropsizeHierarchy");
  const supervisorInput = area.querySelector("#dropsizeFilterSupervisor");
  const routeInput = area.querySelector("#dropsizeFilterRoute");

  const renderRouteHtml = (routeRow) => {
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
  };

  const renderVendorHtml = (vendorRow, routeFilter) => {
    const routes = Object.values(vendorRow.vendor.routes)
      .map((route) => ({ route, ...aggregateTotalsFromClients(route.clients) }))
      .filter((routeRow) => !routeFilter || normalizeKey(routeRow.route.label).includes(routeFilter))
      .sort(compareDropsizeDesc);
    if (!routes.length) return "";
    return `
      <div class="vend-card dropsize-vendor-card" data-dropsize-card>
        <div class="vend-head" data-dropsize-toggle>
          <div class="vend-title"><span class="arrow">▶</span><div><span class="hierarchy-role">Vendedor</span><h4>${escapeHtml(vendorRow.vendor.label)}</h4></div></div>
          <div class="metrics-chips">
            <span class="metric-chip clients"><b>${vendorRow.clients}</b> clientes</span>
            <span class="metric-chip units"><b>${formatNumber(vendorRow.cargo)}</b> con cargo</span>
            <span class="metric-chip fulfilled"><b>${formatNumber(vendorRow.invoices)}</b> facturas</span>
            <span class="metric-chip progress">Dropsize <b>${vendorRow.dropsize === null ? "N/A" : formatNumber(vendorRow.dropsize)}</b></span>
          </div>
        </div>
        <div class="vend-body">${routes.map(renderRouteHtml).join("")}</div>
      </div>`;
  };

  const renderSupervisorHtml = (supervisorRow, routeFilter, shouldOpen = false) => {
    const vendors = Object.values(supervisorRow.supervisor.vendors)
      .map((vendor) => ({ vendor, ...aggregateTotalsFromRoutes(vendor.routes) }))
      .sort(compareDropsizeDesc);
    const vendorHtml = vendors.map((vendorRow) => renderVendorHtml(vendorRow, routeFilter)).filter(Boolean).join("");
    if (!vendorHtml) return "";
    return `
      <div class="sup-card dropsize-supervisor-card${supervisorRow.name === "Sin supervisor" ? " no-sup" : ""}${shouldOpen ? " open" : ""}" data-dropsize-card>
        <div class="sup-head" data-dropsize-toggle>
          <div class="sup-title"><span class="arrow">▶</span><div><span class="hierarchy-role">Supervisor</span><h3>${escapeHtml(supervisorRow.name)}</h3></div></div>
          <div class="metrics-chips">
            <span class="metric-chip clients"><b>${supervisorRow.clients}</b> clientes</span>
            <span class="metric-chip units"><b>${formatNumber(supervisorRow.cargo)}</b> con cargo</span>
            <span class="metric-chip fulfilled"><b>${formatNumber(supervisorRow.invoices)}</b> facturas</span>
            <span class="metric-chip progress">Dropsize <b>${supervisorRow.dropsize === null ? "N/A" : formatNumber(supervisorRow.dropsize)}</b></span>
          </div>
        </div>
        <div class="sup-body">${vendorHtml}</div>
      </div>`;
  };

  function renderHierarchy() {
    const hierarchyFilter = normalizeKey(supervisorInput.value);
    const routeFilter = normalizeKey(routeInput.value);
    const chunks = [];

    if (hasManagerLevel) {
      managerRows.forEach((managerRow, managerIndex) => {
        const managerName = managerRow.label || "Sin jefe de ventas";
        const managerMatches = !hierarchyFilter || normalizeKey(managerName).includes(hierarchyFilter);
        const supervisors = Object.values(managerRow.manager.supervisors)
          .map((supervisor) => ({ supervisor, name: supervisor.label, ...aggregateTotalsFromVendors(supervisor.vendors) }))
          .sort(compareDropsizeDesc);
        const supervisorHtml = supervisors.map((supervisorRow, supervisorIndex) => {
          if (!managerMatches && hierarchyFilter && !normalizeKey(supervisorRow.name).includes(hierarchyFilter)) return "";
          return renderSupervisorHtml(supervisorRow, routeFilter, managerIndex === 0 && supervisorIndex === 0);
        }).filter(Boolean).join("");
        if (!supervisorHtml) return;
        chunks.push(`
          <div class="sup-card dropsize-manager-card${!managerRow.label ? " no-manager" : ""}${managerIndex === 0 ? " open" : ""}" data-dropsize-card>
            <div class="sup-head dropsize-manager-head" data-dropsize-toggle>
              <div class="sup-title"><span class="arrow">▶</span><div><span class="hierarchy-role">Jefe de ventas</span><h3>${escapeHtml(managerName)}</h3></div></div>
              <div class="metrics-chips">
                <span class="metric-chip clients"><b>${managerRow.clients}</b> clientes</span>
                <span class="metric-chip units"><b>${formatNumber(managerRow.cargo)}</b> con cargo</span>
                <span class="metric-chip fulfilled"><b>${formatNumber(managerRow.invoices)}</b> facturas</span>
                <span class="metric-chip progress">Dropsize <b>${managerRow.dropsize === null ? "N/A" : formatNumber(managerRow.dropsize)}</b></span>
              </div>
            </div>
            <div class="sup-body dropsize-manager-body">${supervisorHtml}</div>
          </div>`);
      });
    } else {
      supervisorRows
        .sort(compareDropsizeDesc)
        .forEach((supervisorRow, supervisorIndex) => {
          if (hierarchyFilter && !normalizeKey(supervisorRow.name).includes(hierarchyFilter)) return;
          const html = renderSupervisorHtml(supervisorRow, routeFilter, supervisorIndex === 0);
          if (html) chunks.push(html);
        });
    }

    hierarchyArea.innerHTML = chunks.join("");
    hierarchyArea.querySelectorAll("[data-dropsize-toggle]").forEach((header) => {
      header.addEventListener("click", () => {
        const card = header.closest("[data-dropsize-card]");
        if (card) toggleAccordionCard(card);
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
    hierarchyArea.querySelectorAll("[data-dropsize-card]").forEach((card) => setAccordionOpen(card, true, true));
  });
  area.querySelector("#dropsizeCollapseAll").addEventListener("click", () => {
    hierarchyArea.querySelectorAll("[data-dropsize-card]").forEach((card) => setAccordionOpen(card, false, true));
  });
  area.querySelector("#dropsizeExportCsv").addEventListener("click", () => exportCsv(structure, lineInfo));
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
  const resolvedBranchLabel = branchLabel || selectedSucursal || "Sucursal seleccionada";

  const renderForLine = (lineCode) => {
    const parsed = parseSalesWorkbook(
      XLSX,
      salesWorkbook,
      selectedSucursal,
      detailMaps,
      lineCode,
    );
    lastSelectedDropsizeLine = parsed.selectedLineCode;
    renderStructure(parsed.structure, resolvedBranchLabel, {
      lineasDetectadas: parsed.lineasDetectadas,
      selectedLineCode: parsed.selectedLineCode,
      onLineChange: renderForLine,
      hierarchyStats: parsed.hierarchyStats,
    });
    return parsed;
  };

  return renderForLine(lastSelectedDropsizeLine);
}

export function resetDropsizeDashboard() {
  lastSelectedDropsizeLine = null;
  renderEmpty();
}

export function setDropsizeEmptyState(message) {
  renderEmpty(message);
}
