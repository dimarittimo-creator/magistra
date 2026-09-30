import Link from "next/link";
import { MenuArea } from "@/components/MenuArea";
import { utenteCorrente } from "@/lib/auth";
import { areaPrivatiAperta } from "@/lib/negozio";
import { creaClientServer } from "@/lib/supabase/server";

export default async function LayoutNegozio({ children }: { children: React.ReactNode }) {
  if (!(await areaPrivatiAperta())) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="panel p-6 sm:p-8">
          <h1 className="text-3xl text-magistra-blu">
            Il negozio aprirà a breve
            <span className="filetto" aria-hidden="true" />
          </h1>
          <p className="mt-5 text-muted">Nel frattempo puoi trovare i nostri integratori nella tua farmacia di fiducia.</p>
          <Link href="/" className="btn btn-secondary mt-6">Torna alla home</Link>
        </div>
      </div>
    );
  }
  const utente = await utenteCorrente();
  const privato = utente?.profilo?.ruolo === "privato" && utente.profilo.privato_id;
  let articoli = 0;
  if (privato) {
    const db = await creaClientServer();
    const { data } = await db.from("carrello_privati").select("quantita").eq("privato_id", utente!.profilo!.privato_id!);
    articoli = (data ?? []).reduce((s, r) => s + r.quantita, 0);
  }
  const voci = [
    { href: "/negozio", testo: "Negozio", esatta: true },
    ...(privato
      ? [
          { href: "/negozio/carrello", testo: articoli ? `Carrello (${articoli})` : "Carrello" },
          { href: "/negozio/ordini", testo: "I miei ordini" },
          { href: "/negozio/profilo", testo: "Il mio profilo" },
        ]
      : [{ href: "/accesso?area=privati", testo: "Accedi o crea un account" }]),
  ];
  return (
    <>
      <MenuArea etichetta="Negozio" voci={voci} />
      {children}
    </>
  );
}
