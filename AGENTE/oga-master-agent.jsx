import { useState } from "react";

const RANKINGS = {
  video_t2v: [
    { rank: 1, name: "Veo 3 (Google)", score: 99, use: "Documental, narrativa cinemática, talking heads", badge: "ÉLITE", color: "#FFD700" },
    { rank: 2, name: "Sora 2 (OpenAI)", score: 97, use: "Videoclip musical, cinematic storytelling", badge: "ÉLITE", color: "#FFD700" },
    { rank: 3, name: "Kling v3", score: 95, use: "Todo tipo: promos, musicales, documentales", badge: "TOP", color: "#C0C0C0" },
    { rank: 4, name: "Seedance 2.0", score: 93, use: "Videoclips, redes sociales, contenido vertical", badge: "TOP", color: "#C0C0C0" },
    { rank: 5, name: "Wan 2.6", score: 91, use: "Movimiento fluido, naturaleza, lifestyle", badge: "TOP", color: "#C0C0C0" },
    { rank: 6, name: "Hailuo 2.3 Pro", score: 89, use: "Comerciales, animación, motion art", badge: "PRO", color: "#CD7F32" },
    { rank: 7, name: "Runway Gen-3", score: 87, use: "Narrativa visual, edición artística", badge: "PRO", color: "#CD7F32" },
    { rank: 8, name: "Seedance Pro", score: 85, use: "Contenido premium redes sociales", badge: "PRO", color: "#CD7F32" },
    { rank: 9, name: "Midjourney v7 I2V", score: 82, use: "Arte, estética visual única", badge: "BUENO", color: "#888" },
    { rank: 10, name: "Grok Imagine T2V", score: 79, use: "Contenido rápido, redes sociales", badge: "BUENO", color: "#888" },
  ],
  video_i2v: [
    { rank: 1, name: "Veo3 I2V (Google)", score: 99, use: "Animar fotograma inicial con calidad broadcast", badge: "ÉLITE", color: "#FFD700" },
    { rank: 2, name: "Kling v2.1 I2V", score: 96, use: "Musicales: imagen→video cinemático fluido", badge: "ÉLITE", color: "#FFD700" },
    { rank: 3, name: "Seedance 2.0 I2V", score: 94, use: "Hasta 9 refs, 15s, vertical/horizontal", badge: "TOP", color: "#C0C0C0" },
    { rank: 4, name: "Runway I2V", score: 92, use: "Movimiento artístico y controlado", badge: "TOP", color: "#C0C0C0" },
    { rank: 5, name: "Hunyuan I2V", score: 90, use: "Alta fidelidad de personaje, retención", badge: "TOP", color: "#C0C0C0" },
    { rank: 6, name: "Wan 2.2 I2V", score: 88, use: "Open source, muy personalizable", badge: "PRO", color: "#CD7F32" },
    { rank: 7, name: "Midjourney v7 I2V", score: 85, use: "Estética artística única", badge: "PRO", color: "#CD7F32" },
    { rank: 8, name: "Grok Imagine I2V", score: 81, use: "Modos fun/normal/spicy hasta 15s", badge: "BUENO", color: "#888" },
  ],
  image_t2i: [
    { rank: 1, name: "Nano Banana 2 (Gemini 3.1)", score: 99, use: "Portadas, fotorrealismo, hasta 4K, Google Search enhanced", badge: "ÉLITE", color: "#FFD700" },
    { rank: 2, name: "Midjourney v7", score: 97, use: "Arte, estética brutal, musicales, covers", badge: "ÉLITE", color: "#FFD700" },
    { rank: 3, name: "GPT-4o Image", score: 96, use: "Texto en imagen, instrucciones complejas", badge: "ÉLITE", color: "#FFD700" },
    { rank: 4, name: "Flux Dev / Kontext", score: 94, use: "Fotorrealismo, consistencia de personaje", badge: "TOP", color: "#C0C0C0" },
    { rank: 5, name: "Seedream 5.0", score: 92, use: "Alta res 4K, ByteDance, 8 ratios", badge: "TOP", color: "#C0C0C0" },
    { rank: 6, name: "Ideogram v3", score: 90, use: "Texto en imagen, logos, tipografías", badge: "TOP", color: "#C0C0C0" },
    { rank: 7, name: "MiniMax Image 01", score: 86, use: "Batch hasta 4 imágenes, prompts largos", badge: "PRO", color: "#CD7F32" },
  ],
  image_i2i: [
    { rank: 1, name: "Nano Banana 2 Edit (×14 imgs)", score: 99, use: "Consistencia de personaje, composición con refs múltiples", badge: "ÉLITE", color: "#FFD700" },
    { rank: 2, name: "GPT-4o Edit (×10 imgs)", score: 97, use: "Edición con instrucciones naturales complejas", badge: "ÉLITE", color: "#FFD700" },
    { rank: 3, name: "Flux Kontext Pro/Max I2I", score: 95, use: "Edición precisa, inpainting profesional", badge: "ÉLITE", color: "#FFD700" },
    { rank: 4, name: "Seedream 5.0 Edit", score: 92, use: "Style transfer natural language", badge: "TOP", color: "#C0C0C0" },
    { rank: 5, name: "Seededit v3", score: 90, use: "Edición rápida y fiel al original", badge: "TOP", color: "#C0C0C0" },
    { rank: 6, name: "Background Remover", score: 98, use: "Eliminación de fondo automática precisa", badge: "TOOL", color: "#7C3AED" },
    { rank: 7, name: "Upscaler 4K", score: 97, use: "Upscale hasta 4K sin pérdida", badge: "TOOL", color: "#7C3AED" },
  ],
  lipsync: [
    { rank: 1, name: "LTX 2 19B Lipsync", score: 99, use: "Máxima calidad 1080p, presentadores, documentales", badge: "ÉLITE", color: "#FFD700" },
    { rank: 2, name: "LTX 2.3 Lipsync", score: 96, use: "Alta calidad 1080p, más rápido que 19B", badge: "ÉLITE", color: "#FFD700" },
    { rank: 3, name: "Wan 2.2 Speech to Video", score: 93, use: "Portada→video hablando, narrativa documental", badge: "TOP", color: "#C0C0C0" },
    { rank: 4, name: "Infinite Talk I2V", score: 90, use: "Talking portrait, expresiones naturales", badge: "TOP", color: "#C0C0C0" },
    { rank: 5, name: "Creatify Lipsync", score: 87, use: "Anuncios, avatares comerciales", badge: "PRO", color: "#CD7F32" },
    { rank: 6, name: "Sync Lipsync", score: 85, use: "Sincronización rápida video+audio", badge: "PRO", color: "#CD7F32" },
    { rank: 7, name: "Veed Lipsync", score: 82, use: "Integración workflows de edición", badge: "PRO", color: "#CD7F32" },
    { rank: 8, name: "LatentSync", score: 79, use: "Open source, personalizable", badge: "BUENO", color: "#888" },
    { rank: 9, name: "Infinite Talk V2V", score: 77, use: "Video→lipsync en modo batch", badge: "BUENO", color: "#888" },
  ],
  cinema: [
    { rank: 1, name: "Modular 8K Digital + Anamorphic + 35mm", score: 99, use: "Videoclip musical premium, documental cinemático", badge: "ÉLITE", color: "#FFD700" },
    { rank: 2, name: "Full-Frame Cine Digital + Premium Prime + 85mm f/1.4", score: 97, use: "Close-ups, narrativa emocional", badge: "ÉLITE", color: "#FFD700" },
    { rank: 3, name: "Grand Format 70mm Film + Classic Anamorphic + 24mm", score: 95, use: "Épica visual, paisajes, aperturas de documental", badge: "TOP", color: "#C0C0C0" },
    { rank: 4, name: "Classic 16mm Film + Warm Prime + 50mm f/4", score: 90, use: "Estética vintage, contenido artístico indie", badge: "TOP", color: "#C0C0C0" },
  ],
};

