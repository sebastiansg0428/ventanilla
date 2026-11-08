import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BandejaTraslados, SolicitudTraslado } from "../../src/componentes/Traslados";
import { solicitarApi } from "../../src/servicios/api";

vi.mock("../../src/servicios/api", () => ({ solicitarApi: vi.fn() }));
const showModalOriginal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
beforeAll(() => Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  configurable: true, value() { this.setAttribute("open", ""); },
}));
afterAll(() => {
  if (showModalOriginal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModalOriginal);
  else delete HTMLDialogElement.prototype.showModal;
});
beforeEach(() => vi.resetAllMocks());

const dependencias = [{ id: 3, nombre: "Origen", activo: 1 }, { id: 4, nombre: "Destino B", activo: 1 },
  { id: 5, nombre: "Destino C", activo: 1 }, { id: 6, nombre: "Inactiva", activo: 0 }];
const radicado = { numero_radicado: "RAD-001", dependencia_destino_id: 3 };
const traslado = { id: 1, numero_radicado: "RAD-001", origen_id: 3, origen_nombre: "Origen",
  destino_sugerido_id: 4, destino_sugerido_nombre: "Destino B", solicitante_nombre: "Actor fixture",
  motivo_solicitud: "Revisar competencia de prueba.", estado: "pendiente",
  creado_en_utc: "2026-11-04 15:00:00.000000", fecha_limite_conservada: "2026-11-20" };
const json = (objeto) => ({ json: async () => objeto });
const bandeja = (registros = [traslado]) => json({ success: true, traslados: registros, total: registros.length, paginas: 1, pendientes: registros.filter(r => r.estado === "pendiente").length });
function diferida() {
  let resolve; let reject;
  const promise = new Promise((ok, error) => { resolve = ok; reject = error; });
  return { promise, resolve, reject };
}
function completarSolicitud() {
  fireEvent.change(screen.getByLabelText("Dependencia sugerida"), { target: { value: "4" } });
  fireEvent.change(screen.getByLabelText("Motivo de la solicitud"), { target: { value: "  Revisar competencia de prueba.  " } });
}
function formularioSolicitud() {
  return screen.getByRole("button", { name: "Enviar solicitud a Ventanilla" }).closest("form");
}
function simularApi(operacion) {
  solicitarApi.mockImplementation((ruta, opciones) => ruta === "/api/traslados/dependencias"
    ? Promise.resolve(json({ success: true, dependencias })) : operacion(ruta, opciones));
}
const peticionesOperacion = () => solicitarApi.mock.calls.filter(([ruta]) => ruta !== "/api/traslados/dependencias");
async function esperarDestinos() {
  await screen.findByRole("option", { name: "Destino B" });
}
async function abrirDecisiones() {
  const botones = await screen.findAllByRole("button", { name: "Resolver traslado" });
  await act(async () => botones.forEach((boton) => fireEvent.click(boton)));
}

