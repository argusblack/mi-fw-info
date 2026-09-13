#!/usr/bin/env python3
"""Streamlit host for the static Mi|Navee firmware UI."""

from __future__ import annotations

import json
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

ROOT = Path(__file__).resolve().parent
MI_JSON = ROOT / "mi.json"
NAVEE_JSON = ROOT / "navee.json"
INDEX_HTML = ROOT / "index.html"
STYLES_DIR = ROOT / "static" / "themes"
APP_JS = ROOT / "static" / "app.js"
THEME_CONSTS = ROOT / "lib" / "theme_consts.js"
THEME_IDS = ("modern", "classic", "fashion")


def load_catalog(path: Path) -> list:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    return data if isinstance(data, list) else []


def _payload(mi: list, navee: list) -> str:
    payload = {
        "mi": mi,
        "navee": navee,
        "snapshots": {
            "mi": int(MI_JSON.stat().st_mtime * 1000) if MI_JSON.exists() else None,
            "navee": int(NAVEE_JSON.stat().st_mtime * 1000) if NAVEE_JSON.exists() else None,
        },
    }
    return json.dumps(payload, ensure_ascii=False)


def build_document(mi: list, navee: list, theme: str | None = None) -> str:
    explicit_theme = theme if theme in THEME_IDS else None
    active = explicit_theme or "modern"

    html = INDEX_HTML.read_text(encoding="utf-8")
    consts = THEME_CONSTS.read_text(encoding="utf-8")
    js = APP_JS.read_text(encoding="utf-8")
    data_json = _payload(mi, navee)

    style_tags = []
    for tid in THEME_IDS:
        css = (STYLES_DIR / f"{tid}.css").read_text(encoding="utf-8")
        # All themes available; JS picks via localStorage / query. Default media until boot.
        media = "all" if tid == active else "not all"
        style_tags.append(
            f'<style data-theme-css="{tid}" media="{media}">\n{css}\n</style>'
        )

    # Drop external sheet + early boot (Streamlit cannot fetch theme files); keep consts+app.
    html = html.replace(
        '<link id="themeSheet" rel="stylesheet" href="./static/themes/modern.css" />\n'
        '  <script src="./lib/theme_consts.js"></script>\n'
        '  <script>\n'
        '    (() => {\n'
        '      const { IDS, DEFAULT, STORAGE_KEY } = window.THEMES;\n'
        '      let theme = DEFAULT;\n'
        '      try {\n'
        '        const param = new URLSearchParams(window.location.search).get("theme");\n'
        '        if (param && IDS.includes(param)) {\n'
        '          theme = param;\n'
        '        } else {\n'
        '          const saved = localStorage.getItem(STORAGE_KEY);\n'
        '          if (saved && IDS.includes(saved)) theme = saved;\n'
        '        }\n'
        '      } catch (_) {\n'
        '        /* ignore */\n'
        '      }\n'
        '      document.documentElement.dataset.theme = theme;\n'
        '      const sheet = document.getElementById("themeSheet");\n'
        '      if (sheet) sheet.href = `./static/themes/${theme}.css`;\n'
        '      window.__FW_BOOT_THEME__ = theme;\n'
        '    })();\n'
        '  </script>',
        '<link id="themeSheet" rel="stylesheet" href="about:blank" />\n'
        + "\n".join(style_tags),
    )

    theme_boot = ""
    if explicit_theme:
        theme_boot = f"window.__FW_THEME__ = {json.dumps(explicit_theme)};"

    # Prefer localStorage inside the iframe after load.
    streamlit_boot = """
(() => {
  const { IDS, DEFAULT, STORAGE_KEY } = window.THEMES;
  let theme = DEFAULT;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && IDS.includes(saved)) theme = saved;
  } catch (_) {}
  if (window.__FW_THEME__ && IDS.includes(window.__FW_THEME__)) {
    theme = window.__FW_THEME__;
  }
  document.querySelectorAll("style[data-theme-css]").forEach((el) => {
    el.media = el.getAttribute("data-theme-css") === theme ? "all" : "not all";
  });
  window.__FW_BOOT_THEME__ = theme;
})();
"""

    html = html.replace(
        '<script src="./static/app.js"></script>',
        f"<script>window.__FW_DATA__ = {data_json};{theme_boot}</script>\n"
        f"<script>\n{consts}\n</script>\n"
        f"<script>\n{streamlit_boot}\n</script>\n"
        f"<script>\n{js}\n</script>",
    )
    return html


def main() -> None:
    st.set_page_config(
        page_title="Mi|Navee Firmware info",
        page_icon=None,
        layout="wide",
        initial_sidebar_state="collapsed",
    )
    st.markdown(
        """
        <style>
          header[data-testid="stHeader"],
          #MainMenu,
          footer,
          div[data-testid="stToolbar"],
          div[data-testid="stDecoration"],
          section[data-testid="stSidebar"] { display: none !important; }
          .block-container {
            padding: 0 !important;
            max-width: 100% !important;
          }
          iframe { border: none !important; }
        </style>
        """,
        unsafe_allow_html=True,
    )

    theme = "modern"
    try:
        theme = st.query_params.get("theme", None)
    except Exception:
        vals = st.experimental_get_query_params().get("theme", [])
        theme = vals[0] if vals else None

    mi = load_catalog(MI_JSON)
    navee = load_catalog(NAVEE_JSON)
    doc = build_document(mi, navee, theme=theme)
    components.html(doc, height=1400, scrolling=True)


if __name__ == "__main__":
    main()
