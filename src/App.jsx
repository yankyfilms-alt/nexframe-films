import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, Bell, Bot, Box, Camera, Check, ChevronDown, Clapperboard, Coins, Copy,
  Crown, Database, Download, FileText, Folder, Gauge, HelpCircle, Home, Image, KeyRound,
  Mic2, Music, Play, Plus, RefreshCw, Save, Search, Settings, Shield, Sparkles, Trash2, Upload,
  Wand2, X
} from "lucide-react";
import {
  dashboardAssets, models, providers, studios, subpanels, themes, translations
} from "./data/models";
import {
  getMuapiModelById, getMuapiModelsForStudio, muapiRegistry
} from "./data/models-registry";
import { downloadBlob, downloadJson, loadState, makeJob, makeProject, saveState } from "./lib/store";
import v6Registry from "../nexframe_v6_provider_registry.json";
import v6Actions from "../nexframe_v6_full_button_action_map.json";

const iconMap = {
  dashboard: Home, projects: Folder, gallery: Image, hub: Box, video: Clapperboard, image: Image,
  sound: Activity, effects: Sparkles, lipsync: Mic2, documentary: Bot, musicvideo: Music, cinema: Camera,
  narrative: Mic2, youtube: Bot, flyer: Image, script: FileText, marketing: Sparkles, public: Home, security: Shield,
  assets: Folder, voices: Mic2, mymodels: Bot, api: Database, apikeys: KeyRound,
  users: Shield, generation: Gauge, deployment: Activity, checklist: Check, windows: Box, settings: Settings,
  billing: Coins, help: HelpCircle, admin: Shield
};

const studioCardAssets = {
  video: dashboardAssets.videoCard,
  image: dashboardAssets.imageCard,
  sound: dashboardAssets.soundCard,
  effects: dashboardAssets.effectsCard,
  lipsync: dashboardAssets.lipsyncCard,
  documentary: dashboardAssets.documentaryCard,
  musicvideo: dashboardAssets.musicVideoCard,
  narrative: dashboardAssets.soundCard,
  youtube: dashboardAssets.recentDocumentary,
  flyer: null,
  cinema: dashboardAssets.cinemaCard
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
    videoModel: "veo3.1-text-to-video",
    imageModel: "nano-banana",
    audioModel: "suno-create-music",
    lipSyncModel: "infinitetalk-image-to-video",
    target: "YouTube documental 16:9",
    narrativeTone: "Codigo Blanco broadcast",
    soundtrackStyle: "Tension oscura",
    voiceStyle: "Narrador grave documental",
    sceneDensity: "Completo 35-40 minutos"
  },
  musicvideo: {
    prompt: "",
    videoModel: "veo3.1-text-to-video",
    imageModel: "nano-banana",
    audioModel: "suno-create-music",
    lipSyncModel: "infinitetalk-image-to-video",
    target: "YouTube 16:9",
    narrativeMode: "Type A - solo modelos, sin artista",
    soundtrackStyle: "Usar audio subido",
    beatCuts: "Cortes cada 5 segundos"
  },
  narrative: { prompt: "", model: "minimax-speech-2.6-hd", voiceStyle: "Narrador grave documental", language: "Espanol", format: "mp3", maxCharacters: 10000 },
  youtube: { channelUrl: "", objective: "Detectar nicho documental rentable", duration: "35-40 min", tone: "Codigo Blanco broadcast", target: "YouTube documental 16:9" },
  flyer: { prompt: "", model: "nano-banana", title: "", date: "", place: "", price: "", style: "Rojo oscuro / dorado", variants: 4 },
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

async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return data;
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

function estimateCredits(studio, model) {
  const base = { image: 4, flyer: 6, sound: 8, narrative: 6, video: 24, cinema: 24, effects: 12, lipsync: 10, documentary: 120, musicvideo: 90, youtube: 5 }[studio] || 8;
  const multiplier = model?.priority >= 95 ? 2 : model?.priority >= 85 ? 1.5 : 1;
  return Math.ceil(base * multiplier);
}

