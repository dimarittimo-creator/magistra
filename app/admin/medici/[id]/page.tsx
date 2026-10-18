import Link from "next/link";
import { notFound } from "next/navigation";
import { StoricoModifiche } from "@/components/admin/StoricoModifiche";
import { richiediStaff } from "@/lib/auth";
import { formattaData, formattaDataOra } from "@/lib/formato";
import { STATI_CAMPIONE } from "@/lib/medici/contenuti";
import { STATI_MEDICO, valoriMedico } from "@/lib/medici/dati";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";
import { AzioniStatoMedico, FormDatiMedicoAdmin } from "./ModuliMedico";

export const metadata = { title: "Scheda medico" };

const ETICHETTE_CAMPI: Record<string, string> = {
  nome: "Nome",
  cognome: "Cognome",
  specializzazione: "Specializzazione",
  numero_iscrizione: "Numero di iscrizione",
  ordine_provincia: "Provincia dell'Ordine",
  email: "Email",
  telefono: "Telefono",
  struttura: "Studio o struttura",
  presso: "Presso",
  indirizzo: "Indirizzo",
  cap: "CAP",
  citta: "Città",
  provincia: "Provincia",
  stato: "Stato",
  approvato_da: "Approvato da",
  approvato_il: "Approvato il",
  bloccato_il: "Bloccato il",
  motivo_blocco: "Motivo del blocco",
  note_admin: "Note interne",
};

const ETICHETTE_CONSENSI: Record<string, string> = { privacy: "Informativa privacy", marketing: "Comunicazioni" };

