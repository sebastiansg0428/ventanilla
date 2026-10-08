const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

process.env.TZ = 'America/Bogota';
const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'consultar.js'), 'utf8');

class FixedDate extends Date {
    constructor(...args) {
        super(...(args.length ? args : ['2026-10-06T15:00:00Z']));
    }
}

function element() {
    const listeners = {};
    const classes = new Set();
    return {
        innerHTML: '', textContent: '', value: '', disabled: true, attributes: {}, children: [],
        append(child) { this.children.push(child); },
        replaceChildren(...children) { this.children = children; },
        classList: {
            contains: name => classes.has(name),
            add: name => classes.add(name),
            remove: name => classes.delete(name),
            toggle(name, active) { active ? classes.add(name) : classes.delete(name); }
        },
        setAttribute(name, value) { this.attributes[name] = value; },
        removeAttribute(name) { delete this.attributes[name]; delete this[name]; },
        getAttribute(name) { return this.attributes[name]; },
        addEventListener(name, callback) { listeners[name] = callback; },
        async emit(name, event = {}) { return listeners[name]?.({ target: this, ...event }); },
        click() { return this.emit('click'); },
        focus() { this.focused = true; },
        showModal() { this.open = true; },
        close() { this.open = false; return this.emit('close'); }
    };
}

function records() {
    return [
        ['A', ' EXTERNA ', ' Alerta ', '2026-10-06 09:00:00', 'Ana'],
        ['B', 'Interna', 'vencido', '2026-10-06T06:00:00Z', 'Ana'],
        ['C', 'externa', 'vencido', '2026-10-05 09:00:00', 'Ana'],
        ['D', 'externa', 'completado', '2026-10-06T15:00:00Z', 'Luis'],
        ['E', null, null, null, 'Ana'],
        ['F', 'Externa', 'a_tiempo', '2026-10-07T02:00:00Z', 'Luis'],
        ['G', 'externa', 'vencido', '2026-10-06', 'Ana']
    ].map(([numero_radicado, tipo_comunicacion, nivel, fecha_creacion, remitente_nombre]) => ({
        numero_radicado, tipo_comunicacion, fecha_creacion, remitente_nombre,
        remitente_nit: 12345, estado: 'Recibido', semaforo: { nivel },
        ruta_archivo: 'soporte.pdf'
    }));
}

async function setup({ data = records(), failure = false, networkFailure = false, attachmentFetch, generateReceipt, alertsFetch, stateFetch } = {}) {
    const nodes = {};
    const get = id => nodes[id] ??= element();
    for (const id of ['card-total', 'card-hoy']) {
        get(id).setAttribute('aria-disabled', 'true');
        get(id).setAttribute('aria-pressed', 'false');
    }
    const types = get('filtro-comunicacion');
    types.options = ['', 'interna', 'externa', 'sin-tipo'].map((value, index) => ({
        value, text: ['Todos', 'Interna', 'Externa', 'No especificado'][index]
    }));
    Object.defineProperty(types, 'selectedIndex', {
        get: () => types.options.findIndex(option => option.value === types.value)
    });
    const warnings = [];
    const errors = [];
    const requests = [];
    const receipts = [];
    const revokedUrls = [];
    let ready;
    const document = {
        getElementById: get,
        createElement: () => element(),
        body: { style: { overflow: '' } },
        addEventListener(name, callback) { if (name === 'DOMContentLoaded') ready = callback; }
    };
    vm.runInNewContext(source, {
        document, Date: FixedDate,
        crearComprobantePDF: generateReceipt || (data => {
            receipts.push(data);
            return { output: type => { assert.equal(type, 'blob'); return {}; } };
        }),
        URL: {
            createObjectURL: () => 'blob:comprobante',
            revokeObjectURL: url => revokedUrls.push(url)
        },
        console: { log() {}, warn: (...args) => warnings.push(args), error: (...args) => errors.push(args) },
        alert: message => errors.push(message),
        fetch: async (url, options) => {
            requests.push({ url, options });
            if (networkFailure) throw new Error('Network unavailable');
            if (url.includes('/api/alertas?')) {
                return alertsFetch ? alertsFetch(url) : { ok: true, json: async () => ({ success: true, alertas: [] }) };
            }
            if (options?.method === 'HEAD') {
                return attachmentFetch ? attachmentFetch(url) : { ok: true };
            }
            if (options?.method === 'PUT') {
                return stateFetch ? stateFetch(url, options) : {
                    ok: true,
                    json: async () => ({ success: true, estado: JSON.parse(options.body).estado, semaforo: { nivel: 'completado' } })
                };
            }
            return { ok: !failure, json: async () => ({ success: !failure, radicados: data }) };
        }
    });
    await ready();
    return {
        get, warnings, errors, requests, receipts, revokedUrls,
        rows: () => [...get('tabla-radicados').innerHTML.matchAll(/<button data-radicado="([^"]+)"/g)].map(match => match[1]),
        type: async value => { types.value = value; await types.emit('change'); },
        search: async value => { get('buscador').value = value; await get('buscador').emit('input'); }
    };
}

