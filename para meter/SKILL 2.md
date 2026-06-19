---
name: nexframe-master-agents
description: >
  Sistema de agentes expertos para NEXFRAME FILMS. Activar SIEMPRE que se trabaje en
  cualquier Studio del sistema (Video, Image, Sound, Effects, Lip Sync, Documentary,
  Music Video, Flyer, Cinema, Script Engine, Narrativa, Marketing) — tanto al PROGRAMAR
  el panel (Codex) como al EJECUTAR una generación real en producción. Cubre selección
  de modelo correcto por intención de prompt, consistencia de personaje al 100% entre
  generaciones, control de estilo (hiperrealista / cómic / anime / 3D / etc.), narrativa
  y guion coherente con el tema pedido, pronunciación y entonación correcta en voz/TTS,
  y ensamblaje de documentales con transiciones y efectos reales. Si el usuario menciona
  "perro volando", "video musical", "documental", "voz", "guion", "consistencia de
  personaje", "estilo realista/cómic/anime", o cualquier Studio de NEXFRAME, esta skill
  aplica.
---

# NEXFRAME FILMS — Sistema de Agentes Expertos por Panel

## Qué es esto y cómo se usa

Esta skill define UN agente experto por cada Studio de NEXFRAME FILMS. Cada agente
tiene 30+ años de experiencia equivalente en su disciplina (cinematografía, sonido,
guion, VFX, locución) y su trabajo es traducir lo que el usuario pide en **el modelo
correcto + los parámetros correctos + las reglas de calidad correctas**, basado en los
modelos reales disponibles vía Higgsfield/MuAPI — nunca en suposiciones genéricas.

Esta skill se usa en DOS momentos:

1. **Mientras Codex programa el sistema** — lee `reference/agents-catalog.md` para saber
   exactamente qué lógica debe implementar en cada Studio, y usa `scripts/agents-registry.js`
   como el módulo real a instalar en el backend.
2. **Cuando el sistema ya está en producción** — `scripts/agents-registry.js` se ejecuta
   en cada llamada a `/api/generate`, y antes de mandar el payload a MuAPI, aplica las
   reglas del agente correspondiente al Studio activo (selección de modelo, inyección de
   reglas de consistencia, validación de estilo).

## Regla de oro: selección de modelo por INTENCIÓN, no por Studio fijo

El error más común en NEXFRAME es usar siempre el mismo modelo para un Studio sin
importar lo que pide el prompt. Un agente experto real NO hace esto. En su lugar:

- Si el prompt es libre/creativo/fantástico ("perro volando", "ciudad futurista") →
  modelo de propósito general con alta fidelidad de prompt: `nano_banana_pro`,
  `flux_2` (model: pro), `kling_omni_image`.
- Si el prompt pide un PERSONAJE/AVATAR/MARCA que debe repetirse en varias generaciones →
  modelo de identidad: `soul_2` o `soul_cinematic` con `soul_id` fijo (ver sección de
  Consistencia de Personajes).
- Si el prompt pide estilo cómic, ilustración, vector, logo →
  `recraft-v4-1` con `model_type: vector` o `utility_vector`.
- Si el prompt pide foto de producto/marketing/anuncio →
  `marketing_studio_image` o `ms_image` (con `brand_kit_id` si existe).
- Si el prompt pide edición de una imagen ya existente (cambiar algo puntual) →
  `flux_kontext` o `seedream_v5_lite` (edición por instrucción).
- Si no se sabe cuál usar → `image_auto`, que detecta intención automáticamente.

El mismo principio aplica en video y audio (ver catálogo completo en
`reference/agents-catalog.md`).

## Los 12 agentes expertos (resumen — detalle completo en reference/agents-catalog.md)

| Studio | Agente | Su única obligación |
|---|---|---|
| Image Studio | Director de Fotografía / Ilustrador | Elegir el modelo correcto según estilo pedido (realista, cómic, anime, 3D, vector) y mantener fidelidad total al prompt |
| Video Studio | Director de Cine | Mismo principio + control de movimiento de cámara, duración y resolución reales del modelo elegido |
| Music Video Studio | Director de Videoclip + Continuista | Garantizar que el MISMO personaje/modelo/estilo se mantenga en TODAS las escenas del storyboard |
| Sound Studio | Ingeniero de Audio | Elegir el motor de música/SFX/voz correcto y la duración exacta pedida |
| Narrativa y Voz | Locutor profesional / Director de doblaje | Pronunciación correcta, ritmo, pausas naturales, voz consistente con el idioma y tono pedido |
| Documentary Studio | Editor de documentales | Ensamblar guion + escenas + voz + música + transiciones reales, sin huecos |
| Effects Studio | Supervisor de VFX | Aplicar el efecto pedido con intensidad correcta y mostrar antes/después real |
| Lip Sync Studio | Animador de sincronización labial | Sincronía real labios-audio, idioma correcto, sin desfase |
| Flyer Studio | Diseñador gráfico publicitario | Variantes reales, alta resolución, estilo coherente con la marca |
| Cinema Studio | Director de fotografía técnico | Traducir lente/focal/apertura/movimiento en parámetros reales del modelo de video |
| Script Engine | Guionista profesional | Guion con estructura, tono y duración exactos a lo pedido, sin relleno genérico |
| Marketing | Copywriter + Diseñador | Paquete coherente entre texto, imagen y miniatura, basado en el asset real |

