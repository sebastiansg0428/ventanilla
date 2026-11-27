const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
let procesoVite;
let procesoPlaywright;
let limpiezaEnCurso;

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function esperarProceso(proceso) {
    return new Promise((resolve, reject) => {
        let finalizado = false;
        const resolver = resultado => {
            if (finalizado) return;
            finalizado = true;
            resolve(resultado);
        };
        proceso.once('error', error => {
            if (finalizado) return;
            finalizado = true;
            reject(error);
        });
        proceso.once('close', (code, signal) => resolver({ code, signal }));
    });
}

async function cerrarRespuesta(respuesta) {
    try {
        await respuesta?.body?.cancel();
    } catch {
        // El cuerpo ya pudo haber sido cerrado por el servidor o por undici.
    }
}

async function esperarVite() {
    const limite = Date.now() + 120_000;
    while (Date.now() < limite) {
        try {
            const respuesta = await fetch('http://127.0.0.1:5173/login.html');
            const disponible = respuesta.ok || respuesta.status === 404;
            await cerrarRespuesta(respuesta);
            if (disponible) return;
        } catch {
            // Vite todavía está iniciando.
        }
        await esperar(250);
    }
    throw new Error('Vite no respondió en 127.0.0.1:5173 dentro del tiempo esperado.');
}

function iniciarVite() {
    const bin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
    const proceso = spawn(process.execPath, [bin, '--host', '127.0.0.1', '--port', '5173'], {
        cwd: ROOT,
        stdio: 'inherit',
        windowsHide: true
    });
    if (process.env.VISUAL_PROCESS_DIAGNOSTICS === '1') {
        console.error('[visual] vite pid=' + proceso.pid);
    }
    return proceso;
}

function ejecutarComando(comando, argumentos) {
    const proceso = spawn(comando, argumentos, {
        stdio: 'ignore',
        windowsHide: true
    });
    return esperarProceso(proceso);
}

async function terminarArbol(proceso, etiqueta) {
    if (!proceso || proceso.exitCode !== null) return;

    const pid = proceso.pid;
    const cierre = esperarProceso(proceso);
    if (process.platform === 'win32') {
        await ejecutarComando('taskkill', ['/pid', String(pid), '/t', '/f']);
    } else {
        proceso.kill('SIGTERM');
    }

    try {
        await cierre;
    } catch (error) {
        throw new Error('No se pudo cerrar ' + etiqueta + ' (PID ' + pid + '): ' + error.message);
    }
}

async function detenerProceso(proceso, etiqueta) {
    if (!proceso || proceso.exitCode !== null) return;
    await terminarArbol(proceso, etiqueta);
}

async function limpiarProcesos() {
    if (limpiezaEnCurso) return limpiezaEnCurso;
    limpiezaEnCurso = (async () => {
        let primerError;
        try {
            await detenerProceso(procesoPlaywright, 'Playwright');
        } catch (error) {
            primerError ||= error;
        }
        try {
            await detenerProceso(procesoVite, 'Vite');
        } catch (error) {
            primerError ||= error;
        }
        if (primerError) throw primerError;
    })();
    return limpiezaEnCurso;
}

function instalarManejadoresDeInterrupcion() {
    const interrumpir = () => {
        process.exitCode = 130;
        limpiarProcesos().catch(error => {
            console.error('No se pudo limpiar la ejecución interrumpida: ' + error.message);
            process.exitCode = 1;
        });
    };
    process.once('SIGINT', interrumpir);
    process.once('SIGTERM', interrumpir);
}

async function ejecutarPlaywright() {
    const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
    procesoPlaywright = spawn(process.execPath, [cli, 'test', ...args], {
        cwd: ROOT,
        stdio: 'inherit',
        shell: false,
        env: { ...process.env, VISUAL_SERVER_MANAGED: '1' }
    });
    if (process.env.VISUAL_PROCESS_DIAGNOSTICS === '1') {
        console.error('[visual] playwright pid=' + procesoPlaywright.pid);
    }

    const resultado = await esperarProceso(procesoPlaywright);
    return resultado.code ?? 1;
}

