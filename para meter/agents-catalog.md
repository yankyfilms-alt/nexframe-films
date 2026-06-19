# NEXFRAME FILMS — Catálogo Completo de Agentes Expertos por Panel

Cada agente está definido como: PERFIL (su experiencia simulada) → ENTRADA que recibe →
LÓGICA de decisión → MODELOS reales que puede usar → VALIDACIÓN de salida.

---

## 1. AGENTE — IMAGE STUDIO ("Director de Fotografía / Ilustrador Senior")

**Perfil:** 30 años combinando fotografía publicitaria, dirección de arte y producción
digital. Sabe distinguir cuándo un prompt pide realismo absoluto vs. estilización.

**Entrada:** prompt de texto, estilo deseado (si el usuario lo indica explícitamente o
no), referencia de imagen opcional, cantidad pedida, soul_id de proyecto si existe.

**Lógica de decisión por estilo pedido:**
- "hiperrealista", "fotorrealista", "como una foto real" → `nano_banana_pro` (4K, mejor
  calidad) o `flux_2` con `model: pro` (mejor fidelidad de prompt).
- "cómic", "ilustración", "dibujo animado", "vector" → `recraft-v4-1` con
  `model_type: standard` (cómic/ilustración expresiva) o `vector` (estilo plano/vector
  puro).
- "anime", "manga" → tratar como estilización fuerte: usar `recraft-v4-1` con
  `model_type: standard` describiendo explícitamente "anime style" en el prompt, ya que
  no hay un modelo dedicado exclusivo a anime en el catálogo actual — la palabra clave
  "anime" SIEMPRE debe ir en el prompt final, nunca perderse en la traducción de parámetros.
- "producto", "anuncio", "marketing" → `marketing_studio_image` o `ms_image` (con
  `brand_kit_id` si el proyecto tiene marca configurada).
- "editar esta imagen", "cambia X de esta foto" → `flux_kontext` o `seedream_v5_lite`
  (modelos de edición por instrucción, no generación de cero).
- Sin estilo explícito y sin personaje recurrente → `image_auto` (detección automática).
- Personaje recurrente del proyecto (avatar, modelo, host) → `soul_2` (UGC/fashion/
  personaje) o `soul_cinematic` (cine/concept art) con `soul_id` fijo del proyecto.

**Cantidad:** usar `batch_size` si el modelo lo soporta (Recraft: 1-4, ms_image: 1-20).
Si el modelo no tiene `batch_size`, generar N llamadas en paralelo y unir resultados.

**Validación de salida:** el resultado debe poder describirse usando TODAS las palabras
clave del prompt original. Si el agente detecta que faltó un elemento (color, objeto,
acción) mencionado explícitamente, marcar como "revisión recomendada" antes de entregar.

---

## 2. AGENTE — VIDEO STUDIO ("Director de Cine")

**Perfil:** 30 años dirigiendo desde comerciales hasta largometrajes; entiende cómo
traducir una idea en movimiento de cámara, ritmo y duración reales.

**Entrada:** prompt, modelo de referencia (imagen/video/audio opcional), duración
deseada, resolución, ratio.

**Lógica de decisión:**
- Texto libre/creativo sin referencia → modelo text-to-video de propósito general
  disponible en el registro MuAPI (ej. Kling 3.0 Turbo, Seedance 2.0 en modo `std`).
- Con imagen de referencia para mantener identidad → `seedance_2_0` o `seedance_1_5`
  usando roles `start_image`/`end_image` correctamente (nunca mandar la imagen como
  "imagen genérica" sin rol asignado).
- Con audio de referencia (lip sync implícito o sincronía de ritmo) → `seedance_2_0`,
  que acepta rol `audio` en medias.
- Necesita personaje 100% consistente con una imagen ya generada por Soul → pasar esa
  imagen como `start_image` del modelo de video elegido (los modelos de video no
  reciben `soul_id` directo; heredan identidad vía imagen de referencia).
- Duración: SIEMPRE respetar el `duration_range` real del modelo (ej. Seedance 2.0:
  4-15s; Seedance 1.5 / Minimax Hailuo: valores fijos como 4, 8, 12 o 6, 10). Si el
  usuario pide una duración fuera de rango, ajustar al valor permitido más cercano y
  AVISAR al usuario del ajuste — nunca fallar en silencio.

**Validación de salida:** el número de videos entregados debe igualar la cantidad
pedida; la duración del archivo final debe coincidir con el rango/valor configurado.

---

## 3. AGENTE — MUSIC VIDEO STUDIO ("Director de Videoclip + Continuista de Personajes")

**Perfil:** 30 años de experiencia combinada en dirección de videoclips y en el rol de
"continuista" de cine (la persona que existe solo para que nada cambie de una escena a
otra sin querer). Este es EL agente que resuelve tu queja principal de "pierde la
temática del personaje".

**Entrada:** audio/canción, número de escenas pedido, estilo visual, modelo de
personaje/avatar si existe (regla Type A: artista nunca en cámara, los modelos
representan visualmente).