test('all combinations intersect; global counts and active states remain consistent', async () => {
    const app = await setup();
    assert.equal(app.get('stat-total').textContent, 7);
    assert.equal(app.get('stat-criticos').textContent, 4);
    assert.equal(app.get('stat-hoy').textContent, 5);
    for (let mask = 0; mask < 16; mask++) {
        await app.get('limpiar-filtros').click();
        if (mask & 1) await app.get('card-total').click();
        if (mask & 2) await app.get('card-hoy').click();
        if (mask & 4) await app.type('externa');
        if (mask & 8) await app.search(' ANA ');
        const expected = records().filter(item =>
            (!(mask & 1) || ['A', 'B', 'C', 'G'].includes(item.numero_radicado))
            && (!(mask & 2) || ['A', 'B', 'D', 'F', 'G'].includes(item.numero_radicado))
            && (!(mask & 4) || ['A', 'C', 'D', 'F', 'G'].includes(item.numero_radicado))
            && (!(mask & 8) || item.remitente_nombre === 'Ana')
        ).map(item => item.numero_radicado);
        assert.deepEqual(app.rows(), expected, `combination ${mask}`);
        assert.equal(app.get('card-total').attributes['aria-pressed'], String(Boolean(mask & 1)));
        assert.equal(app.get('card-hoy').attributes['aria-pressed'], String(Boolean(mask & 2)));
        assert.equal(app.get('stat-total').textContent, 7);
        assert.equal(app.get('stat-criticos').textContent, 4);
    }
});

test('form controls have identifiers, including every dynamically rendered state select', async () => {
    const app = await setup();
    const controls = [...app.get('tabla-radicados').innerHTML.matchAll(/<select\b[^>]*>/g)].map(match => match[0]);
    assert.equal(controls.length, records().length);
    const ids = controls.map(control => {
        const id = control.match(/\bid="([^"]+)"/)?.[1];
        assert.ok(id);
        assert.match(control, /\baria-label="Estado del radicado [^"]+"/);
        return id;
    });
    assert.equal(new Set(ids).size, ids.length);
    for (const file of ['index.html', 'consultar.html']) {
        const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
        for (const [control] of html.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)) {
            assert.match(control, /\b(?:id|name)="[^"]+"/, `${file}: ${control}`);
        }
    }
    await app.type('interna');
    assert.match(app.get('tabla-radicados').innerHTML, /id="estado-B"/);
    await app.get('limpiar-filtros').click();
    assert.equal([...app.get('tabla-radicados').innerHTML.matchAll(/\bid="estado-[^"]+"/g)].length, records().length);
});

test('toggling removes only one criterion; keyboard and clear reset all controls', async () => {
    const app = await setup();
    await app.type('externa');
    await app.search('ana');
    await app.get('card-hoy').click();
    let prevented = false;
    await app.get('card-total').emit('keydown', { key: ' ', preventDefault() { prevented = true; } });
    assert.ok(prevented);
    assert.deepEqual(app.rows(), ['A', 'G']);
    await app.get('card-hoy').click();
    assert.deepEqual(app.rows(), ['A', 'C', 'G']);
    await app.get('card-total').emit('keydown', { key: 'Enter', preventDefault() {} });
    assert.deepEqual(app.rows(), ['A', 'C', 'G']);
    assert.equal(app.get('card-total').attributes['aria-pressed'], 'false');
    await app.get('limpiar-filtros').click();
    assert.equal(app.rows().length, 7);
    assert.equal(app.get('buscador').value, '');
    assert.equal(app.get('filtro-comunicacion').value, '');
    assert.ok(app.get('limpiar-filtros').disabled);
    assert.ok(app.get('buscador').focused);
});

