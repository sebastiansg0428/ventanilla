const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const authSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth.js'), 'utf8');
const loginSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'login.js'), 'utf8');
const usuario = { id: 1, nombre: 'Prueba', rol: 'administrador', dependencia_id: null };
const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' }
});

function setup({ sesion = { token: 'test-token', usuario }, fetcher = async () => json({ success: true, usuario }) } = {}) {
    const storage = new Map(sesion ? [['ventanilla.sesion', JSON.stringify(sesion)]] : []);
    const requests = [];
    const redirects = [];
    const messages = [];
    const nodes = new Map();
    const node = id => {
        if (!nodes.has(id)) nodes.set(id, {
            value: '', hidden: false, disabled: false, textContent: '', listeners: {},
            addEventListener(name, callback) { this.listeners[name] = callback; }
        });
        return nodes.get(id);
    };
    const body = {
        pending: true,
        removeAttribute(name) { if (name === 'data-sesion-pendiente') this.pending = false; }
    };
    let ready;
    const context = {
        Headers, URL,
        sessionStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key)
        },
        location: { replace: url => redirects.push(url) },
        console: { error: (...args) => messages.push(args) },
        alert: message => messages.push(message),
        document: {
            body, getElementById: node,
            querySelectorAll: selector => ({
                '[data-accion="radicar"]': [node('radicar')],
                '[data-rol="administrador"]': [node('admin')],
                '[data-cerrar-sesion]': [node('logout')]
            })[selector] || [],
            addEventListener(name, callback) { if (name === 'DOMContentLoaded') ready = callback; }
        },
        fetch: async (url, options) => {
            requests.push({ url, options });
            return fetcher(url, options);
        }
    };
    vm.createContext(context);
    vm.runInContext(authSource, context);
    return {
        auth: vm.runInContext('AppAuth', context), storage, requests, redirects, messages, node, body,
        async login() {
            vm.runInContext(loginSource, context);
            ready();
            await node('login-form').listeners.submit({ preventDefault() {} });
        }
    };
}

