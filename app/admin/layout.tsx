import { MenuArea } from "@/components/MenuArea";
import { richiediStaff } from "@/lib/auth";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const utente = await richiediStaff();
  const admin = utente.profilo.ruolo === "admin";
  // L'operatore gestisce ordini e spedizioni, non le impostazioni commerciali né le società.
  const voci = [
    { href: "/admin", testo: "Cruscotto", esatta: true },
    { href: "/admin/ordini", testo: "Ordini" },
    { href: "/admin/farmacie", testo: "Farmacie" },
    { href: "/admin/privati", testo: "Clienti privati" },
    { href: "/admin/prodotti", testo: "Prodotti" },
    ...(admin
      ? [
          { href: "/admin/fatturazione", testo: "Fatturazione" },
          { href: "/admin/magazzino", testo: "Magazzino" },
          { href: "/admin/sconti", testo: "Sconti e prezzi" },
          { href: "/admin/promozioni", testo: "Promozioni" },
          { href: "/admin/sconti-privati", testo: "Sconti privati" },
          { href: "/admin/area-privati", testo: "Area Privati" },
          { href: "/admin/gruppi", testo: "Gruppi" },
          { href: "/admin/pagamenti", testo: "Pagamenti" },
          { href: "/admin/documenti", testo: "Condizioni e privacy" },
          { href: "/admin/societa", testo: "Società" },
          { href: "/admin/sedi", testo: "Sedi e depositi" },
          { href: "/admin/impostazioni", testo: "Impostazioni" },
          { href: "/admin/registro", testo: "Registro operazioni" },
        ]
      : []),
  ];
  return (
    <>
      <MenuArea etichetta="Amministrazione" voci={voci} />
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </>
  );
}
