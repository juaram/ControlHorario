import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { duraccionTexto, fechaHoyLarga, fmtFecha } from '../lib/format';
import { obtenerUbicacion, type GeoPosicion } from '../lib/geo';
import type { RespuestaEstado, RespuestaFichaje, RespuestaHistorial } from '../lib/types';

const ETIQUETAS: Record<string, { texto: string; clase: string; punto: string }> = {
  pending: { texto: 'Sin fichar', clase: 'bg-slate-200 text-slate-600', punto: 'bg-slate-500' },
  working: { texto: 'Jornada en curso', clase: 'bg-green-100 text-green-700', punto: 'bg-green-600' },
  on_break: { texto: 'En pausa', clase: 'bg-orange-100 text-orange-700', punto: 'bg-orange-600' },
  completed: { texto: 'Jornada finalizada', clase: 'bg-blue-100 text-blue-700', punto: 'bg-blue-600' },
};

export default function Dashboard() {
  const [estado, setEstado] = useState<RespuestaEstado>({ status: 'pending', record: null });
  const [hist, setHist] = useState<RespuestaHistorial | null>(null);
  const [pagina, setPagina] = useState(1);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [notas, setNotas] = useState('');
  const [reloj, setReloj] = useState(() => new Date());

  // Reloj en vivo
  useEffect(() => {
    const id = setInterval(() => setReloj(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const cargarEstado = useCallback(async () => {
    try {
      const data = await api.clock.status();
      setEstado(data);
      setNotas(data.record?.notes ?? '');
    } catch (err) {
      console.error('Error al cargar estado:', err);
    }
  }, []);

  const cargarHistorial = useCallback(async () => {
    try {
      const data = await api.clock.history({
        page: pagina,
        limit: 15,
        from: desde || undefined,
        to: hasta || undefined,
      });
      setHist(data);
    } catch (err) {
      console.error('Error al cargar historial:', err);
    }
  }, [pagina, desde, hasta]);

  useEffect(() => {
    void cargarEstado();
  }, [cargarEstado]);

  useEffect(() => {
    void cargarHistorial();
  }, [cargarHistorial]);

  async function ejecutar(
    accion: (geo?: GeoPosicion) => Promise<RespuestaFichaje>,
    requiereUbicacion: boolean,
  ) {
    let geo: GeoPosicion | undefined;
    if (requiereUbicacion) {
      try {
        geo = await obtenerUbicacion();
      } catch (err) {
        alert(
          (err instanceof Error ? err.message : 'No se pudo obtener tu ubicación') +
            '. No se puede iniciar/finalizar la jornada sin la ubicación.',
        );
        return;
      }
    }
    try {
      const r = await accion(geo);
      setEstado({ status: r.status, record: r.record });
      await cargarHistorial();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error de conexión');
    }
  }

  async function guardarNotas() {
    try {
      await api.clock.notes(notas);
      alert('Notas guardadas');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error de conexión');
    }
  }

  const accion = () => {
    switch (estado.status) {
      case 'pending':
        return (
          <button
            onClick={() => void ejecutar(api.clock.clockIn, true)}
            className="px-8 py-3 rounded-lg bg-green-700 text-white font-medium hover:bg-green-800"
          >
            Iniciar jornada
          </button>
        );
      case 'working':
        return (
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => void ejecutar(api.clock.breakStart, false)}
              className="px-6 py-3 rounded-lg bg-orange-600 text-white font-medium hover:bg-orange-700"
            >
              Iniciar pausa
            </button>
            <button
              onClick={() => void ejecutar(api.clock.clockOut, true)}
              className="px-6 py-3 rounded-lg bg-red-700 text-white font-medium hover:bg-red-800"
            >
              Finalizar jornada
            </button>
          </div>
        );
      case 'on_break':
        return (
          <button
            onClick={() => void ejecutar(api.clock.breakEnd, false)}
            className="px-8 py-3 rounded-lg bg-green-700 text-white font-medium hover:bg-green-800"
          >
            Finalizar pausa
          </button>
        );
      default:
        return <p className="text-sm text-slate-500">Jornada de hoy finalizada</p>;
    }
  };

  const etiqueta = ETIQUETAS[estado.status];

  return (
    <Layout titulo="Control Horario" enlaceAdmin>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8 text-center">
        <div className="text-sm text-slate-500 capitalize">{fechaHoyLarga()}</div>
        <div className="text-5xl font-light tabular-nums text-slate-900 my-6">
          {reloj.toLocaleTimeString('es-ES')}
        </div>
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium ${etiqueta.clase} mb-6`}>
          <span className={`w-2 h-2 rounded-full ${etiqueta.punto}`} />
          {etiqueta.texto}
        </div>
        <div className="flex items-center justify-center">{accion()}</div>
        <p className="mt-4 text-xs text-slate-400">
          Al iniciar o finalizar la jornada se comprueba que estás cerca del puesto de trabajo
          (se usa tu ubicación solo en ese momento).
        </p>

        {estado.record && (
          <>
            <div className="mt-6 p-4 rounded-lg bg-slate-50 grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">Entrada</div>
                <div className="text-xl font-semibold mt-1">{estado.record.clock_in || '--'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">Salida</div>
                <div className="text-xl font-semibold mt-1">
                  {estado.record.clock_out || (estado.status === 'completed' ? '--' : 'Pendiente')}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">Total</div>
                <div className="text-xl font-semibold mt-1">
                  {estado.record.clock_out
                    ? duraccionTexto(estado.record)
                    : 'En curso'}
                </div>
              </div>
            </div>

            <div className="mt-6 text-left">
              <label htmlFor="notes-input" className="block text-sm font-medium text-slate-600 mb-1">
                Notas del día
              </label>
              <textarea
                id="notes-input"
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Incidencias, tareas realizadas..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10"
              />
              <button
                onClick={() => void guardarNotas()}
                className="mt-2 text-sm px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                Guardar notas
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <div className="text-base font-semibold pb-3 mb-4 border-b border-slate-200">
          Historial de fichajes
        </div>
        <div className="flex flex-wrap items-end gap-3 mb-5">
          <div>
            <label htmlFor="hist-from" className="block text-sm font-medium text-slate-600 mb-1">
              Desde
            </label>
            <input
              id="hist-from"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label htmlFor="hist-to" className="block text-sm font-medium text-slate-600 mb-1">
              Hasta
            </label>
            <input
              id="hist-to"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>
          <button
            onClick={() => setPagina(1)}
            className="text-sm px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800"
          >
            Filtrar
          </button>
          <button
            onClick={() => {
              setDesde('');
              setHasta('');
              setPagina(1);
            }}
            className="text-sm px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Limpiar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b-2 border-slate-200">
                <th className="px-3 py-2.5 font-semibold">Fecha</th>
                <th className="px-3 py-2.5 font-semibold">Entrada</th>
                <th className="px-3 py-2.5 font-semibold">Salida</th>
                <th className="px-3 py-2.5 font-semibold">Total</th>
                <th className="px-3 py-2.5 font-semibold">Notas</th>
              </tr>
            </thead>
            <tbody>
              {hist && hist.records.length > 0 ? (
                hist.records.map((r) => (
                  <tr key={r.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-3 py-2.5">{fmtFecha(r.date)}</td>
                    <td className="px-3 py-2.5">{r.clock_in || '--'}</td>
                    <td className="px-3 py-2.5">{r.clock_out || '--'}</td>
                    <td className="px-3 py-2.5">{duraccionTexto(r)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 max-w-50 truncate">
                      {r.notes || ''}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-12 text-center text-slate-400">
                    No hay registros aún
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hist && hist.total > 0 && (
          <div className="flex items-center justify-center gap-2 mt-5 text-sm text-slate-500">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={hist.page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span>
              Página {hist.page} de {Math.max(1, Math.ceil(hist.total / hist.limit))} ({hist.total} registros)
            </span>
            <button
              onClick={() => setPagina((p) => p + 1)}
              disabled={hist.page >= Math.ceil(hist.total / hist.limit)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}