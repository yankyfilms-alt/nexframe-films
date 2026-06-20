# ============================================================
# DIAGNOSTICO NEXFRAME FILMS - GRANOSCAR
# Ejecutar desde la raiz del proyecto NEXFRAME FILMS
# Uso: powershell -ExecutionPolicy Bypass -File diagnostico-nexframe.ps1
# ============================================================

$ErrorActionPreference = "SilentlyContinue"
$reportPath = ".\nexframe-diagnostico-reporte.txt"
$script:report = @()

function Log($titulo, $contenido) {
    $script:report += "`n========== $titulo =========="
    $script:report += $contenido
    Write-Host "`n[OK] $titulo revisado" -ForegroundColor Cyan
}

Write-Host "Iniciando diagnostico de NEXFRAME FILMS..." -ForegroundColor Yellow

$estructura = @()
$archivosClave = @(
    "src\App.jsx",
    "server.js",
    "src\lib\store.js",
    "src\data\models.js",
    "src\data\models-registry.js",
    "src\data\muapiRegistry.js",
    "package.json",
    ".env"
)
foreach ($f in $archivosClave) {
    if (Test-Path $f) {
        $size = (Get-Item $f).Length
        $estructura += "[EXISTE] $f ($size bytes)"
    } else {
        $estructura += "[FALTA!] $f -- ESTO ES PROBLEMA CRITICO"
    }
}
Log "1. ARCHIVOS CLAVE" $estructura

$envCheck = @()
if (Test-Path ".env") {
    $envLines = Get-Content ".env"
    $varsEsperadas = @("MUAPI_KEY", "MUAPI_API_KEY", "PORT", "SESSION_SECRET", "NODE_ENV")
    foreach ($v in $varsEsperadas) {
        $found = $envLines | Where-Object { $_ -match "^$v=" }
        if ($found) {
            $valorLength = ($found -split "=", 2)[1].Length
            if ($valorLength -eq 0) {
                $envCheck += "[VACIO!] $v esta declarada pero SIN VALOR"
            } else {
                $envCheck += "[OK] $v definida ($valorLength caracteres)"
            }
        } else {
            $envCheck += "[NO ENCONTRADA] $v -- revisar si el backend la necesita"
        }
    }
} else {
    $envCheck += "[CRITICO] No existe archivo .env en la raiz del proyecto"
}
Log "2. VARIABLES DE ENTORNO" $envCheck

$puertos = @()
$puertosEsperados = @(5173, 5174, 5175, 5176, 5177, 8787)
foreach ($p in $puertosEsperados) {
    $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $pid_ = $conn[0].OwningProcess
        $proc = Get-Process -Id $pid_ -ErrorAction SilentlyContinue
        $puertos += "[ACTIVO] Puerto $p -- proceso: $($proc.ProcessName) (PID $pid_)"
    } else {
        $puertos += "[LIBRE/INACTIVO] Puerto $p -- nada escuchando aqui"
    }
}
Log "3. PUERTOS (frontend Vite + backend Express)" $puertos

$salud = @()
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:8787/api/health" -TimeoutSec 5 -UseBasicParsing
    $salud += "[OK] /api/health responde -- Status: $($resp.StatusCode)"
    $salud += "Body: $($resp.Content)"
} catch {
    $salud += "[FALLO] /api/health NO responde. Error: $($_.Exception.Message)"
    $salud += "==> Si esto falla, TODOS los paneles van a fallar porque dependen de este backend."
}
Log "4. SALUD DEL BACKEND (/api/health)" $salud

$providersCheck = @()
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:8787/api/muapi/providers" -TimeoutSec 8 -UseBasicParsing
    $providersCheck += "[OK] /api/muapi/providers responde -- Status: $($resp.StatusCode)"
    $providersCheck += "Body (primeros 500 chars): $($resp.Content.Substring(0, [Math]::Min(500, $resp.Content.Length)))"
} catch {
    $providersCheck += "[FALLO] /api/muapi/providers NO responde. Error: $($_.Exception.Message)"
    $providersCheck += "==> Si esto falla, TODOS los paneles de IA (image, video, sound, etc.) fallaran igual."
}
Log "5. PROVIDERS / CONEXION MUAPI" $providersCheck

$registry = @()
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:8787/api/muapi/registry" -TimeoutSec 8 -UseBasicParsing
    $registry += "[OK] /api/muapi/registry responde -- Status: $($resp.StatusCode)"
    $registry += "Tamano de respuesta: $($resp.Content.Length) caracteres"
} catch {
    $registry += "[FALLO] /api/muapi/registry NO responde. Error: $($_.Exception.Message)"
}
Log "6. REGISTRY DE MODELOS" $registry

$auth = @()
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:8787/api/auth/session" -TimeoutSec 5 -UseBasicParsing
    $auth += "[OK] /api/auth/session responde -- Status: $($resp.StatusCode)"
} catch {
    $auth += "[INFO] /api/auth/session devolvio error (puede ser normal si no hay sesion activa): $($_.Exception.Message)"
}
Log "7. AUTENTICACION" $auth

$logs = @()
$posiblesLogs = @("npm-debug.log", "server.log", "logs\server.log", "logs\error.log")
foreach ($lf in $posiblesLogs) {
    if (Test-Path $lf) {
        $logs += "--- Ultimas 20 lineas de $lf ---"
        $logs += Get-Content $lf -Tail 20
    }
}
if ($logs.Count -eq 0) {
    $logs += "[INFO] No se encontraron archivos de log explicitos. Revisa la consola donde corre 'npm run dev:api'."
}
Log "8. LOGS DE SERVIDOR" $logs

$deps = @()
if (Test-Path "node_modules") {
    $depCount = (Get-ChildItem "node_modules" -Directory).Count
    $deps += "[OK] node_modules existe con ~$depCount paquetes"
} else {
    $deps += "[CRITICO] No existe node_modules -- ejecuta 'npm install'"
}
if (Test-Path "package-lock.json") {
    $deps += "[OK] package-lock.json presente"
} else {
    $deps += "[AVISO] No hay package-lock.json -- versiones de dependencias no estan fijadas"
}
Log "9. DEPENDENCIAS" $deps

$seguridad = @()
$archivoSensible = Get-ChildItem -Path . -Recurse -Filter "*MUAPI*UNIVERSAL*.json" -ErrorAction SilentlyContinue
if ($archivoSensible) {
    foreach ($a in $archivoSensible) {
        $rutaRelativa = $a.FullName
        if ($rutaRelativa -match "\\src\\" -or $rutaRelativa -match "\\public\\") {
            $seguridad += "[PELIGRO!] Archivo de API key encontrado DENTRO del frontend: $rutaRelativa"
        } else {
            $seguridad += "[OK] Archivo de API key encontrado fuera de frontend: $rutaRelativa"
        }
    }
} else {
    $seguridad += "[INFO] No se encontro el archivo 'API Key MUAPI UNIVERSAL.json' en el arbol del proyecto"
}
Log "10. SEGURIDAD (API Key expuesta)" $seguridad

$script:report | Out-File -FilePath $reportPath -Encoding utf8
Write-Host "`n`n=================================================" -ForegroundColor Green
Write-Host "DIAGNOSTICO COMPLETO. Reporte guardado en:" -ForegroundColor Green
Write-Host $reportPath -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Green
