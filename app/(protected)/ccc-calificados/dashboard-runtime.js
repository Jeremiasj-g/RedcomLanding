export function initClientesCalificadosDashboard(options = {}){
  const {
    hasStoredPadron = () => false,
    getSelectedBranch = () => '',
    getSelectedSucursalName = () => '',
    getSelectedBranchLabel = () => '',
    resolvePadronFile = async () => null,
  } = options;
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
    
    /* ============================================================
       DATOS POR DEFECTO — Listado Vendedor-Supervisor (precargado)
    ============================================================ */
    let LISTADO = [{"sucursal": "CASA CENTRAL", "codigo": 1, "nombre": "MATIAS VILLORDO", "supervisor": "MANUEL ANDRIAN"}, {"sucursal": "CASA CENTRAL", "codigo": 2, "nombre": "NAZIR MAIDANA", "supervisor": "NESTOR QUINTANA"}, {"sucursal": "CASA CENTRAL", "codigo": 3, "nombre": "BELEN ESCALANTE", "supervisor": "MANUEL ANDRIAN"}, {"sucursal": "CASA CENTRAL", "codigo": 4, "nombre": "GUSTAVO MOLINA", "supervisor": "MANUEL ANDRIAN"}, {"sucursal": "CASA CENTRAL", "codigo": 5, "nombre": "MARTIN FERNANDEZ", "supervisor": "VICTOR HUGO MONTAÑEZ"}, {"sucursal": "CASA CENTRAL", "codigo": 6, "nombre": "FACUNDO ZAMORA", "supervisor": "NESTOR QUINTANA"}, {"sucursal": "CASA CENTRAL", "codigo": 7, "nombre": "DIEGO VALENZUELA", "supervisor": "VICTOR HUGO MONTAÑEZ"}, {"sucursal": "CASA CENTRAL", "codigo": 8, "nombre": "MATIAS ALTAMIRANO", "supervisor": "MANUEL ANDRIAN"}, {"sucursal": "CASA CENTRAL", "codigo": 9, "nombre": "SEBASTIAN SOTO", "supervisor": "NESTOR QUINTANA"}, {"sucursal": "CASA CENTRAL", "codigo": 10, "nombre": "NAHUEL VALLEJOS", "supervisor": "VICTOR HUGO MONTAÑEZ"}, {"sucursal": "CASA CENTRAL", "codigo": 11, "nombre": "MILAGROS ALMIRON", "supervisor": "VICTOR HUGO MONTAÑEZ"}, {"sucursal": "CASA CENTRAL", "codigo": 12, "nombre": "GONZALO QUIROGA", "supervisor": "NESTOR QUINTANA"}, {"sucursal": "CASA CENTRAL", "codigo": 13, "nombre": "RICARDO FERNANDEZ", "supervisor": "VICTOR HUGO MONTAÑEZ"}, {"sucursal": "CASA CENTRAL", "codigo": 14, "nombre": "DANIEL GONZALEZ", "supervisor": "VICTOR HUGO MONTAÑEZ"}, {"sucursal": "CASA CENTRAL", "codigo": 15, "nombre": "LEANDRO ORTIZ", "supervisor": "MANUEL ANDRIAN"}, {"sucursal": "CASA CENTRAL", "codigo": 16, "nombre": "GABRIEL GOMEZ", "supervisor": "NESTOR QUINTANA"}, {"sucursal": "CASA CENTRAL", "codigo": 17, "nombre": "JONATAN GARRIDO", "supervisor": "NESTOR QUINTANA"}, {"sucursal": "CASA CENTRAL", "codigo": 18, "nombre": "JULIO CESAR ROMERO", "supervisor": "VICTOR HUGO MONTAÑEZ"}, {"sucursal": "CASA CENTRAL", "codigo": 19, "nombre": "ENZO ROBINEAU", "supervisor": "NESTOR QUINTANA"}, {"sucursal": "CASA CENTRAL", "codigo": 20, "nombre": "ALAN AYALA", "supervisor": "MANUEL ANDRIAN"}, {"sucursal": "CASA CENTRAL", "codigo": 21, "nombre": "ENCINAS NICOLAS", "supervisor": "MANUEL ANDRIAN"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 51, "nombre": "ETECHEBARNE TOBIAS", "supervisor": "FABIAN ROMERO"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 52, "nombre": "LUIS NUÑEZ", "supervisor": "GLADYS BENITEZ"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 53, "nombre": "ANTONIO SANCHEZ", "supervisor": "MAXIMILIANO MARECO"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 54, "nombre": "AGUSTIN ALEGRE", "supervisor": "MAXIMILIANO MARECO"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 55, "nombre": "GASTON MONZON", "supervisor": "GLADYS BENITEZ"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 56, "nombre": "DIAZ CRISTIAN", "supervisor": "FABIAN ROMERO"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 57, "nombre": "RODRIGUEZ MAXIMILIANO", "supervisor": "GLADYS BENITEZ"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 58, "nombre": "JUAN CORRALES", "supervisor": "MAXIMILIANO MARECO"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 59, "nombre": "NAYLA MACHUCA", "supervisor": "MAXIMILIANO MARECO"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 60, "nombre": "GUSTAVO FRIAS", "supervisor": "FABIAN ROMERO"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 62, "nombre": "AGUSTINA GUZMAN", "supervisor": "FABIAN ROMERO"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 63, "nombre": "INT. LUIS ROMAN", "supervisor": "SERGIO JONATTA SUP. INTERIOR"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 65, "nombre": "INT. ADRIAN ALEGRE", "supervisor": "SERGIO JONATTA SUP. INTERIOR"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 66, "nombre": "VEIDA SILVESTRI", "supervisor": "FABIAN ROMERO"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 67, "nombre": "ESQUEMA INTERIOR", "supervisor": null}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 70, "nombre": "INT. LUCAS AGUIRRE", "supervisor": "SERGIO JONATTA SUP. INTERIOR"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 71, "nombre": "SAUCEDO JAVIER", "supervisor": "MAXIMILIANO MARECO"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 72, "nombre": "INT. SANCHEZ AGUSTIN", "supervisor": "SERGIO JONATTA SUP. INTERIOR"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 73, "nombre": "LUCAS CABRERA", "supervisor": "GLADYS BENITEZ"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 74, "nombre": "ARIEL MARTINEZ", "supervisor": "GLADYS BENITEZ"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 75, "nombre": "CRISTIAN ARMUA", "supervisor": "GLADYS BENITEZ"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 76, "nombre": "ALAN RODRIGUEZ", "supervisor": "MAXIMILIANO MARECO"}, {"sucursal": "SUCURSAL RESISTENCIA", "codigo": 214, "nombre": "INT. CASTILLO MIGUEL", "supervisor": "SERGIO JONATTA SUP. INTERIOR"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 1, "nombre": "NICOLAS MACHADO (PO)", "supervisor": "MATIAS SAUCEDO"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 2, "nombre": "MATIAS ALBRECHT (PO)", "supervisor": "ULISES DE LA CRUZ"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 3, "nombre": "NICOLAS DOGLIOLI (PO)", "supervisor": "MATIAS SAUCEDO"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 4, "nombre": "YENISE LEDESMA (PO)", "supervisor": "CLAUDIO CENTURION"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 5, "nombre": "GERMAN ORTIZ (PO)", "supervisor": "ULISES DE LA CRUZ"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 6, "nombre": "TAMARA INCHAUSTI (PO)", "supervisor": "ULISES DE LA CRUZ"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 7, "nombre": "JARA MAURICIO (PO)", "supervisor": "MATIAS SAUCEDO"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 8, "nombre": "KATHERINE RODRIGUEZ (PO)", "supervisor": "MATIAS SAUCEDO"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 9, "nombre": "FACUNDO FERNANDEZ  (PO)", "supervisor": "CLAUDIO CENTURION"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 10, "nombre": "SEBASTIAN SANABRIA (PO)", "supervisor": "ULISES DE LA CRUZ"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 11, "nombre": "BEATRIZ SILVA (PO)", "supervisor": "ULISES DE LA CRUZ"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 12, "nombre": "ALEJANDRO MOSQUEDA (PO)", "supervisor": "CLAUDIO CENTURION"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 13, "nombre": "DANTE PARRA (PO)", "supervisor": "CLAUDIO CENTURION"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 14, "nombre": "ISAIAS RODRIGUEZ (PO)", "supervisor": "CLAUDIO CENTURION"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 15, "nombre": "FLORENCIA FLORENTIN (PO)", "supervisor": "ULISES DE LA CRUZ"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 16, "nombre": "LEONARDO SILKE (PO)", "supervisor": "MATIAS SAUCEDO"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 17, "nombre": "ARIEL BEITELEZTN (PO)", "supervisor": "CLAUDIO CENTURION"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 18, "nombre": "FERNANDO LAYES (PO)", "supervisor": "MATIAS SAUCEDO"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 20, "nombre": "ALEJANDRO MATTOSO (PO)", "supervisor": "MATIAS SAUCEDO"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 21, "nombre": "RODRIGO AGUIRRE (APOS)", "supervisor": null}, {"sucursal": "SUCURSAL POSADAS", "codigo": 22, "nombre": "NATALIA ROMERO (APOS)", "supervisor": null}, {"sucursal": "SUCURSAL POSADAS", "codigo": 30, "nombre": "MARTIN GARCIA (PO)", "supervisor": "ULISES DE LA CRUZ"}, {"sucursal": "SUCURSAL POSADAS", "codigo": 31, "nombre": "GAUVRY GONZALO (PO)", "supervisor": "CLAUDIO CENTURION"}, {"sucursal": "SUCURSAL OBERA", "codigo": 125, "nombre": "IVAN PRYTULA", "supervisor": "HAHN MAURO"}, {"sucursal": "SUCURSAL OBERA", "codigo": 126, "nombre": "DIEGO FICHTNER", "supervisor": "HAHN MAURO"}, {"sucursal": "SUCURSAL OBERA", "codigo": 127, "nombre": "CENTURION SEBASTIAN", "supervisor": "HAHN MAURO"}, {"sucursal": "SUCURSAL OBERA", "codigo": 128, "nombre": "YGLESIAS GONZALO", "supervisor": "HAHN MAURO"}, {"sucursal": "SUCURSAL OBERA", "codigo": 129, "nombre": "HUGO RIBERO", "supervisor": "HAHN MAURO"}, {"sucursal": "SUCURSAL OBERA", "codigo": 207, "nombre": "SALGADO RODRIGO", "supervisor": "HAHN MAURO"}, {"sucursal": "SUCURSAL OBERA", "codigo": 208, "nombre": "SEBASTIAN CACERES", "supervisor": "HAHN MAURO"}, {"sucursal": "SUCURSAL OBERA", "codigo": 209, "nombre": "ANDREA DE ALMEIDA", "supervisor": "HAHN MAURO"}];
    let PADRON = [];
    /* ============================================================
       CONFIG
    ============================================================ */
    const LINEAS = {
      "QUENTO SNACK": { key:"quento", label:"Quento Snacks", umbral:12, cls:"quento" },
      "HEROE":        { key:"heroe",  label:"Heroe Limpieza", umbral:8,  cls:"heroe"  },
    };
    let baseFile = null, listadoFile = null;
    let lastReportData = null;
    function normSuc(s){
      s = String(s||"").trim().toUpperCase();
      if (s.includes(" - ")) s = s.split(" - ").slice(-1)[0].trim();
      return s;
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
    document.getElementById('fileBase').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if(!f) return;
      baseFile = f;
      document.getElementById('fileBaseName').textContent = f.name;
      document.getElementById('dropBase').classList.add('filled');
      checkReady();
    });
    document.getElementById('fileListado').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if(!f) return;
      listadoFile = f;
      document.getElementById('fileListadoName').textContent = f.name + ' (reemplaza el precargado)';
      document.getElementById('dropListado').classList.add('filled');
    });
    function checkReady(){
      const hasBranch = Boolean(getSelectedBranch());
      const hasPadron = Boolean(hasStoredPadron());
      document.getElementById('btnProcess').disabled = !baseFile || !hasBranch || !hasPadron;
      if (!hasBranch) setStatus('Seleccioná una sucursal.');
      else if (!hasPadron) setStatus('La sucursal no tiene una base de clientes guardada.', true);
      else setStatus(baseFile ? 'Listo para procesar.' : 'Esperando archivo de ventas…');
    }
    window.addEventListener('ccc:padron-status-changed', checkReady);
    checkReady();
    document.getElementById('btnReset').addEventListener('click', () => {
      baseFile = null; listadoFile = null; lastReportData = null;
      document.getElementById('fileBase').value = '';
      document.getElementById('fileListado').value = '';
      document.getElementById('fileBaseName').textContent = '';
      document.getElementById('fileListadoName').textContent = '';
      document.getElementById('dropBase').classList.remove('filled');
      document.getElementById('dropListado').classList.remove('filled');
      document.getElementById('reportArea').innerHTML = '';
      document.getElementById('updatedBadge').style.display = 'none';
      checkReady();
    });
    document.getElementById('btnProcess').addEventListener('click', async () => {
      setStatus('Procesando…');
      document.getElementById('btnProcess').disabled = true;
      try{
        if (listadoFile){
          const wbL = await readWorkbook(listadoFile);
          LISTADO = parseListado(wbL);
        }
        const selectedBranch = getSelectedBranch();
        const selectedSucursal = getSelectedSucursalName();
        if (!selectedBranch || !selectedSucursal) throw new Error('Seleccioná una sucursal válida.');
        const storedPadronFile = await resolvePadronFile();
        if (!storedPadronFile) throw new Error('No se encontró una base de clientes guardada para ' + (getSelectedBranchLabel() || selectedBranch) + '.');
        const wbP = await readWorkbook(storedPadronFile);
        PADRON = parsePadron(wbP, selectedSucursal);

        const wbB = await readWorkbook(baseFile);
        const parsedBase = parseBase(wbB);
        const rows = parsedBase.rows.filter(row => row.sucursal === selectedSucursal);
        if (!rows.length) throw new Error('El archivo de ventas no contiene movimientos de la sucursal ' + (getSelectedBranchLabel() || selectedBranch) + '.');
        const periodo = parsedBase.periodo;
        const lineasDetectadas = Array.from(new Set(rows.map(row => row.linea)));
        lastReportData = { rows, periodo, lineasDetectadas, selectedLineaCode: lineasDetectadas[0] || Object.keys(LINEAS)[0] };
        renderReport(rows, periodo, lineasDetectadas, lastReportData.selectedLineaCode);
        setStatus('Dashboard actualizado.');
      }catch(err){
        console.error(err);
        setStatus('Error al procesar: ' + err.message, true);
      }
      document.getElementById('btnProcess').disabled = !baseFile || !getSelectedBranch() || !hasStoredPadron();
    });
    /* ---------- Parse Listado ---------- */
    function parseListado(wb){
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: null });
      const out = [];
      json.forEach(r => {
        const anulado = r['Anulado'];
        if (anulado === true || anulado === 'true' || anulado === 'TRUE') return;
        const codigo = r['Código'];
        if (codigo === null || codigo === undefined || codigo === '') return;
        out.push({
          sucursal: normSuc(r['Sucursal']),
          codigo: Number(codigo),
          nombre: String(r['Descripción']||'').trim(),
          supervisor: (r['Superior'] === null || r['Superior'] === undefined || String(r['Superior']).trim()==='')
            ? null : String(r['Superior']).trim(),
        });
      });
      return out;
    }
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
    function parseBase(wb){
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
        const linea = String(r[idx.linea]||'').trim().toUpperCase();
        if (!LINEAS[linea]) continue; // ignora líneas que no son Quento/Heroe
        lineasDetectadas.add(linea);
        if (periodo === null) periodo = r[idx.periodoDesc];
        const suc = normSuc(r[idx.sucursal]);
        const vendCod = Number(r[idx.vendedor]);
        if (!Number.isFinite(vendCod)) continue;
        const cliente = r[idx.codCliente];
        if (cliente === null || cliente === undefined) continue;
        const clienteTexto = String(r[idx.clientesId]||'').trim();
        const clienteNombre = clienteTexto.replace(/^\(\s*\d+\s*\)\s*/, '').trim() || ('Cliente ' + cliente);
        const cantidadBultos = Number(r[idx.cantidad]) || 0;
        const pack = extractPack(r[idx.descArticulo]);
        // las unidades reales son siempre un entero (no se compran fracciones de un artículo);
        // se redondea por línea para evitar ruido de precisión del bulto de origen (4 decimales)
        const cantidad = Math.round(cantidadBultos * pack);
        const ruta = String(r[idx.ruta] || '').trim();
        rows.push({
          sucursal: suc,
          cliente: String(cliente),
          clienteNombre,
          vendCod,
          ruta,
          linea,
          cantidad,
        });
      }
      if (!rows.length) throw new Error('No se encontraron filas válidas de Quento/Heroe en el archivo.');
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
        const info = vIdx[vKey];
        if (!info) return; // vendedor no existe en el listado -> no debe figurar
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
        const info = vIdx[vKey];
        if (!info) return;
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
      return { supervisores, ventasPorCliente, selectedRows };
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
        alert('Esta ruta no tiene clientes pendientes: todos cumplieron la cuota.');
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
      }catch(err){
        console.error(err);
        alert('Ocurrió un error al generar el Excel: ' + (err?.message || err));
      }
    }
    
    async function exportRutaPendientesPdf({ rutaNombre, clientes, vendedor, supervisor, lineaInfo, periodo }){
      const pendientes = clientes.filter(c => (Number(c.val) || 0) < lineaInfo.umbral);
      if (!pendientes.length){
        alert('Esta ruta no tiene clientes pendientes: todos cumplieron la cuota.');
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
      }catch(err){
        console.error(err);
        alert('Ocurrió un error al generar el PDF: ' + (err?.message || err));
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
        renderReport(rows, periodo, lineasDetectadas, e.target.value);
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
      const { supervisores: structure, ventasPorCliente } = aggregate(rows, lineaCode);
    
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
        <div style="display:flex;gap:8px;">
          <button class="ghost" id="btnExpandAll">Expandir todo</button>
          <button class="ghost" id="btnCollapseAll">Colapsar todo</button>
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
      document.getElementById('btnExpandAll').addEventListener('click', () => {
        document.querySelectorAll('.ccc-page .sup-card, .ccc-page .vend-card, .ccc-page .ruta-card').forEach(c => c.classList.add('open'));
      });
      document.getElementById('btnCollapseAll').addEventListener('click', () => {
        document.querySelectorAll('.ccc-page .sup-card, .ccc-page .vend-card, .ccc-page .ruta-card').forEach(c => c.classList.remove('open'));
      });
      const firstDetail = Array.from(area.querySelectorAll('.sup-card')).find(c => c.querySelector('.sup-body'));
      if (firstDetail) firstDetail.classList.add('open');
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
