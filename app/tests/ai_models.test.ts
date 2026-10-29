import { describe, expect, test } from "bun:test";
import { AIService } from "../ai_service";

describe("AI Service available models and recommendations", () => {
  const aiService = new AIService();

  test("builtin provider returns local deterministic engine as recommended", async () => {
    const result = await aiService.getAvailableModelsForProvider("builtin");
    expect(result.success).toBe(true);
    expect(result.models.length).toBeGreaterThan(0);
    expect(result.recommendedModel).toBe("builtin");
    expect(result.models[0].recommended).toBe(true);
  });

  test("openai provider without an API key returns a prompt to enter key", async () => {
    const result = await aiService.getAvailableModelsForProvider("openai", "");
    expect(result.success).toBe(false);
    expect(result.models.length).toBe(0);
    expect(result.error).toContain("API key is not entered yet");
  });

  test("anthropic provider with invalid key returns clear authentication error", async () => {
    const result = await aiService.getAvailableModelsForProvider("anthropic", "sk-ant-invalid-test-12345");
    expect(result.success).toBe(false);
    expect(result.models.length).toBe(0);
    expect(result.error).toContain("Authentication failed");
  });

  test("gemini provider without an API key returns a prompt to enter key", async () => {
    const result = await aiService.getAvailableModelsForProvider("gemini", "");
    expect(result.success).toBe(false);
    expect(result.models.length).toBe(0);
    expect(result.error).toContain("Google Gemini API key is not entered yet");
  });

  test("gemini recommended model resolves to fast economical flash tier", async () => {
    const rec = await aiService.getRecommendedModel("gemini");
    expect(rec.recommendedModel).toMatch(/gemini-2\.[0-9]-flash|flash/i);
    expect(rec.tier).toBe("cheap_and_best");
    expect(rec.reason).toContain("Flash");
  });

  test("openrouter provider without an API key returns a prompt to enter key", async () => {
    const result = await aiService.getAvailableModelsForProvider("openrouter", "");
    expect(result.success).toBe(false);
    expect(result.models.length).toBe(0);
    expect(result.error).toContain("OpenRouter API key is not entered yet");
  });

  test("openrouter recommended model resolves to fast multi-cloud route", async () => {
    const rec = await aiService.getRecommendedModel("openrouter");
    expect(rec.recommendedModel).toMatch(/gemini-2\.[0-9]-flash|flash/i);
    expect(rec.tier).toBe("cheap_and_best");
    expect(rec.reason).toContain("OpenRouter");
  });

  test("nvidia provider without an API key returns a prompt to enter key", async () => {
    const result = await aiService.getAvailableModelsForProvider("nvidia", "");
    expect(result.success).toBe(false);
    expect(result.models.length).toBe(0);
    expect(result.error).toContain("NVIDIA Build API key is not entered yet");
  });

  test("nvidia recommended model resolves to Llama or Nemotron on NIM", async () => {
    const rec = await aiService.getRecommendedModel("nvidia");
    expect(rec.recommendedModel).toMatch(/llama|nemotron/i);
    expect(rec.tier).toBe("cheap_and_best");
    expect(rec.reason).toContain("NVIDIA NIM");
  });

  test("AIService persists and reflects public status for Gemini, OpenRouter, and NVIDIA", () => {
    const customService = new AIService({
      provider: "gemini",
      geminiApiKey: "test-gemini-key",
      geminiModel: "gemini-2.5-flash",
      openrouterApiKey: "test-openrouter-key",
      openrouterModel: "deepseek/deepseek-chat",
      nvidiaApiKey: "test-nvidia-key",
      nvidiaModel: "meta/llama-3.3-70b-instruct"
    });
    const pub = customService.getPublicConfig();
    expect(pub.hasGeminiKey).toBe(true);
    expect(pub.hasOpenRouterKey).toBe(true);
    expect(pub.hasNvidiaKey).toBe(true);
    expect(pub.geminiModel).toBe("gemini-2.5-flash");
    expect(pub.openrouterModel).toBe("deepseek/deepseek-chat");
    expect(pub.nvidiaModel).toBe("meta/llama-3.3-70b-instruct");
  });
});
