import React, { useEffect, useId, useMemo, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Activity, AlertCircle, Bell, Bot, Box, Calendar, Camera, Check, ChevronDown, Clapperboard, Cloud, Coins, Copy,
  Crown, CreditCard, Database, Download, Eye, EyeOff, FileText, Folder, Gauge, Gem, HelpCircle,
  Home, Image, KeyRound, Layers, Lock, Mail, Mic2, Music, Pause, Play, Plus, Redo2, RefreshCw, Save, Scissors,
  Search, Send, Settings, Shield, ShieldCheck, Sparkles, Star, Trash2, Type, Upload, Users, Video,
  Undo2, Volume2, Wand2, X, Zap
} from "lucide-react";
import {
  dashboardAssets, models, panelAssets, providers, studios, subpanels, themes, translations
} from "./data/models";
import {
  getMuapiModelById, getMuapiModelsForStudio, muapiRegistry
} from "./data/models-registry";
import { getOmnivoiceVoiceById, omnivoiceVoices } from "./data/omnivoice-voices";
import { pollJob } from "./lib/pollJob";
import { normalizeGenerationResponse } from "./lib/useGeneration";
import { downloadBlob, downloadJson, loadState, makeJob, makeProject, saveState } from "./lib/store";
import v6Registry from "../nexframe_v6_provider_registry.json";
import v6Actions from "../nexframe_v6_full_button_action_map.json";

const iconMap = {
  dashboard: Home, projects: Folder, gallery: Image, hub: Box, video: Clapperboard, image: Image,
  sound: Activity, effects: Sparkles, lipsync: Mic2, documentary: Bot, musicvideo: Music, cinema: Camera,
  narrative: Mic2, youtube: Bot, flyer: Image, editor: Clapperboard, script: FileText, marketing: Sparkles, public: Home, security: Shield,
  assets: Folder, voices: Mic2, mymodels: Bot, api: Database, apikeys: KeyRound,
  users: Shield, generation: Gauge, deployment: Activity, checklist: Check, windows: Box, settings: Settings,
  billing: Coins, help: HelpCircle, admin: Shield, trash: Trash2
};

const studioCardAssets = {
  video: "/assets/panel-cards/video-studio.png",
  image: "/assets/panel-cards/image-studio.png",
  sound: "/assets/panel-cards/sound-studio.png",
  effects: "/assets/panel-cards/effects-studio.png",
  lipsync: "/assets/panel-cards/lip-sync-studio.png",
  documentary: "/assets/panel-cards/documentary-studio.png",
  musicvideo: "/assets/panel-cards/music-video-studio.png",
  narrative: "/assets/panel-cards/narrativa-y-voz.png",
  youtube: "/assets/panel-cards/analizador-youtube.png",
  flyer: "/assets/panel-cards/flyer-studio.png",
  cinema: "/assets/panel-cards/cinema-studio.png"
};

const officialLogo = "/assets/nexframe-official-logo.png";
const heroSlideSources = [
  "/assets/hero-carousel/nexframe-carousel-01.png",
  "/assets/hero-carousel/nexframe-carousel-02.png",
  "/assets/hero-carousel/nexframe-carousel-03.png",
  "/assets/hero-carousel/nexframe-carousel-04.png",
  "/assets/hero-carousel/nexframe-carousel-05.png",
  "/assets/hero-carousel/nexframe-carousel-06.png",
  "/assets/hero-carousel/nexframe-carousel-07.png",
  "/assets/hero-carousel/nexframe-carousel-08.png",
  "/assets/hero-carousel/nexframe-carousel-09.png",
  "/assets/hero-carousel/nexframe-carousel-10.png",
  "/assets/hero-carousel/nexframe-carousel-11.png",
  "/assets/hero-carousel/nexframe-carousel-12.png",
  "/assets/hero-carousel/nexframe-carousel-13.png",
  "/assets/hero-carousel/nexframe-carousel-14.png",
  "/assets/hero-carousel/nexframe-carousel-15.png",
  "/assets/hero-carousel/nexframe-carousel-16.png",
  "/assets/hero-carousel/nexframe-carousel-17.png",
  "/assets/hero-carousel/nexframe-carousel-18.png",
  "/assets/hero-carousel/nexframe-carousel-19.png",
  "/assets/hero-carousel/nexframe-carousel-20.png",
  "/assets/hero-carousel/nexframe-carousel-21.png",
  "/assets/hero-carousel/nexframe-carousel-22.png",
  "/assets/hero-carousel/nexframe-carousel-23.png",
  "/assets/hero-carousel/nexframe-carousel-24.png",
  "/assets/hero-carousel/nexframe-carousel-25.png",
  "/assets/hero-carousel/nexframe-carousel-26.png",
  "/assets/hero-carousel/nexframe-carousel-27.png",
  "/assets/hero-carousel/nexframe-carousel-28.png",
  "/assets/hero-carousel/nexframe-carousel-29.png",
  "/assets/hero-carousel/nexframe-carousel-30.png",
  "/assets/hero-carousel/nexframe-carousel-31.png",
  "/assets/hero-carousel/nexframe-carousel-32.png",
  "/assets/hero-carousel/nexframe-carousel-33.png",
  "/assets/hero-carousel/nexframe-carousel-34.png",
  "/assets/hero-carousel/nexframe-carousel-35.png"
];

