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

  test("Model availability filters exclude deprecated, embedding, and non-chat models across all AI services", () => {
    // OpenRouter filtering
    expect(aiService.isOpenRouterChatModelValid({ id: "google/gemini-2.5-flash", context_length: 1048576, architecture: { output_modalities: ["text"] }, endpoints: ["/api/v1/chat/completions"] })).toBe(true);
    expect(aiService.isOpenRouterChatModelValid("google/gemini-2.0-flash-001")).toBe(false); // Discontinued on OpenRouter
    expect(aiService.isOpenRouterChatModelValid({ id: "openai/text-embedding-3-small", context_length: 8191 })).toBe(false);
    expect(aiService.isOpenRouterChatModelValid({ id: "black-forest-labs/flux-1-schnell", architecture: { output_modalities: ["image"] } })).toBe(false);
    expect(aiService.isOpenRouterChatModelValid({ id: "old/model:deprecated", context_length: 4096 })).toBe(false);
    expect(aiService.isOpenRouterChatModelValid({ id: "some/expired-model", expiration_date: "2024-01-01T00:00:00Z", context_length: 4096 })).toBe(false);

    // NVIDIA filtering
    expect(aiService.isNvidiaChatModelValid("nvidia/nemotron-3.5-lightning-30b-a3b")).toBe(true);
    expect(aiService.isNvidiaChatModelValid("meta/llama-3.2-11b-vision-instruct")).toBe(true);
    expect(aiService.isNvidiaChatModelValid("meta/llama-3.3-70b-instruct")).toBe(false); // EOL on NIM
    expect(aiService.isNvidiaChatModelValid("nvidia/nemotron-4-340b-instruct")).toBe(false); // 404
    expect(aiService.isNvidiaChatModelValid("nvidia/llama-3.2-nv-embedqa-1b-v1")).toBe(false); // Embedding
    expect(aiService.isNvidiaChatModelValid("nvidia/llama-3.1-nemoguard-8b-content-safety")).toBe(false); // Guardrail

    // Gemini filtering
    expect(aiService.isGeminiChatModelValid("gemini-2.5-flash")).toBe(true);
    expect(aiService.isGeminiChatModelValid("gemini-2.0-flash")).toBe(false); // Discontinued on Google Gemini
    expect(aiService.isGeminiChatModelValid("gemini-2.5-pro")).toBe(true);
    expect(aiService.isGeminiChatModelValid("gemini-2.5-flash-preview-tts")).toBe(false); // TTS
    expect(aiService.isGeminiChatModelValid("gemini-3.1-flash-image")).toBe(false); // Image
    expect(aiService.isGeminiChatModelValid("gemini-robotics-er-2-preview")).toBe(false); // Robotics
    expect(aiService.isGeminiChatModelValid("text-embedding-004")).toBe(false); // Embedding

    // Anthropic and OpenAI filtering
    expect(aiService.isAnthropicChatModelValid("claude-3-5-sonnet-latest")).toBe(true);
    expect(aiService.isAnthropicChatModelValid("claude-1.3")).toBe(false);
    expect(aiService.isOpenAiChatModelValid("gpt-4o-mini")).toBe(true);
    expect(aiService.isOpenAiChatModelValid("text-embedding-ada-002")).toBe(false);
  });

  test("parseAndRecordGenerationError classifies exhausted usage, rate limits, timeouts, and deprecated models", () => {
    // 1. Credit / Free quota exhaustion (HTTP 402)
    const err402 = aiService.parseAndRecordGenerationError("openrouter", "google/gemini-2.0-flash-001", 402, "Insufficient credits in account balance");
    expect(err402.category).toBe("exhausted_credits");
    expect(err402.title).toContain("Exhausted");
    expect(err402.suggestedAction).toContain("Switch to an available free model");

    // 2. Rate limiting (HTTP 429)
    const err429 = aiService.parseAndRecordGenerationError("openrouter", "nvidia/nemotron-3.5-lightning:free", 429, "Rate limit exceeded: too many requests per minute");
    expect(err429.category).toBe("rate_limited");
    expect(err429.title).toContain("Rate Limit");

    // 3. Stalled / Slow inference timeout
    const timeoutErr = new Error("The operation was aborted due to timeout");
    timeoutErr.name = "TimeoutError";
    const errTimeout = aiService.parseAndRecordGenerationError("openrouter", "some-slow-model", timeoutErr);
    expect(errTimeout.category).toBe("timeout_slow");
    expect(errTimeout.title).toContain("Timeout");

    // 4. Deprecated / EOL model (HTTP 410)
    const err410 = aiService.parseAndRecordGenerationError("nvidia", "meta/llama-3.3-70b-instruct", 410, "Model has reached its end of life");
    expect(err410.category).toBe("deprecated_unavailable");
    expect(err410.title).toContain("Deprecated");
  });

  test("generateJobChatResponse renders clear actionable alert banner when cloud model fails", async () => {
    // Service configured with invalid OpenRouter key to trigger error path
    const failingService = new AIService({
      provider: "openrouter",
      openrouterApiKey: "sk-or-invalid-test-key",
      openrouterModel: "meta-llama/llama-3.3-70b-instruct"
    });

    const mockProfile: any = {
      name: "Alex Candidate",
      headline: "DevOps Engineer",
      skills: { cloud: ["AWS", "Azure"], devops: ["Kubernetes", "Docker"] },
      experience: []
    };
    const mockJob: any = {
      company: "Acme Cloud",
      title: "Senior DevOps Engineer",
      location: "London, UK",
      description: "Kubernetes and cloud automation"
    };

    const reply = await failingService.generateJobChatResponse(mockProfile, mockJob, "Draft my LinkedIn message");

    // Must prominently display error banner with exact provider and action
    expect(reply).toContain("⚠️");
    expect(reply).toContain("OPENROUTER");
    expect(reply).toContain("Switch Model");
    expect(reply).toContain("Offline Co-Pilot Insight (Fallback)");
    expect(reply).toContain("Acme Cloud");
  });
});