## Consistencia de personajes al 100% (la parte que más te falla)

Esto es lo que garantiza que un video musical o documental NO pierda la cara/estilo
del personaje entre escenas:

1. **Primera generación del personaje**: usar `soul_2` o `soul_cinematic` con una
   referencia de imagen clara. Guardar el `soul_id` devuelto.
2. **TODAS las generaciones siguientes de ese mismo personaje** (en cualquier escena,
   cualquier Studio, cualquier panel) deben reutilizar ESE MISMO `soul_id` — nunca
   generar "de cero" en escenas posteriores.
3. El backend debe guardar el `soul_id` asociado al proyecto completo (no solo a una
   generación), para que Music Video Studio, Documentary Studio y Image Studio usen el
   mismo personaje sin que el usuario tenga que re-subir la referencia cada vez.
4. Si el modelo de VIDEO no soporta `soul_id` directamente, usar la imagen ya generada
   con Soul como `start_image`/`image` de referencia para ese modelo de video
   (ej. Seedance, Kling), para heredar identidad visual de la imagen consistente.
5. Antes de exportar el proyecto final, validar que todas las escenas usaron el mismo
   `soul_id` o la misma imagen de referencia — si una escena se generó sin ella, marcarla
   como inconsistente y regenerarla.

**Límite honesto de esta validación:** `validateProjectConsistency()` (en
`agents-registry.js`) verifica que el MISMO `soul_id` se usó en cada escena — es una
verificación de **proceso** (¿se pidió el id correcto?), no una verificación **visual**
real (¿la cara generada se ve igual?). Un modelo de IA generativa puede, en casos
puntuales, producir variación visual real incluso con el mismo `soul_id` si el proveedor
tiene fallos de consistencia internos — eso queda fuera del control de este sistema y es
una limitación conocida de los modelos de identidad actuales, no un bug a corregir aquí.
Si se necesita verificación visual real (comparar rostros generados entre sí), se
requeriría un modelo adicional de reconocimiento facial/similitud (fuera del alcance de
esta skill) comparando los outputs antes de aceptarlos.

Ver implementación real en `scripts/agents-registry.js`, función `resolveCharacterConsistency()`.

## Narrativa, guion y voz sin errores de pronunciación

1. El guion (Script Engine / Narrativa y Voz) se genera primero en TEXTO PURO, revisado
   contra duración objetivo y tono — nunca se manda a voz un guion sin revisar.
2. Antes de enviar texto a TTS, limpiar: abreviaturas ambiguas, números mal formateados,
   nombres propios que el motor de voz pueda pronunciar mal (expandir manualmente si es
   necesario, ej. "Dr." → "Doctor").
3. Elegir el motor de voz correcto según idioma exacto del contenido — los modelos TTS
   disponibles (ElevenLabs, Minimax, Seed Speech, Vibe Voice, Cozy Voice, Inworld) tienen
   catálogos de voces por idioma; nunca usar una voz en inglés para texto en español.
4. Para EXPEDIENTE 47 / CÓDIGO BLANCO у cualquier narrador fijo ("El Archivero"), guardar
   el `voice_id` específico usado y reutilizarlo siempre — igual que el `soul_id` de
   personajes visuales, la voz también debe ser consistente entre episodios.
5. Insertar pausas naturales en el texto (puntuación, saltos de línea) antes de mandarlo
   a TTS — un guion sin puntuación clara genera lectura robótica y pronunciación corrida.

## Documentales con efectos y transiciones reales

1. El Documentary Studio NO debe concatenar clips crudos. Cada transición entre escenas
   debe ser un parámetro explícito (corte directo, fade, dissolve) decidido por el agente
   según el tono narrativo de esa escena específica.
