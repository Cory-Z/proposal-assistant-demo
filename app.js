// By default, browsers try to restore your exact scroll position after a
// page refresh - that's what was overriding our own "start at the top"
// logic below on reload. Turning this off only affects refresh/reload; it
// has no effect on the in-page save/restore that showView() does when
// moving between the home page and tool views.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
let proposals = [];
fetch('proposals/index.json')
  .then(res => res.json())
  .then(data => {
    proposals = data;
    renderHomeStats();
  })
  .catch(() => { proposals = []; });
const STOPWORDS = new Set(['the','a','an','and','or','of','to','for','in','on','with','is','are','be','this','that','we','our','client','study','project']);
function tokenize(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
}
function scoreProposal(proposal, queryWords) {
  const text = [proposal.title, proposal.industry, proposal.deliverableType, proposal.pricingModel, proposal.scopeSummary].join(' ').toLowerCase();
  if (queryWords.length === 0) return 0;
  const matches = queryWords.filter(w => text.includes(w));
  return Math.round((matches.length / queryWords.length) * 100);
}
// Index freshness: proposals/index-meta.json is written by build_site_index.py (upload it next to internal-index.json)
let indexMeta = null;
function indexMetaInfo() {
  if (!indexMeta || !indexMeta.updated) return null;
  const d = new Date(indexMeta.updated + 'T12:00:00');
  if (isNaN(d)) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const pretty = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { pretty, days, stale: false, count: indexMeta.count };
}
function renderHomeStats() {
  const el = document.getElementById('home-stats');
  const info = indexMetaInfo();
  if (!info) { el.textContent = ''; el.classList.remove('stale'); return; }
  el.textContent = `Proposal index updated ${info.pretty}` + (info.count ? ` \u00b7 ${info.count} documents` : '') +
    (info.stale ? ' \u00b7 more than two weeks old, so recent proposals may be missing' : '');
  el.classList.toggle('stale', info.stale);
}
fetch('proposals/index-meta.json', { cache: 'no-store' })
  .then(r => r.ok ? r.json() : null).catch(() => null)
  .then(m => { indexMeta = m; renderHomeStats(); if (typeof browseAll !== 'undefined' && browseAll && browseAll.length) renderBrowseList(); });
