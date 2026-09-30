import { Assistente } from "@/components/chat/Assistente";
import { MenuArea } from "@/components/MenuArea";
import { richiediFarmacia } from "@/lib/auth";
import { creaClientServer } from "@/lib/supabase/server";

export default async function LayoutFarmacia({ children }: { children: React.ReactNode }) {
  const utente = await richiediFarmacia();
  const db = await creaClientServer();
  const [{ data: attiva }, { count }] = await Promise.all([
    db.rpc("farmacia_attiva"),
    db.from("carrello_righe").select("lotto_id", { count: "exact", head: true }).eq("farmacia_id", utente.profilo.farmacia_id ?? ""),
  ]);

  const voci = [
    { href: "/farmacia", testo: "Area riservata", esatta: true },
    ...(attiva
      ? [
          { href: "/farmacia/catalogo", testo: "Catalogo" },
          { href: "/farmacia/carrello", testo: count ? `Carrello (${count})` : "Carrello" },
          { href: "/farmacia/ordini", testo: "I miei ordini" },
        ]
      : []),
    { href: "/farmacia/profilo", testo: "Il mio profilo" },
  ];
  return (
    <>
      <MenuArea etichetta="Area farmacia" voci={voci} />
      {children}
      {attiva ? <Assistente /> : null}
    </>
  );
}
