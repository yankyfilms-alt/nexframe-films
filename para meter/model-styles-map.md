# Mapa Rápido: Estilo Pedido → Modelo a Usar

Tabla de consulta directa para que cualquier Studio de imagen/video sepa qué modelo
elegir según las palabras clave del prompt del usuario. Basado en el catálogo real de
modelos disponible vía Higgsfield/MuAPI.

## IMAGEN

| Si el usuario pide... | Modelo recomendado | Parámetros clave |
|---|---|---|
| Foto realista / hiperrealista | `nano_banana_pro` | resolution: 2k o 4k |
| Foto realista con máxima fidelidad al prompt | `flux_2` | model: pro, resolution: 2k |
| Foto realista económica / rápida | `nano_banana` | (sin parámetros extra) |
| Personaje/avatar consistente (UGC, fashion, editorial) | `soul_2` | soul_id fijo, quality: 2k |
| Personaje consistente estilo cine/concept art | `soul_cinematic` | soul_id fijo, quality: 2k |
| Cómic / ilustración expresiva | `recraft-v4-1` | model_type: standard |
| Vector / logo / icono | `recraft-v4-1` | model_type: vector |
| Producto plano / mockup limpio | `recraft-v4-1` | model_type: utility |
| Marca + vector combinados | `recraft-v4-1` | model_type: utility_vector |
| Anime / manga | `recraft-v4-1` | model_type: standard + incluir "anime style" explícito en el prompt |
| Texto/diagramas dentro de la imagen | `nano_banana_pro` o `gpt_image_2` | quality: high |
| Edición de imagen existente por instrucción | `seedream_v5_lite` o `flux_kontext` | — |
| Transformaciones complejas en 4K | `seedream_v4_5` | quality: high |
| Foto de producto para anuncio/campaña | `marketing_studio_image` o `ms_image` | brand_kit_id si existe |
| Estilo expresivo / alto contraste | `grok_image` | mode: quality |
| No se sabe cuál usar | `image_auto` | — |
| Sprite/animación de personaje para juego | `autosprite` | kind según acción |

## VIDEO

| Si el usuario pide... | Modelo recomendado | Parámetros clave |
|---|---|---|
| Video desde texto, libre/creativo | Modelo text-to-video disponible (ej. Kling 3.0 Turbo) | aspect_ratio según pedido |
| Mantener identidad de personaje/producto entre clips | `seedance_2_0` | medias: image/start_image con referencia, mode: std |
| Movimiento confiable, calidad mejorada | `seedance_1_5` | resolution: 720p o 1080p |
| Física natural, emoción facial | `minimax_hailuo` | model: minimax-2.3, resolution: 768 o 1080 |
| Video con audio de referencia (sincronía de ritmo) | `seedance_2_0` | medias role: audio |
| Imagen inicial + imagen final (interpolación) | `seedance_1_5` o `minimax_hailuo` | medias roles: start_image, end_image |
| Géneros cinematográficos específicos (acción, horror, drama, etc.) | `seedance_2_0` | genre: el género pedido |

## AUDIO / VOZ

| Si el usuario pide... | Modelo recomendado | Parámetros clave |
|---|---|---|
| Música de fondo / tema musical | `sonilo_music` | duration: segundos exactos (requerido) |
| Efectos de sonido | `mirelo_text_to_audio` | duration: segundos exactos (requerido) |
| Voz narrativa multiidioma con catálogo amplio | `inworld_text_to_speech` | voice: elegir por idioma exacto (ej. "Diego (es)") |
| Voz con motor ElevenLabs | `text2speech_v2_elevenlabs` | voice_type + voice_id |
| Voz con motor Minimax | `text2speech_v2_minimax` | voice_type + voice_id |
| Voz con motor Seed Speech (Bytedance) | `text2speech_v2_seed_speech` | voice_type + voice_id |
| Voz con motor Vibe Voice (Higgsfield) | `text2speech_v2_vibe_voice` | voice_type + voice_id |
| Voz con motor Cozy Voice (Higgsfield) | `text2speech_v2_cozy_voice` | voice_type + voice_id |
| Narrador fijo de canal (El Archivero, etc.) | Cualquiera de los anteriores | Reutilizar SIEMPRE el mismo voice_id guardado en el proyecto |

## Regla de oro al combinar Studios

1. Si una imagen fue generada con `soul_id`, esa MISMA imagen se usa como
   `start_image`/`image` de referencia en el modelo de VIDEO elegido para esa escena —
   los modelos de video no aceptan `soul_id` directo, heredan identidad por imagen.
2. La voz (`voice_id`) de un proyecto/canal se guarda una vez y se reutiliza en todos
   los episodios — nunca se regenera con una voz distinta a media producción.
3. El estilo visual (realista/cómic/etc.) elegido para la primera escena de un
   proyecto se mantiene fijo para todas las escenas siguientes del mismo proyecto.