function localizarEdge() {
    if (process.platform !== 'win32') return null;
    const candidatos = [
        path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ];
    return candidatos.find(fs.existsSync) || null;
}

function comprobarPuertoLibre(puerto) {
    return new Promise(resolve => {
        const socket = net.createConnection({ host: '127.0.0.1', port: puerto });
        let finalizado = false;
        const terminar = resultado => {
            if (finalizado) return;
            finalizado = true;
            socket.destroy();
            resolve(resultado);
        };
        socket.setTimeout(2_000, () => terminar({
            libre: false,
            motivo: 'Timeout al comprobar el puerto ' + puerto + '.'
        }));
        socket.once('connect', () => terminar({
            libre: false,
            motivo: 'El puerto ' + puerto + ' ya está ocupado.'
        }));
        socket.once('error', error => {
            if (error.code === 'ECONNREFUSED') {
                terminar({ libre: true });
                return;
            }
            terminar({
                libre: false,
                motivo: (error.code || 'Error') + ' al comprobar el puerto ' + puerto + '.'
            });
        });
    });
}

function cerrarServidor(servidor) {
    return new Promise((resolve, reject) => {
        if (!servidor.listening) {
            resolve();
            return;
        }
        servidor.close(error => error ? reject(error) : resolve());
    });
}

function comprobarLoopback() {
    return new Promise((resolve, reject) => {
        const servidor = http.createServer((req, res) => {
            res.statusCode = 204;
            res.end();
        });
        let cerrado = false;
        const cerrar = async error => {
            if (cerrado) return;
            cerrado = true;
            try {
                await cerrarServidor(servidor);
                error ? reject(error) : resolve();
            } catch (cierreError) {
                reject(error || cierreError);
            }
        };
        servidor.once('error', error => { cerrar(error); });
        servidor.listen(0, '127.0.0.1', async () => {
            const { port } = servidor.address();
            try {
                const respuesta = await fetch('http://127.0.0.1:' + port + '/preflight');
                const valida = respuesta.ok || respuesta.status === 404;
                await cerrarRespuesta(respuesta);
                if (!valida) throw new Error('respuesta HTTP ' + respuesta.status);
                await cerrar();
            } catch (error) {
                await cerrar(error);
            }
        });
    });
}

async function preflight() {
    if (process.platform === 'win32' && !localizarEdge()) {
        throw new Error('Microsoft Edge no está disponible en las rutas instaladas conocidas.');
    }
    const puerto = await comprobarPuertoLibre(5173);
    if (!puerto.libre) throw new Error(puerto.motivo);
    await comprobarLoopback();
}

async function main() {
    instalarManejadoresDeInterrupcion();
    try {
        if (!args.includes('--list') && !args.includes('--help') && !args.includes('-h')) {
            await preflight();
            procesoVite = iniciarVite();
            await esperarVite();
        }
        process.exitCode = await ejecutarPlaywright();
    } catch (error) {
        console.error('Pruebas visuales no iniciadas o finalizadas correctamente.');
        console.error('Causa: ' + (error.code || error.message));
        if (error.code === 'EACCES' || error.code === 'EPERM' || /loopback|127\\.0\\.0\\.1|puerto/i.test(error.message)) {
            console.error('Solución: permite el loopback 127.0.0.1 para Node/Playwright y ejecuta de nuevo npm run test:visual.');
        }
        process.exitCode = process.exitCode || 1;
    } finally {
        try {
            await limpiarProcesos();
        } catch (error) {
            console.error('Limpieza incompleta de procesos propios: ' + error.message);
            process.exitCode = 1;
        }
    }
}

main().catch(error => {
    console.error('Error inesperado en el ejecutor visual: ' + error.message);
    process.exitCode = 1;
});
