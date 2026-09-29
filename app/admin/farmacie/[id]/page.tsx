import Link from "next/link";
import { notFound } from "next/navigation";
import { StoricoModifiche } from "@/components/admin/StoricoModifiche";
import { richiediStaff } from "@/lib/auth";
import { formattaData, formattaDataOra } from "@/lib/formato";
import { ETICHETTE_STATO, formattaIndirizzo, indirizzoDi, leggiFarmacia, valoriFarmacia } from "@/lib/farmacie/lettura";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";
import { AzioniStato, FormCondizioni, FormDatiAdmin } from "./ModuliFarmacia";

export const metadata = { title: "Scheda farmacia" };

const ETICHETTE_CAMPI: Record<string, string> = {
  ragione_sociale: "Ragione sociale",
  titolare: "Titolare",
  partita_iva: "Partita IVA",
  codice_fiscale: "Codice fiscale",
  codice_farmacia: "Codice farmacia",
  sdi: "SDI",
  pec: "PEC",
  email: "Email",
  telefono: "Telefono",
  stato: "Stato",
  gruppo_id: "Gruppo",
  societa_predefinita_id: "Società predefinita",
  approvata_da: "Approvata da",
  approvata_il: "Approvata il",
  bloccata_il: "Bloccata il",
  motivo_blocco: "Motivo del blocco",
  note_admin: "Note interne",
};

const ETICHETTE_CONSENSI: Record<string, string> = {
  privacy: "Informativa privacy",
  condizioni_vendita_farmacie: "Condizioni di vendita farmacie",
  marketing: "Comunicazioni commerciali",
};

