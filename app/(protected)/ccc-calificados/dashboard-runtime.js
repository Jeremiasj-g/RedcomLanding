import {
  buildSellerSupervisorListFromDetailWorkbook,
  processDropsizeDashboard,
  resetDropsizeDashboard,
  setDropsizeEmptyState,
} from "./dropsize-runtime";

export function initClientesCalificadosDashboard(options = {}){
  const {
    hasStoredPadron = () => false,
    hasStoredWorkspaceFile = () => false,
    hasSharedPersonalDetail = () => false,
    getSelectedBranch = () => '',
    getSelectedSucursalName = () => '',
    getSelectedBranchLabel = () => '',
    getActiveTab = () => 'ccc',
    getBrandConfig = () => [],
    resolvePadronFile = async () => null,
    resolveWorkspaceFile = async () => null,
    resolveSharedPersonalDetail = async () => null,
  } = options;
  const runtimeNotify = (type, message) => {
    const notifier = window.__redcomToast?.[type];
    if (typeof notifier === 'function') notifier(String(message));
    else console[type === 'error' ? 'error' : 'info']('[CCC]', message);
  };
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error('No se pudo cargar el motor de archivos Excel.');
  const registeredListeners = [];
  const nativeAddEventListener = EventTarget.prototype.addEventListener;
  const nativeRemoveEventListener = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options){
    registeredListeners.push([this, type, listener, options]);
    return nativeAddEventListener.call(this, type, listener, options);
  };

  try {
    
    let LISTADO = [];
    let PADRON = [];
    /* ============================================================
       CONFIG
    ============================================================ */
    let LINEAS = {};
    function normalizeLineCode(value){
      return String(value || '')
        .replace(/\u00a0/g, ' ')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
    }
    function lineClass(code){
      if (code === 'QUENTO SNACK') return 'quento';
      if (code === 'HEROE') return 'heroe';
      return 'custom';
    }
    function refreshConfiguredLines(){
      const configured = Array.isArray(getBrandConfig()) ? getBrandConfig() : [];
      const next = {};
      configured.forEach((item, index) => {
        const code = normalizeLineCode(item?.brand_name);
        const quota = Math.trunc(Number(item?.quota));
        if (!code || !Number.isFinite(quota) || quota <= 0) return;
        next[code] = {
          key: 'linea_' + index,
          label: String(item?.brand_name || code).trim(),
          umbral: quota,
          cls: lineClass(code),
        };
      });
      LINEAS = next;
      return LINEAS;
    }
    function filterSalesWorkbookByBrand(workbook, targetLineCode){
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rowsArr = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      if (!rowsArr.length) throw new Error('El archivo de ventas está vacío.');

      const headers = rowsArr[0].map(h => String(h || '').trim());
      const marcaIdx = headers.indexOf('Marca');
      const lineIdx = marcaIdx >= 0 ? marcaIdx + 1 : headers.indexOf('Descripción.3');
      if (lineIdx < 0) throw new Error('No se encontró la columna de marca/línea en el archivo de ventas.');

      const normalizedTarget = normalizeLineCode(targetLineCode);
      const kept = [rowsArr[0]];
      let candidateRows = 0;

      for (let i = 1; i < rowsArr.length; i++){
        const row = rowsArr[i];
        if (!row || row.every(value => value === null || value === undefined || value === '')) continue;
        candidateRows += 1;
        const lineCode = normalizeLineCode(row[lineIdx]);

        // Importante: no se omiten las otras marcas durante el cálculo.
        // Se construye un workbook NUEVO donde esas filas directamente ya no existen.
        if (lineCode === normalizedTarget) kept.push(row);
      }

      const filteredSheet = XLSX.utils.aoa_to_sheet(kept);
      const filteredWorkbook = {
        ...workbook,
        Sheets: { ...workbook.Sheets, [sheetName]: filteredSheet },
      };

      return {
        workbook: filteredWorkbook,
        keptRows: kept.length - 1,
        removedRows: Math.max(0, candidateRows - (kept.length - 1)),
        candidateRows,
      };
    }

    function buildSalesWorkbooksByBrand(workbook){
      const byBrand = {};
      let totalKept = 0;

      Object.keys(LINEAS).forEach(lineCode => {
        const result = filterSalesWorkbookByBrand(workbook, lineCode);
        byBrand[lineCode] = result;
        totalKept += result.keptRows;
      });

      if (!totalKept){
        throw new Error('El archivo de ventas no contiene filas de las marcas configuradas para esta sucursal.');
      }

      return byBrand;
    }
    let baseFile = null;
    let lastReportData = null;
    let processing = false;
    function normSuc(s){
      s = String(s||"").trim().toUpperCase();
      if (s.includes(" - ")) s = s.split(" - ").slice(-1)[0].trim();
      return s;
    }
    function contextualSucursal(rawSucursal, selectedBranch, selectedSucursal){
      const normalized = normSuc(rawSucursal);
      // Refrigerados pertenece operativamente a Corrientes y los reportes de VENDO
      // siguen informando "CASA CENTRAL" en la columna Sucursal. Como cada archivo
      // de ventas se guarda en el workspace de una sucursal/esquema concreto,
      // para Refrigerados el contexto seleccionado es la fuente de verdad.
      if (
        String(selectedBranch || '').trim().toLowerCase() === 'refrigerados'
        && normalized === 'CASA CENTRAL'
      ){
        return selectedSucursal || 'REFRIGERADOS';
      }
      return normalized;
    }
    function extractPack(desc){
      const m = String(desc||"").match(/(\d+)\s*[Xx]\s*[\d.,]+/);
      return m ? parseInt(m[1], 10) : 1;
    }
    function formatFecha(value){
      if (value === null || value === undefined || value === '') return '—';
      let d = null;
      if (value instanceof Date){
        d = value;
      } else if (typeof value === 'number'){
        // número de serie de Excel (días desde 1899-12-30)
        d = new Date(Math.round((value - 25569) * 86400 * 1000));
      } else {
        const s = String(value).trim();
        const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (m){
          const dd = m[1].padStart(2,'0'), mm = m[2].padStart(2,'0');
          let yyyy = m[3];
          if (yyyy.length === 2) yyyy = '20' + yyyy;
          return `${dd}/${mm}/${yyyy}`;
        }
        const parsed = new Date(s);
        if (!isNaN(parsed)) d = parsed;
        else return s; // no se pudo interpretar, se muestra tal cual
      }
      if (!d || isNaN(d)) return String(value);
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    function setStatus(msg, isError){
      const el = document.getElementById('statusMsg');
      if (!el) return;
      el.textContent = msg;
      el.className = 'status' + (isError ? ' error' : '');
    }
    function readWorkbook(file){
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try{
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array', cellDates: true });
            resolve(wb);
          }catch(err){ reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    }
    /* ---------- Upload handlers ---------- */
    const baseInputElement = document.getElementById('fileBase');
    if (baseInputElement) baseInputElement.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if(!f) return;
      baseFile = f;
      const fileName = document.getElementById('fileBaseName');
      if (fileName) fileName.textContent = f.name;
      const dropBase = document.getElementById('dropBase');
      if (dropBase) dropBase.classList.add('filled');
      checkReady();
    });
    function checkReady(){
      const hasBranch = Boolean(getSelectedBranch());
      const hasPadron = Boolean(hasStoredPadron());
      const hasSales = Boolean(baseFile || hasStoredWorkspaceFile('sales'));
      const hasDropsizeSales = Boolean(hasStoredWorkspaceFile('dropsize_sales'));
      const hasDetail = Boolean(hasSharedPersonalDetail());
      const hasBrands = Object.keys(refreshConfiguredLines()).length > 0;
      const dropsizeActive = getActiveTab() === 'dropsize';
      const ready = Boolean(
        hasSales &&
        hasBranch &&
        hasPadron &&
        hasBrands &&
        hasDetail &&
        (!dropsizeActive || hasDropsizeSales)
      );
      const processButton = document.getElementById('btnProcess');
      if (processButton) processButton.disabled = processing || !ready;
      if (processing) return;
      if (!hasBranch) setStatus('Seleccioná una sucursal.');
      else if (!hasPadron) setStatus('La sucursal no tiene una base de clientes guardada.', true);
      else if (!hasSales) setStatus('La sucursal no tiene un archivo de ventas guardado.');
      else if (!hasBrands) setStatus('Configurá al menos una marca y su cuota para esta sucursal.', true);
      else if (!hasDetail) setStatus('Administración debe cargar Detalle personal global desde Configuración.', true);
      else if (dropsizeActive && !hasDropsizeSales) setStatus('Importá el reporte de comprobantes para calcular DROPSIZE.', true);
      else setStatus('Listo para procesar.');
    }
    function clearLocalSelections(){
      baseFile = null;
      lastReportData = null;
      const baseInput = document.getElementById('fileBase');
      if (baseInput) baseInput.value = '';
    }
    window.addEventListener('ccc:padron-status-changed', checkReady);
    window.addEventListener('ccc:workspace-files-changed', checkReady);
    window.addEventListener('ccc:brand-config-changed', checkReady);
    window.addEventListener('ccc:shared-personal-detail-status-changed', checkReady);
    window.addEventListener('ccc:active-tab-changed', checkReady);
    window.addEventListener('ccc:branch-changed', () => {
      clearLocalSelections();
      checkReady();
    });
    checkReady();
    const resetButton = document.getElementById('btnReset');
    if (resetButton) resetButton.addEventListener('click', () => {
      clearLocalSelections();
      setDashboardEmptyState('reportArea', 'Importá los archivos para generar el dashboard', 'Los archivos guardados de la sucursal quedan disponibles para volver a procesar.');
      setMixEmptyState();
      resetDropsizeDashboard();
      const updatedBadge = document.getElementById('updatedBadge');
      if (updatedBadge) updatedBadge.style.display = 'none';
      checkReady();
      runtimeNotify('info', 'Resultados reiniciados. Los archivos guardados permanecen disponibles.');
    });
    async function processDashboards({ automatic = false } = {}){
      if (processing) return;
      processing = true;
      window.dispatchEvent(new CustomEvent('ccc:processing-start', { detail: { automatic } }));
      setStatus(automatic ? 'Actualizando dashboards automáticamente…' : 'Procesando…');
      const processButton = document.getElementById('btnProcess');
      if (processButton) processButton.disabled = true;
      let finalStatus = '';
      let processError = null;
      try{
        const selectedBranch = getSelectedBranch();
        const selectedSucursal = getSelectedSucursalName();
        if (!selectedBranch || !selectedSucursal) throw new Error('Seleccioná una sucursal válida.');

        const configuredLines = refreshConfiguredLines();
        if (!Object.keys(configuredLines).length){
          throw new Error('La sucursal no tiene marcas y cuotas configuradas.');
        }

        const sharedDetailFile = await resolveSharedPersonalDetail();
        if (!sharedDetailFile) {
          throw new Error('Administración debe cargar Detalle personal global desde Configuración.');
        }
        const wbDetalle = await readWorkbook(sharedDetailFile);
        LISTADO = buildSellerSupervisorListFromDetailWorkbook(XLSX, wbDetalle);

        const storedPadronFile = await resolvePadronFile();
        if (!storedPadronFile) throw new Error('No se encontró una base de clientes guardada para ' + (getSelectedBranchLabel() || selectedBranch) + '.');
        const wbP = await readWorkbook(storedPadronFile);
        PADRON = parsePadron(wbP, selectedSucursal);

        const effectiveSalesFile = baseFile || (hasStoredWorkspaceFile('sales') ? await resolveWorkspaceFile('sales') : null);
        if (!effectiveSalesFile) throw new Error('No hay un archivo de ventas guardado para la sucursal seleccionada.');
        const wbBComplete = await readWorkbook(effectiveSalesFile);
        const salesByBrand = buildSalesWorkbooksByBrand(wbBComplete);
        const rowsByLine = {};
        const allRows = [];
        let periodo = null;

        for (const lineCode of Object.keys(LINEAS)){
          const brandSales = salesByBrand[lineCode];
          if (!brandSales || brandSales.keptRows === 0){
            rowsByLine[lineCode] = [];
            continue;
          }

          const parsedBrand = parseBase(
            brandSales.workbook,
            selectedBranch,
            selectedSucursal,
          );
          const brandRows = parsedBrand.rows
            .filter(row => row.sucursal === selectedSucursal && row.linea === lineCode);

          rowsByLine[lineCode] = brandRows;
          allRows.push(...brandRows);
          if (!periodo) periodo = parsedBrand.periodo;
        }

        if (!allRows.length){
          throw new Error('El archivo de ventas no contiene movimientos de la sucursal ' + (getSelectedBranchLabel() || selectedBranch) + '.');
        }

        const lineasDetectadas = Object.keys(LINEAS)
          .filter(lineCode => (rowsByLine[lineCode] || []).length > 0);
        const selectedLineaCode = lineasDetectadas[0] || Object.keys(LINEAS)[0];

        lastReportData = {
          rows: allRows,
          rowsByLine,
          periodo,
          lineasDetectadas,
          selectedLineaCode,
        };
        renderReport(allRows, periodo, lineasDetectadas, selectedLineaCode);

        if (hasStoredWorkspaceFile('dropsize_sales')){
          const dropsizeSalesFile = await resolveWorkspaceFile('dropsize_sales');
          if (!dropsizeSalesFile) {
            throw new Error('No se pudo recuperar el reporte de comprobantes para DROPSIZE.');
          }
          const wbDropsize = await readWorkbook(dropsizeSalesFile);
          await processDropsizeDashboard({
            XLSX,
            receiptWorkbook: wbDropsize,
            detailWorkbook: wbDetalle,
            selectedSucursal,
            selectedBranch,
            branchLabel: getSelectedBranchLabel() || selectedBranch,
            brandConfig: Object.entries(LINEAS).map(([, info]) => ({
              brand_name: info.label,
              quota: info.umbral,
            })),
          });
        } else {
          setDropsizeEmptyState(
            'Importá el reporte de comprobantes desde la pestaña DROPSIZE para calcular el indicador.'
          );
        }

        const selectedFilter = salesByBrand[selectedLineaCode];
        const filterSummary = selectedFilter
          ? ` Para ${LINEAS[selectedLineaCode]?.label || selectedLineaCode} se eliminaron ${selectedFilter.removedRows.toLocaleString('es-AR')} filas y se analizaron ${selectedFilter.keptRows.toLocaleString('es-AR')} filas.`
          : '';

        const hasDropsizeReport = hasStoredWorkspaceFile('dropsize_sales');
        finalStatus = automatic
          ? (hasDropsizeReport
              ? 'CCC, MIX y DROPSIZE se actualizaron automáticamente y quedan disponibles al volver a la página.'
              : 'CCC y MIX se actualizaron automáticamente. DROPSIZE queda pendiente hasta importar su reporte de comprobantes.') + filterSummary
          : (hasDropsizeReport
              ? 'CCC, MIX y DROPSIZE fueron actualizados.'
              : 'CCC y MIX fueron actualizados. DROPSIZE queda pendiente hasta importar su reporte de comprobantes.') + filterSummary;
      }catch(err){
        console.error(err);
        processError = err;
      }finally{
        processing = false;
        checkReady();
        window.dispatchEvent(new CustomEvent('ccc:processing-end', {
          detail: { automatic, success: !processError },
        }));
      }
      if (processError){
        const message = 'Error al procesar: ' + (processError?.message || processError);
        setStatus(message, true);
        runtimeNotify('error', message);
      } else if (finalStatus){
        setStatus(finalStatus);
        if (!automatic) runtimeNotify('success', finalStatus);
      }
    }
    const processButton = document.getElementById('btnProcess');
    if (processButton) processButton.addEventListener('click', () => {
      processDashboards({ automatic: false });
    });
    window.addEventListener('ccc:auto-process', () => {
      processDashboards({ automatic: true });
    });
    /* ---------- Parse Padrón (hojas "Clientes" y "Rutas de Venta") ---------- */
    function looksLikeTypeRow(row){
      if (!row) return false;
      const typeWords = new Set(['ENTERO','CARÁCTER','CARACTER','DECIMAL','LOGICO','LÓGICO','FECHA','TEXTO']);
      let hits = 0, total = 0;
      row.forEach(c => { if (c !== null && c !== undefined && c !== ''){ total++; if (typeWords.has(String(c).toUpperCase())) hits++; } });
      return total > 0 && (hits/total) > 0.5;
    }
    function parsePadron(wb, sucursalNombre){
      const wsCli = wb.Sheets['Clientes'];
      const wsRutas = wb.Sheets['Rutas de Venta'];
      if (!wsCli || !wsRutas) throw new Error('El archivo de padrón debe tener las hojas "Clientes" y "Rutas de Venta"');
      const rowsCli = XLSX.utils.sheet_to_json(wsCli, { header: 1, defval: null });
      const rowsRutas = XLSX.utils.sheet_to_json(wsRutas, { header: 1, defval: null });
      if (rowsCli.length < 3 || rowsRutas.length < 3) throw new Error('Formato inesperado en el padrón');
    
      const headersCli = rowsCli[1];
      const dataStartCli = looksLikeTypeRow(rowsCli[2]) ? 3 : 2;
      const idxCliCliente = headersCli.indexOf('Cliente');
      const idxCliRuta = headersCli.indexOf('Código Ruta Vta.');
      const idxCliAnulado = headersCli.indexOf('Anulado');
      const idxCliNombre = headersCli.indexOf('Razón social');
      if (idxCliCliente === -1 || idxCliRuta === -1 || idxCliAnulado === -1) throw new Error('Faltan columnas esperadas en la hoja Clientes del padrón');
    
      const headersRutas = rowsRutas[1];
      const dataStartRutas = looksLikeTypeRow(rowsRutas[2]) ? 3 : 2;
      const idxRutaCodigo = headersRutas.indexOf('Código');
      const idxRutaDesc = headersRutas.indexOf('Descripción');
      const idxRutaVendCod = headersRutas.indexOf('Código Vendedor');
      if (idxRutaCodigo === -1 || idxRutaDesc === -1 || idxRutaVendCod === -1) throw new Error('Faltan columnas esperadas en la hoja Rutas de Venta del padrón');
    
      const routeMap = new Map();
      for (let i = dataStartRutas; i < rowsRutas.length; i++){
        const row = rowsRutas[i];
        if (!row || row.length === 0) continue;
        const codigo = row[idxRutaCodigo];
        const vendCod = row[idxRutaVendCod];
        if (codigo === null || codigo === undefined) continue;
        if (vendCod === null || vendCod === undefined || Number(vendCod) === 0) continue; // rutas ficticias (oficina, traspaso, etc.)
        routeMap.set(Number(codigo), { ruta: String(row[idxRutaDesc]||'').trim(), vendCod: Number(vendCod) });
      }
    
      const padron = [];
      for (let i = dataStartCli; i < rowsCli.length; i++){
        const row = rowsCli[i];
        if (!row || row.length === 0) continue;
        const anulado = String(row[idxCliAnulado]||'').trim().toUpperCase();
        if (anulado !== 'NO') continue;
        const clienteCode = row[idxCliCliente];
        if (clienteCode === null || clienteCode === undefined) continue;
        const rutaCode = row[idxCliRuta];
        const info = routeMap.get(Number(rutaCode));
        if (!info) continue;
        const nombre = (idxCliNombre >= 0 ? String(row[idxCliNombre]||'').trim() : '') || ('Cliente ' + clienteCode);
        padron.push({ sucursal: sucursalNombre, cliente: Number(clienteCode), vendCod: info.vendCod, ruta: info.ruta, nombre });
      }
      if (!padron.length) throw new Error('No se encontraron clientes activos con vendedor asignado en el padrón.');
      return padron;
    }
    /* ---------- Parse Base ---------- */
    function parseBase(wb, selectedBranch = '', selectedSucursal = ''){
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rowsArr = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      if (!rowsArr.length) throw new Error('El archivo base está vacío.');
      const headers = rowsArr[0].map(h => String(h||'').trim());
      const idx = {};
      idx.periodoDesc = headers.indexOf('Descripción Período');
      idx.clientesId  = headers.indexOf('Clientes');
      idx.codCliente  = headers.indexOf('Cod. Cliente'); // código numérico real del cliente (coincide con el padrón)
      idx.sucursal    = headers.indexOf('Sucursal');
      idx.vendedor    = headers.findIndex(h => h === 'Vendedor');
      idx.vendedorNom = headers.indexOf('Descripción Vendedor');
      const rutaIdx = headers.indexOf('Ruta');
      idx.ruta        = rutaIdx >= 0 ? rutaIdx + 1 : -1; // descripción de la ruta de venta (columna siguiente a "Ruta")
      idx.cantidad    = headers.indexOf('Cantidades CON Cargo');
      const articulosIdx = headers.indexOf('Artículos');
      idx.articulos = articulosIdx;
      idx.descArticulo = articulosIdx >= 0 ? articulosIdx + 2 : headers.indexOf('Descripción.2');
      const marcaIdx = headers.indexOf('Marca');
      idx.linea = marcaIdx >= 0 ? marcaIdx + 1 : headers.indexOf('Descripción.3');
      const required = ['periodoDesc','clientesId','codCliente','sucursal','vendedor','vendedorNom','ruta','cantidad','linea','descArticulo'];
      for (const k of required){
        if (idx[k] === undefined || idx[k] < 0) throw new Error('No se encontró la columna requerida: ' + k);
      }
      let periodo = null;
      const rows = [];
      const lineasDetectadas = new Set();
      for (let i = 1; i < rowsArr.length; i++){
        const r = rowsArr[i];
        if (!r || r[idx.clientesId] === null || r[idx.clientesId] === undefined) continue;
        const linea = normalizeLineCode(r[idx.linea]);
        if (!LINEAS[linea]) continue;
        lineasDetectadas.add(linea);
        if (periodo === null) periodo = r[idx.periodoDesc];
        const suc = contextualSucursal(r[idx.sucursal], selectedBranch, selectedSucursal);
        const vendCod = Number(r[idx.vendedor]);
        if (!Number.isFinite(vendCod)) continue;
        const cliente = r[idx.codCliente];
        if (cliente === null || cliente === undefined) continue;
        const clienteTexto = String(r[idx.clientesId]||'').trim();
        const clienteNombre = clienteTexto.replace(/^\(\s*\d+\s*\)\s*/, '').trim() || ('Cliente ' + cliente);
        const cantidadBultosRaw = Number(r[idx.cantidad]);
        const cantidadBultos = Number.isFinite(cantidadBultosRaw) ? cantidadBultosRaw : 0;
        const pack = extractPack(r[idx.descArticulo]);
        // las unidades reales usadas por el dashboard son siempre un entero
        // (no se compran fracciones de un artículo); se redondea por línea para
        // evitar ruido de precisión del bulto de origen (4 decimales).
        const cantidad = Math.round(cantidadBultos * pack);
        const ruta = String(r[idx.ruta] || '').trim();
        const artDescTxt = String(r[idx.descArticulo] || '').trim();
        const artKey = (idx.articulos >= 0 && r[idx.articulos] !== null && r[idx.articulos] !== undefined && r[idx.articulos] !== '')
          ? String(r[idx.articulos]).trim()
          : artDescTxt;
        rows.push({
          sucursal: suc,
          cliente: String(cliente),
          clienteNombre,
          vendCod,
          ruta,
          linea,
          cantidad,
          artKey,
          artDesc: artDescTxt || artKey,
          // Datos originales conservados para la hoja opcional "Análisis detallado".
          // No se redondea la multiplicación porque debe reflejar exactamente
          // Cantidades CON Cargo × Unidades por caja, como en el archivo fuente.
          detalleCliente: clienteTexto,
          detalleVendedor: String(r[idx.vendedorNom] || '').trim(),
          detalleArticulo: artKey,
          detalleDescripcion: String(r[idx.linea] || '').trim(),
          detalleCantidadConCargo: cantidadBultos,
          detalleUnidadesPorCaja: pack,
          detalleUnidadesCompradas: cantidadBultos * pack,
        });
      }
      if (!rows.length) throw new Error('No se encontraron filas válidas de las marcas configuradas en el archivo.');
      if (lineasDetectadas.size > 1){
        console.warn('El archivo contiene más de una línea objetivo:', [...lineasDetectadas]);
      }
      return { rows, periodo, lineasDetectadas: [...lineasDetectadas] };
    }
    
    /* ---------- Agregación ---------- */
    function buildVendedorIndex(){
      const idx = {};
      LISTADO.forEach(v => { idx[v.sucursal + '|' + v.codigo] = v; });
      return idx;
    }
    
    // PADRON entries -> { sucursal, cliente, vendCod, ruta } (universo completo, con o sin compra)
    function buildPadronIndex(){
      const vIdx = buildVendedorIndex();
      const idx = {}; // vKey -> { info, rutas: { rutaNombre: Map(clienteCod -> nombre) } }
      PADRON.forEach(p => {
        const vKey = p.sucursal + '|' + p.vendCod;
        const info = vIdx[vKey] || {
          sucursal: p.sucursal,
          codigo: p.vendCod,
          nombre: 'Vendedor ' + p.vendCod,
          supervisor: null,
        };
        if (!idx[vKey]) idx[vKey] = { info, rutas: {} };
        const bucket = idx[vKey];
        if (!bucket.rutas[p.ruta]) bucket.rutas[p.ruta] = new Map();
        bucket.rutas[p.ruta].set(String(p.cliente), p.nombre || ('Cliente ' + p.cliente));
      });
      return idx;
    }
    
    // Fallback: universo derivado de la base transaccional (para vendedores/sucursales sin padrón cargado)
    function buildBaseIndex(rows){
      const vIdx = buildVendedorIndex();
      const idx = {};
      rows.forEach(r => {
        const vKey = r.sucursal + '|' + r.vendCod;
        const info = vIdx[vKey] || {
          sucursal: r.sucursal,
          codigo: r.vendCod,
          nombre: r.detalleVendedor || ('Vendedor ' + r.vendCod),
          supervisor: null,
        };
        if (!idx[vKey]) idx[vKey] = { info, rutas: {} };
        const bucket = idx[vKey];
        const rutaKey = r.ruta || '(Sin ruta especificada)';
        if (!bucket.rutas[rutaKey]) bucket.rutas[rutaKey] = new Map();
        bucket.rutas[rutaKey].set(r.cliente, r.clienteNombre || ('Cliente ' + r.cliente));
      });
      return idx;
    }
    
    function aggregate(rows, lineaCode){
      // Al alternar el selector se consideran únicamente las ventas de la línea elegida.
      const selectedRows = rows.filter(r => r.linea === lineaCode);
      const ventasPorCliente = new Map();
      selectedRows.forEach(r => {
        ventasPorCliente.set(r.cliente, (ventasPorCliente.get(r.cliente)||0) + r.cantidad);
      });

      const articulosPorCliente = new Map();
      const articulosPorSucursal = new Map();
      const artLabels = new Map();
      const cantidadPorArticuloCliente = new Map();
      const cantidadPorArticuloSucursal = new Map();
      selectedRows.forEach(r => {
        if (!r.artKey) return;
        if (!articulosPorCliente.has(r.cliente)) articulosPorCliente.set(r.cliente, new Set());
        articulosPorCliente.get(r.cliente).add(r.artKey);
        if (!articulosPorSucursal.has(r.sucursal)) articulosPorSucursal.set(r.sucursal, new Set());
        articulosPorSucursal.get(r.sucursal).add(r.artKey);
        if (!artLabels.has(r.artKey)) artLabels.set(r.artKey, r.artDesc || r.artKey);

        if (!cantidadPorArticuloCliente.has(r.cliente)) cantidadPorArticuloCliente.set(r.cliente, new Map());
        const clientQty = cantidadPorArticuloCliente.get(r.cliente);
        clientQty.set(r.artKey, (clientQty.get(r.artKey) || 0) + r.cantidad);

        if (!cantidadPorArticuloSucursal.has(r.sucursal)) cantidadPorArticuloSucursal.set(r.sucursal, new Map());
        const branchQty = cantidadPorArticuloSucursal.get(r.sucursal);
        branchQty.set(r.artKey, (branchQty.get(r.artKey) || 0) + r.cantidad);
      });
    
      const padronIdx = buildPadronIndex();
      const baseIdx = buildBaseIndex(selectedRows);
      const allVKeys = new Set([...Object.keys(padronIdx), ...Object.keys(baseIdx)]);
    
      const supervisores = {}; // nombre supervisor (o "__SIN_SUPERVISOR__") -> { vendedores: {} }
      allVKeys.forEach(vKey => {
        const tienePadron = !!padronIdx[vKey];
        const src = tienePadron ? padronIdx[vKey] : baseIdx[vKey];
        if (!src) return;
        const info = src.info;
        const supKey = info.supervisor || '__SIN_SUPERVISOR__';
        if (!supervisores[supKey]) supervisores[supKey] = { vendedores: {} };
        const supBucket = supervisores[supKey];
        supBucket.vendedores[vKey] = {
          codigo: info.codigo,
          nombre: info.nombre,
          sucursal: info.sucursal,
          tienePadron,
          rutas: src.rutas, // rutaNombre -> Map(cliente -> nombre)
        };
      });
      return {
        supervisores,
        ventasPorCliente,
        selectedRows,
        articulosPorCliente,
        articulosPorSucursal,
        artLabels,
        cantidadPorArticuloCliente,
        cantidadPorArticuloSucursal,
      };
    }
    
    /* ---------- Render ---------- */
    function pctBar(val, umbral){
      const pct = Math.max(2, Math.min(100, (val / umbral) * 100));
      return pct;
    }
    function clientRowHTML(cliente, nombre, val, umbral, lineaCls){
      const cumplido = val >= umbral;
      const falta = Math.max(0, umbral - val);
      const pct = pctBar(val, umbral);
      return `<tr class="${cumplido ? 'row-cumplido' : ''}">
        <td>${nombre} <span class="cli-code">#${cliente}</span></td>
        <td class="actual ${lineaCls}">${val}</td>
        <td class="bar-cell"><div class="bar-track"><div class="bar-fill ${cumplido ? 'cumplido' : lineaCls}" style="width:${pct}%"></div></div></td>
        <td class="${cumplido ? 'cumplido-tag' : 'falta'}">${cumplido ? '✓ Cumplió' : falta}</td>
      </tr>`;
    }
    // Todos los clientes del padrón de una ruta (incluye los que compraron 0 y los que ya cumplieron), ordenados de mayor a menor
    function rutaClientesTodos(clienteMap, ventasPorCliente){
      return Array.from(clienteMap.entries())
        .map(([cli, nombre]) => ({ cliente: cli, nombre, val: ventasPorCliente.get(cli) || 0 }))
        .sort((a,b) => b.val - a.val);
    }
    
    function uniqueClientes(clientes){
      const byCliente = new Map();
      clientes.forEach(c => {
        const key = String(c.cliente);
        if (!byCliente.has(key)) byCliente.set(key, c);
      });
      return Array.from(byCliente.values());
    }
    
    function computeChipStats(clientes, umbral){
      const list = uniqueClientes(clientes);
      let unidades = 0, cumplio = 0, enProgreso = 0, sinCompra = 0;
      list.forEach(c => {
        const val = Number(c.val) || 0;
        unidades += val;
        if (val >= umbral) cumplio++;
        else if (val > 0) enProgreso++;
        else sinCompra++;
      });
      return { clientes: list.length, unidades, cumplio, enProgreso, sinCompra };
    }
    
    function sumChipStats(statsList){
      return statsList.reduce((acc, s) => ({
        clientes: acc.clientes + s.clientes,
        unidades: acc.unidades + s.unidades,
        cumplio: acc.cumplio + s.cumplio,
        enProgreso: acc.enProgreso + s.enProgreso,
        sinCompra: acc.sinCompra + s.sinCompra,
      }), { clientes:0, unidades:0, cumplio:0, enProgreso:0, sinCompra:0 });
    }
    
    function metricChipsHTML(stats){
      return `<div class="metrics-chips">
        <span class="metric-chip clients"><b>${stats.clientes.toLocaleString('es-AR')}</b> clientes</span>
        <span class="metric-chip units"><b>${stats.unidades.toLocaleString('es-AR')}</b> unidades</span>
        <span class="metric-chip fulfilled"><b>${stats.cumplio.toLocaleString('es-AR')}</b> cumplió</span>
        <span class="metric-chip progress"><b>${stats.enProgreso.toLocaleString('es-AR')}</b> en progreso</span>
        <span class="metric-chip no-buy"><b>${stats.sinCompra.toLocaleString('es-AR')}</b> sin compra</span>
      </div>`;
    }
    
    function safeFilePart(value){
      return String(value || 'ruta')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[_-]+|[_-]+$/g, '')
        .slice(0, 80) || 'ruta';
    }
    
    async function exportRutaPendientes({ rutaNombre, clientes, vendedor, supervisor, lineaInfo, periodo }){
      const pendientes = clientes.filter(c => (Number(c.val) || 0) < lineaInfo.umbral);
      if (!pendientes.length){
        runtimeNotify('info', 'Esta ruta no tiene clientes pendientes: todos cumplieron la cuota.');
        return;
      }
    
      try{
        const rows = pendientes.map(c => {
          const unidades = Number(c.val) || 0;
          const faltan = Math.max(0, lineaInfo.umbral - unidades);
          return {
            'Supervisor': supervisor || 'Sin supervisor asignado',
            'Vendedor': vendedor?.nombre || '',
            'Código vendedor': vendedor?.codigo ?? '',
            'Ruta': rutaNombre,
            'Línea': lineaInfo.label,
            'Período': periodo || '',
            'Código cliente': c.cliente,
            'Cliente': c.nombre || ('Cliente ' + c.cliente),
            'Unidades actuales': unidades,
            'Cuota objetivo': lineaInfo.umbral,
            'Faltan': faltan,
            'Estado': faltan === 0 ? 'Cumplido' : (unidades > 0 ? 'En progreso' : 'No compró'),
          };
        });
    
        const worksheet = XLSX.utils.json_to_sheet(rows);
        worksheet['!cols'] = [
          { wch: 26 }, { wch: 26 }, { wch: 16 }, { wch: 28 }, { wch: 20 },
          { wch: 16 }, { wch: 16 }, { wch: 42 }, { wch: 19 }, { wch: 16 },
          { wch: 12 }, { wch: 16 },
        ];
        worksheet['!autofilter'] = { ref: worksheet['!ref'] };
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Pendientes');
    
        const fileName = `Pendientes_${safeFilePart(rutaNombre)}_${safeFilePart(lineaInfo.label)}.xlsx`;
        XLSX.writeFile(workbook, fileName, { compression: true });
        runtimeNotify('success', `Excel generado: ${fileName}`);
      }catch(err){
        console.error(err);
        runtimeNotify('error', 'Ocurrió un error al generar el Excel: ' + (err?.message || err));
      }
    }
    
    function vendorExportKey(vendedor){
      return [
        normSuc(vendedor?.sucursal),
        String(vendedor?.codigo ?? ''),
        String(vendedor?.nombre || '').trim().toUpperCase(),
      ].join('|');
    }

    function exportLineLabel(lineCode){
      return LINEAS[lineCode]?.label || lineCode;
    }

    function collectVendorMatrixData(rows){
      const vendorsByKey = new Map();
      const lineResults = {};

      Object.entries(LINEAS).forEach(([lineCode, lineInfo]) => {
        const { supervisores, ventasPorCliente } = aggregate(rows, lineCode);
        const metricsByVendor = new Map();

        Object.entries(supervisores).forEach(([supervisorKey, supervisorBucket]) => {
          const supervisor = supervisorKey === '__SIN_SUPERVISOR__'
            ? 'Sin supervisor asignado'
            : supervisorKey;

          Object.values(supervisorBucket.vendedores).forEach(vendedor => {
            const key = vendorExportKey(vendedor);
            const clientes = [];
            Object.values(vendedor.rutas).forEach(clienteMap => {
              clientes.push(...rutaClientesTodos(clienteMap, ventasPorCliente));
            });
            const stats = computeChipStats(clientes, lineInfo.umbral);
            const coverage = stats.clientes ? stats.cumplio / stats.clientes : 0;

            if (!vendorsByKey.has(key)) {
              vendorsByKey.set(key, {
                key,
                nombre: vendedor.nombre || 'Vendedor sin nombre',
                codigo: vendedor.codigo ?? '',
                sucursal: vendedor.sucursal || '',
                supervisor,
              });
            }

            metricsByVendor.set(key, {
              ...stats,
              coverage,
            });
          });
        });

        lineResults[lineCode] = { lineInfo, metricsByVendor };
      });

      const vendors = Array.from(vendorsByKey.values()).sort((a, b) => {
        const sup = String(a.supervisor).localeCompare(String(b.supervisor), 'es');
        if (sup !== 0) return sup;
        return String(a.nombre).localeCompare(String(b.nombre), 'es');
      });

      return { vendors, lineResults };
    }

    function styleCell(sheet, address, style, numberFormat){
      if (!sheet[address]) sheet[address] = { t: 's', v: '' };
      sheet[address].s = style;
      if (numberFormat) sheet[address].z = numberFormat;
    }

    function vendorExportLabel(vendor, includeVendorName){
      const codigo = String(vendor.codigo ?? '').trim();
      const nombre = String(vendor.nombre || 'Vendedor sin nombre').trim();

      // Formato solicitado para la matriz:
      // - por defecto: "62"
      // - opcional: "62 AGUSTINA GUZMAN"
      if (includeVendorName) return codigo ? `${codigo} ${nombre}` : nombre;
      return codigo || nombre;
    }

    function exportVendorObjectiveMatrix({
      rows,
      periodo,
      selectedMetrics,
      includeDirectory,
      includeVendorName,
      includeDetailedAnalysis,
    }){
      const model = collectVendorMatrixData(rows);
      if (!model.vendors.length){
        runtimeNotify('info', 'No hay vendedores disponibles para generar la matriz.');
        return;
      }

      const optionalMetrics = {
        clientes: { label: 'Total clientes', value: stats => stats.clientes, format: '#,##0' },
        unidades: { label: 'Unidades', value: stats => stats.unidades, format: '#,##0' },
        enProgreso: { label: 'En progreso', value: stats => stats.enProgreso, format: '#,##0' },
        sinCompra: { label: 'Sin compra', value: stats => stats.sinCompra, format: '#,##0' },
        coverage: { label: 'Cobertura %', value: stats => stats.coverage, format: '0.0%' },
      };
      const metrics = [
        { key: 'cumplio', label: 'Clientes que cumplieron', value: stats => stats.cumplio, format: '#,##0' },
        ...selectedMetrics.map(key => ({ key, ...optionalMetrics[key] })).filter(metric => metric.value),
      ];
      const multipleMetrics = metrics.length > 1;
      const lineCodes = Object.keys(LINEAS);
      const dataRows = [];
      const dataMeta = [];

      lineCodes.forEach(lineCode => {
        metrics.forEach(metric => {
          const lineName = exportLineLabel(lineCode);
          const label = multipleMetrics ? `${lineName} · ${metric.label}` : lineName;
          const metricsByVendor = model.lineResults[lineCode]?.metricsByVendor || new Map();
          const values = model.vendors.map(vendor => {
            const stats = metricsByVendor.get(vendor.key) || {
              clientes: 0,
              unidades: 0,
              cumplio: 0,
              enProgreso: 0,
              sinCompra: 0,
              coverage: 0,
            };
            return metric.value(stats);
          });
          dataRows.push([label, ...values]);
          dataMeta.push({ lineCode, metric });
        });
      });

      const branch = getSelectedBranchLabel() || getSelectedSucursalName() || getSelectedBranch() || 'Sucursal';
      const now = new Date();
      const generatedAt = now.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
      const header = [
        'Línea objetivo / indicador',
        ...model.vendors.map(vendor => vendorExportLabel(vendor, includeVendorName)),
      ];
      const aoa = [
        ['CCC CALIFICADOS · CUMPLIMIENTO POR VENDEDOR'],
        [`Sucursal: ${branch} · Período: ${periodo || '—'} · Generado: ${generatedAt}`],
        [],
        header,
        ...dataRows,
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(aoa);
      const lastColumn = XLSX.utils.encode_col(header.length - 1);
      const lastRow = 4 + dataRows.length;
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
      ];
      worksheet['!autofilter'] = { ref: `A4:${lastColumn}${lastRow}` };
      worksheet['!cols'] = [
        { wch: 31 },
        ...model.vendors.map(() => ({ wch: 14 })),
      ];
      worksheet['!rows'] = [
        { hpt: 28 },
        { hpt: 20 },
        { hpt: 7 },
        { hpt: 78 },
        ...dataRows.map(() => ({ hpt: 23 })),
      ];
      worksheet['!freeze'] = { xSplit: 1, ySplit: 4, topLeftCell: 'B5', activePane: 'bottomRight', state: 'frozen' };

      const border = {
        top: { style: 'thin', color: { rgb: 'D9DCE3' } },
        bottom: { style: 'thin', color: { rgb: 'D9DCE3' } },
        left: { style: 'thin', color: { rgb: 'D9DCE3' } },
        right: { style: 'thin', color: { rgb: 'D9DCE3' } },
      };
      const titleStyle = {
        fill: { fgColor: { rgb: 'C8102E' } },
        font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 16 },
        alignment: { horizontal: 'left', vertical: 'center' },
      };
      const subtitleStyle = {
        fill: { fgColor: { rgb: 'FCEAEA' } },
        font: { color: { rgb: '7D0A20' }, bold: true, sz: 10 },
        alignment: { horizontal: 'left', vertical: 'center' },
      };
      const headerStyle = {
        fill: { fgColor: { rgb: '252A34' } },
        font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true, textRotation: 45 },
        border,
      };
      const firstHeaderStyle = {
        ...headerStyle,
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true, textRotation: 0 },
      };

      styleCell(worksheet, 'A1', titleStyle);
      styleCell(worksheet, 'A2', subtitleStyle);
      for (let col = 0; col < header.length; col++) {
        const address = XLSX.utils.encode_cell({ r: 3, c: col });
        styleCell(worksheet, address, col === 0 ? firstHeaderStyle : headerStyle);
      }

      dataRows.forEach((row, rowIndex) => {
        const excelRow = rowIndex + 5;
        const { lineCode, metric } = dataMeta[rowIndex];
        const lineClassName = LINEAS[lineCode]?.cls;
        const labelFill = lineClassName === 'quento' ? 'FDF0E3' : lineClassName === 'heroe' ? 'E8F2FA' : 'F1F5F9';
        const labelColor = lineClassName === 'quento' ? 'B85B00' : lineClassName === 'heroe' ? '155C8C' : '475569';
        const rowFill = rowIndex % 2 === 0 ? 'FFFFFF' : 'F8F9FB';

        for (let col = 0; col < header.length; col++) {
          const address = XLSX.utils.encode_cell({ r: excelRow - 1, c: col });
          const isLabel = col === 0;
          const style = {
            fill: { fgColor: { rgb: isLabel ? labelFill : rowFill } },
            font: {
              color: { rgb: isLabel ? labelColor : (metric.key === 'cumplio' ? '087B45' : '252A34') },
              bold: isLabel || metric.key === 'cumplio',
              sz: 10,
            },
            alignment: {
              horizontal: isLabel ? 'left' : 'center',
              vertical: 'center',
              wrapText: true,
            },
            border,
          };
          styleCell(worksheet, address, style, isLabel ? undefined : metric.format);
        }
      });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'CCC vendedores');

      if (includeDirectory){
        const directoryRows = model.vendors.map(vendor => ({
          'Vendedor': vendorExportLabel(vendor, includeVendorName),
          'Código': vendor.codigo,
          'Supervisor': vendor.supervisor,
          'Sucursal': vendor.sucursal,
        }));
        const directory = XLSX.utils.json_to_sheet(directoryRows);
        directory['!autofilter'] = { ref: directory['!ref'] };
        directory['!cols'] = [
          { wch: includeVendorName ? 30 : 14 },
          { wch: 12 },
          { wch: 28 },
          { wch: 23 },
        ];
        const range = XLSX.utils.decode_range(directory['!ref']);
        for (let row = range.s.r; row <= range.e.r; row++) {
          for (let col = range.s.c; col <= range.e.c; col++) {
            const address = XLSX.utils.encode_cell({ r: row, c: col });
            const isHeader = row === 0;
            styleCell(directory, address, {
              fill: { fgColor: { rgb: isHeader ? '252A34' : (row % 2 ? 'FFFFFF' : 'F8F9FB') } },
              font: { color: { rgb: isHeader ? 'FFFFFF' : '252A34' }, bold: isHeader, sz: 10 },
              alignment: { horizontal: isHeader ? 'center' : 'left', vertical: 'center', wrapText: true },
              border,
            });
          }
        }
        XLSX.utils.book_append_sheet(workbook, directory, 'Vendedores');
      }

      if (includeDetailedAnalysis){
        const detailHeaders = [
          'Clientes',
          'Descripción Vendedor',
          'Artículos',
          'Descripción',
          'Cantidades CON Cargo',
          'Unidades por caja',
          'Unidades compradas por el cliente',
        ];
        const detailRows = rows.map(row => [
          row.detalleCliente || `(${String(row.cliente || '').padStart(6, '0')}) ${row.clienteNombre || ''}`.trim(),
          row.detalleVendedor || '',
          row.detalleArticulo || row.artKey || row.artDesc || '',
          row.detalleDescripcion || row.linea || '',
          Number(row.detalleCantidadConCargo) || 0,
          Number(row.detalleUnidadesPorCaja) || 1,
          Number(row.detalleUnidadesCompradas) || 0,
        ]);

        const detailSheet = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
        const detailLastRow = detailRows.length + 1;
        detailSheet['!autofilter'] = { ref: `A1:G${detailLastRow}` };
        detailSheet['!freeze'] = {
          xSplit: 0,
          ySplit: 1,
          topLeftCell: 'A2',
          activePane: 'bottomLeft',
          state: 'frozen',
        };
        detailSheet['!cols'] = [
          { wch: 42 },
          { wch: 27 },
          { wch: 45 },
          { wch: 20 },
          { wch: 23 },
          { wch: 18 },
          { wch: 32 },
        ];
        detailSheet['!rows'] = [
          { hpt: 24 },
          ...detailRows.map(() => ({ hpt: 20 })),
        ];

        const detailHeaderStyle = {
          fill: { fgColor: { rgb: 'E9EDF3' } },
          font: { color: { rgb: '161A22' }, bold: true, sz: 10 },
          alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
          border,
        };
        const detailTextStyle = rowIndex => ({
          fill: { fgColor: { rgb: rowIndex % 2 === 0 ? 'FFFFFF' : 'F8F9FB' } },
          font: { color: { rgb: '252A34' }, sz: 10 },
          alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
          border,
        });
        const detailNumberStyle = rowIndex => ({
          ...detailTextStyle(rowIndex),
          alignment: { horizontal: 'right', vertical: 'center' },
        });

        detailHeaders.forEach((_, colIndex) => {
          styleCell(
            detailSheet,
            XLSX.utils.encode_cell({ r: 0, c: colIndex }),
            detailHeaderStyle,
          );
        });

        detailRows.forEach((row, rowIndex) => {
          const excelRow = rowIndex + 2;
          for (let colIndex = 0; colIndex < detailHeaders.length; colIndex++) {
            const address = XLSX.utils.encode_cell({ r: excelRow - 1, c: colIndex });
            const isNumeric = colIndex >= 4;
            styleCell(
              detailSheet,
              address,
              isNumeric ? detailNumberStyle(rowIndex) : detailTextStyle(rowIndex),
              colIndex === 4 || colIndex === 6 ? '0.####' : (colIndex === 5 ? '0' : undefined),
            );
          }

          // La última columna queda como fórmula real de Excel:
          // Unidades compradas = Cantidades CON Cargo × Unidades por caja.
          const formulaCell = detailSheet[`G${excelRow}`] || { t: 'n', v: row[6] };
          formulaCell.t = 'n';
          formulaCell.f = `E${excelRow}*F${excelRow}`;
          formulaCell.v = row[6];
          formulaCell.z = '0.####';
          detailSheet[`G${excelRow}`] = formulaCell;
        });

        XLSX.utils.book_append_sheet(workbook, detailSheet, 'Análisis detallado');
      }

      const fileName = `CCC_Cumplimiento_Vendedores_${safeFilePart(branch)}_${now.toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName, { compression: true, cellStyles: true });
      runtimeNotify('success', `Excel generado: ${fileName}`);
    }

    function openVendorMatrixExportModal({ area, rows, periodo }){
      const model = collectVendorMatrixData(rows);
      if (!model.vendors.length){
        runtimeNotify('info', 'No hay vendedores disponibles para exportar.');
        return;
      }

      area.querySelector('.ccc-export-modal-backdrop')?.remove();
      const backdrop = document.createElement('div');
      backdrop.className = 'ccc-export-modal-backdrop';
      backdrop.innerHTML = `
        <div class="ccc-export-modal" role="dialog" aria-modal="true" aria-labelledby="cccExportTitle">
          <div class="ccc-export-modal-head">
            <div>
              <span class="ccc-export-kicker">Exportación Excel</span>
              <h3 id="cccExportTitle">Matriz de cumplimiento por vendedor</h3>
              <p>La exportación usa las marcas configuradas para la sucursal, los códigos de vendedor en columnas y la cantidad de clientes que cumplieron la cuota.</p>
            </div>
            <button class="ccc-export-close" type="button" aria-label="Cerrar">×</button>
          </div>
          <div class="ccc-export-summary">
            <strong>${Object.keys(LINEAS).length} línea${Object.keys(LINEAS).length === 1 ? '' : 's'} objetivo</strong>
            <span>${model.vendors.length} vendedores</span>
            <span>Período: ${periodo || '—'}</span>
          </div>
          <div class="ccc-export-options">
            <div class="ccc-export-option is-fixed">
              <input type="checkbox" checked disabled />
              <div><strong>Clientes que cumplieron</strong><span>Incluido por defecto.</span></div>
            </div>
            <label class="ccc-export-option is-primary-option">
              <input type="checkbox" id="cccExportVendorName" />
              <div>
                <strong>Concatenar nombre del vendedor</strong>
                <span>Opcional. Cambia "62" por "62 AGUSTINA GUZMAN".</span>
              </div>
            </label>
            <label class="ccc-export-option">
              <input type="checkbox" data-export-metric="clientes" />
              <div><strong>Total de clientes</strong><span>Padrón evaluado por vendedor.</span></div>
            </label>
            <label class="ccc-export-option">
              <input type="checkbox" data-export-metric="unidades" />
              <div><strong>Unidades</strong><span>Total de unidades con cargo.</span></div>
            </label>
            <label class="ccc-export-option">
              <input type="checkbox" data-export-metric="enProgreso" />
              <div><strong>En progreso</strong><span>Clientes con compra que aún no alcanzaron la cuota.</span></div>
            </label>
            <label class="ccc-export-option">
              <input type="checkbox" data-export-metric="sinCompra" />
              <div><strong>Sin compra</strong><span>Clientes sin unidades en la línea.</span></div>
            </label>
            <label class="ccc-export-option">
              <input type="checkbox" data-export-metric="coverage" />
              <div><strong>Cobertura %</strong><span>Porcentaje de cumplimiento por vendedor.</span></div>
            </label>
            <label class="ccc-export-option ccc-export-option-wide">
              <input type="checkbox" id="cccExportDirectory" />
              <div><strong>Agregar hoja de vendedores</strong><span>Incluye código, supervisor y sucursal en una segunda hoja.</span></div>
            </label>
            <label class="ccc-export-option ccc-export-option-wide">
              <input type="checkbox" id="cccExportDetailedAnalysis" />
              <div>
                <strong>Agregar hoja de análisis detallado</strong>
                <span>Incluye cliente, vendedor, artículo, línea, bultos con cargo, unidades por caja y unidades compradas.</span>
              </div>
            </label>
          </div>
          <div class="ccc-export-modal-actions">
            <button class="ghost ccc-export-cancel" type="button">Cancelar</button>
            <button class="ccc-export-confirm" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9H8"/>
              </svg>
              Exportar Excel
            </button>
          </div>
        </div>`;
      area.appendChild(backdrop);

      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const close = () => {
        document.body.style.overflow = previousOverflow;
        window.removeEventListener('keydown', onKeyDown);
        backdrop.remove();
      };
      const onKeyDown = event => {
        if (event.key === 'Escape') close();
      };
      window.addEventListener('keydown', onKeyDown);
      backdrop.addEventListener('click', event => {
        if (event.target === backdrop) close();
      });
      backdrop.querySelector('.ccc-export-close').addEventListener('click', close);
      backdrop.querySelector('.ccc-export-cancel').addEventListener('click', close);
      backdrop.querySelector('.ccc-export-confirm').addEventListener('click', () => {
        const selectedMetrics = Array.from(backdrop.querySelectorAll('[data-export-metric]:checked'))
          .map(input => input.getAttribute('data-export-metric'));
        const includeDirectory = backdrop.querySelector('#cccExportDirectory').checked;
        const includeVendorName = backdrop.querySelector('#cccExportVendorName').checked;
        const includeDetailedAnalysis = backdrop.querySelector('#cccExportDetailedAnalysis').checked;
        try{
          exportVendorObjectiveMatrix({
            rows,
            periodo,
            selectedMetrics,
            includeDirectory,
            includeVendorName,
            includeDetailedAnalysis,
          });
          close();
        }catch(err){
          console.error(err);
          runtimeNotify('error', 'No se pudo generar la exportación: ' + (err?.message || err));
        }
      });
      backdrop.querySelector('.ccc-export-close').focus();
    }

    async function exportRutaPendientesPdf({ rutaNombre, clientes, vendedor, supervisor, lineaInfo, periodo }){
      const pendientes = clientes.filter(c => (Number(c.val) || 0) < lineaInfo.umbral);
      if (!pendientes.length){
        runtimeNotify('info', 'Esta ruta no tiene clientes pendientes: todos cumplieron la cuota.');
        return;
      }

      try{
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const columns = [
          { label: 'Código', x: margin, width: 22 },
          { label: 'Cliente', x: margin + 24, width: 116 },
          { label: 'Actual', x: margin + 142, width: 22 },
          { label: 'Objetivo', x: margin + 166, width: 24 },
          { label: 'Faltan', x: margin + 192, width: 22 },
          { label: 'Estado', x: margin + 216, width: 48 },
        ];
        let y = 14;

        const drawHeader = () => {
          doc.setFillColor(200, 16, 46);
          doc.rect(0, 0, pageWidth, 24, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(15);
          doc.text('REDCOM · CLIENTES PENDIENTES', margin, 10);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(`${lineaInfo.label} · ${rutaNombre}`, margin, 17);
          doc.text(`Supervisor: ${supervisor || 'Sin supervisor'} · Vendedor: ${vendedor?.nombre || ''} (#${vendedor?.codigo ?? ''})`, margin, 21);
          doc.text(`Período: ${periodo || '—'} · Cuota: ${lineaInfo.umbral} unidades`, pageWidth - margin, 21, { align: 'right' });

          y = 30;
          doc.setFillColor(44, 44, 42);
          doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          columns.forEach(col => doc.text(col.label, col.x + 2, y + 5.2));
          y += 8;
        };

        const ensureSpace = (height) => {
          if (y + height <= pageHeight - 12) return;
          doc.addPage();
          drawHeader();
        };

        drawHeader();
        doc.setFont('helvetica', 'normal');
        pendientes.forEach((c, index) => {
          const unidades = Number(c.val) || 0;
          const faltan = Math.max(0, lineaInfo.umbral - unidades);
          const estado = unidades > 0 ? 'En progreso' : 'No compró';
          const clientLines = doc.splitTextToSize(c.nombre || ('Cliente ' + c.cliente), columns[1].width - 4);
          const rowHeight = Math.max(8, clientLines.length * 4 + 3);
          ensureSpace(rowHeight);

          if (index % 2 === 0){
            doc.setFillColor(248, 247, 244);
            doc.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
          }
          doc.setDrawColor(228, 225, 217);
          doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
          doc.setTextColor(44, 44, 42);
          doc.setFontSize(8);
          doc.text(String(c.cliente), columns[0].x + 2, y + 5);
          doc.text(clientLines, columns[1].x + 2, y + 5);
          doc.text(String(unidades), columns[2].x + columns[2].width - 2, y + 5, { align: 'right' });
          doc.text(String(lineaInfo.umbral), columns[3].x + columns[3].width - 2, y + 5, { align: 'right' });
          doc.setTextColor(200, 16, 46);
          doc.setFont('helvetica', 'bold');
          doc.text(String(faltan), columns[4].x + columns[4].width - 2, y + 5, { align: 'right' });
          doc.setTextColor(95, 94, 90);
          doc.setFont('helvetica', 'normal');
          doc.text(estado, columns[5].x + 2, y + 5);
          y += rowHeight;
        });

        const totalPages = doc.getNumberOfPages();
        for (let page = 1; page <= totalPages; page++){
          doc.setPage(page);
          doc.setFontSize(8);
          doc.setTextColor(138, 138, 134);
          doc.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
          doc.text(`${pendientes.length} clientes pendientes`, margin, pageHeight - 6);
        }

        const fileName = `Pendientes_${safeFilePart(rutaNombre)}_${safeFilePart(lineaInfo.label)}.pdf`;
        doc.save(fileName);
        runtimeNotify('success', `PDF generado: ${fileName}`);
      }catch(err){
        console.error(err);
        runtimeNotify('error', 'Ocurrió un error al generar el PDF: ' + (err?.message || err));
      }
    }

    function computeGeneralStats(structure, ventasPorCliente, umbral){
      let totalPadron = 0, logrados = 0;
      Object.values(structure).forEach(supBucket => {
        Object.values(supBucket.vendedores).forEach(v => {
          if (!v.tienePadron) return;
          Object.values(v.rutas).forEach(clienteMap => {
            clienteMap.forEach((nombre, cli) => {
              totalPadron++;
              if ((ventasPorCliente.get(cli)||0) >= umbral) logrados++;
            });
          });
        });
      });
      return { totalPadron, logrados, pendientes: totalPadron - logrados, pct: totalPadron ? (logrados/totalPadron*100) : 0 };
    }
    
    function computeVendedorStats(v, ventasPorCliente, umbral){
      let total = 0, logrados = 0;
      Object.values(v.rutas).forEach(clienteMap => {
        clienteMap.forEach((nombre, cli) => {
          total++;
          if ((ventasPorCliente.get(cli)||0) >= umbral) logrados++;
        });
      });
      return { total, logrados, pct: total ? (logrados/total*100) : 0 };
    }
    
    // Cobertura por sucursal = suma de logrados/total de todos los supervisores (y sus vendedores) de cada sucursal
    function computeSucursalStats(structure, ventasPorCliente, umbral){
      const bySuc = new Map();
      Object.values(structure).forEach(supBucket => {
        Object.values(supBucket.vendedores).forEach(v => {
          if (!v.tienePadron) return;
          if (!bySuc.has(v.sucursal)) bySuc.set(v.sucursal, { sucursal: v.sucursal, total: 0, logrados: 0 });
          const acc = bySuc.get(v.sucursal);
          Object.values(v.rutas).forEach(clienteMap => {
            clienteMap.forEach((nombre, cli) => {
              acc.total++;
              if ((ventasPorCliente.get(cli)||0) >= umbral) acc.logrados++;
            });
          });
        });
      });
      return Array.from(bySuc.values())
        .map(r => ({ ...r, pct: r.total ? (r.logrados/r.total*100) : 0 }))
        .sort((a,b) => b.total - a.total);
    }
    
    function setDashboardEmptyState(areaId, title, description){
      const area = document.getElementById(areaId);
      if (!area) return;
      area.innerHTML = `
        <div class="report-empty">
          <div class="report-empty-icon">▦</div>
          <h2>${title}</h2>
          <p>${description}</p>
        </div>`;
    }
    function setMixEmptyState(){
      const area = document.getElementById('mixReportArea');
      if (!area) return;
      area.innerHTML = `
        <div class="report-empty">
          <div class="report-empty-icon">▦</div>
          <h2>Importá los archivos para generar el dashboard</h2>
          <p>El análisis de MIX utiliza el mismo archivo de ventas y conserva el resultado al navegar entre pestañas.</p>
        </div>`;
    }

    function qtyTableHTML(qtyMap, artLabels){
      if (!qtyMap || qtyMap.size === 0){
        return '<div style="font-size:12px;color:var(--grayL);padding:6px 0;">Sin unidades registradas.</div>';
      }
      const rows = [...qtyMap.entries()].sort((a,b) => b[1] - a[1]);
      return `<table class="qty-mini-table">
        <thead><tr><th>Artículo</th><th class="num">Cantidad c/cargo</th></tr></thead>
        <tbody>${rows.map(([key, quantity]) => `<tr><td>${artLabels.get(key) || key}</td><td class="num">${Math.round(quantity).toLocaleString('es-AR')}</td></tr>`).join('')}</tbody>
      </table>`;
    }

    function clientRowHTMLMix(cliente, nombre, compradosSet, universo, artLabels, qtyMap){
      const compradosEnUniverso = [...compradosSet].filter(article => universo.has(article));
      const logrados = compradosEnUniverso.length;
      const total = universo.size;
      const pct = total ? Math.max(2, Math.min(100, (logrados / total) * 100)) : 0;
      const faltantesKeys = [...universo].filter(article => !compradosSet.has(article));
      const completo = total > 0 && logrados >= total;
      const quantities = qtyMap || new Map();
      const compradosOrdenados = [...compradosEnUniverso].sort(
        (a,b) => (quantities.get(b) || 0) - (quantities.get(a) || 0),
      );
      const compradosTxt = compradosOrdenados.length
        ? compradosOrdenados.map(article => `${artLabels.get(article) || article} (${Math.round(quantities.get(article) || 0).toLocaleString('es-AR')})`).join(', ')
        : 'No compró ningún artículo del mix este período.';
      const faltantesTxt = faltantesKeys.length
        ? faltantesKeys.map(article => artLabels.get(article) || article).join(', ')
        : 'Compró todos los artículos del mix de la sucursal.';

      return `<tr class="clickable-row ${completo ? 'row-cumplido' : ''}">
        <td>${nombre} <span class="cli-code">#${cliente}</span></td>
        <td class="actual mix">${logrados}/${total}</td>
        <td class="bar-cell"><div class="bar-track"><div class="bar-fill ${completo ? 'cumplido' : 'mix'}" style="width:${pct}%"></div></div></td>
        <td class="${completo ? 'cumplido-tag' : 'falta'}">${completo ? '✓ Mix completo' : (total - logrados) + ' (ver detalle ▾)'}</td>
      </tr>
      <tr class="detail-row"><td colspan="4"><div class="mix-detail">
        <div class="mix-detail-col"><b>Compró (${logrados})</b>${compradosTxt}</div>
        <div class="mix-detail-col faltan"><b>No compró (${faltantesKeys.length})</b>${faltantesTxt}</div>
      </div></td></tr>`;
    }

    function computeVendedorMixStats(vendedor, articulosPorCliente, articulosPorSucursal){
      const universo = articulosPorSucursal.get(vendedor.sucursal) || new Set();
      const unionSet = new Set();
      Object.values(vendedor.rutas).forEach(clienteMap => {
        clienteMap.forEach((nombre, cliente) => {
          const articles = articulosPorCliente.get(cliente);
          if (articles) articles.forEach(article => unionSet.add(article));
        });
      });
      const logrados = [...unionSet].filter(article => universo.has(article)).length;
      const total = universo.size;
      return { total, logrados, pct: total ? (logrados / total * 100) : 0, unionSet };
    }

    function computeGeneralMixStats(structure, articulosPorCliente, articulosPorSucursal){
      let totalSum = 0;
      let logradosSum = 0;
      let clientesConDatos = 0;
      Object.values(structure).forEach(supBucket => {
        Object.values(supBucket.vendedores).forEach(vendedor => {
          if (!vendedor.tienePadron) return;
          const universo = articulosPorSucursal.get(vendedor.sucursal) || new Set();
          Object.values(vendedor.rutas).forEach(clienteMap => {
            clienteMap.forEach((nombre, cliente) => {
              const comprados = articulosPorCliente.get(cliente) || new Set();
              logradosSum += [...comprados].filter(article => universo.has(article)).length;
              totalSum += universo.size;
              clientesConDatos++;
            });
          });
        });
      });
      return { pct: totalSum ? (logradosSum / totalSum * 100) : 0, clientesConDatos };
    }

    function computeSucursalMixStats(structure, articulosPorCliente, articulosPorSucursal){
      const byBranch = new Map();
      Object.values(structure).forEach(supBucket => {
        Object.values(supBucket.vendedores).forEach(vendedor => {
          if (!vendedor.tienePadron) return;
          if (!byBranch.has(vendedor.sucursal)){
            byBranch.set(vendedor.sucursal, { sucursal: vendedor.sucursal, totalSum: 0, logradosSum: 0 });
          }
          const acc = byBranch.get(vendedor.sucursal);
          const universo = articulosPorSucursal.get(vendedor.sucursal) || new Set();
          Object.values(vendedor.rutas).forEach(clienteMap => {
            clienteMap.forEach((nombre, cliente) => {
              const comprados = articulosPorCliente.get(cliente) || new Set();
              acc.totalSum += universo.size;
              acc.logradosSum += [...comprados].filter(article => universo.has(article)).length;
            });
          });
        });
      });
      return Array.from(byBranch.values())
        .map(row => ({
          sucursal: row.sucursal,
          articulosDistintos: (articulosPorSucursal.get(row.sucursal) || new Set()).size,
          pct: row.totalSum ? (row.logradosSum / row.totalSum * 100) : 0,
        }))
        .sort((a,b) => b.articulosDistintos - a.articulosDistintos);
    }

    function bindMixInteractions(area){
      area.querySelectorAll('[data-qty-target]').forEach(button => {
        button.addEventListener('click', event => {
          event.stopPropagation();
          const targetId = button.getAttribute('data-qty-target');
          if (targetId) document.getElementById(targetId)?.classList.toggle('open');
        });
      });
      area.querySelectorAll('tr.clickable-row').forEach(row => {
        row.addEventListener('click', () => row.nextElementSibling?.classList.toggle('open'));
      });
    }

    function renderMixReport({
      rows,
      periodo,
      lineasDetectadas,
      lineaCode,
      lineaInfo,
      structure,
      articulosPorCliente,
      articulosPorSucursal,
      artLabels,
      cantidadPorArticuloCliente,
      cantidadPorArticuloSucursal,
    }){
      const area = document.getElementById('mixReportArea');
      if (!area) return;
      area.innerHTML = '';

      const controls = document.createElement('div');
      controls.className = 'mix-line-controls';
      controls.innerHTML = `
        <div class="linea-selector-panel">
          <label for="mixLineaObjetivoSelect">Línea objetivo</label>
          <select id="mixLineaObjetivoSelect">
            ${Object.entries(LINEAS).map(([code, info]) => `
              <option value="${code}" ${code === lineaCode ? 'selected' : ''}>${info.label} · mix de artículos</option>
            `).join('')}
          </select>
        </div>
        <div class="linea-badge ${lineaInfo.cls}">Línea seleccionada: ${lineaInfo.label} · Mix de artículos del período</div>`;
      area.appendChild(controls);
      controls.querySelector('select').addEventListener('change', event => {
        renderReport(lastReportData?.rows || rows, periodo, lineasDetectadas, event.target.value);
      });

      if (!lineasDetectadas.includes(lineaCode)){
        const info = document.createElement('div');
        info.style.cssText = 'background:#F2F7FB;border:1px solid #D6E3EE;border-radius:8px;padding:10px 14px;font-size:12.5px;color:#0C5E9D;margin-bottom:14px;';
        info.textContent = `No se detectaron movimientos de ${lineaInfo.label} en el archivo. El universo de artículos se muestra vacío para esta línea.`;
        area.appendChild(info);
      }

      const generalMix = computeGeneralMixStats(structure, articulosPorCliente, articulosPorSucursal);
      const totalArticulosGlobal = new Set();
      articulosPorSucursal.forEach(set => set.forEach(article => totalArticulosGlobal.add(article)));
      const kpiWrap = document.createElement('div');
      kpiWrap.className = 'kpi-summary';
      kpiWrap.innerHTML = `
        <div class="kpi-card" style="--kc:var(--dark)">
          <div class="k-label">% Cobertura de Mix promedio</div>
          <div class="k-value">${generalMix.pct.toFixed(1)}%</div>
          <div class="k-sub">promedio ponderado por cliente, vs. el universo de su sucursal</div>
        </div>
        <div class="kpi-card" style="--kc:var(--gray)">
          <div class="k-label">Artículos distintos vendidos</div>
          <div class="k-value">${totalArticulosGlobal.size.toLocaleString('es-AR')}</div>
          <div class="k-sub">en todas las sucursales del archivo, este período</div>
        </div>
        <div class="kpi-card" style="--kc:var(--green)">
          <div class="k-label">Sucursales con datos</div>
          <div class="k-value">${articulosPorSucursal.size.toLocaleString('es-AR')}</div>
          <div class="k-sub">cada una con su propio universo de artículos</div>
        </div>
        <div class="kpi-card" style="--kc:var(--red)">
          <div class="k-label">Clientes con compra evaluados</div>
          <div class="k-value">${generalMix.clientesConDatos.toLocaleString('es-AR')}</div>
          <div class="k-sub">clientes de padrón activo comparados contra su universo</div>
        </div>`;
      area.appendChild(kpiWrap);

      const sucursalMix = computeSucursalMixStats(structure, articulosPorCliente, articulosPorSucursal);
      if (sucursalMix.length){
        const branchWrap = document.createElement('div');
        branchWrap.className = 'sup-card';
        branchWrap.style.marginBottom = '18px';
        branchWrap.innerHTML = `
          <div class="sup-head" style="cursor:default;">
            <div class="sup-title"><h3>Mix por Sucursal</h3><span class="badge-n">${sucursalMix.length} sucursal(es)</span></div>
          </div>
          <div style="padding:2px 20px 16px;overflow-x:auto;">
            <table class="sup-mini-table">
              <thead><tr><th>Sucursal</th><th class="num">Artículos distintos vendidos</th><th class="num">% Cobertura promedio</th><th></th></tr></thead>
              <tbody>
                ${sucursalMix.map((branch, index) => {
                  const qtyId = `mixQtyBranch_${index}`;
                  return `<tr>
                    <td>${branch.sucursal}</td>
                    <td class="num">${branch.articulosDistintos.toLocaleString('es-AR')}</td>
                    <td class="num" style="font-weight:700;">${branch.pct.toFixed(1)}%</td>
                    <td class="num"><button class="qty-toggle" type="button" data-qty-target="${qtyId}">📊 Unidades por artículo</button></td>
                  </tr>
                  <tr><td colspan="4" style="padding:0;"><div class="qty-panel" id="${qtyId}" style="padding:6px 10px 14px;">
                    ${qtyTableHTML(cantidadPorArticuloSucursal.get(branch.sucursal), artLabels)}
                  </div></td></tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`;
        area.appendChild(branchWrap);
      }

      const legend = document.createElement('div');
      legend.className = 'legend';
      legend.innerHTML = `<div>
        El universo de referencia de cada sucursal es el total de artículos distintos vendidos en esa sucursal durante el período del archivo cargado (no requiere una lista adicional).
        Cliente: artículos distintos que compró sobre ese universo. Vendedor y Supervisor: unión de artículos distintos comprados por todos sus clientes, sobre el mismo universo.
        Hacé clic en una fila de cliente para ver el detalle de qué artículos compró (con cantidad) y cuáles le faltan. El botón "Unidades por artículo" muestra, en cada nivel, la cantidad con cargo vendida de cada artículo.
        Los vendedores sin supervisor asignado se agrupan aparte, al final. Clientes cuyo vendedor no figura en el listado no se incluyen en el reporte.
      </div>`;
      area.appendChild(legend);

      const supervisorNames = Object.keys(structure).filter(name => name !== '__SIN_SUPERVISOR__').sort();
      const hasNoSupervisor = Boolean(structure['__SIN_SUPERVISOR__']);
      const toolbar = document.createElement('div');
      toolbar.className = 'toolbar';
      toolbar.innerHTML = `<div>
          <div class="title">Detalle por Supervisor — Mix de Artículos</div>
          <div class="subtitle">${supervisorNames.length} supervisores${hasNoSupervisor ? ' + vendedores sin supervisor asignado' : ''}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="ghost" type="button" id="btnExpandAllMix">Expandir todo</button>
          <button class="ghost" type="button" id="btnCollapseAllMix">Colapsar todo</button>
        </div>`;
      area.appendChild(toolbar);

      let qtyPanelCounter = 0;
      function buildSupervisorCard(supervisorName, supervisorBucket, isNoSupervisor){
        const vendedores = Object.values(supervisorBucket.vendedores);
        const supervisorUniverse = new Set();
        const supervisorUnion = new Set();
        const supervisorQty = new Map();

        const vendorData = vendedores.map(vendedor => {
          const vendorMix = computeVendedorMixStats(vendedor, articulosPorCliente, articulosPorSucursal);
          if (vendedor.tienePadron){
            (articulosPorSucursal.get(vendedor.sucursal) || new Set()).forEach(article => supervisorUniverse.add(article));
            vendorMix.unionSet.forEach(article => supervisorUnion.add(article));
          }

          const vendorQty = new Map();
          const routeData = Object.entries(vendedor.rutas).map(([routeName, clientMap]) => {
            const universe = articulosPorSucursal.get(vendedor.sucursal) || new Set();
            const routeQty = new Map();
            const clientes = Array.from(clientMap.entries()).map(([cliente, nombre]) => {
              const comprados = articulosPorCliente.get(cliente) || new Set();
              const logrados = [...comprados].filter(article => universe.has(article)).length;
              const clientQty = cantidadPorArticuloCliente.get(cliente) || new Map();
              clientQty.forEach((quantity, article) => routeQty.set(article, (routeQty.get(article) || 0) + quantity));
              return { cliente, nombre, comprados, logrados, total: universe.size, clientQty };
            }).sort((a,b) => b.logrados - a.logrados);

            routeQty.forEach((quantity, article) => vendorQty.set(article, (vendorQty.get(article) || 0) + quantity));
            const pendientesCount = clientes.filter(cliente => cliente.total > 0 && cliente.logrados < cliente.total).length;
            return { routeName, clientes, pendientesCount, universe, routeQty };
          }).filter(route => route.clientes.length > 0)
            .sort((a,b) => a.routeName.localeCompare(b.routeName));

          vendorQty.forEach((quantity, article) => supervisorQty.set(article, (supervisorQty.get(article) || 0) + quantity));
          const pendingClients = routeData.reduce((total, route) => total + route.pendientesCount, 0);
          const totalClients = routeData.reduce((total, route) => total + route.clientes.length, 0);
          return { vendedor, vendorMix, routeData, pendingClients, totalClients, vendorQty };
        }).filter(row => row.routeData.length > 0)
          .sort((a,b) => a.vendedor.nombre.localeCompare(b.vendedor.nombre));

        if (!vendorData.length) return null;
        const supervisorAchieved = [...supervisorUnion].filter(article => supervisorUniverse.has(article)).length;
        const supervisorPct = supervisorUniverse.size ? (supervisorAchieved / supervisorUniverse.size * 100) : 0;
        const supervisorQtyId = `mixQty_${qtyPanelCounter++}`;
        const card = document.createElement('div');
        card.className = 'sup-card' + (isNoSupervisor ? ' no-sup' : '');
        card.innerHTML = `
          <div class="sup-head">
            <div class="sup-title">
              <span class="arrow">▶</span>
              <h3>${isNoSupervisor ? '⚠ Sin supervisor asignado' : supervisorName}</h3>
              <span class="badge-n">${vendorData.length} vendedores</span>
            </div>
            <div class="sup-metric-row">
              <button class="qty-toggle" type="button" data-qty-target="${supervisorQtyId}">📊 Unidades por artículo</button>
              <div class="sup-metric">
                <span class="lbl">Mix (${supervisorAchieved}/${supervisorUniverse.size})</span>
                <span class="val">${supervisorPct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div class="qty-panel" id="${supervisorQtyId}">${qtyTableHTML(supervisorQty, artLabels)}</div>
          <div class="sup-body"></div>`;

        const supervisorBody = card.querySelector('.sup-body');
        vendorData.forEach(({ vendedor, vendorMix, routeData, pendingClients, totalClients, vendorQty }) => {
          const vendorCard = document.createElement('div');
          vendorCard.className = 'vend-card';
          const withoutPadron = vendedor.tienePadron ? '' : ' <span style="color:var(--amber);font-weight:700;">(sin padrón)</span>';
          const coverage = vendedor.tienePadron ? ` · ${vendorMix.pct.toFixed(1)}% mix (${vendorMix.logrados}/${vendorMix.total})` : '';
          const vendorQtyId = `mixQty_${qtyPanelCounter++}`;
          vendorCard.innerHTML = `
            <div class="vend-head">
              <div class="vend-title">
                <span class="arrow">▶</span>
                <h4>${vendedor.nombre}${withoutPadron} <span style="color:var(--grayL);font-weight:400;">(#${vendedor.codigo})</span></h4>
                <span class="badge-n">${routeData.length} rutas · ${totalClients} clientes · ${pendingClients} con mix incompleto${coverage}</span>
              </div>
              <button class="qty-toggle" type="button" data-qty-target="${vendorQtyId}">📊 Unidades por artículo</button>
            </div>
            <div class="qty-panel" id="${vendorQtyId}">${qtyTableHTML(vendorQty, artLabels)}</div>
            <div class="vend-body"></div>`;

          const vendorBody = vendorCard.querySelector('.vend-body');
          routeData.forEach(({ routeName, clientes, pendientesCount, universe, routeQty }) => {
            const routeCard = document.createElement('div');
            routeCard.className = 'ruta-card';
            const routeQtyId = `mixQty_${qtyPanelCounter++}`;
            routeCard.innerHTML = `
              <div class="ruta-head">
                <div class="ruta-title">
                  <span class="arrow">▶</span>
                  <h5>${routeName}</h5>
                  <span class="badge-n">${clientes.length} clientes · ${pendientesCount} con mix incompleto</span>
                </div>
                <button class="qty-toggle" type="button" data-qty-target="${routeQtyId}">📊 Unidades por artículo</button>
              </div>
              <div class="qty-panel" id="${routeQtyId}">${qtyTableHTML(routeQty, artLabels)}</div>
              <div class="ruta-body"></div>`;

            const routeBody = routeCard.querySelector('.ruta-body');
            routeBody.innerHTML = `<table class="cli-table">
              <thead><tr><th>Cliente</th><th>Artículos comprados</th><th>Progreso</th><th>Faltantes</th></tr></thead>
              <tbody>${clientes.map(cliente => clientRowHTMLMix(
                cliente.cliente,
                cliente.nombre,
                cliente.comprados,
                universe,
                artLabels,
                cliente.clientQty,
              )).join('')}</tbody>
            </table>`;
            routeCard.querySelector('.ruta-head').addEventListener('click', () => routeCard.classList.toggle('open'));
            vendorBody.appendChild(routeCard);
          });

          vendorCard.querySelector('.vend-head').addEventListener('click', () => vendorCard.classList.toggle('open'));
          supervisorBody.appendChild(vendorCard);
        });

        card.querySelector('.sup-head').addEventListener('click', () => card.classList.toggle('open'));
        return card;
      }

      supervisorNames.forEach(supervisorName => {
        const card = buildSupervisorCard(supervisorName, structure[supervisorName], false);
        if (card) area.appendChild(card);
      });
      if (hasNoSupervisor){
        const card = buildSupervisorCard(null, structure['__SIN_SUPERVISOR__'], true);
        if (card) area.appendChild(card);
      }

      if (area.querySelectorAll('.sup-card').length === 0){
        const empty = document.createElement('div');
        empty.className = 'report-empty';
        empty.innerHTML = '<div class="report-empty-icon">▦</div><h2>Sin datos de mix</h2><p>No se encontraron artículos para la línea seleccionada.</p>';
        area.appendChild(empty);
      }

      bindMixInteractions(area);
      area.querySelector('#btnExpandAllMix')?.addEventListener('click', () => {
        area.querySelectorAll('.sup-card, .vend-card, .ruta-card').forEach(card => card.classList.add('open'));
      });
      area.querySelector('#btnCollapseAllMix')?.addEventListener('click', () => {
        area.querySelectorAll('.sup-card, .vend-card, .ruta-card').forEach(card => card.classList.remove('open'));
      });
      const first = Array.from(area.querySelectorAll('.sup-card')).find(card => card.querySelector('.sup-body'));
      if (first) first.classList.add('open');
    }

    function renderReport(rows, periodo, lineasDetectadas, selectedLineaCode){
      const area = document.getElementById('reportArea');
      area.innerHTML = '';
      // "Datos actualizados al" = fecha del día en que se importó/procesó el archivo, no el período del archivo
      document.getElementById('updatedDate').textContent = formatFecha(new Date());
      document.getElementById('updatedBadge').style.display = 'flex';
    
      const lineaCode = selectedLineaCode && LINEAS[selectedLineaCode]
        ? selectedLineaCode
        : (lineasDetectadas[0] || Object.keys(LINEAS)[0]);
      const lineaInfo = LINEAS[lineaCode];
      if (lastReportData) lastReportData.selectedLineaCode = lineaCode;
      const analysisRows = lastReportData?.rowsByLine?.[lineaCode] ?? rows.filter(r => r.linea === lineaCode);
    
      // Selector disponible luego de procesar, sin necesidad de volver a leer el Excel.
      const selectorPanel = document.createElement('div');
      selectorPanel.className = 'linea-selector-panel';
      selectorPanel.innerHTML = `
        <label for="lineaObjetivoSelect">Línea objetivo</label>
        <select id="lineaObjetivoSelect">
          ${Object.entries(LINEAS).map(([code, info]) => `
            <option value="${code}" ${code === lineaCode ? 'selected' : ''}>${info.label} · cuota ${info.umbral}</option>
          `).join('')}
        </select>`;
      area.appendChild(selectorPanel);
      selectorPanel.querySelector('select').addEventListener('change', e => {
        renderReport(lastReportData?.rows || rows, periodo, lineasDetectadas, e.target.value);
      });
    
      const lineaBadge = document.createElement('div');
      lineaBadge.className = 'linea-badge ' + lineaInfo.cls;
      lineaBadge.textContent = `Línea seleccionada: ${lineaInfo.label} · Cuota mínima mensual: ${lineaInfo.umbral} unidades`;
      area.appendChild(lineaBadge);
    
      if (!lineasDetectadas.includes(lineaCode)){
        const info = document.createElement('div');
        info.style.cssText = 'background:#F2F7FB;border:1px solid #D6E3EE;border-radius:8px;padding:10px 14px;font-size:12.5px;color:#0C5E9D;margin-bottom:14px;';
        info.textContent = `No se detectaron movimientos de ${lineaInfo.label} en el archivo. El padrón se muestra con 0 unidades para esta línea.`;
        area.appendChild(info);
      } else if (lineasDetectadas.length > 1){
        const warn = document.createElement('div');
        warn.style.cssText = 'background:#FFF3CD;border:1px solid #E0A526;border-radius:8px;padding:10px 14px;font-size:12.5px;color:#8A6300;margin-bottom:14px;';
        warn.textContent = 'El archivo contiene más de una línea objetivo (' + lineasDetectadas.join(', ') + '). Podés alternar el análisis desde el selector. Se muestra ' + lineaInfo.label + '.';
        area.appendChild(warn);
      }
    
      const umbral = lineaInfo.umbral, cls = lineaInfo.cls;
      const {
        supervisores: structure,
        ventasPorCliente,
        articulosPorCliente,
        articulosPorSucursal,
        artLabels,
        cantidadPorArticuloCliente,
        cantidadPorArticuloSucursal,
      } = aggregate(analysisRows, lineaCode);
    
      // ---- KPI general ----
      const general = computeGeneralStats(structure, ventasPorCliente, umbral);
      const kpiWrap = document.createElement('div');
      kpiWrap.className = 'kpi-summary';
      kpiWrap.innerHTML = `
        <div class="kpi-card" style="--kc:var(--${cls})">
          <div class="k-label">% Cumplimiento general</div>
          <div class="k-value">${general.pct.toFixed(1)}%</div>
          <div class="k-sub">sobre padrón activo asignado</div>
        </div>
        <div class="kpi-card" style="--kc:var(--green)">
          <div class="k-label">Clientes que cumplieron</div>
          <div class="k-value">${general.logrados.toLocaleString('es-AR')}</div>
          <div class="k-sub">≥ ${umbral} unidades en el período</div>
        </div>
        <div class="kpi-card" style="--kc:var(--red)">
          <div class="k-label">Clientes por alcanzar</div>
          <div class="k-value">${general.pendientes.toLocaleString('es-AR')}</div>
          <div class="k-sub">con o sin compra en el período</div>
        </div>
        <div class="kpi-card" style="--kc:var(--gray)">
          <div class="k-label">Total padrón activo</div>
          <div class="k-value">${general.totalPadron.toLocaleString('es-AR')}</div>
          <div class="k-sub">clientes asignados a vendedores con padrón cargado</div>
        </div>
      `;
      area.appendChild(kpiWrap);
    
      // ---- Cobertura por sucursal (suma de todos los supervisores de cada sucursal) ----
      const sucursalStats = computeSucursalStats(structure, ventasPorCliente, umbral);
      if (sucursalStats.length){
        const sucWrap = document.createElement('div');
        sucWrap.className = 'sup-card';
        sucWrap.style.marginBottom = '18px';
        sucWrap.innerHTML = `
          <div class="sup-head" style="cursor:default;">
            <div class="sup-title"><h3>Cobertura por Sucursal</h3><span class="badge-n">${sucursalStats.length} sucursal(es)</span></div>
          </div>
          <div style="padding:2px 20px 16px;">
            <table class="sup-mini-table">
              <thead><tr><th>Sucursal</th><th class="num">Clientes que cumplieron</th><th class="num">Total padrón</th><th class="num">% Cobertura</th></tr></thead>
              <tbody>
                ${sucursalStats.map(s => `<tr>
                  <td>${s.sucursal}</td>
                  <td class="num">${s.logrados.toLocaleString('es-AR')}</td>
                  <td class="num">${s.total.toLocaleString('es-AR')}</td>
                  <td class="num" style="font-weight:700;color:var(--${cls==='quento'?'quento':'heroe'})">${s.pct.toFixed(1)}%</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        `;
        area.appendChild(sucWrap);
      }
    
      const legend = document.createElement('div');
      legend.className = 'legend';
      legend.innerHTML = `<div>
        Se listan <b>todos</b> los clientes del padrón activo de cada ruta (con o sin compra), ordenados de mayor a menor cantidad comprada de ${lineaInfo.label} en el período.
        Unidades = bultos comprados × unidades por caja (extraído de la descripción del artículo), redondeado al entero más cercano.
        Los que ya alcanzaron las ${lineaInfo.umbral} unidades de cuota mínima mensual se marcan con <span style="color:var(--green);font-weight:700;">✓ Cumplió</span>; el resto muestra cuánto les falta.
        Vendedores marcados "(sin padrón)" no tienen padrón cargado — se muestran solo los clientes que aparecen en la base transaccional.
        Los vendedores sin supervisor asignado se agrupan aparte, al final. Clientes cuyo vendedor no figura en el listado no se incluyen en el reporte.
        Las exportaciones a Excel y PDF de cada ruta incluyen únicamente clientes pendientes: se excluyen automáticamente quienes ya cumplieron la cuota.
      </div>`;
      area.appendChild(legend);
    
      // separar supervisores reales de "sin supervisor"
      const supNames = Object.keys(structure).filter(s => s !== '__SIN_SUPERVISOR__').sort();
      const hasNoSup = !!structure['__SIN_SUPERVISOR__'];
      const toolbar = document.createElement('div');
      toolbar.className = 'toolbar';
      toolbar.innerHTML = `<div>
          <div class="title">Detalle por Supervisor</div>
          <div class="subtitle">${supNames.length} supervisores${hasNoSup ? ' + vendedores sin supervisor asignado' : ''}</div>
        </div>
        <div class="ccc-toolbar-actions">
          <button class="ccc-export-matrix-button" type="button" id="btnExportVendorMatrix">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9H8"/>
            </svg>
            Exportar Excel
          </button>
          <button class="ghost" type="button" id="btnExpandAll">Expandir todo</button>
          <button class="ghost" type="button" id="btnCollapseAll">Colapsar todo</button>
        </div>`;
      area.appendChild(toolbar);
    
      function buildSupCard(supName, supBucket, isNoSup){
        const vendedores = Object.values(supBucket.vendedores);
        let supTotalPadron = 0, supLogrados = 0;
        const vendData = vendedores.map(v => {
          const vStats = computeVendedorStats(v, ventasPorCliente, umbral);
          if (v.tienePadron){ supTotalPadron += vStats.total; supLogrados += vStats.logrados; }
          const rutasData = Object.entries(v.rutas).map(([rutaNombre, clienteSet]) => {
            const clientes = rutaClientesTodos(clienteSet, ventasPorCliente);
            const pendientesCount = clientes.filter(c => c.val < umbral).length;
            const chipStats = computeChipStats(clientes, umbral);
            return { rutaNombre, clientes, pendientesCount, chipStats };
          }).filter(rd => rd.clientes.length > 0)
            .sort((a,b) => a.rutaNombre.localeCompare(b.rutaNombre));
          const vendPendientes = rutasData.reduce((acc, rd) => acc + rd.pendientesCount, 0);
          const vendTotalClientes = rutasData.reduce((acc, rd) => acc + rd.clientes.length, 0);
          const chipStats = sumChipStats(rutasData.map(rd => rd.chipStats));
          return { v, vStats, rutasData, vendPendientes, vendTotalClientes, chipStats };
        }).filter(d => d.rutasData.length > 0)
          .sort((a,b) => a.v.nombre.localeCompare(b.v.nombre));
        if (!vendData.length) return null; // sin clientes en este supervisor
    
        const supPct = supTotalPadron ? (supLogrados/supTotalPadron*100) : 0;
        const supChipStats = sumChipStats(vendData.map(d => d.chipStats));
        const supCard = document.createElement('div');
        supCard.className = 'sup-card' + (isNoSup ? ' no-sup' : '');
        supCard.innerHTML = `
          <div class="sup-head">
            <div class="sup-title">
              <span class="arrow">▶</span>
              <h3>${isNoSup ? '⚠ Sin supervisor asignado' : supName}</h3>
              <span class="badge-n">${vendData.length} vendedores</span>
            </div>
            <div class="head-summary">
              ${metricChipsHTML(supChipStats)}
              <div class="sup-metric">
                <span class="lbl">Cobertura (${supLogrados}/${supTotalPadron})</span>
                <span class="val" style="color:var(--${cls==='quento'?'quento':'heroe'})">${supPct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div class="sup-body"></div>
        `;
        const supBody = supCard.querySelector('.sup-body');
        vendData.forEach(({v, vStats, rutasData, vendPendientes, vendTotalClientes, chipStats}) => {
          const vendCard = document.createElement('div');
          vendCard.className = 'vend-card';
          const sinPadronTag = v.tienePadron ? '' : ' <span style="color:var(--amber);font-weight:700;">(sin padrón)</span>';
          const coverageTxt = v.tienePadron ? ` · ${vStats.pct.toFixed(1)}% cobertura (${vStats.logrados}/${vStats.total})` : '';
          vendCard.innerHTML = `
            <div class="vend-head">
              <div class="vend-title">
                <span class="arrow">▶</span>
                <h4>${v.nombre}${sinPadronTag} <span style="color:var(--grayL);font-weight:400;">(#${v.codigo})</span></h4>
              </div>
              ${metricChipsHTML(chipStats)}
            </div>
            <div class="vend-body"></div>
          `;
          const vendBody = vendCard.querySelector('.vend-body');
          rutasData.forEach(({rutaNombre, clientes, pendientesCount, chipStats: rutaChipStats}) => {
            const rutaCard = document.createElement('div');
            rutaCard.className = 'ruta-card';
            rutaCard.innerHTML = `
              <div class="ruta-head">
                <div class="ruta-title">
                  <span class="arrow">▶</span>
                  <h5>${rutaNombre}</h5>
                </div>
                <div class="route-actions">
                  ${metricChipsHTML(rutaChipStats)}
                  <button class="export-excel" type="button" ${pendientesCount === 0 ? 'disabled' : ''}
                    aria-label="Exportar clientes pendientes a Excel"
                    title="Exportar ${pendientesCount} clientes pendientes a Excel">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9H8"/>
                    </svg>
                  </button>
                  <button class="export-pdf" type="button" ${pendientesCount === 0 ? 'disabled' : ''}
                    aria-label="Exportar clientes pendientes a PDF"
                    title="Exportar ${pendientesCount} clientes pendientes a PDF">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <path d="M14 2v6h6"/><path d="M8 13h2.2a2 2 0 0 1 0 4H8v-6"/><path d="M14 17v-6h2.2a2 2 0 0 1 0 4H14"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="ruta-body"></div>
            `;
            const rutaBody = rutaCard.querySelector('.ruta-body');
            rutaBody.innerHTML = `<table class="cli-table">
              <thead><tr>
                <th>Cliente</th><th>Unidades actuales</th><th>Progreso</th><th>Faltan</th>
              </tr></thead>
              <tbody>${clientes.map(c => clientRowHTML(c.cliente, c.nombre, c.val, umbral, cls)).join('')}</tbody>
            </table>`;
    
            const exportBtn = rutaCard.querySelector('.export-excel');
            exportBtn.addEventListener('click', async e => {
              e.stopPropagation();
              if (exportBtn.disabled) return;
              const originalHtml = exportBtn.innerHTML;
              exportBtn.disabled = true;
              exportBtn.innerHTML = '<svg class="export-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>';
              try{
                await exportRutaPendientes({
                  rutaNombre,
                  clientes,
                  vendedor: v,
                  supervisor: isNoSup ? 'Sin supervisor asignado' : supName,
                  lineaInfo,
                  periodo,
                });
              }finally{
                exportBtn.disabled = false;
                exportBtn.innerHTML = originalHtml;
              }
            });
            const pdfBtn = rutaCard.querySelector('.export-pdf');
            pdfBtn.addEventListener('click', async e => {
              e.stopPropagation();
              if (pdfBtn.disabled) return;
              const originalHtml = pdfBtn.innerHTML;
              pdfBtn.disabled = true;
              pdfBtn.innerHTML = '<svg class="export-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>';
              try{
                await exportRutaPendientesPdf({
                  rutaNombre,
                  clientes,
                  vendedor: v,
                  supervisor: isNoSup ? 'Sin supervisor asignado' : supName,
                  lineaInfo,
                  periodo,
                });
              }finally{
                pdfBtn.disabled = false;
                pdfBtn.innerHTML = originalHtml;
              }
            });
            rutaCard.querySelector('.ruta-head').addEventListener('click', () => rutaCard.classList.toggle('open'));
            vendBody.appendChild(rutaCard);
          });
          vendCard.querySelector('.vend-head').addEventListener('click', () => vendCard.classList.toggle('open'));
          supBody.appendChild(vendCard);
        });
        supCard.querySelector('.sup-head').addEventListener('click', () => supCard.classList.toggle('open'));
        return supCard;
      }
    
      supNames.forEach(supName => {
        const card = buildSupCard(supName, structure[supName], false);
        if (card) area.appendChild(card);
      });
      if (hasNoSup){
        const card = buildSupCard(null, structure['__SIN_SUPERVISOR__'], true);
        if (card) area.appendChild(card);
      }
      if (area.querySelectorAll('.sup-card').length === 0){
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:50px 20px;color:var(--grayL);';
        empty.textContent = 'No hay clientes para mostrar en la línea seleccionada.';
        area.appendChild(empty);
      }
      document.getElementById('btnExportVendorMatrix').addEventListener('click', () => {
        openVendorMatrixExportModal({ area, rows: analysisRows, periodo });
      });
      document.getElementById('btnExpandAll').addEventListener('click', () => {
        area.querySelectorAll('.sup-card, .vend-card, .ruta-card').forEach(c => c.classList.add('open'));
      });
      document.getElementById('btnCollapseAll').addEventListener('click', () => {
        area.querySelectorAll('.sup-card, .vend-card, .ruta-card').forEach(c => c.classList.remove('open'));
      });
      const firstDetail = Array.from(area.querySelectorAll('.sup-card')).find(c => c.querySelector('.sup-body'));
      if (firstDetail) firstDetail.classList.add('open');

      renderMixReport({
        rows: analysisRows,
        periodo,
        lineasDetectadas,
        lineaCode,
        lineaInfo,
        structure,
        articulosPorCliente,
        articulosPorSucursal,
        artLabels,
        cantidadPorArticuloCliente,
        cantidadPorArticuloSucursal,
      });
    }
  } finally {
    EventTarget.prototype.addEventListener = nativeAddEventListener;
  }

  return () => {
    registeredListeners.forEach(([target, type, listener, options]) => {
      nativeRemoveEventListener.call(target, type, listener, options);
    });
  };
}
