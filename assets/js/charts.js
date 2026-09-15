/**
 * Hand-rolled inline-SVG charts.
 *
 * Colour comes from the validated categorical slots defined in app.css
 * (--series-1..4, one slot per platform, assigned by entity and never cycled).
 * Every chart here ships a legend, direct value labels and a table view, because
 * three of the four light-mode slots sit below 3:1 against the surface.
 */
import { html, esc } from './utils.js';

const seriesVar = (n) => `var(--series-${n})`;

/**
 * Stacked columns, laid out in CSS rather than SVG so the labels stay at their
 * real size at every container width.
 * `periods` = [{ label, values: { [platformId]: n } }]
 * `series`  = [{ id, name, slot }]
 */
export function stackedColumns(periods, series, { height = 180, title = '' } = {}) {
  const max = Math.max(1, ...periods.map((p) => series.reduce((sum, s) => sum + (p.values[s.id] || 0), 0)));

  const cols = periods.map((p) => {
    const total = series.reduce((sum, s) => sum + (p.values[s.id] || 0), 0);
    const segs = series
      .filter((s) => (p.values[s.id] || 0) > 0)
      .map((s) => html`<span class="col__seg" style="flex:${p.values[s.id]};background:${seriesVar(s.slot)}"
            title="${`${p.label} · ${s.name}: ${p.values[s.id]}`}"></span>`);
    return html`<div class="col">
      <span class="col__total">${total || ''}</span>
      <div class="col__stack" style="height:${((total / max) * 100).toFixed(1)}%">${segs}</div>
      <span class="col__label">${p.label}</span>
    </div>`;
  });

  return html`<figure class="chart">
    ${title ? html`<figcaption class="chart__title">${title}</figcaption>` : ''}
    <div class="cols" style="--plot-h:${height}px" role="img" aria-label="${title || 'Postings by channel'}">${cols}</div>
    ${[legend(series)]}
  </figure>`;
}

/**
 * Horizontal bars. `rows` = [{ label, value, max, slot, note }]
 * Each row keeps its own entity colour, so a filter never repaints the survivors.
 */
export function horizontalBars(rows, { title = '', unit = '' } = {}) {
  const body = rows.map((r) => {
    const pct = r.max ? Math.round((r.value / r.max) * 100) : 0;
    return html`<div class="hbar">
      <span class="hbar__label">${r.label}</span>
      <span class="hbar__track" role="img" aria-label="${`${r.label}: ${r.value} of ${r.max}`}">
        <span class="hbar__fill" style="width:${Math.max(pct, r.value ? 3 : 0)}%;background:${seriesVar(r.slot)}"></span>
      </span>
      <span class="hbar__value">${r.value}${unit}<span class="hbar__note"> / ${r.max}</span></span>
    </div>`;
  }).join('');
  return html`<figure class="chart chart--hbars">
    ${title ? html`<figcaption class="chart__title">${title}</figcaption>` : ''}
    ${[body || '<p class="muted">Nothing to plot yet.</p>']}
  </figure>`;
}

export function legend(series) {
  return html`<ul class="legend">${series.map((s) => html`<li class="legend__item">
    <span class="legend__swatch" style="background:${seriesVar(s.slot)}"></span>${s.name}
  </li>`)}</ul>`;
}

/** The table view every chart needs to stay readable without colour. */
export function chartTable(periods, series) {
  return html`<details class="chart-table">
    <summary>Show the numbers</summary>
    <div class="table-wrap">
      <table class="table table--compact">
        <thead><tr><th scope="col">Week</th>${series.map((s) => html`<th scope="col">${s.name}</th>`)}<th scope="col">Total</th></tr></thead>
        <tbody>${periods.map((p) => {
          const total = series.reduce((sum, s) => sum + (p.values[s.id] || 0), 0);
          return html`<tr><th scope="row">${p.label}</th>${series.map((s) => html`<td>${p.values[s.id] || 0}</td>`)}<td><strong>${total}</strong></td></tr>`;
        })}</tbody>
      </table>
    </div>
  </details>`;
}