test('missing types, numeric NIT, no results, and an empty dataset', async () => {
    const app = await setup();
    await app.type('interna');
    assert.deepEqual(app.rows(), ['B']);
    await app.type('sin-tipo');
    assert.deepEqual(app.rows(), ['E']);
    await app.search('12345');
    assert.deepEqual(app.rows(), ['E']);
    await app.get('card-hoy').click();
    assert.deepEqual(app.rows(), []);
    assert.match(app.get('tabla-radicados').innerHTML, /No se encontraron registros/);
    assert.match(app.get('resumen-filtros').textContent, /Mostrando 0 de 7/);
    const empty = await setup({ data: [] });
    assert.equal(empty.get('stat-total').textContent, 0);
    assert.equal(empty.get('stat-hoy').textContent, 0);
    assert.equal(empty.get('filtro-comunicacion').disabled, false);
});

test('successful state updates preserve selection and recompute critical results', async () => {
    const app = await setup();
    await app.get('card-total').click();
    await app.get('card-hoy').click();
    await app.type('externa');
    await app.search('ana');
    const select = element();
    select.classList.add('select-estado');
    select.value = 'Respondido';
    select.setAttribute('data-radicado', 'A');
    await app.get('tabla-radicados').emit('change', { target: select });
    assert.deepEqual(app.rows(), ['G']);
    assert.equal(app.get('stat-criticos').textContent, 3);
    assert.equal(app.get('card-total').attributes['aria-pressed'], 'true');
    assert.equal(app.get('card-hoy').attributes['aria-pressed'], 'true');
    assert.equal(app.get('filtro-comunicacion').value, 'externa');
    assert.equal(app.get('buscador').value, 'ana');
    assert.equal(JSON.parse(app.requests.at(-1).options.body).estado, 'Respondido');
    assert.match(app.get('tabla-radicados').innerHTML, /generar-comprobante/);
});

test('state save locks the selector and uses the canonical server state in the model', async () => {
    const data = records();
    let resolve;
    const app = await setup({ data, stateFetch: () => new Promise(done => { resolve = done; }) });
    const select = element();
    select.disabled = false;
    select.isConnected = false;
    select.classList.add('select-estado');
    select.value = 'Pendiente';
    select.setAttribute('data-radicado', 'A');
    const pending = app.get('tabla-radicados').emit('change', { target: select });
    assert.equal(select.disabled, true);
    assert.equal(data[0].estado, 'Recibido');
    resolve({ ok: true, json: async () => ({
        success: true, estado: 'En trámite', semaforo: { nivel: 'a_tiempo' }
    }) });
    await pending;
    assert.equal(data[0].estado, 'En trámite');
    assert.equal(data[0].semaforo.nivel, 'a_tiempo');
    assert.match(app.get('tabla-radicados').innerHTML, /value="En trámite" selected/);
    assert.equal(select.disabled, true);
});

test('HTTP or application failures restore the model state and display the server message', async () => {
    for (const [ok, success] of [[false, true], [true, false], [false, false]]) {
        const data = records();
        data[0].estado = 'En trámite';
        const app = await setup({ data, stateFetch: async () => ({
            ok, json: async () => ({ success, message: 'Cambio de estado no permitido.' })
        }) });
        const select = element();
        select.disabled = false;
        select.isConnected = true;
        select.classList.add('select-estado');
        select.value = 'Respondido';
        select.setAttribute('data-radicado', 'A');
        await app.get('tabla-radicados').emit('change', { target: select });
        assert.equal(select.value, 'En trámite');
        assert.equal(select.disabled, false);
        assert.equal(data[0].estado, 'En trámite');
        assert.equal(data[0].semaforo.nivel, ' Alerta ');
        assert.ok(app.errors.includes('Cambio de estado no permitido.'));
    }
});

test('connection and JSON errors restore the previous state and re-enable a connected selector', async () => {
    for (const stateFetch of [
        async () => { throw new Error('Network unavailable'); },
        async () => ({ ok: false, json: async () => { throw new Error('Invalid JSON'); } })
    ]) {
        const data = records();
        data[0].estado = 'Pendiente';
        const app = await setup({ data, stateFetch });
        const select = element();
        select.isConnected = true;
        select.classList.add('select-estado');
        select.value = 'Respondido';
        select.setAttribute('data-radicado', 'A');
        await app.get('tabla-radicados').emit('change', { target: select });
        assert.equal(select.value, 'Pendiente');
        assert.equal(select.disabled, false);
        assert.equal(data[0].estado, 'Pendiente');
        assert.ok(app.errors.some(error => typeof error === 'string' && error.includes('No se pudo conectar')));
    }
});

