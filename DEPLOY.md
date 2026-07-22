# Guía de despliegue en la nube — APP AHORRO

## ¿Qué conseguirás?

- Datos sincronizados entre móvil, PC e iPhone en tiempo real
- Cifrado AES-256 en el dispositivo — la nube nunca ve tus datos en claro
- Instalable como PWA en iOS/Android o como app nativa en Windows/macOS

---

## ⭐ Opción RECOMENDADA: Supabase (gratis, sin servidor)

Supabase es la opción más fácil: no necesitas servidor propio, no caducas, y el plan gratuito es suficiente para uso personal.

### Pasos (10 minutos)

**1. Crear cuenta y proyecto**
- Ve a [supabase.com](https://supabase.com) → Sign Up (gratis)
- New project → elige nombre, contraseña de base de datos y región (Europa West)
- Espera ~2 minutos a que se cree

**2. Crear la tabla de sincronización**

En Supabase → **SQL Editor** → New query → pega esto y haz clic en **Run**:

```sql
CREATE TABLE IF NOT EXISTS sync_data (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sync_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON sync_data
  FOR ALL USING (true) WITH CHECK (true);
```

**3. Copiar las credenciales**

En Supabase → **Settings → API**:
- Copia la **Project URL** (ej: `https://abcdefghij.supabase.co`)
- Copia la clave **anon / public** (empieza por `eyJ…`)

**4. Configurar la app**

En cada dispositivo → **⚙️ → Sincronización**:
- Selecciona **Supabase**
- Pega la Project URL y la anon key
- Pon un ID de fila (ej: `mi-ahorro`) — el mismo en todos los dispositivos
- Añade una **frase de cifrado** (AES-256, no sale del dispositivo)
- Pulsa **Guardar y sincronizar**

¡Listo! Tus datos se sincronizan automáticamente entre todos los dispositivos.

---

## Opción B: Fly.io (si prefieres tu propio servidor, gratis hasta ~3 apps pequeñas)

### Requisitos
- Cuenta gratuita en [fly.io](https://fly.io)
- `flyctl` instalado: [fly.io/docs/hands-on/install-flyctl](https://fly.io/docs/hands-on/install-flyctl/)
- Node.js instalado en tu PC

### Pasos

```bash
# 1. Entra en la carpeta del proyecto
cd "C:\Users\ddani\Documents\APP AHORRO"

# 2. Inicia sesión en Fly
fly auth login

# 3. Crea la app (solo la primera vez)
#    Cambia "app-ahorro-tuusuario" por un nombre único (solo letras, números y guiones)
fly launch --name app-ahorro-tuusuario --region mad --no-deploy

# 4. Crea el volumen de datos persistente (1 GB)
fly volumes create app_ahorro_data --region mad --size 1

# 5. Configura la clave secreta de sincronización
fly secrets set SYNC_KEY=pon_aqui_tu_clave_muy_segura

# 6. Despliega
fly deploy
```

### Tras el despliegue

1. Tu URL será `https://app-ahorro-tuusuario.fly.dev`
2. Abre la app en el ordenador y ve a ⚙️ → Sincronización
3. Rellena:
   - **URL del servidor**: `https://app-ahorro-tuusuario.fly.dev`
   - **Clave de sincronización**: la misma que pusiste en `SYNC_KEY`
   - **Frase de cifrado**: una frase larga y memorable (guárdala bien — sin ella los datos no se pueden recuperar)
4. Pulsa **Guardar y sincronizar**
5. Repite en el móvil (abre la URL en el navegador del móvil, ve a ⚙️)

### Actualizaciones futuras

```bash
fly deploy
```

---

## Opción B: Railway.app (alternativa, también gratuito con límites)

### Pasos

1. Sube el proyecto a GitHub (crea un repo privado)
2. Ve a [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Selecciona tu repositorio
4. En la pestaña **Variables**, añade:
   - `SYNC_KEY` = tu clave secreta
   - `PORT` = 3000
5. En la pestaña **Settings → Volumes**, añade un volumen montado en `/app/data`
6. Railway proporciona automáticamente una URL HTTPS

---

## Instaladores nativos

### Windows — Instalador .exe (ya generado)

El instalador ya está compilado en `electron/dist/Presupuesto Personal Setup 2.0.0.exe`.

Para regenerarlo tras cualquier cambio en el código:

```bash
# En el directorio del proyecto
node build-web.js
cd electron
npm run build
npx electron-builder build --win nsis --x64 -c ./electron-builder.config.json
```

El `.exe` resultante instala la app con acceso directo en el escritorio y el menú de inicio.
No necesita internet para abrirse (carga desde el PC); sincroniza cuando hay red.

### Android — APK

El proyecto Android ya está generado en `android/`. Para obtener el APK:

1. Descarga [Android Studio](https://developer.android.com/studio) (gratis)
2. Abre Android Studio → Open → selecciona la carpeta `android/` del proyecto
3. Espera que Gradle sincronice (primera vez puede tardar varios minutos)
4. Build → Build Bundle(s) / APK(s) → Build APK(s)
5. El APK quedará en `android/app/build/outputs/apk/debug/`
6. Pásalo al móvil y abre el archivo para instalarlo (necesitas activar "Instalar apps de origen desconocido" en Ajustes del móvil)

Para actualizar el APK tras cambios en el código:
```bash
node build-web.js
npx cap sync android
# Luego Build APK en Android Studio
```

### macOS — Instalador .dmg sin cuenta de pago

El `.dmg` se genera sin firma de Apple (no requiere Apple Developer). macOS mostrará una advertencia de Gatekeeper la primera vez; para abrirlo:
1. Haz **clic derecho → Abrir** en el archivo `.dmg`
2. En el diálogo de seguridad, pulsa **"Abrir de todas formas"**
3. A partir de ese momento se abre normalmente

Para generar el `.dmg` (ejecutar **desde un Mac** con Node instalado):
```bash
# Clonar el repo o copiar el proyecto
git clone https://github.com/ddanieldsdd-glitch/app-ahorro.git
cd app-ahorro
npm install --legacy-peer-deps
npm run installer:mac
# El .dmg quedará en electron/dist/
```

### iOS — PWA (sin Apple Developer)

Sin una cuenta Apple Developer no es posible instalar una app nativa en iPhone/iPad de forma estable. La alternativa completamente funcional es la **PWA desde Safari**:

1. Abre la URL de tu servidor en **Safari** (ej: `https://tu-app.fly.dev`)
2. Pulsa el botón **Compartir** (cuadrado con flecha hacia arriba)
3. Selecciona **"Añadir a pantalla de inicio"**
4. La app aparece en el inicio como cualquier app nativa
5. Funciona **offline** (Service Worker cachea todo), sincroniza cuando hay red
6. Recuerda los datos entre sesiones exactamente igual que una app nativa

---

## Cómo instalar la app como PWA (sin tienda de apps)

### Android
1. Abre la URL de tu app en **Chrome**
2. Menú (⋮) → **Instalar app** (o aparecerá un banner automático)
3. La app queda en tu pantalla de inicio como una app nativa

### iPhone / iPad
1. Abre la URL en **Safari**
2. Botón Compartir → **Añadir a pantalla de inicio**
3. La app se instala sin necesidad de la App Store

### Windows / macOS (Chrome o Edge)
1. Abre la URL en Chrome o Edge
2. Icono ⊕ en la barra de direcciones → **Instalar**
3. La app se abre en su propia ventana sin barra de navegador

---

## Seguridad

- Los datos viajan cifrados con **AES-256-GCM** + PBKDF2 (250.000 iteraciones)
- La frase de cifrado **nunca** se envía al servidor
- Sin la frase, el hosting no puede leer tus movimientos, saldos ni deudas
- Si pierdes la frase, los datos en la nube **no se pueden recuperar** — exporta Excel regularmente

---

## Arranque local (modo actual)

```bash
# Con clave de sincronización
SYNC_KEY=tu_clave node server.js

# Sin clave (solo red local, sin acceso externo)
node server.js
```

La URL de red local se muestra al arrancar (ej: `http://192.168.1.x:3000`).
