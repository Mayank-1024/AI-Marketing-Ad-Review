// n8n house-style sticky layout, modelled on n8n's own sticky-note generator
// (see reference/STICKY-NOTE-GUIDE.md):
//  - one 480 px default-yellow overview on the left, 80 px from the workflow
//  - one neutral (7) sticky per group, drawn tightly around its nodes:
//    48 px side padding, 64 px bottom padding, and top padding sized to the title
//    and description (at least 80 px)
//  - everything snapped to the 16 px grid
// Extra notes (e.g. a sample request) stack under the overview, in the same column.
const GRID = 16;
const NODE = 96;
const PAD_X = 48;
const PAD_BOTTOM = 64;
const MIN_TOP = 80;
const OVERVIEW_W = 480;
const OVERVIEW_GAP = 80;
const STACK_GAP = 32;
const snap = (v) => Math.round(v / GRID) * GRID;
const snapUp = (v) => Math.ceil(v / GRID) * GRID;

// Same estimate n8n's generator uses: ~9 px per character, 36 px per H2 line,
// 22 px per body line, plus margins.
const textHeight = (title, body, width) => {
  const perLine = Math.max(1, Math.floor(width / 9));
  let h = 24 + Math.ceil(`## ${title}`.length / perLine) * 36;
  if (body) h += 12 + Math.ceil(body.length / perLine) * 22;
  return Math.max(MIN_TOP, h + 20);
};

// Rough height for a Markdown overview at 480 px, so it never clips.
const overviewHeight = (content) => {
  const perLine = Math.floor(OVERVIEW_W / 8);
  let h = 60;
  let inCode = false;
  for (const line of content.split('\n')) {
    if (line.startsWith('```')) { inCode = !inCode; h += 8; continue; }
    if (inCode) h += Math.ceil(Math.max(1, line.length) / (perLine * 0.9)) * 20;
    else if (line.startsWith('## ')) h += 44 * Math.ceil(line.length / (perLine * 0.6));
    else if (line.startsWith('### ')) h += 34;
    else if (!line.trim()) h += 14;
    else h += Math.ceil(line.length / perLine) * 24;
  }
  return snapUp(h + 40);
};

/**
 * @param nodes    real (non-sticky) nodes, already positioned
 * @param overview Markdown for the yellow overview sticky
 * @param groups   [{ title, body, members: [node names] }] in execution order
 * @param extras   [{ name, content, height? }] notes stacked under the overview
 * @param uuid     (name) => stable id
 */
export function houseStickies({ nodes, overview, groups, extras = [], uuid }) {
  const byName = new Map(nodes.map((n) => [n.name, n]));
  const stickies = [];
  const placed = new Set();
  groups.forEach((g, i) => {
    const members = g.members.map((m) => byName.get(m) ?? (() => { throw new Error(`group "${g.title}": no node "${m}"`); })());
    members.forEach((m) => { if (placed.has(m.name)) throw new Error(`node "${m.name}" is in two groups`); placed.add(m.name); });
    const minX = Math.min(...members.map((m) => m.position[0]));
    const minY = Math.min(...members.map((m) => m.position[1]));
    const maxX = Math.max(...members.map((m) => m.position[0] + NODE));
    const maxY = Math.max(...members.map((m) => m.position[1] + NODE));
    const width = Math.max(240, snapUp(maxX - minX + PAD_X * 2));
    const top = snapUp(textHeight(g.title, g.body, width));
    const x = snap(minX - PAD_X);
    const y = snap(minY - top);
    const height = Math.max(180, snapUp(maxY + PAD_BOTTOM - y));
    stickies.push({
      id: uuid(`sticky:${i + 1}`), name: `Sticky Note${i + 1}`, type: 'n8n-nodes-base.stickyNote', typeVersion: 1,
      position: [x, y], parameters: { content: `## ${g.title}${g.body ? `\n\n${g.body}` : ''}`, width, height, color: 7 }
    });
  });
  const unplaced = nodes.filter((n) => !placed.has(n.name)).map((n) => n.name);
  if (unplaced.length) throw new Error(`nodes in no group: ${unplaced.join(', ')}`);

  const left = Math.min(...stickies.map((s) => s.position[0]));
  const top = Math.min(...stickies.map((s) => s.position[1]));
  const ox = snap(left - OVERVIEW_W - OVERVIEW_GAP);
  const oh = overviewHeight(overview);
  const result = [{
    id: uuid('sticky:overview'), name: 'Sticky Note', type: 'n8n-nodes-base.stickyNote', typeVersion: 1,
    position: [ox, top], parameters: { content: overview, width: OVERVIEW_W, height: oh }
  }];
  let y = top + oh + STACK_GAP;
  extras.forEach((e, i) => {
    const h = e.height ?? overviewHeight(e.content);
    result.push({
      id: uuid(`sticky:extra:${i}`), name: e.name, type: 'n8n-nodes-base.stickyNote', typeVersion: 1,
      position: [ox, snap(y)], parameters: { content: e.content, width: OVERVIEW_W, height: h, color: 7 }
    });
    y += h + STACK_GAP;
  });
  return [...result, ...stickies];
}
