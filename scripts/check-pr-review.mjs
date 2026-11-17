#!/usr/bin/env node
// Control de proceso: exige una revisión explícita, no valida automáticamente el diseño.
const required = ['agents','tables','animations','loading','forms','responsive','checks','safety'];
const body = process.env.PR_BODY ?? '';
const lines = body.split(/\r?\n/).map(line => line.trim());
const missing = required.filter(id => !lines.some(line =>
  line.startsWith('- [x] <!-- review:' + id + ' -->') ||
  line.startsWith('- [X] <!-- review:' + id + ' -->')
));
if (missing.length) {
  console.error('El PR no declara todas las revisiones obligatorias de AGENTS.md.');
  console.error('Marcá cada casilla revisada y justificá los "No aplica" en la descripción.');
  console.error('Pendientes: ' + missing.join(', '));
  process.exitCode = 1;
} else {
  console.log('Checklist completo. Todavía se requiere revisión funcional y visual real.');
}
