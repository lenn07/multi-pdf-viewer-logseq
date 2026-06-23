import "@logseq/libs";
import "./rafProxy.js";

import React from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import ViewerGrid from "./components/ViewerGrid";
import { dateipfadAusUrl, pdfDateinameAusText } from "./dateipfad";

// Aktuelle Breite des Viewers in Prozent der Bildschirmbreite.
// Grenzen: 20% (fast alles für Logseq) bis 100% (kompletter Bildschirm für PDFs).
let viewerBreiteProzent = 40;
const BREITE_MIN = 20;
const BREITE_MAX = 100;
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

// Wandelt einen PDF-Verweis in eine fertige `file://`-URL plus Dateinamen um.
// Akzeptiert entweder einen relativen Pfad (z.B. "../assets/datei.pdf") oder
// eine bereits fertige `file://`-URL. Gibt `null` zurück, wenn kein Graph offen
// ist. Wird sowohl vom Viewer-Öffnen als auch vom "Im Explorer anzeigen" genutzt.
async function pfadZuFileUrl(pfad) {
  if (/^file:\/\//i.test(pfad)) {
    const ohneQuery = pfad.split("?")[0].split("#")[0];
    return { url: pfad, dateiname: decodeURIComponent(ohneQuery.split("/").pop()) };
  }

  const graph = await logseq.App.getCurrentGraph();
  if (!graph) {
    logseq.App.showMsg("Kein Graph offen.", "error");
    return null;
  }
  const bereinigt = pfad.replace(/^\.\.\//, "");
  const dateiname = bereinigt.split("/").pop();
  // Windows: graph.path = "C:/pfad" → braucht führenden Slash für file:///C:/pfad
  let graphPfad = graph.path.replace(/\\/g, "/");
  if (!graphPfad.startsWith("/")) graphPfad = "/" + graphPfad;
  // Pfadteile URL-kodieren (Leerzeichen, Sonderzeichen), aber nicht graph.path
  const kodiert = bereinigt.split("/").map(encodeURIComponent).join("/");
  return { url: `file://${graphPfad}/${kodiert}`, dateiname };
}

// Öffnet den Viewer und schickt eine PDF-URL per Custom Event an ViewerGrid.
async function pdfAusRelativemPfadOeffnen(pfad) {
  const res = await pfadZuFileUrl(pfad);
  if (!res) return;

  viewerOeffnen();

  window.dispatchEvent(
    new CustomEvent("pdf-oeffnen", {
      detail: { url: res.url, titel: res.dateiname },
    })
  );
}

// Liest den aktuell in Logseq aktiven Block, sucht darin einen PDF-Link
// (Markdown-Format `[label](pfad.pdf)`) und öffnet ihn im Viewer.
async function pdfAusBlockOeffnen() {
  const block = await logseq.Editor.getCurrentBlock();
  if (!block) return logseq.App.showMsg("Kein Block ausgewählt.", "error");

  const treffer = block.content.match(/\[.*?\]\((.*?\.pdf)\)/);
  if (!treffer) return logseq.App.showMsg("Kein PDF-Link im aktuellen Block gefunden.", "warning");

  pdfAusRelativemPfadOeffnen(treffer[1]);
}

// Globaler Click-Handler im Logseq-Hauptdokument. Wird in der "capture phase"
// registriert (drittes Argument `true` bei addEventListener) — d.h. wir bekommen
// das Event auf dem Weg von <html> nach unten zum Klick-Ziel, BEVOR Logseqs
// eigene Handler greifen können. Mit stopImmediatePropagation() unterbinden wir
// dann sowohl andere Listener auf demselben Element als auch das Bubbling.
function pdfKlickAbfangen(event) {
  if (event.button !== 0) return;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

  const link = event.target?.closest?.("a");
  if (!link) return;

  const href = link.getAttribute("href") || link.getAttribute("data-href") || "";
  if (!href) return;
  if (/^https?:\/\//i.test(href)) return;
  if (!/\.pdf(\?|#|$)/i.test(href)) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  pdfAusRelativemPfadOeffnen(href);
}

// Ermittelt aus einem angeklickten Link einen PDF-Verweis (relativer Pfad oder
// file://-URL) oder `null`, wenn es kein PDF ist. Behandelt zwei Fälle:
//   1. Datei-Link  [label](../assets/x.pdf)  → href endet auf ".pdf"
//   2. Seiten-Ref  [[📚 x.pdf]]              → Seitenname endet auf ".pdf"
//      (Logseq zeigt davor evtl. ein Icon/Emoji; das wird entfernt und der
//       Rest als Datei im assets-Ordner des Graphen angenommen.)
function pdfPfadAusLink(link) {
  const href = link.getAttribute("href") || link.getAttribute("data-href") || "";
  if (href && !/^https?:\/\//i.test(href) && /\.pdf(\?|#|$)/i.test(href)) {
    return href;
  }

  const ref = link.getAttribute("data-ref") || link.textContent || "";
  const name = pdfDateinameAusText(ref);
  if (name) return "../assets/" + name;
  return null;
}

// Aktuell offenes Kontextmenü-DOM im Logseq-Hauptfenster (oder null) und die
// Funktion, die seine globalen Listener wieder abmeldet.
let aktivesKontextmenu = null;
let kontextmenuAufraeumen = null;

function kontextmenuSchliessen() {
  if (kontextmenuAufraeumen) {
    try { kontextmenuAufraeumen(); } catch (e) {}
    kontextmenuAufraeumen = null;
  }
  if (aktivesKontextmenu) {
    try { aktivesKontextmenu.remove(); } catch (e) {}
    aktivesKontextmenu = null;
  }
}

// Öffnet das einfache Kontextmenü an Cursor-Position im Logseq-Hauptdokument.
// Das Menü MUSS im Parent-Dokument leben (nicht im Plugin-iframe), weil der
// PDF-Link links in Logseq sitzt, der iframe aber rechts.
function kontextmenuOeffnen(x, y, pfad) {
  kontextmenuSchliessen();
  const doc = window.parent.document;

  const menu = doc.createElement("div");
  menu.className = "multi-pdf-kontextmenu";
  menu.style.left = x + "px";
  menu.style.top = y + "px";

  const eintrag = doc.createElement("div");
  eintrag.className = "multi-pdf-kontextmenu-eintrag";
  eintrag.textContent = "📂  " + EXPLORER_LABEL;
  eintrag.addEventListener("click", () => {
    kontextmenuSchliessen();
    pdfImExplorerAusLink(pfad);
  });
  menu.appendChild(eintrag);

  doc.body.appendChild(menu);
  aktivesKontextmenu = menu;

  // Schließen bei Klick AUSSERHALB des Menüs, bei Scroll oder Escape.
  // WICHTIG: Klicks INNERHALB des Menüs dürfen es nicht schließen — sonst würde
  // der mousedown (Capture-Phase) das Menü entfernen, bevor der Eintrag-Klick
  // ankommt, und die Aktion liefe nie.
  const aufMaus = (e) => { if (!menu.contains(e.target)) kontextmenuSchliessen(); };
  const aufScroll = () => kontextmenuSchliessen();
  const aufEsc = (e) => { if (e.key === "Escape") kontextmenuSchliessen(); };

  kontextmenuAufraeumen = () => {
    doc.removeEventListener("mousedown", aufMaus, true);
    doc.removeEventListener("scroll", aufScroll, true);
    doc.removeEventListener("keydown", aufEsc, true);
  };

  // Verzögert registrieren, damit der aktuelle Rechtsklick das Menü nicht sofort
  // wieder schließt.
  setTimeout(() => {
    doc.addEventListener("mousedown", aufMaus, true);
    doc.addEventListener("scroll", aufScroll, true);
    doc.addEventListener("keydown", aufEsc, true);
  }, 0);
}

// Löst den Verweis zu einer file://-URL auf und zeigt die Datei im Explorer.
async function pdfImExplorerAusLink(pfad) {
  const res = await pfadZuFileUrl(pfad);
  if (!res) return;
  imDateiexplorerAnzeigen(res.url);
}

// Globaler Kontextmenü-Handler (Rechtsklick / Zwei-Finger-Tipp) im Logseq-
// Hauptdokument. Capture-phase wie beim Klick-Abfänger: greift nur bei
// PDF-Links und ersetzt dort Logseqs eigenes Menü. Bei allem anderen lassen
// wir Logseqs Standardmenü unangetastet.
function pdfKontextmenuAbfangen(event) {
  const link = event.target?.closest?.("a");
  if (!link) return;

  const pfad = pdfPfadAusLink(link);
  if (!pfad) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  kontextmenuOeffnen(event.clientX, event.clientY, pfad);
}

// Plattformabhängige Menü-Beschriftung (Finder auf macOS, sonst Explorer).
const istMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
const EXPLORER_LABEL = istMac ? "Im Finder anzeigen" : "Im Explorer anzeigen";

// Log ins Logseq-Hauptfenster (statt ins iframe), damit Meldungen in derselben
// Console landen, die der Nutzer ohnehin offen hat.
function hauptLog(...args) {
  try { window.parent.console.log("[MultiPdfViewer]", ...args); }
  catch (e) { console.log("[MultiPdfViewer]", ...args); }
}

// Die in Frage kommenden Host-Fenster (Logseq-Hauptrenderer).
function hostFenster() {
  return [window.parent, window.top, window].filter(Boolean);
}

// Zeigt die zur PDF gehörende Datei im Datei-Manager des Betriebssystems an
// (Finder auf macOS, Explorer auf Windows, Dateimanager auf Linux) und markiert
// sie dort. Logseq ist eine Electron-App; der bewährte Weg ist die generische
// `apis.doAction`-Bridge, über die Logseq selbst seine Assets im Finder zeigt:
//   apis.doAction(["openFileInFolder", pfad])
//     → Main-Prozess-Handler :openFileInFolder → shell.showItemInFolder(pfad).
function imDateiexplorerAnzeigen(url) {
  const pfad = dateipfadAusUrl(url);
  if (!pfad) {
    return logseq.App.showMsg("Datei kann nur für lokale PDFs angezeigt werden.", "warning");
  }

  // (1) Primärer Weg: Logseqs doAction-Bridge.
  for (const win of hostFenster()) {
    let apis;
    try { apis = win.apis; } catch (e) { continue; }
    if (apis && typeof apis.doAction === "function") {
      try {
        const r = apis.doAction(["openFileInFolder", pfad]);
        if (r && typeof r.catch === "function") {
          r.catch((e) => hauptLog("doAction openFileInFolder warf", e && e.message));
        }
        return;
      } catch (e) { hauptLog("doAction openFileInFolder warf", e && e.message); }
    }
  }

  // (2) Fallback für andere Umgebungen: direkter Electron-Zugriff.
  for (const win of hostFenster()) {
    try {
      const req = win.require;
      const electron = typeof req === "function" && req("electron");
      if (electron && electron.shell && typeof electron.shell.showItemInFolder === "function") {
        electron.shell.showItemInFolder(pfad);
        return;
      }
    } catch (e) {}
  }

  hauptLog("Reveal fehlgeschlagen — keine Bridge gefunden", pfad);
  logseq.App.showMsg("Konnte die Datei nicht im Datei-Manager anzeigen.", "error");
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
    .multi-pdf-kontextmenu {
      position: fixed;
      z-index: 9999;
      min-width: 180px;
      padding: 4px;
      background: var(--ls-primary-background-color, #fff);
      color: var(--ls-primary-text-color, #333);
      border: 1px solid var(--ls-border-color, #ccc);
      border-radius: 6px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
      font-size: 13px;
    }
    .multi-pdf-kontextmenu-eintrag {
      padding: 6px 10px;
      cursor: pointer;
      border-radius: 4px;
      white-space: nowrap;
    }
    .multi-pdf-kontextmenu-eintrag:hover {
      background: var(--ls-secondary-background-color, #eee);
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
  // eigenen Viewer öffnet. Capture-phase (`true`) ist hier entscheidend — wir
  // bekommen den Klick auf dem Weg nach unten, vor Logseqs eigenen Handlern.
  try {
    window.parent.document.addEventListener("click", pdfKlickAbfangen, true);
    parentLog("Click-Interceptor aktiv");
  } catch (e) {
    parentLog("Click-Interceptor konnte nicht installiert werden:", e?.message);
  }

  // PDF-Rechtsklicks im Logseq-Hauptdokument abfangen und ein eigenes
  // Kontextmenü ("Im Finder/Explorer anzeigen") zeigen. Ebenfalls capture-phase,
  // damit wir vor Logseqs eigenem Kontextmenü greifen.
  try {
    window.parent.document.addEventListener("contextmenu", pdfKontextmenuAbfangen, true);
    parentLog("Kontextmenü-Interceptor aktiv");
  } catch (e) {
    parentLog("Kontextmenü-Interceptor konnte nicht installiert werden:", e?.message);
  }

  // Sauber aufräumen, wenn das Plugin entladen wird (Logseq beim Reload/Disable).
  logseq.beforeunload(async () => {
    try {
      window.parent.document.removeEventListener("click", pdfKlickAbfangen, true);
      window.parent.document.removeEventListener("contextmenu", pdfKontextmenuAbfangen, true);
      kontextmenuSchliessen();
    } catch (e) {}
  });
}

logseq.ready(main).catch(console.error);

// Werden von ViewerGrid.jsx aufgerufen (Schließen-Button, "+ PDF hinzufügen"-Button, Resize-Handle).
export { viewerSchliessen, pdfAusBlockOeffnen, viewerBreiteSetzen, viewerBreiteLesen, imDateiexplorerAnzeigen, BREITE_MIN, BREITE_MAX };
