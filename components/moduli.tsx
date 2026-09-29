"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

// Elementi comuni dei moduli: etichetta sempre visibile, errore sotto il campo
// collegato con aria-describedby, pulsante che si disattiva durante l'invio.

type CampoProps = {
  nome: string;
  etichetta: string;
  errore?: string;
  aiuto?: string;
  valore?: string;
  tipo?: string;
  obbligatorio?: boolean;
  autoComplete?: string;
  maiuscolo?: boolean;
  disabilitato?: boolean;
  className?: string;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "email" | "tel";
};

export function Campo(p: CampoProps) {
  const id = `campo-${p.nome}`;
  const descrizione = [p.errore ? `${id}-errore` : null, p.aiuto ? `${id}-aiuto` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={p.className}>
      <label htmlFor={id} className="etichetta">
        {p.etichetta}
        {p.obbligatorio && <span className="text-danger" aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        name={p.nome}
        type={p.tipo ?? "text"}
        defaultValue={p.valore}
        required={p.obbligatorio}
        autoComplete={p.autoComplete}
        disabled={p.disabilitato}
        maxLength={p.maxLength}
        inputMode={p.inputMode}
        aria-invalid={p.errore ? true : undefined}
        aria-describedby={descrizione}
        className={`input ${p.maiuscolo ? "uppercase" : ""}`}
      />
      {p.aiuto && (
        <p id={`${id}-aiuto`} className="aiuto">
          {p.aiuto}
        </p>
      )}
      {p.errore && (
        <p id={`${id}-errore`} className="errore-campo">
          {p.errore}
        </p>
      )}
    </div>
  );
}

export function CampoPassword(p: Omit<CampoProps, "tipo">) {
  const [visibile, setVisibile] = useState(false);
  const id = `campo-${p.nome}`;
  return (
    <div className={p.className}>
      <label htmlFor={id} className="etichetta">
        {p.etichetta}
        {p.obbligatorio && <span className="text-danger" aria-hidden="true"> *</span>}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name={p.nome}
          type={visibile ? "text" : "password"}
          required={p.obbligatorio}
          autoComplete={p.autoComplete}
          aria-invalid={p.errore ? true : undefined}
          aria-describedby={p.errore ? `${id}-errore` : p.aiuto ? `${id}-aiuto` : undefined}
          className="input flex-1"
        />
        <button
          type="button"
          className="btn btn-secondary px-3 text-sm"
          onClick={() => setVisibile((v) => !v)}
          aria-pressed={visibile}
          aria-controls={id}
        >
          {visibile ? "Nascondi" : "Mostra"}
        </button>
      </div>
      {p.aiuto && (
        <p id={`${id}-aiuto`} className="aiuto">
          {p.aiuto}
        </p>
      )}
      {p.errore && (
        <p id={`${id}-errore`} className="errore-campo">
          {p.errore}
        </p>
      )}
    </div>
  );
}

export function Casella(p: {
  nome: string;
  children: React.ReactNode;
  errore?: string;
  selezionata?: boolean;
  obbligatoria?: boolean;
  onChange?: (v: boolean) => void;
}) {
  const id = `campo-${p.nome}`;
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-3 cursor-pointer">
        <input
          id={id}
          name={p.nome}
          type="checkbox"
          defaultChecked={p.selezionata}
          required={p.obbligatoria}
          onChange={p.onChange ? (e) => p.onChange!(e.target.checked) : undefined}
          aria-invalid={p.errore ? true : undefined}
          aria-describedby={p.errore ? `${id}-errore` : undefined}
          className="mt-1 size-5 shrink-0 accent-[var(--brand)]"
        />
        <span>{p.children}</span>
      </label>
      {p.errore && (
        <p id={`${id}-errore`} className="errore-campo ml-8">
          {p.errore}
        </p>
      )}
    </div>
  );
}

export function PulsanteInvio({
  children,
  inCorso = "Invio in corso…",
  variante = "primary",
  className = "",
}: {
  children: React.ReactNode;
  inCorso?: string;
  variante?: "primary" | "secondary";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={`btn btn-${variante} ${className}`}>
      {pending ? inCorso : children}
    </button>
  );
}

/** Messaggio generale del modulo: verde se ok, rosso se errore. Annunciato ai lettori di schermo. */
export function EsitoModulo({ ok, messaggio }: { ok?: boolean; messaggio?: string }) {
  if (!messaggio) return null;
  return (
    <p role={ok ? "status" : "alert"} className={`avviso ${ok ? "avviso-ok" : "avviso-errore"}`}>
      {messaggio}
    </p>
  );
}
