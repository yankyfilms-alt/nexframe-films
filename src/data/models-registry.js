import { getMuapiModelById, getMuapiModelsForStudio, muapiRegistry } from "./muapiRegistry.js";

export { getMuapiModelById, getMuapiModelsForStudio, muapiRegistry };

export function getModelContract(modelId) {
  const model = getMuapiModelById(modelId);
  if (!model) return null;
  const inputs = model.inputs || {};
  const mediaNames = [model.imageField, model.videoField, model.audioField]
    .filter(Boolean)
    .concat(Object.keys(inputs).filter((name) => name.endsWith("_url") || ["image", "video", "audio", "images_list", "audios_list"].includes(name)));
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    endpoint: model.endpoint,
    type: model.type,
    output_type: model.type?.includes("v") ? "video" : model.type?.includes("audio") ? "audio" : "image",
    parameters: Object.entries(inputs).map(([name, schema]) => ({
      name,
      title: schema.title || name,
      type: schema.type || "string",
      required: Boolean(schema.required || name === "prompt"),
      default: schema.default,
      enum: schema.enum,
      minimum: schema.minimum ?? schema.minValue,
      maximum: schema.maximum ?? schema.maxValue,
      description: schema.description || ""
    })),
    medias: [...new Set(mediaNames)]
      .map((name) => ({
        name,
        role: name.replace(/_url$/, ""),
        type: name.includes("audio") ? "audio" : name.includes("video") ? "video" : "image"
      })),
    aspect_ratios: inputs.aspect_ratio?.enum || [],
    duration_range: inputs.duration ? {
      minimum: inputs.duration.minimum ?? inputs.duration.minValue,
      maximum: inputs.duration.maximum ?? inputs.duration.maxValue,
      options: inputs.duration.enum || null
    } : null
  };
}

export function getStudioContracts(studio) {
  return getMuapiModelsForStudio(studio).map((model) => getModelContract(model.id)).filter(Boolean);
}
