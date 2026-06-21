import test from "node:test";
import assert from "node:assert/strict";
import { productionManifest, productionProgress, updateProductionStage, validateProductionRequest } from "../lib/production-engine.js";

test("Flyer crea un flujo editable con entrega", () => {
  const stages = productionManifest("flyer", { designType: "Miniatura YouTube" });
  assert.equal(stages[0].id, "brief");
  assert.equal(stages.at(-1).id, "delivery");
  assert.ok(stages.some((stage) => stage.capability === "image"));
});

test("Marketing estático no programa video, voz ni música", () => {
  const stages = productionManifest("marketing", { outputType: "Miniatura YouTube" });
  assert.equal(stages.some((stage) => ["video", "audio", "music"].includes(stage.capability)), false);
});

test("El progreso solo aumenta por estados reales", () => {
  const stages = productionManifest("image", {});
  assert.equal(productionProgress(stages), 0);
  const processing = updateProductionStage(stages, "brief", { status: "processing" });
  assert.equal(productionProgress(processing), 13);
  const completed = updateProductionStage(processing, "brief", { status: "completed" });
  assert.equal(productionProgress(completed), 25);
});

test("Valida requisitos específicos de Flyer y Marketing", () => {
  assert.equal(validateProductionRequest("flyer", { prompt: "Fiesta" }).ok, false);
  assert.equal(validateProductionRequest("marketing", { prompt: "Campaña" }).ok, false);
  assert.equal(validateProductionRequest("marketing", { prompt: "Campaña", productName: "Producto" }).ok, true);
});
