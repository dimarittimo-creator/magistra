"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Menu orizzontale delle aree riservate; su smartphone scorre di lato.
export function MenuArea({ voci, etichetta }: { voci: { href: string; testo: string; esatta?: boolean }[]; etichetta: string }) {
  const percorso = usePathname();
  return (
    <nav aria-label={etichetta} className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-2 sm:px-4 menu-area">
        {voci.map((v) => {
          const attiva = v.esatta ? percorso === v.href : percorso === v.href || percorso.startsWith(`${v.href}/`);
          return (
            <Link key={v.href} href={v.href} aria-current={attiva ? "page" : undefined}>
              {v.testo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
