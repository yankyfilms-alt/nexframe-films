# NEXFRAME FILMS v6 - ORDEN CODEX FULL AUTOMATION

Implementa NEXFRAME FILMS como sistema 100% automatico y MuAPI-first.

## Vision visual
Mantener la UI del dashboard NEXFRAME: dark cinematic, negro profundo, rojo/dorado, sidebar fija, topbar API Connected, cards premium, estilo estudio de cine.

## MuAPI Gateway
Todo modelo debe pasar por MuAPI si existe endpoint. Si no existe, crear adapter marcado Adapter Required y usar fallback. No exponer claves en frontend.

## Music Video Studio avanzado
Inputs: cancion, fotos de artistas/avatars, guion/narrativa en PDF/TXT/texto, letra opcional, referencias visuales. Workflow: ingest -> audio analysis -> narrativa -> storyboard -> imagenes -> video clips -> lip sync -> efectos -> edicion -> subtitulos -> export. Entregar MP4, SRT/VTT, thumbnails, flyers y ZIP.

## Documentary Studio automatico
Tema simple o narrativa cargada. Si no hay narrativa, generar todo. Permitir elegir narrativa y voz. Entregar documental final con subtitulos, musica, efectos y paquete final.

## Narrative & Voice Library
Narrativas: Level Up, Investigativa, Codigo Blanco, Cinematic Trailer, Urban Music, Marketing UGC. Al elegir narrativa, cargar voces compatibles de mejor a peor con preview y coste.

## Flyer Studio
Nuevo panel para flyers/posters/thumbnails/caratulas. Inputs: foto artista, titulo, fecha, lugar, precio, redes, QR, estilo. Generar 1-4 variantes maximo con la misma informacion y disenos diferentes.

## Paneles
Actualizar Video, Image, Sound, Effects, Lip Sync, Cinema, Script, Marketing, Projects, Gallery, Settings/API, Public Website y Security.

## Estados
idle, validating, uploading, analyzing, queued, generating, editing, success, partial_success, failed, fallback_running, adapter_required.

## Seguridad
Consentimiento obligatorio para voces, caras y avatares reales. Audit log. No deepfakes no autorizados.
