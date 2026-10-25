/**
 * Streams response chunks from a local Ollama instance using NDJSON.
 *
 * @param {string} model - The model name (e.g. 'gemma:2b')
 * @param {string} prompt - The user prompt
 * @param {string} [system] - Optional system prompt
 * @returns {AsyncGenerator<string, void, unknown>}
 */
export async function* streamOllama(model, prompt, system) {
  let res;
  try {
    res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        system,
        stream: true,
      }),
    });
  } catch {
    throw new Error(
      "Could not reach Ollama. Make sure you ran OLLAMA_ORIGINS='*' ollama serve and ollama pull gemma:2b."
    );
  }

  if (!res.ok || !res.body) {
    throw new Error(
      "Could not reach Ollama. Make sure you ran OLLAMA_ORIGINS='*' ollama serve and ollama pull gemma:2b."
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          if (json.response) {
            yield json.response;
          }
        } catch {
          // Ignore partial or malformed lines
        }
      }
    }

    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer.trim());
        if (json.response) {
          yield json.response;
        }
      } catch {
        // Ignore
      }
    }
  } finally {
    reader.releaseLock();
  }
}
