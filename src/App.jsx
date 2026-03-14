import { useState } from 'react'
import OpenAI from 'openai'
import './App.css'

const STATUS_CONFIG = {
  GREEN: {
    label: 'Export Ready',
    color: '#16a34a',
    bg: '#dcfce7',
    border: '#86efac',
    dot: '#22c55e',
  },
  AMBER: {
    label: 'Flagged for Review',
    color: '#92400e',
    bg: '#fef3c7',
    border: '#fcd34d',
    dot: '#f59e0b',
  },
  RED: {
    label: 'Export Blocked — consent required',
    color: '#991b1b',
    bg: '#fee2e2',
    border: '#fca5a5',
    dot: '#ef4444',
  },
}

function generateSigilId() {
  const year = new Date().getFullYear()
  const rand = String(Math.floor(10000 + Math.random() * 90000))
  return `SGL-${year}-${rand}`
}

async function sanitiseMusicPrompt(description) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `From the following track description, extract only the genre, mood, tempo, and sonic style. Remove all specific artist names. Return only the cleaned description, no commentary.\n\nDescription: "${description}"`,
    }],
    temperature: 0,
  })
  return response.choices[0].message.content.trim()
}

async function generateMusic(description) {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('VITE_ELEVENLABS_API_KEY is not set.')

  const sanitised = await sanitiseMusicPrompt(description)

  const response = await fetch('https://api.elevenlabs.io/v1/music/compose', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: sanitised }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`ElevenLabs error: ${response.status} — ${text}`)
  }

  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

async function analyseTrack(description) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) throw new Error('VITE_OPENAI_API_KEY is not set.')

  const client = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  const prompt = `You are a music consent and attribution analysis engine for an AI-generated music platform called Sigil. Analyse the following track description and return a JSON object with these exact fields:

- ai_percentage: integer 0–100 measuring ONLY the proportion of AI generation versus human creative input. Score higher when the description references specific named artists (because the creator is relying on AI to replicate a known style rather than contributing original human creativity). Score lower for generic genre or mood descriptions that reflect human creative intent. This field is independent of legal risk — it measures creative origin only
- influence_chain: array of 3–6 strings naming specific artists, genres, or sample sources detected as influences
- consent_status: one of "GREEN", "AMBER", or "RED", determined by scoring against the UK Copyright, Designs and Patents Act 1988, including fair dealing provisions and artist voice and likeness rights
  - GREEN = no consent issues detected, fully clear for export
  - AMBER = potential consent or attribution concerns that should be reviewed
  - RED = clear consent or copyright issues that must be resolved before export
- consent_reason: one concise sentence (max 20 words) explaining the consent_status verdict
- legal_basis: one concise sentence citing the specific provision of the UK CDPA 1988 (e.g. s.29 research, s.30 criticism/review, s.30A quotation, voice and likeness rights) that most directly applies

Track description: "${description}"

Respond with ONLY the raw JSON object, no markdown, no code fences, no commentary.`

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  })

  const raw = response.choices[0].message.content.trim()
  return JSON.parse(raw)
}

