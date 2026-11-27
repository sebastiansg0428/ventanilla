const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WRAPPER = path.join(ROOT, 'scripts', 'run-visual-tests.cjs');
const VISUAL_ARGS = ['--project=mobile-320', '--grep=login conserva formulario'];

function ejecutarPowerShell(script, argumentos = []) {
    return execFileSync('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script
    ], {
        encoding: 'utf8',
        windowsHide: true,
        env: { ...process.env, VISUAL_PS_ARG0: argumentos[0] || '' }
    }).trim();
}

function descendientesDe(pid) {
    const script = [
        '$root=[int]$env:VISUAL_PS_ARG0',
        '$all=@(Get-CimInstance Win32_Process)',
        '$seen=New-Object System.Collections.Generic.HashSet[int]',
        '$null=$seen.Add($root)',
        '$changed=$true',
        'while($changed){$changed=$false;foreach($p in $all){if($seen.Contains([int]$p.ParentProcessId) -and $seen.Add([int]$p.ProcessId)){$changed=$true}}}',
        '@($all | Where-Object {$seen.Contains([int]$_.ProcessId) -and $_.ProcessId -ne $root} | Select-Object -ExpandProperty ProcessId) -join ","'
    ].join(';');
    const resultado = ejecutarPowerShell(script, [String(pid)]);
    return resultado ? resultado.split(',').filter(Boolean).map(Number) : [];
}

function socketsActivosEnPuerto() {
    const script = [
        '$rows=@(Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object {',
        '($_.LocalAddress -eq "127.0.0.1" -and $_.LocalPort -eq 5173) -or',
        '($_.RemoteAddress -eq "127.0.0.1" -and $_.RemotePort -eq 5173)',
        '} | Where-Object {$_.State -notin @("TimeWait","CloseWait")});',
        '@($rows | ForEach-Object {"$($_.OwningProcess):$($_.State):$($_.LocalAddress):$($_.LocalPort):$($_.RemoteAddress):$($_.RemotePort)"}) -join [Environment]::NewLine'
    ].join(' ');
    const resultado = ejecutarPowerShell(script);
    return resultado ? resultado.split(/\r?\n/) : [];
}

function ejecutarWrapper() {
    return new Promise((resolve, reject) => {
        const salida = [];
        const proceso = spawn(process.execPath, [WRAPPER, ...VISUAL_ARGS], {
            cwd: ROOT,
            env: { ...process.env, VISUAL_PROCESS_DIAGNOSTICS: '1' },
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });
        const capturar = stream => stream.on('data', datos => salida.push(datos.toString()));
        capturar(proceso.stdout);
        capturar(proceso.stderr);
        proceso.once('error', reject);
        proceso.once('close', (code, signal) => resolve({ code, signal, salida: salida.join('') }));
    });
}

async function main() {
    const resultado = await ejecutarWrapper();
    const texto = resultado.salida;
    const pids = [...texto.matchAll(/\[visual\] (vite|playwright) pid=(\d+)/g)]
        .map(match => ({ tipo: match[1], pid: Number(match[2]) }));

    if (resultado.code !== 0) {
        throw new Error('El caso aislado terminó con código ' + (resultado.code ?? 'desconocido') + '.\n' + texto);
    }
    if (!pids.length) throw new Error('No se registraron los PID propios.\n' + texto);

    const restos = pids.flatMap(({ tipo, pid }) => (
        descendientesDe(pid).map(descendiente => tipo + ':' + descendiente)
    ));
    const sockets = socketsActivosEnPuerto();
    if (restos.length) throw new Error('Quedaron descendientes propios: ' + restos.join(', '));
    if (sockets.length) {
        throw new Error('Quedaron sockets activos en 127.0.0.1:5173:\n' + sockets.join('\n'));
    }

    console.log('OK: caso aislado terminó con código 0; PID propios registrados: ' +
        pids.map(item => item.tipo + '=' + item.pid).join(', ') + '.');
    console.log('OK: no quedaron descendientes propios ni sockets HTTP activos en 127.0.0.1:5173.');
    console.log('OK: conexiones TIME_WAIT y Vite externo en [::1]:5173 quedan fuera.');
}

main().catch(error => {
    console.error('FALLO DE LIMPIEZA VISUAL: ' + error.message);
    process.exitCode = 1;
});
