import { Assistente } from "@/components/chat/Assistente";
import { MenuArea } from "@/components/MenuArea";
import { richiediMedico } from "@/lib/auth";
import { creaClientServer } from "@/lib/supabase/server";

export default async function LayoutMedici({ children }: { children: React.ReactNode }) {
  await richiediMedico();
  const db = await creaClientServer();
  const { data: attivo } = await db.rpc("medico_attivo");

  const voci = [
    { href: "/medici", testo: "Area Medici", esatta: true },
    ...(attivo
      ? [
          { href: "/medici/prodotti", testo: "Schede prodotto" },
          { href: "/medici/materiale", testo: "Materiale scientifico" },
          { href: "/medici/campioni", testo: "Campioni" },
        ]
      : []),
    { href: "/medici/profilo", testo: "Il mio profilo" },
  ];
  return (
    <>
      <MenuArea etichetta="Area medici" voci={voci} />
      {children}
      {attivo ? <Assistente area="medici" /> : null}
    </>
  );
}
