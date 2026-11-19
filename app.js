(() => {
  const STORAGE_KEY = "angel-face-checklist-v1";
  const SCORECARD_KEY = "angel-face-scorecard-v1";

  function loadTicks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveTicks(ticks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ticks));
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pillFor(item) {
    if (item.urgent) return `<span class="pill urgent">Urgent</span>`;
    return "";
  }

  function renderItem(item, ticks) {
    const done = !!ticks[item.id];
    const urgent = item.urgent ? " urgent" : "";
    const checked = done ? " checked" : "";
    const doneClass = done ? " done" : "";
    return `<li class="${urgent}${doneClass}" data-id="${escapeHtml(item.id)}">
      <input type="checkbox" aria-label="Done"${checked}>
      <div>
        <div class="what">${escapeHtml(item.what)} ${pillFor(item)}</div>
        <div class="how">${escapeHtml(item.how)}</div>
      </div>
      <div class="when">${escapeHtml(item.when)}</div>
    </li>`;
  }

  function updateProgress(root) {
    const items = [...root.querySelectorAll("ol.todo li[data-id]")];
    const done = items.filter((li) => li.classList.contains("done")).length;
    const bar = root.querySelector("[data-pbar]");
    const count = root.querySelector("[data-pcount]");
    if (bar) bar.style.width = items.length ? `${(100 * done) / items.length}%` : "0%";
    if (count) count.textContent = `${done} of ${items.length} done`;
  }

  function bindList(list, ticks) {
    list.addEventListener("change", (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return;
      const li = input.closest("li[data-id]");
      if (!li) return;
      const id = li.dataset.id;
      ticks[id] = input.checked;
      if (!input.checked) delete ticks[id];
      saveTicks(ticks);
      li.classList.toggle("done", input.checked);
      updateProgress(list.closest("[data-checklist]") || document);
      updateProgress(document);
    });
  }

  function renderPhase(phase, ticks) {
    const items = phase.items.map((it) => renderItem(it, ticks)).join("");
    return `<div class="phase-card card" data-phase="${escapeHtml(phase.id)}">
      <div class="phase-head">
        <h3>${escapeHtml(phase.title)}</h3>
        <span class="pill info">${escapeHtml(phase.window)}</span>
      </div>
      <p class="section-sub" style="margin-bottom:12px">${escapeHtml(phase.summary)}</p>
      <ol class="todo">${items}</ol>
    </div>`;
  }

  async function loadActions() {
    const res = await fetch("data/actions.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load data/actions.json");
    return res.json();
  }

  function mountMasterChecklist(data, pageFilter) {
    const host = document.getElementById("checklist-root");
    if (!host) return;
    const ticks = loadTicks();
    const phases = data.phases.filter((p) => !pageFilter || p.page === pageFilter || pageFilter === "all");
    host.innerHTML = `
      <div class="progress">
        <div class="bar"><i data-pbar></i></div>
        <div class="n" data-pcount>0 of 0 done</div>
      </div>
      ${phases.map((p) => renderPhase(p, ticks)).join("")}
    `;
    host.setAttribute("data-checklist", "1");
    host.querySelectorAll("ol.todo").forEach((list) => bindList(list, ticks));
    updateProgress(host);
  }

  function mountGlobalProgress(data) {
    const els = document.querySelectorAll("[data-global-progress]");
    if (!els.length) return;
    const ticks = loadTicks();
    const all = data.phases.flatMap((p) => p.items);
    const done = all.filter((it) => ticks[it.id]).length;
    const pct = all.length ? (100 * done) / all.length : 0;
    const label = `${done} of ${all.length} done`;
    els.forEach((el) => {
      if (el.dataset.globalProgress === "compact") {
        el.textContent = label;
        return;
      }
      el.innerHTML = `
        <div class="progress" style="margin:0">
          <div class="bar"><i data-pbar style="width:${pct}%"></i></div>
          <div class="n" data-pcount>${label}</div>
        </div>
      `;
    });
  }

  function mountScorecard(data) {
    const host = document.getElementById("scorecard-root");
    if (!host || !data.scorecard) return;
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(SCORECARD_KEY) || "{}");
    } catch {
      saved = {};
    }
    const week = saved.week || "";
    const values = saved.values || {};
    host.innerHTML = `
      <div class="callout rose">${escapeHtml(data.scorecard.rule)}</div>
      <div class="metric" style="margin-bottom:14px">
        <label for="sc-week">Week of</label>
        <div class="hint">Pick Monday of this scorecard week</div>
        <input type="date" id="sc-week" value="${escapeHtml(week)}">
      </div>
      <div class="grid2" id="sc-metrics">
        ${data.scorecard.metrics
          .map(
            (m) => `<div class="metric">
            <label for="${escapeHtml(m.id)}">${escapeHtml(m.label)}</label>
            <div class="hint">${escapeHtml(m.hint)}</div>
            <input id="${escapeHtml(m.id)}" data-metric="${escapeHtml(m.id)}" value="${escapeHtml(values[m.id] || "")}" placeholder="—">
          </div>`
          )
          .join("")}
      </div>
      <div class="btns">
        <button type="button" class="btn primary" id="sc-save">Save this week</button>
        <button type="button" class="btn ghost" id="sc-clear">Clear fields</button>
      </div>
      <p class="muted small" id="sc-status" style="margin-top:10px"></p>
    `;

    const persist = () => {
      const next = {
        week: document.getElementById("sc-week").value,
        values: {},
        updatedAt: new Date().toISOString(),
      };
      host.querySelectorAll("[data-metric]").forEach((input) => {
        next.values[input.dataset.metric] = input.value.trim();
      });
      localStorage.setItem(SCORECARD_KEY, JSON.stringify(next));
      document.getElementById("sc-status").textContent = `Saved locally ${new Date().toLocaleString()}.`;
    };

    document.getElementById("sc-save").addEventListener("click", persist);
    document.getElementById("sc-clear").addEventListener("click", () => {
      host.querySelectorAll("[data-metric]").forEach((input) => {
        input.value = "";
      });
      persist();
    });
  }

  function setActiveNav() {
    const page = document.body.dataset.page;
    document.querySelectorAll("nav.top .tab").forEach((a) => {
      a.classList.toggle("on", a.dataset.page === page);
    });
  }

  async function boot() {
    setActiveNav();
    try {
      const data = await loadActions();
      const page = document.body.dataset.page;
      if (page === "plan") mountMasterChecklist(data, "all");
      else if (page === "brand") mountMasterChecklist(data, "brand");
      else if (page === "offers") mountMasterChecklist(data, "offers");
      else if (page === "scale") mountMasterChecklist(data, "scale");
      else if (page === "scorecard") mountScorecard(data);
      mountGlobalProgress(data);

      const ns = document.querySelector("[data-north-star]");
      if (ns && data.meta?.northStar) ns.textContent = data.meta.northStar;
    } catch (err) {
      const host = document.getElementById("checklist-root") || document.getElementById("scorecard-root");
      if (host) {
        host.innerHTML = `<div class="callout warn">Could not load checklist data. Serve this folder over a local web server (file:// blocks fetch). Try: <code>python3 -m http.server 8765</code> then open <code>http://localhost:8765</code>.<br><br>${escapeHtml(err.message)}</div>`;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