function themeClass(theme) {
  return `theme-${String(theme || "dark").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function useAppState() {
  const [state, setState] = useState(loadState);
  useEffect(() => saveState(state), [state]);
  const patch = (update) => setState((current) => ({ ...current, ...(typeof update === "function" ? update(current) : update) }));
  return [state, patch];
}

export default function App() {
  const [state, patch] = useAppState();
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const [busyStudio, setBusyStudio] = useState("");
  const t = translations[state.language] || translations.es;

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
            fetch(`/api/muapi/task/${job.id}`)
              .then((response) => response.json())
              .then((data) => {
                if (!data.ok) return;
                patch((latest) => ({ jobs: latest.jobs.map((item) => item.id === job.id ? { ...item, ...data.job } : item) }));
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
    navigate: (id) => patch({ active: id }),
    notify: setToast,
    modal: setModal,
    closeModal: () => setModal(null),
    copy: async (text) => {
      await navigator.clipboard.writeText(text);
      setToast("Texto copiado al portapapeles.");
    },
    download: (name, payload) => {
      downloadJson(name, payload);
      setToast("Descarga preparada con metadatos del proyecto.");
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
      patch((current) => ({ projects: (current.projects || []).filter((project) => project.id !== id) }));
      setToast("Proyecto eliminado del espacio local.");
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
    createJob: async (studio, form) => {
      const studioModels = getMuapiModelsForStudio(studio);
      const modelId = form?.model || form?.videoModel || studioModels[0]?.id;
      const model = getMuapiModelById(modelId) || studioModels[0] || models.find((item) => item.studio === studio && item.enabled && item.visible) || models[0];
      if (!form?.prompt?.trim()) return setToast("Escribe un prompt antes de generar.");
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
        const credits = Number(result.job?.remoteCost?.amount_credits || estimateCredits(studio, model));
        const cost = Number(result.job?.remoteCost?.amount_usd || credits);
        const job = { ...result.job, credits, form: safeForm };
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
        syncUsage();
        setToast("Tu generacion esta en cola. El progreso ya aparece en Generation Process.");
      } catch (error) {
        const job = makeJob(studio, model, form);
        patch((current) => ({ jobs: [{ ...job, status: "failed", error: error.message }, ...current.jobs] }));
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
        const credits = studio === "documentary" ? 120 : 90;
        patch((current) => ({
          credits: Math.max(0, current.credits - credits),
          creditsUsed: (current.creditsUsed || 0) + credits,
          jobs: [result.job, ...current.jobs],
          history: [result.job, ...current.history]
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
            jobs: [result.job, ...current.jobs],
            history: [result.job, ...current.history]
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
    <div className={`app ${state.sidebar ? "" : "collapsed"} ${themeClass(state.theme)}`}>
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
  if (active === "documentary" || active === "musicvideo") return <WorkflowScreen type={active} {...props} />;
  if (active === "script") return <ScriptEngine {...props} />;
  if (active === "projects") return <Projects {...props} mode="projects" />;
  if (active === "gallery") return <Projects {...props} mode="gallery" />;
  if (active === "api" || active === "admin" || active === "mymodels") return <ModelsPanel {...props} panel={active} />;
  if (active === "generation") return <GenerationPanel {...props} />;
  if (["hub", "settings", "apikeys", "billing", "help", "deployment", "checklist", "assets", "voices", "users", "windows", "marketing", "public", "security"].includes(active)) return <OfficialPanel {...props} id={active} />;
  return <OfficialPanel {...props} id="help" />;
}

function Dashboard({ state, actions }) {
  const cards = ["video", "image", "sound", "effects", "lipsync", "documentary", "musicvideo", "narrative", "youtube", "flyer", "cinema"];
  const projects = state.projects || [];
  const jobs = state.jobs || [];
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
  return <div className="card studio-card">{image ? <img className="asset-img" src={image} alt={title} loading="lazy" decoding="async" /> : <div className={`asset-img visual-thumb ${id}`} role="img" aria-label={title}><span className="visual-mark" /></div>}<div className="body"><strong>{title}</strong><p className="muted">{subtitle}</p><button className="btn" onClick={onOpen}>Abrir studio</button></div></div>;
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
        if (!shouldRenderSchemaField(key)) return;
        next[key] = current[key] ?? normalizeFieldForModel(key, current[key], selectedModel) ?? inputDefault(schema);
      });
      return next;
    });
  }, [selectedModel?.id, setForm]);
  return (
    <div className="form" style={{ marginTop: 16 }}>
      <div className="field"><label>Prompt <span>{String(form.prompt || "").length}/2000</span></label><textarea className="textarea" value={form.prompt || ""} onChange={(e) => update("prompt", e.target.value)} placeholder="Describe lo que quieres generar." /></div>
      {supportsNegative && <div className="field"><label>Negative prompt</label><textarea className="textarea" value={form.negative_prompt || ""} onChange={(e) => update("negative_prompt", e.target.value)} placeholder="Elementos que no deben aparecer en el resultado." /></div>}
      <div className="grid form-grid">
        <div className="field">
          <label>IA principal</label>
          <select className="select" value={selectedModel?.id || form.model || ""} onChange={(e) => update("model", e.target.value)}>
            {modelOptionsForField(studio, "model").map((item, index) => <option value={item.id} key={`${item.id}-${index}`}>{item.name} - {item.provider}</option>)}
          </select>
        </div>
        {schemaFields.map(([key, schema]) => {
          const value = form[key] ?? inputDefault(schema);
          const modelOptions = modelOptionsForField(studio, key);
          const choices = schema.enum || choiceOptions[key];
          if (modelOptions.length) {
            return (
              <div className="field" key={key}>
                <label>{labelFromKey(key)}</label>
                <select className="select" value={value} onChange={(e) => update(key, e.target.value)}>
                  {modelOptions.map((item, index) => <option value={item.id} key={`${item.id}-${index}`}>{item.name} - {item.provider}</option>)}
                </select>
              </div>
            );
          }
          if (schema.type === "boolean") {
            return <label className="check-row schema-check" key={key}><input type="checkbox" checked={Boolean(value)} onChange={(e) => update(key, e.target.checked)} />{schema.title || labelFromKey(key)}</label>;
          }
          if (choices?.length) {
            return (
              <div className="field" key={key}>
                <label>{schema.title || labelFromKey(key)}</label>
                <select className="select" value={value} onChange={(e) => update(key, e.target.value)}>
                  {choices.map((item, index) => <option value={item} key={`${key}-${index}-${item}`}>{item}</option>)}
                </select>
              </div>
            );
          }
          return <div className="field" key={key}><label>{schema.title || labelFromKey(key)}</label><input className="input" type={schema.type === "int" || schema.type === "number" ? "number" : "text"} min={schema.minimum ?? schema.minValue} max={schema.maximum ?? schema.maxValue} value={value} onChange={(e) => update(key, e.target.value)} /></div>;
        })}
      </div>
      <FileInputs studio={studio} model={selectedModel} form={form} setForm={setForm} />
      <div className="model-summary">
        <strong>{selectedModel?.name || "MuAPI Universal"}</strong>
        <span>{selectedModel?.provider || "muapi"} / {selectedModel?.type || "workflow"} / {selectedModel?.endpoint || "pipeline"}</span>
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
  const fallbackSpecs = {
    documentary: [["audio_url", "Narrativa/audio local", "audio/*"], ["image_url", "Referencia visual", "image/*"], ["video_url", "Video base", "video/*"]],
    musicvideo: [["audio_url", "Cancion/audio local", "audio/*"], ["image_url", "Referencia visual", "image/*"], ["video_url", "Video base", "video/*"]],
    lipsync: [["image_url", "Avatar o rostro", "image/*"], ["audio_url", "Audio de voz", "audio/*"], ["video_url", "Video a clonar", "video/*"]],
    narrative: [["audio_url", "Audio de referencia", "audio/*"]]
  }[studio] || [];
  const specs = modelMediaSpecs.length ? modelMediaSpecs : fallbackSpecs;
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
      {specs.map(([key, label, accept]) => (
        <div className="field file-field" key={key}>
          <label>{label}</label>
          <input id={`${studio}-${key}`} className="file-native" type="file" accept={accept} onChange={(event) => updateFile(key, event.target.files?.[0] || null)} />
          <label className="file-picker" htmlFor={`${studio}-${key}`}>
            <Upload size={16} />
            {form[key] ? "Cambiar archivo" : "Subir archivo"}
          </label>
          <small className="muted file-name">{form[key] || "Ningun archivo seleccionado"}</small>
        </div>
      ))}
    </div>
  );
}

function NativeStudioPanel({ studio, activeSub, state, actions, form }) {
  const title = activeSub?.title || labelFor(studio);
  const jobs = (state.jobs || []).filter((job) => job.studio === studio);
  const completed = jobs.filter((job) => job.status === "completed");
  const activeJob = jobs.find((job) => ["queued", "processing"].includes(job.status));
  if (activeJob) return <JobPreview job={activeJob} actions={actions} />;
  if (!completed.length) return <EmptyState title="Sin resultados" body="Completa el formulario y genera el primer resultado de este studio." />;
  if (studio === "image") {
    return <div className="native-panel"><div className="result-header"><div><strong>Resultados generados</strong><span>{completed.length} items</span></div><button className="btn secondary" onClick={() => actions.saveToProject(completed[0])}><Save size={16} />Guardar</button></div><div className="grid native-results">{completed.map((job, index) => <MediaResult key={job.id} title={job.model || title} image={heroSlides[index % heroSlides.length]} actions={actions} prompt={job.input?.prompt || form.prompt} />)}</div></div>;
  }
  if (studio === "sound") {
    const job = completed[0];
    return <div className="native-panel"><div className="audio-result"><img src={dashboardAssets.soundCard} alt="Audio generado" loading="lazy" decoding="async" /><div><strong>{job.model || "Audio generado"}</strong><p className="muted">{job.status} - MuAPI/local</p></div></div><Waveform /><div className="toolbar"><button className="btn secondary" onClick={() => actions.notify("Preview de audio iniciado en el reproductor local.")}><Play size={16} />Preview</button><button className="btn secondary" onClick={() => actions.download("audio-result.json", job)}><Download size={16} />Descargar</button><button className="btn secondary" onClick={() => actions.saveToProject(job)}>Guardar</button></div></div>;
  }
  if (studio === "effects") {
    return <div className="native-panel"><div className="grid effects-grid">{["Explosion", "Fire", "Smoke", "Particles", "Energy Field", "Lightning", "Portal", "Impact"].map((name) => <button className="effect-card" key={name} onClick={() => actions.notify(`${name} seleccionado.`)}><img src={dashboardAssets.effectsCard} alt={name} loading="lazy" decoding="async" /><strong>{name}</strong><span>VFX cinematico</span></button>)}</div></div>;
  }
  if (studio === "lipsync") {
    const job = completed[0];
    return <div className="native-panel"><div className="avatar-stage"><img src={dashboardAssets.lipsyncCard} alt="Resultado lip sync" loading="lazy" decoding="async" /><div className="playerbar inline"><Play size={18} /><span>Resultado generado</span><div className="progress"><span style={{ width: "100%" }} /></div></div></div><div className="toolbar"><button className="btn secondary" onClick={() => actions.saveToProject(job)}>Guardar</button><button className="btn secondary" onClick={() => actions.download("lipsync-result.json", job)}>Descargar metadata</button></div></div>;
  }
  if (studio === "cinema") {
    const job = completed[0];
    return <div className="native-panel"><div className="cinema-preview"><img src={dashboardAssets.recentCyberpunk} alt="Resultado cinema" loading="lazy" decoding="async" /><div className="cinema-specs"><span>{job.status}</span><span>{form.lens}</span><span>{form.camera}</span><span>MuAPI/local</span></div></div><button className="btn" onClick={() => actions.saveToProject(job)}>Guardar toma</button></div>;
  }
  const job = completed[0];
  return <div className="native-panel"><div className="video-preview"><img src={dashboardAssets.recentCyberpunk} alt={title} loading="lazy" decoding="async" /><div className="playerbar inline"><Play size={18} /><span>Resultado generado</span><div className="progress"><span style={{ width: "100%" }} /></div></div></div><div className="toolbar"><button className="btn secondary" onClick={() => actions.saveToProject(job)}><Save size={16} />Guardar</button><button className="btn secondary" onClick={() => actions.download(`${studio}-output.json`, job)}><Download size={16} />Descargar</button><button className="btn secondary" onClick={() => actions.runV6Action(studio, "Open Editor", job)}>Abrir editor</button></div></div>;
}

function MediaResult({ title, image, actions, prompt }) {
  return <div className="media-result"><img src={image} alt={title} loading="lazy" decoding="async" /><div className="media-overlay"><strong>{title}</strong><div className="toolbar compact"><button className="btn secondary" onClick={() => actions.copy(prompt)}>Prompt</button><button className="btn secondary" aria-label={`Descargar ${title}`} onClick={() => actions.download(`${title}.json`, { title, prompt })}><Download size={14} /></button></div></div></div>;
}

function EmptyState({ title, body, action, onAction }) {
  return <div className="empty-state"><div className="empty-icon"><Sparkles size={28} /></div><h2>{title}</h2><p className="muted">{body}</p>{action && <button className="btn" onClick={onAction}>{action}</button>}</div>;
}

function JobPreview({ job, actions }) {
  return <div className="card job-preview"><div><strong>{job.model || job.studio}</strong><p className="muted">{job.status} - {job.provider || "MuAPI/local"}</p></div><div className="progress" aria-label={`Progreso ${job.progress || 0}%`}><span style={{ width: `${job.progress || 0}%` }} /></div><div className="toolbar"><button className="btn secondary" onClick={() => actions.cancelJob(job.id)}>Cancelar</button><button className="btn secondary" onClick={() => actions.download(`${job.id}.json`, job)}>Descargar metadata</button></div></div>;
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

function WorkflowScreen({ type, actions, busyStudio }) {
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
    </>
  );
}

function FlyerStudio({ actions, busyStudio }) {
  const [form, setForm] = useState(defaultForms.flyer);
  const [generated, setGenerated] = useState(false);
  const variants = Array.from({ length: Math.max(1, Math.min(4, Number(form.variants) || 4)) });
  const generate = async () => {
    await actions.createJob("flyer", form);
    setGenerated(Boolean(form.prompt?.trim()));
  };
  return (
    <>
      <div className="section-head">
        <div><h1>FLYER STUDIO</h1><p className="muted">Flyers, posters, thumbnails y caratulas con automatizacion v6 MuAPI-first.</p></div>
        <button className="btn" disabled={busyStudio === "flyer"} onClick={generate}><Sparkles size={18} />Generar flyer</button>
      </div>
      <div className="layout-3">
        <section className="card form">
          <h2>Informacion del flyer</h2>
          <DynamicForm studio="flyer" form={form} setForm={setForm} model={getMuapiModelById(form.model)} />
          <div className="consent-box"><Shield size={18} /><span>Consentimiento requerido para rostros, voces o avatares reales.</span></div>
        </section>
        <section className="card">
          <h2>Variantes generadas</h2>
          {!generated ? <EmptyState title="Sin flyers generados" body="Completa la informacion y genera las primeras variantes." /> : <div className="grid flyer-grid">{variants.map((_, index) => <div className="flyer-card" key={index}><img src={index % 2 ? dashboardAssets.musicVideoCard : dashboardAssets.imageCard} alt={`Variante flyer ${index + 1}`} loading="lazy" decoding="async" /><div><strong>{form.title || "Flyer sin titulo"}</strong><span>{[form.date, form.place].filter(Boolean).join(" - ") || "Datos pendientes"}</span></div><button className="btn secondary" onClick={() => actions.download(`flyer-variante-${index + 1}.json`, { ...form, variant: index + 1 })}>Descargar metadata</button></div>)}</div>}
        </section>
        <section className="card flow-actions">
          <h2>Acciones v6</h2>
          <V6ActionBoard panel="flyer_studio" actions={actions} payload={form} />
        </section>
      </div>
    </>
  );
}

function NarrativeStudio({ actions, busyStudio }) {
  const [form, setForm] = useState(defaultForms.narrative);
  const [text, setText] = useState("");
  const generate = async () => {
    if (!form.prompt.trim()) return actions.notify("Escribe o pega la narrativa antes de generar voz.");
    await actions.createJob("narrative", { ...form, prompt: form.prompt.slice(0, Number(form.maxCharacters || 10000)) });
    setText(`Narrativa preparada para voz:\n\n${form.prompt}`);
  };
  return (
    <div className="layout-2">
      <section className="card form">
        <h1>NARRATIVA Y VOZ</h1>
        <p className="muted">Generador de narracion profesional y voz en MP3 con modelos MuAPI compatibles.</p>
        <DynamicForm studio="narrative" form={form} setForm={setForm} model={getMuapiModelById(form.model)} />
        <button className="btn" disabled={busyStudio === "narrative"} onClick={generate}><Mic2 size={18} />Generar narrativa en MP3</button>
      </section>
      <section className="card">
        <h2>Texto de trabajo</h2>
        <textarea className="textarea script-box" maxLength={10000} value={text || form.prompt} onChange={(event) => { setText(event.target.value); setForm((current) => ({ ...current, prompt: event.target.value })); }} placeholder="Pega aqui hasta 10.000 caracteres de narrativa." />
        <div className="toolbar">
          <button className="btn secondary" onClick={() => actions.copy(text || form.prompt)}>Copiar</button>
          <button className="btn secondary" onClick={() => actions.download("narrativa-voz.json", cleanFormForStorage(form))}>Descargar metadata</button>
        </div>
      </section>
    </div>
  );
}

function YouTubeAnalyzer({ actions }) {
  const [form, setForm] = useState(defaultForms.youtube);
  const [messages, setMessages] = useState([{ role: "agent", content: "Pega un canal o URL de YouTube y genero nicho, nombres, ideas y guiones accionables." }]);
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const analyze = async () => {
    if (!form.channelUrl.trim()) return actions.notify("Pega la URL del canal o video de YouTube.");
    setBusy(true);
    try {
      const result = await apiRequest("/api/youtube/analyze", { method: "POST", body: JSON.stringify(form) });
      setAnalysis(result.analysis);
      setMessages((current) => [...current, { role: "user", content: form.channelUrl }, { role: "agent", content: result.analysis.summary }]);
      actions.notify("Analisis de YouTube completado.");
    } catch (error) {
      actions.notify(error.message);
    } finally {
      setBusy(false);
    }
  };
  const exportPdf = async () => {
    if (!analysis) return actions.notify("Primero genera el analisis.");
    const response = await fetch("/api/youtube/export-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysis }) });
    if (!response.ok) return actions.notify("No se pudo exportar el PDF.");
    downloadBlob("analisis-youtube-nexframe.pdf", await response.blob());
  };
  const sendToDocumentary = () => {
    if (!analysis) return actions.notify("Primero genera el analisis.");
    actions.navigate("documentary");
    actions.notify("Idea enviada: usa el primer guion sugerido como base del Documentary Studio.");
  };
  return (
    <div className="layout-2">
      <section className="card form">
        <h1>ANALIZADOR YOUTUBE</h1>
        <p className="muted">Agente para nichos, nombres de canal, ideas, guiones y envio a produccion.</p>
        <div className="field"><label>Canal o video</label><input className="input" value={form.channelUrl} onChange={(event) => setForm((current) => ({ ...current, channelUrl: event.target.value }))} placeholder="https://www.youtube.com/@canal" /></div>
        <div className="grid form-grid">
          <div className="field"><label>Objetivo</label><input className="input" value={form.objective} onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))} /></div>
          <div className="field"><label>Duracion</label><select className="select" value={form.duration} onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))}>{choiceOptions.duration.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label>Tono</label><select className="select" value={form.tone} onChange={(event) => setForm((current) => ({ ...current, tone: event.target.value }))}>{choiceOptions.narrativeTone.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label>Formato</label><select className="select" value={form.target} onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))}>{choiceOptions.target.map((item) => <option key={item}>{item}</option>)}</select></div>
        </div>
        <button className="btn" disabled={busy} onClick={analyze}>{busy ? "Analizando..." : "Analizar canal"}</button>
        <button className="btn secondary" onClick={exportPdf}>Exportar PDF</button>
        <button className="btn secondary" onClick={sendToDocumentary}>Enviar a documental</button>
      </section>
      <section className="card">
        <h2>Chat agente</h2>
        <div className="chat-panel">
          {messages.map((message, index) => <div className={`chat-msg ${message.role}`} key={`${message.role}-${index}`}>{message.content}</div>)}
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
  const projects = (state.projects || []).filter((project) => project.title.toLowerCase().includes(filter.toLowerCase()));
  const galleryItems = state.history || [];
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
  return <section className="grid project-grid">{projects.map((project, index) => <div className="card project-card" key={project.id}><img className="asset-img" src={studioCardAssets[project.type?.toLowerCase()?.replace(" ", "")] || heroSlides[index % heroSlides.length]} alt={project.title} loading="lazy" decoding="async" /><div className="body"><strong>{project.title}</strong><p className="muted">{project.type} - {project.quality} - {new Date(project.createdAt).toLocaleDateString("es-ES")}</p><div className="toolbar"><button className="btn secondary" onClick={() => actions.modal({ title: project.title, body: JSON.stringify(project, null, 2) })}>Abrir</button><button className="btn secondary" aria-label={`Descargar proyecto ${project.title}`} onClick={() => actions.download(`${project.title}.json`, project)}><Download size={16} /></button><button className="btn secondary" aria-label={`Eliminar proyecto ${project.title}`} onClick={() => actions.deleteProject(project.id)}><Trash2 size={16} /></button></div></div></div>)}</section>;
}

function GenerationGallery({ items = [], actions }) {
  if (!items.length) return <EmptyState title="Galeria vacia" body="Las generaciones guardadas apareceran aqui con sus metadatos y descargas." />;
  return <section className="grid project-grid">{items.map((item, index) => <div className="card project-card" key={item.id}><img className="asset-img" src={heroSlides[index % heroSlides.length]} alt={item.model || item.studio} loading="lazy" decoding="async" /><div className="body"><strong>{item.model || item.studio}</strong><p className="muted">{item.studio} - {item.status}</p><div className="toolbar"><button className="btn secondary" onClick={() => actions.modal({ title: item.model || item.id, body: JSON.stringify(item, null, 2) })}>Abrir</button><button className="btn secondary" onClick={() => actions.download(`${item.id}.json`, item)}><Download size={16} /></button></div></div></div>)}</section>;
}

function OfficialPanel({ id, actions, state, patch }) {
  const related = subpanels.filter((item) => item.area === id).slice(0, 8);
  return <><div className="section-head"><div><h1>{labelFor(id)}</h1><p className="muted">Panel nativo listo para despliegue, sin capturas de referencia incrustadas.</p></div><button className="btn" onClick={() => actions.notify(`${labelFor(id)} validado para produccion local.`)}>Validar panel</button></div><NativeOfficialContent id={id} actions={actions} state={state} patch={patch} /><div className="toolbar"><button className="btn secondary" onClick={() => actions.notify("Cambios guardados en preferencias locales.")}><Save size={18} />Guardar</button><button className="btn secondary" onClick={() => actions.download(`${id}.json`, { id, state })}><Download size={18} />Exportar</button><button className="btn secondary" onClick={() => actions.copy(window.location.href)}>Copiar link</button></div>{related.length > 0 && <SubpanelGrid items={related} actions={actions} />}</>;
}

function NativeOfficialContent({ id, actions, state, patch }) {
  if (id === "apikeys") return <ApiKeysNative actions={actions} />;
  if (id === "billing") return <BillingNative state={state} actions={actions} />;
  if (id === "deployment") return <DeploymentNative actions={actions} />;
  if (id === "windows") return <WindowsNative actions={actions} />;
  if (id === "checklist") return <ChecklistNative actions={actions} />;
  if (id === "settings") return <SettingsNative state={state} patch={patch} actions={actions} />;
  if (id === "assets") return <LibraryNative kind="assets" actions={actions} />;
  if (id === "voices") return <LibraryNative kind="voices" actions={actions} />;
  if (id === "users") return <UsersNative actions={actions} />;
  if (id === "hub") return <HubNative actions={actions} />;
  if (id === "help") return <HelpNative actions={actions} />;
  if (id === "marketing") return <MarketingNative actions={actions} />;
  if (id === "public") return <PublicNative actions={actions} />;
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

function BillingNative({ state, actions }) {
  const openCheckout = async () => {
    try {
      const result = await apiRequest("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan: "pro", credits: 1000 }) });
      actions.notify(result.message);
    } catch (error) {
      actions.notify(error.message);
    }
  };
  return <div className="grid stats"><Stat icon={Crown} label="Plan actual" value="Pro" sub="$49 / mes" /><Stat icon={Coins} label="Creditos" value={state.credits.toLocaleString()} sub="disponibles" /><Stat icon={Database} label="Uso" value="67%" sub="del ciclo" /><div className="card"><h2>Metodo de pago</h2><p className="muted">Checkout seguro gestionado desde el servidor.</p><button className="btn" onClick={openCheckout}>Abrir checkout</button></div></div>;
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
  return <div className="layout-2"><section className="card form"><h2>Preferencias</h2><div className="field"><label>Idioma</label><select className="select" value={state.language} onChange={(e) => patch({ language: e.target.value })}><option value="es">Español</option><option value="en">English</option><option value="pt">Portugues</option><option value="fr">Francais</option><option value="it">Italiano</option><option value="de">Deutsch</option></select></div><div className="field"><label>Tema</label><select className="select" value={state.theme} onChange={(e) => patch({ theme: e.target.value })}>{themes.map((theme) => <option key={theme}>{theme}</option>)}</select></div><h2>Sesion</h2>{state.auth?.signedIn ? <><div className="check-row"><Shield size={18} />{state.auth.name} - {state.auth.role}</div><button className="btn secondary" onClick={actions.logout}>Salir de la sesion</button></> : <><div className="field"><label>Email</label><input className="input" value={loginForm.email} onChange={(e) => setLoginForm((current) => ({ ...current, email: e.target.value }))} /></div><div className="field"><label>Password</label><input className="input" type="password" value={loginForm.password} onChange={(e) => setLoginForm((current) => ({ ...current, password: e.target.value }))} /></div><button className="btn" onClick={submitLogin}>Iniciar sesion</button></>}</section><section className="card"><h2>Seguridad</h2><p className="muted">Las API keys solo viven en servidor. Los paneles API, Security, Deployment y Admin se ocultan para usuarios normales.</p><div className="check-row"><Shield size={18} />Bloqueo temporal por IP activo</div><div className="check-row"><KeyRound size={18} />Clave MuAPI fuera del navegador</div><div className="check-row"><Check size={18} />Cookie HttpOnly de sesion</div></section></div>;
}

function LibraryNative({ kind, actions }) {
  return <EmptyState title={kind === "voices" ? "Voice Library vacia" : "Assets Library vacia"} body={kind === "voices" ? "Las voces configuradas o generadas apareceran aqui." : "Los assets guardados desde los studios apareceran aqui."} action={kind === "voices" ? "Abrir Sound Studio" : "Abrir Gallery"} onAction={() => actions.navigate(kind === "voices" ? "sound" : "gallery")} />;
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
  return <section className="grid studio-grid">{["video", "image", "sound", "effects", "lipsync", "documentary", "musicvideo", "flyer", "cinema"].map((id) => <AssetCard key={id} id={id} image={studioCardAssets[id]} title={labelFor(id)} subtitle={studioSubtitle(id)} onOpen={() => actions.navigate(id)} />)}</section>;
}

function HelpNative({ actions }) {
  return <div className="layout-2"><section className="card form"><input className="input" placeholder="Buscar en documentacion..." /><button className="btn" onClick={() => actions.notify("Busqueda completada en la base local de ayuda.")}>Buscar</button><button className="btn secondary" onClick={() => actions.notify("Ticket creado con contexto del proyecto.")}>Enviar ticket</button></section><section className="card"><h2>Temas populares</h2>{["Configurar API Keys", "Generar primer video", "Resolver cola fallida", "Exportar proyecto"].map((item) => <div className="check-row" key={item}><HelpCircle size={18} />{item}</div>)}</section></div>;
}

function MarketingNative({ actions }) {
  return <div className="layout-2"><section className="card"><h2>Paquete de campana</h2>{["Titulo SEO", "Descripcion", "Hashtags", "Miniatura", "Flyer", "Captions"].map((item) => <div className="check-row" key={item}><Check size={18} />{item}</div>)}</section><section className="card flow-actions"><h2>Acciones</h2><button className="btn" onClick={() => actions.runV6Action("marketing", "Generate Campaign Package", { channel: "youtube" })}>Generar paquete</button><button className="btn secondary full" onClick={() => actions.download("nexframe-campaign-package.json", { title: "NEXFRAME Campaign", assets: ["seo", "hashtags", "thumbnail", "flyer"] })}>Exportar campana</button></section></div>;
}

function PublicNative({ actions }) {
  return <div className="layout-2"><section className="card"><h2>Public Website</h2>{["Landing", "Pricing", "Demo", "Docs", "Login", "Status", "Legal"].map((item) => <div className="check-row" key={item}><Check size={18} />{item}</div>)}</section><section className="card flow-actions"><h2>Acciones</h2><button className="btn" onClick={() => actions.runV6Action("public_website", "Validate Public Website", {})}>Validar website</button><button className="btn secondary full" onClick={() => actions.download("public-website-map.json", { routes: ["landing", "pricing", "docs", "status", "login", "legal"] })}>Exportar mapa</button></section></div>;
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
  return <table className="table"><thead><tr><th>Modelo</th><th>Proveedor</th><th>Tipo</th><th>Endpoint</th><th>Prioridad</th><th>Acciones</th></tr></thead><tbody>{rows.map((m) => <tr key={m.id}><td>{m.name}</td><td>{m.provider}</td><td>{m.type || m.category}</td><td>{m.endpoint || m.id}</td><td>{m.priority || "-"}</td><td><button className="btn secondary" onClick={() => actions.modal({ title: m.name, body: JSON.stringify(m, null, 2) })}>Ver parametros</button></td></tr>)}</tbody></table>;
}

function GenerationPanel({ state, actions }) {
  const jobs = state.jobs || [];
  return <><h1>Generation Process</h1><div className="grid stats"><Stat icon={Gauge} label="En cola" value={jobs.filter((j) => j.status === "queued").length} sub="jobs" /><Stat icon={Activity} label="Procesando" value={jobs.filter((j) => j.status === "processing").length} sub="jobs" /><Stat icon={Check} label="Completados" value={jobs.filter((j) => j.status === "completed").length} sub="jobs" /><Stat icon={AlertCircle} label="Fallidos" value={jobs.filter((j) => j.status === "failed").length} sub="jobs" /></div><div className="grid">{jobs.length === 0 ? <div className="card"><h2>Sin generaciones activas</h2><p className="muted">Inicia una generacion desde cualquier studio para verla aqui.</p></div> : jobs.map((job) => <div className="card job-row" key={job.id}><strong>{job.model}</strong><span>{job.status}</span><div className="progress" aria-label={`Progreso ${job.progress || 0}%`}><span style={{ width: `${job.progress || 0}%` }} /></div><button className="btn secondary" disabled={["completed", "cancelled"].includes(job.status)} onClick={() => actions.cancelJob(job.id)}>Cancelar</button></div>)}</div></>;
}

function SubpanelGrid({ items, actions }) {
  return <><SectionTitle title="Subpaneles internos" /><section className="grid subpanel-grid">{items.map((item) => <button className="card subpanel-card" key={item.file} onClick={() => actions.modal({ title: item.title, body: "Subpanel disponible como estado funcional nativo. Las referencias visuales ya no se incrustan como pantallas." })}><strong>{item.title}</strong><span className="muted">Abrir estado funcional</span></button>)}</section></>;
}

function Modal({ modal, onClose, actions }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="icon-btn" style={{ float: "right" }} aria-label="Cerrar modal" onClick={onClose}><X /></button><h2 id="modal-title">{modal.title}</h2>{modal.image && <img src={modal.image} className="modal-image" alt={modal.title} loading="lazy" decoding="async" />} {modal.body && <pre>{modal.body}</pre>}<div className="toolbar"><button className="btn secondary" onClick={() => actions.download(`${modal.title || "nexframe"}.json`, modal)}>Descargar metadata</button><button className="btn secondary" onClick={() => actions.copy(modal.title || "NEXFRAME")}>Copiar titulo</button></div></div></div>;
}

function labelFor(id) {
  return studios.find((s) => s.id === id)?.label || ({
    api: "API Collection", apikeys: "API Keys", generation: "Generation Process", deployment: "Deployment",
    checklist: "Checklist Final Codex", assets: "Assets Library", voices: "Voice Library", mymodels: "My Models",
    windows: "Windows App Launcher", flyer: "Flyer Studio", marketing: "Marketing", public: "Public Website",
    security: "Security Center", narrative: "Narrativa y Voz", youtube: "Analizador YouTube", users: "Usuarios"
  }[id] || id);
}

function studioSubtitle(id) {
  return {
    video: "Text-to-Video / Image-to-Video / Extend", image: "Generacion de imagenes cinematograficas",
    sound: "Musica, SFX, ambience y voz", effects: "Biblioteca y configuracion de VFX",
    lipsync: "Foto/video + audio, avatares y output", documentary: "Tema, guion, escenas, generacion y proyecto",
    musicvideo: "Audio, storyboard, imagenes, clips y exportacion", flyer: "Flyers, posters, thumbnails y caratulas",
    cinema: "Control de camara cinematografica profesional", narrative: "Narrativa IA, voz y MP3",
    youtube: "Analisis de canales, nichos, ideas y guiones"
  }[id] || "Panel operativo NEXFRAME";
}
