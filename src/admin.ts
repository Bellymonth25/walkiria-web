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
  fechaCorta,
  evaluarSuperadmin,
  leerProducto,
  motivoDeError,
  nombreGrupo,
  productoNuevo,
  siguienteId,
  textoModificacion,
  validar,
  type Categoria,
  type ProductoFirestore,
  type ResultadoRol,
} from "./lib/admin";
import { dinero, escapar } from "./lib/formato";

type Campo = "estaDisponible" | "oculto";
import { $ } from "./ui/dom";

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
        lista = snap.docs.map((d) => leerProducto(d.id, d.data()));
        mostrar("panel");
        pintar();
      },
      () => {
        aviso("No se pudieron leer los productos. Revisa las reglas de Firestore.", true);
        mostrar("panel");
      },
    );
  }

  buscar.addEventListener("input", pintar);

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
    const foto = p.imagen ? `<img class="adm-mini" src="${escapar(p.imagen)}" alt="" loading="lazy">` : `<span class="adm-mini" aria-hidden="true"></span>`;
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
    imagen: $<HTMLInputElement>("#fImagen"),
    vista: $<HTMLImageElement>("#fFotoVista"),
    vacia: $("#fFotoVacia"),
    archivo: $<HTMLInputElement>("#fFotoArchivo"),
    quitar: $<HTMLButtonElement>("#fFotoQuitar"),
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
  let subiendo = false;

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
    f.imagen.value = p.imagen;
    verFoto(p.imagen);
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
      imagen: f.imagen.value.trim(),
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

  function verFoto(url: string): void {
    f.vista.hidden = !url;
    f.vacia.hidden = !!url;
    if (url) f.vista.src = url;
    else f.vista.removeAttribute("src");
    f.quitar.hidden = !url;
  }
  f.imagen.addEventListener("change", () => verFoto(f.imagen.value.trim()));
  f.quitar.addEventListener("click", () => {
    f.imagen.value = "";
    verFoto("");
  });

  f.archivo.addEventListener("change", async () => {
    const archivo = f.archivo.files?.[0];
    f.archivo.value = "";
    if (!archivo || !original) return;
    if (!firebaseWeb.storageBucket) return aviso("Falta activar Storage en Firebase para subir fotos. Puedes pegar el enlace de la foto.", true);
    subiendo = true;
    f.guardar.disabled = true;
    f.vacia.textContent = "Subiendo…";
    verFoto("");
    try {
      const jpg = await reducir(archivo);
      const destino = ref(getStorage(app), `productos/${original.id}/${Date.now()}.jpg`);
      await uploadBytes(destino, jpg, { contentType: "image/jpeg", cacheControl: "public,max-age=31536000" });
      const url = await getDownloadURL(destino);
      f.imagen.value = url;
      verFoto(url);
    } catch (e) {
      console.error("admin: no se pudo subir la foto", e);
      verFoto(f.imagen.value.trim());
      aviso("No se pudo subir la foto. Revisa que Storage esté activo y sus reglas.", true);
    } finally {
      subiendo = false;
      f.guardar.disabled = false;
      f.vacia.textContent = "Sin foto";
    }
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
    elimConfirmar.textContent = "Eliminando…";
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
    if (!original || subiendo) return;
    const p = leerFicha();
    const problema = validar(p, lista);
    if (problema) {
      f.error.textContent = problema;
      f.error.hidden = false;
      return;
    }
    f.error.hidden = true;
    f.guardar.disabled = true;
    f.guardar.textContent = "Guardando…";
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

/** Reduce la foto a 1200 px por lado como JPEG para que la app y la web carguen rápido. */
async function reducir(archivo: File): Promise<Blob> {
  const img = await createImageBitmap(archivo);
  const escala = Math.min(1, 1200 / Math.max(img.width, img.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(img.width * escala);
  lienzo.height = Math.round(img.height * escala);
  lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  img.close();
  return new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error("toBlob"))), "image/jpeg", 0.85));
}