const views = {
  login: document.getElementById('view-login'),
  home: document.getElementById('view-home'),
  draft: document.getElementById('view-draft'),
  search: document.getElementById('view-search'),
  process: document.getElementById('view-process'),
  tool: document.getElementById('view-tool'),
  addProposal: document.getElementById('view-add-proposal'),
  outcome: document.getElementById('view-outcome'),
  browseDb: document.getElementById('view-browse-db'),
  redact: document.getElementById('view-redact'),
  schedule: document.getElementById('view-schedule'),
  scheduleEdit: document.getElementById('view-schedule-edit'),
  pricingCalc: document.getElementById('view-pricing-calc'),
  howto: document.getElementById('view-howto'),
  rateCard: document.getElementById('view-rate-card'),
};
// Switching views only toggles which section is hidden - the browser's
// scroll position carries over from whatever it was on the previous view.
// Tool pages (browse database, add proposal, etc.) should always open at
// the top. The main menu is the exception: it should stay exactly where
// the user left it, so its scroll position is saved before leaving it and
// restored when coming back, instead of always resetting to 0.
let currentViewName = null;
let homeScrollY = 0;
function showView(name) {
  if (currentViewName === 'home') {
    homeScrollY = window.scrollY;
  }
  Object.values(views).forEach(v => v.hidden = true);
  views[name].hidden = false;
  currentViewName = name;
  window.scrollTo(0, name === 'home' ? homeScrollY : 0);
  if (name === 'home') setTimeout(() => { try { refreshHomeScheduleNudge(); } catch (e) {} }, 300);
}
const ACCESS_KEY = 'acmeAccessEmail';
function grantAccess(email) {
  sessionStorage.setItem(ACCESS_KEY, email);
  const signedInAs = document.getElementById('signed-in-as');
  signedInAs.hidden = true;
  showView('home');
}
grantAccess('guest@demo.local');   // demo: no sign-in
document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const email = (data.get('email') || '').trim();
  const errorBox = document.getElementById('login-error');
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errorBox.hidden = true;
    grantAccess(email);
  } else {
    errorBox.hidden = false;
  }
});
// Logo / "Proposal Assistant" in the header: on the home screen it scrolls back to the top;
// from any other page it returns to home at the scroll position the user left it.
function headerHomeClick() {
  if (!sessionStorage.getItem(ACCESS_KEY)) return;
  if (currentViewName === 'home') {
    homeScrollY = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    showView('home');
  }
}
document.getElementById('header-home-link').addEventListener('click', headerHomeClick);
document.getElementById('header-home-link').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    headerHomeClick();
  }
});
document.getElementById('btn-draft').addEventListener('click', () => showView('draft'));
document.getElementById('btn-search').addEventListener('click', () => showView('search'));
document.getElementById('btn-add-proposal').addEventListener('click', () => showView('addProposal'));
document.getElementById('btn-outcome').addEventListener('click', () => { loadBrowseData().then(() => { renderOutcomeMatches(); showView('outcome'); }); });
document.getElementById('back-from-outcome').addEventListener('click', () => showView('home'));
document.getElementById('btn-browse-db').addEventListener('click', () => { renderBrowseList(); showView('browseDb'); });
function openTool(file, title) {
  const f = document.getElementById('tool-frame');
  f.title = title || 'Tool';
  f.src = file;
  showView('tool');
}
document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => openTool(b.dataset.tool, b.dataset.title)));
document.getElementById('back-from-tool').addEventListener('click', () => { document.getElementById('tool-frame').src = 'about:blank'; showView('home'); });
document.getElementById('btn-schedule').addEventListener('click', () => { openScheduleTool(); showView('schedule'); });
document.getElementById('back-from-draft').addEventListener('click', () => showView('home'));
document.getElementById('draft-to-rfq').addEventListener('click', (e) => { e.preventDefault(); openTool('tool-rfq-start.html', 'Start from an RFQ'); });
document.getElementById('draft-to-schedule').addEventListener('click', (e) => { e.preventDefault(); openScheduleWithPrefill({ taskType: 'Drafting' }); });
document.getElementById('back-from-search').addEventListener('click', () => showView('home'));
document.getElementById('back-from-process').addEventListener('click', () => showView('home'));
document.getElementById('back-from-add').addEventListener('click', () => showView('home'));
document.getElementById('back-from-browse-db').addEventListener('click', () => showView('home'));
document.getElementById('back-from-redact').addEventListener('click', () => showView('home'));
document.getElementById('back-from-schedule').addEventListener('click', () => { stopScheduleListeners(); showView('home'); });
document.getElementById('schedule-edit-my-btn').addEventListener('click', () => showView('scheduleEdit'));
document.getElementById('back-from-schedule-edit').addEventListener('click', () => showView('schedule'));
document.getElementById('btn-pricing-calc').addEventListener('click', () => showView('pricingCalc'));
document.getElementById('back-from-pricing-calc').addEventListener('click', () => showView('home'));
document.getElementById('open-rate-card').addEventListener('click', () => showView('rateCard'));
document.getElementById('back-from-rate-card').addEventListener('click', () => showView('pricingCalc'));
document.getElementById('btn-howto').addEventListener('click', () => showView('howto'));
document.getElementById('back-from-howto').addEventListener('click', () => showView('home'));
const HFE_TERMS_LINE = `Use precise HFE terminology consistent with FDA Human Factors guidance and IEC 62366-1: say "use-related risk" (not "user error"), "intended users" and "use scenarios" (not "end users" or "situations"), "summative evaluation" and "formative evaluation" (not "usability test" or "final study"), "simulated use" (not "mock use"), and "critical tasks" for tasks where failure could cause serious harm.`;
function copyAndShow(promptText, outBoxId, introText) {
  const outBox = document.getElementById(outBoxId);
  outBox.hidden = false;
  const esc = promptText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return navigator.clipboard.writeText(promptText).then(() => true, () => false).then(copied => {
    outBox.innerHTML = `
      <p style="margin:0 0 10px;">${copied ? 'Prompt copied to your clipboard.' : 'Could not copy automatically - select and copy the text below.'} ${introText}</p>
      <a href="https://claude.ai/new" target="_blank" rel="noopener" class="primary-btn" style="display:inline-block;text-decoration:none;margin-bottom:12px;">Open Claude</a>
      <pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:10px;margin:0;">${esc}</pre>
    `;
  });
}
function buildSearchSkillPrompt(payload, onSiteMatches) {
  const onSiteList = (onSiteMatches && onSiteMatches.length) ? onSiteMatches.map(r => `- ${r.title} (${r.id})`).join('\n') : '';
  const criteriaLines = [];
  if (payload.deliverableType) criteriaLines.push(`Deliverable type: ${payload.deliverableType}`);
  if (payload.industry) criteriaLines.push(`Industry / device category: ${payload.industry}`);
  if (payload.clientStatus) criteriaLines.push(`Client status: ${payload.clientStatus}`);
  if (payload.pricingModel) criteriaLines.push(`Pricing model: ${payload.pricingModel}`);
  if (payload.studyType) criteriaLines.push(`Study type: ${payload.studyType}`);
  return `Please use the proposal-index-search skill to find the past Acme HF proposals most similar to the project described below. Run this in a Cowork session and immediately request access to the folder C:\\Users\\<my user name>\\Acme HF\\Proposal Process Project - Proposal Index (do not ask me whether it is synced).
${criteriaLines.length ? criteriaLines.join('\n') : 'No structured criteria provided - rely on the request details below.'}
${payload.query ? `\nRFQ or request details: ${payload.query}` : ''}

${onSiteList ? `These matches were already found on the site's database - do not repeat them, and focus on additional matches beyond these:\n${onSiteList}\n\n` : ''}Steps: run a similar-proposals search on the device type, therapeutic area, study type and proposal structure you identify from the details above, then run slide-level keyword searches on the key scope terms (for example the study design or device name) to catch matches that the tags miss. Show up to 10 proposals, grouped by proposal with the current version first and drafts beneath. For each, give the link (browser version), date, client, deliverable type and pricing model, and a one or two sentence summary of why it is similar and what differs. If useful, show the most relevant scope or pricing slide.
${HFE_TERMS_LINE}
These results contain client names and prices and are for internal Acme HF use only - do not carry one client's details into another client's draft. Tags are automatic and may be wrong, so flag anything uncertain and recommend expert review before any of this is used in client-facing material.`;
}
let lastSearchPayload = null;
let lastSearchResults = [];
const NON_PROPOSAL_KINDS = ['client request', 'case study', 'guidance', 'capabilities'];
function scoreFullEntry(e, payload, words) {
  const text = [e.title, e.clientName, e.summary, e.device.join(' '), e.area.join(' '), e.study.join(' '), e.structure.join(' ')].join(' ').toLowerCase();
  const hits = words.filter(w => text.includes(w)).length;
  if (!hits) return null;
  let score = (hits / words.length) * 100;
  const dt = (payload.deliverableType || '').toLowerCase();
  if (dt) {
    const key = dt.includes('powerpoint') ? 'powerpoint' : dt.includes('sow') ? 'sow' : dt.includes('amendment') ? 'amendment' : dt;
    if (((e.deliverableType || '') + ' ' + (e.kind || '')).toLowerCase().includes(key)) score += 20;
  }
  if (payload.pricingModel && (e.pricingModel || '').toLowerCase() === payload.pricingModel.toLowerCase()) score += 10;
  if (payload.studyType && e.study.join(' ').toLowerCase().includes(payload.studyType.toLowerCase())) score += 15;
  return { ...e, score: Math.round(score), hits };
}
function resetSearchOutputs() {
  lastSearchPayload = null;
  lastSearchResults = [];
  ['search-results', 'search-handoff-output'].forEach(id => { const el = document.getElementById(id); el.hidden = true; el.innerHTML = ''; });
  document.getElementById('use-in-draft-box').hidden = true;
  document.getElementById('broaden-search-btn').disabled = true;
  document.getElementById('broaden-search-hint').hidden = false;
}
document.getElementById('search-form').addEventListener('reset', resetSearchOutputs);
document.getElementById('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  const resultsBox = document.getElementById('search-results');
  resultsBox.hidden = false;
  resultsBox.innerHTML = '<p style="margin:0;">Searching...</p>';
  loadBrowseData().then(() => {
    const words = tokenize([payload.query, payload.deliverableType, payload.industry, payload.clientStatus, payload.pricingModel, payload.studyType].filter(Boolean).join(' '));
    let results = [];
    if (browseAll.length && words.length) {
      results = browseAll
        .filter(x => x.current && !NON_PROPOSAL_KINDS.some(k => (x.kind || '').toLowerCase().startsWith(k)))
        .map(x => scoreFullEntry(x, payload, words))
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
    }
    const unpublished = !browseAll.length;
    resultsBox.innerHTML = results.length === 0
      ? `<p style="margin:0 0 14px;">${unpublished ? 'The full proposal index is not on this site yet, so only the Claude search skill below can search it.' : 'No close matches found in the site database. Try different keywords, or use the Claude search skill below to search the full index with slide-level text.'}</p>`
      : results.map(r => `
      <div class="result-card">
        <div class="result-title">${r.url ? `<a href="${browseEsc(r.url)}" target="_blank" rel="noopener">${browseEsc(r.title)}</a>` : browseEsc(r.title)} <span class="match-score">${r.score}% match</span></div>
        <div class="result-meta">${browseEsc(r.clientName)} &middot; ${browseEsc(r.date)} &middot; ${browseEsc(r.deliverableType || r.kind)} &middot; ${browseEsc(r.versionStatus)}</div>
        <div class="result-meta">${browseEsc([r.device.join('; '), r.area.join('; '), r.study.join('; ')].filter(Boolean).join(' | '))}</div>
        <div class="result-meta">${browseEsc(r.pricingModel || '')}${r.dealSizeBand ? ' &middot; ' + browseEsc(r.dealSizeBand) : ''}</div>
        <div class="result-meta" style="margin-top:6px;">${browseEsc(r.summary)}</div>
        <div class="result-meta">Reference: ${browseEsc(r.id)}</div>
      </div>`).join('') + (results.length ? '<p class="login-desc" style="margin-top:8px;">Matches use keywords and automatic tags, so check the documents before relying on them.</p>' : '');
    lastSearchPayload = payload;
    lastSearchResults = results;
    document.getElementById('use-in-draft-box').hidden = results.length === 0;
    document.getElementById('broaden-search-btn').disabled = false;
    document.getElementById('broaden-search-hint').hidden = true;
    document.getElementById('search-handoff-output').hidden = true;
    document.getElementById('search-handoff-output').innerHTML = '';
  });
});
document.getElementById('use-in-draft-btn').addEventListener('click', () => {
  if (!lastSearchResults.length) return;
  document.getElementById('draft-referencedProposals').value = lastSearchResults
    .map(r => `- ${r.title} (${r.id})${r.clientName ? ' - ' + r.clientName : ''}`).join('\n');
  document.getElementById('draft-output').hidden = true;
  showView('draft');
});
document.getElementById('broaden-search-btn').addEventListener('click', () => {
  if (!lastSearchPayload) return;
  copyAndShow(buildSearchSkillPrompt(lastSearchPayload, lastSearchResults), 'search-handoff-output', "Open Claude, start a Cowork session, and paste it in to search Acme HF's full proposal index (including slide-level text) with the proposal-index-search skill.");
});
// --- Browse proposal database (full internal index) ---
// Loads proposals/internal-index.json, which holds client names, prices and shared drive links.
// That file must only be published behind a real login and the
// repository is private. Until the file exists, this view shows a "not published yet" message.
let browseAll = null;       // null = not loaded yet, [] = missing/empty
let browseShown = 100;
const outcomeLabel = e => e.outcome ? (e.outcomeAuto ? 'Won (signed copy on file)' : e.outcome + (e.outcomeReason ? ': ' + e.outcomeReason : '')) : 'Unknown';
const BROWSE_FILTERS = [
  ['browse-filter-year', e => { const y = (e.date || '').slice(0, 4); return /^\d{4}$/.test(y) ? y : (/^unkn/i.test(y) ? 'Unknown' : 'Undated'); }, v => true],
  ['browse-filter-kind', e => [e.kind], v => true],
  ['browse-filter-device', e => e.device, v => true],
  ['browse-filter-area', e => e.area, v => true],
  ['browse-filter-study', e => e.study, v => true],
  ['browse-filter-dealsize', e => [e.dealSizeBandGroup], v => true],
  ['browse-filter-outcome', e => [e.outcome ? (e.outcomeAuto ? 'Won (signed copy on file)' : e.outcome) : 'Unknown'], v => true],
];
function browseEsc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function loadBrowseData() {
  if (browseAll !== null) return Promise.resolve();
  return fetch('proposals/internal-index.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : [])
    .catch(() => [])
    .then(d => {
      browseAll = Array.isArray(d) ? d : [];
      BROWSE_FILTERS.forEach(([id, get]) => {
        const sel = document.getElementById(id);
        const vals = new Set();
        browseAll.forEach(e => [].concat(get(e)).filter(Boolean).forEach(v => vals.add(v)));
        const sorted = [...vals].sort((x, y) => id === 'browse-filter-year' ? ((/^\d/.test(x) === /^\d/.test(y)) ? y.localeCompare(x) : (/^\d/.test(x) ? -1 : 1)) : x.localeCompare(y));
        sel.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
        sorted.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
      });
    });
}
function getBrowseSorted() {
  const f = getBrowseFiltered().slice();
  const mode = (document.getElementById('browse-sort') || {}).value || 'newest';
  const cmpStr = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });
  const dated = e => /^\d{4}/.test(e.date || '');
  const byDate = dir => (a, b) => (dated(a) === dated(b)) ? dir * cmpStr(a.date, b.date) : (dated(a) ? -1 : 1);  // undated items always last
  if (mode === 'newest') f.sort(byDate(-1));
  else if (mode === 'oldest') f.sort(byDate(1));
  else if (mode === 'client') f.sort((a, b) => cmpStr(a.clientName, b.clientName) || cmpStr(b.date, a.date));
  else if (mode === 'title') f.sort((a, b) => cmpStr(a.title, b.title));
  return f;
}
function browseCsvCell(v) { const t = String(v == null ? '' : v).replace(/"/g, '""'); return '"' + t + '"'; }
function exportBrowseCsv() {
  if (!browseAll || !browseAll.length) return;
  const rows = getBrowseSorted();
  const head = ['ID', 'Title', 'Client', 'Date', 'Kind', 'Version status', 'Device type', 'Therapeutic area', 'Study type', 'Pricing model', 'Deal size', 'Outcome', 'Link'];
  const lines = [head.map(browseCsvCell).join(',')].concat(rows.map(e => [e.id, e.title, e.clientName, e.date, e.kind, e.versionStatus,
    e.device.join('; '), e.area.join('; '), e.study.join('; '), e.pricingModel, e.dealSizeBand, outcomeLabel(e), e.url].map(browseCsvCell).join(',')));
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'proposal-index-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function getBrowseFiltered() {
  const text = document.getElementById('browse-text').value.trim().toLowerCase();
  const words = text ? text.split(/\s+/) : [];
  const showAll = document.getElementById('browse-all-versions').checked;
  const sel = id => document.getElementById(id).value;
  return browseAll.filter(e => {
    if (!showAll && !e.current) return false;
    if (words.length) {
      const blob = [e.title, e.clientName, e.summary, e.id, e.device.join(' '), e.area.join(' '), e.study.join(' ')].join(' ').toLowerCase();
      if (!words.every(w => blob.includes(w))) return false;
    }
    return BROWSE_FILTERS.every(([id, get]) => !sel(id) || [].concat(get(e)).includes(sel(id)));
  });
}
function renderBrowseList() {
  const countBox = document.getElementById('browse-count');
  const listBox = document.getElementById('browse-list');
  loadBrowseData().then(() => {
    if (!browseAll.length) {
      countBox.textContent = 'The full proposal index has not been published to this site yet. Use Find similar proposals, or the proposal-index-search skill in Claude.';
      listBox.innerHTML = '';
      return;
    }
    const f = getBrowseSorted();
    const info = indexMetaInfo();
    countBox.textContent = `Showing ${Math.min(browseShown, f.length)} of ${f.length} matching documents (${browseAll.length} in the index${info ? ', updated ' + info.pretty : ''}). Tags are automatic and may be wrong.` + (info && info.stale ? ' The index is more than two weeks old, so recent proposals may be missing.' : '');
    listBox.innerHTML = f.slice(0, browseShown).map(e => {
      const link = u => `<a href="${browseEsc(u)}" target="_blank" rel="noopener">`;
      return `<div class="result-card">
        <div class="result-title">${e.url ? link(e.url) + browseEsc(e.title) + '</a>' : browseEsc(e.title)}</div>
        <div class="result-meta">${browseEsc(e.clientName)} &middot; ${browseEsc(e.date)} &middot; ${browseEsc(e.kind)} &middot; ${browseEsc(e.versionStatus)}${e.current ? '' : ' &middot; other version'}</div>
        <div class="result-meta">${browseEsc([e.device.join('; '), e.area.join('; '), e.study.join('; ')].filter(Boolean).join(' | '))}</div>
        <div class="result-meta">${browseEsc(e.pricingModel || '')}${e.dealSizeBand ? ' &middot; ' + browseEsc(e.dealSizeBand) : ''}${e.structure.length ? ' &middot; ' + browseEsc(e.structure.join('; ')) : ''}</div>
        <div class="result-meta" style="margin-top:6px;">${browseEsc(e.summary)}</div>
        <div class="result-meta">Outcome: ${browseEsc(outcomeLabel(e))}</div>
        <div class="result-meta">Reference: ${browseEsc(e.id)}${(e.signedUrls || []).map(u => ' &middot; ' + link(u) + 'signed/final copy</a>').join('')}</div>
      </div>`;
    }).join('') + (f.length > browseShown ? `<button type="button" class="quiz-option-btn" id="browse-more" style="margin-top:12px;">Show more</button>` : '');
  });
}
['browse-filter-year', 'browse-filter-kind', 'browse-filter-device', 'browse-filter-area', 'browse-filter-study', 'browse-filter-dealsize', 'browse-filter-outcome', 'browse-all-versions', 'browse-sort']
  .forEach(id => document.getElementById(id).addEventListener('change', () => { browseShown = 100; renderBrowseList(); }));
document.getElementById('browse-text').addEventListener('input', () => { browseShown = 100; renderBrowseList(); });
document.getElementById('browse-filter-clear').addEventListener('click', () => {
  ['browse-filter-year', 'browse-filter-kind', 'browse-filter-device', 'browse-filter-area', 'browse-filter-study', 'browse-filter-dealsize', 'browse-filter-outcome'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('browse-text').value = '';
  document.getElementById('browse-all-versions').checked = false;
  browseShown = 100;
  renderBrowseList();
});
document.getElementById('browse-export').addEventListener('click', exportBrowseCsv);
document.getElementById('browse-list').addEventListener('click', (e) => {
  if (e.target.id === 'browse-more') { browseShown += 100; renderBrowseList(); }
});
const PROPOSAL_TYPE_LABELS = {
  ballpark: 'ballpark quote',
  ppt: 'PowerPoint proposal',
  sow: 'Word SOW',
  amendment: 'amendment / change order'
};
const DRAFT_TYPE_HINTS = {
  sow: 'Word SOW: do the SME intake, then the Comm Ops intake, and paste its "Copy final answers for Claude" text below. The skill builds the SOW from it automatically; you fill in the yellow highlighted items afterwards (including the timeline).',
  ppt: 'PowerPoint: do the SME intake and the Comm Ops intake (it asks the deck-only questions: pricing slide layout, deck length, timeline style, logo, contacts), then paste the "Copy final answers for Claude" text below. You delete the content slides you do not want afterwards.',
  ballpark: 'Ballpark quote: use the Ballpark quote builder. It gives a low-high range formatted for email. Paste its result below if you want the skill to check or reformat it; the SME and Comm Ops intakes are not needed.',
  amendment: 'Amendment / change order: there is no intake for this one. Paste the original SOW details and what is changing (added or removed work, new totals) into the notes box below. The skill asks for anything missing.'
};
const DRAFT_INTAKE_LABELS = {
  sow: 'Comm Ops intake final answers (the "Copy final answers for Claude" text)',
  ppt: 'Comm Ops intake final answers (the "Copy final answers for Claude" text)',
  ballpark: 'Ballpark quote builder result (optional)',
  amendment: 'Intake text, if there is any (optional)'
};
function updateDraftHint() {
  const type = document.getElementById('draft-proposalType').value;
  const hint = document.getElementById('draft-type-hint');
  hint.hidden = !type;
  hint.textContent = DRAFT_TYPE_HINTS[type] || '';
  document.getElementById('draft-intake-label').textContent = DRAFT_INTAKE_LABELS[type] || 'Comm Ops intake final answers';
}
document.getElementById('draft-proposalType').addEventListener('change', updateDraftHint);
const PRICING_MODEL_LABELS = { tm: 'Time and materials', fixed: 'Fixed fee', mix: 'Mix of both' };
// Rough, on-site first pass at picking reference proposals for a draft request:
// keyword overlap between the request's scope text and each database entry,
// plus bonuses for the same deliverable type and pricing model. This replaces
// the old behavior of just taking the first two entries of the matching
// deliverable type. It is only a starting list - the Claude skill does the
// real retrieval and opens the actual files.
function rankReferencesForRequest(payload, limit) {
  const words = tokenize(payload.scope || '');
  if (!words.length || !browseAll || !browseAll.length) return [];
  const typeKeyword = payload.proposalType === 'ballpark' ? 'ballpark' :
    payload.proposalType === 'ppt' ? 'powerpoint' :
    payload.proposalType === 'sow' ? 'sow' : 'amendment';
  const pricingLabel = (PRICING_MODEL_LABELS[payload.pricingModel] || '').toLowerCase();
  return browseAll
    .filter(p => p.current && !NON_PROPOSAL_KINDS.some(k => (p.kind || '').toLowerCase().startsWith(k)))
    .map(p => {
      const text = [p.title, p.clientName, p.summary, p.device.join(' '), p.area.join(' '), p.study.join(' ')].join(' ').toLowerCase();
      const hits = words.filter(w => text.includes(w)).length;
      let score = (hits / words.length) * 100;
      if (((p.deliverableType || '') + ' ' + (p.kind || '')).toLowerCase().includes(typeKeyword)) score += 20;
      if (pricingLabel && (p.pricingModel || '').toLowerCase() === pricingLabel) score += 10;
      return { ...p, score, hits };
    })
    .filter(p => p.hits > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
function buildDraftPrompt(payload) {
  const type = payload.proposalType;
  const typeLabel = PROPOSAL_TYPE_LABELS[type] || 'proposal';
  const clientLabel = payload.clientStatus === 'new' ? 'New client' : payload.clientStatus === 'existing' ? 'Existing client' : 'Not stated here (see the intake, or ask me)';
  const userReferenced = (payload.referencedProposals || '').trim();
  const notes = (payload.scope || '').trim();
  const intake = (payload.pricingInputs || '').trim();
  const nth = payload.firstToday && payload.firstToday !== 'yes' ? payload.firstToday : '';
  let referenceSection;
  if (userReferenced) {
    referenceSection = `I have already identified these past proposals as close matches. Include them as candidates:
${userReferenced}
Also run the skill's reference retrieval in case something in the index is closer.`;
  } else {
    const ranked = rankReferencesForRequest({ scope: notes, proposalType: type }, 3);
    referenceSection = `Starting candidates from the site's proposal index, ranked by keyword overlap with my notes (a rough first pass only; the skill's own retrieval is the source of truth):
${ranked.map(r => `- ${r.title.includes(r.id) ? r.title : r.title + ' (' + r.id + ')'}${r.url ? ' - ' + r.url : ''}`).join('\n') || "- No close keyword match found on the site; rely on the skill's own retrieval."}`;
  }
  let intakeSection;
  if (type === 'sow' || type === 'ppt') {
    intakeSection = intake
      ? `Comm Ops intake final answers (the text from "Copy final answers for Claude", ending with the PROPOSAL-DATA line):\n${intake}\nDecode it with the skill's scripts/decode_proposal_data.py and price it with scripts/price_study.js. Do not re-derive these numbers by hand or estimate them.`
      : `I have not pasted the Comm Ops intake text yet. Follow the skill's intake step: give me the links to the SME intake and Comm Ops intake and wait for the text before drafting.`;
  } else if (type === 'ballpark') {
    intakeSection = intake
      ? `Ballpark quote builder result:\n${intake}\nCheck it against the skill's ballpark quote structure, reformat it for email, and flag anything that needs review.`
      : `I have no Ballpark quote builder result. Point me to the Ballpark quote builder, or ask me for the inputs it needs.`;
  } else {
    intakeSection = intake ? `Intake text (if relevant to this amendment):\n${intake}` : `There is no intake for an amendment. Use the details below and ask me for anything missing (original SOW total, what is added or removed).`;
  }
  const notesSection = notes ? `RFQ / discovery-call notes / change details:\n${notes}` : 'No RFQ or call notes were provided.';
  return `Please use the proposal-draft-reference-tool skill to draft a first-pass ${typeLabel} for Acme HF, a human factors engineering (HFE) consultancy that supports medical device and combination product clients.
Run this in a Cowork session. First, immediately request access to the folder C:\\Users\\<my user name>\\Acme HF\\Proposal Process Project - Proposal Index (do not ask me whether it is synced), because the reference retrieval needs it.
File name: ${nth ? 'this is my proposal number ' + nth + ' today (add _' + nth + ' to the file name)' : 'this is my first proposal today (no number on the file name)'}.
Client status: ${clientLabel}
${intakeSection}
${notesSection}
${referenceSection}
Follow the skill's full workflow: reference retrieval from the full proposal index with the confidentiality rules (never put another client's name, product, program, patient data or exact figures into the draft), the leak check, the final self-check pass, and saving the finished file in this session's outputs folder (plus a copy in the Claude Outputs folder if it is mounted).
Use precise HFE terminology consistent with FDA Human Factors guidance and IEC 62366-1: say "use-related risk" (not "user error"), "intended users" and "use scenarios" (not "end users" or "situations"), "summative evaluation" and "formative evaluation" (not "usability test" or "final study"), "simulated use" (not "mock use"), and "critical tasks" for tasks where failure could cause serious harm.
End with the skill's mandatory "Needs your/an SME's review" summary, including a "References used" section, and flag any pricing, methodology or template item before this goes to a client.`;
}
document.getElementById('draft-form').addEventListener('reset', () => {
  document.getElementById('draft-output').hidden = true;
  setTimeout(updateDraftHint, 0);
});
document.getElementById('draft-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const payload = Object.fromEntries(form.entries());
  await loadBrowseData();
  const prompt = buildDraftPrompt(payload);
  const outputBox = document.getElementById('draft-output');
  outputBox.hidden = false;
  let copied = false;
  try {
    await navigator.clipboard.writeText(prompt);
    copied = true;
  } catch (err) {
    copied = false;
  }
  outputBox.innerHTML = `
    <p style="margin:0 0 10px;">${copied ? 'Prompt copied to your clipboard.' : 'Could not copy automatically - select and copy the text below.'} Open Claude, start a Cowork session (not a regular chat), and paste it in. The skill will ask you to approve the Proposal Index folder, then draft from your intake answers.</p>
    <a href="https://claude.ai/new" target="_blank" rel="noopener" class="primary-btn" style="display:inline-block;text-decoration:none;margin-bottom:12px;">Open Claude</a>
    <pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:10px;margin:0;">${redactEscapeHtml(prompt)}</pre>
  `;
});
// --- Process reference ---
const PROCESS_STAGES = [
  { name: 'New Lead', desc: 'The opportunity comes in through the sales funnel, a web lead, or an existing client relationship. For new clients, the business development lead handles the introduction and NDA.' },
  { name: 'Pre Proposal', desc: 'Information gathering through a discovery call with the client, back-and-forth emails and questions, and an internal SME call before the request is populated into the proposal request form.' },
  { name: 'Proposal Creation', desc: 'Based on client status and the situation, the team creates one of: a ballpark quote, PowerPoint proposal, Word SOW, or an amendment / change order.' },
  { name: 'Internal Draft & Review', desc: "Internal draft, internal revisions, SME review, executive input on some proposals (not all), then finalized to PDF and ready to send." },
  { name: 'Proposal Execution', desc: 'Sent to the client, followed by any revisions from client feedback and answering client questions.' },
  { name: 'Proposal Decision', desc: 'The client either wins the work (moves to sign-off), decides not to move forward (with a reason noted), or goes quiet.' },
  { name: 'Proposal Sign Off (won only)', desc: 'Signed statement of work through e-signature, NDA execution, a purchase order raised by the client, the CRM updated to won, and a notification to the proposals inbox.' },
  { name: 'Proposal to Project Initiated', desc: 'The engagement is transferred to the project-management system and an internal project record is created.' }
];
document.getElementById('process-list').innerHTML = PROCESS_STAGES.map(stage => `
  <div class="process-stage">
    <h3>${stage.name}</h3>
    <p>${stage.desc}</p>
  </div>
`).join('');
// --- How to use this site (quick step-by-step reference) ---
const HOWTO_STEPS = [
  { num: 1, title: 'Start from the RFQ', desc: 'Save or export the RFQ as text or PDF (or copy the body of the email). Then use Start from an RFQ: it builds a request for Claude (in Cowork). Claude replies with a short summary of the RFQ, a line starting with RFQ-PREFILL that pre-fills the SME intake, questions for the client with the assumption we will use if they do not answer, and a draft email to the client. Review and send the email yourself. This step is optional but saves the most time.', jump: 'tool:tool-rfq-start.html', jumpLabel: 'Go to Start from an RFQ' },
  { num: 2, title: 'SME intake', desc: 'The SME answers the study scope and design questions (device, study type, user groups, deliverables). If you used Start from an RFQ, paste the RFQ-PREFILL line into the box at the top of the form first and click Fill from RFQ, then check every answer marked as pre-filled. When finished, they copy the result. It ends with an SME-CODE line. Everything is saved in your browser, so use the same browser and computer until you have copied it.', jump: 'tool:tool-sme-intake.html', jumpLabel: 'Go to SME intake' },
  { num: 3, title: 'Comm Ops intake', desc: 'Comm Ops pastes the SME text into the import box, checks the SME answers, and adds the commercial inputs (pricing model, rates, staffing, project management, and for a deck the layout and contacts). The live estimate on the page uses the same pricing code as the Study pricing calculator. When it looks right, click "Copy final answers for Claude". The copied text ends with TIMELINE-DATA and PROPOSAL-DATA lines.', jump: 'tool:tool-comm-ops-intake.html', jumpLabel: 'Go to Comm Ops intake' },
  { num: 4, title: 'Optional: check pricing or build a timeline', desc: 'The Study pricing calculator and Other deliverables pricing let you check a number on its own. The Timeline tool inputs and Proposal timeline builder make the week-by-week timeline (the Word SOW leaves a highlighted placeholder where you paste it). For a ballpark quote only, skip steps 2 and 3 and use the Ballpark quote builder.', jump: 'pricingCalc', jumpLabel: 'Go to Study pricing calculator' },
  { num: 5, title: 'Optional: find similar past proposals', desc: 'Use Find similar proposals to build a prompt, then run it in Cowork with the proposal-index-search skill. It searches Acme HF\'s full proposal index (tags and slide text) and returns links that open in your browser. The drafting skill also does this automatically.', jump: 'search', jumpLabel: 'Go to Find similar proposals' },
  { num: 6, title: 'Draft the proposal in Cowork', desc: 'Start a Cowork session (the skill needs the Proposal Index folder, and Cowork will ask you to approve it). Either paste the "Copy final answers for Claude" text and say which deliverable you want (Word SOW, PowerPoint, or ballpark quote), or use Draft proposal to build the prompt for you (it takes the pasted Comm Ops text, your RFQ notes and reference proposals, and asks the skill to follow its full workflow). The skill prices it, finds reference proposals, builds the draft and gives you a list of items to review.', jump: 'draft', jumpLabel: 'Go to Draft proposal' },
  { num: 7, title: 'Finish and review', desc: 'Word: fill in the yellow highlighted items (including the timeline). PowerPoint: delete the content slides you do not want. Then check the skill\u2019s "Needs your/an SME\u2019s review" summary, verify the pricing, confirm HFE terminology, and get SME sign-off before anything goes to a client.' },
];
const HOWTO_TOOLS = [
  { title: 'Study pricing calculator', desc: 'Detailed study cost estimate (Study Pricing Calculator (demo rates)). Comm Ops intake uses the same pricing code.', jump: 'pricingCalc', jumpLabel: 'Go to Study pricing calculator' },
  { title: 'Other deliverables pricing', desc: 'Small / medium / large prices for non-study deliverables.', jump: 'tool:tool-other-deliverables.html', jumpLabel: 'Go to Other deliverables pricing' },
  { title: 'Timeline tool inputs and Proposal timeline builder', desc: 'Set up and edit a proposal timeline, with or without an intake form.', jump: 'tool:tool-timeline-inputs.html', jumpLabel: 'Go to Timeline tool inputs' },
  { title: 'Ballpark quote builder', desc: 'Low and high price ranges from a few inputs, formatted for email.', jump: 'tool:tool-ballpark.html', jumpLabel: 'Go to Ballpark quote builder' },
  { title: 'Browse proposal database', desc: 'Browse and filter every proposal and related document in the full index by client, year, device type, therapeutic area, study type and deal size. Titles open the document in your browser. Tags are automatic and may be wrong.', jump: 'browseDb', jumpLabel: 'Go to Browse proposal database' },
  { title: 'Add or correct a proposal in the database', desc: "The database is built from the shared Proposals folder and updated by the weekly scan. Use this to get a missing file added before the next scan, or to correct the tags on an existing entry. It prepares a request for the person who maintains the index.", jump: 'addProposal', jumpLabel: 'Go to Add proposal to database' },
  { title: 'Record a proposal outcome', desc: "Tell us whether a sent proposal was won, lost or went quiet, with the reason and final price. Proposals with a signed copy already count as won. Recorded outcomes show in Browse proposal database and help the drafting skill and the weekly report. It prepares a request for the person who maintains the index.", jump: 'outcome', jumpLabel: 'Go to Record a proposal outcome' },
  { title: 'Proposal status & team schedule', desc: "See everyone's proposal due dates and SME review status in one place, in list or calendar view, so work doesn't get piled onto one person and nothing gets missed. Add a proposal when you start drafting, press Mark as sent when it goes out (this schedules the client follow-up), and check the \"This week at a glance\" box for overdue items, items due in 7 days, follow-ups owed and items nobody has updated.", jump: 'schedule', jumpLabel: 'Go to Proposal status & team schedule' },
  { title: 'Master Rate Card', desc: "Check the current rates the Study Pricing Calculator (demo rates) uses (USD), plus the role rate card.", jump: 'rateCard', jumpLabel: 'Go to Master Rate Card' },
];
function renderHowtoStep(step) {
  return `
  <div class="process-stage howto-step">
    <div style="display:flex; align-items:center; gap:12px;">
      <span style="flex:0 0 auto; width:28px; height:28px; border-radius:50%; background:#196972; color:#fff; font-weight:700; font-size:14px; display:flex; align-items:center; justify-content:center;">${step.num}</span>
      <h3 style="margin:0;">${step.title}</h3>
    </div>
    <p>${step.desc}</p>
    ${step.jump ? `<button type="button" class="primary-btn howto-jump-btn" data-target="${step.jump}" style="margin-top:4px;">${step.jumpLabel} &rarr;</button>` : ''}
  </div>
`;
}
function renderHowtoTool(tool) {
  return `
  <div class="process-stage howto-step">
    <h3 style="margin:0;">${tool.title}</h3>
    <p>${tool.desc}</p>
    ${tool.jump ? `<button type="button" class="primary-btn howto-jump-btn" data-target="${tool.jump}" style="margin-top:4px;">${tool.jumpLabel} &rarr;</button>` : ''}
  </div>
`;
}
document.getElementById('howto-list').innerHTML = HOWTO_STEPS.map(renderHowtoStep).join('');
document.getElementById('howto-tools-list').innerHTML = HOWTO_TOOLS.map(renderHowtoTool).join('');
function handleHowtoJumpClick(e) {
  const btn = e.target.closest('.howto-jump-btn');
  if (!btn) return;
  const target = btn.dataset.target;
  if (target === 'browseDb') renderBrowseList();
  if (target === 'schedule') openScheduleTool();
  if (target.startsWith('tool:')) { const b = document.querySelector('[data-tool="' + target.slice(5) + '"]'); openTool(target.slice(5), b ? b.dataset.title : ''); return; }
  showView(target);
}
document.getElementById('howto-list').addEventListener('click', handleHowtoJumpClick);
document.getElementById('howto-tools-list').addEventListener('click', handleHowtoJumpClick);
// --- Add or correct a proposal in the database (prepares a request for the index maintainer) ---
document.getElementById('add-mode').addEventListener('change', (e) => {
  document.getElementById('add-id-row').hidden = e.target.value !== 'correct';
});
document.getElementById('add-proposal-form').addEventListener('reset', () => {
  const out = document.getElementById('add-proposal-output');
  out.hidden = true;
  out.innerHTML = '';
  document.getElementById('add-id-row').hidden = true;
});
document.getElementById('add-proposal-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const g = k => (f.get(k) || '').toString().trim();
  const correct = g('mode') === 'correct';
  if (correct && !g('id')) { alert('Enter the ID of the entry to correct (copy it from Browse proposal database).'); return; }
  const lines = [];
  if (g('client')) lines.push(`Client: ${g('client')}`);
  if (g('date')) lines.push(`Document date: ${g('date')}`);
  if (g('kind')) lines.push(`Kind of document: ${g('kind')}`);
  if (g('device')) lines.push(`Device type: ${g('device')}`);
  if (g('area')) lines.push(`Therapeutic area: ${g('area')}`);
  if (g('study')) lines.push(`Study type: ${g('study')}`);
  if (g('structure')) lines.push(`Proposal structure / pricing model: ${g('structure')}`);
  if (g('notes')) lines.push(`Notes: ${g('notes')}`);
  const prompt = correct
    ? `Please use the proposal-index-organizer skill to apply a single correction to Acme HF's proposal index.
Run this in a Cowork session. First, immediately request access to the folder C:\\Users\\<my user name>\\Acme HF\\Proposal Process Project - Proposal Index (do not ask me whether it is synced).
Entry to correct: ${g('id')}
Document: ${g('title')}
Link or path: ${g('sourceUrl')}
Corrected values (only change the fields listed here):
${lines.join('\n') || '- (none listed; see the notes)'}
Follow the skill's "Single additions and corrections" procedure: find the entry by its ID, apply only these changes, mark it reviewed, rebuild Tools/site/internal-index.json, and tell me which files to re-upload to the site.`
    : `Please use the proposal-index-organizer skill to add one document to Acme HF's proposal index now, instead of waiting for the weekly scan.
Run this in a Cowork session. First, immediately request access to these folders (do not ask me whether they are synced): C:\\Users\\<my user name>\\Acme HF\\Proposal Process Project - Proposal Index and C:\\Users\\<my user name>\\Acme HF\\Commercial Operations - Proposals.
Document: ${g('title')}
Link or path: ${g('sourceUrl')}
${lines.join('\n')}
Follow the skill's "Single additions and corrections" procedure: confirm the file is in scope (the firm's own proposal documents dated 2025 or later), tell me if it needs to be downloaded first, index it, apply any tags I gave above (mark those fields reviewed), rebuild Tools/site/internal-index.json, and tell me which files to re-upload to the site.`;
  const outputBox = document.getElementById('add-proposal-output');
  outputBox.hidden = false;
  let copied = false;
  try { await navigator.clipboard.writeText(prompt); copied = true; } catch (err) { copied = false; }
  const safe = redactEscapeHtml(prompt);
  outputBox.innerHTML = `
    <p style="margin:0 0 10px;">${copied ? 'Request copied to your clipboard.' : 'Could not copy automatically - select and copy the text below.'} If you maintain the proposal index, start a Cowork session and paste it in. Otherwise send it to the index owner (Cory, demo@example.com). The index changes only when this request is run, and the site shows the change after the updated index file is uploaded.</p>
    <pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:10px;margin:0;">${safe}</pre>
  `;
});
// --- Record a proposal outcome (prepares a request for the index maintainer; nothing is sent from the page) ---
function renderOutcomeMatches() {
  const sel = document.getElementById('outcome-pick');
  const q = document.getElementById('outcome-find').value.trim().toLowerCase();
  const words = q ? q.split(/\s+/) : [];
  const pool = (browseAll || []).filter(e => e.current && /proposal|estimate|quote/i.test(e.kind || ''));
  if (!pool.length) { sel.innerHTML = '<option value="">The proposal database is not loaded, so type the reference number in the note instead</option>'; return; }
  const hits = (words.length ? pool.filter(e => { const b = [e.title, e.clientName, e.id].join(' ').toLowerCase(); return words.every(w => b.includes(w)); }) : pool.slice().sort((x, y) => String(y.date).localeCompare(String(x.date)))).slice(0, 40);
  sel.innerHTML = hits.length
    ? hits.map(e => `<option value="${browseEsc(e.id)}" data-title="${browseEsc(e.title)}">${browseEsc((e.clientName || '') + ' | ' + (e.date || '') + ' | ' + e.title)}${e.outcome ? ' [' + browseEsc(outcomeLabel(e)) + ']' : ''}</option>`).join('')
    : '<option value="">No match: try fewer words or the reference number</option>';
}
document.getElementById('outcome-find').addEventListener('input', renderOutcomeMatches);
document.getElementById('outcome-result').addEventListener('change', (e) => {
  document.getElementById('outcome-reason-row').hidden = !['Lost', 'No response', 'Withdrawn by client'].includes(e.target.value);
});
document.getElementById('outcome-form').addEventListener('reset', () => {
  document.getElementById('outcome-output').hidden = true;
  document.getElementById('outcome-output').innerHTML = '';
  document.getElementById('outcome-reason-row').hidden = true;
  setTimeout(renderOutcomeMatches, 0);
});
document.getElementById('outcome-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const g = k => (f.get(k) || '').toString().trim();
  if (!g('id')) { alert('Pick the proposal from the list first.'); return; }
  const opt = document.querySelector('#outcome-pick option:checked');
  const rec = { id: g('id'), outcome: g('outcome') };
  if (g('reason')) rec.reason = g('reason');
  if (g('finalPrice')) rec.finalPrice = g('finalPrice');
  if (g('decisionDate')) rec.decisionDate = g('decisionDate');
  if (g('note')) rec.note = g('note');
  const email = (typeof getSiteLoginEmail === 'function' && getSiteLoginEmail()) || '';
  if (email) rec.recordedBy = email;
  const prompt = `Please use the proposal-index-organizer skill to record one proposal outcome in Acme HF's proposal index.
Run this in a Cowork session. First, immediately request access to the folder C:\\Users\\<my user name>\\Acme HF\\Proposal Process Project - Proposal Index (do not ask me whether it is synced).
Proposal: ${opt ? opt.dataset.title : g('id')}
Follow the skill's "Recording outcomes" procedure: run Tools/organizer/record_outcome.py with the line below, confirm what was recorded, rebuild Tools/site/internal-index.json, and tell me which files to re-upload to the site.
OUTCOME-DATA: ${JSON.stringify(rec)}`;
  const outputBox = document.getElementById('outcome-output');
  outputBox.hidden = false;
  let copied = false;
  try { await navigator.clipboard.writeText(prompt); copied = true; } catch (err) { copied = false; }
  outputBox.innerHTML = `
    <p style="margin:0 0 10px;">${copied ? 'Request copied to your clipboard.' : 'Could not copy automatically - select and copy the text below.'} If you maintain the proposal index, start a Cowork session and paste it in. Otherwise send it to the person who does.</p>
    <pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:10px;margin:0;">${redactEscapeHtml(prompt)}</pre>
  `;
});
// --- De-identify an RFQ (entirely client-side - nothing here is sent anywhere) ---
const REDACT_WHITELIST = ['FDA','IEC','ISO','CFR','ANSI','AAMI','ASTM','EN','HFE','US','USA','UK','EU','PDF','SOW','RFQ','RFP','NDA','API','UI','UX','OK'];
const REDACT_PHRASE_WHITELIST = new Set([
  'human factors', 'use environment', 'use environments', 'intended users', 'intended user',
  'formative evaluation', 'summative evaluation', 'simulated use', 'critical tasks', 'critical task',
  'use related risk', 'use-related risk', 'use scenarios', 'use scenario', 'united states',
  'human factors guidance', 'design history', 'risk management', 'quality management',
  'clinical evaluation', 'usability engineering', 'medical device', 'combination product',
  'proposal type', 'pricing model', 'change order', 'device type', 'use context'
].map(s => s.toLowerCase()));
const REDACT_SENTENCE_STARTERS = new Set([
  'this', 'the', 'a', 'an', 'we', 'our', 'they', 'it', 'he', 'she', 'you', 'i', 'please', 'thank',
  'these', 'those', 'some', 'any', 'all', 'each', 'if', 'when', 'while', 'after', 'before',
  'since', 'because', 'and', 'or', 'but', 'so', 'as', 'per'
]);
const REDACT_COMMON_WORDS = new Set([
  ...REDACT_SENTENCE_STARTERS, 'for', 'with', 'from', 'into', 'onto', 'upon', 'via', 'not', 'no',
  'yes', 'can', 'may', 'will', 'shall', 'should', 'would', 'could', 'must', 'has', 'have', 'had',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'that', 'there', 'here', 'what', 'which', 'who',
  'level', 'phase', 'section', 'table', 'figure', 'appendix', 'step', 'item', 'option', 'part',
  'support', 'review', 'formative', 'summative', 'quotation', 'format', 'pricing', 'involvement',
  'activities', 'protocol', 'report', 'proposal', 'attend', 'plus', 'includes', 'based', 'currently',
  'planned', 'preparation', 'execution', 'study', 'feedback', 'final', 'provide', 'price', 'itemised',
  'itemized', 'required', 'additional', 'information', 'requirements', 'documentation', 'summary',
  'overview', 'introduction', 'background', 'scope', 'timeline', 'deliverables', 'submission',
  'instructions', 'criteria', 'evaluation', 'objective', 'objectives', 'purpose', 'general', 'specific',
  'technical', 'commercial', 'terms', 'conditions', 'confidentiality', 'schedule', 'milestones',
  'assumptions', 'exclusions', 'qualifications', 'experience', 'personnel', 'staffing', 'timing',
  'process', 'approach', 'methodology', 'considerations', 'notes', 'reference', 'references',
  'page', 'pages', 'user', 'users', 'drug', 'drugs'
]);
function redactEscapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function cleanRfqFormatting(text) {
  let out = text;
  out = out.replace(/([•▪◦‣]\s*){2,}/g, '\n');
  out = out.replace(/\b([B-HJ-Z])\s+([a-z]{2,})\b/g, '\n- $1$2');
  out = out.replace(/[•▪◦‣]\s*/g, '- ');
  out = out.replace(/[ \t]+/g, ' ');
  out = out.replace(/ +\n/g, '\n');
  out = out.replace(/\n[ \t]+/g, '\n');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}
