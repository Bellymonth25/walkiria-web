import { describe, expect, it } from "vitest";
import {
  alEscanear,
  corteDeSemana,
  diasDeSemana,
  leerEmpleado,
  leerMarcas,
  leerDiaPago,
  leerQr,
  nuevoCodigo,
  pendientes,
  resumenDia,
  semanaEnCurso,
  textoPeriodo,
  textoQr,
  validarEmpleado,
  idPago,
  periodoSemana,
  type Empleado,
  type Marca,
} from "../src/lib/asistencias";

const emp = (id: string, frecuencia: "DIA" | "SEMANA", pagoDia = 400, extra: Partial<Empleado> = {}): Empleado => ({ id, nombre: id, pagoDia, frecuencia, activo: true, qr: "", ...extra });
const vino = (pago: number): Marca => ({ estado: "VINO", pago });
const falto: Marca = { estado: "FALTO", pago: 0 };
const SAB = 6;

describe("lectura", () => {
  it("empleado con datos raros toma valores seguros", () => {
    expect(leerEmpleado("a", { nombre: " Ana ", pagoDia: "350", frecuencia: "x" })).toEqual({ id: "a", nombre: "Ana", pagoDia: 350, frecuencia: "DIA", activo: true, qr: "" });
    expect(leerEmpleado("b", { activo: false, frecuencia: "SEMANA", pagoDia: -5 }).pagoDia).toBe(0);
  });
  it("marcas: ignora estados desconocidos y pone 0 a las faltas", () => {
    expect(leerMarcas({ marcas: { a: { estado: "VINO", pago: 300 }, b: { estado: "FALTO", pago: 300 }, c: { estado: "?" } } })).toEqual({ a: vino(300), b: falto });
    expect(leerMarcas(undefined)).toEqual({});
  });
  it("día de pago: sábado si no es válido", () => {
    expect(leerDiaPago(undefined)).toBe(6);
    expect(leerDiaPago(1)).toBe(1);
    expect(leerDiaPago(9)).toBe(6);
  });
});

describe("validar empleado", () => {
  const otros = [emp("Ana", "DIA"), emp("Beto", "DIA", 300, { activo: false })];
  it("pide nombre y sueldo", () => {
    expect(validarEmpleado({ nombre: " ", pagoDia: 300 }, otros)).toMatch(/nombre/);
    expect(validarEmpleado({ nombre: "Carla", pagoDia: 0 }, otros)).toMatch(/por día/);
  });
  it("no repite nombre de un activo, pero sí de uno desactivado o de sí mismo", () => {
    expect(validarEmpleado({ nombre: "ana", pagoDia: 300 }, otros)).toMatch(/Ya hay/);
    expect(validarEmpleado({ nombre: "Ana", pagoDia: 300 }, otros, "Ana")).toBeNull();
    expect(validarEmpleado({ nombre: "Beto", pagoDia: 300 }, otros)).toBeNull();
  });
});

describe("semanas", () => {
  // 2026-11-27 es viernes; 2026-11-28 sábado.
  it("el corte es el siguiente día de pago (o el mismo día)", () => {
    expect(corteDeSemana("2026-11-27", SAB)).toBe("2026-11-28");
    expect(corteDeSemana("2026-11-28", SAB)).toBe("2026-11-28");
    expect(corteDeSemana("2026-11-29", SAB)).toBe("2026-12-05");
  });
  it("la semana son los 7 días que terminan en el corte", () => {
    expect(diasDeSemana("2026-11-28")).toEqual(["2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"]);
  });
});

describe("resumen del día", () => {
  it("cuenta vinieron, faltaron y sin marcar", () => {
    expect(resumenDia([emp("a", "DIA"), emp("b", "DIA"), emp("c", "DIA")], { a: vino(1), b: falto })).toEqual({ vinieron: 1, faltaron: 1, sinMarcar: 1 });
  });
});

