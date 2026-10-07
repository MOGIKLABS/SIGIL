# Sigil

**Your music. Your intent. Verified.**

A hackathon prototype exploring consent and attribution checks for AI-generated music, anchored in the UK Copyright, Designs and Patents Act 1988.

Built by Mogik Labs 無極實驗室 at the Mozart AI hackathon, 2026.

## Status

Archived prototype. Kept as a record of the original concept. Not maintained and not production software.

## What it does

1. You describe a track in plain text.
2. A language model reviews the description and returns a green, amber or red consent status with a short reason.
3. Green and amber descriptions are sent on to generate audio. Red is blocked.
4. The result is shown with a Sigil ID.

## Known limits

- It analyses the text description only. It does not analyse audio.
- The Sigil ID is generated in the browser and is not stored anywhere.
- API keys are read in the browser, so this must not be deployed publicly with real keys.
- The legal basis line is model output, not legal advice.

## Stack

React 19, Vite, OpenAI API, ElevenLabs music API.

## Run locally

```bash
npm install
cp .env.example .env   # then add your own keys
npm run dev
```

Requires `VITE_OPENAI_API_KEY` and `VITE_ELEVENLABS_API_KEY`.

## Contact

hello@mogiklabs.com · mogiklabs.com