function findRepeatedCapitalizedWords(text) {
  const wordRegex = /\b[A-Z][a-zA-Z]{2,}\b/g;
  const positions = {};
  let m;
  while ((m = wordRegex.exec(text)) !== null) {
    const word = m[0];
    if (REDACT_COMMON_WORDS.has(word.toLowerCase())) continue;
    if (REDACT_WHITELIST.includes(word.toUpperCase())) continue;
    (positions[word] = positions[word] || []).push(m.index);
  }
  const repeated = [];
  Object.entries(positions).forEach(([word, idxs]) => {
    if (idxs.length < 3) return;
    idxs.forEach(idx => repeated.push({ start: idx, end: idx + word.length, category: 'repeated', value: word }));
  });
  return repeated;
}
function findClientNameMatches(text, clientName) {
  const name = (clientName || '').trim();
  if (!name) return [];
  const escaped = redactEscapeRegex(name);
  const startsWithWord = /^\w/.test(name);
  const pattern = new RegExp(
    (startsWithWord ? '\\b' : '') + escaped + "(?:['’]s|s)?\\b",
    'gi'
  );
  const found = [];
  let m;
  while ((m = pattern.exec(text)) !== null) {
    found.push({ start: m.index, end: m.index + m[0].length, category: 'clientName', value: m[0] });
  }
  return found;
}
function scanForIdentifyingInfo(text, clientName) {
  const combinedRegex = /(?<url>\b(?:https?:\/\/|www\.)[^\s)>\]"']+)|(?:(?<=\b(?:[Pp]assword|[Pp]wd|[Pp]asscode)\s{0,3}[:=]\s{0,3}))(?<password>\S+)|(?<company>\b(?:[A-Z][a-zA-Z&']*[ \t]){1,3}(?:Inc|LLC|Corp|Corporation|Ltd|Co|GmbH|LLP|PLC)\.?\b)|(?<email>\b[\w.+-]+@[\w-]+\.[\w.-]+\b)|(?<phone>\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b)|(?<code>\b[A-Z]{1,5}-\d{2,6}[A-Za-z]?\b|\b[A-Z]{2,5}\d{2,6}[A-Za-z]?\b)|(?<allcaps>\b[A-Z]{2,10}\b(?![^\s]*@))|(?<propername>\b[A-Z][a-zA-Z]+(?:[ \t]+[A-Z][a-zA-Z]+){1,3}\b(?![^\s]*@))/g;
  const rawMatches = [];
  let m;
  while ((m = combinedRegex.exec(text)) !== null) {
    let category = null;
    if (m.groups.url) category = 'url';
    else if (m.groups.password) category = 'password';
    else if (m.groups.company) category = 'company';
    else if (m.groups.email) category = 'email';
    else if (m.groups.phone) category = 'phone';
    else if (m.groups.code) category = 'code';
    else if (m.groups.allcaps) category = 'allcaps';
    else if (m.groups.propername) category = 'propername';
    const value = m[0];
    if (category === 'code' || category === 'allcaps') {
      const firstToken = value.split(/[-\s]/)[0].toUpperCase();
      if (REDACT_WHITELIST.includes(firstToken)) continue;
    }
    if (category === 'propername' || category === 'company') {
      if (REDACT_PHRASE_WHITELIST.has(value.toLowerCase())) continue;
      const firstWord = value.split(/\s+/)[0].toLowerCase();
      if (category === 'propername' && REDACT_SENTENCE_STARTERS.has(firstWord)) continue;
      const words = value.split(/[ \t]+/).filter(Boolean);
      const suffixWords = category === 'company'
        ? words.filter(w => !/^(Inc|LLC|Corp|Corporation|Ltd|Co|GmbH|LLP|PLC)\.?$/.test(w))
        : words;
      if (suffixWords.length && suffixWords.every(w => REDACT_COMMON_WORDS.has(w.toLowerCase()))) continue;
    }
    rawMatches.push({ start: m.index, end: m.index + value.length, category, value });
  }
  rawMatches.push(...findRepeatedCapitalizedWords(text));
  const clientMatches = findClientNameMatches(text, clientName);
  const allMatches = [...clientMatches, ...rawMatches];
  allMatches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const matches = [];
  let lastEnd = -1;
  allMatches.forEach(mt => {
    if (mt.start >= lastEnd) {
      matches.push(mt);
      lastEnd = mt.end;
    }
  });
  const TRADE_SECRET_KEYWORDS = [
    'proprietary', 'confidential', 'trade secret', 'patent pending', 'patented',
    'unpublished', 'unreleased', 'formulation', 'algorithm', 'know-how', 'knowhow',
    'do not disclose', 'non-disclosure', 'nda', 'internal use only', 'restricted',
    'unannounced', 'undisclosed'
  ];
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const flaggedSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return TRADE_SECRET_KEYWORDS.some(k => lower.includes(k));
  });
  return { matches, flaggedSentences };
}
function buildHighlightedHtml(text, matches) {
  let html = '';
  let cursor = 0;
  matches.forEach(m => {
    html += redactEscapeHtml(text.slice(cursor, m.start));
    html += `<mark class="redact-mark redact-${m.category}">${redactEscapeHtml(text.slice(m.start, m.end))}</mark>`;
    cursor = m.end;
  });
  html += redactEscapeHtml(text.slice(cursor));
  return html;
}
const REDACT_CATEGORY_LABELS = {
  clientName: "client name (provided) - matches the name, its plural, and possessive forms",
  company: 'possible organization name',
  propername: 'possible name (person, company, or product)',
  email: 'email address / domain',
  phone: 'possible phone number',
  code: 'possible model / part number',
  allcaps: 'possible acronym or product code',
  repeated: 'name repeated throughout the text (likely the client)',
  url: 'link (can identify the client via its domain, even if the page content looks generic)',
  password: 'password / access credential'
};
const REDACT_PLACEHOLDERS = {
  clientName: '[CLIENT NAME]',
  company: '[COMPANY NAME]',
  propername: '[NAME]',
  repeated: '[CLIENT NAME]',
  email: '[EMAIL ADDRESS]',
  phone: '[PHONE NUMBER]',
  code: '[MODEL/PART NUMBER]',
  allcaps: '[IDENTIFIER]',
  url: '[LINK REMOVED]',
  password: '[PASSWORD REMOVED]'
};
let lastRedactTerms = [];
function redactEscapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function dedupeRedactTerms(matches) {
  const byValue = {};
  matches.forEach(m => {
    if (!byValue[m.value]) {
      byValue[m.value] = { value: m.value, category: m.category, count: 0 };
    }
    byValue[m.value].count += 1;
  });
  return Object.values(byValue).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
function renderRedactTermList(terms) {
  const box = document.getElementById('redact-term-list-box');
  const list = document.getElementById('redact-term-list');
  const selectAll = document.getElementById('redact-select-all');
  if (!terms.length) {
    box.hidden = true;
    list.innerHTML = '';
    return;
  }
  box.hidden = false;
  selectAll.checked = true;
  list.innerHTML = terms.map((t, i) => `
    <label class="redact-term-row">
      <input type="checkbox" class="redact-term-checkbox" data-index="${i}" checked>
      <span><strong>${redactEscapeHtml(t.value)}</strong> - ${REDACT_CATEGORY_LABELS[t.category]}${t.count > 1 ? ` (${t.count}x)` : ''}</span>
    </label>
  `).join('');
}
document.getElementById('redact-form').addEventListener('reset', () => {
  document.getElementById('redact-output').hidden = true;
  lastRedactTerms = [];
  document.getElementById('redact-term-list-box').hidden = true;
  document.getElementById('redact-term-list').innerHTML = '';
});
document.getElementById('redact-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const rawText = formData.get('rfqText') || '';
  const clientName = (formData.get('clientName') || '').trim();
  const text = rawText.trim() ? cleanRfqFormatting(rawText) : rawText;
  const { matches, flaggedSentences } = scanForIdentifyingInfo(text, clientName);
  const outputBox = document.getElementById('redact-output');
  outputBox.hidden = false;
  const highlightedBox = document.getElementById('redact-highlighted');
  const cleanupNote = rawText.trim() && rawText !== text
    ? '<p style="margin:0 0 10px;font-style:italic;color:var(--text-muted);">Common copy/paste formatting issues (split words, stray bullet characters) were cleaned up automatically below - please still skim it.</p>'
    : '';
  if (!text.trim()) {
    highlightedBox.innerHTML = '<p style="margin:0;">Paste some RFQ text above first.</p>';
  } else if (matches.length === 0) {
    highlightedBox.innerHTML = cleanupNote + '<p style="margin:0;">No likely names, organizations, model numbers, or emails were found. Still worth a manual read - this scan is not exhaustive.</p>';
  } else {
    const counts = {};
    matches.forEach(m => { counts[m.category] = (counts[m.category] || 0) + 1; });
    const summary = Object.entries(counts)
      .map(([cat, n]) => `${n} ${REDACT_CATEGORY_LABELS[cat]}${n === 1 ? '' : 's'}`)
      .join(', ');
    highlightedBox.innerHTML = `${cleanupNote}<p style="margin:0 0 12px;"><strong>Flagged: ${summary}.</strong> Review each highlighted item below.</p><div>${buildHighlightedHtml(text, matches)}</div>`;
  }
  const sentencesBox = document.getElementById('redact-flagged-sentences');
  if (flaggedSentences.length === 0) {
    sentencesBox.innerHTML = '';
  } else {
    sentencesBox.innerHTML = `
      <div class="output" style="border-left-color: var(--purple);">
        <strong>Sentences that may reference proprietary or confidential info:</strong>
        <ul style="margin:8px 0 0; padding-left:18px;">
          ${flaggedSentences.map(s => `<li style="margin-bottom:6px;">${redactEscapeHtml(s)}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  lastRedactTerms = matches.length ? dedupeRedactTerms(matches) : [];
  renderRedactTermList(lastRedactTerms);
  document.getElementById('redact-working').value = text;
  document.getElementById('redact-copy-confirm').hidden = true;
});
document.getElementById('redact-select-all').addEventListener('change', (e) => {
  document.querySelectorAll('.redact-term-checkbox').forEach(cb => { cb.checked = e.target.checked; });
});
document.getElementById('redact-apply-removals-btn').addEventListener('click', () => {
  const checkboxes = Array.from(document.querySelectorAll('.redact-term-checkbox:checked'));
  const workingBox = document.getElementById('redact-working');
  const text = workingBox.value;
  const terms = checkboxes
    .map(cb => lastRedactTerms[Number(cb.dataset.index)])
    .filter(Boolean)
    .sort((a, b) => b.value.length - a.value.length);
  const spans = [];
  terms.forEach(term => {
    const placeholder = REDACT_PLACEHOLDERS[term.category] || '[REMOVED]';
    const escaped = redactEscapeRegex(term.value);
    const startsWithWord = /^\w/.test(term.value);
    const endsWithWord = /\w$/.test(term.value);
    const pattern = new RegExp((startsWithWord ? '\\b' : '') + escaped + (endsWithWord ? '\\b' : ''), 'g');
    let m;
    while ((m = pattern.exec(text)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, placeholder });
    }
  });
  spans.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  let result = '';
  let cursor = 0;
  let lastEnd = -1;
  spans.forEach(sp => {
    if (sp.start < lastEnd) return;
    result += text.slice(cursor, sp.start) + sp.placeholder;
    cursor = sp.end;
    lastEnd = sp.end;
  });
  result += text.slice(cursor);
  workingBox.value = result;
});
document.getElementById('redact-copy-btn').addEventListener('click', async () => {
  const text = document.getElementById('redact-working').value;
  const confirmBox = document.getElementById('redact-copy-confirm');
  confirmBox.hidden = false;
  try {
    await navigator.clipboard.writeText(text);
    confirmBox.textContent = 'Cleaned text copied to your clipboard.';
  } catch (err) {
    confirmBox.textContent = 'Could not copy automatically - select and copy the text in the box above.';
  }
});
document.getElementById('redact-use-in-draft-btn').addEventListener('click', () => {
  const text = document.getElementById('redact-working').value;
  document.getElementById('draft-scope').value = text;
  document.getElementById('draft-output').hidden = true;
  showView('draft');
});
document.getElementById('redact-use-in-search-btn').addEventListener('click', () => {
  const text = document.getElementById('redact-working').value;
  document.getElementById('search-query').value = text;
  resetSearchOutputs();
  showView('search');
});
document.getElementById('redact-clear-page-btn').addEventListener('click', () => {
  document.getElementById('redact-form').reset();
});
// --- Proposal status & team schedule ---
//
// In the original this was backed by Firebase Firestore (live sync for the whole team). In this demo a small
// browser-only stand-in (demo-backend.js) keeps the same calls working. Original note: Actions was too slow for live data -
// Actions is fine for CI but too slow for live app data (every run spins up a
// fresh VM, typically 10-30+ seconds, before your code even runs). Firestore
// pushes changes to everyone in real time, no polling needed.
firebase.initializeApp({});   // demo-backend.js provides a browser-only stand-in
const scheduleDb = firebase.firestore();
const SCHEDULE_ACCOUNT_KEY = 'acmeScheduleAccount';
const SCHEDULE_TASK_TYPES = ['Drafting', 'SME Review', 'Client Follow-up', 'Other'];
const SCHEDULE_STATUSES = ['Not started', 'In progress', 'Complete'];
let scheduleData = { people: [], entries: [] };
let scheduleAccount = null;
let scheduleEditingId = null;
let scheduleEntriesUnsub = null;
let schedulePeopleUnsub = null;
function schedulePersonDocId(email) {
  return email.toLowerCase().replace(/[^a-z0-9]/g, '_');
}
function getSiteLoginEmail() {
  return (sessionStorage.getItem(ACCESS_KEY) || '').trim();
}
function loadScheduleAccount() {
  try {
    const raw = localStorage.getItem(SCHEDULE_ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email && parsed.name && parsed.role) return parsed;
    return null;
  } catch (err) {
    return null;
  }
}
function saveScheduleAccount(account) {
  scheduleAccount = account;
  localStorage.setItem(SCHEDULE_ACCOUNT_KEY, JSON.stringify(account));
}
function forgetScheduleAccount() {
  localStorage.removeItem(SCHEDULE_ACCOUNT_KEY);
  scheduleAccount = null;
  stopScheduleListeners();
  renderScheduleAccountBox();
  renderScheduleBoard();
  renderMyScheduleEntries();
}
async function leaveScheduleTool() {
  if (!scheduleAccount) return;
  if (!window.confirm('Remove your saved account and delete all of your schedule items? This cannot be undone.')) return;
  try {
    const mine = scheduleData.entries.filter(
      (e) => e.ownerEmail.toLowerCase() === scheduleAccount.email.toLowerCase()
    );
    await Promise.all(mine.map((e) => scheduleDb.collection('scheduleEntries').doc(e.id).delete()));
    await scheduleDb.collection('schedulePeople').doc(schedulePersonDocId(scheduleAccount.email)).delete();
    forgetScheduleAccount();
  } catch (err) {
    setScheduleSyncNote('Could not remove your account: ' + err.message);
  }
}
async function saveScheduleEntry(entry, entryId) {
  const ref = entryId ? scheduleDb.collection('scheduleEntries').doc(entryId) : scheduleDb.collection('scheduleEntries').doc();
  await ref.set({ ...entry, updatedAt: new Date().toISOString() });
  return ref.id;
}
async function savePersonRecord(person) {
  await scheduleDb.collection('schedulePeople').doc(schedulePersonDocId(person.email)).set(person);
}
async function deleteScheduleEntryRemote(entryId) {
  await scheduleDb.collection('scheduleEntries').doc(entryId).delete();
}
function scheduleTodayStr() {
  return new Date().toISOString().slice(0, 10);
}
function scheduleDaysUntil(dateStr) {
  const today = new Date(scheduleTodayStr() + 'T00:00:00Z');
  const due = new Date(dateStr + 'T00:00:00Z');
  return Math.round((due - today) / 86400000);
}
// Returns the Sunday-start-of-week date (YYYY-MM-DD) for a given YYYY-MM-DD
// date string. Matches the same Sunday-start week convention already used by
// the calendar view (see scheduleStartOfWeek below).
function scheduleWeekStartStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay());
  return scheduleDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}
