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
});
