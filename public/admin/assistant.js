/*
 * Editorial assistant for the Sveltia CMS.
 *
 * Adds an "Editorial review" panel to the preview pane of regulation / Q&A /
 * page entries. The panel calls the same-origin /api/review Pages Function,
 * which asks Cohere to FLAG issues (clarity, consistency, grammar, defined
 * terms, and — for regulation pages — fidelity to the verbatim CARs text plus a
 * meaning-drift score). It never rewrites and never "approves" anything.
 *
 * Loaded as a plain <script> after the Sveltia bundle in index.html. Two parts:
 *   1. A postMessage bridge that runs in the top /admin document and performs
 *      the fetch there — so the request is always same-origin and carries the
 *      Cloudflare Access cookie, regardless of how the preview iframe is set up.
 *   2. The preview template itself, which runs inside the preview iframe and
 *      talks to the bridge.
 *
 * If the Sveltia preview API is missing, this file quietly does nothing —
 * editing is unaffected.
 */
(function () {
  'use strict';

  var API_URL = window.location.origin + '/api/review';

  /* ---- Part 1: bridge (top /admin document) ---------------------------- */

  if (window.top === window.self) {
    window.addEventListener('message', function (e) {
      var m = e.data;
      if (!m || m.type !== 'ea:review' || typeof m.id !== 'string') return;
      if (e.origin !== window.location.origin && e.origin !== 'null') return;

      var reply = function (r) {
        try {
          e.source.postMessage(
            { type: 'ea:result', id: m.id, ok: r.ok, status: r.status, data: r.data },
            '*',
          );
        } catch (_) {
          /* source gone */
        }
      };

      fetch(API_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(m.payload || {}),
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (data) {
              reply({ ok: res.ok, status: res.status, data: data });
            });
        })
        .catch(function () {
          reply({ ok: false, status: 0, data: {} });
        });
    });
  }

  /* ---- Part 2: preview template (preview iframe) ---------------------- */

  var CMS = window.CMS;
  if (!CMS || typeof CMS.registerPreviewTemplate !== 'function') {
    console.warn('[editorial-assistant] Sveltia CMS preview API not found; assistant disabled.');
    return;
  }
  var h = CMS.h || window.h;
  var createClass = CMS.createClass || window.createClass;
  if (typeof h !== 'function' || typeof createClass !== 'function') {
    console.warn('[editorial-assistant] element helpers not found; assistant disabled.');
    return;
  }

  var STYLE = [
    '.ea{margin-top:1rem;border:1px solid #d5d7db;border-radius:8px;padding:.9rem 1rem;',
    'font:14px/1.5 system-ui,sans-serif;background:#fbfbfc}',
    '.ea-head{display:flex;align-items:center;justify-content:space-between;gap:1rem}',
    '.ea-btn{font:inherit;font-weight:600;padding:.4rem .8rem;border-radius:6px;border:1px solid #b6122b;',
    'background:#e31b23;color:#fff;cursor:pointer}',
    '.ea-btn:disabled{opacity:.6;cursor:default}',
    '.ea-msg{margin:.6rem 0 0;color:#555}.ea-msg--err{color:#b6122b}',
    '.ea-out{margin-top:.7rem}',
    '.ea-drift{display:flex;flex-wrap:wrap;gap:.3rem .8rem;padding:.5rem .7rem;border-radius:6px;margin-bottom:.6rem}',
    '.ea-drift__score{font-weight:700}',
    '.ea-drift--aligned{background:#e6f4ea}.ea-drift--review{background:#fff4e0}.ea-drift--divergent{background:#fde8e8}',
    '.ea-grp{margin:.6rem 0}.ea-grp h4{margin:0 0 .25rem;font-size:13px;text-transform:uppercase;letter-spacing:.03em;color:#555}',
    '.ea-grp ul{margin:0;padding-left:1.1rem}.ea-grp li{margin:.25rem 0}',
    '.ea-grp q{font-style:italic}.ea-sugg{color:#1a7f37}',
    '.ea-note{margin:.8rem 0 0;font-size:12.5px;color:#666;border-top:1px solid #e5e7eb;padding-top:.5rem}',
    '.ea-note a{color:inherit}',
  ].join('');

  function injectStyle(doc) {
    try {
      if (!doc || doc.getElementById('ea-style')) return;
      var el = doc.createElement('style');
      el.id = 'ea-style';
      el.textContent = STYLE;
      (doc.head || doc.documentElement).appendChild(el);
    } catch (_) {
      /* ignore */
    }
  }

  /* Ask the bridge to run the review. Resolves { ok, status, data }. */
  function askBridge(win, payload) {
    return new Promise(function (resolve) {
      var id = 'ea-' + Math.random().toString(36).slice(2);
      var target = (win && win.top) || window.top || window;
      var done = function (r) {
        try {
          win.removeEventListener('message', onMsg);
        } catch (_) {}
        clearTimeout(timer);
        resolve(r);
      };
      var onMsg = function (e) {
        var m = e.data;
        if (!m || m.type !== 'ea:result' || m.id !== id) return;
        done({ ok: !!m.ok, status: m.status || 0, data: m.data || {} });
      };
      win.addEventListener('message', onMsg);
      var timer = setTimeout(function () {
        done({ ok: false, status: 0, data: {} });
      }, 30000);
      try {
        target.postMessage({ type: 'ea:review', id: id, payload: payload }, '*');
      } catch (_) {
        done({ ok: false, status: 0, data: {} });
      }
    });
  }

  function fieldVal(data, key) {
    if (!data) return '';
    var v = typeof data.get === 'function' ? data.get(key) : data[key];
    return typeof v === 'string' ? v : '';
  }

  /* Best-effort: find the verbatim regulation-text entry paired by section/slug. */
  function findSource(getCollection, section, slug) {
    if (typeof getCollection !== 'function') return Promise.resolve('');
    return Promise.resolve(getCollection('regulationText'))
      .then(function (entries) {
        var list = entries && typeof entries.toJS === 'function' ? entries.toJS() : entries;
        if (!Array.isArray(list)) return '';
        var match = list.find(function (e) {
          var d = (e && (e.data || (typeof e.get === 'function' && e.get('data')))) || {};
          var s = typeof d.get === 'function' ? d.get('section') : d.section;
          var id = String(
            e.slug || e.id || (typeof e.get === 'function' && (e.get('slug') || e.get('id'))) || '',
          );
          id = id.replace(/^.*\//, '');
          return (section && s === section) || (slug && id === slug);
        });
        if (!match) return '';
        var md = match.data || (typeof match.get === 'function' && match.get('data'));
        if (md && typeof md.toJS === 'function') md = md.toJS();
        return md && typeof md.body === 'string' ? md.body : '';
      })
      .catch(function () {
        return '';
      });
  }

  function renderResult(r) {
    var kids = [];

    if (r.drift) {
      kids.push(
        h(
          'div',
          { className: 'ea-drift ea-drift--' + (r.drift.band || 'review') },
          h(
            'span',
            { className: 'ea-drift__score' },
            'Meaning match: ' + Math.round((r.drift.score || 0) * 100) + '%',
          ),
          h('span', { className: 'ea-drift__note' }, r.drift.note || ''),
        ),
      );
    }
    if (r.chatError) {
      kids.push(
        h(
          'p',
          { className: 'ea-msg' },
          'Proofreading was unavailable this run' +
            (r.drift ? ' — the meaning-drift check above still ran.' : '.'),
        ),
      );
    }

    var group = function (title, items, render) {
      if (!items || !items.length) return;
      kids.push(
        h(
          'section',
          { className: 'ea-grp' },
          h('h4', null, title + ' (' + items.length + ')'),
          h(
            'ul',
            null,
            items.map(function (it, i) {
              return h('li', { key: i }, render(it));
            }),
          ),
        ),
      );
    };

    group('Faithful to the regulation?', r.fidelity, function (it) {
      return [h('q', null, it.claim), ' — ', it.concern];
    });
    group('Clarity', r.clarity, function (it) {
      return [
        h('q', null, it.quote),
        ' — ',
        it.issue,
        it.suggestion ? h('span', { className: 'ea-sugg' }, ' Try: ' + it.suggestion) : null,
      ];
    });
    group('Consistency', r.consistency, function (it) {
      return [h('q', null, it.quote), ' — ', it.issue];
    });
    group('Grammar & typos', r.grammar, function (it) {
      return [h('q', null, it.quote), ' → ', it.fix];
    });
    group('Defined terms', r.definedTerms, function (it) {
      return [h('strong', null, it.term), ' — ', it.note];
    });

    if (!kids.length) {
      kids.push(h('p', { className: 'ea-msg' }, 'No issues flagged. Still your call.'));
    }
    return h('div', { className: 'ea-out' }, kids);
  }

  var Panel = createClass({
    getInitialState: function () {
      this.runReview = this.runReview.bind(this);
      return { status: 'idle', result: null, error: null };
    },

    componentDidMount: function () {
      injectStyle(this.props.document || document);
    },

    runReview: function () {
      var self = this;
      var props = this.props;
      var data =
        props.entry && typeof props.entry.get === 'function' ? props.entry.get('data') : null;
      var body = fieldVal(data, 'body');
      if (body.trim().length < 40) {
        self.setState({ status: 'error', error: 'Add more text to the body first.' });
        return;
      }
      var collection = props.entry.get('collection');
      var kind =
        collection === 'regulations'
          ? 'regulation'
          : collection === 'explainers'
            ? 'explainer'
            : 'page';

      self.setState({ status: 'loading', result: null, error: null });

      var sourceP = Promise.resolve('');
      var citationUrl = '';
      if (kind === 'regulation') {
        var section = fieldVal(data, 'section');
        var slug = fieldVal(data, 'slug') || (section ? section.replace(/\./g, '-') : '');
        citationUrl = fieldVal(data, 'lawUrl');
        sourceP = findSource(props.getCollection, section, slug);
      }

      sourceP
        .then(function (source) {
          return askBridge(props.window || window, {
            kind: kind,
            title: fieldVal(data, 'title'),
            summary: fieldVal(data, 'summary'),
            body: body,
            source: source,
            citationUrl: citationUrl,
          });
        })
        .then(function (r) {
          if (r.status === 503) {
            return self.setState({
              status: 'error',
              error: "Editorial review isn't enabled on this deployment.",
            });
          }
          if (r.status === 403) {
            return self.setState({
              status: 'error',
              error: "The review service can't be reached from this preview.",
            });
          }
          if (!r.ok) {
            return self.setState({ status: 'error', error: 'Something went wrong — try again.' });
          }
          self.setState({ status: 'done', result: r.data, error: null });
        });
    },

    render: function () {
      var s = this.state;
      var widgetFor = this.props.widgetFor;

      var panel = [
        h(
          'div',
          { className: 'ea-head' },
          h('strong', null, 'Editorial review'),
          h(
            'button',
            {
              type: 'button',
              className: 'ea-btn',
              disabled: s.status === 'loading',
              onClick: this.runReview,
            },
            s.status === 'loading' ? 'Reviewing…' : 'Run editorial review',
          ),
        ),
      ];
      if (s.error) panel.push(h('p', { className: 'ea-msg ea-msg--err' }, s.error));
      if (s.status === 'done' && s.result) panel.push(renderResult(s.result));
      panel.push(
        h(
          'p',
          { className: 'ea-note' },
          '🍁 Reviewed with ',
          h('a', { href: 'https://cohere.com', target: '_blank', rel: 'noopener' }, 'Cohere'),
          ", a Canadian AI company. It flags issues for you to weigh — it doesn't rewrite or approve. Your draft text is sent to Cohere for this check.",
        ),
      );

      return h(
        'div',
        { className: 'ea-wrap' },
        widgetFor ? h('div', { className: 'ea-preview' }, widgetFor('body')) : null,
        h('aside', { className: 'ea' }, panel),
      );
    },
  });

  ['regulations', 'explainers', 'pages'].forEach(function (name) {
    try {
      CMS.registerPreviewTemplate(name, Panel);
    } catch (err) {
      console.warn('[editorial-assistant] could not register preview for', name, err);
    }
  });
})();