2. La música y el SFX se generan DESPUÉS de tener la duración real de cada escena de
   video (nunca antes), para que el audio encaje exactamente sin recortes forzados.
3. Cada escena del documental hereda el mismo `soul_id`/referencia visual si hay un
   personaje o anfitrión recurrente (ver sección de consistencia).
4. El ensamblaje final debe verificar: ¿la duración total coincide con la suma de
   escenas?, ¿hay audio en cada escena?, ¿las transiciones están aplicadas y no son
   cortes abruptos no intencionados?

## Entrega final "lista para subir" (Documentary y Music Video / contenido largo)

Esto es lo que falta para que un documental de 30 minutos o un video musical largo no
se entregue como piezas sueltas, sino como UN archivo final editado:

1. **No basta con generar clips por escena.** El agente de Documentary/Music Video debe
   pasar por una etapa final obligatoria de **ensamblaje** que:
   - Concatena todos los clips de video en el orden correcto del guion/storyboard.
   - Aplica corrección de color consistente entre TODAS las escenas (mismo LUT/perfil
     de color para todo el documental, no un color distinto por escena).
   - Sincroniza la narración (voz) con el video, escena por escena, respetando los
     tiempos reales de cada clip.
   - Mezcla la música/SFX de fondo a un volumen que no tape la narración (mezcla de
     audio con niveles diferenciados: voz al frente, música de fondo más baja).
   - Aplica las transiciones decididas por el Agente Documentary (corte, fade, dissolve)
     entre cada escena.
   - Exporta UN archivo de video final (mp4) listo para subir, no una carpeta de clips
     sin unir.
2. **Esto requiere un motor de edición de video real en el backend** (no se puede hacer
   solo con llamadas a modelos generativos). Ver `scripts/video-assembly-pipeline.js`
   para la implementación de referencia con FFmpeg, que ya forma parte de tu stack
   GRANOSCAR (FFmpeg NVENC).
3. **El job del proyecto debe tener un estado final explícito** `assembly: pending →
   processing → completed` separado del estado de generación de cada escena — un
   documental no está "listo" solo porque todas sus escenas generaron video; está listo
   cuando el ensamblaje final terminó y produjo el archivo único.
4. Mismo principio para Music Video Studio: el resultado final es UN videoclip
   completo con todas las escenas unidas en el orden del storyboard, con la canción
   original como pista de audio maestra (no regenerada, la canción real del usuario).

## Carga universal de referencias (imágenes, PDF, texto, audio) en cualquier Studio

El usuario debe poder subir CUALQUIER tipo de referencia en CUALQUIER Studio que lo
necesite (especialmente Music Video y Documentary), sin restricción de un solo tipo de
archivo:

1. Cada Studio que acepte referencias debe tener una zona de carga única que reciba:
   imágenes (foto del artista, referencia visual), PDF (guion ya escrito, biografía,
   investigación previa), texto plano/pegado directamente, audio (la canción, una
   narración de muestra), video (clip de referencia de estilo).
2. El backend debe diferenciar el TIPO de cada archivo subido y procesarlo según
   corresponda antes de usarlo en el prompt o pipeline:
   - PDF/texto → extraer el contenido textual (ya tienes este patrón en tu stack:
     ReportLab/extracción de texto) y usarlo como contexto adicional del guion o de la
     descripción del personaje/artista — NUNCA ignorarlo silenciosamente.
   - Imagen → usar como referencia visual (`soul_id` si es personaje, o `start_image`
     si es referencia de escena/estilo).
   - Audio → usar como pista maestra (Music Video) o como muestra de voz a clonar/imitar
     si el motor TTS lo soporta.
3. Ningún Studio debe limitar a "solo 1 imagen" si el formulario no lo dice
   explícitamente — permitir múltiples referencias en la misma sesión de carga
   (ej. varias fotos del mismo artista en distintos ángulos para mejorar la
   consistencia del `soul_id`).
4. Validar tipo MIME y tamaño (ya definido en el documento de seguridad: máx. 50 MB por
   archivo, 6 archivos por request) — pero NUNCA rechazar un tipo de archivo válido
   (PDF, texto, imagen, audio, video) por estar "fuera del flujo esperado" de ese Studio.

## Alcance temático — qué NO debe filtrar el sistema

Esto es una decisión de producto explícita, no un descuido: NEXFRAME FILMS es una
herramienta de producción para contenido editorial/documental real (true crime,
misterios sin resolver, fenómenos no explicados, historia oculta, ciencia, lo que sea).
El sistema:

