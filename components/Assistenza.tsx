"use client";

import { createContext, useContext } from "react";

// Email dell'assistenza resa disponibile ai moduli (EsitoModulo) senza passarla a mano in ogni pagina.
const ContestoAssistenza = createContext<string | null>(null);

export function AssistenzaProvider({ email, children }: { email: string | null; children: React.ReactNode }) {
  return <ContestoAssistenza.Provider value={email}>{children}</ContestoAssistenza.Provider>;
}

export function useEmailAssistenza() {
  return useContext(ContestoAssistenza);
}
