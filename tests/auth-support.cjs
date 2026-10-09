const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const authSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth.js'), 'utf8');

function runWithAuth(source, context, usuario = { id: 1, rol: 'administrador', dependencia_id: null }) {
    const storage = new Map([['ventanilla.sesion', JSON.stringify({ token: 'test-token', usuario })]]);
    const redirects = [];
    const originales = context.fetch;
    const urls = context.URL;
    const document = context.document;
    document.querySelectorAll ??= () => [];
    document.body ??= {};
    document.body.removeAttribute ??= () => {};
    Object.assign(context, {
        Headers,
        URL: class extends URL {
            static createObjectURL(blob) { return urls?.createObjectURL(blob) || 'blob:archivo'; }
            static revokeObjectURL(url) { urls?.revokeObjectURL(url); }
        },
        window: { addEventListener() {} },
        location: { replace: url => redirects.push(url) },
        sessionStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key)
        },
        fetch: async (url, options) => {
            const response = url.endsWith('/api/auth/me')
                ? { ok: true, json: async () => ({ success: true, usuario }) }
                : await originales(url, options);
            response.status ??= response.ok ? 200 : 500;
            response.headers ??= new Headers(response.json ? { 'content-type': 'application/json' } : {});
            response.clone ??= () => response;
            response.blob ??= async () => new Blob(['PDF'], { type: 'application/pdf' });
            return response;
        }
    });
    vm.createContext(context);
    vm.runInContext(authSource, context);
    vm.runInContext(source, context);
    return { storage, redirects };
}

module.exports = { runWithAuth };