test('API failures stay visible and cannot be replaced by filter results', async () => {
    for (const options of [{ failure: true }, { networkFailure: true }]) {
        const app = await setup(options);
        await app.get('card-total').click();
        await app.get('card-hoy').click();
        await app.search('ana');
        assert.match(app.get('tabla-radicados').innerHTML, /Error al cargar|No se pudo conectar/);
        assert.equal(app.get('card-total').attributes['aria-disabled'], 'true');
        assert.ok(app.get('buscador').disabled);
        assert.ok(app.get('filtro-comunicacion').disabled);
        assert.ok(app.errors.length);
    }
});

test('invalid dates are reported and excluded from today', async () => {
    const app = await setup({ data: [{ numero_radicado: 'INVALID', fecha_creacion: 'invalid-date' }] });
    assert.ok(app.warnings.length);
    assert.equal(app.get('stat-hoy').textContent, 0);
    await app.get('card-hoy').click();
    assert.deepEqual(app.rows(), []);
});

test('today uses local calendar dates across UTC midnight and explicit offsets', async () => {
    const data = [
        { numero_radicado: 'PREVIOUS', fecha_creacion: '2026-10-06T02:00:00Z' },
        { numero_radicado: 'TODAY', fecha_creacion: '2026-10-07T02:00:00Z' },
        { numero_radicado: 'OFFSET', fecha_creacion: '2026-10-06T00:01:00-05:00' },
        { numero_radicado: 'SQL', fecha_creacion: '2026-10-06 00:01:00' },
        { numero_radicado: 'DATE', fecha_creacion: '2026-10-06' }
    ];
    const app = await setup({ data });
    assert.equal(app.get('stat-hoy').textContent, 4);
    await app.get('card-hoy').click();
    assert.deepEqual(app.rows(), ['TODAY', 'OFFSET', 'SQL', 'DATE']);
});

test('detail modal and PDF support remain available under filters', async () => {
    const app = await setup();
    await app.type('interna');
    const button = element();
    button.setAttribute('data-radicado', 'B');
    await app.get('tabla-radicados').emit('click', { target: { closest: selector => selector === '.ver-detalle' ? button : null } });
    assert.equal(app.get('modal-num-radicado').textContent, 'B');
    assert.ok(app.get('modal-detalle').classList.contains('activo'));
    assert.equal(app.get('modal-adjunto-preview').src, 'http://localhost:3000/uploads/soporte.pdf');
    assert.equal(app.get('modal-adjunto-preview').hidden, false);
    assert.equal(app.get('modal-adjunto-enlace').href, app.get('modal-adjunto-preview').src);
    app.get('btn-cerrar-modal').onclick();
    assert.equal(app.get('modal-detalle').attributes['aria-hidden'], 'true');
    assert.ok(button.focused);
    assert.equal(app.get('modal-adjunto-preview').src, undefined);
    assert.equal(app.get('modal-adjunto-preview').hidden, true);
    assert.deepEqual(app.rows(), ['B']);
});

async function openDetail(app, numero) {
    const button = element();
    button.setAttribute('data-radicado', numero);
    await app.get('tabla-radicados').emit('click', { target: { closest: selector => selector === '.ver-detalle' ? button : null } });
}

test('preview uses the stored attachment path and displays its original name as text', async () => {
    const data = records();
    data[0].ruta_archivo = '123-Solicitud #1 & entidad.pdf';
    data[0].nombre_archivo_original = '<Solicitud de la entidad>.pdf';
    const app = await setup({ data });
    await openDetail(app, 'A');
    assert.equal(app.get('modal-adjunto-nombre').textContent, data[0].nombre_archivo_original);
    assert.equal(app.get('modal-adjunto-preview').src, `http://localhost:3000/uploads/${encodeURIComponent(data[0].ruta_archivo)}`);
    assert.equal(app.requests.at(-1).options.method, 'HEAD');
});