// Deletes any schedule entry marked "Complete" whose due-date week has
// already fully ended (i.e. we're now in a later week than the entry's due
// date). This runs opportunistically every time the shared schedule syncs -
// there's no backend cron job in this stack (static site + Firestore, no
// Cloud Functions), so cleanup only actually happens the next time someone
// has the schedule tool open after that week ends. If items need to be
// cleared even when nobody opens the tool, a Firestore TTL policy or a
// Cloud Function would be needed instead.
async function pruneCompletedScheduleEntries() {
  const currentWeekStart = scheduleWeekStartStr(scheduleTodayStr());
  const stale = scheduleData.entries.filter(
    (e) => e.status === 'Complete' && scheduleWeekStartStr(e.dueDate) < currentWeekStart
  );
  if (!stale.length) return;
  try {
    await Promise.all(stale.map((e) => deleteScheduleEntryRemote(e.id)));
  } catch (err) {
    // Non-fatal - if this fails, the stale item(s) just stay until the next successful sync.
  }
}
function renderScheduleAccountBox() {
  const box = document.getElementById('schedule-account-box');
  const mainBox = document.getElementById('schedule-main');
  const siteEmail = getSiteLoginEmail();
  if (!scheduleAccount) {
    mainBox.hidden = true;
    box.innerHTML = `
      <form id="schedule-account-form">
        <label>Your name
          <input type="text" name="name" id="schedule-account-name" required maxlength="80">
        </label>
        <label>Your role
          <input type="text" name="role" id="schedule-account-role" required maxlength="80" placeholder="e.g. Proposal Lead, HFE Consultant">
        </label>
        <label>Your email (demo)
          <input type="email" name="email" id="schedule-account-email" required readonly value="${redactEscapeHtml(siteEmail)}">
        </label>
        <p class="login-desc" style="margin:4px 0 0;">Locked to the email you signed in with.</p>
        <div id="schedule-account-error" class="login-error" hidden>Please enter your name and role.</div>
        <button type="submit" class="primary-btn">Save and continue</button>
      </form>
    `;
    document.getElementById('schedule-account-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const name = (form.get('name') || '').trim();
      const role = (form.get('role') || '').trim();
      const email = siteEmail.toLowerCase();
      const errorBox = document.getElementById('schedule-account-error');
      if (!name || !role || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorBox.hidden = false;
        return;
      }
      errorBox.hidden = true;
      saveScheduleAccount({ name, role, email });
      savePersonRecord({ name, role, email }).catch(() => {});
      renderScheduleAccountBox();
      startScheduleListeners();
    });
    return;
  }
  mainBox.hidden = false;
  box.innerHTML = `
    <p class="login-desc" style="margin:0;">
      Signed in as <strong>${redactEscapeHtml(scheduleAccount.name)}</strong> (${redactEscapeHtml(scheduleAccount.role)}, ${redactEscapeHtml(scheduleAccount.email)})
      &middot; <a id="schedule-edit-account-link" href="javascript:void(0)">edit</a>
      &middot; <a id="schedule-forget-account-link" href="javascript:void(0)">not you? sign out</a>
      &middot; <a id="schedule-leave-link" href="javascript:void(0)">remove me from this tool</a>
    </p>
  `;
  document.getElementById('schedule-forget-account-link').addEventListener('click', forgetScheduleAccount);
  document.getElementById('schedule-leave-link').addEventListener('click', leaveScheduleTool);
  document.getElementById('schedule-edit-account-link').addEventListener('click', () => {
    const box2 = document.getElementById('schedule-account-box');
    box2.innerHTML = `
      <form id="schedule-account-form">
        <label>Your name
          <input type="text" name="name" id="schedule-account-name" required maxlength="80" value="${redactEscapeHtml(scheduleAccount.name)}">
        </label>
        <label>Your role
          <input type="text" name="role" id="schedule-account-role" required maxlength="80" value="${redactEscapeHtml(scheduleAccount.role)}">
        </label>
        <label>Your email (demo)
          <input type="email" name="email" id="schedule-account-email" required readonly value="${redactEscapeHtml(siteEmail)}">
        </label>
        <p class="login-desc" style="margin:4px 0 0;">Locked to the email you signed in with.</p>
        <div id="schedule-account-error" class="login-error" hidden>Please enter your name and role.</div>
        <button type="submit" class="primary-btn">Save</button>
      </form>
    `;
    document.getElementById('schedule-account-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const name = (form.get('name') || '').trim();
      const role = (form.get('role') || '').trim();
      const email = siteEmail.toLowerCase();
      const errorBox = document.getElementById('schedule-account-error');
      if (!name || !role || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorBox.hidden = false;
        return;
      }
      saveScheduleAccount({ name, role, email });
      renderScheduleAccountBox();
      savePersonRecord({ name, role, email }).catch(() => {});
    });
  });
}
function renderScheduleBoard() {
  renderScheduleDigest();
  const boardBox = document.getElementById('schedule-board');
  if (!scheduleData.entries.length) {
    boardBox.innerHTML = '<p class="login-desc" style="margin:0;">No schedule items yet - add one below to get started.</p>';
    return;
  }
  const byOwner = {};
  scheduleData.entries.forEach((entry) => {
    (byOwner[entry.ownerEmail] = byOwner[entry.ownerEmail] || []).push(entry);
  });
  const people = scheduleData.people.slice().sort((a, b) => a.name.localeCompare(b.name));
  boardBox.innerHTML = people
    .map((person) => {
      const entries = (byOwner[person.email] || []).slice().sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
      if (!entries.length) return '';
      const rows = entries
        .map((entry) => {
          const daysUntil = scheduleDaysUntil(entry.dueDate);
          let flagClass = '';
          let flagLabel = '';
          if (entry.status !== 'Complete') {
            if (daysUntil < 0) { flagClass = 'schedule-overdue'; flagLabel = 'Overdue'; }
            else if (daysUntil <= 3) { flagClass = 'schedule-due-soon'; flagLabel = 'Due soon'; }
          } else {
            flagClass = 'schedule-complete';
            flagLabel = 'Complete';
          }
          return `
            <div class="result-card">
              <div class="result-title">${redactEscapeHtml(entry.proposalTitle)}${entry.proposalRef ? ` <span class="match-score">${redactEscapeHtml(entry.proposalRef)}</span>` : ''}</div>
              <div class="result-meta">${redactEscapeHtml(entry.taskType)} &middot; Due ${redactEscapeHtml(entry.dueDate)}${flagLabel ? ` &middot; <mark class="redact-mark ${flagClass}">${flagLabel}</mark>` : ''}</div>
              <div class="result-meta">Status: ${redactEscapeHtml(entry.status)}</div>
              ${entry.notes ? `<div class="result-meta" style="margin-top:6px;">${redactEscapeHtml(entry.notes)}</div>` : ''}
            </div>
          `;
        })
        .join('');
      return `
        <div style="margin-bottom:20px;">
          <h3 style="margin:0 0 8px;">${redactEscapeHtml(person.name)} <span style="font-weight:400;color:var(--text-muted);">(${redactEscapeHtml(person.role)})</span></h3>
          ${rows}
        </div>
      `;
    })
    .join('') || '<p class="login-desc" style="margin:0;">No schedule items yet - add one below to get started.</p>';
  renderScheduleCalendar();
}
function renderMyScheduleEntries() {
  const box = document.getElementById('schedule-my-entries');
  if (!scheduleAccount) { box.innerHTML = ''; return; }
  const mine = scheduleData.entries.filter(
    (e) => e.ownerEmail.toLowerCase() === scheduleAccount.email.toLowerCase()
  );
  if (!mine.length) {
    box.innerHTML = '<p class="login-desc" style="margin:0;">You have no schedule items yet.</p>';
    return;
  }
  box.innerHTML = mine
    .map(
      (entry) => `
        <div class="result-card">
          <div class="result-title">${redactEscapeHtml(entry.proposalTitle)}</div>
          <div class="result-meta">${redactEscapeHtml(entry.taskType)} &middot; Due ${redactEscapeHtml(entry.dueDate)} &middot; ${redactEscapeHtml(entry.status)}</div>
          <div style="margin-top:8px; display:flex; gap:8px;">
            ${entry.taskType === 'Drafting' && entry.status !== 'Complete' ? `<button type="button" class="quiz-option-btn schedule-sent-btn" data-id="${redactEscapeHtml(entry.id)}">Mark as sent</button>` : ''}
            <button type="button" class="quiz-option-btn schedule-edit-btn" data-id="${redactEscapeHtml(entry.id)}">Edit</button>
            <button type="button" class="quiz-option-btn schedule-delete-btn" data-id="${redactEscapeHtml(entry.id)}">Delete</button>
          </div>
        </div>
      `
    )
    .join('');
  box.querySelectorAll('.schedule-sent-btn').forEach((btn) => {
    btn.addEventListener('click', () => markScheduleEntrySent(btn.dataset.id));
  });
  box.querySelectorAll('.schedule-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => startEditScheduleEntry(btn.dataset.id));
  });
  box.querySelectorAll('.schedule-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteScheduleEntry(btn.dataset.id));
  });
}
function setScheduleSyncNote(message) {
  const note = document.getElementById('schedule-sync-note');
  if (!message) { note.hidden = true; note.textContent = ''; return; }
  note.hidden = false;
  note.textContent = message;
}
function stopScheduleListeners() {
  if (scheduleEntriesUnsub) { scheduleEntriesUnsub(); scheduleEntriesUnsub = null; }
  if (schedulePeopleUnsub) { schedulePeopleUnsub(); schedulePeopleUnsub = null; }
}
function startScheduleListeners() {
  stopScheduleListeners();
  setScheduleSyncNote('Loading...');
  let entriesLoaded = false;
  let peopleLoaded = false;
  const clearLoadingNote = () => { if (entriesLoaded && peopleLoaded) setScheduleSyncNote(''); };
  scheduleEntriesUnsub = scheduleDb.collection('scheduleEntries').onSnapshot((snap) => {
    scheduleData.entries = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    entriesLoaded = true;
    clearLoadingNote();
    renderScheduleBoard();
    renderMyScheduleEntries();
    pruneCompletedScheduleEntries();
  }, (err) => {
    setScheduleSyncNote('Could not load the shared schedule right now: ' + err.message);
  });
  schedulePeopleUnsub = scheduleDb.collection('schedulePeople').onSnapshot((snap) => {
    scheduleData.people = snap.docs.map((doc) => doc.data());
    peopleLoaded = true;
    clearLoadingNote();
    renderScheduleBoard();
  }, (err) => {
    setScheduleSyncNote('Could not load the team list right now: ' + err.message);
  });
}
async function openScheduleTool() {
  const siteEmail = getSiteLoginEmail().toLowerCase();
  scheduleAccount = null;
  document.getElementById('schedule-main').hidden = true;
  if (!siteEmail) {
    renderScheduleAccountBox();
    return;
  }
  document.getElementById('schedule-account-box').innerHTML = '<p class="login-desc" style="margin:0;">Checking your account...</p>';
  try {
    const doc = await scheduleDb.collection('schedulePeople').doc(schedulePersonDocId(siteEmail)).get();
    if (doc.exists) {
      const data = doc.data();
      scheduleAccount = { name: data.name, role: data.role, email: siteEmail };
      saveScheduleAccount(scheduleAccount);
    }
  } catch (err) {
    scheduleAccount = loadScheduleAccount();
  }
  renderScheduleAccountBox();
  scheduleCalRange = 'month';
  scheduleCalAnchor = new Date();
  const rangeSelect = document.getElementById('schedule-cal-range-select');
  if (rangeSelect) rangeSelect.value = 'month';
  setScheduleViewMode('list');
  if (scheduleAccount) startScheduleListeners();
}
function resetScheduleForm() {
  scheduleEditingId = null;
  document.getElementById('schedule-entry-form').reset();
  document.getElementById('schedule-submit-btn').textContent = 'Add to my schedule';
  document.getElementById('schedule-cancel-edit-btn').hidden = true;
}
function startEditScheduleEntry(id) {
  const entry = scheduleData.entries.find((e) => e.id === id);
  if (!entry) return;
  scheduleEditingId = id;
  document.getElementById('schedule-proposalTitle').value = entry.proposalTitle;
  document.getElementById('schedule-proposalRef').value = entry.proposalRef || '';
  document.getElementById('schedule-taskType').value = entry.taskType;
  document.getElementById('schedule-dueDate').value = entry.dueDate;
  document.getElementById('schedule-status').value = entry.status;
  document.getElementById('schedule-notes').value = entry.notes || '';
  document.getElementById('schedule-submit-btn').textContent = 'Save changes';
  document.getElementById('schedule-cancel-edit-btn').hidden = false;
  if (document.getElementById('schedule-entry-form').scrollIntoView) document.getElementById('schedule-entry-form').scrollIntoView({ behavior: 'smooth' });
}
async function deleteScheduleEntry(id) {
  const entry = scheduleData.entries.find((e) => e.id === id);
  if (!entry || !scheduleAccount) return;
  if (!window.confirm('Delete "' + entry.proposalTitle + '" from your schedule?')) return;
  try {
    await deleteScheduleEntryRemote(id);
  } catch (err) {
    setScheduleSyncNote('Could not delete that item: ' + err.message);
  }
}
document.getElementById('schedule-cancel-edit-btn').addEventListener('click', resetScheduleForm);
document.getElementById('schedule-refresh-btn').addEventListener('click', startScheduleListeners);
document.getElementById('schedule-entry-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!scheduleAccount) return;
  const form = new FormData(e.target);
  const entry = {
    ownerEmail: scheduleAccount.email,
    ownerName: scheduleAccount.name,
    ownerRole: scheduleAccount.role,
    proposalTitle: (form.get('proposalTitle') || '').trim(),
    proposalRef: (form.get('proposalRef') || '').trim(),
    taskType: form.get('taskType'),
    dueDate: form.get('dueDate'),
    status: form.get('status'),
    notes: (form.get('notes') || '').trim(),
  };
  if (!entry.proposalTitle || !SCHEDULE_TASK_TYPES.includes(entry.taskType) || !entry.dueDate || !SCHEDULE_STATUSES.includes(entry.status)) {
    return;
  }
  try {
    await saveScheduleEntry(entry, scheduleEditingId);
    await savePersonRecord({ email: scheduleAccount.email, name: scheduleAccount.name, role: scheduleAccount.role });
    resetScheduleForm();
  } catch (err) {
    setScheduleSyncNote('Could not save that item: ' + err.message);
  }
});
// --- Schedule integration: hand-off from drafting pages, mark-as-sent follow-ups, weekly digest, home nudge ---
function scheduleAddDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Opens the "Edit my schedule" form with a few fields filled in. Called from
// the RFQ and draft pages (the RFQ page is inside an iframe and reaches this
// through window.parent). If the person has no schedule account yet, the
// schedule page opens on the account form instead.
async function openScheduleWithPrefill(prefill) {
  prefill = prefill || {};
  await openScheduleTool();
  if (!scheduleAccount) { showView('schedule'); return; }
  showView('scheduleEdit');
  resetScheduleForm();
  document.getElementById('schedule-taskType').value = prefill.taskType || 'Drafting';
  document.getElementById('schedule-status').value = prefill.status || 'Not started';
  if (prefill.title) document.getElementById('schedule-proposalTitle').value = prefill.title;
  if (prefill.ref) document.getElementById('schedule-proposalRef').value = prefill.ref;
  if (prefill.dueDate) document.getElementById('schedule-dueDate').value = prefill.dueDate;
  if (prefill.notes) document.getElementById('schedule-notes').value = prefill.notes;
  const t = document.getElementById('schedule-proposalTitle');
  if (t && t.focus) t.focus();
}
window.openScheduleWithPrefill = openScheduleWithPrefill;
// Marks a Drafting item as sent: completes it and creates a Client Follow-up
// item due a week later, so a sent proposal is not forgotten.
async function markScheduleEntrySent(id) {
  const entry = scheduleData.entries.find((e) => e.id === id);
  if (!entry || !scheduleAccount) return;
  const followDue = scheduleAddDays(scheduleTodayStr(), 7);
  const dup = scheduleData.entries.some((e) =>
    e.taskType === 'Client Follow-up' && e.status !== 'Complete' &&
    e.ownerEmail.toLowerCase() === scheduleAccount.email.toLowerCase() &&
    e.proposalTitle === entry.proposalTitle);
  if (!window.confirm('Mark "' + entry.proposalTitle + '" as sent?' + (dup ? '' : ' This adds a client follow-up to your schedule for ' + followDue + '.'))) return;
  try {
    const { id: _omit, ...rest } = entry;
    await saveScheduleEntry({ ...rest, status: 'Complete' }, id);
    if (!dup) {
      await saveScheduleEntry({
        ownerEmail: scheduleAccount.email,
        ownerName: scheduleAccount.name,
        ownerRole: scheduleAccount.role,
        proposalTitle: entry.proposalTitle,
        proposalRef: entry.proposalRef || '',
        taskType: 'Client Follow-up',
        dueDate: followDue,
        status: 'Not started',
        notes: 'Follow up with the client after sending. When you hear back, use Record a proposal outcome on the home page.',
      });
    }
  } catch (err) {
    setScheduleSyncNote('Could not mark that item as sent: ' + err.message);
  }
}
const SCHEDULE_STALE_DAYS = 7;
// Sorts entries into the weekly-digest groups. Each open item lands in one group.
function scheduleDigestGroups(entries, today) {
  const g = { overdue: [], week: [], followups: [], stale: [] };
  entries.forEach((e) => {
    if (e.status === 'Complete') return;
    const days = scheduleDaysUntil(e.dueDate);
    if (e.taskType === 'Client Follow-up') { g.followups.push(e); return; }
    if (days < 0) { g.overdue.push(e); return; }
    if (days <= 7) { g.week.push(e); return; }
    const upd = e.updatedAt ? Math.floor((new Date(today + 'T00:00:00Z') - new Date(e.updatedAt)) / 86400000) : 0;
    if (upd >= SCHEDULE_STALE_DAYS) g.stale.push(e);
  });
  const byDue = (a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0);
  Object.values(g).forEach((list) => list.sort(byDue));
  return g;
}
function renderScheduleDigest() {
  const box = document.getElementById('schedule-digest');
  if (!box) return;
  if (!scheduleAccount) { box.innerHTML = ''; return; }
  const g = scheduleDigestGroups(scheduleData.entries, scheduleTodayStr());
  const mine = (e) => e.ownerEmail.toLowerCase() === scheduleAccount.email.toLowerCase();
  const line = (e) => {
    const d = scheduleDaysUntil(e.dueDate);
    const when = d < 0 ? Math.abs(d) + ' day' + (Math.abs(d) === 1 ? '' : 's') + ' overdue' : d === 0 ? 'due today' : 'due ' + e.dueDate;
    return '<li' + (mine(e) ? ' style="font-weight:600;"' : '') + '>' + redactEscapeHtml(e.proposalTitle) +
      ' <span style="color:var(--text-muted);font-weight:400;">&middot; ' + redactEscapeHtml(e.taskType) + ' &middot; ' +
      redactEscapeHtml(e.ownerName || '') + ' &middot; ' + when + '</span></li>';
  };
  const sec = (title, list, note) => list.length
    ? '<div style="margin-bottom:12px;"><h3 style="margin:0 0 4px;">' + title + ' (' + list.length + ')</h3>' +
      (note ? '<div class="login-desc" style="margin:0 0 4px;">' + note + '</div>' : '') +
      '<ul style="margin:0;padding-left:20px;">' + list.map(line).join('') + '</ul></div>'
    : '';
  const html =
    sec('Overdue', g.overdue, 'Past the due date and not complete.') +
    sec('Due in the next 7 days', g.week) +
    sec('Client follow-ups owed', g.followups, 'Proposals sent and waiting on the client. Record the outcome when you hear back.') +
    sec('No update in ' + SCHEDULE_STALE_DAYS + '+ days', g.stale, 'Due later, but nobody has touched these recently. Is the date still right?');
  box.innerHTML = '<div class="result-card" style="margin-top:16px;"><div class="result-title">This week at a glance</div>' +
    '<div class="login-desc" style="margin:4px 0 10px;">Your own items are in bold.</div>' +
    (html || '<div class="login-desc" style="margin:0;">Nothing is overdue, due this week, or waiting on a follow-up.</div>') + '</div>';
}
// Home-page nudge: a one-line count of YOUR overdue / due-soon items.
let homeNudgeAt = 0;
function refreshHomeScheduleNudge() {
  const el = document.getElementById('home-schedule-nudge');
  if (!el) return;
  const email = (typeof getSiteLoginEmail === 'function' ? getSiteLoginEmail() : '').toLowerCase();
  if (!email || Date.now() - homeNudgeAt < 30000) return;
  homeNudgeAt = Date.now();
  let done = false;
  let unsub = null;
  const finish = (snap) => {
    if (done) return;
    done = true;
    if (unsub) unsub();
    const mine = snap.docs.map((d) => d.data()).filter((e) => (e.ownerEmail || '').toLowerCase() === email && e.status !== 'Complete');
    const over = mine.filter((e) => scheduleDaysUntil(e.dueDate) < 0).length;
    const soon = mine.filter((e) => { const d = scheduleDaysUntil(e.dueDate); return d >= 0 && d <= 7; }).length;
    const parts = [];
    if (over) parts.push(over + ' overdue');
    if (soon) parts.push(soon + ' due in the next 7 days');
    if (!parts.length) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = 'Your schedule: ' + parts.join(', ') + '. <a href="#" id="home-schedule-link">Open the schedule</a>';
    document.getElementById('home-schedule-link').addEventListener('click', (ev) => { ev.preventDefault(); openScheduleTool(); showView('schedule'); });
  };
  try {
    unsub = scheduleDb.collection('scheduleEntries').onSnapshot(finish, () => {});
    if (done && unsub) unsub();
  } catch (err) { /* the nudge is optional */ }
}

