import Link from "next/link";

const VOCI = [
  { href: "/admin/assistente", testo: "Richieste e conversazioni" },
  { href: "/admin/assistente/domande", testo: "Domande senza risposta" },
  { href: "/admin/assistente/conoscenza", testo: "Base di conoscenza", soloAdmin: true },
];

export function NavAssistente({ attiva, admin }: { attiva: string; admin: boolean }) {
  return (
    <nav aria-label="Sezioni dell'assistente" className="flex flex-wrap gap-2">
      {VOCI.filter((v) => admin || !v.soloAdmin).map((v) => (
        <Link key={v.href} href={v.href} className={`btn btn-piccolo ${v.href === attiva ? "btn-primary" : "btn-secondary"}`} aria-current={v.href === attiva ? "page" : undefined}>
          {v.testo}
        </Link>
      ))}
    </nav>
  );
}
