import "./styles.css";
import "./admin.css";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getFirestore, onSnapshot, runTransaction, serverTimestamp, updateDoc, type Unsubscribe } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { firebaseWeb } from "./data/temporada";
import {
  CATEGORIAS,
  GRUPOS,
  PRESENTACIONES,
  UNIDADES,
  aDocumento,
  agrupar,
  cambios,
  coincideNombre,
  cuantasFotos,
  fechaCorta,
  fotosParaFicha,
  evaluarSuperadmin,
  leerProducto,
  motivoDeError,
  nombreGrupo,
  productoNuevo,
  siguienteId,
  textoModificacion,
  urlVista,
  validar,
  type Categoria,
  type ProductoFirestore,
  type ResultadoRol,
} from "./lib/admin";
import { dinero, escapar } from "./lib/formato";
import { productos as productosWeb } from "./data/productos";
import { fotosPlatillos } from "./data/galeria";
import type { Encuadre, FotoProducto } from "./types";
import { estiloEncuadre, normalizarEncuadre } from "./lib/encuadre";

type Campo = "estaDisponible" | "oculto";
import { $ } from "./ui/dom";

const vistas = { sinConfig: $("#sinConfig"), entrar: $("#entrar"), panel: $("#panel"), cargando: $("#cargando") };
const salir = $<HTMLButtonElement>("#salir");

