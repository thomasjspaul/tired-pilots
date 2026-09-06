/** @jsxImportSource preact */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { topK } from '../lib/search/cosine';

interface Chunk {
  url: string;
  title: string;
  heading: string;
  text: string;
  vec: number[];
}

type Status = 'idle' | 'loading-index' | 'unavailable' | 'ready' | 'searching' | 'error';

export default function SemanticSearch() {
  const [status, setStatus] = useState<Status>('idle');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ item: Chunk; score: number }[]>([]);
  const indexRef = useRef<Chunk[] | null>(null);
  const seqRef = useRef(0);

  async function ensureIndex(): Promise<Chunk[] | null> {
    if (indexRef.current) return indexRef.current;
    setStatus('loading-index');
    try {
      const res = await fetch('/search/vectors.json');
      if (!res.ok) {
        setStatus('unavailable');
        return null;
      }
      indexRef.current = (await res.json()) as Chunk[];
      setStatus('ready');
      return indexRef.current;
    } catch {
      setStatus('unavailable');
      return null;
    }
  }

  async function run(query: string) {
    const seq = ++seqRef.current;
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      return;
    }
    const index = await ensureIndex();
    if (!index) return;
    setStatus('searching');
    try {
      const res = await fetch('/api/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: trimmed }),
      });
      if (!res.ok) {
        setStatus(res.status === 503 ? 'unavailable' : 'error');
        return;
      }
      const { vec } = (await res.json()) as { vec: number[] };
      if (seq !== seqRef.current) return; // superseded
      const ranked = topK(
        vec,
        index.map((c) => ({ item: c, vec: c.vec })),
        12,
        0.2,
      );
      setResults(ranked);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  // debounce
  useEffect(() => {
    const t = setTimeout(() => run(q), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const message = useMemo(() => {
    if (status === 'unavailable')
      return 'Meaning-based search isn’t enabled on this deployment yet — use the keyword tab.';
    if (status === 'error') return 'Something went wrong. Try again, or use the keyword tab.';
    if (status === 'loading-index') return 'Loading…';
    if (status === 'searching') return 'Searching…';
    if (status === 'ready' && q.trim().length >= 3 && results.length === 0) return 'No matches.';
    return '';
  }, [status, q, results]);

  return (
    <div class="semsearch">
      <input
        type="search"
        class="semsearch__input"
        placeholder="Ask in your own words…"
        value={q}
        onInput={(e) => setQ((e.target as HTMLInputElement).value)}
        aria-label="Search by meaning"
      />

      {message && <p class="semsearch__msg">{message}</p>}

      <ul class="semsearch__results" aria-live="polite">
        {results.map(({ item, score }) => (
          <li key={item.url}>
            <a href={item.url}>
              <span class="semsearch__title">
                {item.title}
                {item.heading && <span class="semsearch__heading"> · {item.heading}</span>}
              </span>
              <span class="semsearch__excerpt">{item.text}</span>
            </a>
            <span
              class="semsearch__score"
              aria-hidden="true"
              title={`similarity ${score.toFixed(2)}`}
            >
              <span style={{ width: `${Math.round(score * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>

      {status !== 'unavailable' && (
        <p class="semsearch__note">
          <span class="semsearch__leaf" aria-hidden="true">
            🍁
          </span>
          Ranked by meaning using embeddings from{' '}
          <a href="https://cohere.com" rel="noopener" target="_blank">
            Cohere
          </a>
          , a Canadian AI company. It ranks pages — it doesn't write answers. No tracking.
        </p>
      )}
    </div>
  );
}
