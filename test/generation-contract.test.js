import test from "node:test";
import assert from "node:assert/strict";
import {
  assertRemoteGenerationReady,
  createGenerationJob,
  isRealOutput,
  markJobCompleted
} from "../lib/generation-contract.js";

test("rechaza una generacion sin credencial MuAPI", () => {
  assert.throws(
    () => assertRemoteGenerationReady({ apiKey: "", endpoint: "veo3", prompt: "Plano cinematografico" }),
    /MUAPI_API_KEY/
  );
});

test("rechaza una generacion sin endpoint real", () => {
  assert.throws(
    () => assertRemoteGenerationReady({ apiKey: "key", endpoint: "", prompt: "Plano cinematografico" }),
    /modelo compatible/
  );
});

test("crea el job al 10% sin resultados ficticios", () => {
  const job = createGenerationJob({ studio: "video", model: "veo3", input: { prompt: "Plano cinematografico" } });
  assert.equal(job.status, "queued");
  assert.equal(job.progress, 10);
  assert.deepEqual(job.outputs, []);
  assert.equal(job.stages[0].status, "queued");
});

test("solo acepta URLs HTTP(S) multimedia como salida real", () => {
  assert.equal(isRealOutput({ url: "/api/outputs/fake", mimeType: "application/json" }), false);
  assert.equal(isRealOutput({ url: "https://cdn.example.com/render.mp4", mimeType: "video/mp4" }), true);
  assert.equal(isRealOutput({ url: "https://cdn.example.com/result", type: "video" }), true);
  assert.equal(isRealOutput({ project: { timeline: [] }, type: "metadata" }), false);
});

test("acepta un archivo local persistido bajo uploads con bytes reales", () => {
  assert.equal(isRealOutput({ url: "/uploads/generations/image/job_1.jpg", mimeType: "image/jpeg", bytes: 2048 }), true);
});

test("no permite completar un job sin archivo real", () => {
  const job = createGenerationJob({ studio: "image", model: "flux", input: { prompt: "Retrato" } });
  assert.throws(() => markJobCompleted(job, [{ url: "/api/outputs/fake", mimeType: "application/json" }]), /archivo multimedia real/);
});

test("completa al 100% cuando existe una URL multimedia real", () => {
  const job = createGenerationJob({ studio: "image", model: "flux", input: { prompt: "Retrato" } });
  const completed = markJobCompleted(job, [{ url: "https://cdn.example.com/image.png", mimeType: "image/png" }]);
  assert.equal(completed.status, "completed");
  assert.equal(completed.progress, 100);
  assert.equal(completed.outputs.length, 1);
  assert.ok(completed.stages.every((stage) => stage.status === "completed"));
});
