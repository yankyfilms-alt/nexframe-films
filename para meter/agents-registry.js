/**
 * NEXFRAME FILMS — agents-registry.js
 * ------------------------------------------------------------
 * Módulo central de "agentes expertos" por Studio.
 * Instalar en el backend Express, ej: /server/agents/agents-registry.js
 *
 * USO:
 *   const { selectAgentForStudio, resolveCharacterConsistency, validateAgentOutput }
 *     = require('./agents/agents-registry');
 *
 *   // Antes de construir el payload hacia MuAPI, en /api/generate:
 *   const decision = selectAgentForStudio(studioName, userPrompt, projectContext);
 *   // decision.model, decision.params, decision.notes
 *
 *   // Si el Studio maneja personajes recurrentes (Music Video, Documentary):
 *   const consistency = resolveCharacterConsistency(projectId, characterRef, db);
 *
 *   // Después de recibir la respuesta de MuAPI, antes de marcar el job como entregado:
 *   const check = validateAgentOutput(decision, muapiResponse, requestedCount);
 *   if (!check.ok) { /* marcar job como "revisión recomendada" o reintentar *​/ }
 *
 * Este módulo NO hace las llamadas HTTP a MuAPI — solo decide QUÉ modelo y QUÉ
 * parámetros usar, y valida el resultado. La llamada real la sigue haciendo el
 * gateway MuAPI existente del proyecto.
 * ------------------------------------------------------------
 */

'use strict';

// ============================================================
// 1. PALABRAS CLAVE -> ESTILO DETECTADO
// ============================================================
const STYLE_KEYWORDS = {
  hiperrealista: ['hiperrealista', 'hyperrealistic', 'fotorrealista', 'photorealistic', 'como una foto real', 'realista'],
  comic: ['comic', 'cómic', 'comic book', 'ilustracion', 'ilustración', 'dibujo animado', 'cartoon'],
  vector: ['vector', 'logo', 'icono', 'icon', 'svg'],
  anime: ['anime', 'manga'],
  producto: ['producto', 'anuncio', 'publicidad', 'marketing', 'ad', 'campaña', 'campaign'],
  edicion: ['edita esta', 'cambia esta', 'modifica esta imagen', 'edit this image'],
};

