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