export default function App() {
  const [description, setDescription] = useState('')
  const [loadingPhase, setLoadingPhase] = useState(null) // 'generating' | 'analysing'
  const [audioUrl, setAudioUrl] = useState(null)
  const [result, setResult] = useState(null)
  const [sigilId] = useState(generateSigilId)
  const [error, setError] = useState(null)

  async function handleAnalyse() {
    if (!description.trim()) return
    setLoadingPhase('analysing')
    setResult(null)
    setAudioUrl(null)
    setError(null)
    try {
      const data = await analyseTrack(description.trim())
      setResult(data)
      if (data.consent_status === 'RED') return
      setLoadingPhase('generating')
      const url = await generateMusic(description.trim())
      setAudioUrl(url)
    } catch (err) {
      setError(err.message || 'Something failed. Please try again.')
    } finally {
      setLoadingPhase(null)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleAnalyse()
    }
  }

  const loading = loadingPhase !== null
  const status = result ? STATUS_CONFIG[result.consent_status] : null

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <img src="/THP.png" alt="THP mark" className="wordmark-logo" />
          <p className="wordmark-powered">powered by Mogik Labs</p>
          <h1 className="sigil-wordmark">Sigil</h1>
          <p className="tagline">Making sure your creations are aligned with the law — in the age of AI music.</p>
          <p className="tagline-sub">Sigil sits at the exit of every AI music platform — issuing a traceable ID that records how much AI was used, what it was trained on, and whether it's legal to release.</p>
        </div>
      </header>

      <main className="main">
        <div className="container">

          <section className="input-section">
            <label className="input-label" htmlFor="track-description">
              Track Description
            </label>
            <textarea
              id="track-description"
              className="textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your track: genre, style, influences, any vocals or samples used"
              rows={5}
              disabled={loading}
            />
            <p className="input-hint">Press Cmd+Enter to analyse</p>

            <button
              className="btn"
              onClick={handleAnalyse}
              disabled={loading || !description.trim()}
            >
              {loadingPhase === 'analysing' ? (
                <span className="btn-inner"><Spinner />Analysing</span>
              ) : loadingPhase === 'generating' ? (
                <span className="btn-inner"><Spinner />Generating track…</span>
              ) : (
                'Analyse & Generate Sigil ID'
              )}
            </button>
          </section>

          {error && (
            <div className="error-box">
              <strong>Error:</strong> {error}
            </div>
          )}

          {result && (
            <section className="results">
              <div className="sigil-id-row">
                <span className="sigil-id-label">Sigil ID</span>
                <span className="sigil-id">{sigilId}</span>
              </div>

              <div className="result-grid">
                <ResultCard title="AI Content">
                  <div className="ai-bar-wrap">
                    <div className="ai-bar-track">
                      <div
                        className="ai-bar-fill"
                        style={{ width: `${result.ai_percentage}%` }}
                      />
                    </div>
                    <div className="ai-bar-labels">
                      <span className="ai-pct-value">{result.ai_percentage}%</span>
                      <span className="ai-pct-desc">AI-generated content</span>
                    </div>
                  </div>
                </ResultCard>

                <ResultCard title="Influence Chain">
                  <ol className="influence-list">
                    {result.influence_chain.map((item, i) => (
                      <li key={i} className="influence-item">
                        <span className="influence-index">{String(i + 1).padStart(2, '0')}</span>
                        <span className="influence-name">{item}</span>
                      </li>
                    ))}
                  </ol>
                </ResultCard>

                <ResultCard title="Consent Status" fullWidth>
                  <div className="consent-wrap" style={{ '--status-color': status.dot }}>
                    <div className="traffic-light">
                      {['GREEN', 'AMBER', 'RED'].map(s => (
                        <div
                          key={s}
                          className="light-pip"
                          style={{
                            background: result.consent_status === s
                              ? STATUS_CONFIG[s].dot
                              : '#e8e8e8',
                          }}
                        />
                      ))}
                    </div>
                    <div className="consent-text">
                      <div
                        className="consent-verdict"
                        style={{ borderLeft: `4px solid ${status.dot}` }}
                      >
                        {status.label}
                      </div>
                      <p className="consent-reason">{result.consent_reason}</p>
                      {result.legal_basis && (
                        <p className="legal-basis"><strong>Legal basis:</strong> {result.legal_basis}</p>
                      )}
                    </div>
                  </div>
                </ResultCard>
              </div>

              {audioUrl && (
                <div className="result-grid" style={{ marginTop: '1rem' }}>
                  <ResultCard title="Generated Track" fullWidth>
                    <audio controls src={audioUrl} style={{ width: '100%' }} />
                  </ResultCard>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>Sigil &nbsp;|&nbsp; powered by Mogik Labs 無極實驗室 &nbsp;|&nbsp; 2026</p>
      </footer>
    </div>
  )
}

function ResultCard({ title, children, fullWidth }) {
  return (
    <div className={`result-card ${fullWidth ? 'full-width' : ''}`}>
      <h3 className="card-title">{title}</h3>
      <div className="card-body">{children}</div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="spinner" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="31.4" strokeDashoffset="10" />
    </svg>
  )
}
