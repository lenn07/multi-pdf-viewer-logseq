import "@logseq/libs";

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

// Liest den aktuell in Logseq aktiven Block, sucht darin einen PDF-Link
// (Markdown-Format `[label](pfad.pdf)`), öffnet den Viewer und schickt die
// PDF-URL per Custom Event an die ViewerGrid-Komponente.
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

  const relativerPfad = treffer[1];
  const graph = await logseq.App.getCurrentGraph();
  const bereinigt = relativerPfad.replace(/^\.\.\//, "");
  const vollerPfad = `${graph.path}/${bereinigt}`;
  const dateiname = bereinigt.split("/").pop();

  viewerOeffnen();

  window.dispatchEvent(
    new CustomEvent("pdf-oeffnen", {
      detail: { url: `file://${vollerPfad}`, titel: dateiname },
    })
  );
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

  function themeAnwenden() {
    logseq.App.getUserConfigs()
      .then((configs) => {
        document.body.classList.toggle(
          "dark",
          configs.preferredThemeMode === "dark"
        );
      })
      .catch((e) => console.error("Theme-Erkennung fehlgeschlagen:", e));
  }
  themeAnwenden();
  logseq.App.onThemeChanged(themeAnwenden);
}

logseq.ready(main).catch(console.error);

// Werden von ViewerGrid.jsx aufgerufen (Schließen-Button, "+ PDF hinzufügen"-Button, Resize-Handle).
export { viewerSchliessen, pdfAusBlockOeffnen, viewerBreiteSetzen, viewerBreiteLesen, BREITE_MIN, BREITE_MAX };
