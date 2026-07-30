const fs = require('fs');
const path = require('path');

const nextDir = path.join(process.cwd(), '.next');

try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log('[build] Cache .next eliminado antes de compilar.');
} catch (error) {
  console.error('[build] No se pudo limpiar .next:', error);
  process.exit(1);
}
