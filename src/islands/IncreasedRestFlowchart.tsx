/** @jsxImportSource preact */
import { useMemo, useState } from 'preact/hooks';
import { INCREASED_REST_NODES, INCREASED_REST_START, type FlowNode } from '../data/increasedRest';

interface Trail {
  question: string;
  answer: string;
}

/** Replay a saved answer sequence ("y"/"n"/"a"/"b", ...) to find the current node. */
function walk(seq: string[]): { node: FlowNode; trail: Trail[] } {
  let node = INCREASED_REST_NODES[INCREASED_REST_START];
  const trail: Trail[] = [];
  for (const a of seq) {
    if (node.kind === 'question') {
      const nextId = a === 'y' ? node.yes : node.no;
      trail.push({ question: node.text, answer: a === 'y' ? 'Yes' : 'No' });
      node = INCREASED_REST_NODES[nextId];
    } else if (node.kind === 'choice') {
      const idx = a.charCodeAt(0) - 97; // "a" -> 0
      const opt = node.options[idx];
      if (!opt) break;
      trail.push({ question: node.text, answer: opt.label });
      node = INCREASED_REST_NODES[opt.next];
    } else {
      break;
    }
  }
  return { node, trail };
}

export default function IncreasedRestFlowchart() {
  const initial = useMemo(() => {
    if (typeof window === 'undefined') return [] as string[];
    const p = new URLSearchParams(window.location.search).get('path') ?? '';
    return p.split('').filter((c) => 'ynab'.includes(c));
  }, []);
  const [seq, setSeq] = useState<string[]>(initial);

  const { node, trail } = walk(seq);

  const push = (a: string) => {
    const next = [...seq, a];
    setSeq(next);
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search);
      q.set('path', next.join(''));
      history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
    }
  };
  const reset = () => {
    setSeq([]);
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search);
      q.delete('path');
      const qs = q.toString();
      history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  };

  return (
    <div class="irf" data-pagefind-ignore>
      {trail.length > 0 && (
        <ol class="irf__trail">
          {trail.map((t, i) => (
            <li key={i}>
              <span class="irf__trail-q">{t.question}</span>
              <span class="irf__trail-a">{t.answer}</span>
            </li>
          ))}
        </ol>
      )}

      {node.kind === 'question' && (
        <div class="irf__step">
          <p class="irf__q">{node.text}</p>
          <div class="irf__btns">
            <button type="button" onClick={() => push('y')}>
              Yes
            </button>
            <button type="button" onClick={() => push('n')}>
              No
            </button>
          </div>
        </div>
      )}

      {node.kind === 'choice' && (
        <div class="irf__step">
          <p class="irf__q">{node.text}</p>
          <div class="irf__btns irf__btns--col">
            {node.options.map((o, i) => (
              <button key={i} type="button" onClick={() => push(String.fromCharCode(97 + i))}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {node.kind === 'outcome' && (
        <div class="irf__outcome">
          <p class="irf__outcome-cite">{node.citation}</p>
          <p class="irf__outcome-text">{node.text}</p>
          <a class="irf__outcome-link" href={node.href}>
            Read {node.citation.replace('CARs ', '')} &rarr;
          </a>
        </div>
      )}

      {seq.length > 0 && (
        <button type="button" class="irf__reset" onClick={reset}>
          Start over
        </button>
      )}

      <p class="irf__source">
        From Advisory Circular 700-047, Appendix A. A navigation aid — confirm the result against
        the regulation and your Operations Manual.
      </p>
    </div>
  );
}
