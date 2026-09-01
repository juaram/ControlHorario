import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { fmtCreado, fmtFecha, fmtMin, duraccionTexto } from '../lib/format';
import { obtenerUbicacion } from '../lib/geo';
import type { ConfigTrabajo, Estadisticas, Registro, RespuestaHistorial, Usuario } from '../lib/types';

type Tab = 'users' | 'records' | 'hours';

export default function Admin() {
  const [tab, setTab] = useState<Tab>('users');

  // Tarjetas
  const [stats, setStats] = useState<Estadisticas | null>(null);

  // Usuarios
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // Registros
  const [registros, setRegistros] = useState<RespuestaHistorial | null>(null);
  const [rPagina, setRPagina] = useState(1);
  const [rDesde, setRDesde] = useState('');
  const [rHasta, setRHasta] = useState('');
  const [rUsuario, setRUsuario] = useState('');
  const [opcionesUsuario, setOpcionesUsuario] = useState<Usuario[]>([]);

  // Resumen horas
  const [horas, setHoras] = useState<{ nombre: string; dias: number; total: number }[]>([]);
  const [hDesde, setHDesde] = useState('');
  const [hHasta, setHHasta] = useState('');
  const [hUsuario, setHUsuario] = useState('');
  const [hTotalRegistros, setHTotalRegistros] = useState(0);

  // Modal de usuario
  const [modalUsuario, setModalUsuario] = useState<Usuario | null | 'nuevo'>(null);

  // Modal de edición de registro
  const [modalRegistro, setModalRegistro] = useState<Registro | null>(null);

  // Configuración del puesto de trabajo (coordenadas)
  const [config, setConfig] = useState<ConfigTrabajo | null>(null);
  const [configMsg, setConfigMsg] = useState('');

  const cargarConfig = useCallback(async () => {
    try {
      setConfig(await api.admin.config());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    void cargarConfig();
  }, [cargarConfig]);

  async function guardarConfig() {
    if (!config) return;
    setConfigMsg('');
    try {
      await api.admin.saveConfig(config);
      setConfigMsg('Configuración guardada');
      await cargarConfig();
    } catch (err) {
      setConfigMsg(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  async function usarMiUbicacion() {
    try {
      const g = await obtenerUbicacion();
      setConfig((c) => (c ? { ...c, trabajo_lat: g.lat, trabajo_lon: g.lon } : c));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo obtener tu ubicación');
    }
  }

  const cargarUsuarios = useCallback(async () => {
    try {
      const data = await api.admin.users();
      setUsuarios(data.users);
      setOpcionesUsuario(data.users);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const cargarStats = useCallback(async () => {
    try {
      setStats(await api.admin.stats());
    } catch (err) {
      console.error(err);
    }
  }, []);

  const cargarRegistros = useCallback(async () => {
    try {
      const data = await api.admin.records({
        page: rPagina,
        limit: 30,
        from: rDesde || undefined,
        to: rHasta || undefined,
        user_id: rUsuario ? Number(rUsuario) : undefined,
      });
      setRegistros(data);
    } catch (err) {
      console.error(err);
    }
  }, [rPagina, rDesde, rHasta, rUsuario]);

  const cargarHoras = useCallback(async () => {
    try {
      const data = await api.admin.records({
        page: 1,
        limit: 1000,
        from: hDesde || undefined,
        to: hHasta || undefined,
        user_id: hUsuario ? Number(hUsuario) : undefined,
      });
      const agrupado: Record<string, { nombre: string; dias: number; total: number }> = {};
      for (const r of data.records) {
        const clave = `${r.full_name}--${r.user_id}`;
        if (!agrupado[clave]) agrupado[clave] = { nombre: r.full_name ?? '?', dias: 0, total: 0 };
        if (r.total_work_minutes !== null) {
          agrupado[clave].total += r.total_work_minutes;
          agrupado[clave].dias += 1;
        }
      }
      setHoras(Object.values(agrupado));
      setHTotalRegistros(data.total);
    } catch (err) {
      console.error(err);
    }
  }, [hDesde, hHasta, hUsuario]);

  useEffect(() => {
    void cargarUsuarios();
    void cargarStats();
  }, [cargarUsuarios, cargarStats]);

  useEffect(() => {
    if (tab === 'records') void cargarRegistros();
    if (tab === 'hours') void cargarHoras();
  }, [tab, cargarRegistros, cargarHoras]);

  async function exportar() {
    try {
      await api.exportCsv({
        from: rDesde || undefined,
        to: rHasta || undefined,
        user_id: rUsuario ? Number(rUsuario) : undefined,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar');
    }
  }

  const statsTarjetas = [
    { titulo: 'Empleados', valor: String(stats?.total_employees ?? 0), unidad: '' },
    { titulo: 'Fichando ahora', valor: String(stats?.today_active ?? 0), unidad: '' },
    { titulo: 'Horas esta semana', valor: String(stats?.week_hours ?? 0), unidad: 'h' },
  ];

  return (
    <Layout titulo="Panel de Administración" enlaceAdmin={false}>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
        <div className="text-base font-semibold">Ubicación del puesto de trabajo</div>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          Así se comprueba que el empleado está en el puesto al iniciar o finalizar la
          jornada (se usa la ubicación de su móvil solo en ese momento).
          {config && !config.trabajo_lat && config.ubicacion_obligatoria && (
            <span className="font-medium text-orange-700">
              ⚠ Sin coordenadas configuradas la verificación no se aplica.
            </span>
          )}
        </p>
        {config && (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Latitud</label>
              <input
                type="number"
                step="any"
                value={config.trabajo_lat ?? ""}
                onChange={(e) => setConfig({ ...config, trabajo_lat: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="40.4168"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Longitud</label>
              <input
                type="number"
                step="any"
                value={config.trabajo_lon ?? ""}
                onChange={(e) => setConfig({ ...config, trabajo_lon: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="-3.7038"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Radio permitido (metros)</label>
              <input
                type="number"
                min={10}
                value={config.trabajo_radio}
                onChange={(e) => setConfig({ ...config, trabajo_radio: Number(e.target.value) || 300 })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.ubicacion_obligatoria}
                onChange={(e) => setConfig({ ...config, ubicacion_obligatoria: e.target.checked })}
                className="w-4 h-4"
              />
              Exigir ubicación al iniciar/finalizar la jornada
            </label>
            <button
              onClick={() => void usarMiUbicacion()}
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Usar mi ubicación actual
            </button>
            <button
              onClick={() => void guardarConfig()}
              className="text-sm px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800"
            >
              Guardar configuración
            </button>
            {configMsg && <span className="text-sm text-slate-600">{configMsg}</span>}
          </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {statsTarjetas.map((s) => (
          <div key={s.titulo} className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 text-center">
            <div className="text-xs text-slate-500 uppercase tracking-wide">{s.titulo}</div>
            <div className="text-3xl font-bold mt-2">
              {s.valor}
              {s.unidad}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 border-b border-slate-200 mb-6">
        {(
          [
            ['users', 'Usuarios'],
            ['records', 'Registros'],
            ['hours', 'Resumen horas'],
          ] as [Tab, string][]
        ).map(([id, etiqueta]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? 'text-blue-700 border-blue-700'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {/* ------- USUARIOS ------- */}
      {tab === 'users' && (
        <div>
          <div className="mb-4">
            <button
              onClick={() => setModalUsuario('nuevo')}
              className="text-sm px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800"
            >
              + Nuevo usuario
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b-2 border-slate-200">
                  <th className="px-3 py-2.5 font-semibold">Nombre</th>
                  <th className="px-3 py-2.5 font-semibold">Usuario</th>
                  <th className="px-3 py-2.5 font-semibold">Rol</th>
                  <th className="px-3 py-2.5 font-semibold">Estado</th>
                  <th className="px-3 py-2.5 font-semibold">Creado</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-12 text-center text-slate-400">
                      No hay usuarios
                    </td>
                  </tr>
                ) : (
                  usuarios.map((u) => (
                    <tr key={u.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-3 py-2.5">{u.full_name}</td>
                      <td className="px-3 py-2.5">{u.username}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {u.role === 'admin' ? 'Admin' : 'Empleado'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {u.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{fmtCreado(u.created_at)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => setModalUsuario(u)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------- REGISTROS ------- */}
      {tab === 'records' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
          <div className="flex flex-wrap items-end gap-3 mb-5">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Desde</label>
              <input type="date" value={rDesde} onChange={(e) => setRDesde(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Hasta</label>
              <input type="date" value={rHasta} onChange={(e) => setRHasta(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Usuario</label>
              <select value={rUsuario} onChange={(e) => setRUsuario(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white">
                <option value="">Todos</option>
                {opcionesUsuario.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setRPagina(1)}
              className="text-sm px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800"
            >
              Filtrar
            </button>
            <button
              onClick={() => void exportar()}
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b-2 border-slate-200">
                  <th className="px-3 py-2.5 font-semibold">Empleado</th>
                  <th className="px-3 py-2.5 font-semibold">Fecha</th>
                  <th className="px-3 py-2.5 font-semibold">Entrada</th>
                  <th className="px-3 py-2.5 font-semibold">Salida</th>
                  <th className="px-3 py-2.5 font-semibold">Pausa ini</th>
                  <th className="px-3 py-2.5 font-semibold">Pausa fin</th>
                  <th className="px-3 py-2.5 font-semibold">Total</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {registros && registros.records.length > 0 ? (
                  registros.records.map((r) => (
                    <tr key={r.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium">{r.full_name}</td>
                      <td className="px-3 py-2.5">{fmtFecha(r.date)}</td>
                      <td className="px-3 py-2.5">{r.clock_in || '--'}</td>
                      <td className="px-3 py-2.5">{r.clock_out || '--'}</td>
                      <td className="px-3 py-2.5">{r.break_start || '--'}</td>
                      <td className="px-3 py-2.5">{r.break_end || '--'}</td>
                      <td className="px-3 py-2.5">{duraccionTexto(r)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => setModalRegistro(r)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-slate-400">
                      No hay registros
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {registros && registros.total > 0 && (
            <div className="flex items-center justify-center gap-2 mt-5 text-sm text-slate-500">
              <button
                onClick={() => setRPagina((p) => Math.max(1, p - 1))}
                disabled={registros.page <= 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span>
                Página {registros.page} de {Math.max(1, Math.ceil(registros.total / registros.limit))} (
                {registros.total} registros)
              </span>
              <button
                onClick={() => setRPagina((p) => p + 1)}
                disabled={registros.page >= Math.ceil(registros.total / registros.limit)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}

      {/* ------- RESUMEN HORAS ------- */}
      {tab === 'hours' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
          <div className="flex flex-wrap items-end gap-3 mb-5">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Desde</label>
              <input type="date" value={hDesde} onChange={(e) => setHDesde(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Hasta</label>
              <input type="date" value={hHasta} onChange={(e) => setHHasta(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Empleado</label>
              <select
                value={hUsuario}
                onChange={(e) => setHUsuario(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option value="">Todos</option>
                {opcionesUsuario.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => void cargarHoras()}
              className="text-sm px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800"
            >
              Filtrar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b-2 border-slate-200">
                  <th className="px-3 py-2.5 font-semibold">Empleado</th>
                  <th className="px-3 py-2.5 font-semibold">Días trabajados</th>
                  <th className="px-3 py-2.5 font-semibold">Total horas</th>
                </tr>
              </thead>
              <tbody>
                {horas.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-12 text-center text-slate-400">
                      No hay datos en el período seleccionado
                    </td>
                  </tr>
                ) : (
                  horas.map((h) => (
                    <tr key={h.nombre} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium">{h.nombre}</td>
                      <td className="px-3 py-2.5">{h.dias} días</td>
                      <td className="px-3 py-2.5">{fmtMin(h.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-sm text-slate-500">{hTotalRegistros} registros totales</div>
        </div>
      )}

      {/* ------- MODAL USUARIO ------- */}
      {modalUsuario !== null && (
        <ModalUsuario
          usuario={modalUsuario === 'nuevo' ? null : modalUsuario}
          onCerrar={() => setModalUsuario(null)}
          onGuardado={() => {
            setModalUsuario(null);
            void cargarUsuarios();
          }}
        />
      )}

      {/* ------- MODAL REGISTRO ------- */}
      {modalRegistro !== null && (
        <ModalRegistro
          registro={modalRegistro}
          onCerrar={() => setModalRegistro(null)}
          onGuardado={() => {
            setModalRegistro(null);
            void cargarRegistros();
          }}
        />
      )}
    </Layout>
  );
}

function ModalRegistro({
  registro,
  onCerrar,
  onGuardado,
}: {
  registro: Registro;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [fecha, setFecha] = useState(registro.date);
  const [entrada, setEntrada] = useState(registro.clock_in ?? '');
  const [salida, setSalida] = useState(registro.clock_out ?? '');
  const [pausaIni, setPausaIni] = useState(registro.break_start ?? '');
  const [pausaFin, setPausaFin] = useState(registro.break_end ?? '');
  const [notas, setNotas] = useState(registro.notes ?? '');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    setError('');
    setEnviando(true);
    try {
      await api.admin.updateRecord(registro.id, {
        date: fecha,
        clock_in: entrada || null,
        clock_out: salida || null,
        break_start: pausaIni || null,
        break_end: pausaFin || null,
        notes: notas.trim() || null,
      });
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40" onClick={onCerrar}>
      <div
        className="w-full max-w-md bg-white rounded-xl p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-1">Editar registro</h3>
        <p className="text-sm text-slate-500 mb-5">
          {registro.full_name} · {fmtFecha(registro.date)}
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Entrada</label>
              <input
                type="time"
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Salida</label>
              <input
                type="time"
                value={salida}
                onChange={(e) => setSalida(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Pausa inicio</label>
              <input
                type="time"
                value={pausaIni}
                onChange={(e) => setPausaIni(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Pausa fin</label>
              <input
                type="time"
                value={pausaFin}
                onChange={(e) => setPausaFin(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Notas</label>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
            <p className="mt-2 text-xs text-slate-400">
              El total se recalcula automáticamente según entrada, salida y pausas.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCerrar}
            className="text-sm px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => void guardar()}
            disabled={enviando}
            className="text-sm px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalUsuario({
  usuario,
  onCerrar,
  onGuardado,
}: {
  usuario: Usuario | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [username, setUsername] = useState(usuario?.username ?? '');
  const [fullName, setFullName] = useState(usuario?.full_name ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [role, setRole] = useState<Usuario['role']>(usuario?.role ?? 'employee');
  const [active, setActive] = useState(usuario ? usuario.active === 1 : true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    setError('');
    if (!fullName.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setEnviando(true);
    try {
      if (usuario) {
        const datos: Record<string, unknown> = { full_name: fullName.trim(), email, role, active };
        if (password) datos.password = password;
        await api.admin.updateUser(usuario.id, datos);
      } else {
        if (!username.trim() || !password) {
          setError('Usuario y contraseña obligatorios');
          return;
        }
        await api.auth.register({
          username: username.trim(),
          password,
          full_name: fullName.trim(),
          email: email || undefined,
          role,
        });
      }
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40" onClick={onCerrar}>
      <div
        className="w-full max-w-md bg-white rounded-xl p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-5">
          {usuario ? 'Editar usuario' : 'Nuevo usuario'}
        </h3>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {!usuario && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Nombre de usuario
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nombre completo</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Usuario['role'])}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option value="employee">Empleado</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4"
                />
                Usuario activo
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Nueva contraseña{' '}
              <span className="font-normal text-slate-400">
                {usuario ? '(dejar en blanco para mantener)' : ''}
              </span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCerrar}
            className="text-sm px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => void guardar()}
            disabled={enviando}
            className="text-sm px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}