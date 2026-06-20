---
name: nexframe-films-handoff
description: Contexto completo de traspaso para continuar el proyecto NEXFRAME FILMS en otra cuenta o conversacion de Codex. Usar cuando se trabaje en E:\PROYECTO CODEX\NEXFRAME FILMS, en el panel React/Vite de NEXFRAME FILMS, en integraciones MuAPI, autenticacion, paneles de IA, backups, GitHub o ajustes visuales del dashboard.
---

# NEXFRAME FILMS - Skill de Traspaso para Codex

Este skill sirve para que otra cuenta de Codex entienda el proyecto NEXFRAME FILMS sin necesitar toda la conversacion anterior.

Antes de modificar cualquier archivo, leer:

- `E:\PROYECTO CODEX\NEXFRAME FILMS\AGENTS.md`
- Este `SKILL.md`
- Los archivos concretos que se vayan a tocar.

No incluir ni copiar claves privadas en mensajes, commits, backups publicos ni archivos frontend.

## Identidad del Proyecto

Usuario principal: YANKYFILMS.

Proyecto local:

- Carpeta: `E:\PROYECTO CODEX\NEXFRAME FILMS`
- Repo GitHub indicado por el usuario: `https://github.com/yankyfilms-alt/nexframe-films`
- App principal: React/Vite con backend local Express.
- URL frontend local habitual: `http://localhost:5173`
- API local habitual: `http://localhost:8787`
- Tema visual: dark cinematic premium, negro, rojo neon, dorado, glassmorphism, estilo broadcast/cine.
- Idioma principal: espanol latinoamericano.

Reglas absolutas del usuario:

- Hacer exactamente lo pedido, sin agregar funciones extra no solicitadas.
- No tocar GitHub ni actualizar backup salvo orden explicita.
- No romper lo que ya funciona.
- No dejar botones muertos.
- No usar placeholders falsos.
- No exponer API keys ni secrets.
- Entregar todo en espanol.

## Estado Actual Importante

El proyecto ya tiene:

- Dashboard NEXFRAME FILMS con paneles de IA.
- Paneles de Video, Image, Sound, Effects, Lip Sync, Documentary, Music Video, Narrativa/Voz, Analizador YouTube, Flyer, Cinema, Script, Marketing, Public Website, Security, Assets, Billing, Help, etc.
- Integracion local con backend Express y endpoints `/api/*`.
- Persistencia local por archivos/estado del proyecto.
- Integracion MuAPI en progreso.
- Sistema de modelos y paneles en `src/data/models.js` y `src/data/models-registry.js`.
- Backend principal en `server.js`.
- Frontend principal en `src/App.jsx`.
- Estilos globales en `src/styles/global.css`.

El usuario quiere que todos los paneles sean reales y funcionales, sin ejemplos falsos, con resultados generados guardados, descarga, vista previa, papelera/restauracion, botones funcionales y prompts exactos enviados a la IA.

## Archivos y Carpetas Clave

Codigo:

- `E:\PROYECTO CODEX\NEXFRAME FILMS\src\App.jsx`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\src\styles\global.css`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\src\data\models.js`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\src\data\models-registry.js`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\src\lib\store.js`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\server.js`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\package.json`

Documentos y assets que el usuario ha aportado:

- `E:\PROYECTO CODEX\NEXFRAME FILMS\Multi-IA Integration for NEXFRAME FILMS.pdf`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\NEXFRAME_FILMS_CODEX_MASTER_V2_FULL_SYSTEM.pdf`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\YANKYFILMS_Kling_Master_Agent.pdf`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\NEXFRAME_FILMS_VISUAL_ASSET_PACK_CODEX.pdf`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\NEXFRAME_FILMS_FULL_PANEL_GUIDE_CODEX_v2.pdf`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\NEXFRAME_FILMS_SUBPANELES_INTERNOS_GUIDE_CODEX_v3.pdf`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\NEXFRAME_FILMS_ORDEN_OFICIAL_CODEX_PROMPT_v4.md`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\NEXFRAME_FILMS_OFFICIAL_SYSTEM_ORDER_FULL_CODEX_v4.pdf`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\nexframe_visual_assets_png_pack.zip`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\NEXFRAME_FILMS_FULL_PANEL_AND_ASSET_PNGS_v2.zip`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\NEXFRAME_FILMS_SUBPANELES_INTERNOS_PNGS_v3.zip`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\FOTO DE CARRUSER WEB\PANELES\Nueva carpeta`

Archivos para integrar que el usuario menciono:

- `E:\PROYECTO CODEX\NEXFRAME FILMS\para meter\agents-catalog.md`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\para meter\agents-registry.js`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\para meter\model-styles-map.md`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\para meter\upload-classifier.js`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\para meter\video-assembly-pipeline.js`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\para meter\SKILL.md`
- `E:\PROYECTO CODEX\NEXFRAME FILMS\para meter\SKILL 2.md`

