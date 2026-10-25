import { streamOllama } from './ollama.js';

async function testOllama() {
  console.log('Testing streamOllama with gemma:2b...');
  try {
    let result = '';
    for await (const chunk of streamOllama('gemma:2b', 'Say hello in 5 words.', 'You are terse.')) {
      result += chunk;
      process.stdout ? process.stdout.write(chunk) : null;
    }
    console.log('\n\nFinal Ollama response:', result);
  } catch (err) {
    console.error('Ollama test error:', err.message);
  }
}

testOllama();
