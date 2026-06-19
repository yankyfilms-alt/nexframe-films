/**
 * NEXFRAME FILMS — upload-classifier.js
 * ------------------------------------------------------------
 * Clasifica CUALQUIER archivo que el usuario suba en CUALQUIER Studio
 * (imagen, PDF, texto, audio, video) y lo prepara para que el agente
 * correspondiente (agents-registry.js) lo use correctamente — nunca lo
 * ignora ni lo rechaza por no coincidir con "el flujo esperado" del panel.
 *
 * Requiere (ya disponibles o instalables sin fricción en tu stack):
 *   - pdf-parse (texto desde PDF)  ->  npm install pdf-parse
 *   - file-type (detección MIME real, no solo por extensión) -> npm install file-type
 *
 * Instalar en: /server/agents/upload-classifier.js
 * ------------------------------------------------------------
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MAX_FILE_SIZE_MB = 50;
const MAX_FILES_PER_REQUEST = 6;

const TYPE_BY_EXTENSION = {
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image', '.gif': 'image',
  '.mp4': 'video', '.mov': 'video', '.webm': 'video', '.mkv': 'video',
  '.mp3': 'audio', '.wav': 'audio', '.m4a': 'audio', '.aac': 'audio', '.flac': 'audio',
  '.pdf': 'pdf',
  '.txt': 'text', '.md': 'text',
};

// ============================================================
// 1. VALIDACIÓN BÁSICA (tamaño, cantidad, tipo permitido)
// ============================================================
function validateUploadBatch(files) {
  const issues = [];
  if (files.length > MAX_FILES_PER_REQUEST) {
    issues.push(`Se subieron ${files.length} archivos; el máximo por request es ${MAX_FILES_PER_REQUEST}.`);
  }
  files.forEach((f) => {
    const sizeMB = (f.size || 0) / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      issues.push(`Archivo "${f.originalname || f.name}" excede ${MAX_FILE_SIZE_MB}MB (${sizeMB.toFixed(1)}MB).`);
    }
    const ext = path.extname(f.originalname || f.name || '').toLowerCase();
    if (!TYPE_BY_EXTENSION[ext]) {
      issues.push(`Archivo "${f.originalname || f.name}": tipo "${ext}" no reconocido — revisar si debe agregarse al clasificador.`);
    }
  });
  return { ok: issues.length === 0, issues };
}

// ============================================================
// 2. CLASIFICAR UN ARCHIVO INDIVIDUAL
// ============================================================
function detectFileType(file) {
  const ext = path.extname(file.originalname || file.name || '').toLowerCase();
  return TYPE_BY_EXTENSION[ext] || 'unknown';
}

// ============================================================
// 3. EXTRAER CONTENIDO ÚTIL SEGÚN TIPO
//    Devuelve un objeto normalizado que agents-registry.js puede
//    usar directamente como "referencia" o "contexto" en el prompt.
// ============================================================
async function extractUsableContent(file, filePath) {
  const type = detectFileType(file);

  switch (type) {
    case 'image':
      return { type: 'image', role: 'visual_reference', path: filePath, raw: null };

    case 'video':
      return { type: 'video', role: 'visual_reference', path: filePath, raw: null };

    case 'audio':
      return { type: 'audio', role: 'audio_reference', path: filePath, raw: null };

    case 'pdf': {
      let text = '';
      try {
        // Carga perezosa: solo si el módulo está instalado, sin romper si no lo está.
        // eslint-disable-next-line global-require
        const pdfParse = require('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const result = await pdfParse(buffer);
        text = result.text || '';
      } catch (err) {
        return {
          type: 'pdf', role: 'text_context', path: filePath, raw: null,
          error: `No se pudo extraer texto del PDF (¿falta "npm install pdf-parse"?): ${err.message}`,
        };
      }
      return { type: 'pdf', role: 'text_context', path: filePath, raw: text };
    }

    case 'text': {
      const text = fs.readFileSync(filePath, 'utf8');
      return { type: 'text', role: 'text_context', path: filePath, raw: text };
    }

    default:
      return { type: 'unknown', role: 'unclassified', path: filePath, raw: null };
  }
}

// ============================================================
// 4. CLASIFICAR UN LOTE COMPLETO DE UPLOADS DE UNA SESIÓN
//    (ej. el usuario sube 3 fotos del artista + el PDF del guion + la canción)
// ============================================================
async function classifyUploadBatch(files, savedFilePaths) {
  const validation = validateUploadBatch(files);
  const classified = [];

  for (let i = 0; i < files.length; i += 1) {
    const content = await extractUsableContent(files[i], savedFilePaths[i]);
    classified.push({
      originalName: files[i].originalname || files[i].name,
      ...content,
    });
  }

  // Agrupar por rol para que el Studio sepa qué hacer con cada grupo
  const grouped = {
    visual_references: classified.filter((c) => c.role === 'visual_reference' && c.type === 'image'),
    video_references: classified.filter((c) => c.role === 'visual_reference' && c.type === 'video'),
    audio_references: classified.filter((c) => c.role === 'audio_reference'),
    text_context: classified.filter((c) => c.role === 'text_context'),
    unclassified: classified.filter((c) => c.role === 'unclassified'),
  };

  return { validation, classified, grouped };
}

// ============================================================
// 5. CONSTRUIR BLOQUE DE CONTEXTO ADICIONAL PARA EL PROMPT
//    A partir de los PDFs/textos subidos (guion previo, biografía del
//    artista, investigación) — para que NUNCA se ignoren silenciosamente.
// ============================================================
function buildTextContextBlock(groupedUploads, maxChars = 4000) {
  const allText = groupedUploads.text_context
    .map((c) => c.raw || '')
    .filter(Boolean)
    .join('\n\n---\n\n');

  if (!allText) return null;
  return allText.length > maxChars ? `${allText.slice(0, maxChars)}\n[...contenido truncado, usar solo como contexto adicional...]` : allText;
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  MAX_FILE_SIZE_MB,
  MAX_FILES_PER_REQUEST,
  validateUploadBatch,
  detectFileType,
  extractUsableContent,
  classifyUploadBatch,
  buildTextContextBlock,
};