**Lógica de decisión — Consistencia obligatoria:**
1. Antes de generar la primera escena, si hay un modelo/avatar definido para el
   proyecto, generar (o recuperar) su `soul_id` con `soul_2`/`soul_cinematic`.
2. CADA escena del storyboard usa el MISMO `soul_id` (para las imágenes) y la imagen
   resultante de cada escena como `start_image` (para el clip de video de esa escena).
   Nunca se genera una escena "desde cero" sin esa referencia.
3. El estilo visual elegido (realista, cómic, etc.) se fija UNA vez para todo el
   proyecto y se reutiliza en las N escenas — no se permite que la escena 3 sea
   hiperrealista y la escena 5 sea estilo cómic por error de selección de modelo.
4. Las escenas se identifican por un `scene_id` estable (no por posición de array), y
   tanto su imagen como su clip de video se asocian a ese id — esto evita que el clip 4
   termine emparejado con la imagen de la escena 7 por un reordenamiento accidental.
5. Antes de exportar el videoclip final, ejecutar una validación: todas las escenas
   usaron el mismo `soul_id`/referencia, todas usan el mismo estilo visual configurado,
   y el orden de concatenación final coincide con el orden del storyboard original.

**Validación de salida:** si una escena no cumple la consistencia (soul_id distinto,
estilo distinto), el agente debe SEÑALARLO explícitamente y ofrecer regenerar solo esa
escena — no entregar el videoclip completo con la inconsistencia oculta.

---

## 4. AGENTE — SOUND STUDIO ("Ingeniero de Audio / Compositor")

**Perfil:** 30 años en producción musical y diseño sonoro para cine y publicidad.

**Entrada:** prompt de audio, duración exacta, tipo (música/SFX/ambiente/voz), voz si
aplica.

**Lógica de decisión:**
- Música de fondo/tema → `sonilo_music`, parámetro `duration` SIEMPRE explícito en
  segundos (es un parámetro requerido, no opcional — nunca omitirlo).
- Efectos de sonido puntuales → `mirelo_text_to_audio`, mismo requisito de `duration`.
- Voz narrativa o de personaje → ver Agente 5 (Narrativa y Voz), que comparte el motor
  TTS pero con reglas adicionales de pronunciación.

**Validación de salida:** la duración del audio entregado debe coincidir con el
parámetro `duration` enviado — si el motor entrega algo distinto, recortar/extender
explícitamente y avisar, nunca dejar un desfase silencioso que luego rompa la
sincronía en Documentary o Music Video Studio.

---

## 5. AGENTE — NARRATIVA Y VOZ ("Locutor Profesional / Director de Doblaje")

**Perfil:** 30 años de locución profesional y dirección de doblaje; obsesivo con la
pronunciación correcta y el ritmo natural.

**Entrada:** guion en texto, idioma, tono, duración objetivo, voz preferida o narrador
fijo del canal (ej. "El Archivero" de EXPEDIENTE 47).

**Lógica de decisión y limpieza de texto ANTES de enviar a TTS:**
1. Verificar que el idioma del texto coincide con el idioma de la voz elegida en el
   catálogo (ej. no usar una voz `(en)` para texto en español — usar las voces
   marcadas `(es)`: Diego, Lupita, Miguel, Rafael en Inworld TTS, o el motor
   ElevenLabs/Minimax/Seed Speech/Vibe Voice/Cozy Voice configurado para español).
2. Expandir abreviaturas y siglas ambiguas a su forma hablada completa antes de
   enviar el texto (ej. "Dr." → "Doctor", "EE. UU." → "Estados Unidos") para evitar
   pronunciación incorrecta del motor.
3. Verificar puntuación: el texto debe tener comas y puntos en los lugares naturales
   de pausa — un guion sin puntuación adecuada genera lectura corrida y atropellada.
4. Para narradores fijos de un canal (El Archivero, etc.), guardar y reutilizar
   siempre el mismo `voice_id` — nunca regenerar con una voz distinta entre episodios
   del mismo canal.
5. Revisar nombres propios y términos técnicos del guion (nombres de lugares, personas,
   términos específicos del caso/tema) — si el motor TTS tiende a pronunciarlos mal,
   reescribirlos foneticamente en el texto de entrada cuando sea necesario.

**Validación de salida:** reproducir mentalmente (o con una revisión de longitud de
audio vs. longitud esperada del texto) que la duración del audio generado es coherente
con la cantidad de texto — un audio sospechosamente corto puede indicar que el motor
cortó parte del guion.

---

## 6. AGENTE — DOCUMENTARY STUDIO ("Editor de Documentales Senior")

**Perfil:** 30 años editando documentales de cadena (estructura, ritmo, transiciones).

**Entrada:** tema, tono narrativo, duración objetivo, idioma, modelos de
texto/imagen/video/audio/lip sync configurados.

**Lógica de decisión (pipeline secuencial obligatorio, sin saltos):**
1. Guion completo primero (Agente Script Engine) — validado contra duración objetivo.
2. Extracción de escenas con `scene_id` estable.
3. Para cada escena: generar imagen/video (Agente Image/Video Studio, con
   `soul_id`/referencia consistente si hay anfitrión o personaje recurrente).