describe("solicitud de traslado", () => {
  it("distingue carga, error y reintento sin permitir envíos sin destinos", async () => {
    const lenta = diferida();
    solicitarApi.mockReturnValueOnce(lenta.promise)
      .mockResolvedValueOnce(json({ success: true, dependencias }));
    render(<SolicitudTraslado radicado={radicado} alCerrar={vi.fn()} alGuardar={vi.fn()} />);
    expect(screen.getByText("Cargando dependencias de destino…")).toBeTruthy();
    expect(screen.getByLabelText("Dependencia sugerida").disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Enviar solicitud a Ventanilla" }).disabled).toBe(true);
    await act(async () => lenta.reject(new Error("No se pudo consultar el catálogo")));
    expect(screen.getByRole("alert").textContent).toBe("No se pudo consultar el catálogo");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar dependencias de destino" }));
    await esperarDestinos();
    expect(screen.getByLabelText("Dependencia sugerida").disabled).toBe(false);
    expect(solicitarApi.mock.calls.map(([ruta]) => ruta)).toEqual([
      "/api/traslados/dependencias", "/api/traslados/dependencias",
    ]);
  });

  it.each([{ catalogo: [] }, { catalogo: [dependencias[0], dependencias[3]] }])("avisa si no hay destinos elegibles: $catalogo", async ({ catalogo }) => {
    solicitarApi.mockResolvedValue(json({ success: true, dependencias: catalogo }));
    render(<SolicitudTraslado radicado={radicado} alCerrar={vi.fn()} alGuardar={vi.fn()} />);
    await screen.findByText("No hay otras dependencias activas disponibles para el traslado.");
    expect(screen.getByLabelText("Dependencia sugerida").disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Enviar solicitud a Ventanilla" }).disabled).toBe(true);
  });

  it("expone un catálogo mal formado como error, no como ausencia de destinos", async () => {
    solicitarApi.mockResolvedValue(json({ success: true, dependencias: [{ nombre: "Inválida" }] }));
    render(<SolicitudTraslado radicado={radicado} alCerrar={vi.fn()} alGuardar={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain("respuesta inválida");
    expect(screen.queryByText("No hay otras dependencias activas disponibles para el traslado.")).toBeNull();
  });

  it("ignora el catálogo tardío después de cerrar el formulario", async () => {
    const lenta = diferida();
    solicitarApi.mockReturnValue(lenta.promise);
    const vista = render(<SolicitudTraslado radicado={radicado} alCerrar={vi.fn()} alGuardar={vi.fn()} />);
    vista.unmount();
    await act(async () => lenta.resolve(json({ success: true, dependencias })));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("envía una sola vez, no admite origen/inactivas y bloquea cierre durante confirmación", async () => {
    const pendiente = diferida();
    simularApi(() => pendiente.promise);
    const alCerrar = vi.fn(); const alGuardar = vi.fn();
    render(<SolicitudTraslado radicado={radicado} alCerrar={alCerrar} alGuardar={alGuardar} />);
    await esperarDestinos();
    expect(screen.queryByRole("option", { name: "Origen" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Inactiva" })).toBeNull();
    completarSolicitud();
    const formulario = formularioSolicitud();
    fireEvent.submit(formulario); fireEvent.submit(formulario);
    expect(peticionesOperacion()).toHaveLength(1);
    const datos = JSON.parse(peticionesOperacion()[0][1].body);
    expect(datos).toEqual({ clave_solicitud: expect.stringMatching(/^[a-f0-9-]{36}$/), destino_sugerido_id: 4, motivo: "Revisar competencia de prueba." });
    expect(screen.getByLabelText("Dependencia sugerida").disabled).toBe(true);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(alCerrar).not.toHaveBeenCalled();
    await act(async () => pendiente.resolve(json({ success: true, traslado })));
    expect(alGuardar).toHaveBeenCalledTimes(1);
  });

  it("conserva UUID y datos al perder la confirmación y no anuncia éxito", async () => {
    simularApi(vi.fn().mockRejectedValueOnce(Object.assign(new Error("Conexión perdida"), { resultadoIncierto: true }))
      .mockResolvedValueOnce(json({ success: true, traslado: { ...traslado, estado: "aprobada" } })));
    const alGuardar = vi.fn();
    render(<SolicitudTraslado radicado={radicado} alCerrar={vi.fn()} alGuardar={alGuardar} />);
    await esperarDestinos();
    completarSolicitud();
    fireEvent.submit(formularioSolicitud());
    await screen.findByText("Conexión perdida");
    expect(alGuardar).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Motivo de la solicitud").disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar confirmación" }));
    await waitFor(() => expect(alGuardar).toHaveBeenCalledTimes(1));
    expect(peticionesOperacion()[0][1].body).toBe(peticionesOperacion()[1][1].body);
  });

  it("un rechazo definitivo permite corregir y genera otra clave", async () => {
    simularApi(vi.fn().mockRejectedValueOnce(Object.assign(new Error("Destino inactivo"), { status: 400 }))
      .mockResolvedValueOnce(json({ success: true, traslado })));
    render(<SolicitudTraslado radicado={radicado} alCerrar={vi.fn()} alGuardar={vi.fn()} />);
    await esperarDestinos();
    completarSolicitud();
    fireEvent.submit(formularioSolicitud());
    await screen.findByText("Destino inactivo");
    expect(screen.getByLabelText("Dependencia sugerida").disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Dependencia sugerida"), { target: { value: "5" } });
    fireEvent.submit(formularioSolicitud());
    await waitFor(() => expect(peticionesOperacion()).toHaveLength(2));
    const primera = JSON.parse(peticionesOperacion()[0][1].body);
    const segunda = JSON.parse(peticionesOperacion()[1][1].body);
    expect(segunda.clave_solicitud).not.toBe(primera.clave_solicitud);
    expect(segunda.destino_sugerido_id).toBe(5);
  });

  it("una confirmación incompleta conserva el intento para consultar o reintentar", async () => {
    simularApi(() => Promise.resolve(json({ success: true })));
    const alGuardar = vi.fn();
    render(<SolicitudTraslado radicado={radicado} alCerrar={vi.fn()} alGuardar={alGuardar} />);
    await esperarDestinos();
    completarSolicitud();
    fireEvent.submit(formularioSolicitud());
    await screen.findByRole("alert");
    expect(alGuardar).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Reintentar confirmación" })).toBeTruthy();
  });
});

describe("bandeja de traslados", () => {
  it("comparte un catálogo entre decisiones y descarta la lectura de la sesión anterior", async () => {
    const lenta = diferida();
    let lecturas = 0;
    solicitarApi.mockImplementation(async (ruta) => {
      if (ruta === "/api/traslados/dependencias") {
        return ++lecturas === 1 ? lenta.promise : json({ success: true, dependencias });
      }
      return bandeja([traslado, { ...traslado, id: 2, numero_radicado: "RAD-002" }]);
    });
    const vista = render(<BandejaTraslados usuario={{ id: 1, rol: "ventanilla" }} revision={0} alGuardar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Gestionar traslados" }));
    await abrirDecisiones();
    await screen.findAllByRole("form");
    expect(lecturas).toBe(1);
    vista.rerender(<BandejaTraslados usuario={{ id: 2, rol: "administrador" }} revision={0} alGuardar={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByRole("option", { name: "Destino B" })).toHaveLength(2));
    await act(async () => lenta.resolve(json({ success: true, dependencias: [] })));
    expect(screen.getAllByRole("option", { name: "Destino B" })).toHaveLength(2);
    expect(lecturas).toBe(2);
  });

  it("permite rechazar aunque el catálogo falle y recupera las opciones de aprobación", async () => {
    let lecturas = 0;
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta === "/api/traslados/dependencias") {
        if (++lecturas === 1) throw new Error("Destinos no disponibles");
        return json({ success: true, dependencias });
      }
      return opciones ? json({ success: true, traslado: { ...traslado, estado: "rechazada" } }) : bandeja();
    });
    render(<BandejaTraslados usuario={{ rol: "ventanilla" }} revision={0} alGuardar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Gestionar traslados" }));
    await abrirDecisiones();
    await screen.findByRole("form");
    await screen.findByText("Destinos no disponibles");
    expect(screen.getByRole("button", { name: "Confirmar decisión" }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Decisión de Ventanilla"), { target: { value: "rechazada" } });
    expect(screen.getByRole("button", { name: "Confirmar decisión" }).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Decisión de Ventanilla"), { target: { value: "aprobada" } });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar dependencias de destino" }));
    await esperarDestinos();
    expect(screen.getByRole("button", { name: "Confirmar decisión" }).disabled).toBe(false);
    expect(lecturas).toBe(2);
  });

  it("no carga hasta abrirla y el funcionario conserva solo comprobantes sin decisiones", async () => {
    solicitarApi.mockResolvedValue(bandeja([{ ...traslado, estado: "aprobada", destino_aprobado_nombre: "Destino B" }]));
    render(<BandejaTraslados usuario={{ rol: "funcionario" }} revision={0} alGuardar={vi.fn()} />);
    expect(solicitarApi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mis solicitudes de traslado" }));
    const tarjeta = await screen.findByRole("article", { name: "Traslado RAD-001" });
    fireEvent.click(within(tarjeta).getByText("Ver motivos y trazabilidad"));
    expect(within(tarjeta).getByText("Actor fixture")).toBeTruthy();
    expect(within(tarjeta).getByText("2026-11-20")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmar decisión" })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(solicitarApi.mock.calls[0][0]).toBe("/api/traslados?pagina=1&estado=pendiente");
  });

  it.each(["ventanilla", "administrador"])("permite a %s aprobar con destino confirmado y refresca", async (rol) => {
    simularApi(async (ruta, opciones) => opciones
      ? json({ success: true, traslado: { ...traslado, estado: "aprobada" } }) : bandeja());
    const alGuardar = vi.fn();
    render(<BandejaTraslados usuario={{ rol }} revision={0} alGuardar={alGuardar} />);
    fireEvent.click(screen.getByRole("button", { name: "Gestionar traslados" }));
    await screen.findByRole("article");
    await abrirDecisiones();
    await esperarDestinos();
    fireEvent.change(screen.getByLabelText("Destino aprobado"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/Justificación/), { target: { value: "Se cambia destino por competencia." } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar decisión" }));
    await waitFor(() => expect(alGuardar).toHaveBeenCalledTimes(1));
    const peticion = solicitarApi.mock.calls.find(([, opciones]) => opciones);
    expect(peticion[0]).toBe("/api/traslados/1/decision");
    expect(JSON.parse(peticion[1].body)).toEqual({ decision: "aprobada", destino_id: 5, motivo: "Se cambia destino por competencia." });
    await waitFor(() => expect(peticionesOperacion().filter(([, opciones]) => !opciones)).toHaveLength(2));
  });

  it("rechaza sin destino y conserva la decisión exacta tras un 500", async () => {
    let envios = 0;
    simularApi(async (ruta, opciones) => {
      if (!opciones) return bandeja();
      if (++envios === 1) throw Object.assign(new Error("Fallo al confirmar"), { status: 500 });
      return json({ success: true, traslado: { ...traslado, estado: "rechazada" } });
    });
    const alGuardar = vi.fn();
    render(<BandejaTraslados usuario={{ rol: "ventanilla" }} revision={0} alGuardar={alGuardar} />);
    fireEvent.click(screen.getByRole("button", { name: "Gestionar traslados" }));
    await screen.findByRole("article");
    await abrirDecisiones();
    fireEvent.change(screen.getByLabelText("Decisión de Ventanilla"), { target: { value: "rechazada" } });
    fireEvent.change(screen.getByLabelText(/Justificación/), { target: { value: "El origen debe continuar con su tramite." } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar decisión" }));
    await screen.findByText("Fallo al confirmar");
    expect(screen.getByLabelText("Decisión de Ventanilla").disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Cerrar decisión" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Ocultar traslados" }).disabled).toBe(true);
    expect(screen.getByLabelText("Estado del traslado").disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Actualizar traslados" }).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar decisión" }));
    expect(screen.getByRole("form", { name: "Resolver traslado RAD-001" })).toBeTruthy();
    expect(screen.queryByLabelText("Destino aprobado")).toBeNull();
    expect(alGuardar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar decisión" }));
    await waitFor(() => expect(alGuardar).toHaveBeenCalledTimes(1));
    const cuerpos = solicitarApi.mock.calls.filter(([, opciones]) => opciones).map(([, opciones]) => opciones.body);
    expect(cuerpos[0]).toBe(cuerpos[1]);
    expect(JSON.parse(cuerpos[0]).destino_id).toBeUndefined();
  });

  it("bloquea recarga, cierre y doble decisión mientras se confirma", async () => {
    const pendiente = diferida();
    simularApi((ruta, opciones) => opciones ? pendiente.promise : Promise.resolve(bandeja()));
    render(<BandejaTraslados usuario={{ rol: "ventanilla" }} revision={0} alGuardar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Gestionar traslados" }));
    await abrirDecisiones();
    const formulario = await screen.findByRole("form", { name: "Resolver traslado RAD-001" });
    await esperarDestinos();
    fireEvent.submit(formulario); fireEvent.submit(formulario);
    expect(solicitarApi.mock.calls.filter(([, opciones]) => opciones)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Actualizar traslados" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Ocultar traslados" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Cerrar decisión" }).disabled).toBe(true);
    await act(async () => pendiente.resolve(json({ success: true, traslado })));
  });

  it("descarta lecturas tardías al cambiar el filtro y pagina sin duplicar registros", async () => {
    const lenta = diferida();
    solicitarApi.mockReturnValueOnce(lenta.promise).mockResolvedValueOnce(json({
      success: true, traslados: [{ ...traslado, estado: "rechazada" }], total: 26, paginas: 2, pendientes: 0,
    })).mockResolvedValueOnce(bandeja([]));
    render(<BandejaTraslados usuario={{ rol: "funcionario" }} revision={0} alGuardar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mis solicitudes de traslado" }));
    fireEvent.change(screen.getByLabelText("Estado del traslado"), { target: { value: "rechazada" } });
    const tarjeta = await screen.findByRole("article", { name: "Traslado RAD-001" });
    expect(within(tarjeta).getByText("Rechazada")).toBeTruthy();
    await act(async () => lenta.resolve(bandeja()));
    expect(within(tarjeta).queryByText("Pendiente de Ventanilla")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("No hay solicitudes para mostrar.");
    expect(solicitarApi.mock.calls[2][0]).toBe("/api/traslados?pagina=2&estado=rechazada");
  });

  it("expone errores de carga y permite recuperar la bandeja", async () => {
    solicitarApi.mockRejectedValueOnce(new Error("Servidor no disponible")).mockResolvedValueOnce(bandeja([]));
    render(<BandejaTraslados usuario={{ rol: "funcionario" }} revision={0} alGuardar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mis solicitudes de traslado" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Actualizar traslados" }));
    await screen.findByText("Sin traslados pendientes");
  });

  it.each(["ventanilla", "administrador", "funcionario"])("presenta resumen y detalles bajo demanda para %s", async (rol) => {
    simularApi(async () => bandeja());
    render(<BandejaTraslados usuario={{ rol }} revision={0} alGuardar={vi.fn()} />);
    const titulo = rol === "funcionario" ? "Solicitudes de mi dependencia de origen" : "Revisión de Ventanilla";
    expect(screen.getAllByRole("heading", { name: titulo })).toHaveLength(1);
    expect(solicitarApi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: rol === "funcionario" ? "Mis solicitudes de traslado" : "Gestionar traslados" }));
    const tarjeta = await screen.findByRole("article", { name: "Traslado RAD-001" });
    expect(screen.getAllByRole("heading", { name: titulo })).toHaveLength(1);
    expect(within(tarjeta).getByText("Destino sugerido")).toBeTruthy();
    expect(within(tarjeta).getByText("2026-11-20")).toBeTruthy();
    const detalles = within(tarjeta).getByText("Ver motivos y trazabilidad").closest("details");
    expect(detalles.open).toBe(false);
    fireEvent.click(within(tarjeta).getByText("Ver motivos y trazabilidad"));
    expect(detalles.open).toBe(true);
    expect(within(detalles).getByText("Revisar competencia de prueba.")).toBeTruthy();
    expect(within(detalles).getByText("Solicitud (Bogotá)")).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
    if (rol === "funcionario") expect(screen.queryByRole("button", { name: "Resolver traslado" })).toBeNull();
    else {
      await abrirDecisiones();
      expect(screen.getByRole("form", { name: "Resolver traslado RAD-001" })).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByLabelText("Decisión de Ventanilla"));
      fireEvent.click(screen.getByRole("button", { name: "Cerrar decisión" }));
      expect(screen.queryByRole("form")).toBeNull();
      expect(screen.getByRole("button", { name: "Resolver traslado" })).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Resolver traslado" }));
    }
  });

  it.each([
    ["pendiente", "Pendiente de Ventanilla"], ["aprobada", "Aprobada"],
    ["rechazada", "Rechazada"], ["cancelada_por_finalizacion", "Cancelada por finalización"],
  ])("identifica el estado %s y mantiene todos sus datos sin decisiones no permitidas", async (estado, nombre) => {
    const registro = { ...traslado, estado, destino_aprobado_nombre: estado === "aprobada" ? "Destino C" : null };
    simularApi(async () => bandeja([registro]));
    render(<BandejaTraslados usuario={{ rol: "ventanilla" }} revision={0} alGuardar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Gestionar traslados" }));
    const tarjeta = await screen.findByRole("article");
    expect(within(tarjeta).getByText(nombre).className).toContain(`traslados-estado--${estado}`);
    const resumen = tarjeta.querySelector(".traslados-resumen-tarjeta");
    expect(within(resumen).getByText(estado === "aprobada" ? "Destino aprobado" : "Destino sugerido")).toBeTruthy();
    expect(within(resumen).getByText(estado === "aprobada" ? "Destino C" : "Destino B")).toBeTruthy();
    expect(within(tarjeta).queryByRole("button", { name: "Resolver traslado" }) !== null).toBe(estado === "pendiente");
  });

  it("diferencia el contador del filtro, el vacío y la navegación a todos los estados", async () => {
    solicitarApi.mockResolvedValue(json({ success: true, traslados: [], total: 0, paginas: 0, pendientes: 3 }));
    render(<BandejaTraslados usuario={{ rol: "funcionario" }} revision={0} alGuardar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mis solicitudes de traslado" }));
    await screen.findByText("Sin traslados pendientes");
    const resumen = screen.getByRole("status");
    expect(within(resumen).getByText("3")).toBeTruthy();
    expect(within(resumen).getByText("0")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Paginación de traslados" })).toBeNull();
    expect(screen.queryByRole("article")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver todos los estados" }));
    await screen.findByText("Aún no hay solicitudes de traslado en esta bandeja.");
    expect(solicitarApi.mock.calls.at(-1)[0]).toBe("/api/traslados?pagina=1&estado=");
    expect(screen.queryByRole("button", { name: "Ver todos los estados" })).toBeNull();
  });

  it("no presenta un error como bandeja vacía y conserva carga explícita", async () => {
    const lenta = diferida();
    solicitarApi.mockReturnValue(lenta.promise);
    render(<BandejaTraslados usuario={{ rol: "funcionario" }} revision={0} alGuardar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mis solicitudes de traslado" }));
    expect(screen.getByText("Cargando traslados…")).toBeTruthy();
    expect(screen.queryByText("Sin traslados pendientes")).toBeNull();
    await act(async () => lenta.reject(new Error("Error de prueba")));
    expect(screen.getByRole("alert").textContent).toBe("Error de prueba");
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByText("Sin traslados pendientes")).toBeNull();
  });

  it("actualizar permite consultar un resultado incierto sin enviar otra decisión", async () => {
    simularApi(async (_, opciones) => {
      if (opciones) throw Object.assign(new Error("Confirmación incierta"), { status: 500 });
      return bandeja();
    });
    render(<BandejaTraslados usuario={{ rol: "ventanilla" }} revision={0} alGuardar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Gestionar traslados" }));
    await abrirDecisiones();
    await esperarDestinos();
    fireEvent.change(screen.getByLabelText(/Justificación/), { target: { value: "Motivo de prueba completo." } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar decisión" }));
    await screen.findByText("Confirmación incierta");
    fireEvent.click(screen.getByRole("button", { name: "Actualizar traslados" }));
    await screen.findByRole("button", { name: "Resolver traslado" });
    expect(solicitarApi.mock.calls.filter(([, opciones]) => opciones)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Ocultar traslados" }).disabled).toBe(false);
  });

  it("muestra ausencias explícitas sin inventar origen, fechas ni actores", async () => {
    const registro = { ...traslado, origen_nombre: null, destino_sugerido_nombre: null,
      solicitante_nombre: null, creado_en_utc: null, motivo_solicitud: null, fecha_limite_conservada: null };
    solicitarApi.mockResolvedValue(bandeja([registro]));
    render(<BandejaTraslados usuario={{ rol: "funcionario" }} revision={0} alGuardar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mis solicitudes de traslado" }));
    const tarjeta = await screen.findByRole("article");
    expect(within(tarjeta).getByText("Sin origen registrado")).toBeTruthy();
    expect(within(tarjeta).getByText("Sin destino sugerido registrado")).toBeTruthy();
    expect(within(tarjeta).getByText("Sin plazo de respuesta registrado")).toBeTruthy();
    fireEvent.click(within(tarjeta).getByText("Ver motivos y trazabilidad"));
    for (const texto of ["Sin solicitante registrado", "Sin fecha de solicitud registrada", "Sin motivo registrado", "Sin decisor registrado", "Sin decisión", "Sin justificación registrada"])
      expect(within(tarjeta).getByText(texto)).toBeTruthy();
  });
});
