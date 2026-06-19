/**
 * NEXFRAME FILMS — video-assembly-pipeline.js
 * ------------------------------------------------------------
 * Ensambla el ENTREGABLE FINAL de Documentary Studio y Music Video Studio:
 * concatena escenas, sincroniza narración, mezcla audio, aplica color
 * grading consistente y exporta un único archivo .mp4 listo para subir.
 *
 * Requiere FFmpeg instalado en el sistema (ya parte del stack GRANOSCAR /
 * YF AutoClip V2 — FFmpeg NVENC). No usa una librería de Node para FFmpeg
 * para evitar dependencias extra; llama al binario directamente vía
 * child_process, igual que ya hace tu YF AutoClip V2.
 *
 * Instalar en: /server/agents/video-assembly-pipeline.js
 * ------------------------------------------------------------
 */

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// 1. EJECUTAR FFMPEG COMO PROMESA (wrapper simple)
// ============================================================
function runFFmpeg(args, label = 'ffmpeg') {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', ...args]);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve({ ok: true, stderr });
      else reject(new Error(`[${label}] ffmpeg salió con código ${code}\n${stderr.slice(-1500)}`));
    });
    proc.on('error', (err) => reject(new Error(`[${label}] no se pudo iniciar ffmpeg: ${err.message}`)));
  });
}

// ============================================================
// 2. NORMALIZAR CLIPS (mismo color/formato antes de concatenar)
//    LUT/perfil de color consistente para TODO el documental.
// ============================================================
async function normalizeClip(inputPath, outputPath, { lut = null, targetFps = 30, targetRes = '1920x1080' } = {}) {
  const vf = [];
  vf.push(`scale=${targetRes.replace('x', ':')}`);
  vf.push(`fps=${targetFps}`);
  if (lut) vf.push(`lut3d=${lut}`); // aplica un LUT .cube si se define para el proyecto

  const args = [
    '-i', inputPath,
    '-vf', vf.join(','),
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-c:a', 'aac',
    '-b:a', '192k',
    outputPath,
  ];
  await runFFmpeg(args, 'normalizeClip');
  return outputPath;
}

// ============================================================
// 3. CONCATENAR ESCENAS EN ORDEN (usando concat demuxer de FFmpeg)
// ============================================================
async function concatenateScenes(orderedClipPaths, outputPath, workDir) {
  const listFile = path.join(workDir, `concat-list-${Date.now()}.txt`);
  const content = orderedClipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listFile, content, 'utf8');

  const args = ['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outputPath];
  await runFFmpeg(args, 'concatenateScenes');
  fs.unlinkSync(listFile);
  return outputPath;
}

// ============================================================
// 4. MEZCLAR NARRACIÓN + MÚSICA DE FONDO SOBRE EL VIDEO FINAL
//    Voz al frente (volumen 1.0), música de fondo atenuada (~0.25)
//    para que nunca tape la narración.
// ============================================================
async function mixAudioOverVideo(videoPath, narrationAudioPath, musicAudioPath, outputPath, {
  musicVolume = 0.25,
  narrationVolume = 1.0,
} = {}) {
  const args = ['-i', videoPath];
  const filterParts = [];
  let audioInputsCount = 0;

  if (narrationAudioPath) {
    args.push('-i', narrationAudioPath);
    audioInputsCount += 1;
    filterParts.push(`[${audioInputsCount}:a]volume=${narrationVolume}[narr]`);
  }
  if (musicAudioPath) {
    args.push('-i', musicAudioPath);
    audioInputsCount += 1;
    filterParts.push(`[${audioInputsCount}:a]volume=${musicVolume}[music]`);
  }

  if (narrationAudioPath && musicAudioPath) {
    filterParts.push('[narr][music]amix=inputs=2:duration=longest[aout]');
  } else if (narrationAudioPath) {
    filterParts.push('[narr]anull[aout]');
  } else if (musicAudioPath) {
    filterParts.push('[music]anull[aout]');
  }

  const args2 = [
    ...args,
    '-filter_complex', filterParts.join(';'),
    '-map', '0:v',
    '-map', '[aout]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    outputPath,
  ];
  await runFFmpeg(args2, 'mixAudioOverVideo');
  return outputPath;
}