test('switching to a radicado without an attachment clears the previous preview', async () => {
    const data = records();
    data[1].ruta_archivo = null;
    const app = await setup({ data });
    await openDetail(app, 'A');
    await openDetail(app, 'B');
    assert.equal(app.get('modal-adjunto-preview').src, undefined);
    assert.equal(app.get('modal-adjunto-preview').hidden, true);
    assert.equal(app.get('modal-adjunto-enlace').hidden, true);
    assert.match(app.get('modal-adjunto-mensaje').textContent, /No hay documento adjunto/);
});

test('unavailable files and network errors report a message instead of showing an empty preview', async () => {
    for (const attachmentFetch of [
        async () => ({ ok: false, status: 404 }),
        async () => { throw new Error('Network unavailable'); }
    ]) {
        const app = await setup({ attachmentFetch });
        await openDetail(app, 'A');
        assert.equal(app.get('modal-adjunto-preview').hidden, true);
        assert.equal(app.get('modal-adjunto-enlace').hidden, false);
        assert.match(app.get('modal-adjunto-mensaje').textContent, /No se pudo/);
        assert.ok(app.errors.length);
    }
});

test('closing or switching the modal ignores an older attachment response', async () => {
    for (const close of [true, false]) {
        let resolve;
        const data = records();
        data[1].ruta_archivo = null;
        const app = await setup({ data, attachmentFetch: () => new Promise(done => { resolve = done; }) });
        const pending = openDetail(app, 'A');
        if (close) {
            app.get('btn-cerrar-modal').onclick();
        } else {
            await openDetail(app, 'B');
        }
        resolve({ ok: true });
        await pending;
        assert.equal(app.get('modal-adjunto-preview').hidden, true);
        assert.equal(app.get('modal-adjunto-preview').src, undefined);
        if (!close) assert.match(app.get('modal-adjunto-mensaje').textContent, /No hay documento adjunto/);
    }
});

