import { MenuArea } from "@/components/MenuArea";
import { richiediStaff } from "@/lib/auth";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const utente = await richiediStaff();
  const admin = utente.profilo.ruolo === "admin";
  const voci = [
    { href: "/admin", testo: "Cruscotto", esatta: true },
    { href: "/admin/ordini", testo: "Ordini" },
    { href: "/admin/farmacie", testo: "Farmacie" },
    ...(admin
      ? [
          { href: "/admin/gruppi", testo: "Gruppi" },
          { href: "/admin/societa", testo: "Società" },
          { href: "/admin/sedi", testo: "Sedi e depositi" },
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
