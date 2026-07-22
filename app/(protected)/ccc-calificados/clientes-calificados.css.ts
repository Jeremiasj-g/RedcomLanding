export const clientesCalificadosCss = `
  .ccc-page{
    --dark:#2C2C2A; --gray:#5F5E5A; --grayL:#8A8A86;
    --cream:#F7F5F0; --white:#FFFFFF; --line:#E4E1D9;
    --red:#C8102E; --redDark:#A80D26; --redTint:#FCEAEA;
    --quento:#E2751A; --quentoTint:#FDF0E3;
    --heroe:#1B6FA8; --heroeTint:#E8F2FA;
    --green:#1E8E5A; --greenDark:#197A4D; --greenTint:#ECF8F1;
    --amber:#C87E0A; --amberTint:#FFF4E8;
    min-height:calc(100vh - 64px); margin:0; background:var(--cream); color:var(--dark);
    font-family:Arial,Helvetica,sans-serif;
  }
  .ccc-page,.ccc-page *{box-sizing:border-box;}
  .ccc-page .topbar{background:var(--dark);padding:22px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;}
  .ccc-page .brand{display:flex;align-items:center;gap:14px;}
  .ccc-page .brand .logo-box{background:#fff;border-radius:8px;padding:8px 14px;display:flex;align-items:center;flex:none;}
  .ccc-page .brand .logo-box img{height:52px;width:52px;object-fit:contain;display:block;}
  .ccc-page .brand h1{font-size:17px;margin:0;color:#fff;font-weight:700;}
  .ccc-page .brand p{margin:2px 0 0;font-size:12px;color:#B9B7B2;}
  .ccc-page .updated-badge{background:#3A3A37;border:1px solid #4d4d49;border-radius:8px;padding:9px 16px;font-size:12.5px;color:#E4E1D9;display:flex;align-items:center;gap:8px;}
  .ccc-page .updated-badge b{color:#fff;}
  .ccc-page .updated-badge .dot{width:8px;height:8px;border-radius:50%;background:var(--green);flex:none;}
  .ccc-page .ccc-main{max-width:1200px;margin:0 auto;padding:24px 28px 60px;}
  .ccc-page .upload-panel{background:var(--white);border:1px solid var(--line);border-radius:12px;padding:22px 24px;margin-bottom:20px;}
  .ccc-page .upload-heading-row{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:18px;}
  .ccc-page .upload-panel h2{font-size:15px;margin:0 0 4px;}
  .ccc-page .upload-panel .sub{font-size:12.5px;color:var(--grayL);margin:0;max-width:720px;}
  .ccc-page .branch-selector{display:flex;flex-direction:column;gap:6px;min-width:230px;}
  .ccc-page .branch-selector span{font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;font-weight:700;color:var(--gray);}
  .ccc-page .branch-selector select{width:100%;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--dark);padding:10px 36px 10px 12px;font-size:13px;outline:none;}
  .ccc-page .branch-selector select:focus{border-color:var(--red);box-shadow:0 0 0 3px rgba(200,16,46,.10);}
  .ccc-page .branch-selector select:disabled{background:#F2F1ED;color:var(--grayL);}
  .ccc-page .upload-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .ccc-page .upload-grid-3{grid-template-columns:repeat(3,minmax(0,1fr));}
  .ccc-page .drop{border:2px dashed var(--line);border-radius:10px;padding:18px;text-align:center;cursor:pointer;transition:.15s;background:var(--cream);min-height:142px;display:flex;flex-direction:column;align-items:center;justify-content:center;}
  .ccc-page .drop:hover{border-color:var(--red);background:var(--redTint);}
  .ccc-page .drop.filled{border-style:solid;border-color:var(--green);background:#F0F9F3;}
  .ccc-page .drop.is-uploading{cursor:wait;opacity:.78;}
  .ccc-page .drop .ico{height:24px;font-size:22px;margin-bottom:7px;display:flex;align-items:center;justify-content:center;}
  .ccc-page .drop .ico svg{width:23px;height:23px;}
  .ccc-page .drop .label{font-size:13px;font-weight:700;color:var(--dark);}
  .ccc-page .drop .hint{font-size:11px;color:var(--grayL);margin-top:4px;line-height:1.35;}
  .ccc-page .drop input{display:none;}
  .ccc-page .drop .filename{font-size:11.5px;color:var(--green);font-weight:700;margin-top:7px;word-break:break-word;}
  .ccc-page .database-drop:hover{border-color:var(--green);background:var(--greenTint);}
  .ccc-page .refresh-rule{margin-top:14px;border:1px solid #EAD6B5;background:#FFF9EF;border-radius:9px;padding:10px 13px;font-size:11.5px;color:#86600E;line-height:1.45;}
  .ccc-page .client-base-status{margin-top:10px;border:1px solid var(--line);border-radius:10px;padding:12px 14px;display:flex;align-items:flex-start;gap:11px;font-size:12px;}
  .ccc-page .client-base-status .status-icon{width:19px;height:19px;flex:none;margin-top:1px;}
  .ccc-page .client-base-status-copy,.ccc-page .client-base-status>div{display:flex;flex-direction:column;gap:3px;}
  .ccc-page .client-base-status strong{font-size:12.5px;}
  .ccc-page .client-base-status span{color:var(--grayL);}
  .ccc-page .client-base-status .countdown{font-weight:700;color:inherit;}
  .ccc-page .client-base-status.is-fresh{background:var(--greenTint);border-color:#B9E2CB;color:#087B45;}
  .ccc-page .client-base-status.is-warning{background:var(--amberTint);border-color:#F1CCA5;color:#A75A08;}
  .ccc-page .client-base-status.is-expired,.ccc-page .client-base-status.is-missing{background:var(--redTint);border-color:#F0BBC5;color:var(--red);}
  .ccc-page .client-base-status.is-loading{background:#F5F4F1;color:var(--gray);}
  .ccc-page .database-message{margin-top:8px;border-radius:8px;padding:9px 12px;font-size:12px;font-weight:700;}
  .ccc-page .database-message.success{background:var(--greenTint);color:#087B45;}
  .ccc-page .database-message.error{background:var(--redTint);color:var(--red);}
  .ccc-page .actions{display:flex;gap:12px;align-items:center;margin-top:18px;flex-wrap:wrap;}
  .ccc-page button.primary{background:var(--red);color:#fff;border:none;border-radius:8px;padding:12px 24px;font-size:14px;font-weight:700;cursor:pointer;transition:.15s;}
  .ccc-page button.primary:hover{background:var(--redDark);}
  .ccc-page button.primary:disabled{background:#D8D6CF;cursor:not-allowed;}
  .ccc-page button.ghost{background:transparent;color:var(--gray);border:1px solid var(--line);border-radius:8px;padding:11px 18px;font-size:13px;cursor:pointer;}
  .ccc-page button.ghost:hover{border-color:var(--red);color:var(--red);}
  .ccc-page .status{font-size:12.5px;color:var(--grayL);}
  .ccc-page .status.error{color:var(--red);font-weight:700;}
  .ccc-page .linea-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:700;margin-bottom:14px;}
  .ccc-page .linea-badge.quento{background:var(--quentoTint);color:var(--quento);}
  .ccc-page .linea-badge.heroe{background:var(--heroeTint);color:var(--heroe);}
  .ccc-page .legend{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;margin:14px 0 18px;font-size:12px;color:var(--grayL);background:var(--white);border:1px solid var(--line);border-radius:10px;padding:14px 16px;line-height:1.5;}
  .ccc-page .kpi-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px;}
  .ccc-page .kpi-card{background:var(--white);border:1px solid var(--line);border-radius:12px;padding:16px 18px;position:relative;overflow:hidden;}
  .ccc-page .kpi-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--kc,var(--red));}
  .ccc-page .kpi-card .k-label{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--grayL);margin-bottom:6px;}
  .ccc-page .kpi-card .k-value{font-size:26px;font-weight:700;color:var(--dark);}
  .ccc-page .kpi-card .k-sub{font-size:11.5px;color:var(--grayL);margin-top:4px;}
  .ccc-page .sup-mini-table{width:100%;border-collapse:collapse;margin-top:2px;}
  .ccc-page .sup-mini-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.3px;color:var(--grayL);padding:4px 8px;border-bottom:1px solid var(--line);}
  .ccc-page .sup-mini-table th.num,.ccc-page .sup-mini-table td.num{text-align:right;}
  .ccc-page .sup-mini-table td{padding:5px 8px;font-size:12px;border-bottom:1px solid var(--line);}
  .ccc-page .sup-mini-table tr:last-child td{border-bottom:none;}
  .ccc-page .toolbar{display:flex;justify-content:space-between;align-items:center;margin:6px 0 14px;flex-wrap:wrap;gap:10px;}
  .ccc-page .toolbar .title{font-size:16px;font-weight:700;}
  .ccc-page .toolbar .subtitle{font-size:12px;color:var(--grayL);margin-top:2px;}
  .ccc-page .sup-card{background:var(--white);border:1px solid var(--line);border-radius:12px;margin-bottom:12px;overflow:hidden;}
  .ccc-page .sup-card.no-sup{border-color:var(--amber);}
  .ccc-page .sup-head{padding:15px 20px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:14px;flex-wrap:wrap;}
  .ccc-page .sup-head:hover{background:var(--cream);}
  .ccc-page .sup-title{display:flex;align-items:center;gap:10px;}
  .ccc-page .sup-title .arrow{transition:.2s;color:var(--grayL);font-size:12px;}
  .ccc-page .sup-card.open>.sup-head .sup-title .arrow{transform:rotate(90deg);}
  .ccc-page .sup-title h3{margin:0;font-size:15px;}
  .ccc-page .sup-title .badge-n{font-size:11px;color:var(--grayL);background:var(--cream);border:1px solid var(--line);border-radius:12px;padding:2px 9px;}
  .ccc-page .sup-metric{display:flex;align-items:center;gap:8px;}
  .ccc-page .sup-metric .val{font-size:20px;font-weight:700;}
  .ccc-page .sup-metric .lbl{font-size:10.5px;color:var(--grayL);text-transform:uppercase;letter-spacing:.4px;}
  .ccc-page .sup-body{display:none;padding:2px 16px 16px;}
  .ccc-page .sup-card.open>.sup-body{display:block;}
  .ccc-page .vend-card{background:var(--cream);border:1px solid var(--line);border-radius:10px;margin-bottom:8px;overflow:hidden;}
  .ccc-page .vend-head{padding:11px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:12px;flex-wrap:wrap;}
  .ccc-page .vend-head:hover{background:#EFEDE7;}
  .ccc-page .vend-title{display:flex;align-items:center;gap:9px;}
  .ccc-page .vend-title .arrow{transition:.2s;color:var(--grayL);font-size:11px;}
  .ccc-page .vend-card.open>.vend-head .vend-title .arrow{transform:rotate(90deg);}
  .ccc-page .vend-title h4{margin:0;font-size:13px;}
  .ccc-page .vend-body{display:none;padding:0 10px 10px;}
  .ccc-page .vend-card.open>.vend-body{display:block;}
  .ccc-page .ruta-card{background:var(--white);border:1px solid var(--line);border-radius:8px;margin-bottom:6px;overflow:hidden;}
  .ccc-page .ruta-head{padding:9px 12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:10px;flex-wrap:wrap;}
  .ccc-page .ruta-head:hover{background:var(--cream);}
  .ccc-page .ruta-title{display:flex;align-items:center;gap:8px;}
  .ccc-page .ruta-title .arrow{transition:.2s;color:var(--grayL);font-size:10px;}
  .ccc-page .ruta-card.open>.ruta-head .ruta-title .arrow{transform:rotate(90deg);}
  .ccc-page .ruta-title h5{margin:0;font-size:12px;color:var(--gray);text-transform:uppercase;letter-spacing:.3px;}
  .ccc-page .ruta-body{display:none;padding:0 8px 8px;}
  .ccc-page .ruta-card.open>.ruta-body{display:block;}
  .ccc-page .linea-selector-panel{background:var(--white);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:14px;max-width:470px;}
  .ccc-page .linea-selector-panel label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.35px;color:var(--gray);margin-bottom:8px;}
  .ccc-page .linea-selector-panel select{width:100%;background:var(--white);color:var(--dark);border:1px solid var(--line);border-radius:9px;padding:11px 38px 11px 14px;font-size:14px;outline:none;cursor:pointer;}
  .ccc-page .linea-selector-panel select:focus{border-color:var(--red);box-shadow:0 0 0 3px rgba(200,16,46,.10);}
  .ccc-page .head-summary{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-left:auto;}
  .ccc-page .metrics-chips{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap;}
  .ccc-page .metric-chip{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;border:1px solid var(--line);border-radius:999px;padding:5px 10px;background:var(--white);font-size:10.5px;font-weight:600;color:var(--gray);}
  .ccc-page .metric-chip b{font-size:11px;}
  .ccc-page .metric-chip.clients{background:#F2F7FB;border-color:#D6E3EE;color:#0C5E9D;}
  .ccc-page .metric-chip.units{background:#F6F1FD;border-color:#DED1F2;color:#6543A6;}
  .ccc-page .metric-chip.fulfilled{background:#ECF8F1;border-color:#B9E2CB;color:#087B45;}
  .ccc-page .metric-chip.progress{background:#FFF4E8;border-color:#F1CCA5;color:#B85B00;}
  .ccc-page .metric-chip.no-buy{background:#F5F4F1;border-color:#DDDAD2;color:#595751;}
  .ccc-page .route-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-left:auto;}
  .ccc-page button.export-excel,.ccc-page button.export-pdf{color:#fff;border-radius:8px;width:36px;height:36px;padding:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:.15s;flex:none;}
  .ccc-page button.export-excel{background:var(--green);border:1px solid var(--greenDark);}
  .ccc-page button.export-excel:hover{background:var(--greenDark);transform:translateY(-1px);}
  .ccc-page button.export-pdf{background:var(--red);border:1px solid var(--redDark);}
  .ccc-page button.export-pdf:hover{background:var(--redDark);transform:translateY(-1px);}
  .ccc-page button.export-excel:disabled{background:#AFCFC0;border-color:#AFCFC0;cursor:not-allowed;transform:none;}
  .ccc-page button.export-pdf:disabled{background:#D8AAB3;border-color:#D8AAB3;cursor:not-allowed;transform:none;}
  .ccc-page .export-excel svg,.ccc-page .export-pdf svg{width:18px;height:18px;display:block;}
  .ccc-page .export-spinner{animation:ccc-spin .8s linear infinite;}
  .ccc-page table.cli-table{width:100%;border-collapse:collapse;background:var(--white);border-radius:8px;overflow:hidden;}
  .ccc-page table.cli-table th{background:var(--dark);color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;padding:8px 10px;text-align:right;}
  .ccc-page table.cli-table th:first-child{text-align:left;}
  .ccc-page table.cli-table td{padding:7px 10px;font-size:12.5px;border-top:1px solid var(--line);text-align:right;}
  .ccc-page table.cli-table td:first-child{text-align:left;font-weight:600;}
  .ccc-page table.cli-table tr:nth-child(even) td{background:#FAFAF8;}
  .ccc-page td.actual{font-weight:700;}
  .ccc-page td.actual.quento{color:var(--quento);}
  .ccc-page td.actual.heroe{color:var(--heroe);}
  .ccc-page td.falta{color:var(--red);font-weight:700;}
  .ccc-page tr.row-cumplido td{background:#F0F9F3;}
  .ccc-page td.cumplido-tag{color:var(--green);font-weight:700;}
  .ccc-page .bar-fill.cumplido{background:var(--green);}
  .ccc-page .cli-code{color:var(--grayL);font-weight:400;font-size:11px;}
  .ccc-page .bar-cell{position:relative;}
  .ccc-page .bar-track{background:#ECECEC;border-radius:4px;height:8px;width:100%;overflow:hidden;}
  .ccc-page .bar-fill{height:100%;border-radius:4px;}
  .ccc-page .bar-fill.quento{background:var(--quento);}
  .ccc-page .bar-fill.heroe{background:var(--heroe);}
  .ccc-page .no-sup-tag{font-size:11px;color:var(--amber);font-weight:700;text-transform:uppercase;letter-spacing:.4px;}
  .ccc-page .ccc-footer{max-width:1200px;margin:0 auto;padding:0 28px 28px;color:var(--grayL);font-size:11.5px;}
  .ccc-page .spin{animation:ccc-spin .8s linear infinite;}
  @keyframes ccc-spin{to{transform:rotate(360deg);}}
  @media(max-width:900px){
    .ccc-page .upload-grid-3{grid-template-columns:1fr 1fr;}
  }
  @media(max-width:820px){
    .ccc-page .kpi-summary{grid-template-columns:1fr 1fr;}
  }
  @media(max-width:720px){
    .ccc-page .ccc-main{padding:18px 14px 44px;}
    .ccc-page .topbar{padding:18px 16px;}
    .ccc-page .upload-grid,.ccc-page .upload-grid-3{grid-template-columns:1fr;}
    .ccc-page .branch-selector{width:100%;}
    .ccc-page .linea-selector-panel{max-width:none;}
    .ccc-page .head-summary,.ccc-page .metrics-chips,.ccc-page .route-actions{width:100%;justify-content:flex-start;margin-left:0;}
    .ccc-page .sup-metric{width:100%;}
    .ccc-page table.cli-table{min-width:650px;}
    .ccc-page .ruta-body{overflow-x:auto;}
  }
`;
