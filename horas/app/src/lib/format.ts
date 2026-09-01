export function fmtFecha(iso: string): string {
  // 'YYYY-MM-DD' → fecha legible (se fuerza mediodía para evitar saltos de zona)
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('es-ES');
}

export function fmtCreado(iso: string): string {
  const d = new Date(iso.replace(' ', 'T'));
  return d.toLocaleDateString('es-ES');
}

export function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

export function duraccionTexto(r: { clock_in: string | null; clock_out: string | null; total_work_minutes: number | null }): string {
  if (r.clock_out) {
    return r.total_work_minutes !== null ? fmtMin(r.total_work_minutes) : '--';
  }
  return r.clock_in ? 'En curso' : '--';
}

export function fechaHoyLarga(): string {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}