function detectStyle(promptText) {
  const text = (promptText || '').toLowerCase();
  for (const [style, keywords] of Object.entries(STYLE_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return style;
  }
  return 'general';
}

// ============================================================
// 2. REGISTRO DE MODELOS POR TIPO DE SALIDA Y ESTILO
//    (Basado en el catálogo real Higgsfield/MuAPI — actualizar
//    aquí si MuAPI agrega/cambia modelos; todos los Studios que
//    llamen a selectAgentForStudio heredan el cambio automático.)
// ============================================================
const IMAGE_MODEL_BY_STYLE = {
  hiperrealista: { model: 'nano_banana_pro', params: { resolution: '2k' } },
  comic: { model: 'recraft-v4-1', params: { model_type: 'standard' } },
  vector: { model: 'recraft-v4-1', params: { model_type: 'vector' } },
  anime: { model: 'recraft-v4-1', params: { model_type: 'standard' }, forcePromptSuffix: 'anime style' },
  producto: { model: 'marketing_studio_image', params: { resolution: '2k' } },
  edicion: { model: 'seedream_v5_lite', params: {} },
  general: { model: 'image_auto', params: {} },
};

const CHARACTER_IMAGE_MODELS = {
  ugc_fashion: { model: 'soul_2', params: { quality: '2k' } },
  cinematic: { model: 'soul_cinematic', params: { quality: '2k' } },
};

const VIDEO_MODEL_DEFAULT = { model: 'seedance_2_0', params: { mode: 'std', resolution: '720p' } };

const AUDIO_MODELS = {
  music: { model: 'sonilo_music' },
  sfx: { model: 'mirelo_text_to_audio' },
  voice_multilingual: { model: 'inworld_text_to_speech' },
};

// Rango de duración real conocido por modelo de video (ajustar si MuAPI cambia esto)
const VIDEO_DURATION_RANGES = {
  seedance_2_0: { min: 4, max: 15 },
  seedance_1_5: { allowed: [4, 8, 12] },
  minimax_hailuo: { allowed: [6, 10] },
};

// ============================================================
// 3. AGENTE POR STUDIO — mapea nombre de panel a lógica de selección
// ============================================================
function selectAgentForStudio(studioName, userPrompt, projectContext = {}) {
  const style = detectStyle(userPrompt);
  const hasCharacterRef = !!(projectContext.soulId || projectContext.characterRef);
  const notes = [];

  switch (studioName) {
    case 'ImageStudio':
    case 'FlyerStudio': {
      if (hasCharacterRef) {
        const charModel = projectContext.cinematic
          ? CHARACTER_IMAGE_MODELS.cinematic
          : CHARACTER_IMAGE_MODELS.ugc_fashion;
        notes.push(`Usando personaje consistente con soul_id=${projectContext.soulId}`);
        return {
          model: charModel.model,
          params: { ...charModel.params, soul_id: projectContext.soulId },
          notes,
        };
      }
      const entry = IMAGE_MODEL_BY_STYLE[style] || IMAGE_MODEL_BY_STYLE.general;
      let finalPrompt = userPrompt;
      if (entry.forcePromptSuffix && !userPrompt.toLowerCase().includes(entry.forcePromptSuffix)) {
        finalPrompt = `${userPrompt}, ${entry.forcePromptSuffix}`;
        notes.push(`Prompt ajustado para forzar estilo: "${entry.forcePromptSuffix}"`);
      }
      return { model: entry.model, params: entry.params, prompt: finalPrompt, notes };
    }

    case 'VideoStudio':
    case 'MusicVideoStudio':
    case 'CinemaStudio':
    case 'DocumentaryStudio': {
      // Documentary Studio necesita DOS tipos de generación distintos:
      // (a) imagen/video por escena -> cae aquí, igual que Video/Music Video.
      // (b) voz narrativa -> el caller debe pedirla explícitamente con
      //     assetType: 'voice' (ver bloque siguiente), NUNCA inferirla del
      //     nombre del Studio, porque "DocumentaryStudio" por sí solo es
      //     ambiguo entre "generar la escena visual" y "generar la narración".
      if (projectContext.assetType === 'voice') {
        const entry = AUDIO_MODELS.voice_multilingual;
        const voiceId = projectContext.fixedVoiceId || null;
        if (voiceId) {
          notes.push(`Reutilizando voice_id fijo del canal/proyecto: ${voiceId}`);
        } else {
          notes.push('No hay voice_id fijo guardado — seleccionar voz por idioma exacto del texto y GUARDAR el voice_id usado para reutilizar en próximos episodios.');
        }
        return { model: entry.model, params: { voice: voiceId }, notes };
      }

      const base = { ...VIDEO_MODEL_DEFAULT };
      if (hasCharacterRef && projectContext.referenceImageUrl) {
        base.params = {
          ...base.params,
        };
        notes.push('Usando imagen de referencia como start_image para heredar identidad de personaje (los modelos de video no aceptan soul_id directo).');
        return {
          model: base.model,
          params: base.params,
          medias: [{ role: 'start_image', value: projectContext.referenceImageUrl }],
          notes,
        };
      }
      return { model: base.model, params: base.params, notes };
    }

    case 'SoundStudio': {
      const kind = projectContext.audioKind || 'music';
      const entry = AUDIO_MODELS[kind] || AUDIO_MODELS.music;
      if (!projectContext.duration) {
        notes.push('ADVERTENCIA: "duration" es un parámetro REQUERIDO por el modelo de audio. No enviar sin este valor.');
      }
      return { model: entry.model, params: { duration: projectContext.duration }, notes };
    }

    case 'NarrativaYVoz': {
      const entry = AUDIO_MODELS.voice_multilingual;
      const voiceId = projectContext.fixedVoiceId || null;
      if (voiceId) {
        notes.push(`Reutilizando voice_id fijo del canal/proyecto: ${voiceId}`);
      } else {
        notes.push('No hay voice_id fijo guardado — seleccionar voz por idioma exacto del texto y GUARDAR el voice_id usado para reutilizar en próximos episodios.');
      }
      return { model: entry.model, params: { voice: voiceId }, notes };
    }

    default:
      notes.push(`Studio "${studioName}" sin agente específico definido — usando selección general por estilo.`);
      return { model: (IMAGE_MODEL_BY_STYLE[style] || IMAGE_MODEL_BY_STYLE.general).model, params: {}, notes };
  }
}

// ============================================================
// 4. CONSISTENCIA DE PERSONAJES ENTRE ESCENAS / PANELES
// ============================================================
/**
 * db: objeto con acceso a la persistencia real del proyecto (nexframe-db.json u ORM).
 * Debe exponer getProject(projectId) y saveProject(projectId, data).
 */
function resolveCharacterConsistency(projectId, characterRef, db) {
  const project = db.getProject(projectId) || {};

  if (!project.soulId && characterRef && characterRef.soulId) {
    project.soulId = characterRef.soulId;
    project.referenceImageUrl = characterRef.referenceImageUrl || null;
    project.visualStyle = characterRef.visualStyle || 'general';
    db.saveProject(projectId, project);
    return {
      soulId: project.soulId,
      referenceImageUrl: project.referenceImageUrl,
      visualStyle: project.visualStyle,
      isNew: true,
    };
  }

  if (project.soulId) {
    return {
      soulId: project.soulId,
      referenceImageUrl: project.referenceImageUrl,
      visualStyle: project.visualStyle,
      isNew: false,
    };
  }

  return { soulId: null, referenceImageUrl: null, visualStyle: null, isNew: false };
}

/**
 * Verifica que todas las escenas de un proyecto usaron el mismo soul_id/estilo
 * antes de permitir exportar el resultado final (Music Video / Documentary).
 */
function validateProjectConsistency(scenes) {
  if (!scenes || scenes.length === 0) return { ok: true, issues: [] };
  const issues = [];
  const firstSoulId = scenes[0].soulId;
  const firstStyle = scenes[0].visualStyle;

  scenes.forEach((scene, idx) => {
    if (firstSoulId && scene.soulId !== firstSoulId) {
      issues.push(`Escena ${idx + 1} (id: ${scene.sceneId}) usó un soul_id distinto al resto del proyecto.`);
    }
    if (firstStyle && scene.visualStyle !== firstStyle) {
      issues.push(`Escena ${idx + 1} (id: ${scene.sceneId}) usó un estilo visual distinto (${scene.visualStyle} vs ${firstStyle}).`);
    }
  });

  return { ok: issues.length === 0, issues };
}

// ============================================================
// 5. VALIDACIÓN DE SALIDA — cantidad, duración, completitud
// ============================================================
function validateAgentOutput(decision, muapiResponse, requestedCount = 1) {
  const issues = [];
  const outputs = (muapiResponse && muapiResponse.outputs) || [];

  if (outputs.length !== requestedCount) {
    issues.push(`Se pidieron ${requestedCount} resultado(s) y se recibieron ${outputs.length}.`);
  }

  if (decision && decision.model && VIDEO_DURATION_RANGES[decision.model]) {
    const range = VIDEO_DURATION_RANGES[decision.model];
    outputs.forEach((out, idx) => {
      const dur = out.duration;
      if (range.allowed && dur != null && !range.allowed.includes(dur)) {
        issues.push(`Output ${idx + 1}: duración ${dur}s no está en los valores permitidos por ${decision.model} (${range.allowed.join(', ')}).`);
      }
      if (range.min != null && dur != null && (dur < range.min || dur > range.max)) {
        issues.push(`Output ${idx + 1}: duración ${dur}s fuera de rango permitido (${range.min}-${range.max}s) para ${decision.model}.`);
      }
    });
  }

  if (outputs.some((o) => !o || o.error)) {
    issues.push('Uno o más outputs llegaron con error explícito desde MuAPI — no marcar el job como completado.');
  }

  return { ok: issues.length === 0, issues, outputs };
}

// ============================================================
// 6. LIMPIEZA DE TEXTO ANTES DE ENVIAR A TTS (pronunciación)
// ============================================================
const COMMON_ABBREVIATIONS = {
  'Dr.': 'Doctor',
  'Dra.': 'Doctora',
  'Sr.': 'Señor',
  'Sra.': 'Señora',
  'EE. UU.': 'Estados Unidos',
  'EEUU': 'Estados Unidos',
  'p. ej.': 'por ejemplo',
  'etc.': 'etcétera',
};

function sanitizeTextForTTS(text) {
  let clean = text || '';
  for (const [abbr, expanded] of Object.entries(COMMON_ABBREVIATIONS)) {
    clean = clean.split(abbr).join(expanded);
  }
  // Asegura espacio después de puntuación para pausas naturales del motor TTS
  clean = clean.replace(/([.,;:!?])(\S)/g, '$1 $2');
  return clean.trim();
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  detectStyle,
  selectAgentForStudio,
  resolveCharacterConsistency,
  validateProjectConsistency,
  validateAgentOutput,
  sanitizeTextForTTS,
  IMAGE_MODEL_BY_STYLE,
  CHARACTER_IMAGE_MODELS,
  AUDIO_MODELS,
  VIDEO_DURATION_RANGES,
};
