/** Formato de grupos compartido entre Proyectos, RRHH y Perfil. */
export function decodeTodoLabel(text?: string) {
  const raw = String(text ?? '').trim();
  if (!raw.startsWith('§§')) return { group: null as string | null, label: raw };

  const second = raw.indexOf('§§', 2);
  if (second < 0) return { group: null as string | null, label: raw };

  return {
    group: raw.slice(2, second).trim() || null,
    label: raw.slice(second + 2).trim(),
  };
}