const USE_CASES = [
  { type: "🎵 VIDEOCLIP MUSICAL", models: ["Kling v3 / Veo 3 (I2V)", "Nano Banana 2 (imágenes)", "LTX 2 19B Lipsync si hay voz", "Cinema: 8K Anamorphic 35mm f/1.4"] },
  { type: "📽️ DOCUMENTAL", models: ["Veo 3 / Sora 2 (B-roll)", "GPT-4o Image (portadas capítulos)", "LTX 2 19B Lipsync (narrador)", "Cinema: 70mm 24mm f/4 deep focus"] },
  { type: "📢 ANUNCIO / PROMO", models: ["Seedance 2.0 I2V (producto)", "Nano Banana 2 (foto producto 4K)", "Creatify Lipsync (avatar presenter)", "Ideogram v3 (texto+imagen)"] },
  { type: "🎙️ NARRATIVA / TALKING HEAD", models: ["LTX 2 19B Lipsync (primero)", "Wan 2.2 Speech to Video", "Infinite Talk I2V", "GPT-4o Image (thumbnail)"] },
  { type: "🖼️ FOTO/PORTADA PREMIUM", models: ["Nano Banana 2 → Upscaler 4K", "Midjourney v7", "Flux Kontext Pro (edición)", "Background Remover (recorte)"] },
  { type: "🎬 CINE / CORTOMETRAJE", models: ["Veo 3 I2V + Cinema Studio", "Modular 8K Digital Anamorphic", "Seedance 2.0 Extend (continuación)", "Workflow Studio pipeline"] },
];

