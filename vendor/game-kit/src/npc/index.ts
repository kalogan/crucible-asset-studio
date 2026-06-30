// game-kit/npc — server-side NPC reasoning (conversations + memory) over a
// provider-agnostic seam. Grok is just an OpenAI-compatible provider.
//
// SERVER-SIDE ONLY: real providers hold an API key and make network calls. Keep
// this entry out of client/browser bundles. The firewall (parseReasoningResponse)
// is the security boundary — a model can only ever emit the bounded intent vocabulary.

export * from './schema.js';
export * from './prompt.js';
export * from './provider.js';
export * from './openaiProvider.js';
export * from './mockProvider.js';
export * from './budgetedProvider.js';
export * from './memory.js';
export * from './store.js';
export * from './summarizer.js';
export * from './embedder.js';
export * from './brain.js';