export default async function SchedaFarmacia({ params }: { params: Promise<{ id: string }> }) {
  const utente = await richiediStaff();
  const admin = utente.profilo.ruolo === "admin";
  const { id } = await params;
  const db = await creaClientServer();
  const farmacia = await leggiFarmacia(db, id);
  if (!farmacia) notFound();

  const [{ data: gruppi }, { data: societa }, { data: profilo }] = await Promise.all([
    db.from("gruppi").select("id, nome, attivo").order("nome"),
    db.from("societa").select("id, nome_breve, predefinita").eq("attiva", true).eq("attiva_farmacie", true).order("nome_breve"),
    db.from("profili_utente").select("id").eq("farmacia_id", id).maybeSingle(),
  ]);

  // Account di accesso: email di login e conferma dell'indirizzo (solo lettura, dal server).
  let account: { email?: string; confermata: boolean; ultimoAccesso?: string | null } | null = null;
  let consensi: { tipo: string; accettato: boolean; versione_documento: number | null; ip: string | null; il: string }[] = [];
  if (profilo) {
    const { data } = await creaClientAdmin().auth.admin.getUserById(profilo.id);
    if (data.user) account = { email: data.user.email, confermata: !!data.user.email_confirmed_at, ultimoAccesso: data.user.last_sign_in_at };
    const { data: c } = await db
      .from("consensi")
      .select("tipo, accettato, versione_documento, ip, il")
      .eq("utente_id", profilo.id)
      .order("il", { ascending: false });
    consensi = c ?? [];
  }

  const etichettaStato = ETICHETTE_STATO[farmacia.stato];
  const nomiGruppi = Object.fromEntries((gruppi ?? []).map((g) => [g.id, g.nome]));
  const nomiSocieta = Object.fromEntries((societa ?? []).map((s) => [s.id, s.nome_breve]));

  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/farmacie">← Tutte le farmacie</Link>
      </p>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl text-magistra-blu">
            {farmacia.ragione_sociale}
            <span className="filetto" aria-hidden="true" />
          </h1>
          <p className="mt-3 text-muted">
            Iscrizione del {formattaData(farmacia.creato_il)}
            {farmacia.approvata_il && ` · approvata il ${formattaData(farmacia.approvata_il)}`}
            {farmacia.bloccata_il && ` · bloccata il ${formattaData(farmacia.bloccata_il)}`}
          </p>
        </div>
        <span className={`pill ${etichettaStato.classe} text-base`}>{etichettaStato.testo}</span>
      </header>

      {farmacia.stato === "bloccata" && farmacia.motivo_blocco && (
        <p className="avviso avviso-errore">Motivo del blocco: {farmacia.motivo_blocco}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-6" aria-labelledby="titolo-anagrafica">
          <h2 id="titolo-anagrafica" className="text-2xl text-magistra-blu">Dati</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-2 grid-cols-[max-content_1fr] text-sm">
            <dt className="text-muted">Titolare</dt><dd>{farmacia.titolare}</dd>
            <dt className="text-muted">Partita IVA</dt><dd>{farmacia.partita_iva}</dd>
            <dt className="text-muted">Codice fiscale</dt><dd>{farmacia.codice_fiscale}</dd>
            <dt className="text-muted">Codice farmacia</dt><dd>{farmacia.codice_farmacia}</dd>
            <dt className="text-muted">SDI</dt><dd>{farmacia.sdi ?? "—"}</dd>
            <dt className="text-muted">PEC</dt><dd>{farmacia.pec ?? "—"}</dd>
            <dt className="text-muted">Email</dt><dd>{farmacia.email}</dd>
            <dt className="text-muted">Telefono</dt><dd>{farmacia.telefono}</dd>
            <dt className="text-muted">Consegna</dt><dd>{formattaIndirizzo(indirizzoDi(farmacia, "consegna"))}</dd>
            <dt className="text-muted">Fatturazione</dt><dd>{formattaIndirizzo(indirizzoDi(farmacia, "fatturazione"))}</dd>
          </dl>
        </section>

        <section className="panel p-6 space-y-4" aria-labelledby="titolo-account">
          <h2 id="titolo-account" className="text-2xl text-magistra-blu">Account e consensi</h2>
          {account ? (
            <dl className="grid gap-x-6 gap-y-2 grid-cols-[max-content_1fr] text-sm">
              <dt className="text-muted">Accede con</dt><dd>{account.email}</dd>
              <dt className="text-muted">Email confermata</dt>
              <dd>
                {account.confermata ? (
                  <span className="pill pill-ok">Sì</span>
                ) : (
                  <span className="pill pill-warn">Non ancora</span>
                )}
              </dd>
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
                  <tr>
                    <th>Consenso</th>
                    <th>Scelta</th>
                    <th>Versione</th>
                    <th>Data</th>
                  </tr>
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

      {admin && (
        <>
          <section className="panel p-6" aria-labelledby="titolo-stato">
            <h2 id="titolo-stato" className="text-2xl text-magistra-blu mb-4">Iscrizione</h2>
            {account && !account.confermata && farmacia.stato === "in_attesa" && (
              <p className="avviso avviso-attenzione mb-4">
                La farmacia non ha ancora confermato l&apos;email: puoi approvarla lo stesso, ma potrà accedere solo dopo la
                conferma.
              </p>
            )}
            <AzioniStato id={farmacia.id} stato={farmacia.stato} />
          </section>

          <section className="panel p-6" aria-labelledby="titolo-condizioni">
            <h2 id="titolo-condizioni" className="text-2xl text-magistra-blu mb-4">Gruppo e società</h2>
            <FormCondizioni
              id={farmacia.id}
              valori={{
                gruppo_id: farmacia.gruppo_id ?? "",
                societa_predefinita_id: farmacia.societa_predefinita_id ?? "",
                note_admin: farmacia.note_admin ?? "",
              }}
              gruppi={gruppi ?? []}
              societa={societa ?? []}
            />
          </section>

          <details className="panel p-6 group">
            <summary className="cursor-pointer text-2xl font-serif text-magistra-blu">Correggi i dati della farmacia</summary>
            <div className="mt-6">
              <FormDatiAdmin id={farmacia.id} valoriIniziali={valoriFarmacia(farmacia)} />
            </div>
          </details>

          <StoricoModifiche
            tabella="farmacie"
            recordId={farmacia.id}
            etichette={ETICHETTE_CAMPI}
            valoriLeggibili={{
              gruppo_id: nomiGruppi,
              societa_predefinita_id: nomiSocieta,
              stato: { in_attesa: "In attesa", attiva: "Attiva", bloccata: "Bloccata" },
            }}
          />
        </>
      )}
    </div>
  );
}