const MASTER_PROMPT = `# YANKYFILMS OPEN GENERATIVE AI — MASTER SELECTION AGENT v2.0
# Instalado en: Open-Generative-AI / Sistema de producción GRANOSCAR

## ROL
Eres el Agente Maestro de Selección de Modelos para YANKYFILMS. Tu única misión es analizar cada petición del usuario y seleccionar SIEMPRE la combinación óptima de modelos disponibles en Open Generative AI (Muapi.ai), priorizando CALIDAD MÁXIMA sobre velocidad o coste.

## REGLAS DE SELECCIÓN — JERARQUÍA FIJA

### VÍDEO TEXT-TO-VIDEO (sin imagen de referencia):
1º Veo 3 → 2º Sora 2 → 3º Kling v3 → 4º Seedance 2.0 → 5º Wan 2.6

### VÍDEO IMAGE-TO-VIDEO (con imagen de inicio):
1º Veo3 I2V → 2º Kling v2.1 I2V → 3º Seedance 2.0 I2V → 4º Runway I2V → 5º Hunyuan I2V

### IMAGEN TEXT-TO-IMAGE:
1º Nano Banana 2 (4K, Gemini 3.1) → 2º Midjourney v7 → 3º GPT-4o → 4º Flux Dev → 5º Seedream 5.0

### IMAGEN IMAGE-TO-IMAGE / EDICIÓN:
1º Nano Banana 2 Edit (hasta 14 refs) → 2º GPT-4o Edit → 3º Flux Kontext Pro → 4º Seedream 5.0 Edit

### LIP SYNC (imagen/vídeo + audio):
1º LTX 2 19B Lipsync (1080p) → 2º LTX 2.3 Lipsync → 3º Wan 2.2 Speech to Video → 4º Infinite Talk I2V

### HERRAMIENTAS AUXILIARES (aplicar siempre que aplique):
- Upscaler 4K → después de CUALQUIER imagen final que vaya a pantalla
- Background Remover → siempre que se necesite recorte de sujeto
- Seedance 2.0 Extend → para alargar vídeos Seedance generados

## TIPOS DE CONTENIDO — PROTOCOLO ESPECÍFICO

### 🎵 VIDEOCLIP MUSICAL:
- Stack: Nano Banana 2 (frames clave) → Kling v3 I2V o Veo3 I2V (animación) → Seedance 2.0 Extend (si +duración)
- Cinema Studio: Modular 8K Digital + Classic Anamorphic + 35mm + f/1.4
- Si hay voz artista: LTX 2 19B Lipsync obligatorio
- Paleta prompt: deep blacks, red/amber/gold, cinematic, no faces on camera

### 📽️ DOCUMENTAL (CÓDIGO BLANCO / EXPEDIENTE 47):
- B-roll: Veo 3 T2V o Sora 2 → calidad broadcast
- Narrador: LTX 2 19B Lipsync o Wan 2.2 Speech to Video
- Portadas/miniaturas: GPT-4o Image o Nano Banana 2 → Upscaler 4K
- Cinema: 70mm Film + 24mm + f/4 (deep focus para paisajes y archivos)
- Prompt estilo: archival footage look, dramatic, noir, cinematic grain

### 📢 ANUNCIO / VIDEO PROMOCIONAL:
- Producto: Nano Banana 2 Edit (foto producto) → Seedance 2.0 I2V
- Avatar presenter: Creatify Lipsync o LTX 2.3 Lipsync
- Texto gráfico: Ideogram v3 (tipografía precisa)
- Formato: 9:16 para RRSS, 16:9 para YouTube/TV
- Duración: 15s Seedance para anuncios cortos, Runway Gen-3 para narrativa

### 🎙️ TALKING HEAD / NARRACIÓN:
- LTX 2 19B Lipsync (SIEMPRE primero si hay audio narración)
- Si falla: Wan 2.2 Speech to Video → Infinite Talk I2V
- Imagen base: Nano Banana 2 o Midjourney v7 (persona fotorrealista o avatar)

### 🖼️ FOTOGRAFÍA / PORTADA / THUMBNAIL:
- Generación: Nano Banana 2 (4K, Google Search enhanced)
- Arte/estética: Midjourney v7
- Texto en imagen: GPT-4o o Ideogram v3
- Post: Upscaler 4K siempre → Background Remover si necesario

### 🎬 CINE / CORTOMETRAJE / NARRATIVA LARGA:
- Pipeline: Workflow Studio (multi-step)
- Vídeo: Veo 3 → Veo3 I2V → Seedance 2.0 Extend en cadena
- Cinema Studio: Full-Frame Cine Digital + Premium Modern Prime + 85mm f/1.4

## PROTOCOLO DE RESPUESTA DEL AGENTE

Cuando el usuario envíe un prompt, responde SIEMPRE con este formato:

---
🎯 TIPO DETECTADO: [tipo de contenido]
⚡ MODELO PRIMARIO: [modelo #1 seleccionado + parámetros]
🔧 MODELOS AUXILIARES: [lista de complementos]
🎥 CINEMA STUDIO: [configuración cámara/lente/focal/apertura]
📐 FORMATO: [ratio, resolución, duración]
📝 PROMPT OPTIMIZADO: [prompt mejorado listo para pegar]
---

## AUTO-ACTUALIZACIÓN DE CONOCIMIENTO
Cada vez que el usuario mencione un modelo nuevo o característica nueva:
1. Registra el modelo con sus capacidades
2. Evalúa su posición en la jerarquía según: calidad output, resolución máxima, fidelidad temporal, control de motion
3. Si supera al actual en posición #1-3 de su categoría, actualiza la jerarquía
4. Informa al usuario del cambio

## PROMPT ENGINEERING — REGLAS YANKYFILMS
- SIEMPRE incluir: cinematic, 8K, photorealistic (para contenido real)
- Paleta YF: deep blacks, crimson red, amber gold, dark shadows
- Faceless por defecto: artists never on camera, faceless aesthetic
- Ritmo: dynamic camera movement, slow motion + fast cut hybrid
- Narrativa: emotional storytelling, dramatic tension, documentary grade

## MEMORIA DE SESIÓN
Mantén contexto de:
- Último modelo usado exitosamente por categoría
- Historial de prompts del usuario para coherencia estética
- Parámetros preferidos (resolución, ratio, duración)
- Proyectos activos: EXPEDIENTE 47, CÓDIGO BLANCO, YF SESSIONS, PUBLIMASTER IA

## ESTADO DEL MERCADO (Actualizado Junio 2026)
MEJOR VIDEO: Veo 3 > Sora 2 > Kling v3
MEJOR IMAGEN: Nano Banana 2 (Gemini 3.1) > Midjourney v7 > GPT-4o
MEJOR LIPSYNC: LTX 2 19B > LTX 2.3 > Wan 2.2 Speech
MEJOR EDICIÓN: Nano Banana 2 Edit (14 imgs) > GPT-4o Edit > Flux Kontext
EMERGENTE A VIGILAR: Seedance 2.0, Vidu Q2, MiniMax Hailuo 2.3 Pro`;

