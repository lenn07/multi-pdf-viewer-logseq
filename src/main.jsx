import "@logseq/libs";
import "./rafProxy.js";

import React from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import ViewerGrid from "./components/ViewerGrid";

// Aktuelle Breite des Viewers in Prozent der Bildschirmbreite.
// Grenzen: 20% (fast alles für Logseq) bis 90% (fast alles für PDFs).
let viewerBreiteProzent = 40;
const BREITE_MIN = 20;
const BREITE_MAX = 90;
const SPEICHER_SCHLUESSEL = "multiPdfViewer.breiteProzent";

// Setzt die Viewer-Breite. Passt drei Dinge gleichzeitig an:
//   1. die Position/Größe des iframes (`setMainUIInlineStyle`),
//   2. den rechten Abstand im Logseq-Body (damit Logseq-Inhalt nicht verdeckt wird),
//   3. localStorage, damit die Breite nach Neustart erhalten bleibt.
function viewerBreiteSetzen(prozent) {
  const geklemmt = Math.max(BREITE_MIN, Math.min(BREITE_MAX, prozent));
  viewerBreiteProzent = geklemmt;

  logseq.setMainUIInlineStyle({
    zIndex: 11,
    position: "fixed",
    top: "0",
    left: `${100 - geklemmt}vw`,
    width: `${geklemmt}vw`,
    height: "100vh",
  });

  try {
    const body = window.parent.document.body;
    if (body.classList.contains("pdf-viewer-open")) {
      body.style.setProperty("padding-right", `${geklemmt}vw`, "important");
    }
  } catch (e) {}

  try {
    localStorage.setItem(SPEICHER_SCHLUESSEL, String(geklemmt));
  } catch (e) {}
}

function viewerBreiteLesen() {
  return viewerBreiteProzent;
}

// Logseqs eigenes Layout per CSS anpassen (außerhalb des Plugin-Iframes).
// Die Klasse 'pdf-viewer-open' auf dem body-Element gibt Logseq einen rechten Abstand —
// sein Inhalt rückt links zusammen und unser Viewer hat Platz.
function viewerOeffnen() {
  logseq.showMainUI();
  try {
    const body = window.parent.document.body;
    body.classList.add("pdf-viewer-open");
    body.style.setProperty("padding-right", `${viewerBreiteProzent}vw`, "important");
  } catch (e) {}
}

function viewerSchliessen() {
  logseq.hideMainUI();
  try {
    const body = window.parent.document.body;
    body.classList.remove("pdf-viewer-open");
    body.style.removeProperty("padding-right");
  } catch (e) {}
}

