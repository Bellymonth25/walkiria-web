import "./styles.css";
import "./admin.css";
import "./asistencias.css";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  documentId,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  addDoc,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import QRCode from "qrcode";
import { firebaseWeb } from "./data/temporada";
import { motivoDeError } from "./lib/admin";
import {
  DIAS_ATRAS,
  DIAS_SEMANA,
  DIA_PAGO_DEFAULT,
  alEscanear,
  etiquetaFecha,
  idPago,
  leerDiaPago,
  leerEmpleado,
  leerMarcas,
  leerQr,
  nuevoCodigo,
  ordenar,
  pendientes,
  resumenDia,
  semanaEnCurso,
  textoPeriodo,
  textoQr,
  validarEmpleado,
  type Empleado,
  type Estado,
  type Frecuencia,
  type Marca,
  type Pago,
  type Pendiente,
} from "./lib/asistencias";
import { aIso, deIso, nombreFecha, sumarDias } from "./lib/fechas";
import { dinero, escapar } from "./lib/formato";
import { $ } from "./ui/dom";

(window as { __adminArranco?: boolean }).__adminArranco = true;

const vistas = { sinConfig: $("#sinConfig"), entrar: $("#entrar"), panel: $("#panel"), cargando: $("#cargando") };
const salir = $<HTMLButtonElement>("#salir");

function mostrar(v: keyof typeof vistas): void {
  for (const [k, el] of Object.entries(vistas)) el.hidden = k !== v;
  salir.hidden = v !== "panel";
}

let temporizador: number | undefined;
function aviso(texto: string, error = false): void {
  const el = $("#toast");
  el.textContent = texto;
  el.classList.toggle("error", error);
  el.hidden = false;
  window.clearTimeout(temporizador);
  temporizador = window.setTimeout(() => (el.hidden = true), error ? 5000 : 2200);
}

const hoyIso = (): string => aIso(new Date());

if (!firebaseWeb.apiKey || !firebaseWeb.appId) mostrar("sinConfig");
else iniciar();

interface PagoHecho extends Pago {
  id: string;
  fecha: string;
  dias: number;
  en: Date | null;
}

