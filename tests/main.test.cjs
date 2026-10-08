const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');

async function setup(catalog) {
    const nodes = {};
    const element = () => ({
        value: '', disabled: false, hidden: false, textContent: '', children: [], listeners: {},
        classList: { add() {}, remove() {} },
        append(child) { this.children.push(child); },
        replaceChildren() { this.children = []; },
        addEventListener(name, callback) { this.listeners[name] = callback; },
        async emit(name, event = {}) { await this.listeners[name]?.({ target: this, preventDefault() {}, ...event }); }
    });
    const get = id => nodes[id] ??= element();
    const form = element();
    let resets = 0;
    form.reset = () => resets++;
    let ready;
    let finishCatalog;
    const catalogDone = new Promise(resolve => { finishCatalog = resolve; });
    const requests = [];
    const alerts = [];
    const errors = [];
    class FormDataMock {
        constructor() {
            this.fields = new Map([
                ['tipo_tramite_id', get('tipo_tramite_id').value],
                ['remitente_nombre', 'Ana'], ['dependencia_destino', 'Gobierno']
            ]);
        }
        set(key, value) { this.fields.set(key, value); }
        get(key) { return this.fields.get(key); }
    }
    vm.runInNewContext(source, {
        document: {
            querySelector: () => form,
            querySelectorAll: () => [],
            getElementById: get,
            createElement: element,
            addEventListener: (name, callback) => { if (name === 'DOMContentLoaded') ready = callback; }
        },
        FormData: FormDataMock,
        descargarComprobantePDF() {},
        alert: message => alerts.push(message),
        console: { log() {}, error: (...args) => errors.push(args) },
        fetch: async (url, options) => {
            requests.push({ url, options });
            if (url.endsWith('/api/tipos-tramite')) {
                finishCatalog();
                return { ok: catalog.success, status: catalog.status, json: async () => catalog };
            }
            return { ok: true, json: async () => ({ success: true, radicado: 'RAD-20261007-1234' }) };
        }
    });
    ready();
    await catalogDone;
    await new Promise(resolve => setImmediate(resolve));
    return { get, form, requests, alerts, errors, resets: () => resets };
}

test('catalog supplies ID values and exact names, excluding unconfigured legal terms', async () => {
    const app = await setup({
        success: true,
        tipos_tramite: [
            { id: 10, nombre: 'Petición general', termino_legal_id: 22 },
            { id: 11, nombre: 'Sin término', termino_legal_id: null },
            { id: 12, nombre: 'Sin configuración' }
        ]
    });
    assert.deepEqual(app.get('tipo_tramite_id').children.map(option => [option.value, option.textContent]), [
        ['', 'Seleccione el tipo de trámite...'], ['10', 'Petición general']
    ]);
    assert.equal(app.get('tipo_tramite_id').disabled, false);
    app.get('tipo_tramite_id').value = '10';
    const pdf = { name: 'Solicitud.pdf' };
    await app.get('archivo').emit('change', { target: { files: [pdf] } });
    await app.form.emit('submit');
    const request = app.requests.at(-1);
    assert.equal(request.url, 'http://localhost:3000/api/radicados');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.body.get('tipo_tramite_id'), '10');
    assert.equal(request.options.body.get('archivo'), pdf);
    assert.equal(request.options.body.get('tipo_documento'), undefined);
    assert.equal(request.options.body.get('fecha_limite_actual'), undefined);
    assert.equal(request.options.headers, undefined);
    assert.equal(app.resets(), 1);
});

test('catalog failures and empty catalogs block registration and offer retry', async () => {
    for (const catalog of [
        { success: false, message: 'Catálogo no disponible' },
        { success: false, status: 404 },
        { success: true, tipos_tramite: [] }
    ]) {
        const app = await setup(catalog);
        assert.equal(app.get('tipo_tramite_id').disabled, true);
        assert.equal(app.get('reintentar-tipos-tramite').hidden, false);
        await app.form.emit('submit');
        assert.equal(app.requests.length, 1);
        assert.match(app.alerts[0], /tipo de trámite/);
        if (!catalog.success) assert.ok(app.errors.length);
        if (catalog.status === 404) assert.match(app.get('estado-tipos-tramite').textContent, /backend actualizado/);
    }
});

test('frontend never includes administrative credentials or editable deadlines', () => {
    for (const file of ['main.js', 'consultar.js', 'comprobante.js']) {
        const code = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
        assert.doesNotMatch(code, /x-admin-key/i);
    }
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.doesNotMatch(html, /name=["'](?:fecha_limite[^"']*|termino_dias[^"']*|tiempo_de_respuesta)["']/);
    assert.match(html, /name="tipo_tramite_id"/);
});
