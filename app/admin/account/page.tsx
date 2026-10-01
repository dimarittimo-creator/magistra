import { richiediStaff } from "@/lib/auth";
import { FormPassword } from "./FormPassword";

export const metadata = { title: "Il mio account" };

export default async function MioAccount() {
  const utente = await richiediStaff();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Il mio account
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted">
          {utente.profilo.nome ? `${utente.profilo.nome} · ` : ""}
          {utente.email} · {utente.profilo.ruolo === "admin" ? "Amministratore" : "Operatore"}
        </p>
      </header>
      <section className="panel p-6" aria-labelledby="t-password">
        <h2 id="t-password" className="text-2xl text-magistra-blu mb-4">
          Cambia password
        </h2>
        <FormPassword />
      </section>
    </div>
  );
}