function iniciar(): void {
  const app = initializeApp(firebaseWeb);
  const auth = getAuth(app);
  const db = getFirestore(app);

  let empleados: Empleado[] = [];
  /** fecha → marcas */
  const asistencias = new Map<string, Record<string, Marca>>();
  let pagos: PagoHecho[] = [];
  let diaPago = DIA_PAGO_DEFAULT;
  /** Día que se ve en la lista de asistencia (se puede ir a días pasados para corregir). */
  let dia = hoyIso();
  let hoy = hoyIso();
  const escuchas: Unsubscribe[] = [];
  /** Empleados (o pagos) que se están guardando: su botón muestra el circulito. */
  const guardando = new Set<string>();

  // ---------- Entrar / salir ----------
  const errorEntrar = $("#errorEntrar");
  const error = (t: string) => {
    errorEntrar.textContent = t;
    errorEntrar.hidden = false;
  };
  $<HTMLFormElement>("#formEntrar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const correo = $<HTMLInputElement>("#correo").value.trim();
    const clave = $<HTMLInputElement>("#clave").value;
    if (!correo || !clave) return error("Escribe tu correo y contraseña.");
    const btn = $<HTMLButtonElement>("#btnEntrar");
    btn.disabled = true;
    btn.textContent = "Entrando…";
    try {
      await signInWithEmailAndPassword(auth, correo, clave);
      errorEntrar.hidden = true;
    } catch {
      error("Correo o contraseña incorrectos.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });
  salir.addEventListener("click", () => void signOut(auth));

  onAuthStateChanged(auth, async (u) => {
    escuchas.splice(0).forEach((f) => f());
    if (!u) return mostrar("entrar");
    mostrar("cargando");
    const permiso = await esAdmin(u);
    if (!permiso.ok) {
      await signOut(auth);
      error(permiso.motivo);
      return;
    }
    // "Productos" (súper panel) solo para súper admins.
    $("#navProductos").hidden = !permiso.superadmin;
    escuchar();
  });

  /** Entran súper admins y usuarios ADMIN de la app (`user/{uid}.type`). */
  async function esAdmin(u: User): Promise<{ ok: true; superadmin: boolean } | { ok: false; motivo: string }> {
    try {
      const [sa, us] = await Promise.all([
        getDoc(doc(db, "superadmins", u.uid)).catch(() => null),
        getDoc(doc(db, "user", u.uid)).catch(() => null),
      ]);
      const superadmin = !!sa?.exists();
      if (superadmin || us?.get("type") === "ADMIN") return { ok: true, superadmin };
      return { ok: false, motivo: "Asistencias es solo para administradores. Pide que tu usuario sea ADMIN en la app." };
    } catch (e) {
      return { ok: false, motivo: motivoDeError((e as { code?: string }).code) };
    }
  }

  // ---------- Datos en tiempo real ----------
  function escuchar(): void {
    const desde = aIso(sumarDias(new Date(), -(DIAS_ATRAS + 7)));
    let listos = 0;
    const listo = () => {
      if (++listos === 3) mostrar("panel");
      pintar();
    };
    const fallo = (que: string) => (e: unknown) => {
      console.error(`asistencias: no se pudo leer ${que}`, e);
      aviso(`No se pudieron leer ${que}. Revisa las reglas de Firestore.`, true);
      mostrar("panel");
    };
    escuchas.push(
      onSnapshot(
        collection(db, "empleados"),
        (s) => {
          empleados = ordenar(s.docs.map((d) => leerEmpleado(d.id, d.data())));
          listo();
        },
        fallo("los empleados"),
      ),
      onSnapshot(
        query(collection(db, "asistencias"), where(documentId(), ">=", desde)),
        (s) => {
          asistencias.clear();
          s.docs.forEach((d) => asistencias.set(d.id, leerMarcas(d.data())));
          listo();
        },
        fallo("las asistencias"),
      ),
      onSnapshot(
        query(collection(db, "pagosEmpleados"), where("fecha", ">=", desde)),
        (s) => {
          pagos = s.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              empleadoId: String(x.empleadoId ?? ""),
              periodo: String(x.periodo ?? ""),
              fecha: String(x.fecha ?? ""),
              monto: Number(x.monto) || 0,
              dias: Number(x.dias) || 0,
              en: (x.en as Timestamp | null)?.toDate?.() ?? null,
            };
          });
          listo();
        },
        fallo("los pagos"),
      ),
      onSnapshot(
        doc(db, "asistenciasConfig", "general"),
        (s) => {
          diaPago = leerDiaPago(s.get("diaPago"));
          pintar();
        },
        () => {},
      ),
    );
  }

  // A medianoche (si la tablet se queda prendida) cambia el día solo.
  window.setInterval(() => {
    const ahora = hoyIso();
    if (ahora === hoy) return;
    if (dia === hoy) dia = ahora;
    hoy = ahora;
    pintar();
  }, 30_000);

  // ---------- Pintar ----------
  const activos = () => empleados.filter((e) => e.activo);
  const marcasDe = (f: string) => asistencias.get(f) ?? {};

  function pintar(): void {
    pintarDia();
    pintarPagos();
    if ($<HTMLDialogElement>("#empleados").open) pintarEmpleados();
    if (!$("#checador").hidden) pintarChecador();
  }

  function pintarDia(): void {
    $("#tDia").textContent = dia === hoy ? "Hoy" : etiquetaFecha(dia, hoy);
    $("#tFecha").textContent = nombreFecha(dia);
    $<HTMLButtonElement>("#diaSiguiente").disabled = dia >= hoy;
    $("#irHoy").hidden = dia === hoy;

    const lista = activos();
    const marcas = marcasDe(dia);
    const r = resumenDia(lista, marcas);
    $("#conteo").innerHTML = lista.length
      ? `<span class="as-chip vino">${r.vinieron} ${r.vinieron === 1 ? "vino" : "vinieron"}</span>` +
        `<span class="as-chip falto">${r.faltaron} ${r.faltaron === 1 ? "faltó" : "faltaron"}</span>` +
        (r.sinMarcar ? `<span class="as-chip">${r.sinMarcar} sin marcar</span>` : "")
      : "";

    $("#listaDia").innerHTML = lista.length
      ? lista.map((e) => filaDia(e, marcas[e.id])).join("")
      : `<li class="as-vacio">Aún no hay empleados. Dalos de alta en <b>Empleados</b>.</li>`;

    $("#masivo").hidden = r.sinMarcar === 0;
    $("#masivoTxt").textContent = `${r.sinMarcar} sin marcar:`;
  }

  function filaDia(e: Empleado, m: Marca | undefined): string {
    const id = escapar(e.id);
    const n = escapar(e.nombre);
    const ocupado = guardando.has(e.id);
    const boton = (estado: Estado, texto: string) =>
      `<button type="button" class="as-marca ${estado === "VINO" ? "vino" : "falto"}" data-marcar="${id}" data-estado="${estado}" aria-pressed="${m?.estado === estado}"${ocupado ? " disabled" : ""}>${estado === "VINO" ? "✓" : "✕"} ${texto}</button>`;
    const pago = e.frecuencia === "DIA" ? "Pago diario" : "Pago semanal";
    return `<li class="as-fila${m ? ` ${m.estado === "VINO" ? "es-vino" : "es-falto"}` : ""}">
      <div class="as-nombre"><b>${n}</b><small>${pago}</small></div>
      <div class="as-botones" role="group" aria-label="${n}">${ocupado ? `<span class="adm-giro" aria-label="Guardando"></span>` : ""}${boton("VINO", "Vino")}${boton("FALTO", "Faltó")}</div>
    </li>`;
  }

  function pintarPagos(): void {
    const lista = pendientes(empleados, asistencias, pagos, hoy, diaPago);
    const total = lista.reduce((s, p) => s + p.monto, 0);
    $("#totalPagar").innerHTML = lista.length ? `<b>${dinero(total)}</b> · ${lista.length} ${lista.length === 1 ? "pago" : "pagos"}` : "";
    $("#nadaPagar").hidden = lista.length > 0;
    const ir = $("#irPagar");
    ir.hidden = lista.length === 0;
    ir.innerHTML = `<span>Por pagar</span><b>${dinero(total)}</b><span>${lista.length} ${lista.length === 1 ? "pago" : "pagos"} ↓</span>`;
    $("#listaPagar").innerHTML = lista.map(filaPago).join("");

    const s = semanaEnCurso(empleados, asistencias, hoy, diaPago);
    const sem = $("#semana");
    sem.hidden = s.lista.length === 0;
    if (s.lista.length) {
      const t = s.lista.reduce((a, x) => a + x.monto, 0);
      sem.innerHTML = `<p><b>Semana en curso</b> · se paga el ${DIAS_SEMANA[deIso(s.corte).getDay()]} ${deIso(s.corte).getDate()} · ${dinero(t)} hasta hoy</p>
        <ul>${s.lista.map((a) => `<li><span>${escapar(a.empleado.nombre)}</span><span>${a.dias} ${a.dias === 1 ? "día" : "días"} · ${dinero(a.monto)}</span></li>`).join("")}</ul>`;
    }

    // Pagos hechos hoy, por si hay que deshacer uno.
    const deHoy = pagos.filter((p) => p.en && aIso(p.en) === hoy);
    const pag = $<HTMLDetailsElement>("#pagados");
    pag.hidden = deHoy.length === 0;
    $("#pagadosTxt").textContent = `Pagados hoy (${deHoy.length}) · ${dinero(deHoy.reduce((a, p) => a + p.monto, 0))}`;
    $("#listaPagados").innerHTML = deHoy
      .map((p) => {
        const e = empleados.find((x) => x.id === p.empleadoId);
        const que = p.periodo.startsWith("S") ? `Semana · ${p.dias} ${p.dias === 1 ? "día" : "días"}` : etiquetaFecha(p.fecha, hoy);
        return `<li class="as-fila as-fila-pagada"><div class="as-nombre"><b>${escapar(e?.nombre ?? "—")}</b><small>${que}</small></div><span class="as-monto">${dinero(p.monto)}</span><button type="button" class="btn btn-ghost btn-sm" data-deshacer="${escapar(p.id)}">Deshacer</button></li>`;
      })
      .join("");
  }

  function filaPago(p: Pendiente): string {
    const id = idPago(p.empleado.id, p.periodo);
    const viejo = p.fecha < hoy;
    const extra = p.yaPagado > 0 ? ` · faltan ${dinero(p.monto)} de ${dinero(p.total)}` : "";
    return `<li class="as-fila as-fila-pago${viejo ? " atrasado" : ""}">
      <div class="as-nombre"><b>${escapar(p.empleado.nombre)}</b><small>${escapar(textoPeriodo(p, hoy))}${extra}${p.empleado.activo ? "" : " · ya no trabaja aquí"}</small></div>
      <span class="as-monto">${dinero(p.monto)}</span>
      <button type="button" class="btn btn-gold btn-sm as-pagar-btn" data-pagar="${escapar(id)}"${guardando.has(id) ? " disabled" : ""}>${guardando.has(id) ? "Guardando…" : "Pagado"}</button>
    </li>`;
  }

  // ---------- Acciones del día ----------
  const sello = () => ({ actualizadoEn: serverTimestamp(), actualizadoPor: auth.currentUser?.email ?? "" });

  async function marcar(ids: string[], estado: Estado | null, fecha: string): Promise<void> {
    const cambios: Record<string, unknown> = {};
    for (const id of ids) {
      const e = empleados.find((x) => x.id === id);
      if (!e) continue;
      cambios[id] = estado ? { estado, pago: estado === "VINO" ? e.pagoDia : 0, por: auth.currentUser?.email ?? "" } : deleteField();
    }
    const ref = doc(db, "asistencias", fecha);
    if (estado) await setDoc(ref, { marcas: cambios, ...sello() }, { merge: true });
    else await updateDoc(ref, { ...Object.fromEntries(Object.entries(cambios).map(([k, v]) => [`marcas.${k}`, v])), ...sello() });
  }

  $("#listaDia").addEventListener("click", async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-marcar]");
    if (!b) return;
    const id = b.dataset.marcar!;
    const estado = b.dataset.estado as Estado;
    // Tocar el que ya está marcado lo quita (queda "sin marcar").
    const nuevo = marcasDe(dia)[id]?.estado === estado ? null : estado;
    guardando.add(id);
    pintarDia();
    try {
      await marcar([id], nuevo, dia);
    } catch (e) {
      console.error(e);
      aviso(`No se pudo guardar (${(e as { code?: string }).code ?? "error"}).`, true);
    } finally {
      guardando.delete(id);
      pintar();
    }
  });

  async function marcarSinMarcar(estado: Estado): Promise<void> {
    const marcas = marcasDe(dia);
    const ids = activos().filter((e) => !marcas[e.id]).map((e) => e.id);
    if (!ids.length) return;
    try {
      await marcar(ids, estado, dia);
      aviso(`✓ ${ids.length} marcados como ${estado === "VINO" ? "Vino" : "Faltó"}`);
    } catch (e) {
      aviso(`No se pudo guardar (${(e as { code?: string }).code ?? "error"}).`, true);
    }
  }
  $("#todosVinieron").addEventListener("click", () => void marcarSinMarcar("VINO"));
  $("#todosFaltaron").addEventListener("click", () => void marcarSinMarcar("FALTO"));

  const irA = (f: string) => {
    dia = f > hoy ? hoy : f;
    pintarDia();
  };
  $("#diaAnterior").addEventListener("click", () => irA(aIso(sumarDias(deIso(dia), -1))));
  $("#diaSiguiente").addEventListener("click", () => irA(aIso(sumarDias(deIso(dia), 1))));
  $("#irHoy").addEventListener("click", () => irA(hoy));

  // ---------- Pagos ----------
  $("#listaPagar").addEventListener("click", async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-pagar]");
    if (!b) return;
    const id = b.dataset.pagar!;
    const p = pendientes(empleados, asistencias, pagos, hoy, diaPago).find((x) => idPago(x.empleado.id, x.periodo) === id);
    if (!p) return;
    guardando.add(id);
    pintarPagos();
    try {
      // `monto` es el total del periodo: si se agregaron días después de pagar, se sube al total.
      await setDoc(doc(db, "pagosEmpleados", id), {
        empleadoId: p.empleado.id,
        nombre: p.empleado.nombre,
        periodo: p.periodo,
        fecha: p.fecha,
        dias: p.dias,
        monto: p.total,
        en: serverTimestamp(),
        por: auth.currentUser?.email ?? "",
      });
      aviso(`✓ Pagado a ${p.empleado.nombre}: ${dinero(p.monto)}`);
    } catch (e) {
      aviso(`No se pudo guardar el pago (${(e as { code?: string }).code ?? "error"}).`, true);
    } finally {
      guardando.delete(id);
      pintarPagos();
    }
  });

  $("#listaPagados").addEventListener("click", async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-deshacer]");
    if (!b) return;
    b.disabled = true;
    try {
      await deleteDoc(doc(db, "pagosEmpleados", b.dataset.deshacer!));
      aviso("Pago deshecho: vuelve a salir en Por pagar.");
    } catch (e) {
      b.disabled = false;
      aviso(`No se pudo deshacer (${(e as { code?: string }).code ?? "error"}).`, true);
    }
  });

  // ---------- Empleados ----------
  const dlgEmp = $<HTMLDialogElement>("#empleados");
  const selDiaPago = $<HTMLSelectElement>("#diaPago");
  selDiaPago.innerHTML = DIAS_SEMANA.map((d, i) => `<option value="${i}">${d.charAt(0).toUpperCase()}${d.slice(1)}</option>`).join("");
  $("#abrirEmpleados").addEventListener("click", () => {
    pintarEmpleados();
    dlgEmp.showModal();
  });
  $("#empCerrar").addEventListener("click", () => dlgEmp.close());
  selDiaPago.addEventListener("change", async () => {
    try {
      await setDoc(doc(db, "asistenciasConfig", "general"), { diaPago: Number(selDiaPago.value), ...sello() }, { merge: true });
      aviso(`✓ El pago semanal ahora es el ${DIAS_SEMANA[Number(selDiaPago.value)]}`);
    } catch (e) {
      aviso(`No se pudo guardar (${(e as { code?: string }).code ?? "error"}).`, true);
    }
  });

  function pintarEmpleados(): void {
    selDiaPago.value = String(diaPago);
    $("#empLista").innerHTML = empleados.length
      ? empleados
          .map(
            (e) => `<li class="as-emp-fila${e.activo ? "" : " inactivo"}">
              <div class="as-nombre"><b>${escapar(e.nombre)}</b><small>${dinero(e.pagoDia)} por día · ${e.frecuencia === "DIA" ? "se paga cada día" : "se paga por semana"}${e.activo ? "" : " · ya no trabaja aquí"}${e.activo && !e.qr ? " · sin gafete" : ""}</small></div>
              <button type="button" class="add adm-editar" data-editar="${escapar(e.id)}">Editar</button>
            </li>`,
          )
          .join("")
      : `<li class="as-vacio">Todavía no hay empleados.</li>`;
  }
  $("#empLista").addEventListener("click", (ev) => {
    const id = (ev.target as HTMLElement).closest<HTMLElement>("[data-editar]")?.dataset.editar;
    const e = id && empleados.find((x) => x.id === id);
    if (e) abrirFicha(e);
  });
  $("#empNuevo").addEventListener("click", () => abrirFicha(null));
  $("#empGafetes").addEventListener("click", async () => {
    const sinCodigo = activos().filter((e) => !e.qr);
    // A los que no tienen gafete se les crea su código antes de imprimir.
    try {
      await Promise.all(sinCodigo.map((e) => updateDoc(doc(db, "empleados", e.id), { qr: (e.qr = nuevoCodigo()), ...sello() })));
    } catch (err) {
      return aviso(`No se pudieron crear los códigos (${(err as { code?: string }).code ?? "error"}).`, true);
    }
    if (!activos().length) return aviso("No hay empleados activos.", true);
    await imprimir(activos());
  });

  // ---------- Ficha ----------
  const dlg = $<HTMLDialogElement>("#ficha");
  const fNombre = $<HTMLInputElement>("#fNombre");
  const fPago = $<HTMLInputElement>("#fPago");
  const fActivo = $<HTMLInputElement>("#fActivo");
  const errorFicha = $("#errorFicha");
  let editando: Empleado | null = null;

  const frecuencia = (): Frecuencia => (document.querySelector<HTMLInputElement>('input[name="fFrecuencia"]:checked')?.value === "SEMANA" ? "SEMANA" : "DIA");
  function notaFrecuencia(): void {
    const pago = Number(fPago.value) || 0;
    $("#fNota").textContent =
      frecuencia() === "DIA"
        ? `Cada día que venga sale en "Por pagar" ese mismo día${pago ? ` con ${dinero(pago)}` : ""}.`
        : `Sale en "Por pagar" el ${DIAS_SEMANA[diaPago]} con los días que vino${pago ? ` (6 días = ${dinero(pago * 6)})` : ""}.`;
  }
  fPago.addEventListener("input", notaFrecuencia);
  document.querySelectorAll('input[name="fFrecuencia"]').forEach((r) => r.addEventListener("change", notaFrecuencia));

  function abrirFicha(e: Empleado | null): void {
    editando = e;
    $("#fichaTitulo").textContent = e ? e.nombre : "Nuevo empleado";
    fNombre.value = e?.nombre ?? "";
    fPago.value = e ? String(e.pagoDia) : "";
    document.querySelector<HTMLInputElement>(`input[name="fFrecuencia"][value="${e?.frecuencia ?? "DIA"}"]`)!.checked = true;
    fActivo.checked = e?.activo ?? true;
    $("#fActivoCampo").hidden = !e;
    errorFicha.hidden = true;
    notaFrecuencia();
    void pintarGafete();
    dlg.showModal();
    if (!e) fNombre.focus();
  }
  const cerrar = () => dlg.close();
  $("#cerrarFicha").addEventListener("click", cerrar);
  $("#cancelarFicha").addEventListener("click", cerrar);

  async function pintarGafete(): Promise<void> {
    const e = editando && empleados.find((x) => x.id === editando!.id);
    $("#fGafete").hidden = !e;
    if (!e) return;
    $("#fImprimir").textContent = e.qr ? "Imprimir gafete" : "Crear e imprimir gafete";
    $("#fNuevoCodigo").hidden = !e.qr;
    $("#fEtiqueta").innerHTML = e.qr ? await etiqueta(e) : `<p class="as-vacio">Aún no tiene gafete.</p>`;
  }

  $("#fImprimir").addEventListener("click", async () => {
    const e = editando && empleados.find((x) => x.id === editando!.id);
    if (!e) return;
    if (!e.qr) {
      try {
        e.qr = nuevoCodigo();
        await updateDoc(doc(db, "empleados", e.id), { qr: e.qr, ...sello() });
      } catch (err) {
        return aviso(`No se pudo crear el código (${(err as { code?: string }).code ?? "error"}).`, true);
      }
    }
    await imprimir([e]);
    void pintarGafete();
  });
  $("#fNuevoCodigo").addEventListener("click", async () => {
    const e = editando && empleados.find((x) => x.id === editando!.id);
    if (!e) return;
    try {
      await updateDoc(doc(db, "empleados", e.id), { qr: nuevoCodigo(), ...sello() });
      aviso("✓ Código cambiado: el gafete anterior ya no funciona. Imprime el nuevo.");
      window.setTimeout(() => void pintarGafete(), 300);
    } catch (err) {
      aviso(`No se pudo cambiar (${(err as { code?: string }).code ?? "error"}).`, true);
    }
  });

  $<HTMLFormElement>("#formFicha").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const datos = { nombre: fNombre.value.trim().replace(/\s+/g, " "), pagoDia: Number(fPago.value) || 0, frecuencia: frecuencia(), activo: editando ? fActivo.checked : true };
    const problema = validarEmpleado(datos, empleados, editando?.id);
    if (problema) {
      errorFicha.textContent = problema;
      errorFicha.hidden = false;
      return;
    }
    const btn = $<HTMLButtonElement>("#guardarFicha");
    btn.disabled = true;
    try {
      if (editando) await updateDoc(doc(db, "empleados", editando.id), { ...datos, ...sello() });
      else await addDoc(collection(db, "empleados"), { ...datos, qr: nuevoCodigo(), creadoEn: serverTimestamp(), ...sello() });
      aviso(`✓ ${datos.nombre} guardado`);
      dlg.close();
    } catch (e) {
      errorFicha.textContent = `No se pudo guardar (${(e as { code?: string }).code ?? "error"}).`;
      errorFicha.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Gafetes (etiqueta de 60 × 40 mm) ----------
  async function etiqueta(e: Empleado): Promise<string> {
    const svg = await QRCode.toString(textoQr(e.qr), { type: "svg", margin: 0, errorCorrectionLevel: "M" });
    return `<div class="as-qr">${svg}</div><div class="as-et-txt"><span class="as-et-marca">La Walkiria</span><b>${escapar(e.nombre)}</b><span class="as-et-pie">Gafete de asistencia</span></div>`;
  }
  async function imprimir(lista: Empleado[]): Promise<void> {
    const cont = $("#imprimir");
    cont.innerHTML = (await Promise.all(lista.filter((e) => e.qr).map(async (e) => `<div class="as-etiqueta">${await etiqueta(e)}</div>`))).join("");
    window.print();
  }

  // ---------- Checador (tablet de la entrada) ----------
  const video = $<HTMLVideoElement>("#chVideo");
  let flujo: MediaStream | null = null;
  let usarFrontal = true;
  let buscando = false;
  let candado: WakeLockSentinel | null = null;
  /** Último gafete leído y cuándo: evita registrar dos veces si se queda frente a la cámara. */
  let ultimo = { codigo: "", en: 0 };
  let detector: { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } | null = null;
  let jsqr: typeof import("jsqr").default | null = null;
  const lienzo = document.createElement("canvas");

  $("#abrirChecador").addEventListener("click", () => void abrirChecador());
  $("#chSalir").addEventListener("click", cerrarChecador);
  $("#chCamara").addEventListener("click", () => {
    usarFrontal = !usarFrontal;
    void prenderCamara();
  });

  async function abrirChecador(): Promise<void> {
    $("#checador").hidden = false;
    document.body.classList.add("con-checador");
    pintarChecador();
    try {
      candado = await navigator.wakeLock?.request("screen");
    } catch {
      /* sin bloqueo de pantalla: la tablet puede apagarse sola */
    }
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => typeof detector }).BarcodeDetector;
    if (BD) detector = new BD({ formats: ["qr_code"] });
    else if (!jsqr) jsqr = (await import("jsqr")).default;
    await prenderCamara();
  }

  function cerrarChecador(): void {
    buscando = false;
    flujo?.getTracks().forEach((t) => t.stop());
    flujo = null;
    void candado?.release();
    candado = null;
    $("#checador").hidden = true;
    document.body.classList.remove("con-checador");
  }

  async function prenderCamara(): Promise<void> {
    flujo?.getTracks().forEach((t) => t.stop());
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: usarFrontal ? "user" : "environment", width: { ideal: 1280 } }, audio: false });
      video.srcObject = flujo;
      video.classList.toggle("espejo", usarFrontal);
      await video.play();
      $("#chAyuda").textContent = "Acerca tu gafete a la cámara";
      if (!buscando) {
        buscando = true;
        void buscar();
      }
    } catch (e) {
      console.error(e);
      $("#chAyuda").textContent = "No se pudo abrir la cámara. Da permiso de cámara a esta página y vuelve a entrar.";
    }
  }

  async function leerCuadro(): Promise<string | null> {
    if (video.readyState < 2) return null;
    if (detector) {
      const r = await detector.detect(video);
      return r[0]?.rawValue ?? null;
    }
    if (!jsqr) return null;
    const escala = Math.min(1, 640 / video.videoWidth);
    lienzo.width = Math.round(video.videoWidth * escala);
    lienzo.height = Math.round(video.videoHeight * escala);
    const ctx = lienzo.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
    const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
    return jsqr(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  }

  async function buscar(): Promise<void> {
    while (buscando) {
      try {
        const texto = await leerCuadro();
        if (texto) await alLeer(texto);
      } catch (e) {
        console.warn("checador:", e);
      }
      await new Promise((r) => setTimeout(r, 180));
    }
  }

  async function alLeer(texto: string): Promise<void> {
    const codigo = leerQr(texto);
    const ahora = Date.now();
    if (codigo && codigo === ultimo.codigo && ahora - ultimo.en < 5000) return;
    ultimo = { codigo: codigo ?? texto, en: ahora };
    const r = codigo ? alEscanear(codigo, empleados, marcasDe(hoy)) : ({ tipo: "desconocido" } as const);
    if (r.tipo === "registrado") {
      try {
        await marcar([r.empleado.id], "VINO", hoy);
        resultado("ok", r.empleado.nombre, "¡Hola! Quedó registrada tu llegada.");
      } catch {
        resultado("mal", r.empleado.nombre, "No se pudo guardar. Avisa a un encargado.");
      }
    } else if (r.tipo === "yaEstaba") resultado("info", r.empleado.nombre, "Ya estabas registrado hoy.");
    else if (r.tipo === "inactivo") resultado("mal", r.empleado.nombre, "Este gafete está dado de baja. Avisa a un encargado.");
    else resultado("mal", "Gafete no reconocido", "Puede ser un gafete viejo. Avisa a un encargado.");
  }

  let tResultado: number | undefined;
  function resultado(tipo: "ok" | "info" | "mal", nombre: string, mensaje: string): void {
    const el = $("#chResultado");
    el.className = `as-ch-resultado ${tipo}`;
    $("#chIcono").textContent = tipo === "ok" ? "✓" : tipo === "info" ? "✓" : "!";
    $("#chNombre").textContent = nombre;
    $("#chMensaje").textContent = mensaje;
    el.hidden = false;
    pitido(tipo === "mal" ? 220 : 880);
    window.clearTimeout(tResultado);
    tResultado = window.setTimeout(() => (el.hidden = true), 2600);
  }

  let audio: AudioContext | null = null;
  function pitido(hz: number): void {
    try {
      audio ??= new AudioContext();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.15, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + 0.25);
    } catch {
      /* sin sonido */
    }
  }

  function pintarChecador(): void {
    $("#chFecha").textContent = nombreFecha(hoy);
    const marcas = marcasDe(hoy);
    const llegaron = activos().filter((e) => marcas[e.id]?.estado === "VINO");
    $("#chCuenta").textContent = `${llegaron.length} de ${activos().length} ya llegaron`;
    $("#chLlegaron").innerHTML = llegaron.map((e) => `<li>✓ ${escapar(e.nombre)}</li>`).join("");
  }
}