function mostrar(v: keyof typeof vistas): void {
  if (v !== "cargando") window.clearTimeout(esperaLenta);
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

// El código del panel sí cargó (ver el aviso de admin.html si no carga).
(window as { __adminArranco?: boolean }).__adminArranco = true;

/** Si Firebase tarda demasiado, se explica en pantalla con un botón para recargar. */
let esperaLenta: number | undefined;
function vigilarCarga(): void {
  window.clearTimeout(esperaLenta);
  $("#cargandoTexto").textContent = "Cargando…";
  $("#recargar").hidden = true;
  esperaLenta = window.setTimeout(() => {
    $("#cargandoTexto").textContent = "Firebase está tardando en responder. Revisa tu conexión (o un bloqueador de anuncios) y toca Recargar.";
    $("#recargar").hidden = false;
  }, 15000);
}

if (!firebaseWeb.apiKey || !firebaseWeb.appId) {
  mostrar("sinConfig");
} else {
  iniciar();
}

function iniciar(): void {
  const app = initializeApp(firebaseWeb);
  const auth = getAuth(app);
  const db = getFirestore(app);

  let lista: ProductoFirestore[] = [];
  /** id del producto → campo que se está guardando (muestra el circulito en esa celda). */
  const pendientes = new Map<string, Campo>();
  let dejarDeEscuchar: Unsubscribe | null = null;
  const buscar = $<HTMLInputElement>("#buscar");

  // ---------- Entrar / salir ----------
  const form = $<HTMLFormElement>("#formEntrar");
  const errorEntrar = $("#errorEntrar");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const correo = $<HTMLInputElement>("#correo").value.trim();
    const clave = $<HTMLInputElement>("#clave").value;
    if (!correo || !clave) return error("Escribe tu correo y contraseña.");
    const btn = $<HTMLButtonElement>("#btnEntrar");
    btn.disabled = true;
    ocupado(btn, "Entrando");
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
  function error(t: string): void {
    errorEntrar.textContent = t;
    errorEntrar.hidden = false;
  }
  salir.addEventListener("click", () => void signOut(auth));

  // La sesión se queda guardada en el navegador: no hay que entrar cada vez.
  onAuthStateChanged(auth, async (usuario) => {
    dejarDeEscuchar?.();
    dejarDeEscuchar = null;
    if (!usuario) return mostrar("entrar");
    mostrar("cargando");
    vigilarCarga();
    const rol = await esSuperadmin(usuario);
    if (!rol.ok) {
      await signOut(auth);
      error(rol.motivo);
      return;
    }
    escuchar();
  });

  async function esSuperadmin(u: User): Promise<ResultadoRol> {
    try {
      const snap = await getDoc(doc(db, "superadmins", u.uid));
      return evaluarSuperadmin(snap.exists());
    } catch (e) {
      console.error("admin: no se pudo leer superadmins/" + u.uid, e);
      return { ok: false, motivo: motivoDeError((e as { code?: string }).code) };
    }
  }

  // ---------- Lista en tiempo real ----------
  function escuchar(): void {
    dejarDeEscuchar = onSnapshot(
      collection(db, "products"),
      (snap) => {
        // Un producto con datos raros no debe dejar el panel en "Cargando…": se salta y se avisa.
        const malos: string[] = [];
        lista = snap.docs.flatMap((d) => {
          try {
            return [leerProducto(d.id, d.data())];
          } catch (e) {
            console.error("admin: no se pudo leer " + d.id, e);
            malos.push(d.id);
            return [];
          }
        });
        mostrar("panel");
        try {
          pintar();
        } catch (e) {
          console.error("admin: no se pudo pintar la lista", e);
          aviso("Algo falló al mostrar la lista. Toca Recargar o avísale a soporte.", true);
        }
        if (malos.length) aviso(`No se pudieron leer: ${malos.join(", ")}.`, true);
      },
      () => {
        aviso("No se pudieron leer los productos. Revisa las reglas de Firestore.", true);
        mostrar("panel");
      },
    );
  }

  buscar.addEventListener("input", pintar);
  // En celular la explicación de los botones empieza cerrada: se abre con "¿Qué hace cada botón?".
  if (matchMedia("(max-width:760px)").matches) $<HTMLDetailsElement>("#ayuda").open = false;
  // En compu el encabezado entero se queda arriba y el resumen con el buscador justo debajo de él.
  const cabeza = $(".adm-head");
  new ResizeObserver(() => document.documentElement.style.setProperty("--alto-head", `${cabeza.offsetHeight}px`)).observe(cabeza);

  function pintar(): void {
    const visibles = lista.filter((p) => !p.oculto);
    const apagados = visibles.filter((p) => !p.disponible).length;
    const ocultos = lista.length - visibles.length;
    const resumen = $("#resumen");
    resumen.classList.toggle("hay", apagados > 0);
    const partes = [
      apagados === 0 ? "Todo lo visible está disponible" : `<b>${apagados} ${apagados === 1 ? "agotado" : "agotados"}</b>`,
      ocultos ? `${ocultos} ${ocultos === 1 ? "oculto" : "ocultos"}` : "",
    ].filter(Boolean);
    resumen.innerHTML = `${lista.length} productos · ${partes.join(" · ")}`;

    const grupos = agrupar(lista, buscar.value);
    $("#lista").innerHTML = grupos.length
      ? grupos
          .map(([g, ps]) => {
            const no = ps.filter((p) => !p.disponible && !p.oculto).length;
            return `<section class="adm-grupo"><h2>${escapar(nombreGrupo(g))}${no ? ` <small>${no} agotado${no > 1 ? "s" : ""}</small>` : ""}</h2>
              <table class="adm-tabla">
                <thead><tr>
                  <th class="c-prod" scope="col">Producto</th>
                  <th class="c-precio" scope="col">Precio</th>
                  <th class="c-sw" scope="col">Disponible<small>Apagado = Agotado</small></th>
                  <th class="c-sw" scope="col">Mostrar<small>Apagado = Oculto</small></th>
                  <th class="c-mod" scope="col">Modificado</th>
                  <th class="c-acc" scope="col"><span class="vh">Editar</span></th>
                </tr></thead>
                <tbody>${ps.map(fila).join("")}</tbody>
              </table></section>`;
          })
          .join("")
      : `<p class="adm-sub" style="margin-top:20px">No hay productos con ese nombre.</p>`;
  }

  /** Celda con un switch y su palabra ("Sí"/"Agotado"), o el circulito mientras guarda. */
  function celdaSwitch(p: ProductoFirestore, campo: Campo, etiqueta: string): string {
    const activo = campo === "estaDisponible" ? p.disponible : !p.oculto;
    const palabra = campo === "estaDisponible" ? (activo ? "Sí" : "Agotado") : activo ? "Visible" : "Oculto";
    const cuerpo =
      pendientes.get(p.id) === campo
        ? `<span class="adm-giro" role="status" aria-label="Guardando ${escapar(p.nombre)}"></span><span class="adm-pal">Guardando…</span>`
        : `<label class="adm-sw">
            <input type="checkbox" role="switch" data-id="${escapar(p.id)}" data-campo="${campo}"${activo ? " checked" : ""}${pendientes.has(p.id) ? " disabled" : ""} aria-label="${escapar(p.nombre)}: ${etiqueta}">
            <span class="adm-switch" aria-hidden="true"></span>
            <span class="adm-pal${activo ? "" : " mal"}">${palabra}</span>
          </label>`;
    return `<td class="c-sw" data-label="${etiqueta}">${cuerpo}</td>`;
  }

  function fila(p: ProductoFirestore): string {
    const unidad = p.unidad ? `<small>/ ${escapar(p.unidad)}</small>` : "";
    const id = escapar(p.id);
    // Miniatura: la foto principal y, si tiene más de una, cuántas son.
    const { imagen, fotos: todas } = fotosParaFicha(p, productosWeb, fotosPlatillos);
    const principal = imagen || p.imagen;
    const n = cuantasFotos(p, productosWeb, fotosPlatillos);
    // Con el mismo encuadre que ve el cliente al pedir.
    const enc = estiloEncuadre(todas.find((x) => x.url === principal)?.encuadre);
    const foto = `<span class="adm-mini-caja">${principal ? `<span class="adm-mini adm-recorte"><img src="${escapar(urlVista(principal))}" alt="" loading="lazy" onerror="this.remove()"${enc ? ` style="${enc}"` : ""}></span>` : `<span class="adm-mini" aria-hidden="true"></span>`}${n > 1 ? `<span class="adm-mini-n" title="${n} fotos">${n}</span>` : ""}</span>`;
    const mod = p.actualizadoEn ? `${fechaCorta(p.actualizadoEn)}${p.actualizadoPor ? `<small>${escapar(p.actualizadoPor.split("@")[0]!)}</small>` : ""}` : `<span class="adm-vacio">—</span>`;
    return `<tr class="adm-fila${p.disponible ? "" : " apagado"}${p.oculto ? " oculto" : ""}">
      <td class="c-prod"><div class="adm-abrir">${foto}<span class="adm-nombre">${escapar(p.nombre)}</span></div></td>
      <td class="c-precio" data-label="Precio">${dinero(p.menudeo)}${unidad}</td>
      ${celdaSwitch(p, "estaDisponible", "Disponible")}
      ${celdaSwitch(p, "oculto", "Mostrar")}
      <td class="c-mod" data-label="Modificado">${mod}</td>
      <td class="c-acc"><div class="adm-acciones"><button class="add adm-editar" type="button" data-abrir="${id}" aria-label="Editar ${escapar(p.nombre)}">Editar</button><button class="adm-borrar" type="button" data-eliminar="${id}" aria-label="Eliminar ${escapar(p.nombre)}">Eliminar</button></div></td>
    </tr>`;
  }

  /** Quién y cuándo modificó el producto (la hora la pone el servidor). */
  const sello = () => ({ actualizadoEn: serverTimestamp(), actualizadoPor: auth.currentUser?.email ?? "" });

  // Interruptores rápidos: Disponible y Mostrar.
  $("#lista").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const id = input.dataset.id;
    const campo = input.dataset.campo as Campo | undefined;
    if (!id || !campo || pendientes.has(id)) return;
    const p = lista.find((x) => x.id === id);
    const n = p?.nombre ?? id;
    const activo = input.checked;
    pendientes.set(id, campo);
    pintar();
    try {
      // El switch "Mostrar" prendido significa oculto = false.
      await updateDoc(doc(db, "products", id), { [campo]: campo === "oculto" ? !activo : activo, ...sello() });
      aviso(
        campo === "estaDisponible"
          ? activo ? `✓ ${n} ya está disponible` : `✓ ${n} quedó agotado`
          : activo ? `✓ ${n} se vuelve a mostrar` : `✓ ${n} quedó oculto (app y página)`,
      );
    } catch (err) {
      console.error("admin: no se pudo cambiar " + id, err);
      aviso(`No se pudo cambiar "${n}" (${(err as { code?: string }).code ?? "error"}). Sigue como estaba.`, true);
    } finally {
      pendientes.delete(id);
      pintar();
    }
  });

  $("#lista").addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    const id = el.closest<HTMLElement>("[data-abrir]")?.dataset.abrir;
    const p = id && lista.find((x) => x.id === id);
    if (p) return abrirFicha(p, false);
    const idBorrar = el.closest<HTMLElement>("[data-eliminar]")?.dataset.eliminar;
    const q = idBorrar && lista.find((x) => x.id === idBorrar);
    if (q) pedirEliminar(q);
  });
  $("#nuevo").addEventListener("click", () => abrirFicha(productoNuevo(siguienteId(lista.map((p) => p.id))), true));

  // ---------- Ficha ----------
  const ficha = $<HTMLDialogElement>("#ficha");
  const f = {
    titulo: $("#fichaTitulo"),
    id: $("#fId"),
    fotos: $<HTMLUListElement>("#fFotos"),
    fotosN: $("#fFotosN"),
    fotosNota: $("#fFotosNota"),
    fotosEstado: $("#fFotosEstado"),
    encuadreBtn: $<HTMLButtonElement>("#fEncuadre"),
    archivo: $<HTMLInputElement>("#fFotoArchivo"),
    nombre: $<HTMLInputElement>("#fNombre"),
    menudeo: $<HTMLInputElement>("#fMenudeo"),
    mayoreo: $<HTMLInputElement>("#fMayoreo"),
    categoria: $<HTMLSelectElement>("#fCategoria"),
    grupo: $<HTMLSelectElement>("#fGrupo"),
    unidad: $<HTMLSelectElement>("#fUnidad"),
    presentacion: $<HTMLSelectElement>("#fPresentacion"),
    disponible: $<HTMLInputElement>("#fDisponible"),
    mostrar: $<HTMLInputElement>("#fMostrar"),
    peso: $<HTMLInputElement>("#fPeso"),
    maquila: $<HTMLInputElement>("#fMaquila"),
    error: $("#errorFicha"),
    guardar: $<HTMLButtonElement>("#guardarFicha"),
  };
  const opciones = (sel: HTMLSelectElement, valores: readonly string[], etiqueta: (v: string) => string = (v) => v): void => {
    sel.innerHTML = valores.map((v) => `<option value="${escapar(v)}">${escapar(etiqueta(v) || "Sin definir")}</option>`).join("");
  };
  opciones(f.categoria, CATEGORIAS);
  opciones(f.grupo, GRUPOS, nombreGrupo);
  opciones(f.unidad, UNIDADES);
  opciones(f.presentacion, PRESENTACIONES);

  let original: ProductoFirestore | null = null;
  let esNuevo = false;
  /** Fotos que se están subiendo ahora (cada una tiene su recuadro con el circulito). */
  let subiendo = 0;
  /** Fotos de la ficha abierta y cuál es la principal (su url). Se guardan al tocar Guardar. */
  let fotos: FotoProducto[] = [];
  let principal = "";

  /** Si el valor guardado no está en la lista (dato viejo), se agrega para no perderlo al guardar. */
  function elegir(sel: HTMLSelectElement, valor: string): void {
    if (![...sel.options].some((o) => o.value === valor)) sel.add(new Option(valor || "Sin definir", valor));
    sel.value = valor;
  }

  function abrirFicha(p: ProductoFirestore, nuevo: boolean): void {
    original = p;
    esNuevo = nuevo;
    f.titulo.textContent = nuevo ? "Nuevo producto" : p.nombre;
    f.id.textContent = nuevo ? `Se guardará como ${p.id}.` : `Id: ${p.id}. ${textoModificacion(p)}`;
    // Si el producto aún no tiene fotos en el panel, se muestran las que ya traía la página.
    const inicio = fotosParaFicha(p, productosWeb, fotosPlatillos);
    original = { ...p, fotos: inicio.fotos, imagen: inicio.imagen || p.imagen };
    fotos = [...inicio.fotos];
    principal = inicio.imagen;
    f.fotosNota.hidden = !inicio.dePagina;
    pintarFotosFicha();
    f.nombre.value = p.nombre;
    f.menudeo.value = nuevo ? "" : String(p.menudeo);
    f.mayoreo.value = nuevo ? "" : String(p.mayoreo);
    elegir(f.categoria, p.categoria);
    elegir(f.grupo, p.grupo);
    elegir(f.unidad, p.unidad);
    elegir(f.presentacion, p.presentacion);
    f.disponible.checked = p.disponible;
    f.mostrar.checked = !p.oculto;
    f.peso.checked = p.pesoAjustable;
    f.maquila.checked = p.maquila;
    estadoFotos();
    f.error.hidden = true;
    f.guardar.textContent = nuevo ? "Crear producto" : "Guardar";
    ficha.showModal();
    if (nuevo) f.nombre.focus();
  }

  function leerFicha(): ProductoFirestore {
    const num = (i: HTMLInputElement): number => (i.value.trim() === "" ? 0 : Number(i.value));
    return {
      ...original!,
      nombre: f.nombre.value.trim(),
      // Sin fotos se respeta la que ya tenía (la app puede traer una de antes); con fotos, la ★.
      // Si se quitaron todas las fotos que tenía, también se quita la principal.
      imagen: fotos.length ? principal : original!.fotos.length ? "" : original!.imagen,
      fotos,
      menudeo: num(f.menudeo),
      mayoreo: num(f.mayoreo),
      categoria: f.categoria.value as Categoria,
      grupo: f.grupo.value,
      unidad: f.unidad.value,
      presentacion: f.presentacion.value,
      disponible: f.disponible.checked,
      oculto: !f.mostrar.checked,
      pesoAjustable: f.peso.checked,
      maquila: f.maquila.checked,
    };
  }

  // ---------- Fotos de la ficha ----------
  function pintarFotosFicha(): void {
    const total = fotos.length + subiendo;
    f.fotosN.textContent = total ? `(${total})` : "";
    const lista = fotos.map((x, i) => {
      const esPrincipal = x.url === principal;
      const enc = esPrincipal ? estiloEncuadre(x.encuadre) : "";
      return `<li class="adm-fotito${esPrincipal ? " principal" : ""}">
        ${esPrincipal ? `<button class="adm-enc-abrir" type="button" data-encuadre="${i}" aria-label="Elegir qué parte de la foto principal se ve">` : ""}<img src="${escapar(urlVista(x.url))}" alt="Foto ${i + 1}${esPrincipal ? " (principal)" : ""}" loading="lazy"${enc ? ` style="${enc}"` : ""}>${esPrincipal ? "</button>" : ""}
        ${esPrincipal ? `<span class="adm-es-principal">★ Principal</span>` : `<button class="adm-hacer" type="button" data-principal="${i}" aria-label="Hacer principal la foto ${i + 1}">Hacer principal</button>`}
        <button class="adm-x" type="button" data-quitar="${i}" aria-label="Quitar la foto ${i + 1}" title="Quitar">✕</button>
      </li>`;
    });
    const enCamino = Array.from({ length: subiendo }, () => `<li class="adm-fotito subiendo" role="status"><span class="adm-giro" aria-hidden="true"></span>Subiendo…</li>`);
    f.fotos.innerHTML = total
      ? [...lista, ...enCamino].join("")
      : `<li><label class="adm-fotos-vacia" for="fFotoArchivo">+ Sin fotos todavía. Toca para agregar: la primera será la principal.</label></li>`;
    // Botón visible para el encuadre de la principal (también se abre tocando la foto).
    const iP = fotos.findIndex((x) => x.url === principal);
    f.encuadreBtn.hidden = iP < 0;
    f.encuadreBtn.dataset.encuadre = String(iP);
    f.encuadreBtn.innerHTML = `${ICONO_ENCUADRE}<span>${fotos[iP]?.encuadre ? "Cambiar qué se ve de la principal" : "Elegir qué se ve de la principal"}</span>`;
    f.guardar.disabled = subiendo > 0;
  }

  /** Recuerda en la ficha qué pasa con las fotos según Disponible y Mostrar. */
  function estadoFotos(): void {
    const e = f.fotosEstado;
    e.classList.toggle("oculto", !f.mostrar.checked);
    if (!f.mostrar.checked) e.textContent = "Oculto: el producto y sus fotos no salen en la página ni en la galería.";
    else if (!f.disponible.checked) e.textContent = "Agotado: sus fotos siguen en la galería con la marca “Agotado”.";
    e.hidden = f.mostrar.checked && f.disponible.checked;
  }
  f.mostrar.addEventListener("change", estadoFotos);
  f.disponible.addEventListener("change", estadoFotos);

  f.encuadreBtn.addEventListener("click", () => abrirEncuadre(Number(f.encuadreBtn.dataset.encuadre)));
  f.fotos.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    const enc = el.closest<HTMLElement>("[data-encuadre]")?.dataset.encuadre;
    if (enc !== undefined) return abrirEncuadre(Number(enc));
    const hacer = el.closest<HTMLElement>("[data-principal]")?.dataset.principal;
    if (hacer !== undefined) {
      principal = fotos[Number(hacer)]?.url ?? principal;
      f.fotosNota.hidden = true;
      return pintarFotosFicha();
    }
    const quitar = el.closest<HTMLElement>("[data-quitar]")?.dataset.quitar;
    if (quitar !== undefined) {
      const [fuera] = fotos.splice(Number(quitar), 1);
      // Si se quitó la principal, la siguiente toma su lugar.
      if (fuera?.url === principal) principal = fotos[0]?.url ?? "";
      f.fotosNota.hidden = true;
      pintarFotosFicha();
    }
  });

  f.archivo.addEventListener("change", async () => {
    const archivos = [...(f.archivo.files ?? [])];
    f.archivo.value = "";
    if (!archivos.length || !original) return;
    if (!firebaseWeb.storageBucket) return aviso("Falta activar Storage en Firebase para subir fotos.", true);
    const id = original.id;
    subiendo += archivos.length;
    f.fotosNota.hidden = true;
    pintarFotosFicha();
    let fallas = 0;
    // Una por una, en el orden en que se eligieron; cada una aparece en cuanto termina.
    for (const [i, archivo] of archivos.entries()) {
      try {
        // Dos tamaños: 1200 px para la página y la app, y el tamaño real (hasta 3000 px) para verla completa.
        const { normal, grande, forma } = await reducir(archivo);
        const nombre = `productos/${id}/${Date.now()}-${i}`;
        const subir = async (blob: Blob, ruta: string): Promise<string> => {
          const destino = ref(getStorage(app), ruta);
          await uploadBytes(destino, blob, { contentType: "image/jpeg", cacheControl: "public,max-age=31536000" });
          return getDownloadURL(destino);
        };
        const url = await subir(normal, `${nombre}.jpg`);
        const urlGrande = grande ? await subir(grande, `${nombre}-grande.jpg`) : "";
        // Si mientras subía se cerró la ficha o se abrió otro producto, no se mezcla.
        if (original?.id === id) {
          fotos.push({ url, forma, ...(urlGrande ? { grande: urlGrande } : {}) });
          if (!principal) principal = url;
        }
      } catch (e) {
        console.error("admin: no se pudo subir la foto", e);
        fallas++;
      } finally {
        subiendo--;
        if (original?.id === id) pintarFotosFicha();
      }
    }
    if (fallas) aviso(`No se ${fallas === 1 ? "pudo subir 1 foto" : `pudieron subir ${fallas} fotos`}. Revisa tu conexión e inténtalo otra vez.`, true);
    else aviso(archivos.length === 1 ? "✓ Foto lista. Toca Guardar para que salga en la página." : `✓ ${archivos.length} fotos listas. Toca Guardar para que salgan en la página.`);
  });

  // ---------- Encuadre de la foto principal ----------
  // Se arrastra la foto dentro del recuadro (así se ve en compu) y se acerca con la barra; al lado,
  // cómo queda en celular (cuadrada). Se guarda con el resto de la ficha al tocar Guardar.
  const enc = {
    dialogo: $<HTMLDialogElement>("#encuadre"),
    marco: $("#encMarco"),
    img: $<HTMLImageElement>("#encImg"),
    cel: $<HTMLImageElement>("#encCel"),
    zoom: $<HTMLInputElement>("#encZoom"),
  };
  let encIndice = -1;
  let encActual: Encuadre = { x: 50, y: 50, zoom: 1 };
  function pintarEncuadre(): void {
    const estilo = estiloEncuadre(encActual) || "object-position:50% 50%;";
    enc.img.setAttribute("style", estilo);
    enc.cel.setAttribute("style", estilo);
    enc.zoom.value = String(encActual.zoom);
  }
  function abrirEncuadre(i: number): void {
    const foto = fotos[i];
    if (!foto) return;
    encIndice = i;
    encActual = { x: 50, y: 50, zoom: 1, ...foto.encuadre };
    const src = urlVista(foto.url);
    enc.img.src = src;
    enc.cel.src = src;
    pintarEncuadre();
    enc.dialogo.showModal();
  }
  enc.zoom.addEventListener("input", () => {
    encActual = { ...encActual, zoom: Number(enc.zoom.value) };
    pintarEncuadre();
  });
  // Arrastrar: la foto sigue al dedo. El avance se calcula con lo que sobra de foto fuera del recuadro.
  let arrastre: { x: number; y: number; inicio: Encuadre } | null = null;
  enc.marco.addEventListener("pointerdown", (e) => {
    arrastre = { x: e.clientX, y: e.clientY, inicio: encActual };
    enc.marco.setPointerCapture(e.pointerId);
    enc.marco.classList.add("arrastrando");
  });
  enc.marco.addEventListener("pointermove", (e) => {
    if (!arrastre || !enc.img.naturalWidth) return;
    const W = enc.marco.clientWidth;
    const H = enc.marco.clientHeight;
    const s = Math.max(W / enc.img.naturalWidth, H / enc.img.naturalHeight);
    const z = arrastre.inicio.zoom;
    const sobraX = Math.max(enc.img.naturalWidth * s - W + W * (z - 1), W * 0.2);
    const sobraY = Math.max(enc.img.naturalHeight * s - H + H * (z - 1), H * 0.2);
    const lim = (n: number) => Math.min(100, Math.max(0, n));
    encActual = {
      zoom: z,
      x: lim(arrastre.inicio.x - ((e.clientX - arrastre.x) / sobraX) * 100),
      y: lim(arrastre.inicio.y - ((e.clientY - arrastre.y) / sobraY) * 100),
    };
    pintarEncuadre();
  });
  const soltar = () => {
    arrastre = null;
    enc.marco.classList.remove("arrastrando");
  };
  enc.marco.addEventListener("pointerup", soltar);
  enc.marco.addEventListener("pointercancel", soltar);
  $("#encCentrar").addEventListener("click", () => {
    encActual = { x: 50, y: 50, zoom: 1 };
    pintarEncuadre();
  });
  $("#encCerrar").addEventListener("click", () => enc.dialogo.close());
  $("#encListo").addEventListener("click", () => {
    const foto = fotos[encIndice];
    if (foto) {
      const { encuadre: _viejo, ...resto } = foto;
      const nuevo = normalizarEncuadre(encActual);
      fotos = fotos.map((x, i) => (i === encIndice ? { ...resto, ...(nuevo ? { encuadre: nuevo } : {}) } : x));
      f.fotosNota.hidden = true;
      pintarFotosFicha();
      aviso("✓ Encuadre listo. Toca Guardar para que se vea en la página.");
    }
    enc.dialogo.close();
  });

  // ---------- Eliminar ----------
  const confirmar = $<HTMLDialogElement>("#confirmarEliminar");
  const cerrar = (): void => ficha.close();
  let porEliminar: ProductoFirestore | null = null;
  const elimEscribe = $<HTMLInputElement>("#elimEscribe");
  const elimConfirmar = $<HTMLButtonElement>("#elimConfirmar");
  function pedirEliminar(p: ProductoFirestore): void {
    porEliminar = p;
    document.querySelectorAll(".elimNombre").forEach((el) => (el.textContent = p.nombre));
    elimEscribe.value = "";
    elimConfirmar.disabled = true;
    $("#elimError").hidden = true;
    confirmar.showModal();
    elimEscribe.focus();
  }
  // El botón rojo solo se prende cuando el nombre escrito es idéntico.
  elimEscribe.addEventListener("input", () => (elimConfirmar.disabled = !porEliminar || !coincideNombre(elimEscribe.value, porEliminar.nombre)));
  $("#elimCancelar").addEventListener("click", () => confirmar.close());
  elimConfirmar.addEventListener("click", async () => {
    if (!porEliminar || !coincideNombre(elimEscribe.value, porEliminar.nombre)) return;
    const { id, nombre } = porEliminar;
    elimConfirmar.disabled = true;
    ocupado(elimConfirmar, "Eliminando");
    try {
      await deleteDoc(doc(db, "products", id));
      confirmar.close();
      aviso(`✓ ${nombre} (${id}) se eliminó`);
    } catch (err) {
      console.error("admin: no se pudo eliminar " + id, err);
      $("#elimError").textContent = `No se pudo eliminar "${nombre}" (${(err as { code?: string }).code ?? "error"}). Sigue en la lista.`;
      $("#elimError").hidden = false;
      elimConfirmar.disabled = !coincideNombre(elimEscribe.value, nombre);
    } finally {
      elimConfirmar.textContent = "Eliminar producto";
    }
  });
  $("#cerrarFicha").addEventListener("click", cerrar);
  $("#cancelarFicha").addEventListener("click", cerrar);

  $<HTMLFormElement>("#formFicha").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!original || subiendo > 0) return;
    const p = leerFicha();
    const problema = validar(p, lista);
    if (problema) {
      f.error.textContent = problema;
      f.error.hidden = false;
      return;
    }
    f.error.hidden = true;
    f.guardar.disabled = true;
    ocupado(f.guardar, "Guardando");
    try {
      if (esNuevo) {
        const destino = doc(db, "products", p.id);
        await runTransaction(db, async (t) => {
          if ((await t.get(destino)).exists()) throw new Error("existe");
          t.set(destino, { ...aDocumento(p), creadoEn: serverTimestamp(), ...sello() });
        });
        aviso(`✓ ${p.nombre} se creó como ${p.id}`);
      } else {
        const diff = cambios(original, p);
        if (Object.keys(diff).length) {
          await updateDoc(doc(db, "products", p.id), { ...diff, ...sello() });
          aviso(`✓ ${p.nombre} quedó guardado`);
        }
      }
      cerrar();
    } catch (err) {
      const existe = (err as Error).message === "existe";
      f.error.textContent = existe
        ? `Ya hay un producto ${p.id}. Cierra y vuelve a tocar "Nuevo producto".`
        : `No se pudo guardar "${p.nombre}" (${(err as { code?: string }).code ?? "error"}). Revisa tu conexión o tus permisos.`;
      f.error.hidden = false;
    } finally {
      f.guardar.disabled = false;
      f.guardar.textContent = esNuevo ? "Crear producto" : "Guardar";
    }
  });
}

