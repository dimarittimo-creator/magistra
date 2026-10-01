# Crea un amministratore sul database di PRODUZIONE (Supabase, Francoforte).
# Le chiavi si leggono al momento dalla CLI di Supabase (serve "npx supabase login"): non si salvano su file.
# La password provvisoria compare solo in questo terminale, una volta.
# Uso (dal Terminale, nella cartella del progetto):
#   powershell -ExecutionPolicy Bypass -File scripts\crea-admin-produzione.ps1 nome@dominio.it "Nome Cognome"
param(
  [Parameter(Mandatory = $true)][string]$Email,
  [string]$Nome = "",
  [string]$Progetto = "lepykbcqppnqrintlcmu"
)
# Gli avvisi della CLI (es. "nuova versione disponibile") non devono fermare lo script
$ErrorActionPreference = "Continue"

$json = (npx.cmd supabase projects api-keys --project-ref $Progetto -o json 2>$null) -join "`n"
$servizio = (($json | ConvertFrom-Json) | Where-Object { $_.name -eq "service_role" }).api_key
if (-not $servizio) { Write-Error "Chiave non trovata: esegui prima 'npx.cmd supabase login'."; exit 1 }

$env:NEXT_PUBLIC_SUPABASE_URL = "https://$Progetto.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = $servizio.Trim()
try {
  node scripts/crea-admin.mjs $Email $Nome
} finally {
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
}
