/** @jsxImportSource preact */
import { useMemo, useState } from 'preact/hooks';
import { calculateMaxFdp } from '../lib/fdp/calculate';
import type { AvgDurationBucket, FdpInput, SplitWindow } from '../lib/fdp/types';

type AugChoice = 'none' | '1|1' | '1|2' | '1|3' | '2|1' | '2|2' | '2|3';

interface State {
  startTime: string;
  acclimatized: boolean;
  offsetHours: string; // signed, "+ ahead / − behind"
  numFlights: string;
  avgDuration: AvgDurationBucket;
  dayVfr: boolean;
  aug: AugChoice;
  splitOn: boolean;
  breakMinutes: string;
  splitWindow: SplitWindow;
}

const DEFAULTS: State = {
  startTime: '07:00',
  acclimatized: true,
  offsetHours: '0',
  numFlights: '2',
  avgDuration: 'gte50',
  dayVfr: false,
  aug: 'none',
  splitOn: false,
  breakMinutes: '90',
  splitWindow: 'day',
};

function fromQuery(): State {
  if (typeof window === 'undefined') return DEFAULTS;
  const q = new URLSearchParams(window.location.search);
  const g = (k: string, d: string) => q.get(k) ?? d;
  return {
    startTime: g('t', DEFAULTS.startTime),
    acclimatized: g('acc', '1') !== '0',
    offsetHours: g('off', '0'),
    numFlights: g('n', DEFAULTS.numFlights),
    avgDuration: (['lt30', '30to50', 'gte50'].includes(g('d', ''))
      ? g('d', '')
      : DEFAULTS.avgDuration) as AvgDurationBucket,
    dayVfr: g('vfr', '0') === '1',
    aug: (['none', '1|1', '1|2', '1|3', '2|1', '2|2', '2|3'].includes(g('a', ''))
      ? g('a', '')
      : 'none') as AugChoice,
    splitOn: g('s', '0') === '1',
    breakMinutes: g('b', DEFAULTS.breakMinutes),
    splitWindow: (['overnight', 'day', 'uoc-replan'].includes(g('sw', ''))
      ? g('sw', '')
      : DEFAULTS.splitWindow) as SplitWindow,
  };
}

function toInput(s: State): FdpInput {
  const [ac, rf] = s.aug === 'none' ? [null, null] : s.aug.split('|').map(Number);
  return {
    startTime: s.startTime,
    acclimatization: s.acclimatized
      ? { state: 'acclimatized' }
      : { state: 'not-acclimatized', acclimatizedZoneOffsetHours: Number(s.offsetHours) || 0 },
    numFlights: Number(s.numFlights) || 1,
    avgDuration: s.avgDuration,
    dayVfr: s.dayVfr,
    augmented:
      ac && rf ? { additionalCrew: ac as 1 | 2, restFacility: rf as 1 | 2 | 3 } : undefined,
    split: s.splitOn
      ? { breakMinutes: Number(s.breakMinutes) || 0, window: s.splitWindow }
      : undefined,
  };
}

function syncQuery(s: State) {
  if (typeof window === 'undefined') return;
  const q = new URLSearchParams();
  q.set('t', s.startTime);
  q.set('acc', s.acclimatized ? '1' : '0');
  if (!s.acclimatized) q.set('off', s.offsetHours);
  q.set('n', s.numFlights);
  q.set('d', s.avgDuration);
  if (s.dayVfr) q.set('vfr', '1');
  if (s.aug !== 'none') q.set('a', s.aug);
  if (s.splitOn) {
    q.set('s', '1');
    q.set('b', s.breakMinutes);
    q.set('sw', s.splitWindow);
  }
  history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
}