// Öffnet den Viewer und schickt eine PDF-URL per Custom Event an ViewerGrid.
// Nimmt entweder einen relativen Pfad (z.B. "../assets/datei.pdf") oder eine
// fertige `file://`-URL — die Block- und die Click-Quelle liefern Unterschiedliches.
async function pdfAusRelativemPfadOeffnen(pfad) {
  let url;
  let dateiname;

  if (/^file:\/\//i.test(pfad)) {
    // Schon eine absolute file://-URL — direkt nehmen.
    url = pfad;
    const ohneQuery = pfad.split("?")[0].split("#")[0];
    dateiname = decodeURIComponent(ohneQuery.split("/").pop());
  } else {
    const graph = await logseq.App.getCurrentGraph();
    if (!graph) {
      return logseq.App.showMsg("Kein Graph offen.", "error");
    }
    const bereinigt = pfad.replace(/^\.\.\//, "");
    url = `file://${graph.path}/${bereinigt}`;
    dateiname = bereinigt.split("/").pop();
  }

  viewerOeffnen();

  window.dispatchEvent(
    new CustomEvent("pdf-oeffnen", {
      detail: { url, titel: dateiname },
    })
  );
}

// Liest den aktuell in Logseq aktiven Block, sucht darin einen PDF-Link
// (Markdown-Format `[label](pfad.pdf)`) und öffnet ihn im Viewer.
async function pdfAusBlockOeffnen() {
  const block = await logseq.Editor.getCurrentBlock();
  if (!block) {
    return logseq.App.showMsg("Kein Block ausgewählt.", "error");
  }

  const treffer = block.content.match(/\[.*?\]\((.*?\.pdf)\)/);
  if (!treffer) {
    return logseq.App.showMsg(
      "Kein PDF-Link im aktuellen Block gefunden.",
      "warning"
    );
  }

  pdfAusRelativemPfadOeffnen(treffer[1]);
}

// Globaler Click-Handler im Logseq-Hauptdokument. Wird in der "capture phase"
// registriert (drittes Argument `true` bei addEventListener) — d.h. wir bekommen
// das Event auf dem Weg von <html> nach unten zum Klick-Ziel, BEVOR Logseqs
// eigene Handler greifen können. Mit stopImmediatePropagation() unterbinden wir
// dann sowohl andere Listener auf demselben Element als auch das Bubbling.
function pdfKlickAbfangen(event) {
  // Nur reiner Linksklick — Strg/Cmd/Shift/Alt + Klick lassen wir durch,
  // damit der Nutzer PDFs weiterhin "anders" öffnen kann (z.B. neues Tab).
  if (event.button !== 0) return;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

  // Klick könnte auf einem <span> innerhalb des Links liegen — `closest`
  // klettert im DOM nach oben, bis ein <a>-Vorfahre gefunden wird.
  const link = event.target && event.target.closest && event.target.closest("a");
  if (!link) return;

  // getAttribute liest den Original-Wert (relativer Pfad), nicht die vom
  // Browser aufgelöste absolute URL — wir wollen wissen, was im Markdown stand.
  const href = link.getAttribute("href") || link.getAttribute("data-href") || "";
  if (!href) return;

  // Externe URLs nicht abfangen — Logseq soll http(s)-PDFs normal handhaben.
  if (/^https?:\/\//i.test(href)) return;

  // Nur echte PDF-Endungen (auch mit ?query oder #fragment am Ende).
  if (!/\.pdf(\?|#|$)/i.test(href)) return;

  // Logseqs eigenen PDF-Viewer-Handler komplett unterdrücken.
  event.preventDefault();
  event.stopImmediatePropagation();

  pdfAusRelativemPfadOeffnen(href);
}

function main() {
  const root = createRoot(document.getElementById("app"));
  root.render(<ViewerGrid />);

  // Gespeicherte Breite aus dem letzten Besuch wiederherstellen (falls vorhanden).
  try {
    const gespeichert = parseFloat(localStorage.getItem(SPEICHER_SCHLUESSEL));
    if (!isNaN(gespeichert)) {
      viewerBreiteProzent = Math.max(BREITE_MIN, Math.min(BREITE_MAX, gespeichert));
    }
  } catch (e) {}

  // box-sizing injizieren, damit padding-right die Logseq-Breite nicht sprengt.
  // Den padding-Wert selbst setzen wir jetzt dynamisch in viewerBreiteSetzen().
  logseq.provideStyle(`
    body.pdf-viewer-open {
      box-sizing: border-box !important;
    }
  `);

  logseq.provideModel({
    openViewer: viewerOeffnen,
  });

  viewerBreiteSetzen(viewerBreiteProzent);

  logseq.useSettingsSchema([
    {
      key: "maxViewer",
      type: "number",
      default: 4,
      title: "Maximale Anzahl PDFs",
      description: "Wie viele PDFs dürfen gleichzeitig geöffnet sein?",
    },
  ]);

  logseq.App.registerUIItem("toolbar", {
    key: "multi-pdf-viewer-open",
    template: `<a data-on-click="openViewer" title="PDF Viewer öffnen">
      <div style="font-size:18px;margin-top:4px;opacity:0.7">📄</div>
    </a>`,
  });

  logseq.App.registerCommandPalette(
    { key: "open-pdf-viewer", label: "PDF Viewer öffnen" },
    viewerOeffnen
  );

  logseq.App.registerCommandPalette(
    { key: "open-pdf-from-block", label: "PDF aus Block im Viewer öffnen" },
    pdfAusBlockOeffnen
  );

  // Die CSS-Variablen, die unsere Komponenten nutzen. Werden aus Logseqs
  // Haupt-Dokument kopiert, damit wir exakt dessen Theme-Farben übernehmen
  // (auch bei Custom-Themes, nicht nur Dark/Light).
  const FARB_VARIABLEN = [
    "--ls-primary-background-color",
    "--ls-secondary-background-color",
    "--ls-primary-text-color",
    "--ls-secondary-text-color",
    "--ls-border-color",
  ];

  // Log ins Logseq-Hauptfenster (statt ins iframe), damit die Nachricht
  // in derselben Console auftaucht, die der Nutzer ohnehin offen hat.
  function parentLog(...args) {
    try {
      window.parent.console.log("[MultiPdfViewer]", ...args);
    } catch (e) {
      console.log("[MultiPdfViewer]", ...args);
    }
  }

  function farbenVonLogseqUebernehmen() {
    try {
      const parentWin = window.parent;
      const parentDoc = parentWin.document;
      // WICHTIG: Wir schreiben auf unser iframe-<body> (nicht <html>).
      // Grund: Das app.css hat `body.dark { --ls-*: ... }` — eine Klassen-
      // Regel auf body. Inline-Style auf body schlägt Klassen-Regel auf
      // demselben Element (höhere Spezifität). Auf html gesetzt würde die
      // body-Regel für alle Kinder des bodys gewinnen.
      const eigenesBody = document.body;

      // Haupt-Quelle: tatsächliche Body-Farbe + Schrift von Logseq.
      const bodyStil = parentWin.getComputedStyle(parentDoc.body);
      let bg = bodyStil.backgroundColor;
      const fg = bodyStil.color;
      const schriftart = bodyStil.fontFamily;

      // Falls body-Hintergrund transparent ist, von html lesen.
      if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") {
        bg = parentWin.getComputedStyle(parentDoc.documentElement)
          .backgroundColor;
      }

      eigenesBody.style.setProperty("--ls-primary-background-color", bg);
      eigenesBody.style.setProperty("--ls-primary-text-color", fg);
      // Direkt am body setzen, damit alles, was per `inherit` arbeitet
      // (color, font-family), automatisch die Logseq-Werte nutzt.
      eigenesBody.style.backgroundColor = bg;
      eigenesBody.style.color = fg;
      eigenesBody.style.fontFamily = schriftart;

      // Zusätzlich: die --ls-* Variablen vom Parent holen (falls gesetzt).
      // Gibt uns secondary/border-Farben, die wir aus bg/fg nicht ableiten
      // könnten.
      const quellen = [parentDoc.documentElement, parentDoc.body];
      const zusaetzlich = {};
      for (const variable of FARB_VARIABLEN) {
        for (const quelle of quellen) {
          const wert = parentWin
            .getComputedStyle(quelle)
            .getPropertyValue(variable)
            .trim();
          if (wert) {
            eigenesBody.style.setProperty(variable, wert);
            zusaetzlich[variable] = wert;
            break;
          }
        }
      }

      parentLog("Theme übernommen:", {
        "body.backgroundColor": bg,
        "body.color": fg,
        "body.fontFamily": schriftart,
        "zusätzliche --ls-* Variablen": zusaetzlich,
      });
    } catch (e) {
      parentLog("Fehler beim Farben-Lesen:", e && e.message);
    }
  }

  // Liest direkt an Logseqs <html> / <body>, ob Dark Mode aktiv ist.
  // Robuster als `preferredThemeMode`, weil das nur die Einstellung
  // ("auto", "dark", "light") zeigt, nicht den tatsächlich aktiven Modus.
  function istLogseqDunkel() {
    try {
      const parentDoc = window.parent.document;
      for (const el of [parentDoc.documentElement, parentDoc.body]) {
        if (
          el.classList.contains("dark") ||
          el.classList.contains("theme-dark")
        )
          return true;
        if (
          el.classList.contains("light") ||
          el.classList.contains("theme-light")
        )
          return false;
        const attr = el.getAttribute("data-theme");
        if (attr === "dark") return true;
        if (attr === "light") return false;
      }
      // Letzter Fallback: Hintergrundhelligkeit vom Logseq-Body prüfen.
      const bg = window.parent.getComputedStyle(parentDoc.body).backgroundColor;
      const zahlen = bg.match(/\d+/g);
      if (!zahlen) return false;
      const [r, g, b] = zahlen.map(Number);
      const luminanz = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      return luminanz < 0.5;
    } catch (e) {
      return false;
    }
  }

  function themeAnwenden() {
    const dunkel = istLogseqDunkel();
    parentLog("themeAnwenden läuft. istLogseqDunkel =", dunkel);
    // 1. Dark-Klasse an unserem iframe-Body setzen — wirkt als Fallback,
    //    falls das Kopieren der Farbvariablen fehlschlägt.
    document.body.classList.toggle("dark", dunkel);
    // 2. Echte Farbwerte aus Logseq übernehmen (überschreibt die Fallbacks).
    farbenVonLogseqUebernehmen();
  }
  themeAnwenden();
  logseq.App.onThemeChanged(themeAnwenden);

  // Zusätzlich: Logseqs html/body direkt beobachten. Die onThemeChanged-API
  // feuert nicht bei allen Änderungen (z.B. beim Wechsel in den Einstellungen).
  // Ein MutationObserver fängt class- und style-Änderungen zuverlässig ab.
  try {
    const parentDoc = window.parent.document;
    const beobachter = new MutationObserver(() => themeAnwenden());
    const optionen = {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    };
    beobachter.observe(parentDoc.documentElement, optionen);
    beobachter.observe(parentDoc.body, optionen);
  } catch (e) {
    parentLog("MutationObserver konnte nicht installiert werden:", e && e.message);
  }

  // PDF-Linksklicks im Logseq-Hauptdokument abfangen, bevor Logseq seinen
  // eigenen Viewer öffnet. Capture-phase (`true`) ist hier entscheidend.
  try {
    window.parent.document.addEventListener("click", pdfKlickAbfangen, true);
    parentLog("PDF-Click-Interceptor aktiv");
  } catch (e) {
    parentLog("PDF-Click-Interceptor konnte nicht installiert werden:", e && e.message);
  }

  // Sauber aufräumen, wenn das Plugin entladen wird (Logseq beim Reload/Disable).
  logseq.beforeunload(async () => {
    try {
      window.parent.document.removeEventListener("click", pdfKlickAbfangen, true);
    } catch (e) {}
  });
}

logseq.ready(main).catch(console.error);

// Werden von ViewerGrid.jsx aufgerufen (Schließen-Button, "+ PDF hinzufügen"-Button, Resize-Handle).
export { viewerSchliessen, pdfAusBlockOeffnen, viewerBreiteSetzen, viewerBreiteLesen, BREITE_MIN, BREITE_MAX };