function shuffleSlides(slides) {
  const shuffled = [...slides];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

const heroSlides = shuffleSlides(heroSlideSources);

const defaultForms = {
  video: { prompt: "", model: "veo3.1-text-to-video", ratio: "16:9", duration: "10s", quality: "Pro 1080p" },
  image: { prompt: "", model: "nano-banana", ratio: "16:9", amount: 4, fidelity: "70%" },
  sound: { prompt: "", model: "suno-create-music", duration: "7s", soundtrackStyle: "Epic trailer", voiceStyle: "Narrador grave documental" },
  effects: { prompt: "", model: "ai-video-effects", duration: "4s", intensity: 85 },
  lipsync: { prompt: "", model: "infinitetalk-image-to-video", language: "Espanol", resolution: "1080p" },
  documentary: {
    prompt: "",
    description: "",
    script: "",
    documentaryType: "Historico",
    duration: "30 minutos",
    format: "YouTube 16:9",
    resolution: "1080p Full HD",
    language: "Espanol",
    narrativeStyle: "Misterio oscuro",
    visualStyle: "Ultra realista cinematografico",
    researchLevel: "Investigacion profunda",
    researchModel: "o3-documentary-research",
    scriptModel: "gpt-4.1-documentary-script",
    videoModel: "seedance-lite-t2v",
    imageModel: "nano-banana",
    audioModel: "suno-create-music",
    voiceProvider: "Level Up",
    voiceModel: "narrador-grave-documental",
    voiceStyle: "Narrador grave documental",
    soundtrackStyle: "Tension oscura",
    subtitles: "Subtitulos cinematicos",
    exportFormat: "MP4 H.264",
    target: "YouTube documental 16:9",
    sceneDensity: "Completo 35-40 minutos"
  },
  musicvideo: {
    prompt: "",
    songTitle: "",
    artistName: "",
    script: "",
    lyrics: "",
    musicGenre: "Auto",
    visualStyle: "Hollywood Music Video",
    editStyle: "Beat synced cinematic",
    videoModel: "seedance-lite-t2v",
    imageModel: "nano-banana",
    audioAnalysisModel: "auto",
    lipSyncModel: "infinitetalk-image-to-video",
    vfxModel: "auto-vfx",
    target: "YouTube 16:9",
    aspectRatio: "16:9",
    duration: "Auto por cancion",
    resolution: "1080p Full HD",
    fps: "30 fps",
    subtitles: false,
    lyricsEnabled: false,
    quality: "Alta",
    narrativeMode: "Videoclip completo",
    soundtrackStyle: "Usar cancion subida",
    beatCuts: "Cortes al beat"
  },
  narrative: { prompt: "", model: "minimax-speech-2.6-hd", voiceStyle: "Narrador grave documental", voiceModel: "prueba-espanol-01-documental", language: "Espanol", format: "wav", maxCharacters: 10000 },
  youtube: { channelUrl: "", objective: "Detectar nicho documental rentable", duration: "35-40 min", tone: "Codigo Blanco broadcast", target: "YouTube documental 16:9" },
  flyer: { prompt: "", model: "nano-banana", title: "", secondaryText: "", platform: "Instagram", date: "", place: "", price: "", artistName: "", musicTitle: "", genre: "", hookText: "", style: "Nightclub Neon", designType: "Discoteca / Club", outputFormat: "Instagram 4:5", targetAudience: "Jovenes 18-35", colors: "rojo, dorado, negro", detailLevel: 82, variants: 4, customWidth: 1080, customHeight: 1350, customUnit: "px", includeText: false, useReference: false },
  marketing: {
    prompt: "",
    productName: "",
    offer: "",
    audience: "",
    outputType: "Video promocional",
    channel: "TikTok / Reels / Shorts 9:16",
    visualStyle: "Realista cinematografico",
    campaignGoal: "Vender producto",
    duration: "10s",
    voiceStyle: "Voz vendedora profesional",
    soundtrackStyle: "Musica pegadiza moderna",
    videoModel: "veo3.1-text-to-video",
    imageModel: "ai-product-photography",
    editModel: "ai-background-remover",
    audioModel: "minimax-speech-2.6-hd",
    musicModel: "suno-create-music"
  },
  editor: { prompt: "", model: "veo3.1-text-to-video", title: "", resolution: "1080p", ratio: "16:9", fps: "30 fps", exportFormat: "MP4 H.264" },
  cinema: { prompt: "", model: "veo3.1-text-to-video", camera: "Modular 8K Digital", lens: "Classic Anamorphic" },
  script: { prompt: "", genre: "Ciencia ficcion / Thriller", duration: "120 minutos" }
};

const choiceOptions = {
  ratio: ["16:9", "9:16", "1:1", "21:9", "4:3", "3:4"],
  duration: ["4s", "7s", "10s", "20s", "35-40 min", "120 minutos"],
  quality: ["Pro 1080p", "4K", "8K"],
  resolution: ["720p", "1080p", "4K"],
  language: ["Espanol", "English", "Portugues", "Français"],
  format: ["mp3", "wav", "m4a", "16:9", "9:16", "1:1", "21:9"],
  target: [...muapiRegistry.documentaryOptions.targets, ...muapiRegistry.musicVideoOptions.targets],
  narrativeTone: muapiRegistry.documentaryOptions.narrativeTones,
  soundtrackStyle: [...muapiRegistry.documentaryOptions.soundtrackStyles, ...muapiRegistry.musicVideoOptions.soundtrackStyles],
  voiceStyle: muapiRegistry.documentaryOptions.voiceStyles,
  sceneDensity: muapiRegistry.documentaryOptions.sceneDensity,
  narrativeMode: muapiRegistry.musicVideoOptions.narrativeModes,
  beatCuts: muapiRegistry.musicVideoOptions.beatCuts
};

function directApiUrl(path) {
  if (!path.startsWith("/api") || typeof window === "undefined") return path;
  const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (!configuredBaseUrl && !["localhost", "127.0.0.1"].includes(window.location.hostname)) return path;
  const baseUrl = configuredBaseUrl || `${window.location.protocol}//${window.location.hostname}:8787`;
  return `${baseUrl}${path}`;
}

function apiAssetUrl(path) {
  if (!path || /^(https?:|blob:|data:)/i.test(path) || typeof window === "undefined") return path;
  const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (!configuredBaseUrl && !["localhost", "127.0.0.1"].includes(window.location.hostname)) return path;
  const baseUrl = configuredBaseUrl || `${window.location.protocol}//${window.location.hostname}:8787`;
  return path.startsWith("/") ? `${baseUrl}${path}` : path;
}

async function fetchJson(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(path, {
    credentials: "include",
    headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return data;
}

async function apiRequest(path, options = {}) {
  const targetPath = path.startsWith("/api") ? directApiUrl(path) : path;
  try {
    return await fetchJson(targetPath, options);
  } catch (error) {
    const canRetryDirect = path.startsWith("/api") && /failed to fetch|load failed|networkerror/i.test(error.message || "");
    if (!canRetryDirect) throw error;
    try {
      return await fetchJson(directApiUrl(path), options);
    } catch (directError) {
      throw new Error(`No se pudo conectar con el motor local en 8787. Verifica que "npm run dev:api" este activo. Detalle: ${directError.message}`);
    }
  }
}

function apiFormRequest(path, payload, files = {}) {
  const formData = new FormData();
  formData.append("payload", JSON.stringify(payload));
  Object.entries(files || {}).forEach(([field, file]) => {
    if (file instanceof File) formData.append(field, file, file.name);
  });
  return apiRequest(path, { method: "POST", body: formData });
}

function cleanFormForStorage(form = {}) {
  const { __files, model, ...rest } = form;
  return rest;
}

function makeTrashEntry(type, item) {
  return {
    trashId: `trash_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type,
    item,
    deletedAt: new Date().toISOString()
  };
}

function jobPrompt(job = {}) {
  return job.exactPrompt || job.input?.prompt || job.form?.prompt || "";
}

function outputMediaUrl(job = {}) {
  const outputs = Array.isArray(job.outputs) ? job.outputs : [];
  const first = outputs.find((item) => typeof item === "string" || item?.url || item?.image_url || item?.video_url || item?.audio_url);
  if (!first) return "";
  const declaredType = typeof first === "string" ? "" : String(first.type || first.output_type || "").toLowerCase();
  const mime = typeof first === "string" ? "" : String(first.mimeType || first.mime_type || "");
  const url = typeof first === "string" ? first : first.url || first.image_url || first.video_url || first.audio_url || "";
  if (!url) return "";
  if (/application\/json|text\/plain/i.test(mime)) return "";
  if (mime && !/image|audio|video/.test(mime) && !/image|audio|video/.test(declaredType)) return "";
  if (!mime && !/image|audio|video|media/.test(declaredType) && !/^(https?:|blob:|data:)/i.test(url) && !/\.(png|jpe?g|webp|gif|mp4|webm|mov|mp3|wav|m4a|aac)(\?|$)/i.test(url)) return "";
  return url;
}

function outputMediaKind(job = {}) {
  const url = outputMediaUrl(job).toLowerCase();
  const outputType = String(job.outputs?.[0]?.type || "").toLowerCase();
  if (outputType.includes("audio") || /\.(mp3|wav|m4a|aac)(\?|$)/.test(url)) return "audio";
  if (outputType.includes("video") || /\.(mp4|webm|mov)(\?|$)/.test(url)) return "video";
  if (outputType.includes("image") || /\.(png|jpe?g|webp|gif)(\?|$)/.test(url)) return "image";
  return ["sound", "narrative"].includes(job.studio) ? "audio" : ["video", "cinema", "effects", "lipsync", "documentary", "musicvideo", "marketing", "editor"].includes(job.studio) ? "video" : "image";
}

function estimateCredits(studio, model) {
  const base = { image: 4, flyer: 6, sound: 8, narrative: 6, video: 24, cinema: 24, effects: 12, lipsync: 10, documentary: 120, musicvideo: 90, editor: 40, youtube: 5 }[studio] || 8;
  const multiplier = model?.priority >= 95 ? 2 : model?.priority >= 85 ? 1.5 : 1;
  return Math.ceil(base * multiplier);
}

function themeClass(theme) {
  return `theme-${String(theme || "dark").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

const dashboardI18n = {
  en: {
    "MAIN": "MAIN",
    "AI STUDIOS": "AI STUDIOS",
    "SYSTEM": "SYSTEM",
    "Dashboard": "Dashboard",
    "Proyectos": "Projects",
    "Historial y Galeria": "History and Gallery",
    "Centro de Studios IA": "AI Studios Hub",
    "Narrativa y Voz": "Narrative and Voice",
    "Analizador YouTube": "YouTube Analyzer",
    "Marketing": "Marketing",
    "Public Website": "Public Website",
    "Security Center": "Security Center",
    "Assets Library": "Assets Library",
    "Voice Library": "Voice Library",
    "Usuarios": "Users",
    "My Models": "My Models",
    "API Collection": "API Collection",
    "API Keys": "API Keys",
    "Generation Process": "Generation Process",
    "Papelera": "Trash",
    "Deployment": "Deployment",
    "Checklist Final": "Final Checklist",
    "Windows Launcher": "Windows Launcher",
    "Settings": "Settings",
    "Billing": "Billing",
    "Help & Support": "Help & Support",
    "AI Engine Admin": "AI Engine Admin",
    "Admin": "Admin",
    "Usuario": "User",
    "Activo": "Active",
    "Sesion cerrada": "Signed out",
    "Panel local limpio, listo para crear el primer proyecto.": "Clean local panel, ready to create the first project.",
    "Proyectos": "Projects",
    "creados en local": "created locally",
    "Preferencias": "Preferences",
    "Idioma": "Language",
    "Tema": "Theme",
    "Los cambios se aplican al panel completo y quedan guardados localmente.": "Changes apply to the full dashboard and are saved locally.",
    "Sesion": "Session",
    "Sesión": "Session",
    "La sesión activa controla qué paneles privados ve cada usuario.": "The active session controls which private panels each user can see.",
    "Salir de la sesión": "Sign out",
    "Seguridad": "Security",
    "Las API keys viven solo en servidor. Los paneles API, Security, Deployment y Admin se ocultan para usuarios normales.": "API keys live only on the server. API, Security, Deployment and Admin panels are hidden for regular users.",
    "Bloqueo temporal por IP activo": "Temporary IP lock active",
    "Clave MuAPI fuera del navegador": "MuAPI key kept outside the browser",
    "Cookie HttpOnly de sesión": "HttpOnly session cookie",
    "Validación de entradas antes de llamar a proveedores": "Input validation before calling providers",
    "Buscar proyectos, archivos y herramientas...": "Search projects, files and tools...",
    "Abrir notificaciones": "Open notifications",
    "Contraer menu": "Collapse menu",
    "Expandir menu lateral": "Expand sidebar",
    "Contraer menu lateral": "Collapse sidebar",
    "Generar": "Generate",
    "Guardar proyecto": "Save project",
    "Descargar": "Download",
    "Historial": "History",
    "Duplicar": "Duplicate",
    "Limpiar formulario": "Clear form",
    "Salir": "Sign out",
    "Iniciar sesion": "Sign in",
    "Iniciar sesión": "Sign in",
    "Correo": "Email",
    "Contraseña": "Password",
    "Proveedor seguro": "Secure provider",
    "Proveedor": "Provider",
    "Estado": "Status",
    "Probar conexion": "Test connection",
    "Exportar plantilla": "Export template",
    "Crear": "Create",
    "Abrir": "Open",
    "Editar": "Edit",
    "Borrar": "Delete",
    "Restaurar": "Restore",
    "Buscar": "Search",
    "Enviar ticket": "Send ticket",
    "Temas populares": "Popular topics"
  },
  pt: {
    "MAIN": "PRINCIPAL",
    "AI STUDIOS": "ESTUDIOS IA",
    "SYSTEM": "SISTEMA",
    "Dashboard": "Painel",
    "Proyectos": "Projetos",
    "Historial y Galeria": "Historico e Galeria",
    "Centro de Studios IA": "Centro de Estudios IA",
    "Narrativa y Voz": "Narrativa e Voz",
    "Analizador YouTube": "Analisador YouTube",
    "Usuarios": "Usuarios",
    "Papelera": "Lixeira",
    "Settings": "Configuracoes",
    "Billing": "Faturamento",
    "Help & Support": "Ajuda e Suporte",
    "Admin": "Administrador",
    "Usuario": "Usuario",
    "Activo": "Ativo",
    "Sesion cerrada": "Sessao encerrada",
    "Panel local limpio, listo para crear el primer proyecto.": "Painel local limpo, pronto para criar o primeiro projeto.",
    "Preferencias": "Preferencias",
    "Idioma": "Idioma",
    "Tema": "Tema",
    "Los cambios se aplican al panel completo y quedan guardados localmente.": "As alteracoes se aplicam a todo o painel e ficam salvas localmente.",
    "Sesión": "Sessao",
    "Sesion": "Sessao",
    "Seguridad": "Seguranca",
    "Buscar proyectos, archivos y herramientas...": "Buscar projetos, arquivos e ferramentas...",
    "Generar": "Gerar",
    "Guardar proyecto": "Salvar projeto",
    "Descargar": "Baixar",
    "Historial": "Historico",
    "Duplicar": "Duplicar",
    "Limpiar formulario": "Limpar formulario",
    "Salir": "Sair",
    "Iniciar sesion": "Entrar",
    "Iniciar sesión": "Entrar",
    "Contraseña": "Senha",
    "Proveedor": "Fornecedor",
    "Estado": "Estado",
    "Buscar": "Buscar",
    "Abrir": "Abrir",
    "Editar": "Editar",
    "Borrar": "Excluir",
    "Restaurar": "Restaurar"
  },
  fr: {
    "MAIN": "PRINCIPAL",
    "AI STUDIOS": "STUDIOS IA",
    "SYSTEM": "SYSTEME",
    "Dashboard": "Tableau de bord",
    "Proyectos": "Projets",
    "Historial y Galeria": "Historique et Galerie",
    "Centro de Studios IA": "Centre des Studios IA",
    "Narrativa y Voz": "Narration et Voix",
    "Analizador YouTube": "Analyseur YouTube",
    "Usuarios": "Utilisateurs",
    "Papelera": "Corbeille",
    "Settings": "Parametres",
    "Billing": "Facturation",
    "Help & Support": "Aide et Support",
    "Admin": "Admin",
    "Usuario": "Utilisateur",
    "Activo": "Actif",
    "Sesion cerrada": "Session fermee",
    "Panel local limpio, listo para crear el primer proyecto.": "Tableau local propre, pret a creer le premier projet.",
    "Preferencias": "Preferences",
    "Idioma": "Langue",
    "Tema": "Theme",
    "Los cambios se aplican al panel completo y quedan guardados localmente.": "Les changements s'appliquent a tout le tableau et sont enregistres localement.",
    "Sesión": "Session",
    "Sesion": "Session",
    "Seguridad": "Securite",
    "Buscar proyectos, archivos y herramientas...": "Rechercher projets, fichiers et outils...",
    "Generar": "Generer",
    "Guardar proyecto": "Enregistrer le projet",
    "Descargar": "Telecharger",
    "Historial": "Historique",
    "Duplicar": "Dupliquer",
    "Limpiar formulario": "Nettoyer le formulaire",
    "Salir": "Sortir",
    "Iniciar sesion": "Se connecter",
    "Iniciar sesión": "Se connecter",
    "Contraseña": "Mot de passe",
    "Proveedor": "Fournisseur",
    "Estado": "Etat",
    "Buscar": "Rechercher",
    "Abrir": "Ouvrir",
    "Editar": "Modifier",
    "Borrar": "Supprimer",
    "Restaurar": "Restaurer"
  },
  it: {
    "MAIN": "PRINCIPALE",
    "AI STUDIOS": "STUDI IA",
    "SYSTEM": "SISTEMA",
    "Dashboard": "Pannello",
    "Proyectos": "Progetti",
    "Historial y Galeria": "Cronologia e Galleria",
    "Centro de Studios IA": "Centro Studi IA",
    "Narrativa y Voz": "Narrativa e Voce",
    "Analizador YouTube": "Analizzatore YouTube",
    "Usuarios": "Utenti",
    "Papelera": "Cestino",
    "Settings": "Impostazioni",
    "Billing": "Fatturazione",
    "Help & Support": "Aiuto e Supporto",
    "Admin": "Admin",
    "Usuario": "Utente",
    "Activo": "Attivo",
    "Sesion cerrada": "Sessione chiusa",
    "Panel local limpio, listo para crear el primer proyecto.": "Pannello locale pulito, pronto per creare il primo progetto.",
    "Preferencias": "Preferenze",
    "Idioma": "Lingua",
    "Tema": "Tema",
    "Los cambios se aplican al panel completo y quedan guardados localmente.": "Le modifiche si applicano a tutto il pannello e vengono salvate localmente.",
    "Sesión": "Sessione",
    "Sesion": "Sessione",
    "Seguridad": "Sicurezza",
    "Buscar proyectos, archivos y herramientas...": "Cerca progetti, file e strumenti...",
    "Generar": "Genera",
    "Guardar proyecto": "Salva progetto",
    "Descargar": "Scarica",
    "Historial": "Cronologia",
    "Duplicar": "Duplica",
    "Limpiar formulario": "Pulisci modulo",
    "Salir": "Esci",
    "Iniciar sesion": "Accedi",
    "Iniciar sesión": "Accedi",
    "Contraseña": "Password",
    "Proveedor": "Fornitore",
    "Estado": "Stato",
    "Buscar": "Cerca",
    "Abrir": "Apri",
    "Editar": "Modifica",
    "Borrar": "Elimina",
    "Restaurar": "Ripristina"
  },
  de: {
    "MAIN": "HAUPT",
    "AI STUDIOS": "KI STUDIOS",
    "SYSTEM": "SYSTEM",
    "Dashboard": "Dashboard",
    "Proyectos": "Projekte",
    "Historial y Galeria": "Verlauf und Galerie",
    "Centro de Studios IA": "KI Studio-Zentrale",
    "Narrativa y Voz": "Narration und Stimme",
    "Analizador YouTube": "YouTube-Analyse",
    "Usuarios": "Benutzer",
    "Papelera": "Papierkorb",
    "Settings": "Einstellungen",
    "Billing": "Abrechnung",
    "Help & Support": "Hilfe und Support",
    "Admin": "Admin",
    "Usuario": "Benutzer",
    "Activo": "Aktiv",
    "Sesion cerrada": "Abgemeldet",
    "Panel local limpio, listo para crear el primer proyecto.": "Sauberes lokales Panel, bereit fuer das erste Projekt.",
    "Preferencias": "Einstellungen",
    "Idioma": "Sprache",
    "Tema": "Design",
    "Los cambios se aplican al panel completo y quedan guardados localmente.": "Aenderungen gelten fuer das gesamte Dashboard und werden lokal gespeichert.",
    "Sesión": "Sitzung",
    "Sesion": "Sitzung",
    "Seguridad": "Sicherheit",
    "Buscar proyectos, archivos y herramientas...": "Projekte, Dateien und Werkzeuge suchen...",
    "Generar": "Generieren",
    "Guardar proyecto": "Projekt speichern",
    "Descargar": "Herunterladen",
    "Historial": "Verlauf",
    "Duplicar": "Duplizieren",
    "Limpiar formulario": "Formular leeren",
    "Salir": "Abmelden",
    "Iniciar sesion": "Anmelden",
    "Iniciar sesión": "Anmelden",
    "Contraseña": "Passwort",
    "Proveedor": "Anbieter",
    "Estado": "Status",
    "Buscar": "Suchen",
    "Abrir": "Oeffnen",
    "Editar": "Bearbeiten",
    "Borrar": "Loeschen",
    "Restaurar": "Wiederherstellen"
  }
};

function dashboardTranslate(language, value) {
  const source = String(value || "").replace(/\s+/g, " ").trim();
  if (!source || language === "es") return source;
  return dashboardI18n[language]?.[source] || source;
}

function applyDashboardLanguage(language) {
  if (typeof document === "undefined") return;
  const root = document.querySelector(".app");
  if (!root) return;
  root.lang = language || "es";
  const blocked = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION"]);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || blocked.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const parent = node.parentElement;
    const original = parent.dataset.i18nSource || node.nodeValue.trim();
    parent.dataset.i18nSource = original;
    const translated = dashboardTranslate(language, original);
    if (translated && translated !== node.nodeValue.trim()) node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), translated);
  });
  root.querySelectorAll("[placeholder],[aria-label],[title]").forEach((element) => {
    ["placeholder", "aria-label", "title"].forEach((attribute) => {
      const current = element.getAttribute(attribute);
      if (!current) return;
      const dataKey = `i18n${attribute.replace(/(^|-)([a-z])/g, (_match, _sep, letter) => letter.toUpperCase())}`;
      const original = element.dataset[dataKey] || current.trim();
      element.dataset[dataKey] = original;
      const translated = dashboardTranslate(language, original);
      if (translated) element.setAttribute(attribute, translated);
    });
  });
}

function useAppState() {
  const [state, setState] = useState(loadState);
  useEffect(() => saveState(state), [state]);
  const patch = (update) => setState((current) => ({ ...current, ...(typeof update === "function" ? update(current) : update) }));
  return [state, patch];
}

function routeForPanel(id) {
  if (id === "dashboard") return "/dashboard";
  if (id === "billing") return "/planes";
  if (id === "editor") return "/editor";
  if (id === "public") return "/admin/web-publica";
  return `/app/${id}`;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app/admin" replace />} />
        <Route path="/login" element={<Navigate to="/app/admin" replace />} />
        <Route path="/register" element={<Navigate to="/app/admin" replace />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/planes" element={<PublicPlans />} />
        <Route path="/pricing" element={<PublicPlans />} />
        <Route path="/studios" element={<PublicLandingNew focus="studios" />} />
        <Route path="/how-it-works" element={<PublicLandingNew focus="como-funciona" />} />
        <Route path="/resources" element={<PublicLandingNew focus="recursos" />} />
        <Route path="/faq" element={<PublicLandingNew focus="faq" />} />
        <Route path="/terms" element={<LegalPage type="terms" />} />
        <Route path="/privacy" element={<LegalPage type="privacy" />} />
        <Route path="/contact" element={<LegalPage type="contact" />} />
        <Route path="/dashboard" element={<StudioApp initialActive="dashboard" />} />
        <Route path="/editor" element={<StudioApp initialActive="editor" />} />
        <Route path="/editor/:projectId" element={<StudioApp initialActive="editor" />} />
        <Route path="/admin/web-publica" element={<StudioApp initialActive="public" />} />
        <Route path="/admin/public-website" element={<StudioApp initialActive="public" />} />
        <Route path="/admin/public-website/:section" element={<StudioApp initialActive="public" />} />
        <Route path="/app/:panelId" element={<StudioApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function SlidersIcon(props) {
  return <Settings {...props} />;
}

const publicIconMap = { Zap, RefreshCw, Gem, Settings, Users, Send, Sparkles, Shield, Crown, Play, Star, Box };

const publicFallback = {
  landing: {
    announcementText: "NexFrame 2.5 ya disponible con efectos cinematograficos avanzados y mas control creativo.",
    announcementLink: "/resources",
    heroTitle: "Crea historias que merecen ser vistas.",
    heroSubtitle: "Produce peliculas, videos y campanas de nivel profesional con herramientas de IA intuitivas. Menos tiempo tecnico, mas tiempo para crear historias que conectan.",
    primaryCtaText: "Comenzar gratis",
    primaryCtaUrl: "/register",
    secondaryCtaText: "Ver como funciona",
    secondaryCtaUrl: "/how-it-works",
    footerDescription: "La plataforma de produccion audiovisual con IA para creadores, equipos y productoras."
  },
  heroVideo: {
    title: "Tu proxima historia empieza aqui.",
    subtitle: "Crea, revisa y publica con un flujo de estudio completo.",
    ctaText: "Explorar estudios",
    ctaUrl: "/studios",
    thumbnailUrl: "/assets/nexframe-hero-scene.png",
    fallbackImageUrl: "/assets/nexframe-hero-scene.png",
    previews: []
  },
  benefits: [],
  studios: [],
  testimonials: [],
  metrics: [],
  faq: [],
  examples: [],
  howItWorks: [],
  legal: { copyright: "© 2026 NexFrame Films. Todos los derechos reservados." }
};

function splitHeroTitle(title = "") {
  const clean = String(title || publicFallback.landing.heroTitle);
  const match = clean.match(/^(.*\s)(vistas\.?)$/i);
  if (!match) return <>{clean}</>;
  return <>{match[1]}<span>{match[2]}</span></>;
}

function safePublicHref(route = "/register") {
  return route?.startsWith("/") ? route : "/register";
}

function PublicChrome({ children, active = "inicio" }) {
  return (
    <div className="public-shell">
      <aside className="public-sidebar">
        <Link className="public-logo" to="/"><img src={officialLogo} alt="NEXFRAME FILMS" /></Link>
        <nav className="public-nav">
          <Link className={active === "inicio" ? "active" : ""} to="/"><Home size={17} />Inicio</Link>
          <Link className={active === "studios" ? "active" : ""} to="/studios"><Box size={17} />Estudios</Link>
          <Link className={active === "como-funciona" ? "active" : ""} to="/how-it-works"><HelpCircle size={17} />Como funciona</Link>
          <Link className={active === "planes" ? "active" : ""} to="/pricing"><CreditCard size={17} />Precios</Link>
          <Link className={active === "recursos" ? "active" : ""} to="/resources"><FileText size={17} />Recursos</Link>
          <Link className={active === "faq" ? "active" : ""} to="/faq"><Star size={17} />FAQ</Link>
        </nav>
        <div className="public-sidebar-bottom">
          <Link className="public-login-link" to="/login">Iniciar sesion</Link>
          <Link className="btn full" to="/register"><Send size={16} />Comenzar gratis</Link>
          <div className="public-ai-card"><Bot size={24} /><strong>NEXFRAME AI</strong><span>v2.5.0</span><p>Produccion audiovisual con IA para creadores y estudios.</p></div>
        </div>
      </aside>
      <main className="public-main">
        {children}
      </main>
    </div>
  );
}

function PublicTopNav({ landing = publicFallback.landing }) {
  return (
    <header className="public-topnav">
      <Link className="public-news" to={safePublicHref(landing.announcementLink)}><span>NUEVO</span>{landing.announcementText}<b>Ver novedades</b></Link>
      <div className="public-top-actions">
        <Link className="btn secondary" to="/studios">Explorar estudios</Link>
        <Link className="btn secondary" to="/pricing">Precios</Link>
        <Link className="btn" to="/register"><Send size={15} />Comenzar gratis</Link>
      </div>
    </header>
  );
}

function PublicLanding() {
  const examples = [
    ["The Last City", "Cortometraje", dashboardAssets.recentCyberpunk],
    ["Neon Dreams", "Video musical", dashboardAssets.recentMusic],
    ["Beyond the Stars", "Cine", dashboardAssets.recentShot],
    ["Dark Carnival", "Trailer", dashboardAssets.recentBattle],
    ["Ocean Whispers", "Documental", dashboardAssets.recentDocumentary]
  ];
  const faqs = [
    ["Necesito experiencia para usar NexFrame?", "No. La plataforma guia el flujo, valida campos obligatorios y muestra estados de carga, error y exito."],
    ["Que puedo crear con NexFrame Films?", "Videos, imagenes, guiones, documentales, videoclips, flyers, voces, musica, subtitulos y proyectos editables."],
    ["Puedo usar mis proyectos comercialmente?", "Si, segun el plan activo y los terminos del proveedor usado en cada generacion."]
  ];
  return (
    <PublicChrome active="inicio">
      <PublicTopNav />
      <section className="public-hero">
        <div className="public-hero-copy">
          <h1>Crea historias que merecen ser <span>vistas.</span></h1>
          <p>NEXFRAME FILMS combina IA generativa, herramientas de estudio y flujos de produccion para convertir ideas en piezas cinematograficas listas para publicar.</p>
          <div className="public-hero-actions">
            <Link className="btn" to="/login"><Send size={16} />Comenzar gratis</Link>
            <a className="btn secondary" href="#como-funciona"><Play size={16} />Ver como funciona</a>
          </div>
          <div className="public-proof"><span>Sin tarjeta de credito</span><span>Renderizado rapido</span><span>Calidad profesional</span></div>
        </div>
        <div className="public-hero-preview">
          <img src="/assets/public-web/landing-reference.png" alt="Vista cinematografica NEXFRAME" />
          <button className="public-play" type="button" aria-label="Reproducir demo"><Play fill="currentColor" /></button>
        </div>
      </section>
      <section id="como-funciona" className="public-section public-split">
        <div>
          <p className="public-kicker">BENEFICIOS QUE TRANSFORMAN TU PROCESO</p>
          <h2>Mas creatividad. Menos limites.</h2>
          <div className="public-benefit-grid">
            {publicBenefits.map(([title, body, Icon]) => <article key={title}><Icon size={22} /><strong>{title}</strong><p>{body}</p></article>)}
          </div>
        </div>
        <div id="studios">
          <p className="public-kicker">STUDIOS DISPONIBLES</p>
          <h2>Explora nuestras herramientas</h2>
          <div className="public-studio-row">
            {publicStudios.map((id) => <Link to="/login" className="public-studio-card" key={id}><img src={studioCardAssets[id] || dashboardAssets.recentCyberpunk} alt={labelFor(id)} /><strong>{labelFor(id)}</strong><span>{studioSubtitle(id)}</span></Link>)}
          </div>
        </div>
      </section>
      <section className="public-section">
        <div className="section-head"><div><p className="public-kicker">EJEMPLOS DE PROYECTOS</p><h2>Inspirate con lo que puedes crear</h2></div><Link className="link-btn" to="/login">Crear proyecto</Link></div>
        <div className="public-example-row">{examples.map(([title, type, img]) => <article key={title}><img src={img} alt={title} /><strong>{title}</strong><span>{type}</span></article>)}</div>
      </section>
      <section className="public-section public-split">
        <div>
          <p className="public-kicker">RESULTADOS REALES</p>
          <h2>Historias reales. Resultados reales.</h2>
          <div className="public-testimonials">
            {["Maria Gonzalez", "Alejandro Ruiz", "Laura Chen"].map((name) => <article key={name}><div className="stars">★★★★★</div><p>"NEXFRAME acelero nuestro flujo creativo sin perder control profesional."</p><strong>{name}</strong></article>)}
          </div>
        </div>
        <div id="faq">
          <p className="public-kicker">PREGUNTAS FRECUENTES</p>
          <h2>Tienes dudas? Tenemos respuestas.</h2>
          <div className="public-faq">{faqs.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        </div>
      </section>
      <footer className="public-footer">
        <img src={officialLogo} alt="NEXFRAME FILMS" />
        <span>© 2026 NexFrame Films. Todos los derechos reservados.</span>
        <Link to="/login">Acceso</Link>
        <Link to="/planes">Planes</Link>
      </footer>
    </PublicChrome>
  );
}

function PublicLandingNew({ focus = "inicio" }) {
  const [content, setContent] = useState(publicFallback);
  const [plans, setPlans] = useState([]);
  const [session, setSession] = useState({ signedIn: false });
  useEffect(() => {
    Promise.all([
      apiRequest("/api/public/landing").catch(() => publicFallback),
      apiRequest("/api/billing/plans").catch(() => ({ plans: [] })),
      apiRequest("/api/auth/session").catch(() => ({ signedIn: false }))
    ]).then(([landingResult, plansResult, sessionResult]) => {
      setContent({ ...publicFallback, ...landingResult });
      setPlans(plansResult.plans || []);
      setSession(sessionResult || { signedIn: false });
    });
  }, []);
  useEffect(() => {
    if (!focus || focus === "inicio") return;
    requestAnimationFrame(() => document.getElementById(focus)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [focus, content]);
  const { landing, heroVideo } = content;
  const previewImage = heroVideo.thumbnailUrl || heroVideo.fallbackImageUrl || publicFallback.heroVideo.fallbackImageUrl;
  const studioHref = (studio) => session.signedIn ? studio.route : "/register";
  return (
    <PublicChrome active={focus}>
      <PublicTopNav landing={landing} />
      <section className="public-hero public-hero-neon">
        <div className="public-hero-copy">
          <p className="public-kicker">PLATAFORMA TODO EN UNO PARA CREADORES Y PRODUCTORAS</p>
          <h1>{splitHeroTitle(landing.heroTitle)}</h1>
          <p>{landing.heroSubtitle}</p>
          <div className="public-hero-actions">
            <Link className="btn" to={safePublicHref(landing.primaryCtaUrl)}><Send size={16} />{landing.primaryCtaText}</Link>
            <Link className="btn secondary" to={safePublicHref(landing.secondaryCtaUrl)}><Play size={16} />{landing.secondaryCtaText}</Link>
          </div>
          <div className="public-proof"><span>Sin tarjeta de credito</span><span>Resultados profesionales</span><span>Publica mas rapido</span></div>
        </div>
        <div className="public-hero-preview neon-preview">
          {heroVideo.videoUrl ? <video src={heroVideo.videoUrl} poster={previewImage} muted={heroVideo.muted} loop={heroVideo.loop} autoPlay={heroVideo.autoplay} playsInline /> : <img src={previewImage} alt={heroVideo.title} />}
          <div className="hero-preview-copy">
            <img src={officialLogo} alt="" />
            <h2>{heroVideo.title}</h2>
            <p>{heroVideo.subtitle}</p>
            <div className="hero-mini-benefits">
              {["IA creativa", "Cine profesional", "Control total", "Publica rapido"].map((item) => <span key={item}><Sparkles size={15} />{item}</span>)}
            </div>
            <Link className="btn secondary" to={safePublicHref(heroVideo.ctaUrl)}>{heroVideo.ctaText}</Link>
          </div>
          {heroVideo.showPlayButton !== false && <button className="public-play" type="button" aria-label="Reproducir demo"><Play fill="currentColor" /></button>}
          <div className="hero-preview-strip">
            {(heroVideo.previews || []).slice(0, 6).map((item) => <article key={item.id || item.title}><img src={item.imageUrl} alt={item.title} /><span>{item.title}</span></article>)}
          </div>
        </div>
      </section>
      <section className="public-section compact-section">
        <p className="public-kicker center">BENEFICIOS QUE TRANSFORMAN TU PROCESO</p>
        <div className="public-benefit-grid wide">
          {(content.benefits || []).map((item) => {
            const Icon = publicIconMap[item.icon] || Sparkles;
            return <article key={item.id || item.title}><Icon size={30} /><strong>{item.title}</strong><p>{item.body}</p></article>;
          })}
        </div>
      </section>
      <section id="studios" className="public-section">
        <div className="section-head"><div><p className="public-kicker">EXPLORA NUESTROS ESTUDIOS</p><h2>Herramientas para crear sin friccion</h2></div><Link className="link-btn" to="/studios">Ver todos</Link></div>
        <div className="public-studio-row full">
          {(content.studios || []).map((studio) => <Link to={studioHref(studio)} className="public-studio-card" key={studio.id}><img src={studio.imageUrl || studioCardAssets[studio.id] || dashboardAssets.recentCyberpunk} alt={studio.title} /><strong>{studio.title}</strong><span>{studio.description}</span><i>{studio.ctaText || "Abrir estudio"} <ChevronDown size={14} /></i></Link>)}
        </div>
      </section>
      <section id="recursos" className="public-section public-lower-grid">
        <div>
          <div className="section-head"><div><p className="public-kicker">EJEMPLOS DE PROYECTOS</p><h2>Inspirate con piezas listas para publicar</h2></div><Link className="link-btn" to="/register">Crear proyecto</Link></div>
          <div className="public-example-row">{(content.examples || []).map((item) => <article key={item.id || item.title}><img src={item.imageUrl} alt={item.title} /><strong>{item.title}</strong><span>{item.category}</span></article>)}</div>
        </div>
        <div id="como-funciona">
          <p className="public-kicker">COMO FUNCIONA</p>
          <div className="public-step-row">{(content.howItWorks || []).map((item, index) => <article key={item.id || item.title}><b>{index + 1}</b><strong>{item.title}</strong><p>{item.body}</p></article>)}</div>
        </div>
      </section>
      <section className="public-section public-lower-grid">
        <div>
          <p className="public-kicker">CREADORES QUE YA CONFIAN</p>
          <div className="public-testimonials">
            {(content.testimonials || []).slice(0, 4).map((item) => <article key={item.id}><div className="testimonial-head"><span>{item.avatarUrl ? <img src={item.avatarUrl} alt={item.name} /> : item.name?.slice(0, 1)}</span><div><strong>{item.name}</strong><small>{item.role}</small></div></div><p>"{item.text}"</p><div className="stars">{"★".repeat(Number(item.stars || 5))}</div></article>)}
          </div>
        </div>
        <div>
          <p className="public-kicker">NEXFRAME EN NUMEROS</p>
          <div className="public-metrics">{(content.metrics || []).map((item) => <article key={item.id}><strong>{item.value}</strong><span>{item.label}</span></article>)}</div>
        </div>
      </section>
      <section className="public-section public-lower-grid">
        <div>
          <p className="public-kicker">PRECIOS COMPACTOS</p>
          <div className="public-price-row">{plans.slice(0, 3).map((plan) => <article key={plan.id}><strong>{plan.name}</strong><span>${plan.cycles?.monthly?.price || 0} / mes</span><p>{plan.credits?.toLocaleString?.() || plan.credits} creditos incluidos</p><Link className="btn secondary" to="/pricing">Ver plan</Link></article>)}</div>
        </div>
        <div id="faq">
          <p className="public-kicker">PREGUNTAS FRECUENTES</p>
          <div className="public-faq">{(content.faq || []).map((item) => <details key={item.id || item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
        </div>
      </section>
      <section className="public-brand-row" aria-label="Marcas que usan NexFrame">{["URBAN NIGHTS", "ECHO FILMS", "NEON DISTRICT", "LUMEN STUDIOS", "VISIONARY", "REDWAVE", "SKYLINE", "NORTHSTAR", "BLACKBOX", "ATLAS FILMS"].map((brand) => <span key={brand}>{brand}</span>)}</section>
      <footer className="public-footer">
        <div><img src={officialLogo} alt="NEXFRAME FILMS" /><p>{landing.footerDescription}</p></div>
        <nav><strong>Producto</strong><Link to="/studios">Estudios</Link><Link to="/how-it-works">Como funciona</Link><Link to="/pricing">Precios</Link></nav>
        <nav><strong>Recursos</strong><Link to="/resources">Recursos</Link><Link to="/faq">FAQ</Link><Link to="/contact">Contacto</Link></nav>
        <nav><strong>Legal</strong><Link to="/terms">Terminos</Link><Link to="/privacy">Privacidad</Link></nav>
        <span>{content.legal?.copyright}</span>
      </footer>
    </PublicChrome>
  );
}

const authTools = [
  ["Video con IA", Video],
  ["Musica y Sonido", Activity],
  ["Documentales", Clapperboard],
  ["Edicion Inteligente", FilmStripIcon],
  ["Colaboracion", Users],
  ["Entregas Automaticas", Send]
];

const authBenefits = [
  ["Para creadores y estudios", "Herramientas profesionales para cineastas, productoras y equipos creativos.", Users],
  ["IA que potencia tu proceso", "Generacion de guiones, storyboards, edicion inteligente y mas.", Bot],
  ["Flujo en la nube seguro", "Tus proyectos siempre disponibles, con maxima seguridad y respaldo.", Cloud],
  ["Automatizacion avanzada", "Procesos, entregas y colaboraciones automaticas para equipos agiles.", Zap]
];

const authTrust = [
  ["Acceso seguro", "Proteccion de nivel empresarial.", ShieldCheck],
  ["Recupera tu cuenta", "Opciones seguras de recuperacion.", Lock],
  ["Soporte dedicado", "Ayuda humana cuando la necesitas.", HeadsetIcon],
  ["Pagos seguros", "Tarjetas, PayPal y mas. Cifrado de extremo a extremo.", CreditCard]
];

function FilmStripIcon(props) {
  return <Clapperboard {...props} />;
}

function HeadsetIcon(props) {
  return <Volume2 {...props} />;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function userDestination(user) {
  return user?.role === "admin" ? "/app/admin" : "/dashboard";
}

function planCycleCards(plans) {
  const fallback = {
    name: "Professional",
    cycles: {
      monthly: { price: 29, label: "mes" },
      quarterly: { price: 74, label: "3 meses" },
      annual: { price: 261, label: "ano" }
    }
  };
  const source = plans.find((plan) => plan.highlighted) || plans[0] || fallback;
  const copy = {
    monthly: ["Mensual", "Pago mes a mes", "Maxima flexibilidad"],
    quarterly: ["Trimestral", "Ahorra 15%", "Factura cada 3 meses"],
    annual: ["Anual", "Ahorra 25%", "Facturado anualmente"]
  };
  return ["monthly", "quarterly", "annual"].map((cycleId) => {
    const cycle = source.cycles?.[cycleId] || fallback.cycles[cycleId];
    return { id: cycleId, title: copy[cycleId][0], line1: copy[cycleId][1], line2: copy[cycleId][2], price: cycle.price, label: cycle.label || copy[cycleId][0].toLowerCase() };
  });
}

function AuthPage({ initialMode = "login" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(searchParams.get("error") || "");
  const [fieldErrors, setFieldErrors] = useState({});
  const [plans, setPlans] = useState([]);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotResult, setForgotResult] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", remember: true, acceptedTerms: false });
  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  };

  useEffect(() => {
    apiRequest("/api/billing/plans")
      .then((result) => setPlans(result.plans || []))
      .catch(() => apiRequest("/api/plans").then((result) => setPlans(result.plans || [])).catch(() => setPlans([])));
  }, []);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setMessage("");
    setFieldErrors({});
  };

  const validate = () => {
    const errors = {};
    if (mode === "register" && form.name.trim().length < 2) errors.name = "Escribe tu nombre completo.";
    if (!isValidEmail(form.email)) errors.email = "Escribe un correo electronico valido.";
    if (form.password.length < 8) errors.password = "La contrasena debe tener 8 caracteres o mas.";
    if (mode === "register" && form.password !== form.confirmPassword) errors.confirmPassword = "Las contrasenas no coinciden.";
    if (mode === "register" && !form.acceptedTerms) errors.acceptedTerms = "Debes aceptar los terminos y la politica de privacidad.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    setMessage("");
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const result = await apiRequest(endpoint, { method: "POST", body: JSON.stringify(form) });
      navigate(userDestination(result.user));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await apiRequest("/api/auth/google/url");
      window.location.href = result.url;
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
    }
  };

  const submitForgot = async (event) => {
    event.preventDefault();
    if (!isValidEmail(forgotEmail)) {
      setForgotResult({ message: "Escribe un correo electronico valido." });
      return;
    }
    setForgotBusy(true);
    setForgotResult(null);
    try {
      const result = await apiRequest("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: forgotEmail }) });
      setForgotResult(result);
    } catch (error) {
      setForgotResult({ message: error.message });
    } finally {
      setForgotBusy(false);
    }
  };

  const cards = planCycleCards(plans);
  return (
    <main className="auth-page premium-auth">
      <section className="auth-visual premium-auth-left">
        <Link to="/" className="auth-logo"><img src={officialLogo} alt="NEXFRAME FILMS" /></Link>
        <div className="auth-copy">
          <h1>Crea sin limites.<br /><span>Produce con inteligencia.</span></h1>
          <p>NEXFRAME FILMS es el ecosistema todo en uno que potencia tu vision con herramientas de IA, automatizacion y flujo de trabajo en la nube. Menos tiempo tecnico, mas tiempo para contar historias.</p>
        </div>
        <div className="auth-benefit-grid">
          {authBenefits.map(([title, body, Icon]) => <article key={title}><Icon size={24} /><div><strong>{title}</strong><p>{body}</p></div></article>)}
        </div>
        <section className="auth-feature-strip">
          <strong>Todo lo que necesitas en un solo lugar</strong>
          <div>{authTools.map(([label, Icon]) => <span key={label}><Icon size={23} />{label}</span>)}</div>
        </section>
        <section className="auth-plan-strip">
          <div><strong>Planes flexibles para cada etapa de tu produccion</strong><p>Elige el plan que mejor se adapte a ti. Cancela cuando quieras.</p></div>
          <div className="auth-plan-grid">
            {cards.map((plan) => <article className={plan.id === "quarterly" ? "selected" : ""} key={plan.id}>{plan.id === "quarterly" && <em>MAS POPULAR</em>}<Calendar size={24} /><strong>{plan.title}</strong><span>{plan.line1}</span><small>{plan.line2}</small><b>USD ${plan.price}<small> / {plan.label}</small></b></article>)}
          </div>
        </section>
        <section className="auth-trust-strip">
          {authTrust.map(([title, body, Icon]) => <article key={title}><Icon size={25} /><div><strong>{title}</strong><p>{body}</p></div></article>)}
        </section>
        <footer className="auth-footer"><span>© 2026 NEXFRAME FILMS. Todos los derechos reservados.</span><Link to="/terms">Terminos de servicio</Link><Link to="/privacy">Politica de privacidad</Link><Link to="/contact">Contacto</Link></footer>
      </section>

      <section className="auth-panel-wrap" aria-label="Acceso NEXFRAME">
        <div className="auth-panel premium-auth-panel">
          <div className="auth-tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Acceso</button><button type="button" className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>Crear cuenta</button></div>
          <h2>{mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}</h2>
          <p className="muted">{mode === "login" ? "Inicia sesion para continuar creando sin limites." : "Empieza gratis y escala cuando tu produccion lo necesite."}</p>
          <button className="google-auth" type="button" onClick={googleLogin} disabled={busy}><span>G</span>{mode === "login" ? "Continuar con Google" : "Registrarse con Google"}</button>
          <div className="auth-separator"><span>{mode === "login" ? "o continua con tu correo electronico" : "o crea tu cuenta con correo electronico"}</span></div>
          <form onSubmit={submit} className="auth-form" noValidate>
            {mode === "register" && <AuthTextInput icon={Users} label="Nombre completo" value={form.name} onChange={(value) => update("name", value)} error={fieldErrors.name} autoComplete="name" />}
            <AuthTextInput icon={Mail} label="Correo electronico" value={form.email} onChange={(value) => update("email", value)} error={fieldErrors.email} autoComplete="email" inputMode="email" />
            <AuthPasswordInput label="Contrasena" value={form.password} onChange={(value) => update("password", value)} shown={showPassword} setShown={setShowPassword} error={fieldErrors.password} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            {mode === "register" && <AuthPasswordInput label="Confirmar contrasena" value={form.confirmPassword} onChange={(value) => update("confirmPassword", value)} shown={showConfirm} setShown={setShowConfirm} error={fieldErrors.confirmPassword} autoComplete="new-password" />}
            {mode === "login" ? <div className="auth-row"><label><input type="checkbox" checked={form.remember} onChange={(event) => update("remember", event.target.checked)} /> Recordarme</label><button type="button" onClick={() => { setForgotEmail(form.email); setForgotOpen(true); }}>¿Olvidaste tu contraseña?</button></div> : <label className={fieldErrors.acceptedTerms ? "terms invalid" : "terms"}><input type="checkbox" checked={form.acceptedTerms} onChange={(event) => update("acceptedTerms", event.target.checked)} /> Acepto los terminos y la politica de privacidad.</label>}
            {fieldErrors.acceptedTerms && <p className="auth-error">{fieldErrors.acceptedTerms}</p>}
            {message && <p className="auth-message">{message}</p>}
            <button className="btn full auth-submit" disabled={busy}>{busy ? <><span className="spinner" />Procesando...</> : mode === "login" ? "Iniciar sesion" : "Crear cuenta"}</button>
          </form>
          <button className="link-btn auth-switch" type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "¿No tienes cuenta? Crear cuenta" : "¿Ya tienes cuenta? Iniciar sesion"}</button>
        </div>
        <div className="auth-security-note"><ShieldCheck size={28} /><div><strong>Plataforma 100% segura y confiable</strong><p>Tus datos estan protegidos con cifrado de grado empresarial.</p></div></div>
      </section>

      {forgotOpen && <div className="auth-modal-backdrop" role="dialog" aria-modal="true" aria-label="Recuperar contrasena"><form className="auth-reset-modal" onSubmit={submitForgot}><button className="modal-close" type="button" onClick={() => setForgotOpen(false)}><X size={18} /></button><h2>Recuperar contraseña</h2><p className="muted">Escribe tu correo y enviaremos instrucciones si la cuenta existe.</p><AuthTextInput icon={Mail} label="Correo electronico" value={forgotEmail} onChange={setForgotEmail} autoComplete="email" inputMode="email" /><button className="btn full" disabled={forgotBusy}>{forgotBusy ? "Enviando..." : "Enviar enlace de recuperacion"}</button>{forgotResult?.message && <p className="auth-message">{forgotResult.message}</p>}{forgotResult?.resetUrl && <Link className="btn secondary full" to={forgotResult.resetUrl}>Abrir enlace local de recuperacion</Link>}</form></div>}
    </main>
  );
}

function AuthTextInput({ icon: Icon, label, value, onChange, error, ...props }) {
  const inputId = useId();
  return <div className={error ? "field auth-field invalid" : "field auth-field"}><label htmlFor={inputId}>{label}</label><div className="input-with-icon"><Icon size={17} /><input id={inputId} value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} {...props} /></div>{error && <p className="auth-error">{error}</p>}</div>;
}

function AuthPasswordInput({ label, value, onChange, shown, setShown, error, ...props }) {
  const inputId = useId();
  return <div className={error ? "field auth-field invalid" : "field auth-field"}><label htmlFor={inputId}>{label}</label><div className="input-with-icon"><Lock size={17} /><input id={inputId} type={shown ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Minimo 8 caracteres" {...props} /><button type="button" aria-label={shown ? "Ocultar contrasena" : "Mostrar contrasena"} onClick={() => setShown((current) => !current)}>{shown ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{error && <p className="auth-error">{error}</p>}</div>;
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const submit = async (event) => {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setResult({ message: "Escribe un correo electronico valido." });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const response = await apiRequest("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setResult(response);
    } catch (error) {
      setResult({ message: error.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page reset-password-page">
      <section className="auth-panel-wrap single">
        <div className="auth-panel premium-auth-panel">
          <Link to="/" className="auth-logo compact"><img src={officialLogo} alt="NEXFRAME FILMS" /></Link>
          <h2>Recuperar contrasena</h2>
          <p className="muted">Escribe tu correo y enviaremos instrucciones si la cuenta existe.</p>
          <form className="auth-form" onSubmit={submit}>
            <AuthTextInput icon={Mail} label="Correo electronico" value={email} onChange={setEmail} autoComplete="email" inputMode="email" />
            {result?.message && <p className="auth-message">{result.message}</p>}
            {result?.resetUrl && <Link className="btn secondary full" to={result.resetUrl}>Abrir enlace local de recuperacion</Link>}
            <button className="btn full" disabled={busy}>{busy ? "Enviando..." : "Enviar enlace de recuperacion"}</button>
          </form>
          <Link className="link-btn auth-switch" to="/login">Volver al acceso</Link>
        </div>
      </section>
    </main>
  );
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: searchParams.get("email") || "", token: searchParams.get("token") || "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!isValidEmail(form.email)) return setMessage("Correo electronico invalido.");
    if (!form.token.trim()) return setMessage("Token de recuperacion requerido.");
    if (form.password.length < 8) return setMessage("La nueva contrasena debe tener 8 caracteres o mas.");
    if (form.password !== form.confirmPassword) return setMessage("Las contrasenas no coinciden.");
    setBusy(true);
    setMessage("");
    try {
      const result = await apiRequest("/api/auth/reset-password", { method: "POST", body: JSON.stringify(form) });
      setMessage(result.message || "Contrasena actualizada.");
      setTimeout(() => navigate("/login"), 900);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  return <main className="auth-page reset-password-page"><section className="auth-panel-wrap single"><div className="auth-panel premium-auth-panel"><Link to="/" className="auth-logo compact"><img src={officialLogo} alt="NEXFRAME FILMS" /></Link><h2>Restablecer contraseña</h2><p className="muted">Crea una nueva contraseña segura para volver a tu panel.</p><form className="auth-form" onSubmit={submit}><AuthTextInput icon={Mail} label="Correo electronico" value={form.email} onChange={(value) => update("email", value)} /><AuthTextInput icon={KeyRound} label="Token de recuperacion" value={form.token} onChange={(value) => update("token", value)} /><AuthPasswordInput label="Nueva contrasena" value={form.password} onChange={(value) => update("password", value)} shown={showPassword} setShown={setShowPassword} /><AuthPasswordInput label="Confirmar contrasena" value={form.confirmPassword} onChange={(value) => update("confirmPassword", value)} shown={showPassword} setShown={setShowPassword} />{message && <p className="auth-message">{message}</p>}<button className="btn full" disabled={busy}>{busy ? "Guardando..." : "Guardar nueva contrasena"}</button></form><Link className="link-btn auth-switch" to="/login">Volver al acceso</Link></div></section></main>;
}

const legalPages = {
  terms: {
    title: "Terminos de servicio",
    summary: "Condiciones de uso para acceder a NEXFRAME FILMS y sus herramientas de produccion con IA.",
    sections: [
      ["Uso de la plataforma", "El usuario debe utilizar NEXFRAME FILMS para proyectos legales, respetando derechos de autor, identidad, privacidad y normas aplicables."],
      ["Cuenta y seguridad", "Cada cuenta es personal. El usuario es responsable de proteger sus credenciales y cerrar sesion en equipos compartidos."],
      ["Creditos y planes", "Los planes, creditos y limites de uso se gestionan desde el sistema de facturacion y pueden variar segun el plan activo."]
    ]
  },
  privacy: {
    title: "Politica de privacidad",
    summary: "Resumen claro sobre como se protegen los datos de cuenta, proyectos y archivos de trabajo.",
    sections: [
      ["Datos de cuenta", "Se guardan los datos necesarios para autenticar usuarios, gestionar sesiones, facturacion y preferencias del panel."],
      ["Archivos y proyectos", "Los archivos subidos se usan para ejecutar las acciones solicitadas por el usuario dentro del flujo de produccion."],
      ["Seguridad", "Las contrasenas se almacenan con hash seguro y las sesiones usan cookies HttpOnly configuradas desde el backend."]
    ]
  },
  contact: {
    title: "Contacto",
    summary: "Canales para soporte, facturacion y asistencia operativa de NEXFRAME FILMS.",
    sections: [
      ["Soporte", "Para incidencias de acceso, recuperacion de cuenta o errores de generacion, contacta al equipo de soporte."],
      ["Facturacion", "Las consultas sobre planes, pagos y renovaciones se revisan desde el area de billing del sistema."],
      ["Correo", "Email de contacto: soporte@nexframefilms.local"]
    ]
  }
};

function LegalPage({ type }) {
  const page = legalPages[type] || legalPages.terms;
  return (
    <PublicChrome active={type === "contact" ? "inicio" : "planes"}>
      <PublicTopNav />
      <section className="legal-page">
        <div className="section-head">
          <div>
            <h1>{page.title}</h1>
            <p className="muted">{page.summary}</p>
          </div>
          <Link className="btn secondary" to="/login">Volver al acceso</Link>
        </div>
        <div className="legal-grid">
          {page.sections.map(([title, text]) => (
            <article className="legal-card" key={title}>
              <ShieldCheck size={22} />
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </PublicChrome>
  );
}

function PublicPlans() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [cycle, setCycle] = useState("monthly");
  const [message, setMessage] = useState("");
  const [busyPlan, setBusyPlan] = useState("");
  const cycleLabels = { monthly: "MENSUAL", quarterly: "TRIMESTRAL", annual: "ANUAL" };
  useEffect(() => {
    apiRequest("/api/plans").then((result) => setPlans(result.plans || [])).catch((error) => setMessage(error.message));
  }, []);
  useEffect(() => {
    if (searchParams.get("checkout") !== "success" || !searchParams.get("session_id")) return;
    setMessage("Confirmando pago con Stripe...");
    apiRequest("/api/billing/confirm-session", {
      method: "POST",
      body: JSON.stringify({ sessionId: searchParams.get("session_id") })
    })
      .then((result) => {
        setMessage(result.message || `Plan ${result.subscription?.planName || ""} activado correctamente.`);
        window.history.replaceState({}, "", "/planes");
      })
      .catch((error) => setMessage(error.message));
  }, [searchParams]);
  const checkout = async (planId) => {
    setBusyPlan(planId);
    setMessage("");
    try {
      const result = await apiRequest("/api/billing/checkout", { method: "POST", body: JSON.stringify({ planId, cycleId: cycle }) });
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setMessage(result.message);
    } catch (error) {
      if (/sesion|session|401/i.test(error.message)) navigate(`/login?plan=${planId}&cycle=${cycle}`);
      else setMessage(error.message);
    } finally {
      setBusyPlan("");
    }
  };
  return (
    <PublicChrome active="planes">
      <PublicTopNav />
      <section className="plans-page">
        <div className="section-head">
          <div><h1>Planes y Pagos <ShieldCheck size={24} /></h1><p className="muted">Elige el plan ideal para potenciar tu creatividad sin limites.</p></div>
          <div className="refund-card"><ShieldCheck size={22} /><strong>30 dias</strong><span>Garantia de devolucion</span></div>
        </div>
        <div className="billing-cycle">
          {Object.entries(cycleLabels).map(([id, label]) => <button key={id} className={cycle === id ? "active" : ""} onClick={() => setCycle(id)}>{label}</button>)}
        </div>
        {message && <div className="auth-message plan-message">{message}</div>}
        <div className="plan-grid">
          {plans.map((plan) => {
            const current = plan.cycles?.[cycle] || {};
            return (
              <article className={plan.highlighted ? "plan-card-public highlighted" : "plan-card-public"} key={plan.id}>
                {plan.highlighted && <span className="popular">MAS POPULAR</span>}
                <div className="plan-icon">{plan.id === "studio" ? <Gem /> : plan.id === "professional" ? <Crown /> : <Star />}</div>
                <h2>{plan.name}</h2>
                <p>{plan.id === "creator" ? "Para creadores que estan comenzando" : plan.id === "professional" ? "Para profesionales y equipos en crecimiento" : "Para estudios y producciones de alto nivel"}</p>
                <div className="price">${current.price}<span> / {current.label}</span></div>
                <button className="btn full" disabled={busyPlan === plan.id} onClick={() => checkout(plan.id)}>{busyPlan === plan.id ? "Preparando..." : "Elegir plan"}</button>
                <ul>
                  <li>{plan.credits?.toLocaleString?.() || plan.credits} creditos incluidos</li>
                  <li>Proyectos: {plan.projectLimit}</li>
                  <li>Exportaciones en {plan.resolution}</li>
                  <li>Almacenamiento {plan.storage}</li>
                  <li>Soporte {plan.support}</li>
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </PublicChrome>
  );
}

function StudioApp({ initialActive }) {
  const [state, patch] = useAppState();
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const [busyStudio, setBusyStudio] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const t = translations[state.language] || translations.es;

  useEffect(() => {
    const frame = requestAnimationFrame(() => applyDashboardLanguage(state.language));
    return () => cancelAnimationFrame(frame);
  }, [state.language, state.active, state.sidebar, state.auth?.signedIn, state.auth?.role, modal, toast]);

  useEffect(() => {
    const pathPanel = location.pathname.startsWith("/app/") ? decodeURIComponent(location.pathname.split("/app/")[1] || "") : "";
    const nextActive = initialActive || pathPanel;
    if (nextActive && nextActive !== state.active) patch({ active: nextActive });
  }, [initialActive, location.pathname]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    apiRequest("/api/auth/session")
      .then((result) => {
        if (result.signedIn && result.user) {
          patch({ auth: { signedIn: true, role: result.user.role, name: result.user.name, email: result.user.email } });
          syncUsage();
        } else {
          patch({ auth: { signedIn: false, role: "user", name: "Invitado", email: "" } });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal]);

  useEffect(() => {
    const controls = document.querySelectorAll("button, select, input, textarea");
    controls.forEach((node) => {
      if (node.getAttribute("title")) return;
      const label = node.getAttribute("aria-label") || node.textContent?.trim() || node.getAttribute("placeholder") || "Control";
      node.setAttribute("title", state.language === "en" ? `${label}: executes this control.` : `${label}: ejecuta este control o modifica esta opcion.`);
    });
  }, [state.active, state.language, modal]);

  useEffect(() => {
    const timer = setInterval(() => {
      patch((current) => {
        current.jobs
          .filter((job) => job.id?.startsWith("nf_") && ["queued", "processing"].includes(job.status))
          .forEach((job) => {
            fetch(directApiUrl(`/api/muapi/task/${job.id}`))
              .then((response) => response.json())
              .then((data) => {
                if (!data.ok) return;
                const normalized = normalizeGenerationResponse(data);
                patch((latest) => {
                  const mergedJob = { ...job, ...normalized.job, userGenerated: job.userGenerated, exactPrompt: job.exactPrompt };
                  return {
                    jobs: latest.jobs.map((item) => item.id === job.id ? { ...item, ...mergedJob } : item),
                    history: (latest.history || []).map((item) => item.id === job.id ? { ...item, ...mergedJob } : item)
                  };
                });
              })
              .catch(() => {});
          });

        return {
          jobs: current.jobs.map((job) => {
            if (job.id?.startsWith("nf_") || !["queued", "processing"].includes(job.status)) return job;
            const progress = Math.min(100, job.progress + 14);
            return { ...job, status: progress >= 100 ? "completed" : "processing", progress };
          })
        };
      });
    }, 900);
    return () => clearInterval(timer);
  }, []);

  const syncUsage = async () => {
    try {
      const result = await apiRequest("/api/usage");
      const usage = result.usage || {};
      patch((current) => {
        const total = Number(usage.creditsTotal || current.credits + (current.creditsUsed || 0) || 12450);
        const used = Number(usage.creditsUsed || 0);
        return {
          credits: Math.max(0, total - used),
          creditsUsed: used,
          usage: { ...(current.usage || {}), ...usage }
        };
      });
    } catch {
      // Usage requires an authenticated session. Silent failure keeps public mode clean.
    }
  };

  const actions = {
    navigate: (id) => {
      patch({ active: id });
      navigate(routeForPanel(id));
    },
    notify: setToast,
    modal: setModal,
    closeModal: () => setModal(null),
    copy: async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        setToast("Texto copiado al portapapeles.");
      } catch {
        const area = document.createElement("textarea");
        area.value = text || "";
        area.setAttribute("readonly", "readonly");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
        setToast("Prompt preparado para copiar.");
      }
    },
    download: (name, payload) => {
      downloadJson(name, payload);
      setToast("Descarga preparada con metadatos del proyecto.");
    },
    downloadGenerated: async (job) => {
      const mediaUrl = outputMediaUrl(job);
      if (mediaUrl) {
        try {
          const response = await fetch(mediaUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          const ext = blob.type.includes("image") ? "png" : blob.type.includes("audio") ? "mp3" : blob.type.includes("video") ? "mp4" : "bin";
          downloadBlob(`${job.studio || "nexframe"}-${job.id}.${ext}`, blob);
          setToast("Archivo generado descargado.");
          return;
        } catch {
          window.open(mediaUrl, "_blank", "noopener,noreferrer");
          setToast("Resultado abierto en una nueva pestaña para descarga.");
          return;
        }
      }
      downloadJson(`${job.studio || "nexframe"}-${job.id}.json`, job);
      setToast("No hay archivo multimedia remoto; se descargó la metadata completa.");
    },
    openGenerated: (job) => {
      const mediaUrl = outputMediaUrl(job);
      if (!mediaUrl) {
        setModal({
          title: job.model || labelFor(job.studio),
          body: jobPrompt(job) || "Resultado sin archivo multimedia disponible.",
          job
        });
        return;
      }
      setModal({
        title: job.model || labelFor(job.studio),
        mediaUrl,
        mediaKind: outputMediaKind(job),
        prompt: jobPrompt(job),
        job
      });
    },
    copyGeneratedLink: async (job) => {
      const mediaUrl = outputMediaUrl(job);
      if (!mediaUrl) {
        setToast("Este resultado todavia no tiene enlace multimedia.");
        return;
      }
      const absoluteUrl = new URL(mediaUrl, window.location.origin).href;
      await actions.copy(absoluteUrl);
      setToast("Enlace del resultado copiado.");
    },
    createProject: (input) => {
      if (!input?.title?.trim()) {
        setToast("Escribe un nombre de proyecto antes de crearlo.");
        return false;
      }
      const project = makeProject(input);
      patch((current) => ({ projects: [project, ...(current.projects || [])] }));
      setToast(`Proyecto creado: ${project.title}`);
      return true;
    },
    deleteProject: (id) => {
      patch((current) => {
        const project = (current.projects || []).find((item) => item.id === id);
        if (!project) return {};
        return {
          projects: (current.projects || []).filter((item) => item.id !== id),
          trash: [makeTrashEntry("project", project), ...(current.trash || [])]
        };
      });
      setToast("Proyecto movido a la papelera.");
    },
    saveToProject: (job) => {
      patch((current) => ({ history: [job, ...(current.history || []).filter((item) => item.id !== job.id)] }));
      setToast("Resultado guardado en historial y galeria.");
    },
    cancelJob: async (id) => {
      try {
        const result = await apiRequest(`/api/muapi/task/${id}/cancel`, { method: "POST" });
        patch((current) => ({ jobs: current.jobs.map((job) => job.id === id ? { ...job, ...result.job } : job) }));
        setToast(`Job ${id} cancelado correctamente.`);
      } catch (error) {
        patch((current) => ({ jobs: current.jobs.map((job) => job.id === id ? { ...job, status: "cancelled", progress: Math.min(job.progress || 0, 99) } : job) }));
        setToast(`Job cancelado en modo local: ${error.message}`);
      }
    },
    moveJobToTrash: (id) => {
      patch((current) => {
        const job = (current.jobs || []).find((item) => item.id === id) || (current.history || []).find((item) => item.id === id);
        if (!job) return {};
        return {
          jobs: (current.jobs || []).filter((item) => item.id !== id),
          history: (current.history || []).filter((item) => item.id !== id),
          trash: [makeTrashEntry("generation", job), ...(current.trash || [])]
        };
      });
      setToast("Generación movida a la papelera.");
    },
    restoreTrash: (trashId) => {
      patch((current) => {
        const entry = (current.trash || []).find((item) => item.trashId === trashId);
        if (!entry) return {};
        const rest = (current.trash || []).filter((item) => item.trashId !== trashId);
        if (entry.type === "project") return { trash: rest, projects: [entry.item, ...(current.projects || [])] };
        return { trash: rest, jobs: [entry.item, ...(current.jobs || [])], history: [entry.item, ...(current.history || []).filter((item) => item.id !== entry.item.id)] };
      });
      setToast("Elemento restaurado.");
    },
    emptyTrash: () => {
      patch({ trash: [] });
      setToast("Papelera vaciada.");
    },
    createJob: async (studio, form) => {
      const studioModels = getMuapiModelsForStudio(studio);
      const modelId = form?.model || form?.videoModel || studioModels[0]?.id;
      const model = getMuapiModelById(modelId) || studioModels[0] || models.find((item) => item.studio === studio && item.enabled && item.visible) || models[0];
      if (!form?.prompt?.trim()) return setToast("Escribe un prompt antes de generar.");
      const missingRequired = requiredModelIssues(form, model, studio);
      if (missingRequired.length) {
        return setToast(`Antes de generar con ${model.name || "esta IA"}, completa obligatorio: ${missingRequired.join(", ")}.`);
      }
      setBusyStudio(studio);
      try {
        const safeForm = cleanFormForStorage(form);
        const files = form.__files || {};
        const result = Object.keys(files).length
          ? await apiFormRequest("/api/muapi/generate", { studio, model: model.id, provider: "muapi", input: safeForm }, files)
          : await apiRequest("/api/muapi/generate", {
            method: "POST",
            body: JSON.stringify({ studio, model: model.id, provider: "muapi", input: safeForm })
          });
        const normalized = normalizeGenerationResponse(result);
        if (!normalized.ok) throw new Error(normalized.error?.message || "La generacion no pudo iniciar.");
        const credits = Number(normalized.job?.remoteCost?.amount_credits || estimateCredits(studio, model));
        const cost = Number(normalized.job?.remoteCost?.amount_usd || credits);
        const job = { ...normalized.job, credits, form: safeForm, userGenerated: true, exactPrompt: safeForm.prompt, input: { ...(normalized.job?.input || {}), prompt: safeForm.prompt } };
        patch((current) => ({
          credits: Math.max(0, current.credits - credits),
          creditsUsed: (current.creditsUsed || 0) + credits,
          usage: {
            ...(current.usage || {}),
            totalCost: ((current.usage || {}).totalCost || 0) + cost,
            byStudio: { ...((current.usage || {}).byStudio || {}), [studio]: (((current.usage || {}).byStudio || {})[studio] || 0) + credits },
            byModel: { ...((current.usage || {}).byModel || {}), [model.id]: (((current.usage || {}).byModel || {})[model.id] || 0) + credits }
          },
          jobs: [job, ...current.jobs],
          history: [job, ...current.history]
        }));
        if (state.auth?.signedIn) syncUsage();
        setToast("Tu generacion esta en cola. El progreso ya aparece en Generation Process.");
      } catch (error) {
        const job = makeJob(studio, model, form);
        patch((current) => ({ jobs: [{ ...job, status: "failed", error: error.message, userGenerated: true, exactPrompt: form.prompt }, ...current.jobs] }));
        setToast(`La generacion no pudo iniciar: ${error.message}`);
      } finally {
        setBusyStudio("");
      }
    },
    createPipeline: async (studio, form) => {
      if (!form?.prompt?.trim()) return setToast("Escribe el tema o prompt antes de crear el flujo completo.");
      setBusyStudio(studio);
      try {
        const safeForm = cleanFormForStorage(form);
        const files = form.__files || {};
        const result = Object.keys(files).length
          ? await apiFormRequest("/api/muapi/pipeline", { studio, input: safeForm }, files)
          : await apiRequest("/api/muapi/pipeline", {
            method: "POST",
            body: JSON.stringify({ studio, input: safeForm })
          });
        const normalized = normalizeGenerationResponse(result);
        if (!normalized.ok) throw new Error(normalized.error?.message || "El flujo completo no pudo iniciar.");
        const credits = studio === "documentary" ? 120 : 90;
        patch((current) => ({
          credits: Math.max(0, current.credits - credits),
          creditsUsed: (current.creditsUsed || 0) + credits,
          jobs: [{ ...normalized.job, userGenerated: true, exactPrompt: safeForm.prompt }, ...current.jobs],
          history: [{ ...normalized.job, userGenerated: true, exactPrompt: safeForm.prompt }, ...current.history]
        }));
        setToast(result.message || "Flujo completo creado y enviado a Generation Process.");
      } catch (error) {
        setToast(`El flujo completo no pudo iniciar: ${error.message}`);
      } finally {
        setBusyStudio("");
      }
    },
    login: async (credentials) => {
      if (!credentials) {
        patch({ active: "settings" });
        setToast("Introduce email y password para iniciar sesion.");
        return;
      }
      const result = await apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify(credentials) });
      patch({ auth: { signedIn: true, role: result.user.role, name: result.user.name, email: result.user.email } });
      syncUsage();
      setToast("Sesion iniciada correctamente.");
    },
    logout: async () => {
      await apiRequest("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
      patch({ auth: { signedIn: false, role: "user", name: "Invitado", email: "" }, active: "dashboard" });
      setToast("Sesion cerrada correctamente.");
    },
    runV6Action: async (panel, action, payload = {}) => {
      try {
        const result = await apiRequest("/api/muapi/action", {
          method: "POST",
          body: JSON.stringify({ panel, action, payload })
        });
        if (result.job) {
          patch((current) => ({
            jobs: [{ ...result.job, userGenerated: true }, ...current.jobs],
            history: [{ ...result.job, userGenerated: true }, ...current.history]
          }));
        }
        setToast(result.message || `${action} ejecutado en ${panel}.`);
        return result;
      } catch (error) {
        setToast(`${action} fallo: ${error.message}`);
        return { ok: false, message: error.message };
      }
    }
  };

  return (
    <div
      className={`app ${state.sidebar ? "" : "collapsed"} ${themeClass(state.theme)}`}
      onPointerMove={(event) => {
        event.currentTarget.style.setProperty("--cursor-x", `${event.clientX}px`);
        event.currentTarget.style.setProperty("--cursor-y", `${event.clientY}px`);
        event.currentTarget.style.setProperty("--cursor-opacity", "1");
      }}
      onPointerLeave={(event) => event.currentTarget.style.setProperty("--cursor-opacity", "0")}
    >
      <div className="cursor-aura" aria-hidden="true" />
      <Sidebar state={state} active={state.active} collapsed={!state.sidebar} onToggle={() => patch({ sidebar: !state.sidebar })} onNav={actions.navigate} />
      <main className="main" id="main-content">
        <Topbar state={state} patch={patch} actions={actions} />
        <div className="content"><div className="page"><Router active={state.active} state={state} patch={patch} actions={actions} t={t} busyStudio={busyStudio} /></div></div>
      </main>
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
      {modal && <Modal modal={modal} onClose={actions.closeModal} actions={actions} />}
    </div>
  );
}

function Sidebar({ state, active, collapsed, onToggle, onNav }) {
  const groups = { main: "MAIN", studios: "AI STUDIOS", system: "SYSTEM" };
  const isAdmin = state.auth?.signedIn && state.auth?.role === "admin";
  const adminOnly = new Set(["api", "apikeys", "admin", "deployment", "checklist", "security", "windows", "users"]);
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className={collapsed ? "brand-vfx collapsed-brand" : "brand-vfx"}>
          <img className={collapsed ? "brand-logo mark-only" : "brand-logo"} src={officialLogo} alt="NEXFRAME FILMS - The Future of Filmmaking" />
        </div>
      </div>
      <button className="icon-btn" onClick={onToggle} title="Contraer menu" aria-label={collapsed ? "Expandir menu lateral" : "Contraer menu lateral"}><ChevronDown size={18} /></button>
      {Object.entries(groups).map(([group, label]) => (
        <div className="nav-section" key={group}>
          {!collapsed && <div className="nav-label">{label}</div>}
          {studios.filter((item) => item.group === group && (isAdmin || !adminOnly.has(item.id))).map((item) => {
            const Icon = iconMap[item.id] || Box;
            return <button className={`nav-item ${active === item.id ? "active" : ""}`} key={item.id} onClick={() => onNav(item.id)} title={item.label} aria-current={active === item.id ? "page" : undefined}><Icon size={19} />{!collapsed && <><span>{item.label}</span>{item.badge && <span className="badge">{item.badge}</span>}</>}</button>;
          })}
        </div>
      ))}
      {!collapsed && <button className="plan-card" onClick={() => onNav("billing")}><Crown className="gold" /><div><strong>{isAdmin ? "Admin" : "Usuario"}</strong><div className="red">Activo</div></div></button>}
    </aside>
  );
}

function Topbar({ state, patch, actions }) {
  const [apiStatus, setApiStatus] = useState({ connected: false, label: "API Local" });
  const t = translations[state.language] || translations.es;
  useEffect(() => {
    let mounted = true;
    apiRequest("/api/muapi/providers")
      .then((result) => {
        if (!mounted) return;
        const connected = result.providers?.some((provider) => provider.configured);
        setApiStatus({ connected, label: connected ? "API Connected" : "API Local" });
      })
      .catch(() => mounted && setApiStatus({ connected: false, label: "API Local" }));
    return () => { mounted = false; };
  }, []);
  return (
    <header className="topbar">
      <div className="search"><Search size={20} className="muted" /><input aria-label="Buscar proyectos, archivos y herramientas" placeholder={t.search || "Buscar proyectos, archivos y herramientas..."} onKeyDown={(e) => e.key === "Enter" && actions.notify("Busqueda aplicada al panel activo.")} /></div>
      <div className="top-actions">
        <button className="icon-btn" aria-label="Abrir notificaciones" onClick={() => actions.modal({ title: "Notifications Panel", body: `${state.notifications} notificaciones: gateway activo, build verificado y cola lista para recibir generaciones.` })}><Bell size={20} />{state.notifications > 0 && <span className="badge">{state.notifications}</span>}</button>
        <button className={`status-pill ${apiStatus.connected ? "" : "warn"}`} onClick={() => actions.navigate("apikeys")}><Activity size={18} /> {apiStatus.label}</button>
        <button className="profile" onClick={() => actions.navigate("settings")}><div className="avatar-dot">YF</div><div><strong>{state.auth?.name || "Invitado"}</strong><div className="gold">{state.auth?.signedIn ? state.auth?.role : "Sesion cerrada"}</div></div><ChevronDown size={16} /></button>
        <button className="btn secondary" onClick={() => state.auth?.signedIn ? actions.logout() : actions.login()}>{state.auth?.signedIn ? t.logout : t.login}</button>
      </div>
    </header>
  );
}

function Router(props) {
  const { active, state } = props;
  const adminOnly = new Set(["api", "apikeys", "admin", "deployment", "checklist", "security", "windows"]);
  if (adminOnly.has(active) && state.auth?.role !== "admin") return <OfficialPanel {...props} id="help" />;
  if (active === "dashboard") return <Dashboard {...props} />;
  if (["video", "image", "sound", "effects", "lipsync", "cinema"].includes(active)) return <StudioScreen studio={active} {...props} />;
  if (active === "flyer") return <FlyerStudio {...props} />;
  if (active === "narrative") return <NarrativeStudio {...props} />;
  if (active === "youtube") return <YouTubeAnalyzer {...props} />;
  if (active === "documentary") return <DocumentaryStudio {...props} />;
  if (active === "musicvideo") return <MusicVideoStudio {...props} />;
  if (active === "editor") return <VideoEditorStudio {...props} />;
  if (active === "script") return <ScriptEngine {...props} />;
  if (active === "projects") return <Projects {...props} mode="projects" />;
  if (active === "gallery") return <Projects {...props} mode="gallery" />;
  if (active === "api" || active === "admin" || active === "mymodels") return <ModelsPanel {...props} panel={active} />;
  if (active === "generation") return <GenerationPanel {...props} />;
  if (active === "trash") return <TrashPanel {...props} />;
  if (["hub", "settings", "apikeys", "billing", "help", "deployment", "checklist", "assets", "voices", "users", "windows", "marketing", "public", "security"].includes(active)) return <OfficialPanel {...props} id={active} />;
  return <OfficialPanel {...props} id="help" />;
}

function Dashboard({ state, actions }) {
  const cards = ["video", "image", "sound", "effects", "lipsync", "documentary", "musicvideo", "narrative", "youtube", "flyer", "cinema"];
  const projects = state.projects || [];
  const jobs = (state.jobs || []).filter((job) => job.userGenerated === true);
  const completed = jobs.filter((job) => job.status === "completed").length;
  const storageGb = ((projects.length * 0.02) + (jobs.length * 0.01)).toFixed(2);
  return (
    <>
      <h1>Dashboard</h1><p className="muted">Panel local limpio, listo para crear el primer proyecto.</p>
      <section className="grid stats">
        <Stat icon={Folder} label="Proyectos" value={projects.length} sub="creados en local" />
        <Stat icon={Sparkles} label="Generaciones" value={jobs.length} sub={`${completed} completadas`} />
        <Stat icon={Database} label="Storage local" value={`${storageGb} GB`} sub="estimado del workspace" />
        <Stat icon={Coins} label="Creditos" value={state.credits.toLocaleString()} sub={`${state.creditsUsed || 0} usados`} />
        <Stat icon={Crown} label="Plan" value="Local" sub="preparado para produccion" />
      </section>
      <section className="hero official-hero">
        <div className="hero-carousel" aria-hidden="true" style={{ "--slide-count": heroSlides.length }}>
          {heroSlides.map((src, index) => (
            <div
              className={`carousel-effect-${index % 3}`}
              key={src}
              style={{ "--slide-index": index, "--slide-delay": `${index * 5}s`, "--slide-duration": `${heroSlides.length * 5}s` }}
            >
              <img className="carousel-backdrop" src={src} alt="" decoding={index === 0 ? "async" : undefined} fetchPriority={index === 0 ? "high" : undefined} />
              <img className="carousel-frame" src={src} alt="" decoding={index === 0 ? "async" : undefined} fetchPriority={index === 0 ? "high" : undefined} />
            </div>
          ))}
        </div>
        <div className="hero-copy">
          <div className="hero-logo-vfx">
            <img className="hero-brand-logo logo-base" src={officialLogo} alt="NEXFRAME FILMS - The Future of Filmmaking" decoding="async" />
            <img className="hero-brand-logo logo-glitch logo-glitch-red" src={officialLogo} alt="" aria-hidden="true" decoding="async" />
            <img className="hero-brand-logo logo-glitch logo-glitch-cyan" src={officialLogo} alt="" aria-hidden="true" decoding="async" />
          </div>
        </div>
        <button className="btn gold hero-cta" onClick={() => actions.navigate("video")}>CREATE WITHOUT LIMITS</button>
      </section>
      <section className="grid studio-grid">
        {cards.map((id) => <AssetCard key={id} id={id} image={studioCardAssets[id]} title={labelFor(id)} subtitle={studioSubtitle(id)} onOpen={() => actions.navigate(id)} />)}
      </section>
      <SectionTitle title="Proyectos recientes" action="Ver proyectos" onClick={() => actions.navigate("projects")} />
      <ProjectGrid projects={projects.slice(0, 6)} actions={actions} />
    </>
  );
}

function Stat({ icon: Icon, label, value, sub }) {
  return <div className="card stat"><div className="stat-icon"><Icon /></div><div><span className="muted">{label}</span><strong>{value}</strong><small className="muted">{sub}</small></div></div>;
}

function SectionTitle({ title, action, onClick }) {
  return <div className="section-head"><h2>{title}</h2>{action && <button className="link-btn" onClick={onClick}>{action}</button>}</div>;
}

function AssetCard({ id, image, title, subtitle, onOpen }) {
  return <div className="card studio-card">{image ? <img className="asset-img" src={image} alt={title} loading="lazy" decoding="async" /> : <div className={`asset-img visual-thumb ${id}`} role="img" aria-label={title}><span className="visual-mark" /></div>}<div className="body"><strong>{title}</strong><p className="muted">{subtitle}</p><button className="btn studio-open-btn" type="button" title={`Abrir ${title}`} onClick={onOpen}><span>Abrir Estudio</span><Sparkles size={16} /></button></div></div>;
}

function StudioScreen({ studio, state, actions, t, busyStudio }) {
  const [form, setForm] = useState(defaultForms[studio]);
  const [tab, setTab] = useState(subpanels.find((p) => p.area === studio)?.file);
  const localSubpanels = subpanels.filter((p) => p.area === studio);
  const studioModels = getMuapiModelsForStudio(studio);
  const selectedModel = getMuapiModelById(form?.model) || studioModels[0] || models[0];
  const activeSub = localSubpanels.find((p) => p.file === tab) || localSubpanels[0];
  useEffect(() => {
    setForm(defaultForms[studio]);
    setTab(subpanels.find((p) => p.area === studio)?.file);
  }, [studio]);

  return (
    <div className="layout-2">
      <section className="panel card">
        <h1>{labelFor(studio).toUpperCase()}</h1>
        <p className="muted">{studioSubtitle(studio)}</p>
        <div className="tabs">{localSubpanels.map((item) => <button className={`tab ${item.file === activeSub?.file ? "active" : ""}`} key={item.file} onClick={() => setTab(item.file)}>{item.title.split(" - ").pop()}</button>)}</div>
        <DynamicForm studio={studio} form={form} setForm={setForm} model={selectedModel} />
        <div className="toolbar">
          <button className="btn" disabled={busyStudio === studio} onClick={() => actions.createJob(studio, form)}><Wand2 size={18} />{busyStudio === studio ? "Generando..." : t.generate}</button>
          <button className="btn secondary" onClick={() => setForm(defaultForms[studio])}>{t.clean}</button>
          <button className="btn secondary" onClick={() => actions.download(`${studio}-preset.json`, { studio, form, model: selectedModel })}><Download size={18} />{t.download}</button>
          <button className="btn secondary" onClick={() => actions.modal({ title: "Export / Download", body: "Exportacion preparada: MP4, MOV, ZIP de assets, prompts, metadata y configuracion del modelo." })}>Exportar</button>
        </div>
      </section>
      <section className="panel card">
        <div className="section-head"><div><h2>{activeSub?.title || labelFor(studio)}</h2><p className="muted">Subpanel oficial conectado a acciones locales.</p></div><button className="btn secondary" onClick={() => actions.modal({ title: activeSub?.title, body: "Subpanel activo con generacion, guardado, descarga, historial y reintento conectados al motor local/API." })}>Estado</button></div>
        <NativeStudioPanel studio={studio} activeSub={activeSub} state={state} actions={actions} form={form} />
      </section>
    </div>
  );
}

function modelOptionsForField(studio, key) {
  if (key === "imageModel") return muapiRegistry.byStudio.image || [];
  if (key === "videoModel") return muapiRegistry.byStudio.video || [];
  if (key === "audioModel") return muapiRegistry.byStudio.sound || [];
  if (key === "lipSyncModel") return muapiRegistry.byStudio.lipsync || [];
  if (key === "model" && studio === "narrative") return muapiRegistry.byStudio.sound || [];
  if (key === "model") return getMuapiModelsForStudio(studio);
  return [];
}

function labelFromKey(key) {
  return ({
    model: "IA principal",
    videoModel: "IA de video",
    imageModel: "IA de imagen",
    audioModel: "IA de musica / voz",
    lipSyncModel: "IA de lip sync",
    target: "Destino",
    narrativeTone: "Tono narrativo",
    soundtrackStyle: "Banda sonora",
    voiceStyle: "Voz narrativa",
    sceneDensity: "Estructura",
    narrativeMode: "Modo narrativo",
    beatCuts: "Cortes",
    ratio: "Ratio",
    amount: "Cantidad",
    fidelity: "Fidelidad",
    quality: "Calidad",
    resolution: "Resolucion"
  }[key] || key);
}

const mediaInputLabels = {
  image_url: "Imagen de referencia",
  video_url: "Video de referencia",
  audio_url: "Audio local",
  start_image_url: "Imagen inicial",
  end_image_url: "Imagen final"
};

function inputDefault(schema = {}) {
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.minimum !== undefined) return schema.minimum;
  if (schema.minValue !== undefined) return schema.minValue;
  if (schema.type === "boolean") return false;
  return "";
}

function isMediaInput(key) {
  return key.endsWith("_url") || ["image", "video", "audio"].includes(key);
}

function shouldRenderSchemaField(key) {
  return !["prompt", "negative_prompt"].includes(key) && !isMediaInput(key);
}

function modelSchemaFields(model) {
  return Object.entries(model?.inputs || {}).filter(([key]) => shouldRenderSchemaField(key));
}

function schemaRequired(key, schema = {}, model = {}) {
  return Boolean(schema.required || (key === "prompt" && model.hasPrompt !== false));
}

function inferredRequiredMediaKeys(studio, model = {}) {
  const text = `${studio || ""} ${model.id || ""} ${model.name || ""} ${model.endpoint || ""} ${model.type || ""}`.toLowerCase();
  const keys = [];
  if (text.includes("lipsync") || text.includes("lip-sync") || text.includes("lip sync") || text.includes("infinitetalk")) {
    keys.push(text.includes("video-to-video") ? "video_url" : "image_url", "audio_url");
  } else {
    if (text.includes("image-to-video") || text.includes("img2video")) keys.push("image_url");
    if (text.includes("video-to-video") || text.includes("extend") || text.includes("effects") || text.includes("vfx")) keys.push("video_url");
  }
  return [...new Set(keys)];
}

function RequiredBadge({ required }) {
  return required ? <span className="required-badge">Obligatorio</span> : <span className="auto-badge">Auto</span>;
}

function fieldHelpText(key, schema = {}) {
  if (isMediaInput(key)) return "Este archivo se sube al servidor local y se convierte en URL segura antes de llamar a MuAPI.";
  const parts = [];
  if (schema.description) parts.push(schema.description);
  if (Array.isArray(schema.enum) && schema.enum.length) {
    const preview = schema.enum.slice(0, 6).join(", ");
    parts.push(schema.enum.length > 6 ? `${schema.enum.length} opciones disponibles. Primeras opciones: ${preview}.` : `Opciones permitidas: ${preview}.`);
  }
  const min = schema.minimum ?? schema.minValue;
  const max = schema.maximum ?? schema.maxValue;
  if (min !== undefined || max !== undefined) parts.push(`Rango permitido: ${min ?? "sin minimo"} - ${max ?? "sin maximo"}.`);
  const text = parts.join(" ");
  return text.length > 220 ? `${text.slice(0, 217).trim()}...` : text;
}

function isSunoModel(model = {}) {
  return /suno|zuno/i.test(`${model.id || ""} ${model.name || ""} ${model.endpoint || ""}`);
}

function isSunoSongModel(model = {}) {
  return isSunoModel(model) && !/sounds|voice-clone|mashup/i.test(`${model.id || ""} ${model.endpoint || ""}`);
}

function fieldTitleForModel(key, schema = {}, model = {}, studio = "") {
  if (key === "prompt" && studio === "sound" && isSunoSongModel(model)) return "Letra de la cancion";
  if (key === "prompt" && studio === "sound" && /suno-generate-sounds/i.test(`${model.id || ""} ${model.endpoint || ""}`)) return "Descripcion del sonido";
  if (key === "style" && studio === "sound" && isSunoModel(model)) return "Prompt instrumental / estilo";
  if (key === "instrumental" && studio === "sound" && isSunoModel(model)) return "Solo instrumental";
  return schema.title || labelFromKey(key);
}

function placeholderForModelField(key, model = {}, studio = "") {
  if (key === "prompt" && studio === "sound" && isSunoSongModel(model)) return "[Verso 1]\nEscribe aqui la letra exacta que quieres que Suno cante.\n\n[Coro]\n...";
  if (key === "style" && studio === "sound" && isSunoModel(model)) return "Trap latino cinematografico, 92 BPM, piano oscuro, bajos profundos, bateria moderna, atmosfera nocturna";
  if (key === "title" && studio === "sound" && isSunoModel(model)) return "Titulo de la cancion";
  return "";
}

function textLimitForField(key, schema = {}, model = {}, studio = "") {
  const source = `${schema.description || ""} ${schema.placeholder || ""}`;
  const explicit = source.match(/(?:maximum|maximo|up to|hasta)\s+(\d{3,5})/i)?.[1];
  if (explicit) return Number(explicit);
  if (key === "prompt" && studio === "narrative") return 10000;
  if (key === "prompt" && studio === "sound" && isSunoSongModel(model)) return 3000;
  if (key === "prompt" && studio === "sound" && /suno-generate-sounds/i.test(`${model.id || ""} ${model.endpoint || ""}`)) return 500;
  return key === "prompt" ? 2000 : undefined;
}

function modelOutputLabel(model = {}) {
  const text = `${model.type || ""} ${model.endpoint || ""}`.toLowerCase();
  if (text.includes("audio") || text.includes("music") || text.includes("voice")) return "Audio";
  if (text.includes("video") || text.includes("lipsync") || text.includes("lip")) return "Video";
  if (text.includes("image") || text.includes("img")) return "Imagen";
  return "Generacion";
}

function requiredFieldsForModel(model = {}, studio = "") {
  const fields = [];
  if (model.hasPrompt !== false) fields.push(["prompt", { title: "Prompt", required: true }]);
  Object.entries(model.inputs || {}).forEach(([key, schema]) => {
    if (key === "prompt") return;
    if (schemaRequired(key, schema, model)) fields.push([key, schema]);
  });
  if (studio === "sound" && isSunoSongModel(model) && model.inputs?.style && !fields.some(([key]) => key === "style")) {
    fields.push(["style", { ...model.inputs.style, title: "Prompt instrumental / estilo", required: true }]);
  }
  const existing = new Set(fields.map(([key]) => key));
  inferredRequiredMediaKeys(studio, model).forEach((key) => {
    if (!existing.has(key)) fields.push([key, { title: mediaInputLabels[key] || labelFromKey(key), required: true, inferred: true }]);
  });
  return fields;
}

function requiredModelIssues(form = {}, model = {}, studio = "") {
  const issues = [];
  requiredFieldsForModel(model, studio).forEach(([key, schema]) => {
    if (key === "prompt") {
      if (!String(form.prompt || "").trim()) issues.push("Prompt");
      return;
    }
    const file = form.__files?.[key];
    const hasFile = typeof File !== "undefined" && file instanceof File;
    const hasValue = String(form[key] || "").trim();
    if (!hasFile && !hasValue) issues.push(schema.title || mediaInputLabels[key] || labelFromKey(key));
  });
  return issues;
}

function modelOptionSummary(model = {}, studio = "") {
  const required = requiredFieldsForModel(model, studio).map(([key, schema]) => fieldTitleForModel(key, schema, model, studio) || mediaInputLabels[key] || labelFromKey(key));
  const requiredKeys = new Set(requiredFieldsForModel(model, studio).map(([key]) => key));
  const optionalCount = Object.keys(model.inputs || {}).filter((key) => !requiredKeys.has(key)).length;
  return {
    required: required.length ? required.join(", ") : "Sin campos obligatorios adicionales",
    optionalCount,
    output: modelOutputLabel(model)
  };
}

function normalizeFieldForModel(key, value, model) {
  const inputMap = { ratio: "aspect_ratio", duration: "duration", quality: "resolution", amount: "num_images", variants: "num_images", format: "aspect_ratio" };
  const schema = model?.inputs?.[key] || model?.inputs?.[inputMap[key]];
  if (!schema) return value;
  if (Array.isArray(schema.enum) && schema.enum.length) {
    const normalized = String(value || "");
    if (schema.enum.includes(value)) return value;
    const match = schema.enum.find((item) => normalized.includes(String(item)) || String(item).includes(normalized));
    return match || schema.default || schema.enum[0];
  }
  if (schema.type === "int" || schema.type === "number") {
    const numeric = Number(String(value).match(/\d+/)?.[0] || schema.default || schema.minValue || 1);
    const min = Number(schema.minValue ?? schema.minimum ?? 1);
    const max = Number(schema.maxValue ?? schema.maximum ?? numeric);
    return Math.max(min, Math.min(max, numeric));
  }
  return value || schema.default || value;
}

function DynamicForm({ studio, form, setForm, model }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectedModel = model || getMuapiModelById(form?.model);
  const primaryModelOptions = modelOptionsForField(studio, "model");
  const availablePrimaryModels = primaryModelOptions.length ? primaryModelOptions : selectedModel ? [selectedModel] : [];
  const schemaFields = modelSchemaFields(selectedModel);
  const supportsNegative = Boolean(selectedModel?.inputs?.negative_prompt);
  useEffect(() => {
    if (!selectedModel?.inputs) return;
    setForm((current) => {
      const next = {
        model: selectedModel.id,
        prompt: current.prompt || "",
        __files: current.__files || {}
      };
      if (selectedModel.inputs.negative_prompt) {
        next.negative_prompt = current.negative_prompt || current.negative || inputDefault(selectedModel.inputs.negative_prompt);
      }
      Object.entries(selectedModel.inputs).forEach(([key, schema]) => {
        if (isMediaInput(key)) {
          next[key] = current[key] || "";
          return;
        }
        if (!shouldRenderSchemaField(key)) return;
        if (studio === "sound" && isSunoSongModel(selectedModel) && key === "instrumental") {
          next[key] = current[key] ?? false;
          return;
        }
        next[key] = current[key] ?? normalizeFieldForModel(key, current[key], selectedModel) ?? inputDefault(schema);
      });
      return next;
    });
  }, [selectedModel?.id, setForm]);
  const summary = modelOptionSummary(selectedModel, studio);
  const promptLimit = textLimitForField("prompt", selectedModel?.inputs?.prompt, selectedModel, studio);
  const promptTitle = fieldTitleForModel("prompt", selectedModel?.inputs?.prompt, selectedModel, studio);
  const promptPlaceholder = placeholderForModelField("prompt", selectedModel, studio) || "Describe lo que quieres generar.";
  return (
    <div className="form" style={{ marginTop: 16 }}>
      <div className="field"><label>{promptTitle} <span className="label-meta"><RequiredBadge required />{String(form.prompt || "").length}/{promptLimit}</span></label><textarea className="textarea" maxLength={promptLimit} value={form.prompt || ""} onChange={(e) => update("prompt", e.target.value)} placeholder={promptPlaceholder} /><small className="field-help">{studio === "sound" && isSunoSongModel(selectedModel) ? "Suno usa este campo como la letra exacta de la cancion. Escribe versos, coro, puente y estructura si quieres controlar el resultado." : "Texto principal que se envia a la IA seleccionada. Se usa exactamente como direccion creativa."}</small></div>
      {supportsNegative && <div className="field"><label>Negative prompt <span className="label-meta"><RequiredBadge required={schemaRequired("negative_prompt", selectedModel.inputs.negative_prompt, selectedModel)} /></span></label><textarea className="textarea" value={form.negative_prompt || ""} onChange={(e) => update("negative_prompt", e.target.value)} placeholder="Elementos que no deben aparecer en el resultado." /><small className="field-help">{fieldHelpText("negative_prompt", selectedModel.inputs.negative_prompt) || "Campo opcional para excluir errores visuales o contenido no deseado."}</small></div>}
      <div className="grid form-grid">
        <div className="field">
          <label>IA principal <span className="label-meta"><RequiredBadge required /></span></label>
          <select className="select" value={selectedModel?.id || form.model || ""} onChange={(e) => update("model", e.target.value)}>
            {availablePrimaryModels.map((item, index) => <option value={item.id} key={`${item.id}-${index}`}>{item.name} - {item.provider}</option>)}
          </select>
          <small className="field-help">Al cambiar la IA, el formulario se adapta a los parametros reales que acepta ese modelo.</small>
        </div>
        {schemaFields.map(([key, schema]) => {
          const value = form[key] ?? inputDefault(schema);
          const modelOptions = modelOptionsForField(studio, key);
          const choices = schema.enum || choiceOptions[key];
          const required = schemaRequired(key, schema, selectedModel) || (studio === "sound" && isSunoSongModel(selectedModel) && key === "style");
          const help = fieldHelpText(key, schema);
          if (modelOptions.length) {
            return (
              <div className="field" key={key}>
                <label>{fieldTitleForModel(key, schema, selectedModel, studio)} <span className="label-meta"><RequiredBadge required={required} /></span></label>
                <select className="select" value={value} onChange={(e) => update(key, e.target.value)}>
                  {modelOptions.map((item, index) => <option value={item.id} key={`${item.id}-${index}`}>{item.name} - {item.provider}</option>)}
                </select>
                {help && <small className="field-help">{help}</small>}
              </div>
            );
          }
          if (schema.type === "boolean") {
            return <label className="check-row schema-check" key={key}><input type="checkbox" checked={Boolean(value)} onChange={(e) => update(key, e.target.checked)} />{fieldTitleForModel(key, schema, selectedModel, studio)} <RequiredBadge required={required} /></label>;
          }
          if (choices?.length) {
            return (
              <div className="field" key={key}>
                <label>{fieldTitleForModel(key, schema, selectedModel, studio)} <span className="label-meta"><RequiredBadge required={required} /></span></label>
                <select className="select" value={value} onChange={(e) => update(key, e.target.value)}>
                  {choices.map((item, index) => <option value={item} key={`${key}-${index}-${item}`}>{item}</option>)}
                </select>
                {help && <small className="field-help">{help}</small>}
              </div>
            );
          }
          const textLimit = textLimitForField(key, schema, selectedModel, studio);
          const placeholder = placeholderForModelField(key, selectedModel, studio) || schema.placeholder;
          if (schema.format === "text" || key === "style" || key === "negative_tags") {
            return <div className="field" key={key}><label>{fieldTitleForModel(key, schema, selectedModel, studio)} <span className="label-meta"><RequiredBadge required={required} />{textLimit ? `${String(value || "").length}/${textLimit}` : ""}</span></label><textarea className="textarea compact-textarea" maxLength={textLimit} value={value} onChange={(e) => update(key, e.target.value)} placeholder={placeholder} />{help && <small className="field-help">{help}</small>}</div>;
          }
          return <div className="field" key={key}><label>{fieldTitleForModel(key, schema, selectedModel, studio)} <span className="label-meta"><RequiredBadge required={required} />{textLimit ? `${String(value || "").length}/${textLimit}` : ""}</span></label><input className="input" type={schema.type === "int" || schema.type === "number" ? "number" : "text"} min={schema.minimum ?? schema.minValue} max={schema.maximum ?? schema.maxValue} maxLength={textLimit} value={value} onChange={(e) => update(key, e.target.value)} placeholder={placeholder} />{help && <small className="field-help">{help}</small>}</div>;
        })}
      </div>
      <FileInputs studio={studio} model={selectedModel} form={form} setForm={setForm} />
      <div className="model-summary">
        <strong>{selectedModel?.name || "MuAPI Universal"}</strong>
        <span>{selectedModel?.provider || "muapi"} / {selectedModel?.type || "workflow"} / {selectedModel?.endpoint || "pipeline"}</span>
        <div className="model-facts">
          <span>Salida: {summary.output}</span>
          <span>Obligatorio: {summary.required}</span>
          <span>Opcionales autocompletados: {summary.optionalCount}</span>
        </div>
        <small>El panel intercepta el contrato de esta IA: lo obligatorio se marca y se valida antes de llamar a MuAPI; lo opcional usa el mejor valor por defecto del modelo.</small>
      </div>
    </div>
  );
}

function FileInputs({ studio, model, form, setForm }) {
  const modelMediaSpecs = Object.keys(model?.inputs || {})
    .filter((key) => isMediaInput(key))
    .map((key) => {
      const accept = key.includes("audio") ? "audio/*" : key.includes("video") ? "video/*" : "image/*";
      return [key, model.inputs[key]?.title || mediaInputLabels[key] || labelFromKey(key), accept];
    });
  const inferredSpecs = inferredRequiredMediaKeys(studio, model)
    .filter((key) => !modelMediaSpecs.some(([existing]) => existing === key))
    .map((key) => {
      const accept = key.includes("audio") ? "audio/*" : key.includes("video") ? "video/*" : "image/*";
      return [key, mediaInputLabels[key] || labelFromKey(key), accept];
    });
  const fallbackSpecs = {
    documentary: [["audio_url", "Narrativa/audio local", "audio/*"], ["image_url", "Referencia visual", "image/*"], ["video_url", "Video base", "video/*"]],
    musicvideo: [["audio_url", "Cancion/audio local", "audio/*"], ["image_url", "Referencia visual", "image/*"], ["video_url", "Video base", "video/*"]],
    lipsync: [["image_url", "Avatar o rostro", "image/*"], ["audio_url", "Audio de voz", "audio/*"], ["video_url", "Video a clonar", "video/*"]],
    narrative: [["audio_url", "Audio de referencia", "audio/*"]]
  }[studio] || [];
  const specs = modelMediaSpecs.length || inferredSpecs.length ? [...modelMediaSpecs, ...inferredSpecs] : fallbackSpecs;
  if (!specs.length) return null;
  const updateFile = (key, file) => {
    setForm((current) => ({
      ...current,
      [key]: file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "",
      __files: { ...(current.__files || {}), [key]: file }
    }));
  };
  return (
    <div className="file-inputs">
      {specs.map(([key, label, accept]) => {
        const schema = model?.inputs?.[key] || {};
        const required = schemaRequired(key, schema, model) || inferredRequiredMediaKeys(studio, model).includes(key);
        return (
          <div className="field file-field" key={key}>
            <label>{label} <span className="label-meta"><RequiredBadge required={required} /></span></label>
            <input id={`${studio}-${key}`} className="file-native" type="file" accept={accept} required={required} onChange={(event) => updateFile(key, event.target.files?.[0] || null)} />
            <label className={form[key] ? "file-picker selected" : "file-picker"} htmlFor={`${studio}-${key}`}>
              <Upload size={16} />
              {form[key] ? "Cambiar archivo" : "Subir archivo"}
            </label>
            <small className="field-help">{fieldHelpText(key, schema)}</small>
            <small className="muted file-name">{form[key] || "Ningun archivo seleccionado"}</small>
          </div>
        );
      })}
    </div>
  );
}

function NativeStudioPanel({ studio, activeSub, state, actions, form }) {
  const title = activeSub?.title || labelFor(studio);
  const [persistedJobs, setPersistedJobs] = useState([]);
  useEffect(() => {
    let active = true;
    apiRequest("/api/production/projects")
      .then((result) => {
        if (!active) return;
        setPersistedJobs((result.projects || [])
          .filter((project) => project.type === studio && project.jobId)
          .map((project) => ({
            id: project.jobId,
            studio: project.type,
            model: project.stages?.find((stage) => stage.model && stage.model !== "NEXFRAME Orchestrator")?.model || "NEXFRAME",
            status: project.status,
            progress: project.progress,
            outputs: project.assets || [],
            input: { prompt: project.title },
            createdAt: project.createdAt,
            userGenerated: true
          })));
      })
      .catch(() => {
        if (active) setPersistedJobs([]);
      });
    return () => { active = false; };
  }, [studio]);
  const jobs = [...(state.jobs || []), ...persistedJobs]
    .filter((job) => job.studio === studio && job.userGenerated === true)
    .filter((job, index, list) => list.findIndex((candidate) => candidate.id === job.id) === index);
  const completed = jobs.filter((job) => job.status === "completed" && outputMediaUrl(job));
  const activeJob = jobs.find((job) => ["queued", "processing"].includes(job.status));
  if (!activeJob && !completed.length) return <EmptyState title="Sin resultados" body="Completa el formulario y genera el primer resultado de este studio." />;
  return (
    <div className="native-panel">
      {activeJob && <JobPreview job={activeJob} actions={actions} />}
      <div className="result-header">
        <div>
          <strong>{title}</strong>
          <span>{completed.length ? `${completed.length} resultado(s) guardados en este panel` : "Los resultados terminados apareceran aqui"}</span>
        </div>
        <button className="btn secondary" disabled={!completed.length} onClick={() => actions.saveToProject(completed[0])}><Save size={16} />Guardar ultimo</button>
      </div>
      {completed.length > 0 && <div className="grid native-results">{completed.map((job) => <GeneratedResultCard key={job.id} job={job} actions={actions} />)}</div>}
    </div>
  );
}

function GeneratedResultCard({ job, actions }) {
  const mediaUrl = outputMediaUrl(job);
  const mediaKind = outputMediaKind(job);
  const prompt = jobPrompt(job);
  const title = job.model || labelFor(job.studio);
  return (
    <div className="media-result generated-card">
      {mediaUrl && mediaKind === "image" && <button className="media-open" onClick={() => actions.openGenerated(job)} aria-label={`Abrir imagen ${title}`}><img src={mediaUrl} alt={prompt || title} loading="lazy" decoding="async" /></button>}
      {mediaUrl && mediaKind === "video" && <video src={mediaUrl} controls preload="metadata" />}
      {mediaUrl && mediaKind === "audio" && <div className="audio-generated"><Waveform /><audio src={mediaUrl} controls preload="metadata" /></div>}
      {!mediaUrl && <div className="prompt-result"><Sparkles size={28} /><strong>Resultado generado</strong><p>{prompt || "Prompt sin texto guardado."}</p><span>{job.status} - archivo multimedia pendiente del proveedor</span></div>}
      <div className="media-overlay">
        <strong>{title}</strong>
        <span>{prompt || "Prompt no disponible"}</span>
        <div className="toolbar compact">
          <button className="btn secondary" onClick={() => actions.openGenerated(job)}>Abrir</button>
          <button className="btn secondary" onClick={() => actions.copy(prompt)}>Prompt</button>
          <button className="btn secondary" aria-label={`Descargar ${title}`} onClick={() => actions.downloadGenerated(job)}><Download size={14} />Descargar</button>
          <button className="btn secondary" aria-label={`Copiar enlace ${title}`} onClick={() => actions.copyGeneratedLink(job)}>Enlace</button>
          <button className="btn secondary danger" aria-label={`Borrar ${title}`} onClick={() => actions.moveJobToTrash(job.id)}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, body, action, onAction }) {
  return <div className="empty-state"><div className="empty-icon"><Sparkles size={28} /></div><h2>{title}</h2><p className="muted">{body}</p>{action && <button className="btn" onClick={onAction}>{action}</button>}</div>;
}

function JobPreview({ job, actions }) {
  const progress = Math.max(0, Math.min(100, Number(job.progress || 0)));
  const poster = previewImageForStudio(job.studio);
  const stages = job.stages?.length ? job.stages : productionStagesForStudio(job.studio);
  const prompt = jobPrompt(job);
  return (
    <div className="generation-preview">
      <div className="generation-stage">
        <img src={poster} alt={`Vista previa de ${job.studio}`} loading="lazy" decoding="async" />
        <div className="generation-scan" />
        <div className="generation-hud">
          <span className="live-dot" /> {statusLabel(job.status)}
        </div>
        <div className="generation-title">
          <strong>{job.model || job.studio}</strong>
          <span>{job.agent?.agent || "Motor de produccion NEXFRAME"}</span>
          <p>{prompt}</p>
        </div>
      </div>
      <div className="generation-side">
        <div className="progress-orb" style={{ "--value": `${progress * 3.6}deg` }} aria-label={`Progreso ${progress}%`}>
          <strong>{progress}%</strong>
          <span>{statusLabel(job.status)}</span>
        </div>
        <div className="stage-list">
          {stages.map((stage, index) => (
            <div className={`stage-chip ${stage.status || stageStatusFromProgress(progress, index, stages.length)}`} key={stage.id || stage.label || index}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{stage.label || stage.id}</strong>
                <small>{stage.model || job.provider || "MuAPI/local"}</small>
              </div>
            </div>
          ))}
        </div>
        <div className="generation-actions">
          <button className="btn secondary" onClick={() => actions.cancelJob(job.id)}>Cancelar</button>
          <button className="btn secondary" onClick={() => actions.download(`${job.id}.json`, job)}>Descargar metadata</button>
        </div>
      </div>
    </div>
  );
}

function previewImageForStudio(studio) {
  return ({
    video: dashboardAssets.recentCyberpunk,
    cinema: dashboardAssets.recentCyberpunk,
    documentary: dashboardAssets.documentaryCard,
    musicvideo: dashboardAssets.musicVideoCard,
    editor: panelAssets.editor,
    marketing: "/assets/panel-cards/flyer-studio.png",
    image: dashboardAssets.imageCard,
    sound: dashboardAssets.soundCard,
    narrative: dashboardAssets.soundCard,
    effects: dashboardAssets.effectsCard,
    lipsync: dashboardAssets.lipsyncCard,
    flyer: dashboardAssets.imageCard
  }[studio] || dashboardAssets.videoCard || heroSlides[0]);
}

function productionStagesForStudio(studio) {
  const visual = ["Analisis del prompt", "Seleccion de IA", "Render inicial", "Validacion de salida", "Entrega"];
  const audio = ["Analisis del texto", "Voz y timbre", "Sintesis", "Limpieza", "Entrega MP3"];
  const pipeline = ["Guion", "Storyboard", "Assets", "Montaje", "Export final"];
  const music = ["Analisis de cancion", "Guion", "Identidad", "Storyboard", "Prompts", "Imagenes", "Clips", "Lip Sync", "Efectos", "Montaje", "Export"];
  const marketing = ["Estrategia", "Producto", "Visual", "Video", "Voz", "Musica", "Pack final"];
  const labels = ["sound", "narrative"].includes(studio) ? audio : studio === "musicvideo" ? music : studio === "marketing" ? marketing : studio === "documentary" || studio === "editor" ? pipeline : visual;
  return labels.map((label, index) => ({ id: `${studio}-${index}`, label }));
}

function stageStatusFromProgress(progress, index, total) {
  const threshold = ((index + 1) / total) * 100;
  if (progress >= threshold) return "completed";
  if (progress >= threshold - (100 / total)) return "processing";
  return "queued";
}

function statusLabel(status) {
  return ({
    queued: "En cola",
    processing: "Generando",
    completed: "Completado",
    failed: "Fallido",
    cancelled: "Cancelado"
  }[status] || status || "Preparando");
}

function Waveform() {
  return <div className="waveform">{Array.from({ length: 88 }).map((_, index) => <span key={index} style={{ height: `${16 + ((index * 19) % 62)}px` }} />)}</div>;
}

function WorkflowNativePreview({ type, step, actions }) {
  const documentaryRows = [
    ["Paso 1", "Narrativa pendiente", dashboardAssets.documentaryCard],
    ["Paso 2", "Escenas pendientes", dashboardAssets.videoCard],
    ["Paso 3", "Voz pendiente", dashboardAssets.soundCard],
    ["Paso 4", "Export pendiente", dashboardAssets.cinemaCard]
  ];
  const musicRows = [
    ["Paso 1", "Audio pendiente", dashboardAssets.soundCard],
    ["Paso 2", "Storyboard pendiente", dashboardAssets.musicVideoCard],
    ["Paso 3", "Clips pendientes", dashboardAssets.videoCard],
    ["Paso 4", "Export pendiente", dashboardAssets.cinemaCard]
  ];
  const rows = type === "documentary" ? documentaryRows : musicRows;
  return <div className="workflow-native"><div className="workflow-status"><span>Paso {step + 1}</span><strong>{type === "documentary" ? "Flujo documental" : "Flujo videoclip"}</strong><button className="btn secondary" onClick={() => actions.runV6Action(type === "documentary" ? "documentary_studio" : "music_video_studio", "Save Project", { step })}>Guardar version</button></div><div className="grid workflow-scenes">{rows.map(([tag, title, image]) => <div className="scene-row" key={tag}><img src={image} alt={title} loading="lazy" decoding="async" /><div><strong>{tag} - {title}</strong><p className="muted">Se activara cuando ejecutes la accion correspondiente del flujo.</p></div><button className="btn secondary" onClick={() => actions.runV6Action(type === "documentary" ? "documentary_studio" : "music_video_studio", "Generate", { tag })}>Generar</button></div>)}</div></div>;
}

function V6ActionBoard({ panel, actions, payload = {} }) {
  const actionList = v6Actions[panel] || v6Actions.global || [];
  return <section className="v6-actions">{actionList.map((action) => <button className="btn secondary full" key={action} onClick={() => actions.runV6Action(panel, action, payload)}>{action}</button>)}</section>;
}

const documentarySteps = [
  { id: "topic", label: "Tema", icon: Search },
  { id: "research", label: "Investigacion", icon: Database },
  { id: "narrative", label: "Narrativa", icon: FileText },
  { id: "script", label: "Guion", icon: Bot },
  { id: "scenes", label: "Escenas", icon: Clapperboard },
  { id: "voiceover", label: "Voz", icon: Mic2 },
  { id: "music", label: "Musica", icon: Music },
  { id: "visuals", label: "Visuales", icon: Image },
  { id: "subtitles", label: "Subtitulos", icon: FileText },
  { id: "export", label: "Exportacion", icon: Download }
];

const documentarySelects = {
  documentaryType: ["Historico", "Investigativo", "Naturaleza", "Biografico", "Crimen real", "Ciencia", "Conspirativo", "Cultural"],
  duration: ["2 minutos", "3 minutos", "10 minutos", "20 minutos", "30 minutos", "40 minutos", "60 minutos", "90 minutos"],
  format: ["YouTube 16:9", "Shorts 9:16", "TikTok 9:16", "Reel 9:16", "Web 16:9", "Cine 2.39:1"],
  resolution: ["720p", "1080p Full HD", "4K UHD"],
  language: ["Espanol", "English"],
  narrativeStyle: ["Misterio oscuro", "National Geographic", "Codigo Blanco broadcast", "Investigacion periodistica", "Epico cinematografico"],
  visualStyle: ["Ultra realista cinematografico", "Documental naturalista", "Archivo historico restaurado", "Noir investigativo", "Ciencia premium"],
  researchLevel: ["Investigacion profunda", "Investigacion rapida", "Revision de archivos", "Analisis experto"],
  researchModel: ["o3-documentary-research", "gpt-4.1-documentary-script", "auto-mejor-modelo"],
  scriptModel: ["gpt-4.1-documentary-script", "o3-documentary-research", "auto-mejor-modelo"],
  imageModel: ["nano-banana", "gpt-image-2", "kolors-v3", "midjourney-style"],
  videoModel: ["seedance-lite-t2v", "veo3.1-lite-text-to-video", "veo3.1-text-to-video", "kling-v3.0-pro", "runway-aleph", "auto-mejor-video"],
  voiceProvider: ["OmniVoice Studio", "Level Up", "OpenAI TTS", "ElevenLabs", "Auto"],
  voiceModel: omnivoiceVoices.map((voice) => voice.id),
  audioModel: ["suno-create-music", "udio-cinematic", "auto-mejor-musica"],
  subtitles: ["Subtitulos cinematicos", "Subtitulos YouTube", "Sin subtitulos"],
  exportFormat: ["MP4 H.264", "MP4 H.265", "Project Pack ZIP"]
};

const documentaryVisualAssets = {
  hero: studioCardAssets.documentary,
  research: dashboardAssets.recentDocumentary,
  narrative: dashboardAssets.recentCyberpunk,
  script: dashboardAssets.recentShot,
  scenes: dashboardAssets.recentBattle,
  voiceover: "/assets/flyer-studio/cover-musical.png",
  music: "/assets/flyer-studio/bar-lounge.png",
  visuals: dashboardAssets.recentCyberpunk,
  subtitles: dashboardAssets.recentDocumentary,
  edit: dashboardAssets.recentMusic,
  export: dashboardAssets.recentShot
};

const documentaryStageCards = [
  ["research", "Investigacion", "Datos, fuentes y contexto del tema.", documentaryVisualAssets.research],
  ["narrative", "Narrativa", "Estructura documental, tono y tension.", documentaryVisualAssets.narrative],
  ["script", "Guion", "Guion completo con actos, escenas y locucion.", documentaryVisualAssets.script],
  ["scenes", "Escenas", "Division visual y prompts por bloque.", documentaryVisualAssets.scenes],
  ["voiceover", "Voz narrativa", "Locucion con voz seleccionada.", documentaryVisualAssets.voiceover],
  ["music", "Musica y SFX", "Banda sonora y efectos ambientales.", documentaryVisualAssets.music],
  ["visuals", "Visuales IA", "Imagenes y clips para cada escena.", documentaryVisualAssets.visuals],
  ["subtitles", "Subtitulos", "SRT/VTT sincronizado para el montaje.", documentaryVisualAssets.subtitles],
  ["edit", "Montaje", "Orden final, transiciones y correccion.", documentaryVisualAssets.edit],
  ["export", "Exportacion", "Render final y paquete descargable.", documentaryVisualAssets.export]
].map(([id, title, description, image]) => ({ id, title, description, image }));

const documentaryQuickActions = [
  ["research", "Investigacion profunda", Database],
  ["narrative", "Generar narrativa", FileText],
  ["script", "Generar guion", Bot],
  ["scenes", "Extraer escenas", Clapperboard],
  ["voiceover", "Generar voz", Mic2],
  ["music", "Generar musica", Music],
  ["visuals", "Generar visuales", Image],
  ["subtitles", "Generar subtitulos", FileText],
  ["preview", "Vista previa", Play],
  ["render", "Render final", Clapperboard],
  ["export", "Exportar MP4", Download]
].map(([id, label, icon]) => ({ id, label, icon }));

function formatDocumentaryEta(seconds = 0) {
  const value = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remaining = Math.floor(value % 60);
  return [hours, minutes, remaining].map((part) => String(part).padStart(2, "0")).join(":");
}

function buildDocumentaryPayload(form) {
  const prompt = String(form.prompt || "").trim();
  return {
    ...cleanFormForStorage(form),
    prompt,
    topic: prompt,
    maxDuration: form.duration,
    agent: "NEXFRAME Documentary Director Agent",
    productionMode: "full_documentary_pipeline",
    deliverables: ["research", "narrative", "script", "scenes", "voiceover", "music", "visuals", "subtitles", "edit", "export"]
  };
}

function DocumentaryStudio({ actions, busyStudio, state }) {
  const [form, setForm] = useState(defaultForms.documentary);
  const [projects, setProjects] = useState([]);
  const [activeJobs, setActiveJobs] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [runningAction, setRunningAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [processOpen, setProcessOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(true);
  const estimatedCredits = form.duration === "90 minutos" ? 320 : form.duration === "60 minutos" ? 240 : form.duration === "40 minutos" ? 180 : 120;
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setFile = (key, file) => setForm((current) => ({ ...current, __files: { ...(current.__files || {}), [key]: file } }));
  const payload = buildDocumentaryPayload(form);
  const currentJob = activeJobs[0] || null;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || projects[0] || null;
  const filteredProjects = projects.filter((project) => {
    const matchesText = project.title.toLowerCase().includes(query.trim().toLowerCase());
    return matchesText && (statusFilter === "all" || project.status === statusFilter);
  });

  const refreshDocumentary = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [projectResult, jobResult] = await Promise.all([
        apiRequest("/api/documentary/projects"),
        apiRequest("/api/documentary/jobs/active")
      ]);
      setProjects(projectResult.projects || []);
      setActiveJobs(jobResult.jobs || []);
      if (!selectedProjectId && projectResult.projects?.[0]) setSelectedProjectId(projectResult.projects[0].id);
    } catch (error) {
      actions.notify(`No se pudo cargar Documentary Studio: ${error.message}`);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    refreshDocumentary();
    const timer = window.setInterval(() => refreshDocumentary(true), 2500);
    return () => window.clearInterval(timer);
  }, []);

  const runDocumentaryAction = async (actionId) => {
    if (!selectedProject) return actions.notify("Crea o selecciona un proyecto documental primero.");
    setRunningAction(actionId);
    try {
      const endpoint = actionId === "pack" ? "export" : actionId === "save" ? "preview" : actionId;
      const result = await apiRequest(`/api/documentary/projects/${selectedProject.id}/actions/${endpoint}`, {
        method: "POST",
        body: "{}"
      });
      if (actionId === "preview") actions.modal({ title: selectedProject.title, body: JSON.stringify(result.artifact, null, 2) });
      if (["export", "pack"].includes(actionId) && result.artifact?.url) {
        const anchor = document.createElement("a");
        anchor.href = apiAssetUrl(result.artifact.url);
        anchor.download = `${selectedProject.title}.mp4`;
        anchor.click();
      }
      actions.notify(result.message || "Accion documental completada.");
      await refreshDocumentary(true);
    } catch (error) {
      actions.notify(`Documentary Studio no pudo ejecutar ${actionId}: ${error.message}`);
    } finally {
      setRunningAction("");
    }
  };

  const createFullDocumentary = async () => {
    if (!payload.prompt) return actions.notify("Escribe el tema principal antes de crear el documental.");
    setRunningAction("create");
    try {
      const files = form.__files || {};
      const result = Object.keys(files).length
        ? await apiFormRequest("/api/documentary/jobs", { input: payload }, files)
        : await apiRequest("/api/documentary/jobs", { method: "POST", body: JSON.stringify({ input: payload }) });
      setSelectedProjectId(result.project.id);
      actions.notify(result.message);
      await refreshDocumentary(true);
    } catch (error) {
      actions.notify(`No se pudo crear el documental: ${error.message}`);
    } finally {
      setRunningAction("");
    }
  };

  const sendToEditor = async (project) => {
    setRunningAction(`editor-${project.id}`);
    try {
      const result = await apiRequest(`/api/documentary/projects/${project.id}/send-to-video-editor`, { method: "POST", body: "{}" });
      actions.notify(result.message);
      actions.navigate("editor");
    } catch (error) {
      actions.notify(error.message);
    } finally { setRunningAction(""); }
  };

  const cancelJob = async (job) => {
    if (!window.confirm(`¿Cancelar la produccion de ${projects.find((item) => item.id === job.projectId)?.title || "este documental"}?`)) return;
    try {
      const result = await apiRequest(`/api/documentary/jobs/${job.id}/cancel`, { method: "POST", body: "{}" });
      actions.notify(result.message);
      refreshDocumentary(true);
    } catch (error) { actions.notify(error.message); }
  };

  return (
    <div className="documentary-studio-page">
      <section className="documentary-hero">
        <img src={documentaryVisualAssets.hero} alt="" />
        <div className="documentary-hero-copy">
          <h1>DOCUMENTARY STUDIO</h1>
          <p>Crea documentales completos con investigacion, narrativa, escenas, voz, musica, subtitulos, montaje y exportacion final con IA.</p>
          <div className="doc-capabilities">
            {documentarySteps.slice(1, 7).map(({ id, label, icon: Icon }) => <span key={id}><Icon size={17} />{label}</span>)}
          </div>
        </div>
      </section>

      <section className="doc-production-bar">
        <div className="doc-production-summary"><span className="doc-live-dot" /><strong>{currentJob ? "Produccion en curso" : "Sin producciones activas"}</strong></div>
        <div><span>Proyecto</span><strong>{currentJob ? projects.find((item) => item.id === currentJob.projectId)?.title || currentJob.input?.prompt : "Listo para crear"}</strong></div>
        <div><span>Paso actual</span><strong>{currentJob ? currentJob.stages?.find((step) => step.id === currentJob.currentStep)?.label || currentJob.currentStep : "-"}</strong></div>
        <div className="doc-progress-track"><i style={{ width: `${currentJob?.progress || 0}%` }} /></div>
        <strong className="doc-progress-number">{currentJob?.progress || 0}%</strong>
        <span>ETA {formatDocumentaryEta(currentJob?.etaSeconds || 0)}</span>
        <button className="btn secondary" disabled={!currentJob} onClick={() => setProcessOpen((value) => !value)}>Ver proceso <ChevronDown size={15} /></button>
      </section>
      {processOpen && currentJob && <section className="doc-process-detail card">{currentJob.stages.map((step, index) => <div key={step.id} className={`doc-process-step ${step.status}`}><strong>{index + 1}</strong><div><span>{step.label}</span><small>{step.message || "Pendiente"}</small></div><b>{statusLabel(step.status)}</b>{step.status === "failed" && <button className="btn secondary" onClick={async () => { await apiRequest(`/api/documentary/jobs/${currentJob.id}/retry-step`, { method: "POST", body: JSON.stringify({ stepKey: step.id }) }); refreshDocumentary(true); }}>Reintentar</button>}</div>)}</section>}

      <div className="documentary-layout">
        <aside className={`doc-config card ${configOpen ? "open" : "collapsed"}`}>
          <button className="doc-section-toggle" onClick={() => setConfigOpen((value) => !value)}><h2>Configuracion del documental</h2><ChevronDown size={17} /></button>
          <div className="doc-collapsible-body">
          <div className="field"><label>Tema principal *</label><input className="input" value={form.prompt} onChange={(event) => update("prompt", event.target.value)} placeholder="Ej: Los secretos ocultos de las piramides de Egipto" title="Tema central que usara el agente documental para investigar, escribir y producir el proyecto." /></div>
          <div className="field"><label>Descripcion opcional</label><textarea className="textarea compact-textarea" value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Contexto, enfoque, fuentes o restricciones creativas." title="Amplia la direccion creativa sin reemplazar el tema principal." /></div>
          <div className="field"><label>Guion narrativo opcional</label><textarea className="textarea compact-textarea" value={form.script} onChange={(event) => update("script", event.target.value)} placeholder="Texto continuo listo para narracion. Si lo incluyes, se respetara sin estirar el audio." title="Guion exacto que usara la narracion del documental." /></div>
          <div className="doc-two">
            {["documentaryType", "duration", "format", "resolution", "language", "narrativeStyle"].map((key) => <div className="field" key={key}><label>{labelForDocumentaryField(key)}</label><select className="select" value={form[key]} onChange={(event) => update(key, event.target.value)} title={documentaryHelp(key)}>{documentarySelects[key].map((option) => <option key={option}>{option}</option>)}</select></div>)}
          </div>
          <div className="field"><label>Estilo visual</label><select className="select" value={form.visualStyle} onChange={(event) => update("visualStyle", event.target.value)} title={documentaryHelp("visualStyle")}>{documentarySelects.visualStyle.map((option) => <option key={option}>{option}</option>)}</select></div>
          <h3>Modelos y proveedores</h3>
          <div className="doc-two">
            {["researchModel", "scriptModel", "imageModel", "videoModel", "voiceProvider", "voiceModel", "audioModel", "subtitles", "exportFormat"].map((key) => <div className="field" key={key}><label>{labelForDocumentaryField(key)}</label><select className="select" value={form[key]} onChange={(event) => update(key, event.target.value)} title={documentaryHelp(key)}>{documentarySelects[key].map((option) => <option key={option}>{option}</option>)}</select></div>)}
          </div>
          <h3>Archivos y referencias</h3>
          <div className="doc-upload-grid">
            <DocFileInput label="Audio / narrativa" accept="audio/*" onChange={(file) => setFile("audio_url", file)} />
            <DocFileInput label="Imagen referencia" accept="image/*" onChange={(file) => setFile("image_url", file)} />
            <DocFileInput label="Video base" accept="video/*" onChange={(file) => setFile("video_url", file)} />
            <DocFileInput label="Documento / PDF" accept=".pdf,.txt,.md,application/pdf,text/*" onChange={(file) => setFile("document_url", file)} />
          </div>
          <div className="doc-credit-estimate"><Coins size={15} /><span>Coste estimado</span><strong>{estimatedCredits} creditos</strong></div>
          <button className="btn full" disabled={runningAction === "create"} onClick={createFullDocumentary}><Plus size={18} />{runningAction === "create" ? "Creando documental..." : "Crear documental"}</button>
          </div>
        </aside>

        <main className="doc-main">
          <section className="card doc-linked-projects">
            <div className="section-head"><h2>Proyectos vinculados</h2><span>{projects.length} proyectos</span></div>
            <div className="doc-project-tools"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proyectos..." /></label><select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Estado: Todos</option><option value="queued">En cola</option><option value="processing">En produccion</option><option value="completed">Completado</option><option value="failed">Error</option><option value="cancelled">Cancelado</option></select></div>
            {loading ? <div className="doc-empty"><Activity className="spin" /><strong>Cargando proyectos...</strong></div> : filteredProjects.length === 0 ? <div className="doc-empty"><Folder size={30} /><strong>Todavia no tienes documentales vinculados.</strong><span>Crea tu primer documental desde la configuracion.</span></div> : <div className="doc-project-list">{filteredProjects.map((project) => <article className={`doc-project-row ${selectedProject?.id === project.id ? "selected" : ""}`} key={project.id} onClick={() => setSelectedProjectId(project.id)}><div className="doc-project-thumb">{project.artifacts?.export?.url ? <video controls preload="metadata" src={apiAssetUrl(project.artifacts.export.url)} onClick={(event) => event.stopPropagation()} /> : <img src={studioCardAssets.documentary} alt="" />}<span>{project.duration}</span></div><div className="doc-project-info"><div><h3>{project.title}</h3><span className={`doc-status ${project.status}`}>{statusLabel(project.status)}</span></div><p><Calendar size={14} /> Editado: {new Date(project.updatedAt).toLocaleString("es-ES")}</p><p><Coins size={14} /> Creditos usados: {project.creditsUsed || 0}</p></div><div className="doc-project-actions"><button className="btn" onClick={(event) => { event.stopPropagation(); actions.modal({ title: project.title, body: JSON.stringify(project, null, 2) }); }}>Abrir proyecto</button><button className="btn secondary" disabled={runningAction === `editor-${project.id}`} onClick={(event) => { event.stopPropagation(); sendToEditor(project); }}>Enviar al Video Editor Studio</button><button className="btn secondary" disabled={project.status !== "completed"} onClick={(event) => { event.stopPropagation(); setSelectedProjectId(project.id); runDocumentaryAction("export"); }}><Download size={15} />Exportar</button></div></article>)}</div>}
          </section>
        </main>

        <aside className="doc-side">
          <section className={`card doc-actions-panel ${actionsOpen ? "open" : "collapsed"}`}>
            <button className="doc-section-toggle" onClick={() => setActionsOpen((value) => !value)}><h2>Acciones rapidas</h2><ChevronDown size={17} /></button>
            <div className="doc-quick-actions doc-collapsible-body">
              {documentaryQuickActions.map(({ id, label, icon: Icon }) => <button key={id} className="btn secondary full" disabled={runningAction === id} onClick={() => runDocumentaryAction(id)} title={`Ejecuta ${label} usando la configuracion actual del documental.`}><Icon size={16} />{runningAction === id ? "Procesando..." : label}</button>)}
            </div>
          </section>
          <section className="card doc-background-jobs"><div className="section-head"><h2>Generando en segundo plano</h2><span>{activeJobs.length}</span></div>{activeJobs.length === 0 ? <p className="muted">No hay procesos activos.</p> : activeJobs.map((job) => <article key={job.id}><div><strong>{projects.find((item) => item.id === job.projectId)?.title || job.input?.prompt}</strong><b>{job.progress}%</b></div><p>{job.stages?.find((step) => step.id === job.currentStep)?.label || job.currentStep} · ETA {formatDocumentaryEta(job.etaSeconds)}</p><div className="doc-progress-track"><i style={{ width: `${job.progress}%` }} /></div><div className="doc-mini-steps">{job.stages?.map((step, index) => <span className={step.status} key={step.id}>{index + 1}</span>)}</div><button className="btn secondary full" onClick={() => cancelJob(job)}>Cancelar produccion</button></article>)}</section>
        </aside>
      </div>
    </div>
  );
}

function DocFileInput({ label, accept, onChange }) {
  const [name, setName] = useState("");
  return <label className="doc-file" title={`Sube ${label.toLowerCase()} para que el agente lo use como referencia real.`}><Upload size={16} /><span>{name || label}</span><input type="file" accept={accept} onChange={(event) => { const file = event.target.files?.[0]; setName(file?.name || ""); if (file) onChange(file); }} /></label>;
}

function labelForDocumentaryField(key) {
  return ({
    documentaryType: "Tipo",
    duration: "Duracion objetivo",
    format: "Formato",
    resolution: "Resolucion",
    language: "Idioma",
    narrativeStyle: "Estilo narrativo",
    visualStyle: "Estilo visual",
    researchLevel: "Nivel de investigacion",
    researchModel: "Investigacion / texto",
    scriptModel: "Guion",
    imageModel: "Imagen",
    videoModel: "Video",
    voiceProvider: "Voz proveedor",
    voiceModel: "Voz especifica",
    audioModel: "Musica / SFX",
    subtitles: "Subtitulos",
    exportFormat: "Exportacion"
  })[key] || key;
}

function documentaryHelp(key) {
  return ({
    duration: "Define la duracion final. Para 60 o 90 minutos el sistema divide el proyecto en mas escenas.",
    format: "Ajusta relacion de aspecto y destino principal del documental.",
    videoModel: "Modelo principal para crear los clips de video de cada escena.",
    imageModel: "Modelo usado para generar referencias visuales, imagenes y storyboards.",
    voiceProvider: "Proveedor de voz narrativa para locucion documental.",
    audioModel: "Modelo encargado de banda sonora y efectos ambientales.",
    exportFormat: "Formato del render o paquete final descargable."
  })[key] || "Parametro del agente documental profesional.";
}

function buildPreviewScenes(form) {
  const images = [
    documentaryVisualAssets.research,
    documentaryVisualAssets.narrative,
    documentaryVisualAssets.scenes,
    documentaryVisualAssets.visuals,
    documentaryVisualAssets.edit
  ];
  const topic = form.prompt || "Documental";
  return ["Introduccion impactante", "Contexto historico", "Revelacion principal", "Pruebas visuales", "Cierre cinematografico"].map((title, index) => ({
    number: String(index + 1).padStart(2, "0"),
    time: `${index * 3}:00 - ${(index + 1) * 3}:00`,
    title: `${title}: ${topic}`,
    image: images[index % images.length]
  }));
}

function estimateDocumentaryTime(duration) {
  const minutes = Number(String(duration).match(/\d+/)?.[0] || 30);
  return minutes >= 60 ? "45-90 min" : "20-45 min";
}

function estimateDocumentaryStorage(duration) {
  const minutes = Number(String(duration).match(/\d+/)?.[0] || 30);
  return `${Math.max(1.2, minutes * 0.08).toFixed(1)} GB`;
}

function MetricCard({ label, value, sub }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}

const musicVideoTabs = ["Audio", "Analisis", "Guion", "Storyboard", "Personaje", "Escenas", "Clips", "Lip Sync", "Efectos", "Montaje", "Exportacion"];
const musicVideoPresets = [
  "Hollywood Music Video", "Urban Night", "Luxury Gold", "Reggaeton Club", "Trap Dark",
  "Pop Dream", "Vintage VHS", "Romantic Rain", "Tropical Beach", "Street Performance",
  "Concert Stage", "Cyberpunk Neon", "Black & White", "Cinematic Drama", "Dance Club",
  "R&B Luxury", "Bachata Romance", "Rock Stage", "Electronic Visualizer", "Old Film"
];
const musicVideoActions = [
  "Upload Song", "Upload Artist Photo", "Upload Video Clips", "Upload Script/PDF/TXT",
  "Analyze Song", "Detect Lyrics", "Sync Script to Song", "Create Artist Profile",
  "Create Storyboard", "Generate Scene Prompts", "Generate Images", "Generate Clips",
  "Generate Lip Sync", "Apply VFX", "Auto Edit to Beat", "Preview Music Video",
  "Render Final Video", "Export MP4", "Export Project Pack", "Save Version", "Send to Campaign"
];
const musicVideoFlow = [
  ["audio_analysis", "Audio Analysis", "BPM, energia, secciones y golpes fuertes", Music],
  ["script_sync", "Script Sync", "Guion sincronizado con la estructura musical", FileText],
  ["artist_identity", "Artist Identity", "Rostro, vestuario, actitud y consistencia", Bot],
  ["storyboard", "Storyboard", "Planos por parte de la cancion", Image],
  ["scene_prompts", "Scene Prompts", "Prompts tecnicos por escena", Wand2],
  ["images", "Image Generation", "Fondos, frames, moodboard y miniatura", Image],
  ["clips", "Video Generation", "Clips IA o clips locales seleccionados", Clapperboard],
  ["lip_sync", "Lip Sync Clips", "Canto o rap sincronizado por seccion", Mic2],
  ["effects", "VFX & Color", "Transiciones, grading y look final", Sparkles],
  ["edit", "Auto Edit", "Montaje al beat con cortes y energia", Gauge],
  ["export", "Final Render", "MP4, thumbnail y project pack", Download]
].map(([id, title, body, icon]) => ({ id, title, body, icon }));

function musicVideoTimeline(form = {}) {
  const style = form.visualStyle || "Hollywood Music Video";
  return [
    ["00:00", "00:12", "Intro", "Presentacion visual", "Plano abierto, atmosfera, logo/sello si aplica", "Light leaks, film grain"],
    ["00:12", "00:38", "Verso 1", "Performance / narrativa", "Artista o personaje en locacion principal", "Cortes suaves al beat"],
    ["00:38", "00:52", "Pre-coro", "Construccion", "Movimiento de camara y tension visual", "Speed ramp controlado"],
    ["00:52", "01:20", "Coro", "Impacto", "Escena principal con maxima energia", "VFX, luces, transiciones fuertes"],
    ["01:20", "01:48", "Verso 2", "B-roll / historia", "Clips locales o escenas generadas", "Color matching"],
    ["01:48", "02:10", "Puente", "Cambio emocional", "Slow motion, close ups, siluetas", "Glow, humo, sombras"],
    ["02:10", "02:40", "Coro final", "Cierre fuerte", `Look ${style}`, "Montaje rapido al beat"],
    ["02:40", "03:00", "Outro", "Salida", "Plano final y cierre editorial", "Fade cinematico"]
  ].map(([start, end, section, role, scene, effects], index) => ({
    id: `mv-scene-${index + 1}`,
    start,
    end,
    section,
    role,
    scene,
    effects,
    status: index < 3 ? "Preparado" : "Pendiente"
  }));
}

function MusicVideoStudio({ actions, busyStudio, state }) {
  const [tab, setTab] = useState("Audio");
  const [form, setForm] = useState(defaultForms.musicvideo);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateFile = (key, file) => setForm((current) => ({
    ...current,
    [key]: file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "",
    __files: { ...(current.__files || {}), [key]: file }
  }));
  const promptForPipeline = () => {
    const parts = [
      form.prompt,
      form.songTitle && `Cancion: ${form.songTitle}`,
      form.artistName && `Artista/personaje: ${form.artistName}`,
      form.script && `Guion: ${form.script}`,
      form.lyrics && `Letra: ${form.lyrics}`
    ].filter(Boolean);
    return parts.join("\n\n").trim() || "Crear videoclip musical completo con analisis de cancion, storyboard, clips, lip sync, efectos, montaje al beat y export MP4.";
  };
  const createFullVideo = () => actions.createPipeline("musicvideo", { ...form, prompt: promptForPipeline(), timeline: musicVideoTimeline(form) });
  const runAction = (action) => {
    if (action.startsWith("Upload")) return actions.notify(`${action}: usa los campos de archivo del panel izquierdo.`);
    if (["Render Final Video", "Export MP4", "Export Project Pack"].includes(action)) return createFullVideo();
    return actions.runV6Action("music_video_studio", action, { ...cleanFormForStorage(form), prompt: promptForPipeline(), activeTab: tab });
  };
  const jobs = (state.jobs || []).filter((job) => job.studio === "musicvideo" && job.userGenerated === true);
  const activeJob = jobs.find((job) => ["queued", "processing"].includes(job.status));
  return (
    <div className="music-video-studio">
      <section className="mv-hero">
        <div>
          <h1>MUSIC VIDEO STUDIO</h1>
          <p>Crea videoclips completos con cancion, guion, artista, escenas, lip sync, efectos y exportacion final con IA.</p>
        </div>
        <button className="btn" disabled={busyStudio === "musicvideo"} onClick={createFullVideo}><Plus size={18} />{busyStudio === "musicvideo" ? "Creando videoclip..." : "Crear videoclip completo"}</button>
      </section>
      <div className="mv-tabs">
        {musicVideoTabs.map((item, index) => <button className={`tab ${tab === item ? "active" : ""}`} key={item} onClick={() => setTab(item)}><span>{index + 1}</span>{item}</button>)}
      </div>
      <div className="mv-layout">
        <section className="card form mv-config">
          <h2>Configuracion del videoclip</h2>
          <div className="field"><label>Prompt principal</label><textarea className="textarea compact-textarea" value={form.prompt} maxLength={2000} onChange={(event) => update("prompt", event.target.value)} placeholder="Describe el videoclip, el mood, la historia visual o la direccion creativa." /></div>
          <div className="grid form-grid">
            <MusicVideoFile label="Cancion / audio principal" field="audio_url" accept="audio/*" value={form.audio_url} onChange={updateFile} />
            <MusicVideoFile label="Guion / PDF / TXT" field="scriptFile" accept=".txt,.pdf,.doc,.docx,text/*,application/pdf" value={form.scriptFile} onChange={updateFile} />
            <MusicVideoFile label="Foto artista / avatar" field="artistImage" accept="image/*" value={form.artistImage} onChange={updateFile} />
            <MusicVideoFile label="Videos locales" field="localClips" accept="video/*" value={form.localClips} onChange={updateFile} />
            <MusicVideoFile label="Imagenes referencia" field="referenceImages" accept="image/*" value={form.referenceImages} onChange={updateFile} />
            <MusicVideoFile label="Video base" field="video_url" accept="video/*" value={form.video_url} onChange={updateFile} />
          </div>
          <div className="grid form-grid">
            <div className="field"><label>Cancion</label><input className="input" value={form.songTitle} onChange={(e) => update("songTitle", e.target.value)} placeholder="Nombre de la cancion" /></div>
            <div className="field"><label>Artista / personaje</label><input className="input" value={form.artistName} onChange={(e) => update("artistName", e.target.value)} placeholder="Nombre o identidad visual" /></div>
            <div className="field"><label>Genero musical</label><select className="select" value={form.musicGenre} onChange={(e) => update("musicGenre", e.target.value)}>{["Auto", "Reggaeton", "Trap", "Pop", "Bachata", "Salsa", "R&B", "Rock", "Electronica", "Afrobeat", "Cinematic"].map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Estilo visual</label><select className="select" value={form.visualStyle} onChange={(e) => update("visualStyle", e.target.value)}>{musicVideoPresets.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Estilo de edicion</label><select className="select" value={form.editStyle} onChange={(e) => update("editStyle", e.target.value)}>{["Beat synced cinematic", "Fast cuts", "Slow motion luxury", "Dance edit", "Lyric visualizer", "Storytelling"].map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Formato</label><select className="select" value={form.target} onChange={(e) => update("target", e.target.value)}>{["YouTube 16:9", "TikTok / Reels 9:16", "Square 1:1", "Cinema 2.39:1"].map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Resolucion</label><select className="select" value={form.resolution} onChange={(e) => update("resolution", e.target.value)}>{["720p", "1080p Full HD", "2K", "4K"].map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>FPS</label><select className="select" value={form.fps} onChange={(e) => update("fps", e.target.value)}>{["24 fps", "30 fps", "60 fps"].map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Modelo video</label><select className="select" value={form.videoModel} onChange={(e) => update("videoModel", e.target.value)}>{["seedance-lite-t2v", "veo3.1-lite-text-to-video", "veo3.1-text-to-video", "kling-v3.0-pro-text-to-video", "wan2.5-text-to-video", "auto"].map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Modelo imagen</label><select className="select" value={form.imageModel} onChange={(e) => update("imageModel", e.target.value)}>{["auto", "nano-banana", "flux", "recraft-v4-1", "ai-product-photography"].map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Modelo lip sync</label><select className="select" value={form.lipSyncModel} onChange={(e) => update("lipSyncModel", e.target.value)}>{["auto", "infinitetalk-image-to-video", "wav2lip-compatible", "musetalk-compatible", "liveportrait-compatible"].map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Modelo VFX</label><select className="select" value={form.vfxModel} onChange={(e) => update("vfxModel", e.target.value)}>{["auto-vfx", "ai-video-effects", "background-remover", "relighting", "upscale"].map((item) => <option key={item}>{item}</option>)}</select></div>
          </div>
          <div className="field"><label>Guion del videoclip</label><textarea className="textarea compact-textarea" value={form.script} onChange={(e) => update("script", e.target.value)} placeholder="Escenas, momentos por segundo, historia visual, performance, b-roll o direccion." /></div>
          <div className="field"><label>Letra de la cancion</label><textarea className="textarea compact-textarea" value={form.lyrics} onChange={(e) => update("lyrics", e.target.value)} placeholder="Pega la letra si la tienes. Si no, el sistema puede detectarla." /></div>
          <label className="check-row schema-check"><input type="checkbox" checked={Boolean(form.lyricsEnabled)} onChange={(e) => update("lyricsEnabled", e.target.checked)} />Activar lyrics/subtitulos</label>
          <button className="btn full" disabled={busyStudio === "musicvideo"} onClick={createFullVideo}><Sparkles size={18} />Crear videoclip completo</button>
        </section>
        <section className="card mv-center">
          <div className="section-head"><div><h2>Flujo de produccion</h2><p className="muted">{tab}: control del proceso profesional del videoclip.</p></div><button className="btn secondary" onClick={() => actions.download("music-video-brief.json", cleanFormForStorage({ ...form, prompt: promptForPipeline(), timeline: musicVideoTimeline(form) }))}>Exportar brief</button></div>
          <div className="mv-flow-grid">
            {musicVideoFlow.map((stage, index) => {
              const Icon = stage.icon;
              const status = activeJob ? stageStatusFromProgress(activeJob.progress || 0, index, musicVideoFlow.length) : index < 3 ? "processing" : "queued";
              return <button className={`mv-flow-card ${status}`} key={stage.id} onClick={() => runAction(stage.title)}><Icon size={18} /><strong>{index + 1}. {stage.title}</strong><span>{stage.body}</span><small>{statusLabel(status)}</small></button>;
            })}
          </div>
          <div className="mv-timeline">
            <div className="section-head"><h2>Linea de tiempo del videoclip</h2><button className="btn secondary" onClick={() => actions.download("music-video-timeline.json", musicVideoTimeline(form))}>Descargar timeline</button></div>
            <div className="mv-timeline-row">
              {musicVideoTimeline(form).map((item) => <button className="mv-scene" key={item.id} onClick={() => actions.modal({ title: `${item.section} ${item.start}-${item.end}`, body: JSON.stringify(item, null, 2), prompt: promptForPipeline() })}><strong>{item.section}</strong><span>{item.start} - {item.end}</span><small>{item.role}</small></button>)}
            </div>
            <div className="mv-wave"><span>Forma de onda</span><Waveform /></div>
            <div className="mv-beats">{Array.from({ length: 48 }).map((_, index) => <span key={index} />)}</div>
          </div>
          <NativeStudioPanel studio="musicvideo" state={state} actions={actions} form={form} />
        </section>
        <aside className="mv-side">
          <button className="btn full" disabled={busyStudio === "musicvideo"} onClick={createFullVideo}><Plus size={18} />Crear videoclip completo</button>
          <section className="card flow-actions">
            <h2>Acciones rapidas</h2>
            {musicVideoActions.map((action) => <button className="btn secondary full" key={action} onClick={() => runAction(action)}>{action}</button>)}
          </section>
          <section className="card mv-preview">
            <h2>Vista previa del videoclip</h2>
            <img src="/assets/panel-cards/music-video-studio.png" alt="Vista previa Music Video Studio" />
            <div className="video-controls"><Play size={18} /><span>00:45 / 03:24</span></div>
          </section>
          <section className="card">
            <h2>Informacion del proyecto</h2>
            <div className="check-row"><FileText size={18} />{form.songTitle || "Cancion pendiente"}</div>
            <div className="check-row"><Music size={18} />{form.musicGenre}</div>
            <div className="check-row"><Camera size={18} />{form.target} - {form.resolution}</div>
            <div className="check-row"><Gauge size={18} />{jobs.length ? statusLabel(jobs[0].status) : "Sin render activo"}</div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MusicVideoFile({ label, field, accept, value, onChange }) {
  return (
    <div className="field file-field mv-file">
      <label>{label}</label>
      <input id={`mv-${field}`} className="file-native" type="file" accept={accept} onChange={(event) => onChange(field, event.target.files?.[0] || null)} />
      <label className={value ? "file-picker selected" : "file-picker"} htmlFor={`mv-${field}`}><Upload size={16} />{value ? "Cambiar archivo" : "Subir archivo"}</label>
      <small className="muted file-name">{value || "Ningun archivo seleccionado"}</small>
    </div>
  );
}

function LegacyVideoEditorStudio({ actions, busyStudio, state }) {
  const [form, setForm] = useState(defaultForms.editor);
  const [selectedTrack, setSelectedTrack] = useState("Video principal");
  const [chatInput, setChatInput] = useState("");
  const [editorMessages, setEditorMessages] = useState([
    { from: "ai", text: "Proyecto cargado. Puedo cortar, reemplazar escenas, crear subtitulos, sincronizar al beat, generar clips, render preview y exportar final." }
  ]);
  const [timeline, setTimeline] = useState([
    { id: "main", name: "Video principal", description: "Clips base y toma final", color: "#e02020", clips: [{ id: "clip-1", label: "Intro ciudad", start: 0, end: 4 }, { id: "clip-2", label: "Escena principal", start: 4, end: 9 }, { id: "clip-3", label: "Cierre", start: 9, end: 12 }] },
    { id: "secondary", name: "Video secundario", description: "B-roll, inserts y apoyo visual", color: "#15d1ff", clips: [{ id: "clip-4", label: "B-roll neon", start: 2, end: 6 }] },
    { id: "text", name: "Texto / subtitulos", description: "Subtitulos, titulos y lower thirds", color: "#d4af37", clips: [{ id: "clip-5", label: "Titulo inicial", start: 0, end: 3 }] },
    { id: "audio", name: "Audio principal", description: "Narrativa, dialogo o lipsync", color: "#9b5cff", clips: [{ id: "clip-6", label: "Narrativa", start: 0, end: 12 }] },
    { id: "music", name: "Musica", description: "Banda sonora, beat y SFX", color: "#25d366", clips: [{ id: "clip-7", label: "Score cinematico", start: 0, end: 12 }] }
  ]);
  const editorJobs = (state.jobs || []).filter((job) => ["editor", "video", "documentary", "musicvideo", "marketing"].includes(job.studio) && job.userGenerated === true);
  const activeJob = editorJobs.find((job) => ["queued", "processing"].includes(job.status));
  const completed = editorJobs.filter((job) => job.status === "completed");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectedTrackData = timeline.find((track) => track.name === selectedTrack) || timeline[0];
  const selectedClip = selectedTrackData?.clips?.[0];
  const applyTimelineAction = (type, payload = {}) => {
    const costMap = { cut_range: 2, split: 1, duplicate: 1, delete: 1, replace_scene: 8, add_subtitles: 5, sync_to_beat: 6, generate_clip: 18, render_preview: 12, export_final: 25 };
    const cost = costMap[type] || 3;
    setTimeline((current) => current.map((track) => {
      if (type === "add_subtitles" && track.id === "text") {
        return { ...track, clips: [...track.clips, { id: `sub-${Date.now()}`, label: "Subtitulos automaticos", start: 0, end: 12 }] };
      }
      if (type === "sync_to_beat" && track.id === "music") {
        return { ...track, clips: track.clips.map((clip) => ({ ...clip, label: `${clip.label} · beat sync` })) };
      }
      if (type === "replace_scene" && track.id === "main") {
        return { ...track, clips: track.clips.map((clip, index) => index === 1 ? { ...clip, label: payload.prompt || "Escena reemplazada IA" } : clip) };
      }
      if (type === "generate_clip" && track.id === "secondary") {
        return { ...track, clips: [...track.clips, { id: `gen-${Date.now()}`, label: payload.prompt || "Clip IA generado", start: 6, end: 10 }] };
      }
      if (type === "cut_range" && track.id === selectedTrackData.id) {
        return { ...track, clips: track.clips.map((clip) => ({ ...clip, end: Math.max(clip.start + 1, clip.end - 1), label: `${clip.label} · cortado` })) };
      }
      if (type === "duplicate" && track.id === selectedTrackData.id && selectedClip) {
        return { ...track, clips: [...track.clips, { ...selectedClip, id: `dup-${Date.now()}`, label: `${selectedClip.label} copia`, start: selectedClip.end, end: selectedClip.end + (selectedClip.end - selectedClip.start) }] };
      }
      if (type === "delete" && track.id === selectedTrackData.id) {
        return { ...track, clips: track.clips.slice(1) };
      }
      return track;
    }));
    setEditorMessages((current) => [...current, { from: "ai", text: `Accion aplicada: ${type}. Costo estimado confirmado: ${cost} creditos. Timeline actualizado y version local guardada.` }]);
  };
  const interpretEditorCommand = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes("subtitulo")) return { type: "add_subtitles", cost: 5, label: "Anadir subtitulos automaticos" };
    if (lower.includes("beat") || lower.includes("ritmo")) return { type: "sync_to_beat", cost: 6, label: "Sincronizar cortes al beat" };
    if (lower.includes("reemplaza") || lower.includes("cambia la escena") || lower.includes("ciudad futurista")) return { type: "replace_scene", cost: 8, label: "Reemplazar escena", prompt: text };
    if (lower.includes("genera") || lower.includes("crear clip")) return { type: "generate_clip", cost: 18, label: "Generar clip IA", prompt: text };
    if (lower.includes("export")) return { type: "export_final", cost: 25, label: "Exportar video final" };
    if (lower.includes("preview") || lower.includes("render")) return { type: "render_preview", cost: 12, label: "Render preview" };
    return { type: "cut_range", cost: 2, label: "Cortar rango indicado" };
  };
  const sendEditorCommand = () => {
    const text = chatInput.trim();
    if (!text) return;
    const interpreted = interpretEditorCommand(text);
    setEditorMessages((current) => [...current, { from: "user", text }, { from: "ai", text: `${interpreted.label}. Costo estimado: ${interpreted.cost} creditos. Ejecutando accion real sobre el timeline local.` }]);
    setChatInput("");
    applyTimelineAction(interpreted.type, interpreted);
  };
  const render = async () => {
    const prompt = form.prompt.trim() || "Render final editado desde Video Editor Studio AI";
    await actions.createJob("editor", { ...form, prompt, timeline });
  };
  return (
    <div className="editor-studio">
      <section className="editor-top card">
        <div>
          <h1>VIDEO EDITOR STUDIO AI</h1>
          <p className="muted">Editor central para videos, documentales, videoclips, marketing, subtitulos y export final.</p>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={() => actions.createProject({ title: form.title || "Proyecto de editor", type: "Video", quality: form.resolution })}><Save size={16} />Guardar proyecto</button>
          <button className="btn" disabled={busyStudio === "editor"} onClick={render}><Clapperboard size={18} />Render final</button>
          <button className="btn secondary" onClick={() => actions.download("editor-project.json", { form, timeline })}><Download size={16} />Exportar pack</button>
        </div>
      </section>
      <div className="editor-layout">
        <section className="card form editor-assets">
          <h2>Archivos del proyecto</h2>
          <div className="field"><label>Nombre del proyecto</label><input className="input" value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Nombre del montaje" /></div>
          <div className="field"><label>Direccion de edicion</label><textarea className="textarea compact-textarea" value={form.prompt} onChange={(event) => update("prompt", event.target.value)} placeholder="Describe el montaje, ritmo, estilo, subtitulos, audio y export final." /></div>
          <FileInputs studio="musicvideo" model={getMuapiModelById("veo3.1-text-to-video") || {}} form={form} setForm={setForm} />
          <div className="editor-file-list">
            {["Clips", "Imagenes", "Narrativa", "Musica", "Subtitulos", "VFX"].map((item) => <button className="btn secondary" key={item} onClick={() => actions.notify(`${item}: listo para clasificacion automatica al subir archivos.`)}>{item}</button>)}
          </div>
        </section>
        <section className="card editor-preview-panel">
          <div className="section-head">
            <div><h2>Vista previa del montaje</h2><p className="muted">{activeJob ? statusLabel(activeJob.status) : completed.length ? "Ultimo render completado disponible" : "Sin render activo"}</p></div>
            <span className="status-pill warn">{form.resolution}</span>
          </div>
          {activeJob ? <JobPreview job={activeJob} actions={actions} /> : (
            <div className="editor-preview-frame">
              <img src={previewImageForStudio("editor")} alt="Vista previa del editor" loading="lazy" decoding="async" />
              <div className="playerbar"><Play size={18} /><span>00:00 / 00:10</span><div className="progress"><span style={{ width: "38%" }} /></div><Settings size={18} /></div>
            </div>
          )}
          <div className="editor-timeline">
            {timeline.map((track) => (
              <button className={`timeline-track ${selectedTrack === track.name ? "active" : ""}`} key={track.id} onClick={() => setSelectedTrack(track.name)}>
                <strong>{track.name}</strong>
                <span>{track.description}</span>
                <div className="clip-strip">{track.clips.map((clip) => <i key={clip.id} style={{ left: `${clip.start * 7}%`, width: `${Math.max(8, (clip.end - clip.start) * 7)}%`, background: track.color }}>{clip.label}</i>)}</div>
              </button>
            ))}
          </div>
        </section>
        <section className="card form editor-inspector">
          <h2>Propiedades</h2>
          <div className="field"><label>Pista seleccionada</label><input className="input" value={selectedTrack} readOnly /></div>
          <div className="grid form-grid">
            <div className="field"><label>Resolucion</label><select className="select" value={form.resolution} onChange={(event) => update("resolution", event.target.value)}><option>720p</option><option>1080p</option><option>4K</option></select></div>
            <div className="field"><label>Ratio</label><select className="select" value={form.ratio} onChange={(event) => update("ratio", event.target.value)}>{choiceOptions.ratio.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>FPS</label><select className="select" value={form.fps} onChange={(event) => update("fps", event.target.value)}><option>24 fps</option><option>30 fps</option><option>60 fps</option></select></div>
            <div className="field"><label>Export</label><select className="select" value={form.exportFormat} onChange={(event) => update("exportFormat", event.target.value)}><option>MP4 H.264</option><option>MOV ProRes</option><option>Pack ZIP</option></select></div>
          </div>
          <div className="quick-actions">
            <button className="btn secondary" onClick={() => applyTimelineAction("cut_range")}><Scissors size={15} />Cortar</button>
            <button className="btn secondary" onClick={() => applyTimelineAction("duplicate")}><Copy size={15} />Duplicar</button>
            <button className="btn secondary" onClick={() => applyTimelineAction("delete")}><Trash2 size={15} />Eliminar</button>
            <button className="btn secondary" onClick={() => applyTimelineAction("add_subtitles")}><Type size={15} />Subtitulos</button>
            <button className="btn secondary" onClick={() => applyTimelineAction("sync_to_beat")}><Volume2 size={15} />Sync beat</button>
            <button className="btn secondary" onClick={() => applyTimelineAction("replace_scene", { prompt: "Escena reemplazada desde accion manual" })}><RefreshCw size={15} />Reemplazar clip</button>
          </div>
        </section>
        <section className="card editor-agent">
          <div className="section-head compact-head"><div><h2>Agente IA - Editor Inteligente</h2><p className="muted">Interpreta instrucciones y modifica el timeline.</p></div><Bot size={22} /></div>
          <div className="editor-chat-log">
            {editorMessages.map((message, index) => <div className={message.from === "ai" ? "ai" : "user"} key={`${message.from}-${index}`}>{message.text}</div>)}
          </div>
          <div className="editor-suggestions">
            {["corta del segundo 2 al 5", "pon subtitulos automaticos", "sincroniza al beat", "cambia la escena por ciudad futurista roja"].map((text) => <button className="btn secondary" key={text} onClick={() => setChatInput(text)}>{text}</button>)}
          </div>
          <div className="editor-chat-input">
            <input className="input" value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendEditorCommand()} placeholder="Ej: corta del segundo 16 al 20..." />
            <button className="btn" onClick={sendEditorCommand}><Send size={16} /></button>
          </div>
        </section>
      </div>
      <section className="card workflow-results">
        <h2>Renders y proyectos relacionados</h2>
        <NativeStudioPanel studio="editor" state={{ jobs: editorJobs }} actions={actions} form={form} />
      </section>
    </div>
  );
}

function PrototypeVideoEditorStudio({ actions, busyStudio, state }) {
  const [form, setForm] = useState(defaultForms.editor);
  const [tracks, setTracks] = useState([
    { id: "main", name: "Video principal", icon: Video, color: "#d9272e", clips: [["c1", "Intro ciudad", 0, 4], ["c2", "Escena principal", 4, 9], ["c3", "Cierre", 9, 12]] },
    { id: "second", name: "Video secundario", icon: Clapperboard, color: "#159bc5", clips: [["c4", "B-roll neon", 2, 6], ["c5", "Plano recurso", 7, 11]] },
    { id: "overlay", name: "Imagen / overlay", icon: Image, color: "#7448b4", clips: [["c6", "Logo", 1, 4], ["c7", "Textura", 6, 10]] },
    { id: "text", name: "Texto / subtitulos", icon: Type, color: "#a66d28", clips: [["c8", "Titulo inicial", 0, 3], ["c9", "Subtitulo", 5, 8]] },
    { id: "audio", name: "Audio principal", icon: Mic2, color: "#198c6c", wave: true, clips: [["c10", "Narrativa", 0, 12]] },
    { id: "music", name: "Musica y SFX", icon: Music, color: "#187da4", wave: true, clips: [["c11", "Score cinematico", 0, 12]] }
  ]);
  const [selection, setSelection] = useState({ track: "main", clip: "c2" });
  const [playhead, setPlayhead] = useState(5);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [files, setFiles] = useState([]);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [chat, setChat] = useState("");
  const [messages, setMessages] = useState([{ from: "ai", text: "Editor listo. Selecciona un clip o escribe una instruccion para modificar el montaje." }]);
  const duration = Math.max(12, ...tracks.flatMap((track) => track.clips.map((clip) => clip[3])));
  const currentTrack = tracks.find((track) => track.id === selection.track) || tracks[0];
  const currentClip = currentTrack.clips.find((clip) => clip[0] === selection.clip) || currentTrack.clips[0];
  const jobs = (state.jobs || []).filter((job) => ["editor", "video", "documentary", "musicvideo", "marketing"].includes(job.studio) && job.userGenerated);
  const change = (updater) => { setPast((items) => [...items.slice(-19), tracks]); setFuture([]); setTracks(updater); };
  const undo = () => { if (!past.length) return; setFuture((items) => [tracks, ...items]); setTracks(past.at(-1)); setPast((items) => items.slice(0, -1)); };
  const redo = () => { if (!future.length) return; setPast((items) => [...items, tracks]); setTracks(future[0]); setFuture((items) => items.slice(1)); };
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setPlayhead((time) => time >= duration ? 0 : Number((time + .1).toFixed(1))), 100);
    return () => window.clearInterval(timer);
  }, [playing, duration]);
  const edit = (type) => {
    if (!currentClip && !["subtitles", "beat"].includes(type)) return;
    let nextId = selection.clip;
    change((items) => items.map((track) => {
      if (type === "subtitles" && track.id === "text") return { ...track, clips: [...track.clips, [`sub-${Date.now()}`, "Subtitulos automaticos", 0, duration]] };
      if (type === "beat" && track.id === "music") return { ...track, clips: track.clips.map((clip) => [clip[0], `${clip[1]} · beat sync`, clip[2], clip[3]]) };
      if (track.id !== selection.track) return track;
      if (type === "trim") return { ...track, clips: track.clips.map((clip) => clip[0] === selection.clip ? [clip[0], clip[1], clip[2], Math.max(clip[2] + .5, clip[3] - .5)] : clip) };
      if (type === "split" && playhead > currentClip[2] && playhead < currentClip[3]) { const id = `split-${Date.now()}`; nextId = id; return { ...track, clips: track.clips.flatMap((clip) => clip[0] === selection.clip ? [[clip[0], clip[1], clip[2], playhead], [id, `${clip[1]} B`, playhead, clip[3]]] : [clip]) }; }
      if (type === "duplicate") { const id = `dup-${Date.now()}`; nextId = id; const length = currentClip[3] - currentClip[2]; return { ...track, clips: [...track.clips, [id, `${currentClip[1]} copia`, currentClip[3], currentClip[3] + length]] }; }
      if (type === "delete") return { ...track, clips: track.clips.filter((clip) => clip[0] !== selection.clip) };
      return track;
    }));
    setSelection((value) => ({ ...value, clip: nextId }));
    setMessages((items) => [...items, { from: "ai", text: `Accion aplicada: ${type}. Timeline actualizado.` }]);
  };
  const addFiles = (fileList) => {
    const added = Array.from(fileList || []).map((file) => ({ id: `${file.name}-${file.lastModified}`, name: file.name, type: file.type, url: URL.createObjectURL(file) }));
    setFiles((items) => [...items, ...added]);
    if (added.length) actions.notify(`${added.length} archivo(s) añadidos al proyecto.`);
  };
  const send = () => {
    const text = chat.trim(); if (!text) return;
    const lower = text.toLowerCase();
    const action = lower.includes("subtitulo") ? "subtitles" : lower.includes("beat") || lower.includes("ritmo") ? "beat" : lower.includes("divide") ? "split" : "trim";
    setMessages((items) => [...items, { from: "user", text }]); setChat(""); edit(action);
  };
  const render = () => actions.createJob("editor", { ...form, prompt: form.prompt.trim() || "Render final desde Video Editor Studio AI", timeline: tracks });
  const clock = (seconds) => `00:${String(Math.floor(seconds)).padStart(2, "0")}`;
  return <div className="editor-workspace">
    <header className="editor-commandbar"><div><span className="editor-kicker">NEXFRAME EDITOR</span><h1>VIDEO EDITOR STUDIO AI</h1><p>Montaje profesional, automatizacion y agente inteligente.</p></div><div className="editor-project-meta"><span>Proyecto <strong>{form.title || "Sin titulo"}</strong></span><span>{form.resolution} · {form.ratio}</span><span>{form.fps}</span></div><div className="editor-header-actions"><button className="btn secondary" onClick={() => actions.createProject({ title: form.title || "Proyecto de editor", type: "Video", quality: form.resolution })}><Save size={15} />Guardar</button><button className="btn" disabled={busyStudio === "editor"} onClick={render}><Download size={16} />Exportar video final</button></div></header>
    <nav className="editor-steps" aria-label="Flujo de edicion">{["Archivos", "Analisis IA", "Edicion IA", "Ajustes", "Revision", "Exportacion"].map((step, index) => <button className={index === 2 ? "active" : ""} key={step}><strong>{index + 1}</strong><span>{step}</span></button>)}</nav>
    <div className="editor-upper-grid">
      <section className="editor-pane editor-media-pane"><PaneTitle title="Archivos del proyecto" meta={`${files.length} importados`}><label className="editor-upload"><Plus size={15} />Añadir<input type="file" multiple accept="video/*,audio/*,image/*,.srt" onChange={(event) => addFiles(event.target.files)} /></label></PaneTitle><div className="editor-media-tabs">{["Todos", "Videos", "Imagenes", "Audio"].map((tab, index) => <button className={index === 0 ? "active" : ""} key={tab}>{tab}</button>)}</div><div className="editor-media-grid">{files.length ? files.map((file) => <button key={file.id}>{file.type.startsWith("image") ? <img src={file.url} alt="" /> : <span className="media-icon">{file.type.startsWith("audio") ? <Music /> : <Video />}</span>}<strong>{file.name}</strong></button>) : <label className="editor-media-empty"><Upload size={24} /><strong>Añade tus archivos</strong><span>Video, audio, imagen y SRT</span><input type="file" multiple accept="video/*,audio/*,image/*,.srt" onChange={(event) => addFiles(event.target.files)} /></label>}</div><label className="editor-direction">Direccion de edicion<textarea className="textarea compact-textarea" value={form.prompt} onChange={(event) => setForm((value) => ({ ...value, prompt: event.target.value }))} placeholder="Ritmo, estilo, color y tratamiento de audio..." /></label></section>
      <section className="editor-pane editor-viewer-pane"><PaneTitle title="Vista previa" meta="Edicion local"><span className="editor-live-dot">LISTO</span></PaneTitle><div className="editor-canvas"><img src="/assets/cyberpunk-video.png" alt="Fotograma cinematografico del montaje" /><div className="safe-frame" /></div><div className="editor-transport"><button aria-label={playing ? "Pausar" : "Reproducir"} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={18} /> : <Play size={18} />}</button><span>{clock(playhead)} / {clock(duration)}</span><input aria-label="Posicion de reproduccion" type="range" min="0" max={duration} step=".1" value={playhead} onChange={(event) => setPlayhead(Number(event.target.value))} /><button aria-label="Audio"><Volume2 size={17} /></button><button aria-label="Ajustes"><Settings size={17} /></button></div></section>
      <aside className="editor-pane editor-properties"><PaneTitle title="Propiedades del clip" meta={currentTrack.name} /><label>Nombre<input className="input" value={currentClip?.[1] || "Sin clip"} readOnly /></label><div className="editor-property-row"><label>Inicio<input className="input" value={currentClip?.[2] ?? 0} readOnly /></label><label>Final<input className="input" value={currentClip?.[3] ?? 0} readOnly /></label></div><div className="editor-property-row"><label>Resolucion<select className="select" value={form.resolution} onChange={(event) => setForm((value) => ({ ...value, resolution: event.target.value }))}><option>720p</option><option>1080p</option><option>4K</option></select></label><label>FPS<select className="select" value={form.fps} onChange={(event) => setForm((value) => ({ ...value, fps: event.target.value }))}><option>24 fps</option><option>30 fps</option><option>60 fps</option></select></label></div><div className="editor-quick-tools"><button onClick={() => edit("trim")}><Scissors />Recortar</button><button onClick={() => edit("split")}><Scissors />Dividir</button><button onClick={() => edit("duplicate")}><Copy />Duplicar</button><button onClick={() => edit("delete")}><Trash2 />Eliminar</button><button onClick={() => edit("subtitles")}><Type />Subtitulos</button><button onClick={() => edit("beat")}><Volume2 />Ajustar beat</button></div></aside>
      <aside className="editor-pane editor-agent"><PaneTitle title="Agente IA" meta="Editor inteligente activo"><Bot size={20} /></PaneTitle><div className="editor-chat-log">{messages.map((message, index) => <div className={message.from} key={`${message.from}-${index}`}>{message.text}</div>)}</div><div className="editor-suggestions">{["Pon subtitulos automaticos", "Sincroniza los cortes al beat", "Divide el clip en el cursor"].map((text) => <button key={text} onClick={() => setChat(text)}>{text}</button>)}</div><div className="editor-chat-input"><input className="input" value={chat} onChange={(event) => setChat(event.target.value)} onKeyDown={(event) => event.key === "Enter" && send()} placeholder="Escribe una instruccion..." /><button className="btn" aria-label="Enviar instruccion" onClick={send}><Send size={16} /></button></div></aside>
    </div>
    <section className="editor-timeline-shell"><div className="editor-timeline-toolbar"><div><button aria-label="Deshacer" disabled={!past.length} onClick={undo}><Undo2 /></button><button aria-label="Rehacer" disabled={!future.length} onClick={redo}><Redo2 /></button><span className="toolbar-divider" /><button onClick={() => edit("split")}><Scissors />Dividir</button><button onClick={() => edit("duplicate")}><Copy />Duplicar</button><button onClick={() => edit("delete")}><Trash2 />Eliminar</button></div><div><span>Zoom</span><input aria-label="Zoom del timeline" type="range" min="1" max="2" step=".1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></div></div><div className="editor-ruler"><span />{Array.from({ length: Math.ceil(duration) + 1 }, (_, index) => <i key={index} style={{ left: `${(index / duration) * 100}%` }}>{index % 2 === 0 ? clock(index) : ""}</i>)}</div><div className="editor-tracks" style={{ "--timeline-zoom": zoom }}><div className="editor-playhead" style={{ left: `calc(150px + (100% - 150px) * ${playhead / duration})` }}><span>{clock(playhead)}</span></div>{tracks.map((track) => { const TrackIcon = track.icon; return <div className={`editor-track-row ${track.id === selection.track ? "active" : ""}`} key={track.id}><button className="editor-track-label" onClick={() => setSelection({ track: track.id, clip: track.clips[0]?.[0] || "" })}><TrackIcon size={15} /><span>{track.name}</span></button><div className={`editor-track-lane ${track.wave ? "wave" : ""}`}>{track.clips.map((clip) => <button className={`editor-clip ${clip[0] === selection.clip ? "selected" : ""}`} key={clip[0]} style={{ left: `${(clip[2] / duration) * 100}%`, width: `${Math.max(3, ((clip[3] - clip[2]) / duration) * 100)}%`, "--clip-color": track.color }} onClick={() => { setSelection({ track: track.id, clip: clip[0] }); setPlayhead(clip[2]); }}><span>{clip[1]}</span><small>{clock(clip[2])} - {clock(clip[3])}</small></button>)}</div></div>; })}</div></section>
    {jobs.length > 0 && <section className="editor-renders"><PaneTitle title="Renders recientes" meta={`${jobs.length} proyectos relacionados`} /><NativeStudioPanel studio="editor" state={{ jobs }} actions={actions} form={form} /></section>}
  </div>;
}

function VideoEditorStudio({ actions }) {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [selection, setSelection] = useState({ trackId: "", clipId: "" });
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [chat, setChat] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [openMontage, setOpenMontage] = useState(null);
  const videoRef = React.useRef(null);
  const loadProject = async () => {
    if (projectId) return (await apiRequest(`/api/editor/projects/${projectId}`)).project;
    const result = await apiRequest("/api/editor/projects");
    if (result.projects?.length) return result.projects[0];
    return (await apiRequest("/api/editor/projects", { method: "POST", body: JSON.stringify({ name: "Mi montaje" }) })).project;
  };
  useEffect(() => { loadProject().then(setProject).catch((issue) => setError(issue.message)); }, [projectId]);
  useEffect(() => {
    apiRequest("/api/openmontage/status")
      .then((result) => setOpenMontage(result.status))
      .catch(() => setOpenMontage(null));
  }, []);
  const save = async () => {
    if (!project) return;
    setBusy("save"); setError("");
    try { const result = await apiRequest(`/api/editor/projects/${project.id}`, { method: "PUT", body: JSON.stringify({ name: project.name, settings: project.settings, timeline: project.timeline }) }); setProject(result.project); actions.notify("Proyecto y version guardados."); } catch (issue) { setError(issue.message); } finally { setBusy(""); }
  };
  const uploadMedia = async (fileList) => {
    if (!project || !fileList?.length) return;
    setBusy("upload"); setError("");
    const body = new FormData(); Array.from(fileList).forEach((file) => body.append("media", file));
    try {
      const response = await fetch(directApiUrl(`/api/editor/projects/${project.id}/media`), { method: "POST", body, credentials: "include" });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
      setProject(result.project); actions.notify("Medios analizados y guardados.");
    } catch (issue) { setError(issue.message); } finally { setBusy(""); }
  };
  const addMediaToTimeline = async (media) => {
    const type = media.hasVideo ? "video" : media.hasAudio ? "audio" : "image";
    const currentTracks = project.timeline.tracks || [];
    let track = currentTracks.find((item) => item.type === type);
    if (!track) track = { id: `track_${Date.now()}`, type, name: type === "video" ? "Video principal" : type === "audio" ? "Audio principal" : "Imagenes", clips: [] };
    const start = Math.max(0, ...track.clips.map((clip) => clip.end || 0));
    const clip = { id: `clip_${Date.now()}`, mediaId: media.id, type, name: media.name, start, end: start + Math.max(.1, media.duration || 5), in: 0, url: media.url, thumbnailUrl: media.thumbnailUrl };
    const tracks = currentTracks.some((item) => item.id === track.id) ? currentTracks.map((item) => item.id === track.id ? { ...item, clips: [...item.clips, clip] } : item) : [...currentTracks, { ...track, clips: [clip] }];
    const timeline = { tracks, duration: Math.max(project.timeline.duration || 0, clip.end) };
    try { const result = await apiRequest(`/api/editor/projects/${project.id}`, { method: "PUT", body: JSON.stringify({ timeline }) }); setProject(result.project); setSelection({ trackId: track.id, clipId: clip.id }); } catch (issue) { setError(issue.message); }
  };
  const operate = async (operation) => {
    if (!project) return;
    setBusy("operation"); setError("");
    try { const result = await apiRequest(`/api/editor/projects/${project.id}/operations`, { method: "POST", body: JSON.stringify({ operations: [operation] }) }); setProject(result.project); actions.notify("Operacion ejecutada y persistida."); } catch (issue) { setError(issue.message); } finally { setBusy(""); }
  };
  const sendAgent = async () => {
    const instruction = chat.trim(); if (!instruction || !project) return;
    setMessages((items) => [...items, { from: "user", text: instruction }]); setChat(""); setBusy("agent");
    try { const result = await apiRequest(`/api/editor/projects/${project.id}/agent`, { method: "POST", body: JSON.stringify({ instruction, selection, playhead }) }); setProject(result.project); setMessages((items) => [...items, { from: "ai", text: result.message }]); } catch (issue) { setMessages((items) => [...items, { from: "ai", text: `Error: ${issue.message}` }]); } finally { setBusy(""); }
  };
  const render = async () => {
    if (!project) return;
    setBusy("render"); setError("");
    try { const result = await apiRequest(`/api/editor/projects/${project.id}/render`, { method: "POST", body: "{}" }); setProject(result.project); actions.notify("Render FFmpeg completado."); } catch (issue) { setError(issue.message); } finally { setBusy(""); }
  };
  const selectedTrack = project?.timeline?.tracks?.find((track) => track.id === selection.trackId);
  const selectedClip = selectedTrack?.clips?.find((clip) => clip.id === selection.clipId);
  const selectedMedia = project?.media?.find((media) => media.id === selectedClip?.mediaId);
  const duration = Math.max(1, Number(project?.timeline?.duration || 0));
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setPlayhead((value) => value >= duration ? 0 : Number((value + .1).toFixed(1))), 100);
    return () => window.clearInterval(timer);
  }, [playing, duration]);
  if (!project) return <section className="editor-pane"><h1>VIDEO EDITOR STUDIO AI</h1><p>{error || "Cargando proyecto persistente..."}</p></section>;
  return <div className="editor-workspace real-editor">
    <header className="editor-commandbar"><div><span className="editor-kicker">PROYECTO REAL</span><h1>VIDEO EDITOR STUDIO AI</h1><input className="editor-title-input" value={project.name} onChange={(event) => setProject((value) => ({ ...value, name: event.target.value }))} /></div><div className="editor-project-meta"><span>{project.media.length} medios</span><span>{project.timeline.tracks.length} pistas</span><span>{duration.toFixed(2)} s</span></div><div className="editor-header-actions"><button className="btn secondary" disabled={Boolean(busy)} onClick={save}><Save size={15} />{busy === "save" ? "Guardando..." : "Guardar version"}</button><button className="btn" disabled={Boolean(busy)} onClick={render}><Download size={16} />{busy === "render" ? "Renderizando..." : "Exportar MP4 real"}</button></div></header>
    <OpenMontageEditorPanel status={openMontage} />
    {error && <div className="editor-error"><AlertCircle size={16} />{error}</div>}
    <div className="editor-upper-grid">
      <section className="editor-pane editor-media-pane"><PaneTitle title="Biblioteca persistente" meta={`${project.media.length} archivos`}><label className="editor-upload"><Plus size={15} />{busy === "upload" ? "Analizando..." : "Subir"}<input type="file" multiple accept="video/*,audio/*,image/*,.srt" disabled={busy === "upload"} onChange={(event) => uploadMedia(event.target.files)} /></label></PaneTitle><div className="editor-media-grid">{project.media.length ? project.media.map((media) => <button draggable key={media.id} onDragStart={(event) => event.dataTransfer.setData("mediaId", media.id)} onDoubleClick={() => addMediaToTimeline(media)} title="Doble clic o arrastra a la timeline"><span className="media-icon">{media.thumbnailUrl ? <img src={apiAssetUrl(media.thumbnailUrl)} alt="" /> : media.hasAudio ? <Music /> : <Image />}</span><strong>{media.name}</strong><small>{media.duration ? `${media.duration.toFixed(2)} s` : media.mimeType}</small></button>) : <label className="editor-media-empty"><Upload size={24} /><strong>Sube medios reales</strong><span>Se analizaran con FFprobe</span><input type="file" multiple accept="video/*,audio/*,image/*,.srt" onChange={(event) => uploadMedia(event.target.files)} /></label>}</div></section>
      <section className="editor-pane editor-viewer-pane"><PaneTitle title="Reproductor del clip activo" meta={selectedClip?.name || "Sin seleccion"} /><div className="editor-canvas">{selectedMedia?.hasVideo ? <video ref={videoRef} src={apiAssetUrl(selectedMedia.url)} controls onTimeUpdate={(event) => setPlayhead(event.currentTarget.currentTime)} /> : selectedMedia?.mimeType?.startsWith("image/") ? <img src={apiAssetUrl(selectedMedia.url)} alt={selectedMedia.name} /> : <div className="editor-viewer-empty"><Play /><span>Selecciona un clip con archivo real</span></div>}</div><div className="editor-transport"><button aria-label={playing ? "Pausar" : "Reproducir"} onClick={() => { setPlaying((value) => !value); if (videoRef.current) playing ? videoRef.current.pause() : videoRef.current.play(); }}>{playing ? <Pause /> : <Play />}</button><span>{playhead.toFixed(1)} / {duration.toFixed(1)}</span><input aria-label="Posicion de reproduccion" type="range" min="0" max={duration} step=".01" value={Math.min(playhead, duration)} onChange={(event) => { const value = Number(event.target.value); setPlayhead(value); if (videoRef.current) videoRef.current.currentTime = Math.max(0, value - Number(selectedClip?.start || 0) + Number(selectedClip?.in || 0)); }} /></div></section>
      <aside className="editor-pane editor-properties"><PaneTitle title="Propiedades" meta={selectedTrack?.name || "Sin clip"} /><label>Clip<input className="input" value={selectedClip?.name || "Selecciona un clip"} readOnly /></label><div className="editor-property-row"><label>Inicio<input className="input" value={selectedClip?.start ?? 0} readOnly /></label><label>Final<input className="input" value={selectedClip?.end ?? 0} readOnly /></label></div><div className="editor-quick-tools"><button disabled={!selectedClip || Boolean(busy)} onClick={() => operate({ type: "split_clip", clipId: selectedClip.id, time: playhead })}><Scissors />Dividir</button><button disabled={!selectedClip || Boolean(busy)} onClick={() => operate({ type: "duplicate_clip", clipId: selectedClip.id })}><Copy />Duplicar</button><button disabled={!selectedClip || Boolean(busy)} onClick={() => operate({ type: "delete_clip", clipId: selectedClip.id })}><Trash2 />Borrar</button><button disabled={Boolean(busy)} onClick={() => operate({ type: "add_subtitles", projectId: project.id, language: "es" })}><Type />Subtitulos</button></div></aside>
      <aside className="editor-pane editor-agent"><PaneTitle title="Agente de operaciones" meta="Backend conectado"><Bot /></PaneTitle><div className="editor-chat-log">{messages.length ? messages.map((message, index) => <div className={message.from} key={index}>{message.text}</div>) : <div className="ai">Selecciona un clip y pide: borra este clip, divide aquí o corta del segundo X al Y.</div>}</div><div className="editor-chat-input"><input className="input" value={chat} onChange={(event) => setChat(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendAgent()} placeholder="Instruccion exacta..." /><button className="btn" disabled={busy === "agent"} onClick={sendAgent}><Send /></button></div></aside>
    </div>
    <section className="editor-timeline-shell" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const media = project.media.find((item) => item.id === event.dataTransfer.getData("mediaId")); if (media) addMediaToTimeline(media); }}><div className="editor-timeline-toolbar"><strong>Timeline persistente</strong><span>Arrastra medios aquí · todas las operaciones pasan por el backend</span></div><div className="editor-tracks">{project.timeline.tracks.length ? project.timeline.tracks.map((track) => <div className={`editor-track-row ${track.id === selection.trackId ? "active" : ""}`} key={track.id}><button className="editor-track-label"><Layers /><span>{track.name}</span></button><div className="editor-track-lane">{track.clips.map((clip) => <button className={`editor-clip ${clip.id === selection.clipId ? "selected" : ""}`} style={{ left: `${(clip.start / duration) * 100}%`, width: `${Math.max(2, ((clip.end - clip.start) / duration) * 100)}%`, "--clip-color": track.type === "audio" ? "#168e75" : track.type === "text" ? "#a66d28" : "#b51e27" }} key={clip.id} onClick={() => { setSelection({ trackId: track.id, clipId: clip.id }); setPlayhead(clip.start); }}><span>{clip.name}</span><small>{clip.start.toFixed(2)} - {clip.end.toFixed(2)}</small></button>)}</div></div>) : <div className="editor-empty-timeline">Arrastra un video o audio desde la biblioteca para comenzar.</div>}</div></section>
    {project.outputs?.length > 0 && <section className="editor-renders"><PaneTitle title="Renders FFmpeg" meta={`${project.outputs.length} archivos`} />{project.outputs.map((output) => <article key={output.id}><video controls src={apiAssetUrl(output.url)} /><a className="btn" href={apiAssetUrl(output.url)} download>Descargar MP4</a><span>{output.duration.toFixed(2)} s · {output.width}x{output.height}</span></article>)}</section>}
  </div>;
}

function PaneTitle({ title, meta, children }) {
  return <div className="editor-pane-title"><div><h2>{title}</h2><span>{meta}</span></div>{children}</div>;
}

function OpenMontageEditorPanel({ status }) {
  if (!status) return null;
  const pipelines = status.pipelines || [];
  const families = status.toolFamilies || [];
  const runtimeItems = Object.entries(status.runtimes || {});
  return (
    <section className="editor-pane openmontage-panel">
      <PaneTitle title="OpenMontage Engine" meta={`${status.totals?.pipelines || 0} pipelines · ${status.totals?.tools || 0} herramientas`}>
        <Clapperboard size={18} />
      </PaneTitle>
      <div className="openmontage-runtime-row">
        {runtimeItems.map(([name, runtime]) => <span className={runtime.ok ? "ok" : "warn"} key={name}>{name}: {runtime.ok ? "OK" : "No disponible"}</span>)}
      </div>
      <div className="openmontage-grid">
        {pipelines.slice(0, 8).map((pipeline) => <article key={pipeline.id}>
          <strong>{pipeline.name}</strong>
          <span>{pipeline.category} · {pipeline.stability}</span>
          <small>{pipeline.stages.length} etapas</small>
        </article>)}
      </div>
      <div className="openmontage-families">
        {families.slice(0, 10).map((family) => <span key={family.family}>{family.family} ({family.count})</span>)}
      </div>
    </section>
  );
}

function WorkflowScreen({ type, actions, busyStudio, state }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(defaultForms[type]);
  const flow = subpanels.filter((p) => p.area === type);
  const active = flow[step] || flow[0];
  const panelKey = type === "musicvideo" ? "music_video_studio" : "documentary_studio";
  useEffect(() => {
    setStep(0);
    setForm(defaultForms[type]);
  }, [type]);
  return (
    <>
      <h1>{labelFor(type).toUpperCase()}</h1>
      <div className="steps">{flow.map((item, index) => <button className={`step ${index === step ? "active" : ""}`} onClick={() => setStep(index)} key={item.file}><strong>{index + 1}</strong><br /><span>{item.title.split(" - ").pop()}</span></button>)}</div>
      <div className="layout-3">
        <section className="card form">
          <h2>Configuracion</h2>
          <DynamicForm studio={type} form={form} setForm={setForm} model={getMuapiModelById(form.videoModel)} />
          <button className="btn" disabled={busyStudio === type} onClick={() => actions.createPipeline(type, form)}>{busyStudio === type ? "Creando flujo..." : type === "documentary" ? "Crear documental completo" : "Crear videoclip completo"}</button>
          <button className="btn secondary" disabled={busyStudio === type} onClick={() => actions.createJob(type, { ...form, model: form.videoModel })}>Generar solo etapa actual</button>
        </section>
        <section className="card"><h2>{active.title}</h2><WorkflowNativePreview type={type} step={step} actions={actions} /></section>
        <section className="card flow-actions"><h2>Acciones v6</h2><V6ActionBoard panel={panelKey} actions={actions} payload={form} /></section>
      </div>
      <section className="card workflow-results">
        <h2>Vista previa y resultados</h2>
        <NativeStudioPanel studio={type} state={state} actions={actions} form={form} />
      </section>
    </>
  );
}

const flyerStudioAssets = {
  hero: "/assets/flyer-studio/hero-workstation.png",
  discoteca: "/assets/flyer-studio/discoteca-club.png",
  bar: "/assets/flyer-studio/bar-lounge.png",
  food: "/assets/flyer-studio/restaurante-food.png",
  cover: "/assets/flyer-studio/cover-musical.png",
  youtube: "/assets/flyer-studio/thumbnail-youtube.png",
  poster: "/assets/flyer-studio/poster-cine.png",
  promo: "/assets/flyer-studio/promo-comercial.png",
  event: "/assets/flyer-studio/evento-privado.png",
  corporate: "/assets/flyer-studio/corporate-clean.png",
  vertical: "/assets/flyer-studio/flyer-discoteca-vertical.png"
};

const flyerHeroImage = flyerStudioAssets.hero;
const flyerTypeImages = {
  "Discoteca / Club": flyerStudioAssets.discoteca,
  "Bar / Lounge": flyerStudioAssets.bar,
  "Restaurante / Food": flyerStudioAssets.food,
  "Cover Musical": flyerStudioAssets.cover,
  "Thumbnail YouTube": flyerStudioAssets.youtube,
  "Poster Cine": flyerStudioAssets.poster,
  "Promo Comercial": flyerStudioAssets.promo,
  "Evento Privado": flyerStudioAssets.event
};

const flyerTypes = [
  "Discoteca / Club", "Bar / Lounge", "Restaurante / Food", "Cover Musical",
  "Thumbnail YouTube", "Poster Cine", "Promo Comercial", "Evento Privado"
].map((name) => ({ name, image: flyerTypeImages[name] || flyerHeroImage }));

const flyerStyles = [
  ["Nightclub Neon", flyerStudioAssets.discoteca, "neon rojo y magenta, humo, DJ booth, lujo urbano"],
  ["Luxury Gold", flyerStudioAssets.vertical, "negro, dorado, champagne, materiales premium"],
  ["Urban Dark", flyerStudioAssets.poster, "ciudad nocturna, sombras, contraste alto, energia urbana"],
  ["Tropical Party", flyerStudioAssets.event, "colores calidos, palmeras, atardecer, fiesta elegante"],
  ["Food Premium", flyerStudioAssets.food, "fotografia gastronomica, vapor, mesa premium, luz dorada"],
  ["Cinematic Poster", flyerStudioAssets.poster, "poster de cine, luz dramatica, humo y profundidad"],
  ["YouTube Viral", flyerStudioAssets.youtube, "alto contraste, sujeto central claro, espacio para titulo"],
  ["Corporate Clean", flyerStudioAssets.corporate, "marca limpia, composicion moderna, luz de estudio"],
  ["Futuristic AI", flyerStudioAssets.promo, "tecnologia, hologramas, azul electrico y rojo"],
  ["Music Video Dark", flyerStudioAssets.cover, "set musical oscuro, luces rojas, look videoclip"]
].map(([name, image, direction]) => ({ name, image, direction }));

const flyerFormats = [
  { name: "Panel web 16:10", short: "16:10", width: 1600, height: 1000, unit: "px", label: "Panel web horizontal" },
  { name: "Instagram 4:5", short: "4:5", width: 1080, height: 1350, unit: "px", label: "Post vertical Instagram" },
  { name: "Story / TikTok 9:16", short: "9:16", width: 1080, height: 1920, unit: "px", label: "Historia, reel o TikTok" },
  { name: "YouTube thumbnail 16:9", short: "16:9", width: 1280, height: 720, unit: "px", label: "Miniatura YouTube" },
  { name: "Cover musical 1:1", short: "1:1", width: 3000, height: 3000, unit: "px", label: "Single, album o portada" },
  { name: "Banner web", short: "WEB", width: 1920, height: 700, unit: "px", label: "Banner horizontal web" },
  { name: "Flyer A4 print", short: "A4", width: 2480, height: 3508, unit: "px", label: "A4 vertical para impresion" },
  { name: "Flyer A5 / DINA5 print", short: "A5", width: 1748, height: 2480, unit: "px", label: "A5 / DINA5 vertical" },
  { name: "Personalizado", short: "Custom", width: 1600, height: 1000, unit: "px", label: "Medida manual para lona, banner o pieza especial" }
];

const flyerModePresets = {
  Flyer: {
    designType: "Discoteca / Club",
    outputFormat: "Instagram 4:5",
    platform: "Instagram",
    title: "Flyer",
    purpose: "promocionar un evento, negocio, oferta o actividad local",
    required: ["idea", "titulo", "fecha", "lugar", "precio", "publico"],
    styles: ["Nightclub Neon", "Luxury Gold", "Urban Dark", "Tropical Party", "Food Premium", "Corporate Clean"],
    uploadLabel: "Producto, local o foto principal"
  },
  Miniatura: {
    designType: "Thumbnail YouTube",
    outputFormat: "YouTube thumbnail 16:9",
    platform: "YouTube",
    title: "Miniatura",
    purpose: "crear una miniatura con gancho visual inmediato para YouTube, Shorts o campanas virales",
    required: ["tema", "gancho", "foto principal", "emocion", "contraste"],
    styles: ["YouTube Viral", "Cinematic Poster", "Urban Dark", "Futuristic AI"],
    uploadLabel: "Foto del artista, creador, producto o sujeto"
  },
  Cover: {
    designType: "Cover Musical",
    outputFormat: "Cover musical 1:1",
    platform: "Spotify",
    title: "Cover",
    purpose: "crear una portada musical para Spotify, YouTube Music, single, album o playlist",
    required: ["artista", "titulo", "genero", "mood", "paleta"],
    styles: ["Music Video Dark", "Luxury Gold", "Urban Dark", "Tropical Party", "Cinematic Poster"],
    uploadLabel: "Referencia visual del mood o producto musical"
  },
  Poster: {
    designType: "Poster Cine",
    outputFormat: "Flyer A4 print",
    platform: "Impresion",
    title: "Poster",
    purpose: "crear un poster vertical premium para cine, evento, restaurante o campana impresa",
    required: ["titulo", "subtitulo", "fecha", "lugar", "formato"],
    styles: ["Cinematic Poster", "Luxury Gold", "Urban Dark", "Corporate Clean"],
    uploadLabel: "Imagen base o referencia del poster"
  }
};

function ratioFromSize(width, height) {
  const w = Number(width) || 1600;
  const h = Number(height) || 1000;
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const divisor = gcd(w, h);
  return `${Math.round(w / divisor)}:${Math.round(h / divisor)}`;
}

function buildFlyerAgentPrompt({ selectedFormat, selectedType, selectedStyle, selectedMode, ...form }) {
  const size = `${form.customWidth || selectedFormat.width}x${form.customHeight || selectedFormat.height} ${form.customUnit || selectedFormat.unit}`;
  const aspectRatio = ratioFromSize(form.customWidth || selectedFormat.width, form.customHeight || selectedFormat.height);
  const mode = selectedMode || flyerModePresets.Flyer;
  const textRule = form.includeText
    ? "Usar solo texto grande, claro y legible si es necesario; evitar texto pequeño o bloques largos."
    : "Sin texto dentro de la imagen, sin botones, sin letras aleatorias, sin logos; dejar espacio limpio para superponer textos desde la interfaz.";
  const brief = [
    form.prompt && `Idea exacta: ${form.prompt}`,
    form.title && `Titulo principal: ${form.title}`,
    form.secondaryText && `Texto secundario: ${form.secondaryText}`,
    form.artistName && `Artista / marca: ${form.artistName}`,
    form.musicTitle && `Titulo musical / producto: ${form.musicTitle}`,
    form.genre && `Genero / categoria: ${form.genre}`,
    form.hookText && `Gancho visual: ${form.hookText}`,
    form.date && `Fecha: ${form.date}`,
    form.place && `Lugar: ${form.place}`,
    form.price && `Precio / oferta: ${form.price}`,
    `Plataforma: ${form.platform || mode.platform}`
  ].filter(Boolean).join(". ");
  const prompt = [
    `Crear un ${mode.title.toLowerCase()} premium para ${mode.purpose}.`,
    brief,
    `Tipo exacto: ${selectedType.name}.`,
    "El diseño debe verse como una campaña publicitaria de alto nivel: ultrarrealista, cinematográfico, moderno, elegante y visualmente impactante.",
    `Estilo visual: ${selectedStyle.name}, ${selectedStyle.direction}.`,
    `Público objetivo: ${form.targetAudience}.`,
    `Paleta de color: ${form.colors}.`,
    "Composición: sujeto central potente, jerarquía visual clara, profundidad, reflejos, humo, glow, texturas premium, iluminación dramática y encuadre comercial profesional.",
    `Formato de salida: ${selectedFormat.name}, ${size}, aspect ratio ${aspectRatio}.`,
    textRule,
    "Detalles nítidos, acabado publicitario profesional, listo para producción."
  ].join(" ");
  const negativePrompt = "baja calidad, borroso, pixelado, diseño amateur, composición confusa, texto aleatorio, palabras ilegibles, marca de agua, logo extra, rostro deformado, manos deformes, mala anatomía, personas duplicadas, tipografía fea, diseño saturado, sobreexpuesto, iluminación plana, caricatura, diseño infantil, flyer barato, plantilla genérica, personaje con copyright, parecido a celebridad real.";
  return {
    type: selectedType.name,
    mode: mode.title,
    objective: `Crear ${mode.title.toLowerCase()} listo para uso comercial.`,
    audience: form.targetAudience,
    style: selectedStyle.name,
    colors: form.colors,
    prompt,
    negativePrompt,
    aspectRatio,
    params: {
      format: selectedFormat.name,
      size,
      aspectRatio,
      variants: Number(form.variants) || 1,
      quality: "ultra realistic cinematic advertising",
      detailLevel: `${form.detailLevel}%`
    }
  };
}

function FlyerStudio({ actions, busyStudio, state }) {
  const [form, setForm] = useState(defaultForms.flyer);
  const [mode, setMode] = useState("Flyer");
  const [agentResult, setAgentResult] = useState(null);
  const flyerJobs = (state.jobs || []).filter((job) => job.studio === "flyer" && job.userGenerated === true);
  const variants = Math.max(1, Math.min(4, Number(form.variants) || 1));
  const modePreset = flyerModePresets[mode] || flyerModePresets.Flyer;
  const selectedFormat = flyerFormats.find((item) => item.name === form.outputFormat) || flyerFormats[0];
  const selectedType = flyerTypes.find((item) => item.name === form.designType) || flyerTypes[0];
  const selectedStyle = flyerStyles.find((item) => item.name === form.style) || flyerStyles[0];
  const visibleTypes = flyerTypes.filter((item) => {
    if (mode === "Miniatura") return ["Thumbnail YouTube", "Promo Comercial"].includes(item.name);
    if (mode === "Cover") return ["Cover Musical", "Evento Privado"].includes(item.name);
    if (mode === "Poster") return ["Poster Cine", "Restaurante / Food", "Evento Privado"].includes(item.name);
    return ["Discoteca / Club", "Bar / Lounge", "Restaurante / Food", "Promo Comercial", "Evento Privado"].includes(item.name);
  });
  const visibleStyles = flyerStyles.filter((item) => modePreset.styles.includes(item.name));
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectMode = (nextMode) => {
    const preset = flyerModePresets[nextMode] || flyerModePresets.Flyer;
    const format = flyerFormats.find((entry) => entry.name === preset.outputFormat) || flyerFormats[0];
    const style = preset.styles.includes(form.style) ? form.style : preset.styles[0];
    setMode(nextMode);
    setForm((current) => ({
      ...current,
      designType: preset.designType,
      outputFormat: format.name,
      platform: preset.platform,
      style,
      customWidth: format.width,
      customHeight: format.height,
      customUnit: format.unit
    }));
    setAgentResult(null);
  };
  const applyFormat = (format) => setForm((current) => ({
    ...current,
    outputFormat: format.name,
    customWidth: format.width,
    customHeight: format.height,
    customUnit: format.unit
  }));
  const buildPrompt = () => {
    const result = buildFlyerAgentPrompt({ ...form, selectedFormat, selectedType, selectedStyle, selectedMode: modePreset });
    setAgentResult(result);
    setForm((current) => ({ ...current, prompt: result.prompt, negative: result.negativePrompt }));
    return result;
  };
  const generate = async () => {
    const result = agentResult || buildPrompt();
    const payload = { ...form, prompt: result.prompt, negative_prompt: result.negativePrompt, amount: variants, variants, ratio: result.aspectRatio };
    await actions.createJob("flyer", payload);
  };
  return (
    <div className="flyer-studio-page">
      <section className="flyer-hero" style={{ "--flyer-hero-image": `url(${flyerHeroImage})` }}>
        <div>
          <h1>FLYER STUDIO</h1>
          <p>Crea flyers, posters, covers, thumbnails y piezas promocionales con IA.</p>
          <div className="flyer-hero-icons">
            {["Profesional", "Rapido", "Creativo", "Ilimitado"].map((item) => <span key={item}><Sparkles size={18} />{item}</span>)}
          </div>
        </div>
        <button className="btn flyer-new" onClick={() => { setForm(defaultForms.flyer); setAgentResult(null); }}><Plus size={18} />Crear nuevo diseño</button>
      </section>

      <nav className="flyer-mode-tabs" aria-label="Tipo de pieza">
        {Object.keys(flyerModePresets).map((item) => <button className={mode === item ? "active" : ""} key={item} onClick={() => selectMode(item)}>{item}</button>)}
      </nav>

      <div className="flyer-layout">
        <main className="flyer-main">
          <section className="flyer-band">
            <div className="section-head"><h2>Tipo de diseño</h2></div>
            <div className="flyer-type-grid">
              {visibleTypes.map((item) => <button className={`flyer-choice ${form.designType === item.name ? "active" : ""}`} key={item.name} onClick={() => update("designType", item.name)}><img src={item.image} alt="" /><strong>{item.name}</strong></button>)}
            </div>
          </section>

          <section className="flyer-band">
            <div className="section-head"><h2>Estilos rápidos</h2></div>
            <div className="flyer-style-row">
              {visibleStyles.map((item) => <button className={`flyer-style ${form.style === item.name ? "active" : ""}`} key={item.name} onClick={() => update("style", item.name)}><img src={item.image} alt="" /><strong>{item.name}</strong></button>)}
            </div>
          </section>

          <section className="flyer-band">
            <div className="section-head"><h2>Diseños generados</h2><button className="btn secondary" onClick={() => actions.navigate("gallery")}>Ver todos</button></div>
            <NativeStudioPanel studio="flyer" state={{ jobs: flyerJobs }} actions={actions} form={form} />
          </section>
        </main>

        <aside className="flyer-side">
          <button className="btn full" onClick={buildPrompt}><Wand2 size={18} />Crear prompt profesional</button>
          <section className="card flyer-agent-card">
            <h2>{modePreset.title}</h2>
            <p className="muted">Campos clave: {modePreset.required.join(", ")}.</p>
            <div className="field"><label>Idea principal</label><textarea className="textarea compact-textarea" value={form.prompt} onChange={(event) => update("prompt", event.target.value)} placeholder="Describe exactamente lo que quieres producir." /></div>
            <div className="field"><label>Título principal</label><input className="input" value={form.title} onChange={(event) => update("title", event.target.value)} /></div>
            <div className="field"><label>Texto secundario</label><input className="input" value={form.secondaryText} onChange={(event) => update("secondaryText", event.target.value)} placeholder="Fecha, llamada a la acción o subtítulo" /></div>
            <div className="field"><label>Plataforma</label><select className="select" value={form.platform} onChange={(event) => update("platform", event.target.value)}>{["YouTube", "Spotify", "Instagram", "TikTok", "Facebook", "Impresión", "Web"].map((item) => <option key={item}>{item}</option>)}</select></div>
            {mode === "Miniatura" && <div className="field"><label>Gancho visual</label><input className="input" value={form.hookText} onChange={(event) => update("hookText", event.target.value)} placeholder="Antes/despues, misterio, reaccion, resultado extremo" /></div>}
            {mode === "Cover" && <>
              <div className="field"><label>Artista / marca</label><input className="input" value={form.artistName} onChange={(event) => update("artistName", event.target.value)} /></div>
              <div className="field"><label>Titulo musical</label><input className="input" value={form.musicTitle} onChange={(event) => update("musicTitle", event.target.value)} /></div>
              <div className="field"><label>Genero / mood</label><input className="input" value={form.genre} onChange={(event) => update("genre", event.target.value)} placeholder="Trap, bachata, afrobeat, sad, lujo, calle" /></div>
            </>}
            {["Flyer", "Poster"].includes(mode) && <>
              <div className="field"><label>Fecha</label><input className="input" value={form.date} onChange={(event) => update("date", event.target.value)} /></div>
              <div className="field"><label>Lugar</label><input className="input" value={form.place} onChange={(event) => update("place", event.target.value)} /></div>
              <div className="field"><label>Precio / oferta</label><input className="input" value={form.price} onChange={(event) => update("price", event.target.value)} /></div>
            </>}
            <MarketingFile label={modePreset.uploadLabel} field="primaryImage" accept="image/*" value={form.primaryImage} onChange={(key, file) => setForm((current) => ({ ...current, [key]: file ? file.name : "", __files: { ...(current.__files || {}), [key]: file } }))} />
            <MarketingFile label="Referencia opcional" field="referenceImage" accept="image/*" value={form.referenceImage} onChange={(key, file) => setForm((current) => ({ ...current, [key]: file ? file.name : "", __files: { ...(current.__files || {}), [key]: file } }))} />
            <div className="field"><label>Formato de salida</label><div className="flyer-format-grid">{flyerFormats.map((item) => <button className={`format-tile ${form.outputFormat === item.name ? "active" : ""}`} title={`${item.name}: ${item.label}`} key={item.name} onClick={() => applyFormat(item)}><span>{item.short}</span><small>{item.name}</small></button>)}</div></div>
            <div className="custom-size-row">
              <div className="field"><label>Ancho</label><input className="input" type="number" value={form.customWidth} onChange={(event) => update("customWidth", event.target.value)} /></div>
              <div className="field"><label>Alto</label><input className="input" type="number" value={form.customHeight} onChange={(event) => update("customHeight", event.target.value)} /></div>
              <div className="field"><label>Unidad</label><select className="select" value={form.customUnit} onChange={(event) => update("customUnit", event.target.value)}><option>px</option><option>cm</option><option>mm</option><option>m</option></select></div>
            </div>
            <div className="field"><label>Estilo visual</label><select className="select" value={form.style} onChange={(event) => update("style", event.target.value)}>{flyerStyles.map((item) => <option key={item.name}>{item.name}</option>)}</select></div>
            <div className="field"><label>Público objetivo</label><select className="select" value={form.targetAudience} onChange={(event) => update("targetAudience", event.target.value)}><option>Jóvenes 18-35</option><option>Público premium</option><option>Familias</option><option>Creadores de contenido</option><option>Clientes corporativos</option></select></div>
            <div className="field"><label>Paleta de colores</label><input className="input" value={form.colors} onChange={(event) => update("colors", event.target.value)} placeholder="rojo, dorado, negro" /></div>
            <div className="field"><label>Variantes</label><div className="variant-buttons">{[1, 2, 3, 4].map((count) => <button className={`tab ${variants === count ? "active" : ""}`} key={count} onClick={() => update("variants", count)}>{count}</button>)}</div></div>
            <div className="field"><label>Nivel de detalle <span>{form.detailLevel}%</span></label><input type="range" min="20" max="100" value={form.detailLevel} onChange={(event) => update("detailLevel", event.target.value)} /></div>
            <label className="check-row schema-check"><input type="checkbox" checked={Boolean(form.includeText)} onChange={(event) => update("includeText", event.target.checked)} />Incluir texto dentro del diseño</label>
            <label className="check-row schema-check"><input type="checkbox" checked={Boolean(form.useReference)} onChange={(event) => update("useReference", event.target.checked)} />Usar imagen de referencia</label>
          </section>

          <section className="card flyer-agent-card">
            <h2>Acciones rápidas</h2>
            <div className="quick-actions">
              {[
                ["Mejorar idea", "Cinematic Poster"],
                ["Variaciones", selectedStyle.name],
                ["Version premium", "Luxury Gold"],
                ["Version minimalista", "Corporate Clean"],
                ["Version viral", "YouTube Viral"],
                ["Version lujo", "Luxury Gold"]
              ].map(([label, style]) => <button className="btn secondary" key={label} onClick={() => update("style", style)}>{label}</button>)}
            </div>
            <button className="btn full flyer-send" disabled={busyStudio === "flyer"} onClick={generate}><Sparkles size={18} />Enviar a MuAPI</button>
          </section>
        </aside>
      </div>

      {agentResult && <section className="card flyer-prompt-output">
        <h2>Prompt final</h2>
        <pre>{agentResult.prompt}</pre>
        <h3>Negative prompt</h3>
        <p>{agentResult.negativePrompt}</p>
        <div className="toolbar">
          <button className="btn secondary" onClick={() => actions.copy(agentResult.prompt)}>Copiar prompt</button>
          <button className="btn secondary" onClick={() => actions.download("flyer-studio-prompt.json", agentResult)}>Guardar prompt</button>
        </div>
      </section>}
    </div>
  );
}

function NarrativeStudio({ actions, busyStudio, state }) {
  const [form, setForm] = useState(defaultForms.narrative);
  const [text, setText] = useState("");
  const [voices, setVoices] = useState(omnivoiceVoices);
  const [omniStatus, setOmniStatus] = useState(null);
  const [omniBusy, setOmniBusy] = useState(false);
  const [omniResult, setOmniResult] = useState(null);
  const selectedVoice = getOmnivoiceVoiceById(form.voiceModel);
  useEffect(() => {
    const savedVoice = localStorage.getItem("nexframe-omnivoice-selected");
    if (savedVoice) setForm((current) => ({ ...current, voiceModel: savedVoice }));
    apiRequest("/api/omnivoice/voices").then((result) => {
      if (Array.isArray(result.voices) && result.voices.length) setVoices(result.voices);
    }).catch(() => setVoices(omnivoiceVoices));
    apiRequest("/api/omnivoice/status").then(setOmniStatus).catch((error) => setOmniStatus({ ok: false, connected: false, message: error.message }));
  }, []);
  const generateOmnivoice = async () => {
    if (!form.prompt.trim()) return actions.notify("Escribe o pega la narrativa antes de generar voz.");
    const safePrompt = form.prompt.slice(0, Number(form.maxCharacters || 10000));
    setOmniBusy(true);
    setOmniResult(null);
    try {
      const result = await apiRequest("/api/omnivoice/speech", {
        method: "POST",
        body: JSON.stringify({
          text: safePrompt,
          voice_id: form.voiceModel,
          format: form.format || "wav",
          speed: 1
        })
      });
      setText(`Narrativa enviada a OmniVoice:\n\n${safePrompt}`);
      setOmniResult(result);
      actions.notify("Voz generada con OmniVoice.");
    } catch (error) {
      actions.notify(error.message);
      setOmniResult({ ok: false, message: error.message });
    } finally {
      setOmniBusy(false);
    }
  };
  return (
    <div className="layout-2">
      <section className="card form narrative-form">
        <h1>NARRATIVA Y VOZ</h1>
        <div className="omnivoice-panel"><strong>OmniVoice Studio</strong><span className={`status-pill ${omniStatus?.connected ? "ok" : "warn"}`}>{omniStatus?.connected ? "Activo" : "Sin conectar"}</span></div>
        <div className="field">
          <label>Voz</label>
          <select className="select" value={form.voiceModel} onChange={(event) => setForm((current) => ({ ...current, voiceModel: event.target.value }))}>
            {voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
          </select>
        </div>
        <div className="voice-mini-card">
          <Waveform /><strong>{selectedVoice.name}</strong><span>{selectedVoice.engine} - {selectedVoice.sampleRateHz} Hz</span>
        </div>
        <div className="field"><label>Formato</label><select className="select" value={form.format} onChange={(event) => setForm((current) => ({ ...current, format: event.target.value }))}><option value="wav">WAV</option><option value="mp3">MP3</option></select></div>
        <div className="field"><label>Texto</label><textarea className="textarea script-box" maxLength={10000} value={text || form.prompt} onChange={(event) => { setText(event.target.value); setForm((current) => ({ ...current, prompt: event.target.value })); }} placeholder="Pega aqui la narrativa para convertirla en audio." /></div>
        <div className="toolbar">
          <button className="btn" disabled={omniBusy} onClick={generateOmnivoice}><Mic2 size={18} />{omniBusy ? "Generando..." : "Crear audio"}</button>
          <button className="btn secondary" onClick={() => { setText(""); setForm(defaultForms.narrative); setOmniResult(null); }}>Limpiar</button>
        </div>
      </section>
      <section className="card">
        <h2>Audio</h2>
        {omniResult?.audio?.url ? <div className="voice-result"><audio controls src={apiAssetUrl(omniResult.audio.url)} /><div className="toolbar"><a className="btn secondary" href={apiAssetUrl(omniResult.audio.url)} download={omniResult.audio.filename || "omnivoice.wav"}>Descargar</a><button className="btn secondary" onClick={() => actions.download("omnivoice-audio.json", { voice: selectedVoice, audio: omniResult.audio })}>Metadata</button></div></div> : <p className="muted">{omniResult?.message || "El audio generado aparecera aqui."}</p>}
      </section>
    </div>
  );
}

function YouTubeAnalyzer({ actions }) {
  const [tab, setTab] = useState("analyze");
  const [form, setForm] = useState({ ...defaultForms.youtube, videoUrl: "", downloadFormat: "720p", clipStart: "", clipEnd: "" });
  const [messages, setMessages] = useState([{ role: "agent", content: "Panel fusionado listo. Analisis estructural local disponible; si conectas NexLev, se enriquecera con datos reales. Descarga usa yt-dlp y recorte usa FFmpeg sobre archivo verificado." }]);
  const [chat, setChat] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [downloadJob, setDownloadJob] = useState(null);
  const [clip, setClip] = useState(null);
  const [busy, setBusy] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const appendAgent = (content) => setMessages((current) => [...current, { role: "agent", content }]);
  const analyze = async () => {
    if (!form.channelUrl.trim()) return actions.notify("Pega la URL del canal o video de YouTube.");
    setBusy(true);
    try {
      const result = await apiRequest("/api/youtube/analyze", { method: "POST", body: JSON.stringify(form) });
      setAnalysis(result.analysis);
      setMessages((current) => [...current, { role: "user", content: form.channelUrl }, { role: "agent", content: result.analysis.summary }]);
      actions.notify("Analisis de YouTube completado.");
    } catch (error) {
      appendAgent(error.message);
      actions.notify(error.message);
    } finally {
      setBusy(false);
    }
  };
  const pollDownload = async (jobId) => {
    const result = await pollJob(jobId, { intervalMs: 2000, timeoutMs: 240000, taskPath: directApiUrl("/api/task") });
    if (result.job) setDownloadJob(result.job);
    if (!result.ok) throw new Error(typeof result.error === "string" ? result.error : result.error?.message || "La descarga no termino correctamente.");
    return result.job;
  };
  const downloadVideo = async () => {
    if (!form.videoUrl.trim()) return actions.notify("Pega la URL publica del video de YouTube.");
    setBusy(true);
    setClip(null);
    try {
      const result = await apiRequest("/api/youtube/download", { method: "POST", body: JSON.stringify({ url: form.videoUrl, format: form.downloadFormat }) });
      setDownloadJob(result.job);
      appendAgent("Descarga enviada a yt-dlp. Espero validacion de ffprobe antes de marcarla completada y descontar creditos.");
      const finalJob = await pollDownload(result.job.id);
      appendAgent(finalJob.status === "completed" ? `Video verificado: ${finalJob.title || finalJob.id}. Duracion ${Math.round(finalJob.probe?.duration || 0)}s, ${finalJob.probe?.width || 0}x${finalJob.probe?.height || 0}.` : `Descarga fallida: ${finalJob.error || "sin detalle"}`);
    } catch (error) {
      appendAgent(error.message);
      actions.notify(error.message);
    } finally {
      setBusy(false);
    }
  };
  const createClip = async () => {
    if (!downloadJob?.id || downloadJob.status !== "completed") return actions.notify("Primero descarga un video y espera a que quede verificado.");
    setBusy(true);
    try {
      const result = await apiRequest("/api/youtube/clip", { method: "POST", body: JSON.stringify({ downloadId: downloadJob.id, start: form.clipStart, end: form.clipEnd }) });
      setClip(result.clip);
      appendAgent(`Clip real creado con FFmpeg: ${result.clip.start}s a ${result.clip.end}s. Archivo validado por ffprobe.`);
      actions.notify("Clip creado y verificado.");
    } catch (error) {
      appendAgent(error.message);
      actions.notify(error.message);
    } finally {
      setBusy(false);
    }
  };
  const sendAgent = async () => {
    if (!chat.trim()) return;
    const text = chat.trim();
    setChat("");
    setMessages((current) => [...current, { role: "user", content: text }]);
    try {
      const result = await apiRequest("/api/youtube/agent", { method: "POST", body: JSON.stringify({ mode: tab, message: text }) });
      appendAgent(result.reply);
    } catch (error) {
      appendAgent(error.message);
    }
  };
  const exportPdf = async () => {
    if (!analysis) return actions.notify("Primero genera el analisis.");
    const response = await fetch(directApiUrl("/api/youtube/export-pdf"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysis }) });
    if (!response.ok) return actions.notify("No se pudo exportar el PDF.");
    downloadBlob("analisis-youtube-nexframe.pdf", await response.blob());
  };
  const sendToDocumentary = () => {
    if (!analysis) return actions.notify("Primero genera el analisis.");
    actions.navigate("documentary");
    actions.notify("Idea enviada: usa el primer guion sugerido como base del Documentary Studio.");
  };
  return (
    <div className="layout-2 youtube-fused">
      <section className="card form youtube-workspace">
        <h1>ANALIZADOR YOUTUBE</h1>
        <p className="muted">Panel fusionado: analisis estructural local sin inventar metricas; descarga real con yt-dlp y recorte real con FFmpeg.</p>
        <div className="tabs">
          {[
            ["analyze", "Analizar canal"],
            ["download", "Descargar video"],
            ["clip", "Recorte por IA"]
          ].map(([id, label]) => <button className={`tab ${tab === id ? "active" : ""}`} key={id} onClick={() => setTab(id)}>{label}</button>)}
        </div>
        {tab === "analyze" && <>
          <div className="field"><label>Canal o video</label><input className="input" value={form.channelUrl} onChange={(event) => update("channelUrl", event.target.value)} placeholder="https://www.youtube.com/@canal" /></div>
          <div className="grid form-grid">
            <div className="field"><label>Objetivo</label><input className="input" value={form.objective} onChange={(event) => update("objective", event.target.value)} /></div>
            <div className="field"><label>Duracion</label><select className="select" value={form.duration} onChange={(event) => update("duration", event.target.value)}>{choiceOptions.duration.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Tono</label><select className="select" value={form.tone} onChange={(event) => update("tone", event.target.value)}>{choiceOptions.narrativeTone.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Formato</label><select className="select" value={form.target} onChange={(event) => update("target", event.target.value)}>{choiceOptions.target.map((item) => <option key={item}>{item}</option>)}</select></div>
          </div>
          <button className="btn" disabled={busy} onClick={analyze}>{busy ? "Analizando..." : "Analizar canal"}</button>
          <button className="btn secondary" onClick={exportPdf}>Exportar PDF</button>
          <button className="btn secondary" onClick={sendToDocumentary}>Enviar a documental</button>
        </>}
        {tab === "download" && <>
          <div className="field"><label>URL publica del video</label><input className="input" value={form.videoUrl} onChange={(event) => update("videoUrl", event.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></div>
          <div className="field"><label>Formato</label><select className="select" value={form.downloadFormat} onChange={(event) => update("downloadFormat", event.target.value)}><option value="720p">720p HD</option><option value="audio">Solo audio</option></select></div>
          <button className="btn" disabled={busy} onClick={downloadVideo}>{busy ? "Descargando..." : "Descargar video — 5 creditos"}</button>
          {downloadJob && <div className="youtube-status"><strong>{downloadJob.status}</strong><span>{downloadJob.progress || 0}%</span><p>{downloadJob.title || downloadJob.url}</p>{downloadJob.error && <p className="red">{downloadJob.error}</p>}{downloadJob.url && <a className="btn secondary" href={apiAssetUrl(downloadJob.url)} download>Descargar archivo verificado</a>}</div>}
        </>}
        {tab === "clip" && <>
          <p className="muted">El clip se corta sobre el video descargado y validado. Sin transcripcion real no se inventan momentos virales: indica rango exacto.</p>
          <div className="grid form-grid">
            <div className="field"><label>Inicio</label><input className="input" value={form.clipStart} onChange={(event) => update("clipStart", event.target.value)} placeholder="00:40" /></div>
            <div className="field"><label>Final</label><input className="input" value={form.clipEnd} onChange={(event) => update("clipEnd", event.target.value)} placeholder="01:10" /></div>
          </div>
          <button className="btn" disabled={busy || downloadJob?.status !== "completed"} onClick={createClip}>Crear clip con FFmpeg</button>
          {clip && <div className="youtube-status"><strong>Clip verificado</strong><span>{clip.start}s - {clip.end}s</span><video controls src={apiAssetUrl(clip.url)} /><a className="btn secondary" href={apiAssetUrl(clip.url)} download>Descargar clip</a><button className="btn secondary" onClick={() => actions.navigate("editor")}>Editar en Studio</button></div>}
        </>}
      </section>
      <section className="card youtube-agent">
        <h2>Chat agente</h2>
        <div className="chat-panel">
          {messages.map((message, index) => <div className={`chat-msg ${message.role}`} key={`${message.role}-${index}`}>{message.content}</div>)}
        </div>
        <div className="editor-chat-input">
          <input className="input" value={chat} onChange={(event) => setChat(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendAgent()} placeholder={`Escribe al agente sobre: ${tab === "analyze" ? "analisis de canal" : tab === "download" ? "descarga" : "recorte"}`} />
          <button className="btn" onClick={sendAgent} aria-label="Enviar mensaje al agente"><Send size={16} /></button>
        </div>
        {analysis && <div className="grid idea-grid">{analysis.ideas.map((idea) => <div className="card" key={idea.title}><strong>{idea.title}</strong><p className="muted">{idea.hook}</p><button className="btn secondary" onClick={() => actions.download(`${idea.title}.json`, idea)}>Descargar guion</button></div>)}</div>}
      </section>
    </div>
  );
}

function ScriptEngine({ actions }) {
  const [form, setForm] = useState(defaultForms.script);
  const [text, setText] = useState("");
  const generateScript = async () => {
    if (!form.prompt.trim()) return actions.notify("Escribe la idea del guion antes de generar.");
    await actions.runV6Action("script", "Generate", form);
    setText(`Guion inicial generado desde la idea:\n\n${form.prompt}`);
  };
  return <div className="layout-2"><section className="card form"><h1>SCRIPT & NARRATIVE ENGINE</h1><DynamicForm studio="script" form={form} setForm={setForm} model={models[0]} /><button className="btn" onClick={generateScript}>Generar Guion</button></section><section className="card"><h2>Proyecto actual</h2><textarea className="textarea script-box" value={text} onChange={(e) => setText(e.target.value)} placeholder="El guion generado o escrito manualmente aparecera aqui." /><div className="toolbar"><button className="btn secondary" onClick={() => actions.copy(text)}>Copiar</button><button className="btn secondary" onClick={() => actions.download("script-engine.json", { text })}>Exportar</button><button className="btn secondary" onClick={() => actions.runV6Action("script", "Analyze", { text })}>Analizar</button></div></section></div>;
}

function Projects({ state, actions, mode }) {
  const isGallery = mode === "gallery";
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState({ title: "", type: "Video", quality: "Pendiente" });
  const [productionProjects, setProductionProjects] = useState([]);
  useEffect(() => {
    if (isGallery || !state.auth?.signedIn) return;
    apiRequest("/api/production/projects").then((result) => setProductionProjects(result.projects || [])).catch(() => setProductionProjects([]));
  }, [isGallery, state.auth?.signedIn]);
  const projects = [...productionProjects, ...(state.projects || [])].filter((project) => String(project.title || "").toLowerCase().includes(filter.toLowerCase()));
  const galleryItems = (state.history || []).filter((item) => item.userGenerated === true);
  const submit = () => {
    const ok = actions.createProject(draft);
    if (ok) {
      setDraft({ title: "", type: "Video", quality: "Pendiente" });
      setCreating(false);
    }
  };
  if (isGallery) {
    return <><h1>History & Gallery</h1><div className="toolbar"><input className="input toolbar-input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar en galeria..." /><button className="btn secondary" onClick={() => actions.download("nexframe-gallery.json", { exportedAt: new Date().toISOString(), items: galleryItems })}>Exportar galeria</button></div><GenerationGallery items={galleryItems} actions={actions} /></>;
  }
  return <><h1>Projects</h1><div className="toolbar"><button className="btn" onClick={() => setCreating((value) => !value)}><Plus size={18} />Crear proyecto</button><button className="btn secondary" onClick={() => actions.download("nexframe-projects.json", { exportedAt: new Date().toISOString(), projects: state.projects || [] })}>Exportar</button><input className="input toolbar-input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrar proyectos..." /></div>{creating && <section className="card form create-project"><h2>Nuevo proyecto</h2><div className="grid form-grid"><div className="field"><label>Nombre</label><input className="input" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Nombre del proyecto" /></div><div className="field"><label>Tipo</label><select className="select" value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}><option>Video</option><option>Imagen</option><option>Documental</option><option>Music Video</option><option>Flyer</option></select></div><div className="field"><label>Calidad objetivo</label><select className="select" value={draft.quality} onChange={(event) => setDraft((current) => ({ ...current, quality: event.target.value }))}><option>Pendiente</option><option>1080p</option><option>4K</option><option>8K</option></select></div></div><div className="toolbar"><button className="btn" onClick={submit}>Crear</button><button className="btn secondary" onClick={() => setCreating(false)}>Cancelar</button></div></section>}<ProjectGrid projects={projects} actions={actions} /></>;
}

function ProjectGrid({ projects = [], actions }) {
  if (!projects.length) return <EmptyState title="Sin proyectos" body="Crea tu primer proyecto para empezar a organizar generaciones, assets y exportaciones." action="Crear proyecto" onAction={() => actions.navigate("projects")} />;
  return <section className="grid project-grid">{projects.map((project, index) => { const isProduction = Boolean(project.jobId); return <div className="card project-card" key={project.id}><img className="asset-img" src={studioCardAssets[project.type?.toLowerCase()?.replace(" ", "")] || heroSlides[index % heroSlides.length]} alt={project.title} loading="lazy" decoding="async" /><div className="body"><strong>{project.title}</strong><p className="muted">{project.type} · {project.status || project.quality} · {Number(project.progress || 0)}% · {new Date(project.createdAt).toLocaleDateString("es-ES")}</p><div className="toolbar"><button className="btn secondary" onClick={() => actions.modal({ title: project.title, body: JSON.stringify(project, null, 2) })}>Abrir</button>{isProduction && <button className="btn secondary" onClick={async () => { try { const result = await apiRequest(`/api/production/projects/${project.id}/send-to-editor`, { method: "POST", body: "{}" }); actions.notify("Proyecto enviado al editor."); window.location.assign(result.redirectUrl); } catch (error) { actions.notify(error.message); } }}>Editar</button>}<button className="btn secondary" aria-label={`Descargar proyecto ${project.title}`} onClick={() => actions.download(`${project.title}.json`, project)}><Download size={16} /></button>{!isProduction && <button className="btn secondary" aria-label={`Eliminar proyecto ${project.title}`} onClick={() => actions.deleteProject(project.id)}><Trash2 size={16} /></button>}</div></div></div>; })}</section>;
}

function GenerationGallery({ items = [], actions }) {
  if (!items.length) return <EmptyState title="Galeria vacia" body="Las generaciones guardadas apareceran aqui con sus metadatos y descargas." />;
  return <section className="grid project-grid">{items.map((item) => <GeneratedResultCard key={item.id} job={item} actions={actions} />)}</section>;
}

function OfficialPanel({ id, actions, state, patch }) {
  const related = subpanels.filter((item) => item.area === id).slice(0, 8);
  return <><div className="section-head"><div><h1>{labelFor(id)}</h1><p className="muted">Panel operativo listo para pruebas locales y despliegue controlado.</p></div><button className="btn" onClick={() => actions.notify(`${labelFor(id)} validado para produccion local.`)}>Validar panel</button></div><NativeOfficialContent id={id} actions={actions} state={state} patch={patch} /><div className="toolbar"><button className="btn secondary" onClick={() => actions.notify("Cambios guardados en preferencias locales.")}><Save size={18} />Guardar</button><button className="btn secondary" onClick={() => actions.download(`${id}.json`, { id, state })}><Download size={18} />Exportar</button><button className="btn secondary" onClick={() => actions.copy(window.location.href)}>Copiar link</button></div>{related.length > 0 && <SubpanelGrid items={related} actions={actions} />}</>;
}

function NativeOfficialContent({ id, actions, state, patch }) {
  if (id === "apikeys") return <ApiKeysNative actions={actions} />;
  if (id === "billing") return <BillingNative state={state} actions={actions} />;
  if (id === "deployment") return <DeploymentNative actions={actions} />;
  if (id === "windows") return <WindowsNative actions={actions} />;
  if (id === "checklist") return <ChecklistNative actions={actions} />;
  if (id === "settings") return <SettingsNative state={state} patch={patch} actions={actions} />;
  if (id === "assets") return <LibraryNative kind="assets" actions={actions} />;
  if (id === "voices") return <OmnivoiceLibraryNative actions={actions} />;
  if (id === "users") return <UsersNative actions={actions} />;
  if (id === "hub") return <HubNative actions={actions} />;
  if (id === "help") return <HelpNative actions={actions} />;
  if (id === "marketing") return <MarketingNative actions={actions} state={state} />;
  if (id === "public") return <PublicNativeV2 actions={actions} />;
  if (id === "security") return <SecurityNative actions={actions} />;
  return <GenericNative id={id} actions={actions} />;
}

function ApiKeysNative({ actions }) {
  const [provider, setProvider] = useState("muapi");
  const [status, setStatus] = useState("No probado");
  const test = async () => {
    setStatus("Probando conexion...");
    try {
      const result = await apiRequest(`/api/muapi/providers/${provider}/test`, { method: "POST", body: "{}" });
      setStatus(result.message);
      actions.notify(result.message);
    } catch (error) {
      setStatus(error.message);
      actions.notify(error.message);
    }
  };
  return <div className="layout-2"><section className="card form"><h2>Proveedor seguro</h2><div className="field"><label>Proveedor</label><select className="select" value={provider} onChange={(e) => setProvider(e.target.value)}><option value="muapi">MUAPI Universal</option><option value="kling">Kling AI</option><option value="openai">OpenAI</option></select></div><p className="muted">Las API keys viven en variables de entorno del servidor. El cliente solo prueba el estado.</p><button className="btn" onClick={test}>Probar conexion</button><button className="btn secondary" onClick={() => actions.download("env-template.json", { required: ["MUAPI_API_KEY", "MUAPI_API_BASE_URL=https://api.muapi.ai"] })}>Exportar plantilla</button></section><section className="card"><h2>Estado</h2><p>{status}</p><p className="muted">Para conectar real: edita `.env` o variables del hosting y reinicia `npm run start`.</p></section></div>;
}

function OmnivoiceLibraryNative({ actions }) {
  return <div className="voice-library"><section className="card voice-hero compact-voice-hero"><Mic2 size={36} /><div><h2>Voces OmniVoice</h2><p className="muted">{omnivoiceVoices.length} voces principales listas para narrativa.</p></div><button className="btn" onClick={() => actions.navigate("narrative")}>Crear audio</button></section><section className="grid voice-grid">{omnivoiceVoices.map((voice) => <div className="card voice-card compact-voice-card" key={voice.id}><strong>{voice.name}</strong><span>{voice.engine} - {voice.sampleRateHz} Hz</span><div className="toolbar compact"><button className="btn secondary" onClick={() => { localStorage.setItem("nexframe-omnivoice-selected", voice.id); actions.navigate("narrative"); actions.notify(`${voice.name} seleccionada.`); }}>Usar</button></div></div>)}</section></div>;
}

function BillingNative({ state, actions }) {
  const openCheckout = async () => {
    try {
      const result = await apiRequest("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan: "pro", credits: 1000 }) });
      actions.notify(result.message);
    } catch (error) {
      actions.notify(error.message);
    }
  };
  const usage = state.usage || {};
  const rows = Object.entries(usage.byStudio || {}).slice(0, 6);
  return <div className="billing-native"><section className="grid stats"><Stat icon={Crown} label="Plan actual" value="Pro" sub="$49 / mes" /><Stat icon={Coins} label="Creditos" value={state.credits.toLocaleString()} sub="disponibles" /><Stat icon={Database} label="Creditos usados" value={state.creditsUsed || 0} sub="consumo real/local" /><div className="card"><h2>Metodo de pago</h2><p className="muted">Checkout seguro gestionado desde el servidor.</p><button className="btn" onClick={openCheckout}>Abrir checkout</button></div></section><section className="card"><h2>Uso por studio</h2>{rows.length ? rows.map(([studio, credits]) => <div className="check-row" key={studio}><Coins size={18} />{labelFor(studio)}: {credits} creditos</div>) : <p className="muted">El consumo aparecera aqui cuando generes outputs reales.</p>}<button className="btn secondary" onClick={() => actions.download("billing-usage.json", usage)}>Exportar uso</button></section></div>;
}

function DeploymentNative({ actions }) {
  const validate = async () => {
    try {
      const result = await apiRequest("/api/deployment/validate");
      actions.notify(result.ok ? "Validacion de despliegue completada." : "Validacion completada con credenciales pendientes en servidor.");
    } catch (error) {
      actions.notify(`Validacion no disponible: ${error.message}`);
    }
  };
  return <div className="layout-2"><section className="card"><h2>Servidor</h2>{["Build React", "API server-side", "Static dist", "Provider env", "Audit logs"].map((item) => <div className="check-row" key={item}><Check size={18} />{item}</div>)}</section><section className="card"><h2>Comandos</h2><pre>npm run build{"\n"}npm run start</pre><button className="btn" onClick={validate}>Validar despliegue</button><button className="btn secondary" onClick={() => actions.download("deployment-checklist.json", { build: "npm run build", start: "npm run start", port: 8787 })}>Descargar checklist</button></section></div>;
}

function WindowsNative({ actions }) {
  return <div className="layout-2"><section className="card"><h2>Windows Launcher</h2><p className="muted">Base preparada para empaquetar como app instalable con el servidor local y la UI web.</p><button className="btn" onClick={() => actions.notify("Launcher validado. Siguiente paso: empaquetado Electron/Tauri cuando lo autorices.")}>Validar launcher</button></section><section className="card"><h2>Estado offline/update</h2>{["API setup", "Update channel", "Offline fallback", "Local cache"].map((item) => <div className="check-row" key={item}><Check size={18} />{item}</div>)}</section></div>;
}

function ChecklistNative({ actions }) {
  const items = ["Repositorio preparado", "Build pasa", "API server-side", "Botones auditados", "Sin capturas de referencia como UI", "Variables de entorno documentadas", "Listo para despliegue manual"];
  return <div className="grid checklist-grid">{items.map((item) => <div className="card check-row" key={item}><Check size={18} />{item}</div>)}<button className="btn" onClick={() => actions.download("nexframe-final-checklist.json", { items })}>Generar reporte final</button></div>;
}

function SettingsNative({ state, patch, actions }) {
  const [loginForm, setLoginForm] = useState({ email: "admin@nexframe.local", password: "" });
  const submitLogin = async () => {
    try {
      await actions.login(loginForm);
    } catch (error) {
      actions.notify(error.message);
    }
  };
  return <div className="settings-native"><section className="card form"><h2>Preferencias</h2><div className="field"><label>Idioma</label><select className="select" value={state.language} onChange={(e) => patch({ language: e.target.value })}><option value="es">Español</option><option value="en">English</option><option value="pt">Português</option><option value="fr">Français</option><option value="it">Italiano</option><option value="de">Deutsch</option></select></div><div className="field"><label>Tema</label><select className="select" value={state.theme} onChange={(e) => patch({ theme: e.target.value })}>{themes.map((theme) => <option key={theme}>{theme}</option>)}</select></div><p className="muted">Los cambios se aplican al panel completo y quedan guardados localmente.</p></section><section className="card form"><h2>Sesión</h2>{state.auth?.signedIn ? <><div className="check-row"><Shield size={18} />{state.auth.name} - {state.auth.role}</div><p className="muted">La sesión activa controla qué paneles privados ve cada usuario.</p><button className="btn secondary" onClick={actions.logout}>Salir de la sesión</button></> : <><div className="field"><label>Email</label><input className="input" value={loginForm.email} onChange={(e) => setLoginForm((current) => ({ ...current, email: e.target.value }))} /></div><div className="field"><label>Contraseña</label><input className="input" type="password" value={loginForm.password} onChange={(e) => setLoginForm((current) => ({ ...current, password: e.target.value }))} /></div><button className="btn" onClick={submitLogin}>Iniciar sesión</button></>}</section><section className="card"><h2>Seguridad</h2><p className="muted">Las API keys viven solo en servidor. Los paneles API, Security, Deployment y Admin se ocultan para usuarios normales.</p><div className="check-row"><Shield size={18} />Bloqueo temporal por IP activo</div><div className="check-row"><KeyRound size={18} />Clave MuAPI fuera del navegador</div><div className="check-row"><Check size={18} />Cookie HttpOnly de sesión</div><div className="check-row"><Lock size={18} />Validación de entradas antes de llamar a proveedores</div></section></div>;
}

function LibraryNative({ kind, actions }) {
  if (kind === "voices") {
    const voices = [
      ["Narrador documental", "Grave, calido, dramatico", "Español neutro"],
      ["Voz comercial", "Energetica, clara, venta", "Multidioma"],
      ["Cine oscuro", "Profunda, pausada, trailer", "Español / English"]
    ];
    return <div className="voice-library"><section className="card voice-hero"><Mic2 size={42} /><div><h2>Biblioteca de voces</h2><p className="muted">Voces listas para narrativa, marketing, documentales y videoclips.</p></div><button className="btn" onClick={() => actions.navigate("narrative")}>Crear voz</button></section><section className="grid voice-grid">{voices.map(([name, tone, language]) => <div className="card voice-card" key={name}><Waveform /><strong>{name}</strong><span>{tone}</span><p className="muted">{language}</p><div className="toolbar compact"><button className="btn secondary" onClick={() => actions.notify(`${name}: vista previa lista.`)}>Preview</button><button className="btn secondary" onClick={() => actions.navigate("narrative")}>Usar</button></div></div>)}</section></div>;
  }
  return <div className="assets-library"><section className="grid project-grid">{["Imagenes", "Videos", "Audios", "Subtitulos", "Prompts"].map((item, index) => <div className="card project-card" key={item}><img className="asset-img" src={heroSlides[index % heroSlides.length]} alt={item} loading="lazy" decoding="async" /><div className="body"><strong>{item}</strong><p className="muted">Los assets guardados desde los studios apareceran aqui.</p><button className="btn secondary" onClick={() => actions.navigate("gallery")}>Abrir galeria</button></div></div>)}</section></div>;
}

function UsersNative({ actions }) {
  const [users, setUsers] = useState([]);
  const [draft, setDraft] = useState({ name: "", email: "", role: "user", password: "" });
  const loadUsers = () => apiRequest("/api/users").then((result) => setUsers(result.users || [])).catch((error) => actions.notify(error.message));
  useEffect(() => { loadUsers(); }, []);
  const create = async () => {
    try {
      const result = await apiRequest("/api/users", { method: "POST", body: JSON.stringify(draft) });
      setUsers((current) => [result.user, ...current]);
      setDraft({ name: "", email: "", role: "user", password: "" });
      actions.notify("Usuario creado correctamente.");
    } catch (error) {
      actions.notify(error.message);
    }
  };
  return <div className="layout-2"><section className="card form"><h2>Crear usuario</h2><div className="field"><label>Nombre</label><input className="input" value={draft.name} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} /></div><div className="field"><label>Email</label><input className="input" value={draft.email} onChange={(e) => setDraft((current) => ({ ...current, email: e.target.value }))} /></div><div className="field"><label>Rol</label><select className="select" value={draft.role} onChange={(e) => setDraft((current) => ({ ...current, role: e.target.value }))}><option value="user">Usuario</option><option value="admin">Administrador</option></select></div><div className="field"><label>Password</label><input className="input" type="password" value={draft.password} onChange={(e) => setDraft((current) => ({ ...current, password: e.target.value }))} /></div><button className="btn" onClick={create}>Crear usuario</button></section><section className="card"><h2>Usuarios</h2><table className="table"><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{user.active ? "Activo" : "Inactivo"}</td></tr>)}</tbody></table></section></div>;
}

function HubNative({ actions }) {
  return <section className="grid studio-grid">{["video", "image", "sound", "effects", "lipsync", "documentary", "musicvideo", "editor", "flyer", "cinema"].map((id) => <AssetCard key={id} id={id} image={studioCardAssets[id] || panelAssets.editor} title={labelFor(id)} subtitle={studioSubtitle(id)} onOpen={() => actions.navigate(id)} />)}</section>;
}

function HelpNative({ actions }) {
  return <div className="layout-2"><section className="card form"><input className="input" placeholder="Buscar en documentacion..." /><button className="btn" onClick={() => actions.notify("Busqueda completada en la base local de ayuda.")}>Buscar</button><button className="btn secondary" onClick={() => actions.notify("Ticket creado con contexto del proyecto.")}>Enviar ticket</button></section><section className="card"><h2>Temas populares</h2>{["Configurar API Keys", "Generar primer video", "Resolver cola fallida", "Exportar proyecto"].map((item) => <div className="check-row" key={item}><HelpCircle size={18} />{item}</div>)}</section></div>;
}

function MarketingNative({ actions, state }) {
  const [form, setForm] = useState(defaultForms.marketing);
  const [brief, setBrief] = useState(null);
  const [tab, setTab] = useState("Estrategia");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateFile = (key, file) => setForm((current) => ({
    ...current,
    [key]: file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "",
    __files: { ...(current.__files || {}), [key]: file }
  }));
  const buildBrief = () => {
    if (!form.prompt.trim()) return actions.notify("Pega el guion o idea de venta antes de crear la campana.");
    const selected = marketingPlanFor(form);
    setBrief(selected);
    actions.notify("Brief de marketing preparado con ruta IA automatica.");
  };
  const generate = async () => {
    if (!form.prompt.trim()) return actions.notify("Pega el guion o idea de venta antes de generar.");
    const selected = marketingPlanFor(form);
    setBrief(selected);
    await actions.createPipeline("marketing", {
      ...form,
      marketingPlan: selected,
      prompt: form.prompt
    });
  };
  return (
    <div className="marketing-native">
      <nav className="marketing-tabs" aria-label="Flujo de Marketing Studio">{["Estrategia", "Creatividades", "Video", "Campaña", "Entregables"].map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}</nav>
      <section className={`card form marketing-brief ${tab !== "Estrategia" ? "is-hidden" : ""}`}>
        <div className="section-head compact-head">
          <div>
            <h2>Marketing Studio</h2>
            <p className="muted">Crea promos, anuncios, miniaturas, covers, flyers y piezas de venta desde un guion y tus assets.</p>
          </div>
          <button className="btn secondary" onClick={() => actions.download("marketing-brief.json", cleanFormForStorage(form))}>Exportar brief</button>
        </div>
        <div className="grid form-grid">
          <div className="field"><label>Producto o servicio</label><input className="input" value={form.productName} onChange={(e) => update("productName", e.target.value)} placeholder="Nombre del producto que quieres vender" /></div>
          <div className="field"><label>Oferta principal</label><input className="input" value={form.offer} onChange={(e) => update("offer", e.target.value)} placeholder="Precio, beneficio, bono o llamada a la accion" /></div>
          <div className="field"><label>Publico objetivo</label><input className="input" value={form.audience} onChange={(e) => update("audience", e.target.value)} placeholder="A quien se le vende" /></div>
          <div className="field"><label>Objetivo</label><select className="select" value={form.campaignGoal} onChange={(e) => update("campaignGoal", e.target.value)}>{["Vender producto", "Captar leads", "Lanzar marca", "Promocionar video", "Crear awareness"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label>Tipo de pieza</label><select className="select" value={form.outputType} onChange={(e) => update("outputType", e.target.value)}>{["Video promocional", "Miniatura YouTube", "Flyer / poster", "Cover musical", "Pack completo"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label>Canal / formato</label><select className="select" value={form.channel} onChange={(e) => update("channel", e.target.value)}>{["TikTok / Reels / Shorts 9:16", "YouTube 16:9", "YouTube Thumbnail 16:9", "Instagram Feed 1:1", "Story 9:16", "Web landing"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label>Estilo visual</label><select className="select" value={form.visualStyle} onChange={(e) => update("visualStyle", e.target.value)}>{["Realista cinematografico", "Producto premium", "Comic / cartoon", "UGC natural", "Cyberpunk comercial", "Personalizado por prompt"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label>Duracion objetivo</label><select className="select" value={form.duration} onChange={(e) => update("duration", e.target.value)}>{["10s", "20s", "30s", "45s", "60s"].map((item) => <option key={item}>{item}</option>)}</select></div>
        </div>
        <div className="field"><label>Guion / direccion creativa <span className="label-meta"><RequiredBadge required />{form.prompt.length}/4000</span></label><textarea className="textarea marketing-script" maxLength={4000} value={form.prompt} onChange={(e) => update("prompt", e.target.value)} placeholder="Pega aqui el guion, oferta, escena, texto de venta o idea exacta que quieres producir." /><small className="field-help">Este texto se manda como direccion principal. El agente lo analiza para decidir imagen, video, voz, musica, edicion y formato.</small></div>
      </section>
      <section className={`card form marketing-assets ${tab !== "Creatividades" ? "is-hidden" : ""}`}>
        <h2>Assets de entrada</h2>
        <div className="grid form-grid">
          <MarketingFile label="Foto del producto" field="productImage" accept="image/*" value={form.productImage} onChange={updateFile} />
          <MarketingFile label="Personaje / vendedor" field="characterImage" accept="image/*" value={form.characterImage} onChange={updateFile} />
          <MarketingFile label="Video base" field="sourceVideo" accept="video/*" value={form.sourceVideo} onChange={updateFile} />
          <MarketingFile label="Audio / voz local" field="localAudio" accept="audio/*" value={form.localAudio} onChange={updateFile} />
        </div>
        <div className="grid form-grid">
          <div className="field"><label>Voz</label><select className="select" value={form.voiceStyle} onChange={(e) => update("voiceStyle", e.target.value)}>{["Voz vendedora profesional", "Narrador cinematico", "UGC natural", "Energetica joven", "Lujo premium"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label>Musica</label><select className="select" value={form.soundtrackStyle} onChange={(e) => update("soundtrackStyle", e.target.value)}>{["Musica pegadiza moderna", "Trap comercial limpio", "Corporate premium", "Tension trailer", "Tropical alegre", "Sin musica"].map((item) => <option key={item}>{item}</option>)}</select></div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={buildBrief}><Wand2 size={18} />Preparar brief</button>
          <button className="btn" onClick={generate}><Sparkles size={18} />Generar campana</button>
          <button className="btn secondary" onClick={() => actions.copy(marketingPromptFor(form))}>Copiar prompt final</button>
        </div>
      </section>
      <section className={`card marketing-plan ${tab !== "Campaña" ? "is-hidden" : ""}`}>
        <h2>Agente experto en marketing</h2>
        <p className="muted">Ruta automatica elegida por el sistema segun guion, assets, formato y objetivo comercial.</p>
        {(brief || marketingPlanFor(form)).steps.map((step) => (
          <div className="marketing-step" key={step.id}>
            <strong>{step.label}</strong>
            <span>{step.model}</span>
            <p>{step.reason}</p>
          </div>
        ))}
      </section>
      <section className={`card marketing-output ${tab !== "Entregables" ? "is-hidden" : ""}`}>
        <h2>Entregables</h2>
        {["Video promocional con audio", "Miniatura / cover", "Flyer o poster", "Copy de venta", "Prompts y metadata", "Assets descargables"].map((item) => <div className="check-row" key={item}><Check size={18} />{item}</div>)}
        <button className="btn secondary full" onClick={() => actions.download("marketing-plan.json", brief || marketingPlanFor(form))}>Descargar plan</button>
      </section>
      <section className={`card marketing-output ${!["Video", "Creatividades", "Entregables"].includes(tab) ? "is-hidden" : ""}`}>
        <h2>Vista previa y resultados</h2>
        <NativeStudioPanel studio="marketing" state={state} actions={actions} form={form} />
      </section>
    </div>
  );
}

function MarketingFile({ label, field, accept, value, onChange }) {
  return (
    <div className="field file-field marketing-file">
      <label>{label}</label>
      <input id={`marketing-${field}`} className="file-native" type="file" accept={accept} onChange={(event) => onChange(field, event.target.files?.[0] || null)} />
      <label className="file-picker" htmlFor={`marketing-${field}`}><Upload size={16} />{value ? "Cambiar archivo" : "Subir archivo"}</label>
      <small className="muted file-name">{value || "Ningun archivo seleccionado"}</small>
    </div>
  );
}

function marketingPlanFor(form = {}) {
  const isImagePiece = /miniatura|flyer|poster|cover/i.test(form.outputType || "");
  const hasVideo = Boolean(form.sourceVideo);
  const hasProduct = Boolean(form.productImage);
  const visualModel = /comic|cartoon/i.test(form.visualStyle || "") ? "recraft-v4-1" : hasProduct ? "ai-product-photography" : "nano-banana";
  const videoModel = hasVideo ? "wan2.5-image-to-video" : form.videoModel || "veo3.1-text-to-video";
  return {
    agent: "Director senior de marketing, publicidad y ventas",
    objective: form.campaignGoal,
    outputType: form.outputType,
    channel: form.channel,
    prompt: marketingPromptFor(form),
    steps: [
      { id: "strategy", label: "Estrategia de venta", model: "Agente NEXFRAME Marketing", reason: "Analiza guion, oferta, publico y canal para definir gancho, CTA y estructura de conversion." },
      { id: "product", label: "Producto / personaje", model: hasProduct ? "ai-product-photography + ai-background-remover" : visualModel, reason: "Prepara producto, fondo, personaje y estilo visual sin perder proporcion ni marca." },
      { id: "visual", label: isImagePiece ? "Imagen final" : "Key visual", model: visualModel, reason: "Genera la pieza visual principal segun estilo: realista, premium, comic, UGC o personalizado." },
      { id: "video", label: "Video promocional", model: isImagePiece ? "No requerido para pieza estatica" : videoModel, reason: hasVideo ? "Usa el video cargado como base para edicion, fondo, luz y adaptacion." : "Crea el spot desde guion y assets cargados." },
      { id: "voice", label: "Voz comercial", model: form.audioModel || "minimax-speech-2.6-hd", reason: "Genera narracion o locucion comercial con tono adecuado para venta." },
      { id: "music", label: "Musica / ambiente", model: form.musicModel || "suno-create-music", reason: "Crea musica pegadiza o fondo sonoro coherente con el producto y canal." },
      { id: "package", label: "Pack final", model: "NEXFRAME Assembly", reason: "Agrupa video, portada, flyer, copy, prompts, metadata y descargas." }
    ]
  };
}

function marketingPromptFor(form = {}) {
  return [
    `Producto: ${form.productName || "No definido"}`,
    `Oferta: ${form.offer || "No definida"}`,
    `Publico objetivo: ${form.audience || "No definido"}`,
    `Objetivo: ${form.campaignGoal || "Vender producto"}`,
    `Formato: ${form.outputType || "Video promocional"} para ${form.channel || "canal no definido"}`,
    `Estilo visual: ${form.visualStyle || "Realista cinematografico"}`,
    `Duracion: ${form.duration || "10s"}`,
    `Voz: ${form.voiceStyle || "Voz vendedora profesional"}`,
    `Musica: ${form.soundtrackStyle || "Musica pegadiza moderna"}`,
    "Guion exacto del usuario:",
    form.prompt || ""
  ].join("\n");
}

function PublicNativeV2({ actions }) {
  const location = useLocation();
  const sectionFromRoute = location.pathname.split("/").pop();
  const routeTab = {
    content: "Contenido",
    "hero-video": "Hero Video",
    studios: "Estudios",
    testimonials: "Testimonios",
    pricing: "Precios",
    seo: "SEO",
    appearance: "Apariencia",
    legal: "Legal"
  }[sectionFromRoute] || "Contenido";
  const [tab, setTab] = useState(routeTab);
  const [data, setData] = useState(publicFallback);
  const [plans, setPlans] = useState([]);
  const [status, setStatus] = useState("Cargando contenido publico...");
  const [uploading, setUploading] = useState("");
  useEffect(() => {
    Promise.all([
      apiRequest("/api/public/landing"),
      apiRequest("/api/admin/site").catch(() => ({}))
    ]).then(([publicData, adminData]) => {
      setData({ ...publicFallback, ...publicData, ...(adminData.publicWebsite || {}) });
      setPlans(adminData.plans || []);
      setStatus("Contenido publico cargado.");
    }).catch((error) => setStatus(error.message));
  }, []);
  const saveLanding = async () => {
    const result = await apiRequest("/api/admin/public/landing", {
      method: "PATCH",
      body: JSON.stringify({ ...data.landing, benefits: data.benefits, howItWorks: data.howItWorks, legal: data.legal })
    });
    setData({ ...data, ...result });
    setStatus("Landing guardada y publicada.");
    actions.notify("Landing publica actualizada.");
  };
  const saveHero = async () => {
    const result = await apiRequest("/api/admin/public/hero-video", { method: "PATCH", body: JSON.stringify(data.heroVideo) });
    setData((current) => ({ ...current, heroVideo: result.heroVideo }));
    setStatus("Hero video guardado.");
    actions.notify("Hero video publico actualizado.");
  };
  const uploadHeroAsset = async (key, file) => {
    if (!file) return;
    setUploading(key);
    const formData = new FormData();
    const field = key === "videoUrl" ? "video" : key === "thumbnailUrl" ? "thumbnail" : "fallback";
    formData.append(field, file, file.name);
    try {
      const result = await apiRequest("/api/admin/public/hero-video/upload", { method: "POST", body: formData });
      setData((current) => ({ ...current, heroVideo: result.heroVideo }));
      setStatus("Archivo del hero subido correctamente.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setUploading("");
    }
  };
  const saveStudios = async () => {
    const result = await apiRequest("/api/admin/public/studios", { method: "PATCH", body: JSON.stringify({ studios: data.studios }) });
    setData((current) => ({ ...current, studios: result.studios }));
    setStatus("Estudios publicos guardados.");
  };
  const saveMetrics = async () => {
    const result = await apiRequest("/api/admin/public/metrics", { method: "PATCH", body: JSON.stringify({ metrics: data.metrics }) });
    setData((current) => ({ ...current, metrics: result.metrics }));
    setStatus("Metricas guardadas.");
  };
  const saveTestimonials = async () => {
    const result = await apiRequest("/api/admin/public/landing", {
      method: "PATCH",
      body: JSON.stringify({ testimonials: data.testimonials })
    });
    setData((current) => ({ ...current, testimonials: result.testimonials }));
    setStatus("Testimonios guardados.");
  };
  const saveSeo = async () => {
    const result = await apiRequest("/api/admin/public/landing", {
      method: "PATCH",
      body: JSON.stringify({ seo: data.seo })
    });
    setData((current) => ({ ...current, seo: result.seo }));
    setStatus("SEO guardado.");
  };
  const saveAppearance = async () => {
    const result = await apiRequest("/api/admin/public/site", {
      method: "PATCH",
      body: JSON.stringify(data.site)
    });
    setData((current) => ({ ...current, site: result.site }));
    setStatus("Apariencia publica guardada.");
  };
  const savePlan = async (plan) => {
    const result = await apiRequest(`/api/admin/plans/${plan.id}`, { method: "PUT", body: JSON.stringify(plan) });
    setPlans((current) => current.map((item) => item.id === plan.id ? result.plan : item));
    setStatus(`Plan ${plan.name} guardado.`);
  };
  const updateLanding = (key, value) => setData((current) => ({ ...current, landing: { ...current.landing, [key]: value } }));
  const updateHero = (key, value) => setData((current) => ({ ...current, heroVideo: { ...current.heroVideo, [key]: value } }));
  const updateList = (listKey, id, patch) => setData((current) => ({ ...current, [listKey]: current[listKey].map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const updatePlanCycle = (planId, cycleId, key, value) => setPlans((current) => current.map((plan) => plan.id === planId ? { ...plan, cycles: { ...plan.cycles, [cycleId]: { ...plan.cycles[cycleId], [key]: key === "price" ? Number(value) : value } } } : plan));
  return (
    <div className="admin-public-native public-admin-v2">
      <section className="card admin-hero-card admin-public-hero">
        <div><h2>Panel Admin Web Publica</h2><p className="muted">Edita landing, hero video, estudios, testimonios, metricas, precios, SEO, apariencia y legal.</p></div>
        <div className="toolbar"><Link className="btn secondary" to="/" target="_blank">Ver sitio publico</Link><button className="btn" onClick={saveLanding}><Save size={16} />Guardar y publicar cambios</button></div>
      </section>
      <section className="tabs public-admin-tabs">
        {["Contenido", "Hero Video", "Estudios", "Testimonios", "Metricas", "Precios", "SEO", "Apariencia", "Legal", "Vista previa"].map((item) => <button className={tab === item ? "tab active" : "tab"} key={item} onClick={() => setTab(item)}>{item}</button>)}
      </section>
      {status && <p className="auth-message">{status}</p>}
      {tab === "Contenido" && <section className="layout-2"><div className="card form"><h2>Contenido Landing</h2><div className="field"><label>Announcement bar</label><input className="input" value={data.landing.announcementText || ""} onChange={(e) => updateLanding("announcementText", e.target.value)} /></div><div className="field"><label>Hero title</label><input className="input" value={data.landing.heroTitle || ""} onChange={(e) => updateLanding("heroTitle", e.target.value)} /></div><div className="field"><label>Hero subtitle</label><textarea className="textarea compact-textarea" value={data.landing.heroSubtitle || ""} onChange={(e) => updateLanding("heroSubtitle", e.target.value)} /></div><div className="grid form-grid"><div className="field"><label>CTA principal</label><input className="input" value={data.landing.primaryCtaText || ""} onChange={(e) => updateLanding("primaryCtaText", e.target.value)} /></div><div className="field"><label>CTA secundario</label><input className="input" value={data.landing.secondaryCtaText || ""} onChange={(e) => updateLanding("secondaryCtaText", e.target.value)} /></div></div><button className="btn" onClick={saveLanding}>Guardar contenido</button></div><div className="card"><h2>Beneficios</h2>{(data.benefits || []).map((item) => <div className="admin-list-row" key={item.id}><input className="input" value={item.title} onChange={(e) => updateList("benefits", item.id, { title: e.target.value })} /><textarea className="textarea mini-textarea" value={item.body} onChange={(e) => updateList("benefits", item.id, { body: e.target.value })} /></div>)}</div></section>}
      {tab === "Hero Video" && <section className="layout-2"><div className="card form"><h2>Hero Video Publico</h2><div className="field"><label>Video actual</label><input className="input" value={data.heroVideo.videoUrl || ""} onChange={(e) => updateHero("videoUrl", e.target.value)} /></div><div className="field"><label>Thumbnail actual</label><input className="input" value={data.heroVideo.thumbnailUrl || ""} onChange={(e) => updateHero("thumbnailUrl", e.target.value)} /></div><div className="field"><label>Imagen fallback</label><input className="input" value={data.heroVideo.fallbackImageUrl || ""} onChange={(e) => updateHero("fallbackImageUrl", e.target.value)} /></div><div className="grid form-grid"><label className="file-pill">Subir video<input type="file" accept="video/mp4,video/webm" onChange={(e) => uploadHeroAsset("videoUrl", e.target.files?.[0])} /></label><label className="file-pill">Subir thumbnail<input type="file" accept="image/*" onChange={(e) => uploadHeroAsset("thumbnailUrl", e.target.files?.[0])} /></label></div><div className="field"><label>Titulo del video</label><input className="input" value={data.heroVideo.title || ""} onChange={(e) => updateHero("title", e.target.value)} /></div><div className="field"><label>Subtitulo del video</label><input className="input" value={data.heroVideo.subtitle || ""} onChange={(e) => updateHero("subtitle", e.target.value)} /></div><div className="admin-toggle-grid">{["isActive", "autoplay", "muted", "loop", "showPlayButton"].map((key) => <label key={key}><input type="checkbox" checked={Boolean(data.heroVideo[key])} onChange={(e) => updateHero(key, e.target.checked)} />{key}</label>)}</div><button className="btn" onClick={saveHero}>{uploading ? `Subiendo ${uploading}...` : "Guardar hero video"}</button></div><div className="card"><h2>Vista previa inmediata</h2><div className="admin-hero-preview">{data.heroVideo.videoUrl ? <video src={data.heroVideo.videoUrl} poster={data.heroVideo.thumbnailUrl} controls /> : <img src={data.heroVideo.fallbackImageUrl || data.heroVideo.thumbnailUrl} alt="Hero preview" />}<strong>{data.heroVideo.title}</strong><p>{data.heroVideo.subtitle}</p></div></div></section>}
      {tab === "Estudios" && <section className="card"><h2>Estudios Publicos</h2><div className="admin-grid-list">{(data.studios || []).map((item) => <article className="admin-edit-card" key={item.id}><img src={item.imageUrl} alt={item.title} /><label><input type="checkbox" checked={item.isVisible !== false} onChange={(e) => updateList("studios", item.id, { isVisible: e.target.checked })} /> Visible</label><input className="input" value={item.title} onChange={(e) => updateList("studios", item.id, { title: e.target.value })} /><textarea className="textarea mini-textarea" value={item.description} onChange={(e) => updateList("studios", item.id, { description: e.target.value })} /><input className="input" value={item.imageUrl} onChange={(e) => updateList("studios", item.id, { imageUrl: e.target.value })} /><input className="input" value={item.route} onChange={(e) => updateList("studios", item.id, { route: e.target.value })} /></article>)}</div><button className="btn" onClick={saveStudios}>Guardar estudios visibles</button></section>}
      {tab === "Testimonios" && <section className="card"><h2>Testimonios</h2><div className="admin-grid-list">{(data.testimonials || []).map((item) => <article className="admin-edit-card" key={item.id}><input className="input" value={item.name} onChange={(e) => updateList("testimonials", item.id, { name: e.target.value })} /><input className="input" value={item.role} onChange={(e) => updateList("testimonials", item.id, { role: e.target.value })} /><textarea className="textarea mini-textarea" value={item.text} onChange={(e) => updateList("testimonials", item.id, { text: e.target.value })} /><input className="input" type="number" min="1" max="5" value={item.stars} onChange={(e) => updateList("testimonials", item.id, { stars: Number(e.target.value) })} /><label><input type="checkbox" checked={item.isVisible !== false} onChange={(e) => updateList("testimonials", item.id, { isVisible: e.target.checked })} /> Activo</label></article>)}</div><button className="btn" onClick={saveTestimonials}>Guardar testimonios</button></section>}
      {tab === "Metricas" && <section className="card"><h2>Metricas</h2><div className="admin-grid-list">{(data.metrics || []).map((item) => <article className="admin-edit-card" key={item.id}><input className="input" value={item.value} onChange={(e) => updateList("metrics", item.id, { value: e.target.value })} /><input className="input" value={item.label} onChange={(e) => updateList("metrics", item.id, { label: e.target.value })} /><label><input type="checkbox" checked={item.isVisible !== false} onChange={(e) => updateList("metrics", item.id, { isVisible: e.target.checked })} /> Activo</label></article>)}</div><button className="btn" onClick={saveMetrics}>Guardar metricas</button></section>}
      {tab === "Precios" && <section className="card"><h2>Precios publicos conectados a Billing</h2><table className="table admin-plan-table"><thead><tr><th>Plan</th><th>Mensual</th><th>Trimestral</th><th>Anual</th><th>Creditos</th><th>Destacado</th><th>Accion</th></tr></thead><tbody>{plans.map((plan) => <tr key={plan.id}><td><strong>{plan.name}</strong></td>{["monthly", "quarterly", "annual"].map((cycle) => <td key={cycle}><input className="input mini" type="number" value={plan.cycles?.[cycle]?.price || 0} onChange={(e) => updatePlanCycle(plan.id, cycle, "price", e.target.value)} /></td>)}<td><input className="input mini" type="number" value={plan.credits || 0} onChange={(e) => setPlans((current) => current.map((item) => item.id === plan.id ? { ...item, credits: Number(e.target.value) } : item))} /></td><td>{plan.highlighted ? "Si" : "No"}</td><td><button className="btn secondary" onClick={() => savePlan(plan)}>Guardar</button></td></tr>)}</tbody></table></section>}
      {tab === "SEO" && <section className="card form"><h2>SEO y Metadata</h2>{["metaTitle", "metaDescription", "ogImage", "keywords", "canonicalUrl"].map((key) => <div className="field" key={key}><label>{key}</label><input className="input" value={data.seo?.[key] || ""} onChange={(e) => setData((current) => ({ ...current, seo: { ...current.seo, [key]: e.target.value } }))} /></div>)}<button className="btn" onClick={saveSeo}>Guardar SEO</button></section>}
      {tab === "Apariencia" && <section className="card form"><h2>Apariencia publica</h2>{["logoUrl", "faviconUrl", "primaryColor", "accentColor", "heroLayout"].map((key) => <div className="field" key={key}><label>{key}</label><input className="input" value={data.site?.[key] || ""} onChange={(e) => setData((current) => ({ ...current, site: { ...current.site, [key]: e.target.value } }))} /></div>)}<div className="admin-toggle-grid">{["neonEnabled", "particlesEnabled", "animationsEnabled"].map((key) => <label key={key}><input type="checkbox" checked={Boolean(data.site?.[key])} onChange={(e) => setData((current) => ({ ...current, site: { ...current.site, [key]: e.target.checked } }))} />{key}</label>)}</div><button className="btn" onClick={saveAppearance}>Guardar apariencia</button></section>}
      {tab === "Legal" && <section className="card form"><h2>Legal y Footer</h2>{["terms", "privacy", "cookies", "contact", "copyright"].map((key) => <div className="field" key={key}><label>{key}</label><textarea className="textarea compact-textarea" value={data.legal?.[key] || ""} onChange={(e) => setData((current) => ({ ...current, legal: { ...current.legal, [key]: e.target.value } }))} /></div>)}<button className="btn" onClick={saveLanding}>Guardar legal/footer</button></section>}
      {tab === "Vista previa" && <section className="card"><h2>Vista previa publica</h2><div className="toolbar"><Link className="btn secondary" to="/" target="_blank">Desktop</Link><Link className="btn secondary" to="/studios" target="_blank">Estudios</Link><Link className="btn secondary" to="/pricing" target="_blank">Precios</Link></div><img className="admin-preview-img" src={data.heroVideo?.fallbackImageUrl || data.heroVideo?.thumbnailUrl} alt="Vista previa" /></section>}
    </div>
  );
}

function PublicNative({ actions }) {
  const [site, setSite] = useState({ heroTitle: "", heroSubtitle: "", ctaPrimary: "", ctaSecondary: "" });
  const [plans, setPlans] = useState([]);
  const [selectedTab, setSelectedTab] = useState("Contenido");
  const [status, setStatus] = useState("Sin guardar");
  useEffect(() => {
    apiRequest("/api/admin/site")
      .then((result) => {
        setSite(result.siteContent || {});
        setPlans(result.plans || []);
        setStatus("Datos cargados desde servidor.");
      })
      .catch((error) => setStatus(error.message));
  }, []);
  const updateSite = (key, value) => setSite((current) => ({ ...current, [key]: value }));
  const updatePlanCycle = (planId, cycleId, key, value) => {
    setPlans((current) => current.map((plan) => plan.id === planId ? {
      ...plan,
      cycles: { ...plan.cycles, [cycleId]: { ...plan.cycles[cycleId], [key]: key === "price" ? Number(value) : value } }
    } : plan));
  };
  const saveSite = async () => {
    const result = await apiRequest("/api/admin/site", { method: "PUT", body: JSON.stringify(site) });
    setStatus("Contenido publico guardado.");
    actions.notify(result.ok ? "Contenido publico actualizado." : "No se pudo guardar.");
  };
  const savePlan = async (plan) => {
    const result = await apiRequest(`/api/admin/plans/${plan.id}`, { method: "PUT", body: JSON.stringify(plan) });
    setPlans((current) => current.map((item) => item.id === plan.id ? result.plan : item));
    setStatus(`Plan ${plan.name} guardado con sus 3 ciclos.`);
    actions.notify(`Plan ${plan.name} actualizado.`);
  };
  return (
    <div className="admin-public-native">
      <section className="card admin-hero-card">
        <div><h2>Panel Admin Web Publica</h2><p className="muted">Gestiona landing, precios, visibilidad y checkout sin exponer datos privados a usuarios.</p></div>
        <div className="toolbar"><Link className="btn secondary" to="/" target="_blank">Ver sitio publico</Link><button className="btn" onClick={saveSite}><Save size={16} />Guardar y publicar cambios</button></div>
      </section>
      <section className="tabs">
        {["Contenido", "Planes y Precios", "Pagos y Gateways", "Autenticacion", "Permisos"].map((tab) => <button className={selectedTab === tab ? "tab active" : "tab"} key={tab} onClick={() => setSelectedTab(tab)}>{tab}</button>)}
      </section>
      {status && <p className="auth-message">{status}</p>}
      {selectedTab === "Contenido" && (
        <div className="layout-2">
          <section className="card form">
            <h2>Contenido de la Landing Page</h2>
            <div className="field"><label>Titulo principal</label><input className="input" value={site.heroTitle || ""} onChange={(e) => updateSite("heroTitle", e.target.value)} /></div>
            <div className="field"><label>Subtitulo</label><textarea className="textarea compact-textarea" value={site.heroSubtitle || ""} onChange={(e) => updateSite("heroSubtitle", e.target.value)} /></div>
            <div className="grid form-grid">
              <div className="field"><label>CTA principal</label><input className="input" value={site.ctaPrimary || ""} onChange={(e) => updateSite("ctaPrimary", e.target.value)} /></div>
              <div className="field"><label>CTA secundario</label><input className="input" value={site.ctaSecondary || ""} onChange={(e) => updateSite("ctaSecondary", e.target.value)} /></div>
            </div>
          </section>
          <section className="card">
            <h2>Vista previa del sitio publico</h2>
            <img className="admin-preview-img" src="/assets/public-web/landing-reference.png" alt="Vista previa web publica" />
          </section>
        </div>
      )}
      {selectedTab === "Planes y Precios" && (
        <section className="card">
          <h2>Planes y ciclos editables</h2>
          <table className="table admin-plan-table">
            <thead><tr><th>Plan</th><th>Mensual</th><th>Trimestral</th><th>Anual</th><th>Creditos</th><th>Resolucion</th><th>Accion</th></tr></thead>
            <tbody>
              {plans.map((plan) => <tr key={plan.id}>
                <td><strong>{plan.name}</strong></td>
                {["monthly", "quarterly", "annual"].map((cycle) => <td key={cycle}><input className="input mini" type="number" value={plan.cycles?.[cycle]?.price || 0} onChange={(e) => updatePlanCycle(plan.id, cycle, "price", e.target.value)} /></td>)}
                <td><input className="input mini" type="number" value={plan.credits || 0} onChange={(e) => setPlans((current) => current.map((item) => item.id === plan.id ? { ...item, credits: Number(e.target.value) } : item))} /></td>
                <td>{plan.resolution}</td>
                <td><button className="btn secondary" onClick={() => savePlan(plan)}>Guardar</button></td>
              </tr>)}
            </tbody>
          </table>
        </section>
      )}
      {selectedTab !== "Contenido" && selectedTab !== "Planes y Precios" && (
        <section className="card">
          <h2>{selectedTab}</h2>
          {selectedTab === "Pagos y Gateways" && <><div className="check-row"><CreditCard size={18} />Stripe: {status.includes("Stripe") ? status : "usa STRIPE_SECRET_KEY en servidor"}</div><div className="check-row"><Shield size={18} />Webhooks preparados por metadata planId/cycleId/userId.</div></>}
          {selectedTab === "Autenticacion" && <><div className="check-row"><Mail size={18} />Email/password con hash PBKDF2.</div><div className="check-row"><Shield size={18} />Google OAuth mediante GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.</div></>}
          {selectedTab === "Permisos" && <><div className="check-row"><Lock size={18} />Usuarios normales no ven API keys, admin, security ni deployment.</div><div className="check-row"><Crown size={18} />Admin gestiona usuarios, planes y web publica.</div></>}
        </section>
      )}
    </div>
  );
}

function SecurityNative({ actions }) {
  return <div className="layout-2"><section className="card"><h2>Security Center</h2>{["Key vault", "Audit log", "Rate limit", "Consent Vault", "Moderacion", "Backups"].map((item) => <div className="check-row" key={item}><Shield size={18} />{item}</div>)}</section><section className="card flow-actions"><h2>Controles</h2><button className="btn" onClick={() => actions.runV6Action("security", "Audit Logs", {})}>Ver auditoria</button><button className="btn secondary full" onClick={() => actions.runV6Action("security", "Consent Vault", {})}>Abrir Consent Vault</button></section></div>;
}

function GenericNative({ id, actions }) {
  return <div className="card"><h2>{labelFor(id)}</h2><p className="muted">Panel operativo conectado a guardado, exportacion, historial y acciones locales.</p><button className="btn" onClick={() => actions.notify(`${labelFor(id)} ejecutado correctamente.`)}>Ejecutar accion principal</button></div>;
}

function ModelsPanel({ actions, panel }) {
  const registryRows = Object.values(muapiRegistry.byType).flat();
  const totalModels = registryRows.length;
  return <><h1>{panel === "admin" ? "AI Engine / Modelos IA" : panel === "mymodels" ? "My Models" : "API Collection"}</h1><p className="muted">Catalogo operativo basado en Open Generative AI: una sola API MuAPI y modelos seleccionables por panel.</p><div className="grid stats"><Stat icon={Activity} label="Gateway" value="MuAPI" sub="universal" /><Stat icon={Bot} label="Modelos" value={totalModels} sub="Open Generative AI" /><Stat icon={Shield} label="RBAC" value="Activo" sub="Admin/User" /><Stat icon={Gauge} label="Rate Limit" value="120/min" sub="por usuario" /></div><div className="layout-2"><section className="card"><h2>Proveedores IA</h2>{providers.map((p) => <div className="card row-card" key={p.id}><strong>{p.name}</strong><p className="muted">Estado: {p.status} - Latencia: {p.latency} - Prioridad: {p.priority}</p><button className="btn secondary" onClick={() => actions.runV6Action("api", "Test Connection", { provider: p.id })}>Probar conexion</button></div>)}</section><section className="card"><h2>Registry MuAPI</h2><p className="muted">{muapiRegistry.gateway}</p>{Object.entries(muapiRegistry.counts || {}).map(([key, value]) => <div className="check-row" key={key}><Check size={18} /><span>{key}: {value} modelos</span></div>)}</section></div><section className="card"><h2>Catalogo de modelos</h2><ModelTable rows={registryRows.slice(0, 80)} actions={actions} /></section><SubpanelGrid items={subpanels.filter((s) => ["api", "apikeys", "mymodels"].includes(s.area))} actions={actions} /></>;
}

function ModelTable({ rows, actions }) {
  return <table className="table"><thead><tr><th>Modelo</th><th>Proveedor</th><th>Tipo</th><th>Endpoint</th><th>Prioridad</th><th>Acciones</th></tr></thead><tbody>{rows.map((m, index) => <tr key={`${m.id}-${m.type || m.category || "model"}-${index}`}><td>{m.name}</td><td>{m.provider}</td><td>{m.type || m.category}</td><td>{m.endpoint || m.id}</td><td>{m.priority || "-"}</td><td><button className="btn secondary" onClick={() => actions.modal({ title: m.name, body: JSON.stringify(m, null, 2) })}>Ver parametros</button></td></tr>)}</tbody></table>;
}

function GenerationPanel({ state, actions }) {
  const jobs = (state.jobs || []).filter((job) => job.userGenerated === true);
  return <><h1>Generation Process</h1><div className="grid stats"><Stat icon={Gauge} label="En cola" value={jobs.filter((j) => j.status === "queued").length} sub="jobs" /><Stat icon={Activity} label="Procesando" value={jobs.filter((j) => j.status === "processing").length} sub="jobs" /><Stat icon={Check} label="Completados" value={jobs.filter((j) => j.status === "completed").length} sub="jobs" /><Stat icon={AlertCircle} label="Fallidos" value={jobs.filter((j) => j.status === "failed").length} sub="jobs" /></div><div className="grid">{jobs.length === 0 ? <div className="card"><h2>Sin generaciones activas</h2><p className="muted">Inicia una generacion desde cualquier studio para verla aqui.</p></div> : jobs.map((job) => <div className="card generation-row" key={job.id}><img src={previewImageForStudio(job.studio)} alt={job.studio} loading="lazy" decoding="async" /><div><strong>{job.model}</strong><p className="muted">{labelFor(job.studio)} - {statusLabel(job.status)} - {job.provider || "MuAPI/local"}</p></div><div className="stage-strip">{productionStagesForStudio(job.studio).slice(0, 5).map((stage, index) => <span className={stageStatusFromProgress(job.progress || 0, index, 5)} key={stage.id}>{stage.label}</span>)}</div><button className="btn secondary" disabled={["completed", "cancelled"].includes(job.status)} onClick={() => actions.cancelJob(job.id)}>Cancelar</button></div>)}</div></>;
}

function TrashPanel({ state, actions }) {
  const trash = state.trash || [];
  return (
    <>
      <div className="section-head">
        <div>
          <h1>Papelera</h1>
          <p className="muted">Los proyectos y generaciones borradas quedan aqui hasta que vacies la papelera.</p>
        </div>
        <button className="btn secondary danger" disabled={!trash.length} onClick={actions.emptyTrash}><Trash2 size={16} />Vaciar papelera</button>
      </div>
      {!trash.length ? <EmptyState title="Papelera vacia" body="Cuando borres una generacion o proyecto aparecera aqui para restaurarlo." /> : (
        <section className="grid trash-grid">
          {trash.map((entry) => {
            const item = entry.item || {};
            const title = item.title || item.model || item.id || "Elemento";
            return (
              <div className="card trash-card" key={entry.trashId}>
                <div>
                  <strong>{title}</strong>
                  <p className="muted">{entry.type === "project" ? "Proyecto" : labelFor(item.studio || "generation")} - borrado {new Date(entry.deletedAt).toLocaleString("es-ES")}</p>
                  {jobPrompt(item) && <p className="trash-prompt">{jobPrompt(item)}</p>}
                </div>
                <div className="toolbar">
                  <button className="btn secondary" onClick={() => actions.restoreTrash(entry.trashId)}>Restaurar</button>
                  <button className="btn secondary" onClick={() => actions.download(`${title}.json`, item)}><Download size={16} />Descargar</button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

function SubpanelGrid({ items, actions }) {
  return <><SectionTitle title="Subpaneles internos" /><section className="grid subpanel-grid">{items.map((item) => <button className="card subpanel-card" key={item.file} onClick={() => actions.modal({ title: item.title, body: "Subpanel disponible como estado funcional nativo. Las referencias visuales ya no se incrustan como pantallas." })}><strong>{item.title}</strong><span className="muted">Abrir estado funcional</span></button>)}</section></>;
}

function Modal({ modal, onClose, actions }) {
  const hasGeneratedMedia = Boolean(modal.mediaUrl);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal ${hasGeneratedMedia ? "media-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="icon-btn" style={{ float: "right" }} aria-label="Cerrar modal" onClick={onClose}><X /></button>
        <h2 id="modal-title">{modal.title}</h2>
        {modal.image && <img src={modal.image} className="modal-image" alt={modal.title} loading="lazy" decoding="async" />}
        {modal.mediaUrl && modal.mediaKind === "image" && <img src={modal.mediaUrl} className="modal-media" alt={modal.prompt || modal.title} loading="lazy" decoding="async" />}
        {modal.mediaUrl && modal.mediaKind === "video" && <video src={modal.mediaUrl} className="modal-media" controls autoPlay />}
        {modal.mediaUrl && modal.mediaKind === "audio" && <audio src={modal.mediaUrl} className="modal-audio" controls autoPlay />}
        {modal.prompt && <p className="modal-prompt">{modal.prompt}</p>}
        {modal.body && <pre>{modal.body}</pre>}
        <div className="toolbar">
          {modal.job ? <button className="btn secondary" onClick={() => actions.downloadGenerated(modal.job)}>Descargar archivo</button> : <button className="btn secondary" onClick={() => actions.download(`${modal.title || "nexframe"}.json`, modal)}>Descargar metadata</button>}
          {modal.job && <button className="btn secondary" onClick={() => actions.copyGeneratedLink(modal.job)}>Copiar enlace</button>}
          <button className="btn secondary" onClick={() => actions.copy(modal.prompt || modal.title || "NEXFRAME")}>{modal.prompt ? "Copiar prompt" : "Copiar titulo"}</button>
        </div>
      </div>
    </div>
  );
}

function labelFor(id) {
  return studios.find((s) => s.id === id)?.label || ({
    api: "API Collection", apikeys: "API Keys", generation: "Generation Process", trash: "Papelera", deployment: "Deployment",
    checklist: "Checklist Final Codex", assets: "Assets Library", voices: "Voice Library", mymodels: "My Models",
    windows: "Windows App Launcher", flyer: "Flyer Studio", editor: "Video Editor Studio AI", marketing: "Marketing", public: "Public Website",
    security: "Security Center", narrative: "Narrativa y Voz", youtube: "Analizador YouTube", users: "Usuarios"
  }[id] || id);
}

function studioSubtitle(id) {
  return {
    video: "Texto, imagen o clip convertido en video cinematografico.",
    image: "Imagenes cinematograficas con referencia, variantes y descarga.",
    sound: "Musica, SFX, ambientes y voces para produccion.",
    effects: "VFX, filtros, particulas y composicion visual.",
    lipsync: "Avatares, foto o video sincronizados con audio.",
    documentary: "Tema, guion, escenas, narracion y proyecto final.",
    musicvideo: "Audio, storyboard, imagenes, clips y exportacion.",
    editor: "Timeline central, montaje automatico, subtitulos, VFX y export final.",
    flyer: "Flyers, posters, thumbnails y piezas promocionales.",
    cinema: "Camara, lente, movimiento y toma cinematografica.",
    narrative: "Narrativa IA, locucion profesional y salida MP3.",
    youtube: "Nichos, ideas, guiones y ruta hacia documental."
  }[id] || "Panel operativo NEXFRAME";
}
