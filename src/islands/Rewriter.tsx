/** @jsxImportSource preact */
import { useMemo, useState } from 'preact/hooks';
import { wordDiff } from '../lib/diff';

type Touch = 'light' | 'standard' | 'firm';
type Status = 'idle' | 'working' | 'done' | 'unavailable' | 'error';

interface MatchBand {
  score: number;
  band: 'ok' | 'warn' | 'bad';
  note: string;
}
interface Result {
  rewrite: string;
  checks: { quote: string; concern: string }[];
  truncated?: boolean;
  match: { vsOriginal: MatchBand; vsSource: MatchBand | null } | null;
}

export default function Rewriter() {
  const [status, setStatus] = useState<Status>('idle');
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [srcOpen, setSrcOpen] = useState(false);
  const [touch, setTouch] = useState<Touch>('standard');
  const [result, setResult] = useState<Result | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [original, setOriginal] = useState('');

  async function run() {
    const t = text.trim();
    if (t.length < 40) {
      setStatus('error');
      return;
    }
    setStatus('working');
    setResult(null);
    setShowDiff(false);
    setCopied(false);
    try {
      const res = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: t,
          source: srcOpen && source.trim().length >= 40 ? source.trim() : undefined,
          touch,
        }),
      });
      if (!res.ok) {
        setStatus(res.status === 503 ? 'unavailable' : 'error');
        return;
      }
      const data = (await res.json()) as Result;
      if (!data || typeof data.rewrite !== 'string' || !data.rewrite) {
        setStatus('error');
        return;
      }
      setOriginal(t);
      setResult(data);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  function copy() {
    if (!result) return;
    navigator.clipboard?.writeText(result.rewrite).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  const message = useMemo(() => {
    if (status === 'working') return 'Smoothing…';
    if (status === 'unavailable') return "The rewrite helper isn't enabled on this deployment.";
    if (status === 'error') {
      return text.trim().length < 40
        ? 'Paste a bit more text first (a paragraph or a short section).'
        : 'The rewrite didn’t come back — try a smaller chunk (one ## section).';
    }
    return '';
  }, [status, text]);

  const diff = useMemo(
    () => (result && showDiff ? wordDiff(original, result.rewrite) : null),
    [result, showDiff, original],
  );

  return (
    <div class="rw">
      <label class="rw__label" for="rw-in">
        Markdown to smooth
      </label>
      <textarea
        id="rw-in"
        class="rw__in"
        rows={12}
        placeholder="Paste one ## section of the page's Markdown body here…"
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
      />

      <details
        class="rw__src"
        open={srcOpen}
        onToggle={(e) => setSrcOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>
          Regulation page? Paste the verbatim CARs text to check the rewrite against it.
        </summary>
        <textarea
          class="rw__in rw__in--src"
          rows={8}
          placeholder="Verbatim text of the CARs section (optional)…"
          value={source}
          onInput={(e) => setSource((e.target as HTMLTextAreaElement).value)}
        />
      </details>

      <div class="rw__controls">
        <label class="rw__touch">
          How much to change
          <select
            value={touch}
            onChange={(e) => setTouch((e.target as HTMLSelectElement).value as Touch)}
          >
            <option value="light">Light — only the choppy spots</option>
            <option value="standard">Standard — smooth throughout</option>
            <option value="firm">Firm — also restructure awkward paragraphs</option>
          </select>
        </label>
        <button type="button" class="rw__go" onClick={run} disabled={status === 'working'}>
          {status === 'working' ? 'Smoothing…' : 'Smooth the writing'}
        </button>
      </div>

      {message && <p class="rw__msg">{message}</p>}

      {status === 'done' && result && (
        <div class="rw__out">
          {result.match && (
            <div class="rw__bands">
              <span class={`rw__band rw__band--${result.match.vsOriginal.band}`}>
                <strong>Meaning match: {Math.round(result.match.vsOriginal.score * 100)}%</strong>{' '}
                {result.match.vsOriginal.note}
              </span>
              {result.match.vsSource && (
                <span class={`rw__band rw__band--${result.match.vsSource.band}`}>
                  <strong>vs regulation: {Math.round(result.match.vsSource.score * 100)}%</strong>{' '}
                  {result.match.vsSource.note}
                </span>
              )}
            </div>
          )}

          {result.truncated && (
            <p class="rw__msg rw__msg--warn">
              The rewrite was cut off — run it again on a smaller chunk (one ## section).
            </p>
          )}

          <div class="rw__toolbar">
            <label class="rw__toggle">
              <input
                type="checkbox"
                checked={showDiff}
                onChange={(e) => setShowDiff((e.target as HTMLInputElement).checked)}
              />
              Show changes
            </label>
            <button type="button" class="rw__copy" onClick={copy}>
              {copied ? 'Copied' : 'Copy the smoothed text'}
            </button>
          </div>

          <div class="rw__cols">
            <div class="rw__col">
              <h3>Original</h3>
              <pre class="rw__pre">{original}</pre>
            </div>
            <div class="rw__col">
              <h3>Smoothed</h3>
              {diff ? (
                <p class="rw__diff">
                  {diff.map((p, i) =>
                    p.type === 'add' ? (
                      <ins key={i}>{p.text}</ins>
                    ) : p.type === 'del' ? (
                      <del key={i}>{p.text}</del>
                    ) : (
                      <span key={i}>{p.text}</span>
                    ),
                  )}
                </p>
              ) : (
                <textarea class="rw__result" rows={14} readOnly value={result.rewrite} />
              )}
            </div>
          </div>

          <div class="rw__checks">
            <h3>Verify these</h3>
            {result.checks.length === 0 ? (
              <p class="rw__msg">Nothing flagged — still read it through.</p>
            ) : (
              <ul>
                {result.checks.map((c, i) => (
                  <li key={i}>
                    {c.quote && <q>{c.quote}</q>}
                    {c.quote && c.concern ? ' — ' : ''}
                    {c.concern}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <p class="rw__note">
        <span class="rw__leaf" aria-hidden="true">
          🍁
        </span>
        Rewritten with{' '}
        <a href="https://cohere.com" rel="noopener" target="_blank">
          Cohere
        </a>
        , a Canadian AI company. It only smooths wording — it doesn't change meaning, and you review
        every change. Your text is sent to Cohere for this.
      </p>
    </div>
  );
}
