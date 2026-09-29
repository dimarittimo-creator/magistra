import { notFound } from "next/navigation";
import { TestoLegale } from "@/components/TestoLegale";
import { documentoCorrente, type TipoDocumentoLegale } from "@/lib/documenti-legali";

export async function PaginaDocumentoLegale({ tipo }: { tipo: TipoDocumentoLegale }) {
  const documento = await documentoCorrente(tipo);
  if (!documento) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="panel p-6 sm:p-10">
        <h1 className="text-3xl text-magistra-blu">
          {documento.titolo}
          <span className="filetto" aria-hidden="true" />
        </h1>
        <div className="mt-6">
          <TestoLegale documento={documento} />
        </div>
      </div>
    </div>
  );
}
