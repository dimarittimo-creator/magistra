import { Fragment } from "react";
import { formattaData } from "@/lib/formato";
import type { DocumentoLegale } from "@/lib/documenti-legali";

// Mostra un testo legale scritto dall'admin in forma semplice:
// paragrafi separati da una riga vuota, **grassetto**, elenchi numerati "1. …".
export function TestoLegale({ documento }: { documento: DocumentoLegale }) {
  const blocchi = documento.testo.split(/\n\s*\n/);
  return (
    <article className="space-y-4">
      {documento.provvisorio && (
        <p className="avviso avviso-attenzione font-semibold">
          Testo provvisorio: la versione definitiva sarà pubblicata dopo la revisione legale.
        </p>
      )}
      {blocchi.map((blocco, i) => {
        const righe = blocco.split("\n").map((r) => r.trim()).filter(Boolean);
        if (righe.length && righe.every((r) => /^\d+\.\s/.test(r))) {
          return (
            <ol key={i} className="list-decimal pl-6 space-y-2">
              {righe.map((r, j) => (
                <li key={j}>{grassetto(r.replace(/^\d+\.\s/, ""))}</li>
              ))}
            </ol>
          );
        }
        return <p key={i}>{grassetto(righe.join(" "))}</p>;
      })}
      <p className="text-sm text-muted">
        Versione {documento.versione} in vigore dal {formattaData(documento.in_vigore_dal)}
      </p>
    </article>
  );
}

function grassetto(testo: string) {
  return testo.split(/\*\*(.+?)\*\*/g).map((parte, i) =>
    i % 2 === 1 ? <strong key={i}>{parte}</strong> : <Fragment key={i}>{parte}</Fragment>,
  );
}
