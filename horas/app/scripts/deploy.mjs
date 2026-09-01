// Genera el desplegable en la carpeta HOSTALIA/ (raíz del proyecto):
//   - build del frontend (index.html + assets/) desde app/dist
//   - backend PHP (api/, src/, .htaccess, schema.sql, ...)
// Nunca copia la base de datos local (data/horario.db) ni el código fuente de app/.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(dirname(fileURLToPath(import.meta.url))); // horas/app
const horasDir = dirname(appDir);                                // horas/
const projectRoot = dirname(horasDir);                           // raíz del proyecto
const target = join(projectRoot, 'HOSTALIA');
const dist = join(appDir, 'dist');

if (!existsSync(dist)) {
  console.error('No existe app/dist/. Ejecuta primero: npm run build');
  process.exit(1);
}

mkdirSync(target, { recursive: true });

// 1) Build del frontend: index.html + assets/
for (const entrada of ['index.html', 'assets', 'vite.svg', 'favicon.ico']) {
  rmSync(join(target, entrada), { recursive: true, force: true });
}
cpSync(dist, target, { recursive: true });
console.log('✓ Build del frontend → HOSTALIA/');

// 2) Backend PHP y configuración
const backend = ['.htaccess', 'api', 'src', 'schema.sql', 'README.md', 'dev-router.php'];
for (const entrada of backend) {
  const origen = join(horasDir, entrada);
  if (!existsSync(origen)) continue;
  rmSync(join(target, entrada), { recursive: true, force: true });
  cpSync(origen, join(target, entrada), { recursive: true });
}

// 3) data/: solo la protección .htaccess (nunca la BD local)
rmSync(join(target, 'data'), { recursive: true, force: true });
mkdirSync(join(target, 'data'), { recursive: true });
cpSync(join(horasDir, 'data', '.htaccess'), join(target, 'data', '.htaccess'));

console.log('✓ Backend PHP → HOSTALIA/');
console.log('Desplegable listo en: ' + target);