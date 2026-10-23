import { describe, expect, it } from "vitest";
import {
  convertirFechaBogota, obtenerFechaBogota, obtenerDiaRadicacion, formatearFechaRadicacion,
} from "../../src/servicios/fechas";

describe("fechas de radicacion en Bogota", () => {
  it.each([
    ["2026-01-01 00:00:00", "2026-01-01T05:00:00.000Z", "2026-01-01"],
    ["2026-01-01T04:59:59Z", "2026-01-01T04:59:59.000Z", "2025-12-31"],
    ["2026-03-01T00:15:00+02:00", "2026-02-28T22:15:00.000Z", "2026-02-28"],
    ["2026-10-23T23:30:00-0500", "2026-10-24T04:30:00.000Z", "2026-10-23"],
    ["2024-02-29", "2024-02-29T05:00:00.000Z", "2024-02-29"],
    ["2026-10-23 10:30:00.123456", "2026-10-23T15:30:00.123Z", "2026-10-23"],
  ])("interpreta %s sin depender de la zona del equipo", (valor, iso, dia) => {
    expect(convertirFechaBogota(valor).toISOString()).toBe(iso);
    expect(obtenerFechaBogota(valor)).toBe(dia);
    expect(obtenerFechaBogota(new Date(iso))).toBe(dia);
  });

  it.each([null, "", undefined, 123, "texto", "2026-02-29", "2026-02-30 12:00:00",
    "2026-13-01", "2026-01-01 24:00:00", "2026-01-01T12:60:00Z",
    "2026-01-01T12:00:00+25:00", "2026-01-01T12:00:00-05:60", new Date(NaN)])(
    "rechaza fecha imposible o formato invalido %s", (valor) => {
      expect(convertirFechaBogota(valor)).toBeNull();
    },
  );

  it("prioriza recepcion y solo respalda una recepcion ausente", () => {
    const radicado = { fecha_hora_recepcion: "2026-01-01 23:30:00", fecha_creacion: "2026-01-02 10:00:00" };
    expect(obtenerDiaRadicacion(radicado)).toBe("2026-01-01");
    expect(formatearFechaRadicacion(radicado)).toBe(new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "medium",
    }).format(new Date("2026-01-02T04:30:00Z")));
    for (const ausente of [null, undefined, "", "  "]) {
      expect(obtenerDiaRadicacion({ ...radicado, fecha_hora_recepcion: ausente })).toBe("2026-01-02");
    }
    for (const invalida of ["2026-02-30", "invalida"]) {
      const datos = { ...radicado, fecha_hora_recepcion: invalida };
      expect(obtenerDiaRadicacion(datos)).toBeNull();
      expect(formatearFechaRadicacion(datos)).toBe("Fecha no válida");
    }
    expect(formatearFechaRadicacion({})).toBe("Fecha no disponible");
  });
});
