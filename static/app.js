(() => {
  const { IDS, DEFAULT, STORAGE_KEY, LABELS } = window.THEMES;

  const state = {
    catalog: "mi",
    theme: DEFAULT,
    data: { mi: [], navee: [], snapshots: {} },
  };

  const $ = (id) => document.getElementById(id);
  const select = $("modelSelect");
  const detail = $("detail");
  const themeSheet = $("themeSheet");
  const themeSwitch = $("themeSwitch");

  function utcFromUnix(ts) {
    if (!ts) return "";
    const d = new Date(Number(ts) * 1000);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().replace("T", " ").slice(0, 19);
  }

  function utcFromMs(ms) {
    if (!ms) return "";
    const d = new Date(Number(ms));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().replace("T", " ").slice(0, 19);
  }

  function stripQuery(url) {
    if (!url) return "";
    return String(url).split("?")[0];
  }

  function catalogItems() {
    return state.data[state.catalog] || [];
  }

  function resolveTheme(raw) {
    const value = String(raw || "").toLowerCase();
    return IDS.includes(value) ? value : DEFAULT;
  }

  function readInitialTheme() {
    if (window.__FW_BOOT_THEME__) return resolveTheme(window.__FW_BOOT_THEME__);
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("theme")) return resolveTheme(params.get("theme"));
    } catch (_) {
      /* ignore */
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return resolveTheme(saved);
    } catch (_) {
      /* ignore */
    }
    if (window.__FW_THEME__) return resolveTheme(window.__FW_THEME__);
    return DEFAULT;
  }

  function applyTheme(theme) {
    state.theme = resolveTheme(theme);
    document.documentElement.dataset.theme = state.theme;

    const mediaSheets = document.querySelectorAll("style[data-theme-css]");
    if (mediaSheets.length) {
      mediaSheets.forEach((el) => {
        el.media =
          el.getAttribute("data-theme-css") === state.theme ? "all" : "not all";
      });
    } else if (themeSheet) {
      themeSheet.href = `./static/themes/${state.theme}.css`;
    }

    themeSwitch.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.theme === state.theme);
    });
    try {
      localStorage.setItem(STORAGE_KEY, state.theme);
    } catch (_) {
      /* ignore */
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("theme", state.theme);
      window.history.replaceState({}, "", url);
    } catch (_) {
      /* ignore */
    }
  }

  function buildThemeSwitch() {
    themeSwitch.innerHTML = "";
    IDS.forEach((id) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.theme = id;
      btn.textContent = LABELS[id] || id;
      btn.addEventListener("click", () => applyTheme(id));
      themeSwitch.appendChild(btn);
    });
  }

  function fillSelect() {
    const items = [...catalogItems()].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || "")),
    );
    select.innerHTML = "";
    for (const item of items) {
      const opt = document.createElement("option");
      opt.value = String(item.model);
      opt.textContent = item.name || String(item.model);
      select.appendChild(opt);
    }
    if (items.length) {
      select.value = String(items[0].model);
      renderDetail();
    } else {
      detail.hidden = true;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fwSection(title, version, md5, url) {
    if (!version && !url) return "";
    const md5Line = md5
      ? `<p><strong>MD5</strong> ${escapeHtml(md5)}</p>`
      : "";
    let link = "";
    if (url) {
      let displayUrl = stripQuery(url);
      try {
        const parsed = new URL(url);
        displayUrl = `${parsed.origin}${parsed.pathname}`;
      } catch (_) {
        /* keep stripQuery fallback */
      }
      link = `
        <a class="fw-dl" href="${escapeHtml(url)}" rel="noopener noreferrer">
          <span class="fw-dl-btn">Download</span>
          <span class="fw-dl-url">${escapeHtml(displayUrl)}</span>
        </a>`;
    }
    return `<article class="fw-block"><h3>${escapeHtml(title)}</h3><p><strong>Version</strong> ${escapeHtml(version || "—")}</p>${md5Line}${link}</article>`;
  }

  function renderDetail() {
    const items = catalogItems();
    const model = select.value;
    const item = items.find((x) => String(x.model) === model);
    if (!item) {
      detail.hidden = true;
      return;
    }

    detail.hidden = false;
    detail.style.animation = "none";
    void detail.offsetWidth;
    detail.style.animation = "";

    $("productName").textContent = item.name || String(item.model);
    $("modelId").textContent = String(item.model);

    const fw = item.firmware || {};
    const changeDate = utcFromUnix(fw.upload_time);
    $("changeDateRow").hidden = !changeDate;
    $("changeDate").textContent = changeDate;

    const log = (fw.changeLog || "").trim();
    $("changeLog").hidden = !log;
    $("changeLog").textContent = log;

    const img = item.extra && item.extra.imageMin;
    const imgEl = $("productImage");
    if (img) {
      imgEl.hidden = false;
      imgEl.src = img;
      imgEl.alt = item.name || "Product";
      $("imageSource").textContent = stripQuery(img);
    } else {
      imgEl.hidden = true;
      imgEl.removeAttribute("src");
      $("imageSource").textContent = "";
    }

    const hasBleSlot = Boolean(fw.safe_url || fw.version);
    const hasMcu = Boolean(fw.mcu_safe_url || fw.mcu_version);
    const hasBms = Boolean(fw.bms_safe_url || fw.bms_version);
    const soleSafeUrl = hasBleSlot && !hasMcu && !hasBms;
    const primaryTitle = soleSafeUrl ? "Firmware" : "BLE firmware";

    $("fwBlocks").innerHTML = [
      fwSection(primaryTitle, fw.version, fw.md5, fw.safe_url),
      fwSection("MCU firmware", fw.mcu_version, fw.mcu_md5, fw.mcu_safe_url),
      fwSection("BMS firmware", fw.bms_version, fw.bms_md5, fw.bms_safe_url),
    ].join("");
  }

  function updateSnapshot() {
    const snap = state.data.snapshots[state.catalog];
    const el = $("snapshotMeta");
    if (snap) {
      el.textContent = `Snapshot (${state.catalog}): ${utcFromMs(snap)} UTC`;
    } else {
      el.textContent = "";
    }
  }

  function setCatalog(name) {
    state.catalog = name;
    document.querySelectorAll(".tab").forEach((btn) => {
      const active = btn.dataset.catalog === name;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    updateSnapshot();
    fillSelect();
  }

  async function loadViaFetch() {
    const [miRes, naveeRes] = await Promise.all([
      fetch("./mi.json"),
      fetch("./navee.json"),
    ]);
    if (!miRes.ok || !naveeRes.ok) {
      throw new Error("Failed to load catalog JSON");
    }
    const mi = await miRes.json();
    const navee = await naveeRes.json();
    return {
      mi,
      navee,
      snapshots: {
        mi: Date.parse(miRes.headers.get("last-modified") || "") || Date.now(),
        navee:
          Date.parse(naveeRes.headers.get("last-modified") || "") || Date.now(),
      },
    };
  }

  async function boot() {
    buildThemeSwitch();
    applyTheme(readInitialTheme());

    if (window.__FW_DATA__) {
      state.data = window.__FW_DATA__;
    } else {
      state.data = await loadViaFetch();
    }

    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => setCatalog(btn.dataset.catalog));
    });
    select.addEventListener("change", renderDetail);

    const dialog = $("fullDisclaimer");
    const openBtn = $("openFullDisclaimer");
    if (dialog && openBtn) {
      openBtn.addEventListener("click", () => dialog.showModal());
    }

    setCatalog("mi");
  }

  boot().catch((err) => {
    console.error(err);
    $("snapshotMeta").textContent = "Failed to load firmware catalogs.";
  });
})();
