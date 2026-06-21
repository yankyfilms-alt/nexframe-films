import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const OPENMONTAGE_ROOT = path.join(process.cwd(), "vendor", "OpenMontage");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function yamlScalar(source, key, fallback = "") {
  const match = source.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?\\s*$`, "m"));
  return match ? match[1].trim() : fallback;
}

function yamlListBlock(source, key) {
  const match = source.match(new RegExp(`^${key}:\\s*\\n((?:\\s+-\\s+[^\\n]+\\n?)+)`, "m"));
  if (!match) return [];
  return match[1].split(/\r?\n/).map((line) => line.replace(/^\s+-\s+/, "").trim()).filter(Boolean);
}

function parsePipelineManifest(filePath) {
  const source = readText(filePath);
  const stages = [...source.matchAll(/^\s+- name:\s*([a-z0-9_-]+)/gim)].map((match) => match[1]);
  const tools = [...new Set([
    ...yamlListBlock(source, "required_tools"),
    ...yamlListBlock(source, "optional_tools"),
    ...yamlListBlock(source, "tools_available")
  ])].sort();
  return {
    id: path.basename(filePath, ".yaml"),
    name: yamlScalar(source, "name", path.basename(filePath, ".yaml")),
    version: yamlScalar(source, "version", ""),
    category: yamlScalar(source, "category", "production"),
    stability: yamlScalar(source, "stability", "unknown"),
    stages,
    tools,
    source: filePath.replace(process.cwd(), "").replace(/^[/\\]/, "")
  };
}

function listFilesSafe(dirPath, extension = "") {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (!extension || entry.name.endsWith(extension)))
    .map((entry) => path.join(dirPath, entry.name));
}

function discoverToolFamilies() {
  const toolsRoot = path.join(OPENMONTAGE_ROOT, "tools");
  if (!fs.existsSync(toolsRoot)) return [];
  return fs.readdirSync(toolsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const folder = path.join(toolsRoot, entry.name);
      const tools = listFilesSafe(folder, ".py")
        .map((file) => path.basename(file, ".py"))
        .filter((name) => name !== "__init__" && !name.startsWith("_"));
      return { family: entry.name, count: tools.length, tools };
    })
    .filter((family) => family.count > 0)
    .sort((a, b) => a.family.localeCompare(b.family));
}

async function commandAvailable(command, args = ["--version"]) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout: 6000 });
    return { ok: true, detail: String(stdout || stderr).split(/\r?\n/)[0] || "Disponible" };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}

export async function openMontageStatus() {
  const installed = fs.existsSync(OPENMONTAGE_ROOT);
  const pipelineDir = path.join(OPENMONTAGE_ROOT, "pipeline_defs");
  const pipelines = installed
    ? listFilesSafe(pipelineDir, ".yaml").map(parsePipelineManifest)
    : [];
  const toolFamilies = installed ? discoverToolFamilies() : [];
  const [python, ffmpeg, node] = await Promise.all([
    commandAvailable("py", ["--version"]),
    commandAvailable("ffmpeg", ["-version"]),
    commandAvailable("node", ["--version"])
  ]);
  return {
    ok: installed,
    root: OPENMONTAGE_ROOT,
    installed,
    runtimes: { python, ffmpeg, node },
    pipelines,
    toolFamilies,
    totals: {
      pipelines: pipelines.length,
      toolFamilies: toolFamilies.length,
      tools: toolFamilies.reduce((total, family) => total + family.count, 0)
    }
  };
}
