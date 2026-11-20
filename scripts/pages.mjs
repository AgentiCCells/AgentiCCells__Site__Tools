// Renders the hub's pages into _site/ from data/, team/ and git history. Node built-ins only.
// Written by conductor.tools@AgentiCCells.dinis (doing the developer's work), 2026-11-20. Apache-2.0; page text CC BY 4.0.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';

const cfg = JSON.parse(readFileSync('site.config.json', 'utf8'));
const inv = JSON.parse(readFileSync('data/inventory.json', 'utf8'));
const origin = `https://${cfg.domain}`;
const hub = JSON.parse(readFileSync('hub.json', 'utf8'));
const repo = hub.repository;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Upstream text may hold em dashes; the family's style has none, so they are shown as a colon.
const tidy = (s) => String(s ?? '').replace(/\s*\u2014\s*/g, ', ');
const PROMISE = 'No tracking, no analytics, no third-party scripts, no cookies, no ads. This site makes no requests to other hosts.';
const nav = [['/', 'Tools'], ['/how-to-check/', 'How to check'], ['/about/', 'About'], ['/behind-the-scenes/', 'Behind the scenes']];

function page(path, title, description, body) {
  const url = origin + path;
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="stylesheet" href="/assets/site.css">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${origin}/assets/share-card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Tools: free tools that run in your browser. No tracking, no analytics, no cookies, no ads.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${origin}/assets/share-card.png">
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="/">Tools</a><nav>${nav.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav></div></header>
<main><div class="wrap">
${body}
</div></main>
<footer class="bottom"><div class="wrap">
<p>${PROMISE} <a href="/how-to-check/">How to check</a>.</p>
<p>Version __VERSION__ · <a href="${repo}">Source</a> · Code Apache-2.0, text CC BY 4.0 · Tools from <a href="${inv.source}">SGraph-AI__Tools</a> (Apache-2.0).</p>
</div></footer>
</body>
</html>
`;
  const out = join('_site', path, 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

// A small Markdown subset for the team's own files: headings, lists, paragraphs, code, links, bold.
function md(src) {
  // Code spans are cut out first, so bold and link rules never apply inside them.
  const inline = (s) => esc(s).split(/(`[^`]+`)/).map((part) => part.length > 1 && part.startsWith('`') && part.endsWith('`')
    ? `<code>${part.slice(1, -1)}</code>`
    : part.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')).join('');
  const out = []; let list = null, para = [], items = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
    if (list) out.push(`<${list}>${items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list}>`);
    list = null; items = [];
  };
  let inCode = false;
  for (const line of src.split('\n')) {
    const h = line.match(/^(#{1,4})\s+(.*)/), li = line.match(/^\s*[-*]\s+(.*)/), ol = line.match(/^\s*\d+\.\s+(.*)/);
    if (/^```/.test(line)) { flush(); inCode = !inCode; out.push(inCode ? '<pre><code>' : '</code></pre>'); continue; }
    if (inCode) { out.push(esc(line)); continue; }
    if (h) { flush(); const n = Math.min(h[1].length + 2, 6); out.push(`<h${n}>${inline(h[2])}</h${n}>`); }
    else if (li || ol) { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } const t = li ? 'ul' : 'ol'; if (list && list !== t) flush(); list = t; items.push((li || ol)[1]); }
    else if (!line.trim()) flush();
    else if (list && /^\s+/.test(line)) items[items.length - 1] += ' ' + line.trim();
    else { if (list) flush(); para.push(line.trim()); }
  }
  flush();
  return out.join('\n');
}

const badge = (s) => `<span class="badge${s === 'live' ? ' live' : ''}">upstream: ${esc(s)}</span>`;
const sites = new Map(cfg.tool_sites.map((s) => [s.slug, s]));
const bySlug = new Map(inv.tools.map((t) => [t.slug, t]));
const cats = [...new Set(inv.tools.map((t) => t.category))].sort();
const short = inv.commit.slice(0, 7);

// Home: the five tool sites, then the whole inventory.
page('/', 'Tools: free tools that run in your browser', 'An inventory of ' + inv.count + ' browser tools from SGraph-AI__Tools, each getting its own documented site. No tracking, no cookies, no ads.', `
<h1>Tools that run in your browser</h1>
<p class="lead">Free tools that each do one thing in your browser. Each one is getting its own site, with documentation on what it does, how it works, its limits and how to check what leaves your device.</p>
<p class="promise">${PROMISE}</p>
<h2>The first five</h2>
<p>${esc(cfg.tool_site_state)} Source: <a href="https://github.com/AgentiCCells/AgentiCCells__Site__Factory/tree/dev/requests">the Site Factory requests</a>.</p>
<div class="grid">${cfg.tool_sites.map((s) => { const t = bySlug.get(s.slug); return `<div class="card"><h3>${esc(t.name)}</h3><p>${badge(t.status)}<span class="badge">tool not added yet</span></p><p>${esc(tidy(t.description))}</p><p class="muted"><a href="${s.url}">${esc(s.url.replace('https://', ''))}</a> · <a href="${t.manifest}">manifest</a></p></div>`; }).join('')}</div>
<h2>All ${inv.count} tools</h2>
<p class="muted">Generated from each tool's manifest.json in <a href="${inv.source}">SGraph-AI__Tools</a> at commit <a href="${inv.source}/tree/${inv.commit}">${short}</a>. Status and description are the manifest's own, as the upstream project gives them; em dashes are shown as commas. Some of these tools call outside services named in their descriptions (for example OpenRouter or SG/Send): each tool's own site will say so before anything leaves your device. A tool with no site yet links to its manifest. ${inv.skipped.filter((s) => s.reason.includes('"id"')).length} more tool folders use "id" instead of "slug" in their manifests and are not counted (${inv.skipped.filter((s) => s.reason.includes('"id"')).map((s) => esc(s.manifest.split('/').slice(-2, -1)[0])).join(', ')}).</p>
${cats.map((c) => { const ts = inv.tools.filter((t) => t.category === c); return `<h3>${esc(c)} (${ts.length})</h3><div class="scroll"><table><thead><tr><th>Tool</th><th>Status</th><th>What it does</th><th>Site</th></tr></thead><tbody>${ts.map((t) => `<tr><td>${esc(t.name)}</td><td>${badge(t.status)}</td><td>${esc(tidy(t.description))}</td><td>${sites.has(t.slug) ? `<a href="${sites.get(t.slug).url}">site (no tool yet)</a>` : `<a href="${t.manifest}">manifest</a>`}</td></tr>`).join('')}</tbody></table></div>`; }).join('\n')}
`);

// How to check.
const req = existsSync('data/requests.json') ? JSON.parse(readFileSync('data/requests.json', 'utf8')) : null;
page('/how-to-check/', 'How to check: Tools', 'How to check for yourself that this site makes no requests to other hosts, sets no cookies and loads no third-party scripts.', `
<h1>How to check</h1>
<p class="lead">You do not need to trust us. Your browser can show you every request this site makes.</p>
<h2>In your browser</h2>
<ol>
<li>Open the browser's developer tools (F12, or Cmd+Option+I on a Mac) and choose the Network tab.</li>
<li>Tick "Disable cache" and reload the page.</li>
<li>Look at the Domain column (or hover each row). Every request should go to ${esc(cfg.domain)}. Nothing else.</li>
<li>In the Application or Storage tab, look under Cookies: there should be none for this site.</li>
</ol>
<h2>What we recorded</h2>
${req ? `<p>The privacy reviewer loaded each page in a headless Chromium on ${esc(req.date)} and recorded every request (${esc(req.how)}). Allowed: requests to the site's own origin only.</p>
${req.pages.map((p) => `<h3>${esc(p.page)}: ${p.ok ? 'pass' : 'FAIL'}</h3><div class="scroll"><table><thead><tr><th>Method</th><th>URL</th><th>Type</th></tr></thead><tbody>${p.requests.map((r) => `<tr><td>${esc(r.method)}</td><td><code>${esc(r.url)}</code></td><td>${esc(r.type)}</td></tr>`).join('')}</tbody></table></div><p class="muted">Cookies set: ${p.cookies}</p>`).join('\n')}` : '<p>Not yet recorded.</p>'}
`);

// About.
page('/about/', 'About: Tools', 'Who makes these tools sites, where the tools come from and the rules every page follows.', `
<h1>About</h1>
<p>The tools come from <a href="${inv.source}">SGraph-AI__Tools</a>, an Apache-2.0 project (live at <a href="https://dev.tools.sgraph.ai/">dev.tools.sgraph.ai</a>). Dinis Cruz asked for each tool to be published as its own site, with documentation, to help people find and use them (brief, 19 Nov 2026 ~17:00 UTC).</p>
<p>These sites are built by a team of AI agents in the AgentiCCells account, instructed by Dinis Cruz. See <a href="/behind-the-scenes/">behind the scenes</a> for the team, its rules and every commit.</p>
<h2>The rules every page follows</h2>
<ul>
<li>${PROMISE}</li>
<li>Nothing you enter or drop into a tool leaves your device, unless the page says plainly where it goes and why, before it goes.</li>
<li>Every fact on a page has a source. Proposals are marked as proposals.</li>
<li>Each site is self-contained: it loads nothing from another site, and you can fork it and run your own copy.</li>
</ul>
<h2>Licences</h2>
<p>Code: Apache-2.0. Text and images: CC BY 4.0. The tools keep their upstream Apache-2.0 licence.</p>
`);

// Behind the scenes: team, policies, flow, timeline, round reports.
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const roles = readdirSync('team', { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join('team', d.name, 'ROLE.md'))).map((d) => d.name);
let timeline = [];
try {
  timeline = execFileSync('git', ['log', '--format=%H%x09%cI%x09%s%x09%(trailers:key=Agent,valueonly,separator=%x2C)'], { encoding: 'utf8' }).trim().split('\n').map((l) => l.split('\t'));
} catch { timeline = []; }
const rounds = existsSync('team/rounds') ? readdirSync('team/rounds').filter((f) => /^\d+\.md$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b)) : [];
page('/behind-the-scenes/', 'Behind the scenes: Tools', 'The team of agents that builds the tools sites, their roles and policies, how work flows, every commit, and the round reports.', `
<h1>Behind the scenes</h1>
<p class="lead">This family of sites is built by AI agents in the AgentiCCells account, instructed by Dinis Cruz. The work is split into seven roles. So far one agent (conductor.tools@) has done most roles' work itself and run the reviewer as a separate sub-agent; the round reports say who did what.</p>
<p>Every commit from <code>1d5c6bc</code> on is signed with a key published in <a href="${repo}/blob/dev/team/keys.json">team/keys.json</a> and checked by <code>scripts/check-signatures.mjs</code>. The commit before it (<code>72ed45e</code>) published the first key; the seed commit (<code>424060b</code>) was made by the Site Factory and is not signed.</p>
<h2>The team</h2>
${roles.map((r) => `<div class="card">${md(read(join('team', r, 'ROLE.md')))}${md(read(join('team', r, 'POLICY.md')))}</div>`).join('\n')}
<h2>How work flows</h2>
${md(read('team/WORKFLOW.md').replace(/^# .*\n/, ''))}
<h2>Commit timeline</h2>
<p class="muted">From git log of this repository at build time. The five tool site repositories are not shown yet: this session could not attach them (refused 19 Nov 2026).</p>
<div class="scroll"><table><thead><tr><th>When (UTC)</th><th>Commit</th><th>What</th><th>Agent</th></tr></thead><tbody>${timeline.map(([h, d, s, a]) => `<tr><td>${esc((d || '').replace('T', ' ').slice(0, 16))}</td><td><a href="${repo}/commit/${esc(h)}"><code>${esc((h || '').slice(0, 7))}</code></a></td><td>${esc(s)}</td><td>${esc(a || 'none')}</td></tr>`).join('')}</tbody></table></div>
<h2>Round reports</h2>
${rounds.length ? rounds.map((f) => `<div class="card">${md(read(join('team/rounds', f)))}</div>`).join('\n') : '<p>None yet.</p>'}
`);
console.log(`rendered 4 pages for ${origin}`);
