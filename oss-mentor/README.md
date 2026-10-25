# Beginner Open-Source Mentor

An AI-powered mentor that runs 100% locally to help newcomers understand open-source repositories, demystify GitHub issues, and navigate Git without intimidation.

## Features

- **Repository Explainer**: Paste any GitHub repository URL to receive a beginner-friendly breakdown of its purpose, tech stack, key directories, and steps to get started.
- **Issue Explainer**: Decode complex GitHub issues into plain English, assess difficulty for first-time contributors, and highlight key files to inspect.
- **Git Helper**: Troubleshoot Git errors or confusion with concise, 3-sentence explanations followed by the exact terminal commands needed.

## Prerequisites

- **Node.js**: Version 18+ installed
- **Ollama**: Installed and running locally

## Setup

Run the following commands to set up and start the application:

```bash
ollama pull gemma:2b
OLLAMA_ORIGINS="*" ollama serve   # in a separate terminal
npm install
npm run dev
```

> **Note for Windows PowerShell:** Set the environment variable using `$env:OLLAMA_ORIGINS="*"; ollama serve`.

### Why `OLLAMA_ORIGINS="*"` is Needed
The `OLLAMA_ORIGINS="*"` flag permits Cross-Origin Resource Sharing (CORS) so your local browser app on `http://localhost:5173` can securely stream responses directly from the local Ollama API.

## Tech Stack

- **Frontend**: React 19, Vite
- **Styling**: Tailwind CSS v4
- **Markdown Support**: `react-markdown`
- **Local LLM Engine**: Ollama running `gemma:2b` via NDJSON streaming
- **External Integration**: GitHub REST API (public endpoints for README, file tree, and issues)

## Hackathon Pitch

Open source can be intimidating for newcomers who face dense codebases, jargon-heavy issue descriptions, and cryptic Git errors. Beginner Open-Source Mentor solves this problem by serving as a patient, always-available guide that runs entirely in the browser and on local hardware with zero API keys and absolute data privacy. By translating open-source conventions into approachable first steps, it empowers the next million developers to make their first contribution with confidence.
