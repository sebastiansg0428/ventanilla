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
        innerHTML: '', textContent: '', value: '', disabled: true, attributes: {},
        classList: {
            contains: name => classes.has(name),
            add: name => classes.add(name),
            remove: name => classes.delete(name),
            toggle(name, active) { active ? classes.add(name) : classes.delete(name); }
        },
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return this.attributes[name]; },
        addEventListener(name, callback) { listeners[name] = callback; },
        async emit(name, event = {}) { return listeners[name]?.({ target: this, ...event }); },
        click() { return this.emit('click'); },
        focus() { this.focused = true; }
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

async function setup({ data = records(), failure = false, networkFailure = false } = {}) {
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
    let ready;
    const document = {
        getElementById: get,
        body: { style: { overflow: '' } },
        addEventListener(name, callback) { if (name === 'DOMContentLoaded') ready = callback; }
    };
    vm.runInNewContext(source, {
        document, Date: FixedDate,
        console: { log() {}, warn: (...args) => warnings.push(args), error: (...args) => errors.push(args) },
        alert: message => errors.push(message),
        fetch: async (url, options) => {
            requests.push({ url, options });
            if (networkFailure) throw new Error('Network unavailable');
            if (options?.method === 'PUT') {
                return { ok: true, json: async () => ({ success: true, semaforo: { nivel: 'completado' } }) };
            }
            return { ok: !failure, json: async () => ({ success: !failure, radicados: data }) };
        }
    });
    await ready();
    return {
        get, warnings, errors, requests,
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
    assert.match(app.get('tabla-radicados').innerHTML, /soporte\.pdf/);
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
    await app.get('tabla-radicados').emit('click', { target: { closest: () => button } });
    assert.equal(app.get('modal-num-radicado').textContent, 'B');
    assert.ok(app.get('modal-detalle').classList.contains('activo'));
    assert.match(app.get('modal-contenedor-soporte').innerHTML, /soporte\.pdf/);
    app.get('btn-cerrar-modal').onclick();
    assert.equal(app.get('modal-detalle').attributes['aria-hidden'], 'true');
    assert.ok(button.focused);
    assert.deepEqual(app.rows(), ['B']);
});