export default async function SchedaMedico({ params }: { params: Promise<{ id: string }> }) {
  const utente = await richiediStaff();
  const admin = utente.profilo.ruolo === "admin";
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await creaClientServer();
  const [{ data: medico }, { data: profilo }, { data: campioni }] = await Promise.all([
    db.from("medici").select("*").eq("id", id).maybeSingle(),
    db.from("profili_utente").select("id").eq("medico_id", id).maybeSingle(),
    db.from("richieste_campioni").select("id, prodotto_nome, quantita, stato, creato_il").eq("medico_id", id).order("creato_il", { ascending: false }).limit(20),
  ]);
  if (!medico) notFound();

  let account: { email?: string; confermata: boolean; ultimoAccesso?: string | null } | null = null;
  let consensi: { tipo: string; accettato: boolean; versione_documento: number | null; ip: string | null; il: string }[] = [];
  if (profilo) {
    const { data } = await creaClientAdmin().auth.admin.getUserById(profilo.id);
    if (data.user) account = { email: data.user.email, confermata: !!data.user.email_confirmed_at, ultimoAccesso: data.user.last_sign_in_at };
    const { data: c } = await db.from("consensi").select("tipo, accettato, versione_documento, ip, il").eq("utente_id", profilo.id).order("il", { ascending: false });
    consensi = c ?? [];
  }
  const etichetta = STATI_MEDICO[medico.stato];

  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/medici">← Tutti i medici</Link>
      </p>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl text-magistra-blu">
            Dott. {medico.nome} {medico.cognome}
            <span className="filetto" aria-hidden="true" />
          </h1>
          <p className="mt-3 text-muted">
            Richiesta del {formattaData(medico.creato_il)}
            {medico.approvato_il && ` · approvato il ${formattaData(medico.approvato_il)}`}
            {medico.bloccato_il && ` · non attivo dal ${formattaData(medico.bloccato_il)}`}
          </p>
        </div>
        <span className={`pill ${etichetta.classe} text-base`}>{etichetta.testo}</span>
      </header>

      {medico.stato === "bloccato" && medico.motivo_blocco && <p className="avviso avviso-errore">Motivo: {medico.motivo_blocco}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-6" aria-labelledby="titolo-dati">
          <h2 id="titolo-dati" className="text-2xl text-magistra-blu">Dati</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-2 grid-cols-[max-content_1fr] text-sm">
            <dt className="text-muted">Specializzazione</dt><dd>{medico.specializzazione}</dd>
            <dt className="text-muted">Iscrizione</dt><dd>Ordine di {medico.ordine_provincia}, n. {medico.numero_iscrizione}</dd>
            <dt className="text-muted">Email</dt><dd>{medico.email}</dd>
            <dt className="text-muted">Telefono</dt><dd>{medico.telefono}</dd>
            <dt className="text-muted">Studio</dt>
            <dd>{[medico.struttura, medico.presso, medico.indirizzo, `${medico.cap} ${medico.citta} (${medico.provincia})`].filter(Boolean).join(", ")}</dd>
            {medico.note_admin && (<><dt className="text-muted">Note interne</dt><dd>{medico.note_admin}</dd></>)}
          </dl>
        </section>

        <section className="panel p-6 space-y-4" aria-labelledby="titolo-account">
          <h2 id="titolo-account" className="text-2xl text-magistra-blu">Account e consensi</h2>
          {account ? (
            <dl className="grid gap-x-6 gap-y-2 grid-cols-[max-content_1fr] text-sm">
              <dt className="text-muted">Accede con</dt><dd>{account.email}</dd>
              <dt className="text-muted">Email confermata</dt>
              <dd>{account.confermata ? <span className="pill pill-ok">Sì</span> : <span className="pill pill-warn">Non ancora</span>}</dd>
              <dt className="text-muted">Ultimo accesso</dt>
              <dd>{account.ultimoAccesso ? formattaDataOra(account.ultimoAccesso) : "mai"}</dd>
            </dl>
          ) : (
            <p className="text-muted">Nessun account di accesso collegato.</p>
          )}
          {consensi.length > 0 && (
            <div className="overflow-x-auto">
              <table className="tabella text-sm min-w-[420px]">
                <thead>
                  <tr><th>Consenso</th><th>Scelta</th><th>Versione</th><th>Data</th></tr>
                </thead>
                <tbody>
                  {consensi.map((c, i) => (
                    <tr key={i}>
                      <td>{ETICHETTE_CONSENSI[c.tipo] ?? c.tipo}</td>
                      <td>{c.accettato ? "Accettato" : "Non accettato"}</td>
                      <td>{c.versione_documento ?? "—"}</td>
                      <td title={c.ip ? `IP ${c.ip}` : undefined}>{formattaDataOra(c.il)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="panel p-6" aria-labelledby="titolo-campioni">
        <h2 id="titolo-campioni" className="text-2xl text-magistra-blu">Richieste di campioni</h2>
        {campioni?.length ? (
          <ul className="mt-3 text-sm space-y-1">
            {campioni.map((c) => (
              <li key={c.id}>
                {formattaData(c.creato_il)} · {c.prodotto_nome} × {c.quantita} · <span className={`pill ${STATI_CAMPIONE[c.stato].classe}`}>{c.stato === "nuova" ? "Nuova" : STATI_CAMPIONE[c.stato].testo}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">Nessuna richiesta.</p>
        )}
      </section>

      {admin && (
        <>
          <section className="panel p-6" aria-labelledby="titolo-stato">
            <h2 id="titolo-stato" className="text-2xl text-magistra-blu mb-4">Accesso all&apos;area Medici</h2>
            <p className="text-sm text-muted mb-4">
              Verifica il numero di iscrizione sull&apos;albo pubblico FNOMCeO prima di approvare.
            </p>
            {account && !account.confermata && medico.stato === "in_attesa" && (
              <p className="avviso avviso-attenzione mb-4">
                Il medico non ha ancora confermato l&apos;email: puoi approvarlo lo stesso, ma potrà accedere solo dopo la conferma.
              </p>
            )}
            <AzioniStatoMedico id={medico.id} stato={medico.stato} />
          </section>

          <details className="panel p-6">
            <summary className="cursor-pointer text-2xl font-serif text-magistra-blu">Correggi i dati del medico</summary>
            <div className="mt-6">
              <FormDatiMedicoAdmin id={medico.id} valoriIniziali={valoriMedico(medico)} noteAdmin={medico.note_admin ?? ""} />
            </div>
          </details>

          <StoricoModifiche
            tabella="medici"
            recordId={medico.id}
            etichette={ETICHETTE_CAMPI}
            valoriLeggibili={{ stato: { in_attesa: "In attesa", attivo: "Attivo", bloccato: "Non attivo" } }}
          />
        </>
      )}
    </div>
  );
}