- NO debe rechazar un tema por ser "polémico", "no convencional", "conspirativo" o
  "poco mainstream" — el criterio editorial sobre qué tan creíble es un tema le
  corresponde a YANKYFILMS, no al sistema.
- SÍ debe seguir evitando contenido violento explícito, sexual, de odio, o que facilite
  daño real (esto no cambia y es un límite técnico/legal estándar, no negociable).
- La diferencia es entre TEMA (libre, cualquiera) y CONTENIDO EXPLÍCITO DENTRO del tema
  (sí limitado): se puede hacer un documental sobre un crimen real sin necesidad de
  generar imágenes gráficas de violencia explícita — el agente de Image/Video Studio
  debe optar por representaciones sugerentes/atmosféricas en esos casos, no rechazar el
  documental completo.

## Arquitectura completa (7 módulos — cómo se conectan entre sí)

```
                     /api/generate, /api/muapi/generate/pipeline
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │  pipeline-orchestrator.js      │  ← EL CONECTOR. Llama a
                      │  (runSimpleGeneration /         │    todo lo demás en el
                      │   runLongFormPipeline)          │    orden correcto.
                      └───────────────┬─────────────────┘
                  ┌───────────────────┼───────────────────┬─────────────────┐
                  ▼                   ▼                   ▼                 ▼
      agents-registry.js   upload-classifier.js   db-adapter.js   progress-reporter.js
      (qué modelo/params)  (clasifica PDF/imagen/   (persistencia    (estado en vivo
                            audio/texto subidos)     real del         para el panel
                                                      proyecto/job)    Generation Process)
                  │
                  ▼ (solo Documentary/Music Video, al final)
      video-assembly-pipeline.js  ──►  subtitle-generator.js
      (FFmpeg: normaliza, concatena,    (quema subtítulos
       mezcla audio, exporta final)      broadcast-standard)
```

Cada módulo es independiente y testeable por separado, pero `pipeline-orchestrator.js`
es el único que el backend de NEXFRAME debe llamar directamente desde sus rutas — los
demás son sus dependencias internas.

## Instalación real en el sistema (para Codex)

1. Copiar los 7 archivos de `scripts/` al backend de NEXFRAME, ej. `/server/agents/`:
   `agents-registry.js`, `db-adapter.js`, `progress-reporter.js`, `upload-classifier.js`,
   `video-assembly-pipeline.js`, `subtitle-generator.js`, `pipeline-orchestrator.js`.
2. Verificar dependencias npm necesarias: `pdf-parse` (lectura de PDF subidos) y
   FFmpeg instalado en el sistema (ya en tu stack GRANOSCAR/YF AutoClip V2).
3. En `/api/generate` (Studios simples: Image, Video, Sound, Effects, Lip Sync,
   Flyer, Cinema, Script Engine, Narrativa, Marketing): llamar a
   `runSimpleGeneration({ studioName, userPrompt, projectContext, requestedCount,
   callMuApi, jobId })` de `pipeline-orchestrator.js`. `callMuApi` es tu gateway MuAPI
   YA EXISTENTE — este módulo no lo reemplaza, decide qué mandarle.
4. En `/api/muapi/generate/pipeline` (Documentary y Music Video Studio): llamar a
   `runLongFormPipeline({ projectId, jobId, studioName, scenesPlan, narrationScript,
   musicTrackPath, uploadedFiles, savedFilePaths, callMuApi, callTtsApi, fixedVoiceId })`.
5. El frontend debe consultar el job vía `/api/task/:id` y leer los campos `stage`,
   `stagePercent`, `overallPercent`, `sceneProgress` que `progress-reporter.js` escribe
   en cada paso — esto es lo que alimenta una barra de progreso real en "Generation
   Process", no una animación falsa.
6. Si `runLongFormPipeline` devuelve `ok: false`, el frontend debe mostrar
   `result.issues` literalmente al usuario y ofrecer "reintentar desde la escena X"
   usando `result.completedScenes` (el trabajo ya hecho NUNCA se descarta).
7. Para subtítulos: después de tener `narrationAudioPath` y su transcripción con
   timestamps por palabra (WhisperX), llamar a `generateAndBurnSubtitles()` de
   `subtitle-generator.js` ANTES o DESPUÉS del ensamblaje final, según si quieres
   subtítulos quemados en el .mp4 final o como pista `.srt` separada para subir aparte.

Ver `reference/agents-catalog.md` para el detalle completo de reglas por agente, y
`reference/model-styles-map.md` para la tabla completa de qué modelo usar según estilo
visual pedido (hiperrealista, cómic, anime, 3D, acuarela, etc.).
