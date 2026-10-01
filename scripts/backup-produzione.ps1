# Copia di sicurezza del database di PRODUZIONE sul computer (oltre ai backup giornalieri di Supabase).
# Crea Documenti\Magistra-backup\<data>\schema.sql e dati.sql (fuori da Git: contengono dati personali e IBAN).
# Serve Docker Desktop aperto e "npx supabase login" già fatto.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\backup-produzione.ps1
$ErrorActionPreference = "Continue"
$env:Path += ";$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin"
$cartella = Join-Path $env:USERPROFILE ("Documents\Magistra-backup\" + (Get-Date -Format "yyyy-MM-dd"))
New-Item -ItemType Directory -Force $cartella | Out-Null

npx.cmd supabase db dump --linked --schema public,auth -f "$cartella\schema.sql"
npx.cmd supabase db dump --linked --data-only --schema public,auth --use-copy -f "$cartella\dati.sql"

Get-ChildItem $cartella | Select-Object Name, @{ n = "KB"; e = { [math]::Round($_.Length / 1KB) } } | Format-Table -AutoSize
Write-Host "Copia salvata in $cartella. Conservala anche fuori dal computer (chiavetta o cloud aziendale)."