describe("pendientes", () => {
  const ana = emp("ana", "DIA", 400);
  const beto = emp("beto", "SEMANA", 300);
  const asist = new Map<string, Record<string, Marca>>([
    ["2026-11-23", { ana: vino(400), beto: vino(300) }],
    ["2026-11-24", { ana: falto, beto: vino(300) }],
    ["2026-11-27", { ana: vino(450), beto: vino(300) }],
    ["2026-11-28", { ana: vino(450), beto: falto }],
  ]);

  it("viernes: los diarios que vinieron, la semana todavía no", () => {
    const r = pendientes([ana, beto], asist, [], "2026-11-27", SAB);
    expect(r.map((p) => [p.empleado.id, p.fecha, p.monto])).toEqual([
      ["ana", "2026-11-23", 400],
      ["ana", "2026-11-27", 450],
    ]);
  });

  it("sábado (día de pago): sale la semana con sus días; lo pagado ya no sale", () => {
    const pagos = [{ empleadoId: "ana", periodo: "2026-11-23", monto: 400 }];
    const r = pendientes([ana, beto], asist, pagos, "2026-11-28", SAB);
    expect(r.map((p) => [p.empleado.id, p.periodo, p.dias, p.monto])).toEqual([
      ["ana", "2026-11-27", 1, 450],
      ["ana", "2026-11-28", 1, 450],
      ["beto", "S2026-11-28", 3, 900],
    ]);
  });

  it("si se marca un día después de pagar la semana, sale solo la diferencia", () => {
    const pagos = [{ empleadoId: "beto", periodo: periodoSemana("2026-11-28"), monto: 600 }];
    const r = pendientes([beto], asist, pagos, "2026-11-30", SAB);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ total: 900, yaPagado: 600, monto: 300 });
  });

  it("ignora lo de hace más de 35 días y lo de días futuros", () => {
    const viejo = new Map([["2026-10-01", { ana: vino(400) }], ["2026-12-01", { ana: vino(400) }]]);
    expect(pendientes([ana], viejo, [], "2026-11-27", SAB)).toEqual([]);
  });

  it("al desactivado todavía se le debe lo que trabajó", () => {
    expect(pendientes([{ ...ana, activo: false }], asist, [], "2026-11-23", SAB)).toHaveLength(1);
  });

  it("semana en curso: lo acumulado de los semanales; vacío el día de pago", () => {
    const r = semanaEnCurso([ana, beto], asist, "2026-11-27", SAB);
    expect(r.corte).toBe("2026-11-28");
    expect(r.lista.map((a) => [a.empleado.id, a.dias, a.monto])).toEqual([["beto", 3, 900]]);
    expect(semanaEnCurso([beto], asist, "2026-11-28", SAB).lista).toEqual([]);
  });

  it("texto del periodo", () => {
    const [d] = pendientes([ana], asist, [], "2026-11-27", SAB).slice(-1);
    expect(textoPeriodo(d!, "2026-11-27")).toBe("Hoy");
    const [s] = pendientes([beto], asist, [], "2026-11-28", SAB);
    expect(textoPeriodo(s!, "2026-11-28")).toBe("Semana Dom 22 – Sáb 28 nov · 3 días");
  });

  it("id del pago fijo por empleado y periodo", () => {
    expect(idPago("ana", "2026-11-27")).toBe("ana_2026-11-27");
  });
});

describe("gafetes QR", () => {
  it("el código sale del QR solo si es de La Walkiria", () => {
    const c = nuevoCodigo();
    expect(c).toMatch(/^[A-Z2-9]{10}$/);
    expect(leerQr(textoQr(c))).toBe(c);
    expect(leerQr("https://otra.cosa")).toBeNull();
    expect(leerQr("WLK-EMP:ab")).toBeNull();
  });
  it("al escanear: registra, avisa si ya estaba, si está dado de baja o si no lo conoce", () => {
    const ana = emp("ana", "DIA", 400, { qr: "AAAA2222" });
    const beto = emp("beto", "DIA", 400, { qr: "BBBB2222", activo: false });
    expect(alEscanear("AAAA2222", [ana, beto], {})).toEqual({ tipo: "registrado", empleado: ana });
    expect(alEscanear("AAAA2222", [ana], { ana: vino(400) }).tipo).toBe("yaEstaba");
    expect(alEscanear("AAAA2222", [ana], { ana: falto }).tipo).toBe("registrado");
    expect(alEscanear("BBBB2222", [beto], {}).tipo).toBe("inactivo");
    expect(alEscanear("ZZZZ2222", [ana], {}).tipo).toBe("desconocido");
    expect(alEscanear("", [{ ...ana, qr: "" }], {}).tipo).toBe("desconocido");
  });
});