test('table generates a receipt using stored reception data, independently of the attachment', async () => {
    const data = records();
    data[0].ruta_archivo = null;
    const app = await setup({ data });
    const button = element();
    button.setAttribute('data-radicado', 'A');
    await app.get('tabla-radicados').emit('click', {
        target: { closest: selector => selector === '.generar-comprobante' ? button : null }
    });
    assert.equal(app.receipts.length, 1);
    assert.equal(app.receipts[0].numero_radicado, 'A');
    assert.equal(app.receipts[0].fecha_hora, new Date('2026-10-06T09:00:00').toLocaleString());
    assert.equal(app.requests.length, 1);
    assert.doesNotMatch(app.get('tabla-radicados').innerHTML, /href="http:\/\/localhost:3000\/uploads/);
    assert.equal(app.get('visor-comprobante').open, true);
    assert.equal(app.get('comprobante-preview').src, 'blob:comprobante');
    await app.get('cerrar-comprobante').click();
    assert.equal(app.get('visor-comprobante').open, false);
    assert.equal(app.get('comprobante-preview').src, undefined);
    assert.deepEqual(app.revokedUrls, ['blob:comprobante']);
});

test('receipt generation errors are reported', async () => {
    const app = await setup({ generateReceipt: () => { throw new Error('jsPDF unavailable'); } });
    const button = element();
    button.setAttribute('data-radicado', 'A');
    await app.get('tabla-radicados').emit('click', {
        target: { closest: selector => selector === '.generar-comprobante' ? button : null }
    });
    assert.ok(app.errors.some(error => typeof error === 'string' && error.includes('jsPDF unavailable')));
});

test('shared PDF generator preserves the reception date, wraps text and saves a distinct receipt', () => {
    const texts = [];
    let pages = 1;
    let saved;
    const doc = {
        setFont() {}, setFontSize() {}, setLineWidth() {}, line() {}, setFillColor() {},
        rect() {}, setTextColor() {}, setPage() {},
        text(value, x, y) { texts.push({ value, y }); },
        splitTextToSize: text => text.split('\n'),
        addPage() { pages++; },
        getNumberOfPages: () => pages,
        save(name) { saved = name; }
    };
    const context = {
        window: { jspdf: { jsPDF: function () { return doc; } } }
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'comprobante.js'), 'utf8'), context);
    context.descargarComprobantePDF({
        numero_radicado: 'RAD-20261006-9287',
        fecha_hora: '6/10/2026, 12:12:28',
        asunto_documento: Array(90).fill('Detalle del documento').join('\n')
    });
    assert.ok(texts.some(text => text.value === '6/10/2026, 12:12:28'));
    assert.equal(saved, 'Comprobante_RAD-20261006-9287.pdf');
    assert.ok(pages > 1);
    assert.ok(texts.filter(text => text.value === 'Detalle del documento').every(text => text.y <= 255));
    saved = undefined;
    const preview = context.crearComprobantePDF({ numero_radicado: 'A', fecha_hora: 'Fecha registrada' });
    assert.equal(preview, doc);
    assert.equal(saved, undefined);
    context.window.jspdf = undefined;
    assert.throws(() => context.descargarComprobantePDF({}), /No se pudo cargar jsPDF/);
});

    test('details display legal fields returned by the server without changing its traffic light', async () => {
        const data = records();
        Object.assign(data[0], {
            fecha_limite_actual: '2026-10-29',
            fundamento_legal_aplicado: 'Ley de prueba, artículo 14',
            tiempo_de_respuesta: '15 días hábiles'
        });
        const app = await setup({ data });
        await openDetail(app, 'A');
        assert.equal(app.get('modal-fecha-limite').textContent, '2026-10-29');
        assert.equal(app.get('modal-fundamento-legal').textContent, data[0].fundamento_legal_aplicado);
        assert.equal(app.get('modal-tiempo').textContent, '15 días hábiles');
        assert.equal(data[0].semaforo.nivel, ' Alerta ');
    });

    test('alerts use the exact recorded dependency, separate levels and refresh after a state update', async () => {
        const data = records();
        data[0].dependencia_destino = 'Secretaría de Gobierno';
        data[1].dependencia_destino = 'Secretaría de Gobierno';
        const app = await setup({
            data,
            alertsFetch: async () => ({
                ok: true, json: async () => ({
                    success: true, alertas: [
                        { numero_radicado: 'A', semaforo: { nivel: 'alerta', texto: 'Próximo a vencer' }, fecha_limite_actual: '2026-10-08' },
                        { numero_radicado: 'B', semaforo: { nivel: 'vencido', texto: 'Vencido' } }
                    ]
                })
            })
        });
        assert.deepEqual(app.get('alertas-dependencia').children.map(option => option.value), ['Secretaría de Gobierno']);
        app.get('alertas-dependencia').value = 'Secretaría de Gobierno';
        await app.get('alertas-dependencia').emit('change');
        assert.equal(app.requests.at(-1).url, `http://localhost:3000/api/alertas?dependencia=${encodeURIComponent('Secretaría de Gobierno')}`);
        assert.match(app.get('alertas-proximos').children[0].textContent, /A.*Próximo a vencer.*2026-10-08/);
        assert.match(app.get('alertas-vencidos').children[0].textContent, /B.*Vencido/);
        const select = element();
        select.classList.add('select-estado');
        select.value = 'Respondido';
        select.setAttribute('data-radicado', 'A');
        await app.get('tabla-radicados').emit('change', { target: select });
        assert.equal(app.requests.filter(request => request.url.includes('/api/alertas?')).length, 2);
    });

    test('alerts report errors, allow retry and ignore outdated dependency responses', async () => {
        let resolve;
        let count = 0;
        const data = records();
        data[0].dependencia_destino = 'Primera';
        data[1].dependencia_destino = 'Segunda';
        const app = await setup({ data, alertsFetch: async () => {
            count++;
            if (count === 1) return new Promise(done => { resolve = done; });
            return { ok: false, json: async () => ({ success: false, message: 'Error de alertas' }) };
        } });
        app.get('alertas-dependencia').value = 'Primera';
        const pending = app.get('alertas-dependencia').emit('change');
        app.get('alertas-dependencia').value = 'Segunda';
        await app.get('alertas-dependencia').emit('change');
        resolve({ ok: true, json: async () => ({ success: true, alertas: [] }) });
        await pending;
        assert.match(app.get('alertas-estado').textContent, /Error de alertas/);
        assert.equal(app.get('actualizar-alertas').disabled, false);
        assert.ok(app.errors.length);
        app.get('alertas-dependencia').value = '';
        await app.get('alertas-dependencia').emit('change');
        assert.equal(app.get('actualizar-alertas').disabled, true);
    });
