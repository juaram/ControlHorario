// Geolocalización del dispositivo. Requiere HTTPS en producción y que el
// empleado permita el acceso a la ubicación.

export interface GeoPosicion {
  lat: number;
  lon: number;
  accuracy: number; // precisión en metros
}

const MENSAJES_ERROR: Record<number, string> = {
  1: 'Denegaste el permiso de ubicación',
  2: 'No se pudo obtener la ubicación',
  3: 'Tiempo de espera agotado',
};

export function obtenerUbicacion(): Promise<GeoPosicion> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Tu navegador no soporta la geolocalización'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: Math.max(0, Math.round(pos.coords.accuracy)),
        }),
      (err) =>
        reject(
          new Error(MENSAJES_ERROR[err.code] || 'No se pudo obtener tu ubicación'),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

// Geocodificación inversa con OpenStreetMap (Nominatim): a partir de unas
// coordenadas devuelve el nombre de la calle (y número) o del negocio cercano.
// Gratis y sin API key; solo lo usa el panel de administración.

export function obtenerDireccion(lat: number, lon: number): Promise<string> {
  const url =
    'https://nominatim.openstreetmap.org/reverse' +
    `?format=jsonv2&zoom=18&addressdetails=1&accept-language=es&lat=${lat}&lon=${lon}`;

  return fetch(url, { headers: { Accept: 'application/json' } }).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d: Record<string, unknown> = await res.json();
    const dir = componerDireccion(d);
    if (!dir) throw new Error('Sin dirección');
    return dir;
  });
}

function componerDireccion(d: Record<string, unknown>): string {
  const a = (d.address ?? {}) as Record<string, string>;

  // 1) Dirección postal: calle + número, barrio y localidad
  const partes: string[] = [];
  const calle = a.road || a.pedestrian || a.footway || a.cycleway || '';
  const numero = a.house_number || '';
  if (calle) partes.push(numero ? `${calle} ${numero}` : calle);
  const barrio = a.neighbourhood || a.suburb || a.quarter || a.city_district || '';
  if (barrio) partes.push(barrio);
  const localidad = a.city || a.town || a.village || a.municipality || '';
  if (localidad) partes.push(localidad);

  // 2) Si el punto cae justo en un sitio con nombre (negocio, comercio...),
  //    ponerlo delante. Se ignoran categorías puramente geográficas.
  const nombre = typeof d.name === 'string' ? d.name : '';
  const categoria = typeof d.category === 'string' ? d.category : '';
  const esSitio =
    nombre !== '' &&
    !['place', 'building', 'highway', 'waterway', 'natural', 'landuse', 'boundary'].includes(
      categoria,
    );

  if (esSitio) {
    const dir = partes.join(', ');
    return dir ? `${nombre}, ${dir}` : nombre;
  }
  return partes.join(', ') || (typeof d.display_name === 'string' ? d.display_name : '');
}