// --- Proposal status & team schedule: calendar view ---
let scheduleViewMode = 'list';
let scheduleCalRange = 'month'; // 'week' | 'month' | 'year'
let scheduleCalAnchor = new Date(); // any date within the period currently shown
const SCHEDULE_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SCHEDULE_MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SCHEDULE_DAY_LABELS_SHORT = ['S','M','T','W','T','F','S'];
function setScheduleViewMode(mode) {
  scheduleViewMode = mode;
  document.getElementById('schedule-board').hidden = mode !== 'list';
  document.getElementById('schedule-calendar').hidden = mode !== 'calendar';
  document.getElementById('schedule-view-list-btn').classList.toggle('active', mode === 'list');
  document.getElementById('schedule-view-calendar-btn').classList.toggle('active', mode === 'calendar');
  if (mode === 'calendar') renderScheduleCalendar();
}
function scheduleDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function scheduleStartOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function scheduleWrappableTitle(text) {
  // Escape first, then add a soft-wrap point after each underscore/hyphen so
  // long titles wrap at those boundaries instead of splitting a word mid-letter.
  return redactEscapeHtml(text).replace(/([_-])/g, '$1<wbr>');
}
function scheduleExtractDisplayTitle(proposalTitle) {
  // If the title follows the firm's [YYYYMMMDD]_[Client]_[Description] convention,
  // show the client segment instead of the date. Otherwise, show the title as-is.
  const parts = proposalTitle.split('_').map(p => p.trim()).filter(Boolean);
  const looksLikeDatePrefix = /^\d{4}[A-Za-z]{3}\d{1,2}$/.test(parts[0] || '');
  if (looksLikeDatePrefix && parts.length >= 2) {
    return parts[1];
  }
  return proposalTitle;
}
function renderScheduleCalDayCell(cellDate, entriesByDate, todayStr, isOutside) {
  const dayNum = Number(cellDate.slice(-2));
  const dayEntries = (entriesByDate[cellDate] || []).slice().sort((a, b) => (a.ownerName || '').localeCompare(b.ownerName || ''));
  const SCHEDULE_CHIP_TITLE_MAX = 22;
  const chips = dayEntries.map((entry) => {
    let colorClass = '';
    if (entry.status !== 'Complete') {
      const daysUntil = scheduleDaysUntil(entry.dueDate);
      if (daysUntil < 0) colorClass = 'redact-mark schedule-overdue';
      else if (daysUntil <= 3) colorClass = 'redact-mark schedule-due-soon';
    } else {
      colorClass = 'redact-mark schedule-complete';
    }
    const firstName = (entry.ownerName || '').split(' ')[0];
    const displayTitle = scheduleExtractDisplayTitle(entry.proposalTitle);
    const truncatedTitle = displayTitle.length > SCHEDULE_CHIP_TITLE_MAX
      ? displayTitle.slice(0, SCHEDULE_CHIP_TITLE_MAX) + '...'
      : displayTitle;
    const chipLabelHtml = `${redactEscapeHtml(firstName)}: ${scheduleWrappableTitle(truncatedTitle)}`;
    const tooltip = `${entry.ownerName} - ${entry.proposalTitle} (${entry.taskType}, ${entry.status})`;
    return `<span class="schedule-cal-chip ${colorClass}" title="${redactEscapeHtml(tooltip)}" data-entry-id="${entry.id}">${chipLabelHtml}</span>`;
  }).join('');
  const todayClass = cellDate === todayStr ? ' schedule-cal-today' : '';
  return `
    <div class="schedule-cal-day${isOutside ? ' schedule-cal-outside' : ''}${todayClass}">
      <div class="schedule-cal-daynum">${dayNum}</div>
      ${chips}
    </div>
  `;
}
function renderScheduleCalendar() {
  const grid = document.getElementById('schedule-cal-grid');
  const label = document.getElementById('schedule-cal-month-label');
  if (!grid || !label) return;
  const entriesByDate = {};
  scheduleData.entries.forEach((entry) => {
    (entriesByDate[entry.dueDate] = entriesByDate[entry.dueDate] || []).push(entry);
  });
  if (scheduleCalRange === 'week') {
    renderScheduleCalendarWeek(grid, label, entriesByDate);
  } else if (scheduleCalRange === 'year') {
    renderScheduleCalendarYear(grid, label, entriesByDate);
  } else {
    renderScheduleCalendarMonth(grid, label, entriesByDate);
  }
}
function renderScheduleCalendarMonth(grid, label, entriesByDate) {
  grid.className = 'schedule-cal-grid';
  const year = scheduleCalAnchor.getFullYear();
  const month = scheduleCalAnchor.getMonth();
  label.textContent = `${SCHEDULE_MONTH_NAMES[month]} ${year}`;
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const todayStr = scheduleTodayStr();
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let html = dayLabels.map((d) => `<div class="schedule-cal-daylabel">${d}</div>`).join('');
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells; i++) {
    let cellDate;
    let isOutside = false;
    if (i < startOffset) {
      const d = daysInPrevMonth - startOffset + i + 1;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      cellDate = scheduleDateStr(prevYear, prevMonth, d);
      isOutside = true;
    } else if (i >= startOffset + daysInMonth) {
      const d = i - (startOffset + daysInMonth) + 1;
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      cellDate = scheduleDateStr(nextYear, nextMonth, d);
      isOutside = true;
    } else {
      const d = i - startOffset + 1;
      cellDate = scheduleDateStr(year, month, d);
    }
    html += renderScheduleCalDayCell(cellDate, entriesByDate, todayStr, isOutside);
  }
  grid.innerHTML = html;
}
function renderScheduleCalendarWeek(grid, label, entriesByDate) {
  grid.className = 'schedule-cal-grid schedule-cal-grid--week';
  const weekStart = scheduleStartOfWeek(scheduleCalAnchor);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const startLabel = `${SCHEDULE_MONTH_NAMES_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}`;
  const endLabel = weekEnd.getMonth() === weekStart.getMonth()
    ? `${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
    : `${SCHEDULE_MONTH_NAMES_SHORT[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  label.textContent = `${startLabel} - ${endLabel}`;
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayStr = scheduleTodayStr();
  let html = dayLabels.map((d) => `<div class="schedule-cal-daylabel">${d}</div>`).join('');
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const cellDate = scheduleDateStr(d.getFullYear(), d.getMonth(), d.getDate());
    html += renderScheduleCalDayCell(cellDate, entriesByDate, todayStr, false);
  }
  grid.innerHTML = html;
}
function renderScheduleMiniMonth(year, month, entriesByDate, todayStr) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  let cells = SCHEDULE_DAY_LABELS_SHORT.map((d) => `<div class="schedule-mini-daylabel">${d}</div>`).join('');
  for (let i = 0; i < totalCells; i++) {
    if (i < startOffset || i >= startOffset + daysInMonth) {
      cells += `<div class="schedule-mini-day schedule-mini-outside">&nbsp;</div>`;
      continue;
    }
    const day = i - startOffset + 1;
    const cellDate = scheduleDateStr(year, month, day);
    const dayEntries = entriesByDate[cellDate] || [];
    const hasOverdue = dayEntries.some((e) => e.status !== 'Complete' && scheduleDaysUntil(e.dueDate) < 0);
    const hasEntries = dayEntries.length > 0;
    const isToday = cellDate === todayStr;
    const classes = ['schedule-mini-day', 'schedule-mini-clickable'];
    if (hasEntries) classes.push('schedule-mini-has-entries');
    if (hasOverdue) classes.push('schedule-mini-has-overdue');
    if (isToday) classes.push('schedule-mini-today');
    const title = hasEntries ? `${dayEntries.length} item${dayEntries.length === 1 ? '' : 's'} due` : '';
    cells += `<div class="${classes.join(' ')}" data-year="${year}" data-month="${month}" data-day="${day}" title="${redactEscapeHtml(title)}">${day}</div>`;
  }
  return `
    <div class="schedule-mini-month">
      <div class="schedule-mini-month-label" data-year="${year}" data-month="${month}">${SCHEDULE_MONTH_NAMES_SHORT[month]}</div>
      <div class="schedule-mini-month-grid">${cells}</div>
    </div>
  `;
}
function renderScheduleCalendarYear(grid, label, entriesByDate) {
  grid.className = 'schedule-year-grid';
  const year = scheduleCalAnchor.getFullYear();
  label.textContent = `${year}`;
  const todayStr = scheduleTodayStr();
  let html = '';
  for (let month = 0; month < 12; month++) {
    html += renderScheduleMiniMonth(year, month, entriesByDate, todayStr);
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.schedule-mini-month-label, .schedule-mini-day.schedule-mini-clickable').forEach((el) => {
    el.addEventListener('click', () => {
      const y = Number(el.dataset.year);
      const m = Number(el.dataset.month);
      const day = el.dataset.day ? Number(el.dataset.day) : 1;
      scheduleCalAnchor = new Date(y, m, day);
      scheduleCalRange = 'month';
      document.getElementById('schedule-cal-range-select').value = 'month';
      renderScheduleCalendar();
    });
  });
}
function scheduleShiftCalendar(direction) {
  if (scheduleCalRange === 'week') {
    scheduleCalAnchor = new Date(scheduleCalAnchor.getFullYear(), scheduleCalAnchor.getMonth(), scheduleCalAnchor.getDate() + 7 * direction);
  } else if (scheduleCalRange === 'year') {
    scheduleCalAnchor = new Date(scheduleCalAnchor.getFullYear() + direction, scheduleCalAnchor.getMonth(), 1);
  } else {
    scheduleCalAnchor = new Date(scheduleCalAnchor.getFullYear(), scheduleCalAnchor.getMonth() + direction, 1);
  }
  renderScheduleCalendar();
}
document.getElementById('schedule-view-list-btn').addEventListener('click', () => setScheduleViewMode('list'));
document.getElementById('schedule-view-calendar-btn').addEventListener('click', () => setScheduleViewMode('calendar'));
document.getElementById('schedule-cal-range-select').addEventListener('change', (e) => {
  scheduleCalRange = e.target.value;
  renderScheduleCalendar();
});
document.getElementById('schedule-cal-prev-btn').addEventListener('click', () => scheduleShiftCalendar(-1));
document.getElementById('schedule-cal-next-btn').addEventListener('click', () => scheduleShiftCalendar(1));
document.getElementById('schedule-cal-grid').addEventListener('click', (e) => {
  const chip = e.target.closest('.schedule-cal-chip');
  if (!chip) return;
  const entry = scheduleData.entries.find((en) => en.id === chip.dataset.entryId);
  if (entry) openScheduleCalModal(entry);
});
document.getElementById('schedule-cal-modal-close').addEventListener('click', closeScheduleCalModal);
document.getElementById('schedule-cal-modal').addEventListener('click', (e) => {
  if (e.target.id === 'schedule-cal-modal') closeScheduleCalModal();
});
function openScheduleCalModal(entry) {
  const modal = document.getElementById('schedule-cal-modal');
  const body = document.getElementById('schedule-cal-modal-body');
  if (!modal || !body) return;
  const daysUntil = scheduleDaysUntil(entry.dueDate);
  let flagClass = '';
  let flagLabel = '';
  if (entry.status !== 'Complete') {
    if (daysUntil < 0) { flagClass = 'schedule-overdue'; flagLabel = 'Overdue'; }
  else if (daysUntil <= 3) { flagClass = 'schedule-due-soon'; flagLabel = 'Due soon'; }
  } else {
    flagClass = 'schedule-complete';
    flagLabel = 'Complete';
  }
  body.innerHTML = `
    <h3 style="margin:0 0 8px;">${redactEscapeHtml(entry.ownerName || '')} <span style="font-weight:400;color:var(--text-muted);">(${redactEscapeHtml(entry.ownerRole || '')})</span></h3>
    <div class="result-title">${redactEscapeHtml(entry.proposalTitle)}${entry.proposalRef ? ` <span class="match-score">${redactEscapeHtml(entry.proposalRef)}</span>` : ''}</div>
    <div class="result-meta">${redactEscapeHtml(entry.taskType)} &middot; Due ${redactEscapeHtml(entry.dueDate)}${flagLabel ? ` &middot; <mark class="redact-mark ${flagClass}">${flagLabel}</mark>` : ''}</div>
    <div class="result-meta">Status: ${redactEscapeHtml(entry.status)}</div>
    ${entry.notes ? `<div class="result-meta" style="margin-top:6px;">${redactEscapeHtml(entry.notes)}</div>` : ''}
  `;
  modal.hidden = false;
}
function closeScheduleCalModal() {
  document.getElementById('schedule-cal-modal').hidden = true;
}
// --- Master Rate Card (rebuilt from the Study Pricing Calculator (demo rates) rate table) ---
// Values below are the calculator's own default rates (its "Rate card" section). When the calculator changes, update this list.
const RATE_CARD_V335 = [["Hourly rates and working day", [["Consultant rate", "$176/hr"], ["Facilitator rate", "$120/hr"], ["Recruitment rate (assumed)", "$80/hr"], ["Project management, time-based (assumed)", "$176/hr"], ["Hours per working day", "8"], ["Session hours per study day", "6.5 hrs"]]], ["Flat fees and per-unit costs", [["Facility rental", "$1,600/study day"], ["Training room rental", "$500/study day"], ["Recruitment initiation fee (default; enter the recruiter\u2019s actual fee)", "$2,400"], ["Administrative fee", "$20/participant"], ["Sunshine Act reporting", "$60/participant"], ["Database fee", "$1,200"], ["Miscellaneous study expenses (default, adjustable)", "$1,600"], ["Consultant subsistence", "$100/person/day"], ["Consultant hotel", "$200/person/night"], ["Consultant flight", "$480/person"], ["Expedited IRB", "$2,000"], ["Full convened IRB", "$4,720"]]], ["Onboarding and study preparation", [["Onboarding staff per team", "3 people"], ["Onboarding, standard device", "0.5 day/person"], ["Onboarding, complex device", "1 day/person"], ["Onboarding rounded up to", "$800"], ["Screener, solid client draft (consultant / recruitment)", "1 hr / 1 hr"], ["Screener, poor client draft (consultant / recruitment)", "2 hrs / 2 hrs"], ["Agreements: first group / each extra group", "2 hrs / 1 hr"], ["Protocol, create (early or later formative)", "$4,800 + $800 per extra distinct group"], ["Protocol, create (validation)", "$6,400 + $800 per extra distinct group"], ["Protocol, review (early or later formative)", "$1,600 + $800 per extra distinct group"], ["Protocol, review (validation)", "$2,400 + $800 per extra distinct group"], ["Data sheets, create / review", "$1,200 / $600 per session-hour per group"], ["Moderator script", "$1,600 per group + $400 per extra hour"], ["Article log / demographics questionnaire", "1 hr / 2 hrs per group"], ["Review time as a share of creation time (assumed)", "50%"], ["Cognitive bias training (assumed)", "2 hrs"], ["High-fidelity model (validation)", "3 days"], ["Study preparation adjustment", "90% of the build-up"]]], ["Study conduct, analysis and quality", [["Conduct uplift", "\u00d71.2, rounded up to $200"], ["Analysis time", "2 hrs per video hour"], ["Quality systems (validation)", "2 days"], ["Over-recruitment buffer", "20% (priced n = ceil(net \u00d7 1.2))"]]], ["Report", [["Fixed cost", "$8,000"], ["Per priced participant", "$320"], ["Per participant-hour over 1 hour", "$108"], ["Critical tasks write-up, Standard / Many", "$800 / $2,400"], ["Root cause analysis per participant, Standard / Many", "$52 / $160"], ["First-time client template (assumed)", "$1,600"]]], ["Markup and project management", [["Markup on hour- and day-rate tasks", "10%, rounded to the nearest $200"], ["Project management, percentage method", "15% of consulting (adjustable), rounded to $400"], ["Project management minimum", "$4,000"]]]];
function renderRateCard() {
  const box = document.getElementById('rate-card-content');
  if (!box) return;
  const tables = RATE_CARD_V335.map(g => `<div class="rate-table-wrap"><table class="rate-table"><caption>${g[0]}</caption><thead><tr><th>Item</th><th>Rate (USD)</th></tr></thead><tbody>${g[1].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</tbody></table></div>`).join('');
  const roleRows = (typeof RATE_CARD_ROWS !== 'undefined' ? RATE_CARD_ROWS.slice(1) : []).map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('');
  box.innerHTML = `
    <div class="rate-card-note">These are the default rates in the Study Pricing Calculator (demo rates), which the Comm Ops intake and the Word SOW builder also use. The calculator prices in USD only. GBP and EUR are not modelled in this demo. Rates edited inside the calculator apply only in that browser.</div>
    ${tables}
    <div class="rate-table-wrap"><table class="rate-table"><caption>Role rate card (reference only; the calculator does not price these roles)</caption><thead><tr><th>Role</th><th>USD</th><th>GBP</th><th>EUR</th></tr></thead><tbody>${roleRows}</tbody></table></div>`;
}
renderRateCard();

// Keep the sticky Back button directly under the sticky header
function setHeaderHeight() {
  const hd = document.querySelector('.app-header');
  if (hd) document.documentElement.style.setProperty('--header-h', hd.offsetHeight + 'px');
}
setHeaderHeight();
window.addEventListener('resize', setHeaderHeight);
window.addEventListener('load', setHeaderHeight);