export default function FdpCalculator() {
  const [s, setS] = useState<State>(fromQuery);
  const set = <K extends keyof State>(k: K, v: State[K]) =>
    setS((prev) => {
      const next = { ...prev, [k]: v };
      syncQuery(next);
      return next;
    });

  const result = useMemo(() => {
    try {
      return { ok: true as const, value: calculateMaxFdp(toInput(s)) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [s]);

  return (
    <div class="fdpc" data-pagefind-ignore>
      <form class="fdpc__form" onSubmit={(e) => e.preventDefault()}>
        <div class="fdpc__grid">
          <label class="fdpc__field">
            <span>FDP start time (local)</span>
            <input
              type="time"
              value={s.startTime}
              onInput={(e) => set('startTime', (e.target as HTMLInputElement).value)}
            />
          </label>

          <label class="fdpc__field">
            <span>Number of flights</span>
            <input
              type="number"
              min="1"
              max="30"
              value={s.numFlights}
              onInput={(e) => set('numFlights', (e.target as HTMLInputElement).value)}
            />
          </label>
        </div>

        <fieldset class="fdpc__fieldset">
          <legend>Average flight duration</legend>
          <div class="fdpc__radios">
            {(
              [
                ['lt30', 'Under 30 min'],
                ['30to50', '30 to 50 min'],
                ['gte50', '50 min or more'],
              ] as [AvgDurationBucket, string][]
            ).map(([v, label]) => (
              <label key={v} class="fdpc__radio">
                <input
                  type="radio"
                  name="avg"
                  checked={s.avgDuration === v}
                  onChange={() => set('avgDuration', v)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <label class="fdpc__check">
          <input
            type="checkbox"
            checked={s.acclimatized}
            onChange={(e) => set('acclimatized', (e.target as HTMLInputElement).checked)}
          />
          I'm acclimatized to where the FDP starts
        </label>

        {!s.acclimatized && (
          <label class="fdpc__field fdpc__field--indent">
            <span>
              The zone I'm acclimatized to is this many hours ahead (+) or behind (−) where I report
            </span>
            <input
              type="number"
              step="0.5"
              min="-12"
              max="12"
              value={s.offsetHours}
              onInput={(e) => set('offsetHours', (e.target as HTMLInputElement).value)}
            />
          </label>
        )}

        <label class="fdpc__check">
          <input
            type="checkbox"
            checked={s.dayVfr}
            onChange={(e) => set('dayVfr', (e.target as HTMLInputElement).checked)}
          />
          All flights conducted under day VFR
        </label>

        <label class="fdpc__field">
          <span>Augmented crew &amp; rest facility</span>
          <select
            value={s.aug}
            onChange={(e) => set('aug', (e.target as HTMLSelectElement).value as AugChoice)}
          >
            <option value="none">Not augmented</option>
            <option value="1|3">1 extra pilot · class 3</option>
            <option value="1|2">1 extra pilot · class 2</option>
            <option value="1|1">1 extra pilot · class 1</option>
            <option value="2|3">2 extra pilots · class 3</option>
            <option value="2|2">2 extra pilots · class 2</option>
            <option value="2|1">2 extra pilots · class 1</option>
          </select>
        </label>

        <label class="fdpc__check">
          <input
            type="checkbox"
            checked={s.splitOn}
            onChange={(e) => set('splitOn', (e.target as HTMLInputElement).checked)}
          />
          Split flight duty — a break in suitable accommodation
        </label>

        {s.splitOn && (
          <div class="fdpc__grid fdpc__field--indent">
            <label class="fdpc__field">
              <span>Break length (minutes)</span>
              <input
                type="number"
                min="0"
                max="600"
                value={s.breakMinutes}
                onInput={(e) => set('breakMinutes', (e.target as HTMLInputElement).value)}
              />
            </label>
            <label class="fdpc__field">
              <span>When the break falls (acclimatized time)</span>
              <select
                value={s.splitWindow}
                onChange={(e) =>
                  set('splitWindow', (e.target as HTMLSelectElement).value as SplitWindow)
                }
              >
                <option value="overnight">00:00–05:59 (100%)</option>
                <option value="day">06:00–23:59 (50%)</option>
                <option value="uoc-replan">Re-planned in flight for a UOC (50%)</option>
              </select>
            </label>
          </div>
        )}
      </form>

      <div class="fdpc__out" aria-live="polite">
        {result.ok ? (
          <>
            <p class="fdpc__result">
              Maximum flight duty period <strong>{result.value.maxFdpFormatted}</strong>
            </p>

            <details class="fdpc__working" open>
              <summary>Show the working</summary>
              <ol>
                {result.value.steps.map((step, i) => (
                  <li key={i}>
                    <span class="fdpc__step-label">{step.label}</span>
                    <span class="fdpc__step-value">{step.value}</span>
                    {step.detail && <span class="fdpc__step-detail">{step.detail}</span>}
                    <span class="fdpc__step-cite">{step.citation}</span>
                  </li>
                ))}
              </ol>
            </details>

            {result.value.warnings.length > 0 && (
              <div class="fdpc__warnings">
                <p class="fdpc__warnings-h">Check these</p>
                <ul>
                  {result.value.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p class="fdpc__error">Enter a valid start time. ({result.error})</p>
        )}

        <p class="fdpc__disclaimer">
          Educational aid, not legal advice. This does not cover positioning, delayed reporting
          (700.52), disruptive-schedule or time-zone rest, or UOC extensions (700.63). Verify
          against the current CARs and your Operations Manual.
        </p>
      </div>
    </div>
  );
}
