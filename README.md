# Fantasy LPF

Fantasy gratuito de la Liga Profesional Argentina. Cualquiera entra con su cuenta de Google, crea una liga y comparte el link para que se sumen sus amigos.

- **Sitio:** carpeta `public/` (HTML + JavaScript, sin compilar), publicado en Firebase Hosting.
- **Datos:** Firestore. Cada liga tiene su propio mercado, precios y clasificación.
- **Estadísticas:** `scripts/sync.mjs` lee FotMob cada 15 minutos desde GitHub Actions y guarda las estadísticas de cada partido terminado. Los puntos se calculan en el navegador según la posición de cada jugador.

## Cómo está organizado

| Ruta | Qué es |
|---|---|
| `public/index.html` | Página y estilos |
| `public/app.js` | Juego: ligas, mercado, puntos |
| `public/data.js` | Clubes y planteles |
| `public/fmdata.js` | Minutos y nota 2026 de cada jugador (para el valor inicial) |
| `public/firebase-config.js` | Configuración pública de Firebase |
| `firestore.rules` | Quién puede leer y escribir qué |
| `scripts/sync.mjs` | Sincronización de estadísticas |
| `.github/workflows/publicar.yml` | Publica el sitio en cada cambio |
| `.github/workflows/estadisticas.yml` | Corre la sincronización cada 15 minutos |

## Puesta en marcha

1. En Firebase: activar **Authentication → Google** y crear **Firestore**.
2. Completar `public/firebase-config.js` y el `projectId` en `.firebaserc`.
3. En GitHub → Settings → Secrets and variables → Actions, crear el secreto `FIREBASE_SERVICE_ACCOUNT` con el JSON de la cuenta de servicio (Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada).
4. En Firebase → Authentication → Configuración → **Dominios autorizados**, verificar que estén `<proyecto>.web.app` y `<proyecto>.firebaseapp.com`.
5. Hacer push a `main`. El sitio queda en `https://<proyecto>.web.app`.

Para probar la sincronización sin esperar: GitHub → Actions → "Estadísticas de partidos" → **Run workflow**.

## Si algo falla

- **"Publicar sitio" falla por permisos:** en Google Cloud → IAM, darle a la cuenta `firebase-adminsdk-...` el rol **Administrador de Firebase** (Firebase Admin).
- **El login con Google no abre:** revisar los dominios autorizados del paso 4.
- **La sincronización no encuentra partidos:** revisar el registro de la corrida en Actions; FotMob a veces cambia el formato de su página.
- **El repositorio debe ser público** para que GitHub Actions no tenga límite de minutos (en privado el plan gratis no alcanza para correr cada 15 minutos). No contiene ningún secreto.
