# NEXFRAME FILMS - ORDEN OFICIAL MUAPI FULL AUTOMATION v5

## OBJETIVO
Convertir NEXFRAME FILMS en un sistema 100% automatico, multi-IA, con un solo gateway de API: **MuAPI**.
El usuario debe poder elegir la IA por panel, pero tambien usar modo automatico para que el sistema seleccione la mejor IA segun objetivo, coste, velocidad y calidad.

## REGLA PRINCIPAL
- Frontend -> API interna -> MuAPI Gateway -> Provider/model.
- Ningun boton puede ser decorativo.
- Todo boton debe tener accion real, estado loading, error, success, retry y log.
- Si un proveedor no esta disponible por MuAPI, no se inventa. Se muestra como **Adapter Required** y se deja preparado el conector.

## PIPELINE AUTOMATICO COMPLETO
1. Research con OpenAI/Claude/Gemini/Perplexity.
2. Guion con Script Engine.
3. Storyboard y prompts por escena.
4. Imagenes por escena.
5. Voz/narrador.
6. Doblaje y subtitulos.
7. Videos generativos por escena.
8. Musica, SFX y ambience.
9. Edicion automatica, cortes, efectos, transiciones y color.
10. Render final en 16:9, 9:16, 1:1.
11. Pack de publicacion: titulo, descripcion, hashtags, miniatura, captions y anuncios.

## PANELES Y FUNCION

### Dashboard Principal
Centro de mando. Boton principal: Crear produccion completa. Muestra proyectos, creditos, API conectada, cola y alertas.

### Projects
Gestion de proyectos, carpetas, estado, progreso, duplicar, archivar, exportar y abrir editor.

### Gallery / Historial
Todas las generaciones filtrables por video, imagen, audio, avatar, efecto, subtitulo y export.

### AI Studios Hub
Selector de modulo y comparador de IA por calidad, coste, velocidad y mejor uso.

### Video Studio
T2V, I2V, V2V, extend, upscale, camera control y render final.

### Image Studio
Imagen, referencia, branding, poster, thumbnails, upscaling, remove background.

### Sound Studio
Musica, SFX, ambience, voice bed, mezcla, mastering y libreria.

### Effects Studio
Explosion, fire, smoke, particles, transitions, cleanup, object removal, green screen.

### Lip Sync Studio
Foto/video + audio, avatar, idioma, expresion, resolucion, doblaje y sincronizacion.

### Documentary Studio
Research -> guion -> narrador -> escenas -> subtitulos -> render -> publicacion.

### Music Video Studio
Audio -> beats -> storyboard -> imagenes -> clips -> letras -> efectos -> export.

### Cinema Studio
Controles de camara: lente, focal, apertura, movimiento, color, codec, ratio.

### Script Engine
Guiones, beat sheet, escenas, personajes, dialogos, hooks, CTA, prompts.

### Settings / API Keys
Gestion de MuAPI, proveedores, test, logs, limites, preferencias.

### Security Center
Roles, sesiones, MFA, key vault, auditoria, consentimientos, privacidad.

### Public Website
Landing, pricing, demo, docs, login/signup, status, legal y soporte.

### Billing
Plan, creditos, consumo por proveedor, facturas y limites.

### Deployment
Vercel, Docker, self-hosted, Windows app, backups, env checker.

## RANKING DE IA POR PANEL

### Video Studio - cinematografico
1. Veo 3.1 / Veo 3
2. Runway Gen-4 / Gen-4.5 / Aleph
3. Kling AI 3.0 / Omni
4. Seedance 2.0 / 1.5 Pro
5. Luma Ray / Dream Machine
6. Pika
7. Hailuo / MiniMax
8. ComfyUI + Wan/HunyuanVideo local

### Video Studio - social rapido
1. Pika
2. Kling
3. Runway
4. Luma
5. Captions AI
6. CapCut AI
7. Hailuo/MiniMax

### Image Studio
1. GPT Image / OpenAI Images
2. Google Imagen
3. Midjourney
4. Ideogram
5. Recraft
6. Adobe Firefly
7. Leonardo AI
8. Flux/SDXL + ComfyUI
9. Krea/Magnific/Topaz

### Sound Studio - musica
1. Suno
2. Udio
3. Mureka
4. Soundraw
5. Stable Audio
6. AIVA
7. Beatoven
8. Mubert

### Sound Studio - SFX/ambience
1. ElevenLabs SFX
2. Stable Audio
3. AudioCraft
4. Auphonic
5. iZotope RX
6. Adobe Enhance Speech

### Voice / Narrador
1. ElevenLabs
2. PlayHT
3. Resemble AI
4. Murf
5. WellSaid Labs
6. OpenAI Audio/TTS
7. Google Chirp / Cloud TTS
8. Azure Speech
9. Coqui XTTS local

### Subtitulos / STT / Doblaje
1. WhisperX
2. Deepgram
3. AssemblyAI
4. ElevenLabs Dubbing
5. HeyGen Translate
6. Rask AI
7. Papercup

### Avatar / Lip Sync
1. HeyGen
2. D-ID
3. Synthesia
4. Tavus
5. LiveAvatar
6. Kling Avatar
7. LivePortrait
8. MuseTalk
9. Wav2Lip
10. SadTalker

### Documentary Studio
1. GPT-5.5/OpenAI
2. Claude
3. Gemini
4. Perplexity
5. NotebookLM
6. ElevenLabs
7. Veo
8. Runway
9. Kling
10. Descript
11. DaVinci/Premiere

### Music Video Studio
1. Kling
2. Runway
3. Seedance
4. Luma
5. Veo
6. Kaiber
7. Neural Frames
8. Midjourney
9. Suno/Udio/Mureka

### Editing / Post
1. Descript
2. Runway
3. Premiere Pro AI
4. DaVinci Resolve AI
5. CapCut AI
6. OpusClip
7. Submagic
8. Captions
9. Veed.io
10. Wisecut

### Marketing / Publishing
1. ChatGPT/OpenAI
2. Claude
3. Jasper
4. Anyword
5. AdCreative.ai
6. Creatify
7. Arcads
8. Pencil
9. vidIQ
10. TubeBuddy
11. OpusClip

### 3D / Personajes / Mundos
1. Wonder Dynamics
2. Unreal MetaHuman
3. Meshy
4. Tripo AI
5. Luma 3D/Genie
6. Move AI
7. Rokoko AI
8. DeepMotion
9. Blockade Labs

### Automatizacion
1. n8n
2. Make
3. Zapier
4. Gumloop
5. Flowise
6. LangChain
7. LlamaIndex
8. CrewAI
9. AutoGen
10. Supabase
11. Redis/BullMQ

## SEGURIDAD OBLIGATORIA
- API Key Vault cifrado.
- Rate limits por usuario/proveedor.
- Auditoria de prompts, coste y archivos generados.
- Consentimiento obligatorio para clonacion de voz, caras y avatares.
- Moderacion de contenido y bloqueo de deepfake no autorizado.
- Webhooks firmados para callbacks de MuAPI.
- Backups de proyectos y assets.

## ORDEN PARA CODEX
Implementa primero la arquitectura MuAPI Gateway, luego el registro de proveedores, luego los paneles, luego el pipeline automatico, luego estados profundos, luego seguridad, luego pagina publica, y al final packaging Windows.