/**
 * Prepara la foto para subirla: una de 1200 px por lado para que la app y la web carguen rápido y,
 * si la original es más grande, otra en tamaño real (hasta 3000 px, para no pasar de los 5 MB que
 * permiten las reglas de Storage). Dice también si es horizontal o vertical.
 */
async function reducir(archivo: File): Promise<{ normal: Blob; grande: Blob | null; forma: "h" | "v" }> {
  const img = await createImageBitmap(archivo);
  const lado = Math.max(img.width, img.height);
  const aJpeg = (max: number, calidad: number): Promise<Blob> => {
    const escala = Math.min(1, max / lado);
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return new Promise<Blob>((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error("toBlob"))), "image/jpeg", calidad));
  };
  try {
    const forma = img.height > img.width * 1.1 ? "v" : "h";
    const normal = await aJpeg(1200, 0.85);
    const grande = lado > 1200 ? await aJpeg(3000, 0.88) : null;
    return { normal, grande, forma };
  } finally {
    img.close();
  }
}

/** Ícono de encuadre (cuadro con esquinas). */
const ICONO_ENCUADRE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/></svg>`;

/** Botón en espera: spinner girando y el texto de lo que está pasando. */
function ocupado(btn: HTMLButtonElement, texto: string): void {
  btn.innerHTML = `<span class="adm-giro chico" aria-hidden="true"></span>${texto}`;
}
