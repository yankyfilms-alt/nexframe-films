export const omnivoiceVoices = [
  {
    id: "prueba-espanol-01-documental",
    name: "Voz ES Documental 01",
    familyId: "omnivoice-es-design-default",
    language: "Spanish",
    engine: "omnivoice",
    mode: "design",
    seed: 479904882,
    durationSeconds: 7.32,
    codec: "pcm_s16le",
    sampleRateHz: 24000,
    channels: 1,
    fileName: "prueba-espanol-01-documental.wav",
    note: "Misma familia OmniVoice ES, semilla diferente.",
    sourceText: "Esta es una prueba de voz en espanol creada para documentales cinematicos, con tono grave, pausado y natural."
  },
  {
    id: "prueba-espanol-02-narracion",
    name: "Voz ES Narracion 02",
    familyId: "omnivoice-es-design-default",
    language: "Spanish",
    engine: "omnivoice",
    mode: "design",
    seed: 960417001,
    durationSeconds: 7.32,
    codec: "pcm_s16le",
    sampleRateHz: 24000,
    channels: 1,
    fileName: "prueba-espanol-02-narracion.wav",
    note: "Misma familia OmniVoice ES, semilla diferente.",
    sourceText: "El sistema local puede crear voces en espanol sin depender de APIs externas, manteniendo control total del audio generado."
  },
  {
    id: "prueba-espanol-omnivoice",
    name: "Voz ES OmniVoice Local",
    familyId: "omnivoice-es-design-default",
    language: "Spanish",
    engine: "omnivoice",
    mode: "design",
    seed: 1003561058,
    durationSeconds: 8.28,
    codec: "pcm_s16le",
    sampleRateHz: 24000,
    channels: 1,
    fileName: "prueba-espanol-omnivoice.wav",
    note: "Misma familia OmniVoice ES, semilla diferente.",
    sourceText: "OmniVoice Studio queda integrado como motor local principal para diseno de voces, narracion y produccion audiovisual."
  },
  {
    id: "prueba-espanol-03-kittentts",
    name: "Voz ES KittenTTS Local",
    familyId: "kittentts-es-default",
    language: "Spanish",
    engine: "kittentts",
    mode: "design",
    seed: 1546808596,
    durationSeconds: 7.32,
    codec: "pcm_s16le",
    sampleRateHz: 24000,
    channels: 1,
    fileName: "prueba-espanol-03-kittentts.wav",
    note: "Motor local alternativo para pruebas de voz.",
    sourceText: "Esta voz sirve como alternativa local para narraciones claras, rapidas y ligeras dentro del panel de produccion."
  }
];

export function getOmnivoiceVoiceById(id) {
  return omnivoiceVoices.find((voice) => voice.id === id) || omnivoiceVoices[0];
}
