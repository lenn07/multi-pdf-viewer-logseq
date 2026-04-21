import React, { useState , useEffect} from 'react'
import { createRoot } from 'react-dom/client'
// Das ist eine Komponente — eine Funktion die JSX zurückgibt
// Props werden direkt in den Parametern "destructured"
function PdfCard({ title, seiten }) {
    useEffect(() => {
    // Dieser Code läuft genau einmal, wenn die Komponente erscheint
    console.log(`PdfCard für "${title}" wurde geladen`)
  }, []) // Das leere [] bedeutet: nur einmal ausführen

  return (
    <div style={{ border: '1px solid gray', padding: '10px', margin: '10px' }}>
      <h2>{title}</h2>
      <p>Seiten: {seiten}</p>
    </div>
  )
}

function App() {
  // useState gibt uns: [aktueller Wert, Funktion zum Ändern]
  const [pdfs, setPdfs] = useState(['Dokument A', 'Dokument B'])

  function pdfHinzufügen() {
    setPdfs([...pdfs, 'Neues Dokument'])
  }

  return (
    <div>
      <h1>Meine PDFs ({pdfs.length})</h1>
      <button onClick={pdfHinzufügen}>PDF hinzufügen</button>
      {pdfs.map((name, index) => (
        <PdfCard key={index} title={name} seiten={10} />
      ))}
    </div>
  )
}

const root = createRoot(document.getElementById('app'))
root.render(<App />)