/**
 * Streams response chunks from a local Ollama instance using NDJSON.
 *
 * @param {string} model - The model name (e.g. 'gemma:2b')
 * @param {string} prompt - The user prompt
 * @param {string} [system] - Optional system prompt
 * @param {string} [baseUrl] - Base Ollama API url (default: 'http://localhost:11434')
 * @returns {AsyncGenerator<string, void, unknown>}
 */
export async function* streamOllama(model, prompt, system, baseUrl = 'http://localhost:11434') {
  let res;
  const primaryUrl = (baseUrl || 'http://localhost:11434').replace(/\/$/, '');
  const urlsToTry = [
    `${primaryUrl}/api/generate`,
    primaryUrl.includes('localhost')
      ? primaryUrl.replace('localhost', '127.0.0.1') + '/api/generate'
      : null,
  ].filter(Boolean);

  let lastError = null;
  for (const url of urlsToTry) {
    try {
      res = await fetch(url, {
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
      if (res.ok && res.body) break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!res || !res.ok || !res.body) {
    throw new Error(
      `Could not reach Ollama at ${primaryUrl}. Make sure you ran $env:OLLAMA_ORIGINS="*" ; ollama serve and ollama pull ${model || 'gemma:2b'}.`
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