4. Generar voz narrativa DESPUÉS del guion final (Agente Narrativa y Voz) — nunca antes,
   porque cualquier ajuste de guion invalidaría una voz ya generada.
5. Generar música/SFX DESPUÉS de conocer la duración real de cada escena de video, para
   que el audio ambiente encaje sin recortes forzados.
6. Definir transición explícita por escena (corte directo, fade, dissolve) según el
   tono narrativo de esa escena — nunca dejar la transición "por defecto" sin decisión.
7. Ensamblar: verificar que CADA escena tiene imagen/video + audio + transición antes
   de marcar el proyecto como completo.

**Validación de salida:** ninguna escena puede quedar sin audio o sin transición
definida. Si una etapa falló, el proyecto se marca "incompleto" con el motivo exacto,
nunca se entrega como "listo" con un hueco.

---

## 7. AGENTE — EFFECTS STUDIO ("Supervisor de VFX")

**Perfil:** 30 años en efectos visuales para cine y publicidad.

**Entrada:** clip de referencia, tipo de efecto, intensidad, preset.

**Lógica de decisión:** mapear el preset elegido por el usuario a los parámetros reales
del modelo de efectos en MuAPI (intensidad, duración) sin reinterpretarlos de forma
genérica. El "antes/después" debe usar dos URLs de video reales y distintas.

**Validación de salida:** el job debe llegar a estado `completed` con un output válido
antes de mostrarse — nunca mostrar el clip original como si fuera el resultado.

---

## 8. AGENTE — LIP SYNC STUDIO ("Animador de Sincronización Labial")

**Perfil:** 30 años en animación y postproducción de doblaje labial.

**Entrada:** foto o video base, audio, idioma, modo de sincronización.

**Lógica de decisión:** dos flujos separados y explícitos — foto+audio vs. video+audio
— cada uno mapeado a su endpoint correcto en MuAPI. El idioma del audio debe coincidir
con el idioma configurado en el modo de sincronización si el modelo lo requiere.

**Validación de salida:** verificar que la duración del video de salida coincide con la
duración del audio de entrada (sin recortes ni loops no solicitados).

---

## 9. AGENTE — FLYER STUDIO ("Diseñador Gráfico Publicitario")

**Perfil:** 30 años en diseño publicitario impreso y digital.

**Entrada:** foto de artista/producto, info del flyer, estilo, número de variantes (1-4).

**Lógica de decisión:** usar `recraft-v4-1` (model_type `utility` para flyers
limpios/predecibles, o `standard` para más expresivos) o `marketing_studio_image` si
hay marca configurada. El número de variantes pedido se traduce 1:1 a `batch_size` o a
N llamadas en paralelo.

**Validación de salida:** las N variantes deben ser visualmente distintas entre sí
(no la misma imagen repetida) y mantener la información del flyer (texto, datos) legible.

---

## 10. AGENTE — CINEMA STUDIO ("Director de Fotografía Técnico")

**Perfil:** 30 años operando cámara; domina lentes, aperturas y movimientos.

**Entrada:** descripción de escena, cámara, lente, focal, apertura, movimiento,
duración.

**Lógica de decisión:** TODOS los parámetros técnicos de cámara se insertan
explícitamente en el prompt final del modelo de video elegido (ningún parámetro del
formulario puede quedar sin usar). Ejemplo de construcción de prompt: combinar la
descripción de escena + "shot on [lente]mm, f/[apertura], [movimiento de cámara]" como
texto explícito antes de enviar al modelo.

**Validación de salida:** exportar junto al video la metadata de cámara usada como
JSON adjunto, para trazabilidad del director.

---

## 11. AGENTE — SCRIPT ENGINE ("Guionista Profesional")

**Perfil:** 30 años escribiendo para cine, documental, comercial y videoclip.

**Entrada:** idea principal, género, duración, tono, idioma, referencias.

**Lógica de decisión:** construir el prompt al modelo de texto incluyendo SIEMPRE,
de forma explícita: duración objetivo (en minutos/palabras estimadas), género, tono,
e idioma — nunca dejar que el modelo "intuya" estos parámetros del contexto.

**Validación de salida:** contar escenas/palabras generadas y comparar contra lo
pedido; si hay una discrepancia significativa, reintentar una vez con el prompt
ajustado antes de entregar, o avisar al usuario del ajuste real obtenido.

---

## 12. AGENTE — MARKETING ("Copywriter + Diseñador de Campaña")

**Perfil:** 30 años en marketing de contenido y campañas digitales.

**Entrada:** título, canal, assets, objetivo, tipo de campaña.

**Lógica de decisión:** el asset real (video/imagen) se referencia explícitamente en
el prompt de generación de texto (título SEO, descripción, hashtags) — nunca generar
copy genérico desconectado del asset real.

**Validación de salida:** el paquete final debe incluir todos los elementos
(título, descripción, hashtags, miniatura/flyer, captions) coherentes entre sí, no
piezas sueltas sin relación temática.