// ============================================================
// 5. APLICAR TRANSICIÓN ENTRE DOS CLIPS (fade/dissolve) ANTES de concatenar
//    Si el Agente Documentary decidió "fade" o "dissolve" para una escena
//    específica, usar esto en vez de un corte directo simple.
// ============================================================
async function applyTransition(clipAPath, clipBPath, outputPath, {
  type = 'fade', // 'fade' | 'dissolve' | 'cut'
  durationSec = 1,
} = {}) {
  if (type === 'cut') {
    // Corte directo: no se aplica transición, los clips se concatenan tal cual.
    return null;
  }
  // xfade requiere conocer la duración del primer clip; se asume que el caller
  // ya tiene esa metadata (ej. vía ffprobe) y la pasa si es necesario.
  const args = [
    '-i', clipAPath,
    '-i', clipBPath,
    '-filter_complex',
    `xfade=transition=${type === 'dissolve' ? 'dissolve' : 'fade'}:duration=${durationSec}:offset=0`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    outputPath,
  ];
  await runFFmpeg(args, 'applyTransition');
  return outputPath;
}

// ============================================================
// 6. PIPELINE COMPLETO — entrega final lista para subir
// ============================================================
/**
 * scenes: [{ sceneId, videoPath, transitionToNext: 'cut'|'fade'|'dissolve' }]
 * narrationAudioPath: ruta al audio de narración ya generado y sincronizado
 * musicAudioPath: ruta al audio de música de fondo (o la canción real en Music Video)
 * options: { lut, targetFps, targetRes, musicVolume, narrationVolume, workDir, outputPath }
 *
 * Devuelve: { ok, finalVideoPath, issues }
 */
async function assembleFinalVideo(scenes, narrationAudioPath, musicAudioPath, options = {}) {
  // CRÍTICO: forzar ruta absoluta. Si workDir llega relativo (ej.
  // 'tmp-assembly-proj123'), FFmpeg corriendo como subproceso puede
  // resolverlo de forma inconsistente respecto al cwd de Node, generando
  // rutas duplicadas o "file not found" intermitentes. path.resolve()
  // convierte cualquier ruta relativa en absoluta usando el cwd actual,
  // sin afectar rutas que ya eran absolutas.
  const workDir = path.resolve(options.workDir || path.join(process.cwd(), 'tmp-assembly'));
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

  const issues = [];
  if (!scenes || scenes.length === 0) {
    return { ok: false, finalVideoPath: null, issues: ['No hay escenas para ensamblar.'] };
  }

  // Paso 1: normalizar cada clip (mismo color/fps/resolución para todo el proyecto)
  const normalizedPaths = [];
  for (const scene of scenes) {
    if (!scene.videoPath || !fs.existsSync(scene.videoPath)) {
      issues.push(`Escena ${scene.sceneId}: archivo de video no encontrado, se omite del ensamblaje final.`);
      continue;
    }
    const outPath = path.join(workDir, `norm-${scene.sceneId}.mp4`);
    await normalizeClip(path.resolve(scene.videoPath), outPath, options);
    normalizedPaths.push(outPath);
  }

  if (normalizedPaths.length !== scenes.length) {
    issues.push('ADVERTENCIA: no todas las escenas se incluyeron en el ensamblaje final — revisar antes de entregar como "completo".');
  }

  // Paso 2: concatenar en orden (las transiciones complejas tipo xfade requieren
  // un manejo más fino por par de clips; aquí se concatena directo, y projects que
  // requieran fade/dissolve explícito deben pasar por applyTransition() por par
  // de escenas ANTES de llegar a este paso).
  const concatPath = path.join(workDir, `concat-${Date.now()}.mp4`);
  await concatenateScenes(normalizedPaths, concatPath, workDir);

  // Paso 3: mezclar narración + música sobre el video concatenado
  const finalPath = path.resolve(options.outputPath || path.join(workDir, `FINAL-${Date.now()}.mp4`));
  await mixAudioOverVideo(
    concatPath,
    narrationAudioPath ? path.resolve(narrationAudioPath) : null,
    musicAudioPath ? path.resolve(musicAudioPath) : null,
    finalPath,
    options,
  );

  return { ok: issues.length === 0, finalVideoPath: finalPath, issues };
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  runFFmpeg,
  normalizeClip,
  concatenateScenes,
  mixAudioOverVideo,
  applyTransition,
  assembleFinalVideo,
};