Archivo sensible:

- `E:\PROYECTO CODEX\NEXFRAME FILMS\API Key MUAPI UNIVERSAL.json`

No copiar su contenido a chats, commits, docs ni frontend.

## Backup y GitHub

Backup local ya creado anteriormente:

- ZIP: `E:\PROYECTO CODEX\NEXFRAME FILMS\_backups\nexframe-films-backup-20260620-003544.zip`
- Manifest: `E:\PROYECTO CODEX\NEXFRAME FILMS\_backups\nexframe-films-backup-20260620-003544.manifest.txt`
- SHA256: `F1F4941E2AE44CDC1E7FF631A89EF0E212A4764ECFAD3806F4009521F6B8FE23`

El usuario dijo despues:

- "No me toque nada de eso."
- Todo cambio nuevo se revisa primero.
- Solo subir a GitHub o actualizar backup cuando el usuario diga explicitamente: cargarlo, subirlo, actualizar copia de seguridad o similar.

## Comandos Habituales

Instalar dependencias si falta algo:

```powershell
npm install
```

Frontend:

```powershell
npm run dev
```

Backend API:

```powershell
npm run dev:api
```

Build:

```powershell
npm run build
```

Probar API planes:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8787/api/billing/plans
```

## Trabajo Reciente en Login Publico

El usuario pidio mejorar el login publico segun una imagen de referencia y un prompt adjunto.

Archivos tocados en esa pasada:

- `src/App.jsx`
- `src/styles/global.css`
- `server.js`

Cambios aplicados:

- Nueva pantalla `/login` con zona izquierda informativa y panel de acceso premium.
- Login y registro con validacion frontend.
- Mostrar/ocultar contrasena.
- Recordarme con sesion extendida en backend.
- Modal de recuperacion de contrasena.
- Ruta `/reset-password`.
- Endpoints backend:
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/password-reset`
  - `POST /api/auth/reset-password`
  - `GET /api/billing/plans`
- Google OAuth preparado con `GET /api/auth/google/url` y callback existente.
- Cookies HttpOnly con helper central.
- `passwordResets` agregado al DB local.
- Rutas legales agregadas:
  - `/terms`
  - `/privacy`
  - `/contact`

Estado de QA antes del corte:

- `npm run build` paso correctamente.
- `GET http://localhost:5173/login` respondia `200`.
- `GET http://localhost:8787/api/billing/plans` respondia con planes.
- Faltaba terminar prueba Playwright completa de login/registro/reset visual despues de la ultima edicion.

Si se retoma este punto, ejecutar QA real antes de declarar terminado.

## Variables de Entorno Relevantes

No hardcodear secrets. Usar `.env` o variables del sistema.

Google OAuth:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `PUBLIC_APP_URL`

Cookies:

- `COOKIE_SECURE=true` en produccion.
- `NODE_ENV=production` tambien activa cookies seguras.

MuAPI:

- La clave existe localmente en `API Key MUAPI UNIVERSAL.json`.
- Migrar a variable de entorno segura cuando se prepare produccion.
- Nunca exponer en frontend.

## Direccion de Producto

El sistema debe trabajar por debajo con IA generativa estilo `anil-matcha/open-generative-ai`, pero manteniendo el panel visual NEXFRAME.

Repositorio de referencia mencionado:

- `https://github.com/anil-matcha/open-generative-ai`

El usuario quiere una sola API universal MuAPI para acceder a modelos. La UI debe permitir o automatizar seleccion de modelos segun capacidades:

- Si un modelo solo permite 720p, cambiar automaticamente la calidad a 720p.
- Si un modelo solo permite 10 segundos, ajustar duracion automaticamente.
- Evitar errores por parametros incompatibles.
- Mostrar payload real enviado y respuesta real recibida cuando el usuario pida pruebas.

## Prioridades de Paneles

### Image Studio

Requisitos del usuario:

- Quitar ejemplos falsos.
- Mostrar solo resultados reales generados.
- La vista previa del resultado debe ser mas pequena, no ocupar media pantalla.
- La imagen debe verse completa, no recortada de forma inutil.
- Al hacer click sobre la imagen, abrir visor grande con calidad completa.
- Botones funcionales:
  - Prompt
  - Descargar
  - Compartir enlace
  - Borrar
  - Papelera/restaurar
- El prompt escrito por el usuario debe enviarse exactamente como direccion creativa.

### Video Studio

Requisitos:

- Evitar `Failed to fetch` desde el panel.
- Generar realmente por MuAPI/backend.
- Preview compacto arriba.
- Lista de videos generados debajo.
- Reproducir, descargar, borrar, restaurar.
- Permitir audio local donde aplique.

### Sound / Narrativa / Voz

Requisitos:

- Reproducir audio en panel.
- Descargar MP3/WAV segun corresponda.
- Narrativa estilo ElevenLabs/Level Lab.
- Texto largo, aprox. hasta 10.000 caracteres.
- Voces multiidioma.
- Nunca estirar audio para encajar duracion; expandir guion si falta.

### Documentary Studio

Requisitos:

- Crear documental completo desde tema/guion/audio local.
- Generar narrativa, escenas, imagenes/video, musica, subtitulos y montaje.
- Duraciones largas como 35-40 min.
- Si se carga narracion local, usarla como eje y montar video sobre esa duracion.

### Music Video Studio

El usuario paso prompt maestro y una imagen de referencia.

Debe funcionar como director/agente de videoclip:

- Upload song.
- Upload artist photo, pero regla permanente para videos musicales: el artista nunca aparece en pantalla salvo que el usuario contradiga explicitamente esta regla.
- Upload video clips.
- Analisis de audio/BPM/energia.
- Guion sincronizado con cancion.
- Storyboard.
- Personaje/consistencia visual.
- Escenas.
- Clips.
- Lip Sync si aplica.
- Efectos.
- Montaje al beat.
- Exportacion.

### Marketing

El usuario quiere redisenarlo como panel real de marketing:

- El usuario mete guion/producto.
- Puede cargar foto de personaje, producto y video.
- El sistema crea:
  - Video promocional completo.
  - Fotos.
  - Flyers.
  - Covers.
  - Miniaturas.
  - Campanas.
- Debe elegir automaticamente modelos/IA segun la tarea.
- Debe usar agente experto en marketing, publicidad y ventas.
- Debe soportar estilos: realista, muneco, comic, personalizado, etc.
- Debe generar narrativa, voz, musica de fondo y montaje.

### Analizador YouTube

Requisitos:

- Cargar URL de canal.
- Analizar canal.
- Proponer nichos y nombres.
- Dar 5 ideas.
- Permitir generar 5 guiones en PDF.
- Chat tipo ChatGPT/Claude para seguir iterando.
- Enviar idea a Documentary, Video, Music Video u otro panel con datos precargados.

## Estilo Visual

Mantener:

- Dark cinematic.
- Rojo oscuro, negro, dorado.
- Cristal/glassmorphism.
- Bordes 8px o coherentes con sistema.
- Nada de landing generica cuando se trabaja en app.
- No meter fotos de referencia como contenido final; usarlas solo como guia visual.
- Si hay preview de generacion, que sea profesional, compacta y clara.
- No usar ejemplos falsos mezclados con resultados reales.

Logo/dashboard:

- El usuario pidio logo con efecto VFX glitch.
- Hero/dashboard con imagen de fondo tipo carousel cinematografico.
- El logo y hero deben verse premium sin meter una captura entera del panel como imagen.

## Seguridad

Aplicar siempre:

- API keys en backend/env, nunca frontend.
- Hash de passwords.
- Cookies HttpOnly.
- Rate limit.
- Validacion frontend y backend.
- Mensajes seguros.
- No revelar si un email existe en recuperacion.
- No commitear `.env`, keys, `API Key MUAPI UNIVERSAL.json`.

## Como Debe Trabajar Codex en Este Proyecto

1. Leer el archivo o prompt nuevo que el usuario adjunte.
2. Inspeccionar el codigo real antes de editar.
3. Hacer cambios pequenos y verificables.
4. No modificar paneles no pedidos.
5. Usar `rg` para buscar.
6. Usar `apply_patch` para ediciones manuales.
7. Ejecutar `npm run build` cuando toque frontend/backend.
8. Si hay UI, probar con Playwright o navegador si esta disponible.
9. Reportar:
   - Archivos modificados.
   - Pruebas realizadas.
   - Resultado real.
   - Limitaciones reales sin maquillar.

## Mensaje de Arranque Recomendado para Otra Cuenta

Pegar esto en la nueva conversacion:

```text
Estoy continuando el proyecto NEXFRAME FILMS en E:\PROYECTO CODEX\NEXFRAME FILMS.
Lee primero E:\PROYECTO CODEX\NEXFRAME FILMS\nexframe-handoff-skill\SKILL.md y E:\PROYECTO CODEX\NEXFRAME FILMS\AGENTS.md.
No subas a GitHub ni actualices backup hasta que yo lo diga.
No toques archivos fuera del alcance de la tarea que te pida ahora.
Trabaja en espanol y prueba antes de decir que esta listo.
```

