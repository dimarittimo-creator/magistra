# Esegue un comando con le chiavi del database di PRODUZIONE (Supabase, Francoforte).
# Le chiavi si leggono al momento dalla CLI di Supabase (serve "npx supabase login") e non si salvano su file.
# Esempi (dal Terminale, nella cartella del progetto):
#   powershell -ExecutionPolicy Bypass -File scripts\con-produzione.ps1 npx.cmd tsx scripts/importa-dati.mts
#   powershell -ExecutionPolicy Bypass -File scripts\con-produzione.ps1 node scripts/crea-admin.mjs nome@dominio.it "Nome Cognome"
param([Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)][string[]]$Comando)
# Gli avvisi della CLI (es. "nuova versione disponibile") non devono fermare lo script
$ErrorActionPreference = "Continue"
$Progetto = "lepykbcqppnqrintlcmu"

$json = (npx.cmd supabase projects api-keys --project-ref $Progetto -o json 2>$null) -join "`n"
$servizio = (($json | ConvertFrom-Json) | Where-Object { $_.name -eq "service_role" }).api_key
if (-not $servizio) { Write-Error "Chiave non trovata: esegui prima 'npx.cmd supabase login'."; exit 1 }

$env:NEXT_PUBLIC_SUPABASE_URL = "https://$Progetto.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = $servizio.Trim()
try {
  & $Comando[0] $Comando[1..($Comando.Length - 1)]
} finally {
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
}
