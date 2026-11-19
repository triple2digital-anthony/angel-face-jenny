(() => {
  const CHECK_KEY = "angel-face-checklist-v1";
  const SCORE_KEY = "angel-face-scorecard-v1";
  const DESIGN_KEY = "angel-face-design-shortlist-v1";
  const BRAND_KEY = "angel-face-brand-territories-v1";

  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function loadJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  async function fetchJSON(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return res.json();
  }

  function mountChecklist(actions) {
    const host = document.getElementById("platform-checklist");
    if (!host) return;
    const ticks = loadJSON(CHECK_KEY, {});
    const all = actions.phases.flatMap((p) => p.items);
    const done = all.filter((i) => ticks[i.id]).length;

    host.innerHTML = `
      <div class="progress-row">
        <div class="progress-bar"><i style="width:${all.length ? (100 * done) / all.length : 0}%"></i></div>
        <div class="progress-n">${done} of ${all.length} done</div>
      </div>
      ${actions.phases
        .map((phase) => {
          const items = phase.items
            .map((it) => {
              const checked = !!ticks[it.id];
              return `<li class="todo-item${it.urgent ? " urgent" : ""}${checked ? " done" : ""}" data-id="${esc(it.id)}">
              <input type="checkbox" ${checked ? "checked" : ""} aria-label="Done">
              <div>
                <div class="what">${esc(it.what)}${it.urgent ? ' <span class="mini-pill urgent">Urgent</span>' : ""}</div>
                <div class="how">${esc(it.how)}</div>
              </div>
              <div class="when">${esc(it.when)}</div>
            </li>`;
            })
            .join("");
          return `<div class="phase-block">
            <div class="phase-head">
              <h3>${esc(phase.title)}</h3>
              <span class="mini-pill info">${esc(phase.window)}</span>
            </div>
            <p class="phase-sum">${esc(phase.summary)}</p>
            <ol class="todo-list">${items}</ol>
          </div>`;
        })
        .join("")}`;

    host.addEventListener("change", (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return;
      const li = input.closest("li[data-id]");
      if (!li) return;
      const next = loadJSON(CHECK_KEY, {});
      if (input.checked) next[li.dataset.id] = true;
      else delete next[li.dataset.id];
      saveJSON(CHECK_KEY, next);
      li.classList.toggle("done", input.checked);
      mountChecklist(actions);
    });
  }

  function mountScorecard(actions) {
    const host = document.getElementById("platform-scorecard");
    if (!host || !actions.scorecard) return;
    const saved = loadJSON(SCORE_KEY, { week: "", values: {} });
    host.innerHTML = `
      <div class="callout-dark">${esc(actions.scorecard.rule)}</div>
      <div class="metric-grid">
        <div class="metric">
          <label for="sc-week">Week of</label>
          <input type="date" id="sc-week" value="${esc(saved.week || "")}">
        </div>
        ${actions.scorecard.metrics
          .map(
            (m) => `<div class="metric">
            <label for="${esc(m.id)}">${esc(m.label)}</label>
            <div class="hint">${esc(m.hint)}</div>
            <input id="${esc(m.id)}" data-metric="${esc(m.id)}" value="${esc(saved.values?.[m.id] || "")}" placeholder="—">
          </div>`
          )
          .join("")}
      </div>
      <div class="btn-row">
        <button type="button" class="btn" id="sc-save">Save week</button>
        <button type="button" class="btn ghost" id="sc-clear">Clear</button>
        <span class="hint" id="sc-status"></span>
      </div>`;

    const persist = () => {
      const next = { week: document.getElementById("sc-week").value, values: {}, updatedAt: new Date().toISOString() };
      host.querySelectorAll("[data-metric]").forEach((el) => {
        next.values[el.dataset.metric] = el.value.trim();
      });
      saveJSON(SCORE_KEY, next);
      document.getElementById("sc-status").textContent = `Saved ${new Date().toLocaleString()}`;
    };
    document.getElementById("sc-save").onclick = persist;
    document.getElementById("sc-clear").onclick = () => {
      host.querySelectorAll("[data-metric]").forEach((el) => {
        el.value = "";
      });
      persist();
    };
  }

  function lightboxShell(id, alt) {
    return `<div class="lightbox" id="${esc(id)}" role="dialog" aria-modal="true" aria-label="Preview">
      <button type="button" class="lb-nav lb-prev" data-lb-prev aria-label="Previous">‹</button>
      <div class="lb-stage">
        <img alt="${esc(alt)}">
        <div class="lb-bar">
          <span data-lb-caption></span>
          <span class="lb-keys"><kbd>←</kbd> <kbd>→</kbd> navigate · <kbd>Esc</kbd> close · <span data-lb-counter></span></span>
        </div>
      </div>
      <button type="button" class="lb-nav lb-next" data-lb-next aria-label="Next">›</button>
      <button type="button" class="lb-close" data-lb-close aria-label="Close">×</button>
    </div>`;
  }

  function wireGalleryLightbox(lb, slides) {
    if (!lb || !slides.length) return { openAt() {} };
    let index = 0;
    const img = lb.querySelector("img");
    const caption = lb.querySelector("[data-lb-caption]");
    const counter = lb.querySelector("[data-lb-counter]");

    const show = (i) => {
      index = ((i % slides.length) + slides.length) % slides.length;
      const s = slides[index];
      img.src = s.src;
      img.alt = s.title || "";
      if (caption) caption.textContent = [s.title, s.subtitle].filter(Boolean).join(" — ");
      if (counter) counter.textContent = `${index + 1} / ${slides.length}`;
      lb.classList.add("on");
      document.body.style.overflow = "hidden";
    };

    const close = () => {
      lb.classList.remove("on");
      document.body.style.overflow = "";
    };

    const onKey = (e) => {
      if (!lb.classList.contains("on")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        show(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        show(index - 1);
      }
    };

    if (lb._afKeyHandler) document.removeEventListener("keydown", lb._afKeyHandler);
    lb._afKeyHandler = onKey;
    document.addEventListener("keydown", onKey);

    lb.onclick = (e) => {
      if (e.target === lb || e.target.closest("[data-lb-close]")) close();
    };
    lb.querySelector("[data-lb-prev]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      show(index - 1);
    });
    lb.querySelector("[data-lb-next]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      show(index + 1);
    });
    img.addEventListener("click", (e) => e.stopPropagation());

    return { openAt: show, close };
  }

  function mountDesigns(designData) {
    const host = document.getElementById("platform-designs");
    if (!host) return;
    let state = loadJSON(DESIGN_KEY, { votes: {}, order: [] });

    const render = () => {
      const short = state.order.filter((id) => state.votes[id] === "shortlist");
      const slides = designData.comps.map((c) => {
        const file = c.file.startsWith("comps/") ? `designs/${c.file}` : c.file;
        return { id: c.id, src: file, title: c.name, subtitle: c.tagline };
      });

      host.innerHTML = `
        <div class="btn-row" style="margin-bottom:1rem">
          <span class="hint">${short.length} shortlisted · votes save in this browser · click image then ← → Esc</span>
          <button type="button" class="btn ghost" id="des-export">Copy shortlist JSON</button>
          <button type="button" class="btn ghost" id="des-reset">Reset</button>
        </div>
        <div class="design-grid">
          ${designData.comps
            .map((c, i) => {
              const v = state.votes[c.id] || "";
              const file = slides[i].src;
              return `<article class="design-card${v === "shortlist" ? " on" : ""}${v === "kill" ? " killed" : ""}" data-id="${esc(c.id)}" data-index="${i}">
              <img src="${esc(file)}" alt="${esc(c.name)}" data-full="${esc(file)}" data-index="${i}">
              <div class="dbody">
                <div class="dname">${esc(c.name)}</div>
                <div class="hint">${esc(c.tagline)}</div>
                <div class="why">${esc(c.why)}</div>
                <div class="btn-row">
                  <button type="button" class="btn ${v === "shortlist" ? "" : "ghost"}" data-vote="shortlist">Shortlist</button>
                  <button type="button" class="btn ghost" data-vote="maybe">Maybe</button>
                  <button type="button" class="btn ghost" data-vote="kill">Kill</button>
                </div>
              </div>
            </article>`;
            })
            .join("")}
        </div>
        <h4>Shortlist order</h4>
        <ol class="short-order" id="short-order">
          ${short
            .map((id, i) => {
              const c = designData.comps.find((x) => x.id === id);
              return `<li>#${i + 1} ${esc(c?.name || id)}</li>`;
            })
            .join("") || "<li class='hint'>None yet</li>"}
        </ol>
        <h4>Competitors</h4>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Name</th><th>Geo</th><th>Notes</th></tr></thead>
            <tbody>
              ${designData.competitors
                .map(
                  (c) => `<tr>
                <td><a class="brand-text" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a></td>
                <td>${esc(c.geo)}</td>
                <td>${esc(c.notes)}</td>
              </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
        ${lightboxShell("des-lightbox", "Comp preview")}`;

      host.querySelectorAll("[data-vote]").forEach((btn) => {
        btn.onclick = () => {
          const id = btn.closest("[data-id]").dataset.id;
          const vote = btn.dataset.vote;
          state.votes[id] = vote;
          if (vote === "shortlist") {
            if (!state.order.includes(id)) state.order.push(id);
          } else {
            state.order = state.order.filter((x) => x !== id);
          }
          saveJSON(DESIGN_KEY, state);
          render();
        };
      });
      const gallery = wireGalleryLightbox(document.getElementById("des-lightbox"), slides);
      host.querySelectorAll(".design-card img").forEach((img) => {
        img.onclick = () => gallery.openAt(Number(img.dataset.index) || 0);
      });
      const exp = document.getElementById("des-export");
      if (exp) {
        exp.onclick = async () => {
          const payload = {
            shortlist: state.order
              .filter((id) => state.votes[id] === "shortlist")
              .map((id, i) => ({ rank: i + 1, id, name: designData.comps.find((c) => c.id === id)?.name })),
            exportedAt: new Date().toISOString(),
          };
          const text = JSON.stringify(payload, null, 2);
          try {
            await navigator.clipboard.writeText(text);
            exp.textContent = "Copied ✓";
          } catch {
            prompt("Copy JSON", text);
          }
        };
      }
      const reset = document.getElementById("des-reset");
      if (reset) {
        reset.onclick = () => {
          if (!confirm("Reset design votes?")) return;
          state = { votes: {}, order: [] };
          saveJSON(DESIGN_KEY, state);
          render();
        };
      }
    };

    render();
  }

  function mountBrands(brandData) {
    const host = document.getElementById("platform-brands");
    if (!host) return;
    let state = loadJSON(BRAND_KEY, { votes: {}, order: [] });
    const list = brandData.territories || [];

    const render = () => {
      const short = state.order.filter((id) => state.votes[id] === "shortlist");
      host.innerHTML = `
        <div class="btn-row" style="margin-bottom:1rem">
          <span class="hint">${short.length} shortlisted · votes save in this browser · slot open for Jenny’s names</span>
          <button type="button" class="btn ghost" id="br-export">Copy shortlist JSON</button>
          <button type="button" class="btn ghost" id="br-reset">Reset</button>
        </div>
        <div class="design-grid">
          ${list
            .map((b) => {
              const v = state.votes[b.id] || "";
              const file = b.file.startsWith("brands/") ? `designs/${b.file}` : b.file;
              const swatches = (b.palette || [])
                .map(
                  (hex) =>
                    `<span title="${esc(hex)}" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${esc(hex)};border:1px solid rgba(255,255,255,.15);margin-right:3px"></span>`
                )
                .join("");
              return `<article class="design-card${v === "shortlist" ? " on" : ""}${v === "kill" ? " killed" : ""}" data-id="${esc(b.id)}">
              <img src="${esc(file)}" alt="${esc(b.name)} brand board" data-full="${esc(file)}">
              <div class="dbody">
                <div class="dname">${esc(b.name)}</div>
                <div class="hint">${esc(b.tagline)}</div>
                <div class="why"><strong style="color:var(--slate-light)">${esc(b.territory)}</strong> · ${esc(b.why)}</div>
                <div class="hint" style="margin-top:0.4rem">${esc(b.typography)} · ${esc(b.mark || "")}</div>
                <div style="margin-top:0.45rem">${swatches}</div>
                <div class="btn-row">
                  <button type="button" class="btn ${v === "shortlist" ? "" : "ghost"}" data-vote="shortlist">Shortlist</button>
                  <button type="button" class="btn ghost" data-vote="maybe">Maybe</button>
                  <button type="button" class="btn ghost" data-vote="kill">Kill</button>
                </div>
              </div>
            </article>`;
            })
            .join("")}
        </div>
        <h4>Shortlist order</h4>
        <ol class="short-order" id="brand-short-order">
          ${short
            .map((id, i) => {
              const b = list.find((x) => x.id === id);
              return `<li>#${i + 1} ${esc(b?.name || id)} — ${esc(b?.tagline || "")}</li>`;
            })
            .join("") || "<li class='hint'>None yet</li>"}
        </ol>
        ${lightboxShell("br-lightbox", "Brand board preview")}`;

      const brandSlides = list.map((b) => {
        const file = b.file.startsWith("brands/") ? `designs/${b.file}` : b.file;
        return { id: b.id, src: file, title: b.name, subtitle: b.tagline };
      });

      host.querySelectorAll("[data-vote]").forEach((btn) => {
        btn.onclick = () => {
          const id = btn.closest("[data-id]").dataset.id;
          const vote = btn.dataset.vote;
          state.votes[id] = vote;
          if (vote === "shortlist") {
            if (!state.order.includes(id)) state.order.push(id);
          } else {
            state.order = state.order.filter((x) => x !== id);
          }
          saveJSON(BRAND_KEY, state);
          render();
        };
      });
      const gallery = wireGalleryLightbox(document.getElementById("br-lightbox"), brandSlides);
      host.querySelectorAll(".design-card img").forEach((img, i) => {
        img.onclick = () => gallery.openAt(i);
      });
      const exp = document.getElementById("br-export");
      if (exp) {
        exp.onclick = async () => {
          const payload = {
            deliverable: "brand identity territories shortlist",
            shortlist: state.order
              .filter((id) => state.votes[id] === "shortlist")
              .map((id, i) => {
                const b = list.find((x) => x.id === id);
                return { rank: i + 1, id, name: b?.name, tagline: b?.tagline, territory: b?.territory };
              }),
            awaitingJennyNames: true,
            exportedAt: new Date().toISOString(),
          };
          const text = JSON.stringify(payload, null, 2);
          try {
            await navigator.clipboard.writeText(text);
            exp.textContent = "Copied ✓";
          } catch {
            prompt("Copy JSON", text);
          }
        };
      }
      const reset = document.getElementById("br-reset");
      if (reset) {
        reset.onclick = () => {
          if (!confirm("Reset brand territory votes?")) return;
          state = { votes: {}, order: [] };
          saveJSON(BRAND_KEY, state);
          render();
        };
      }
    };

    render();
  }

  window.AngelFacePlatform = {
    async boot() {
      try {
        const [actions, designs, brands] = await Promise.all([
          fetchJSON("data/actions.json"),
          fetchJSON("designs/comps.json"),
          fetchJSON("designs/brands.json"),
        ]);
        mountChecklist(actions);
        mountScorecard(actions);
        mountDesigns(designs);
        mountBrands(brands);
      } catch (err) {
        const hosts = ["platform-checklist", "platform-scorecard", "platform-designs", "platform-brands"];
        hosts.forEach((id) => {
          const el = document.getElementById(id);
          if (el && !el.dataset.ready) {
            el.innerHTML = `<div class="callout-dark">Could not load platform data: ${esc(err.message)}</div>`;
          }
        });
      }
    },
  };
})();
