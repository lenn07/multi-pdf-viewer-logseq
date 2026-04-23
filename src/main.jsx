import "@logseq/libs";

import React from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import ViewerGrid from "./components/ViewerGrid";

// Logseqs eigenes Layout per CSS anpassen (außerhalb des Plugin-Iframes).
// Die Klasse 'pdf-viewer-open' auf dem body-Element gibt Logseq einen rechten Abstand
// von 40vw — sein Inhalt rückt links zusammen und unser Viewer hat Platz.
function viewerOeffnen() {
  logseq.showMainUI();
  try {
    window.parent.document.body.classList.add("pdf-viewer-open");
  } catch (e) {}
}

function viewerSchliessen() {
  logseq.hideMainUI();
  try {
    window.parent.document.body.classList.remove("pdf-viewer-open");
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

  // CSS in Logseq injizieren: wenn 'pdf-viewer-open' aktiv ist, schiebt Logseq
  // seinen Inhalt nach links — alle Elemente (Navigation, Toolbar, Seiten) bleiben sichtbar.
  logseq.provideStyle(`
    body.pdf-viewer-open {
      padding-right: 40vw !important;
      box-sizing: border-box !important;
    }
  `);

  logseq.provideModel({
    openViewer: viewerOeffnen,
  });

  logseq.setMainUIInlineStyle({
    zIndex: 11,
    position: "fixed",
    top: "0",
    left: "60vw",
    width: "40vw",
    height: "100vh",
  });

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

// Werden von ViewerGrid.jsx aufgerufen (Schließen-Button bzw. "+ PDF hinzufügen"-Button).
export { viewerSchliessen, pdfAusBlockOeffnen };