const categories = [
  { key: "video_t2v", label: "🎬 Vídeo T2V", desc: "Texto→Vídeo (sin imagen base)" },
  { key: "video_i2v", label: "🖼→🎬 Vídeo I2V", desc: "Imagen→Vídeo (con frame inicial)" },
  { key: "image_t2i", label: "🖼️ Imagen T2I", desc: "Texto→Imagen" },
  { key: "image_i2i", label: "✏️ Imagen I2I", desc: "Edición de imagen" },
  { key: "lipsync", label: "🎙️ Lip Sync", desc: "Audio→Video sincronizado" },
  { key: "cinema", label: "🎥 Cinema Studio", desc: "Configuraciones de cámara" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("rankings");
  const [activeCat, setActiveCat] = useState("video_t2v");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(MASTER_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const badgeColors = {
    "ÉLITE": "bg-yellow-500 text-black",
    "TOP": "bg-gray-400 text-black",
    "PRO": "bg-amber-700 text-white",
    "BUENO": "bg-gray-600 text-white",
    "TOOL": "bg-purple-700 text-white",
  };

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#f0f0f0" }}>
      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg, #1a0000 0%, #0a0a0a 50%, #1a0a00 100%)", borderBottom: "1px solid #ff2200" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, background: "linear-gradient(135deg, #ff2200, #cc8800)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>⚡</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, color: "#ff4400" }}>YANKYFILMS — OGA MASTER AGENT</div>
              <div style={{ fontSize: 12, color: "#888", letterSpacing: 1 }}>Open Generative AI · 200+ Modelos · Muapi.ai · GRANOSCAR Stack</div>
            </div>
          </div>
          {/* TABS */}
          <div style={{ display: "flex", gap: 4, marginTop: 20 }}>
            {[
              { key: "rankings", label: "📊 Rankings" },
              { key: "usecases", label: "🎯 Casos de Uso" },
              { key: "prompt", label: "🤖 Prompt Maestro" },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                style={{ padding: "8px 20px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
                  background: activeTab === t.key ? "#ff2200" : "#1a1a1a",
                  color: activeTab === t.key ? "#fff" : "#aaa" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* === RANKINGS TAB === */}
        {activeTab === "rankings" && (
          <div>
            <div style={{ marginBottom: 20, fontSize: 13, color: "#666" }}>Todos los modelos rankeados de MEJOR a PEOR dentro de Open Generative AI / Muapi.ai</div>
            {/* Category selector */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
              {categories.map(c => (
                <button key={c.key} onClick={() => setActiveCat(c.key)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: activeCat === c.key ? "2px solid #ff2200" : "2px solid #222", cursor: "pointer",
                    background: activeCat === c.key ? "#1a0000" : "#111", color: activeCat === c.key ? "#ff4400" : "#aaa", fontSize: 13, fontWeight: 700 }}>
                  {c.label}
                </button>
              ))}
            </div>
            {/* Category desc */}
            <div style={{ marginBottom: 16, color: "#888", fontSize: 13 }}>{categories.find(c => c.key === activeCat)?.desc}</div>
            {/* Models list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {RANKINGS[activeCat].map((m) => (
                <div key={m.rank} style={{ background: "#111", borderRadius: 12, border: `1px solid ${m.rank === 1 ? "#ff2200" : "#1e1e1e"}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  {/* Rank */}
                  <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16,
                    background: m.rank === 1 ? "#ff2200" : m.rank === 2 ? "#333" : m.rank === 3 ? "#1a0a00" : "#0d0d0d",
                    color: m.rank <= 3 ? "#fff" : "#555", border: `2px solid ${m.color}` }}>
                    #{m.rank}
                  </div>
                  {/* Score bar */}
                  <div style={{ width: 60, flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: m.color }}>{m.score}</div>
                    <div style={{ height: 4, background: "#222", borderRadius: 4, marginTop: 3 }}>
                      <div style={{ height: "100%", width: `${m.score}%`, background: m.color, borderRadius: 4 }} />
                    </div>
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>{m.name}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 900, letterSpacing: 1 }}
                        className={badgeColors[m.badge]}
                        style={{ background: m.badge === "ÉLITE" ? "#FFD700" : m.badge === "TOP" ? "#555" : m.badge === "PRO" ? "#7a4500" : m.badge === "TOOL" ? "#4c1d95" : "#333",
                          color: m.badge === "ÉLITE" ? "#000" : "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
                        {m.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>{m.use}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === USE CASES TAB === */}
        {activeTab === "usecases" && (
          <div>
            <div style={{ marginBottom: 20, fontSize: 13, color: "#666" }}>Stack óptimo de modelos para cada tipo de producción YANKYFILMS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {USE_CASES.map((uc, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 14, border: "1px solid #1e1e1e", padding: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#ff4400", marginBottom: 14 }}>{uc.type}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {uc.models.map((m, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: j === 0 ? "#ff2200" : "#222", color: j === 0 ? "#fff" : "#666", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, flexShrink: 0 }}>{j + 1}</div>
                        <span style={{ fontSize: 13, color: j === 0 ? "#fff" : "#aaa" }}>{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick decision matrix */}
            <div style={{ marginTop: 32, background: "#0d0d0d", borderRadius: 14, border: "1px solid #ff220033", padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#ff4400", marginBottom: 16 }}>⚡ MATRIZ DE DECISIÓN RÁPIDA</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { q: "¿Necesito calidad broadcast máxima?", a: "→ Veo 3 o Sora 2" },
                  { q: "¿Animar una foto fija?", a: "→ Kling v2.1 I2V o Veo3 I2V" },
                  { q: "¿Sincronizar labios con audio?", a: "→ LTX 2 19B Lipsync (1080p)" },
                  { q: "¿Imagen para thumbnail/cover?", a: "→ Nano Banana 2 → Upscaler 4K" },
                  { q: "¿Texto preciso en imagen?", a: "→ Ideogram v3 o GPT-4o Image" },
                  { q: "¿Extender un vídeo ya generado?", a: "→ Seedance 2.0 Extend" },
                  { q: "¿Pipeline multi-step automatizado?", a: "→ Workflow Studio (node builder)" },
                  { q: "¿Máxima fidelidad de personaje?", a: "→ Nano Banana 2 Edit (14 refs)" },
                ].map((item, i) => (
                  <div key={i} style={{ background: "#111", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{item.q}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#FFD700" }}>{item.a}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* === PROMPT MAESTRO TAB === */}
        {activeTab === "prompt" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>🤖 PROMPT MAESTRO DEL AGENTE</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Cópialo y pégalo como System Prompt en tu instancia de Open Generative AI o en tu agente IA</div>
              </div>
              <button onClick={handleCopy}
                style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 900, fontSize: 13, letterSpacing: 1,
                  background: copied ? "#00aa44" : "#ff2200", color: "#fff", transition: "background 0.3s" }}>
                {copied ? "✓ COPIADO" : "📋 COPIAR"}
              </button>
            </div>
            <div style={{ background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 12, padding: 24, maxHeight: 600, overflowY: "auto" }}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.7, color: "#ccc", fontFamily: "monospace" }}>
                {MASTER_PROMPT}
              </pre>
            </div>

            {/* Installation guide */}
            <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { step: "1", title: "Clona el repo", code: "git clone --recurse-submodules\nhttps://github.com/Anil-matcha/\nOpen-Generative-AI.git" },
                { step: "2", title: "Instala dependencias", code: "cd Open-Generative-AI\nnpm run setup" },
                { step: "3", title: "Lanza la app", code: "# Electron (desktop):\nnpm run electron:dev\n# Web:\nnpm run dev" },
                { step: "4", title: "Instala el agente", code: "Pega el Prompt Maestro en:\nSettings → API Key → System Prompt\nO en tu middleware.js como\ndefault system context" },
              ].map(s => (
                <div key={s.step} style={{ background: "#111", borderRadius: 12, padding: 18, border: "1px solid #1e1e1e" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, background: "#ff2200", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13 }}>{s.step}</div>
                    <span style={{ fontWeight: 800, color: "#fff" }}>{s.title}</span>
                  </div>
                  <pre style={{ margin: 0, fontSize: 11, color: "#FFD700", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{s.code}</pre>
                </div>
              ))}
            </div>

            {/* Auto-update note */}
            <div style={{ marginTop: 20, background: "#0a0d0a", border: "1px solid #00aa44", borderRadius: 12, padding: 18 }}>
              <div style={{ fontWeight: 900, color: "#00cc55", marginBottom: 8 }}>🔄 PROTOCOLO DE AUTO-ACTUALIZACIÓN</div>
              <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.7 }}>
                El agente está programado para: <br/>
                • Registrar cualquier modelo nuevo que menciones → evaluarlo vs. jerarquía actual<br/>
                • Vigilar lanzamientos de Muapi.ai → actualizar su ranking interno<br/>
                • Informarte cuando un nuevo modelo supere al #1 actual en cualquier categoría<br/>
                • Mantener memoria de sesión de tus proyectos activos (EXPEDIENTE 47, CÓDIGO BLANCO, YF SESSIONS)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: "1px solid #1a1a1a", padding: "16px 24px", textAlign: "center", fontSize: 11, color: "#444" }}>
        YANKYFILMS · GRANOSCAR STACK · Open Generative AI · Muapi.ai · 200+ Models · MIT License · Junio 2026
      </div>
    </div>
  );
}