test('apiFetch attaches the token, preserves JSON and multipart headers, and refuses foreign origins', async () => {
    const app = setup();
    await app.auth.apiFetch('/api/radicados', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    assert.equal(app.requests[0].options.headers.get('Authorization'), 'Bearer test-token');
    assert.equal(app.requests[0].options.headers.get('Content-Type'), 'application/json');
    const body = new FormData();
    await app.auth.apiFetch('/api/radicados', { method: 'POST', body });
    assert.equal(app.requests[1].options.body, body);
    assert.equal(app.requests[1].options.headers.has('Content-Type'), false);
    await assert.rejects(app.auth.apiFetch('https://example.org/archivo'), /no pertenece/);
    assert.equal(app.requests.length, 2);
});

test('401 clears the session and redirects, while a missing token sends no request', async () => {
    const app = setup({ fetcher: async () => json({ success: false, message: 'Token vencido' }, 401) });
    await assert.rejects(app.auth.apiFetch('/api/radicados'), /sesion ha expirado/);
    assert.equal(app.storage.size, 0);
    assert.deepEqual(app.redirects, ['login.html']);
    const empty = setup({ sesion: null });
    await assert.rejects(empty.auth.apiFetch('/api/radicados'), /Inicia sesion/);
    assert.equal(empty.requests.length, 0);
    assert.deepEqual(empty.redirects, ['login.html']);
});

test('HTTP, application and network failures expose messages without erasing a valid session', async () => {
    for (const fetcher of [
        async () => json({ success: false, message: 'Accion no permitida' }, 403),
        async () => json({ success: false, message: 'Accion no permitida' }),
        async () => { throw new Error('Accion no permitida'); }
    ]) {
        const app = setup({ fetcher });
        await assert.rejects(app.auth.apiFetch('/api/radicados'), /Accion no permitida/);
        assert.equal(app.storage.size, 1);
        assert.equal(app.redirects.length, 0);
    }
    const head = setup({ fetcher: async () => new Response(null, { status: 404 }) });
    await assert.rejects(head.auth.apiFetch('/uploads/falta.pdf', { method: 'HEAD' }), /HTTP 404/);
});

test('login saves token and user only after a successful response; credentials never persist', async () => {
    const app = setup({
        sesion: null,
        fetcher: async () => json({ success: true, token: 'nuevo-token', usuario })
    });
    app.node('email').value = '  prueba@example.test  ';
    app.node('password').value = 'password de prueba';
    await app.login();
    assert.equal(app.requests[0].url, 'http://localhost:3000/api/auth/login');
    assert.equal(app.requests[0].options.method, 'POST');
    assert.equal(app.requests[0].options.headers.has('Authorization'), false);
    assert.deepEqual(JSON.parse(app.requests[0].options.body), {
        email: 'prueba@example.test', password: 'password de prueba'
    });
    assert.deepEqual(JSON.parse(app.storage.get('ventanilla.sesion')), { token: 'nuevo-token', usuario });
    assert.deepEqual(app.redirects, ['index.html']);

    for (const resultado of [
        json({ success: false, message: 'Credenciales incorrectas' }, 401),
        json({ success: false, message: 'Credenciales incorrectas' }),
        json({ success: true, usuario })
    ]) {
        const failed = setup({ sesion: null, fetcher: async () => resultado });
        await failed.login();
        assert.equal(failed.storage.size, 0);
        assert.equal(failed.redirects.length, 0);
        assert.ok(failed.node('login-mensaje').textContent);
        assert.equal(failed.node('login-submit').disabled, false);
    }
});

test('me, not the cached role, determines presentation and prevents funcionario reception access', async () => {
    for (const rol of ['administrador', 'ventanilla', 'funcionario']) {
        const confirmado = { ...usuario, rol, dependencia_id: rol === 'funcionario' ? 7 : null };
        const app = setup({ fetcher: async () => json({ success: true, usuario: confirmado }) });
        await app.auth.confirmarSesion();
        assert.equal(app.requests[0].url, 'http://localhost:3000/api/auth/me');
        assert.equal(app.node('radicar').hidden, rol === 'funcionario');
        assert.equal(app.node('admin').hidden, rol !== 'administrador');
        assert.equal(app.body.pending, false);
        assert.equal(JSON.parse(app.storage.get('ventanilla.sesion')).usuario.rol, rol);
    }
    const funcionario = setup({ fetcher: async () => json({
        success: true, usuario: { ...usuario, rol: 'funcionario', dependencia_id: 7 }
    }) });
    assert.equal(await funcionario.auth.confirmarSesion({ recepcion: true }), null);
    assert.equal(funcionario.body.pending, true);
    assert.deepEqual(funcionario.redirects, ['consultar.html']);
    const failed = setup({ fetcher: async () => json({ success: false, message: 'No disponible' }, 500) });
    assert.equal(await failed.auth.confirmarSesion(), null);
    assert.equal(failed.body.pending, true);
    assert.match(failed.node('sesion-estado').textContent, /No disponible/);
});

test('logout calls the backend before clearing session; errors remain visible and retryable', async () => {
    let fallo = false;
    const app = setup({ fetcher: async url => url.endsWith('/logout')
        ? json({ success: !fallo, message: fallo ? 'No disponible' : 'Sesion cerrada' }, fallo ? 500 : 200)
        : json({ success: true, usuario })
    });
    await app.auth.confirmarSesion();
    fallo = true;
    await app.node('logout').listeners.click();
    assert.equal(app.storage.size, 1);
    assert.equal(app.node('logout').disabled, false);
    assert.ok(app.messages.includes('No disponible'));
    fallo = false;
    await app.node('logout').listeners.click();
    assert.equal(app.requests.at(-1).url, 'http://localhost:3000/api/auth/logout');
    assert.equal(app.requests.at(-1).options.method, 'POST');
    assert.equal(app.requests.at(-1).options.headers.get('Authorization'), 'Bearer test-token');
    assert.equal(app.storage.size, 0);
    assert.deepEqual(app.redirects, ['login.html']);
});
