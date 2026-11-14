import "./styles.css";
import "./admin.css";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { collection, doc, getDoc, getFirestore, onSnapshot, query, updateDoc, where, type Unsubscribe } from "firebase/firestore";
import { productos } from "./data/productos";
import { firebaseWeb } from "./data/temporada";
import { agrupar, leerProducto, nombreEnWeb, nombreGrupo, type ProductoFirestore } from "./lib/admin";
import { dinero, escapar } from "./lib/formato";
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
  const pendientes = new Set<string>();
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
    if (!(await esAdmin(usuario))) {
      await signOut(auth);
      error("Tu usuario no es administrador.");
      return;
    }
    escuchar();
  });

  async function esAdmin(u: User): Promise<boolean> {
    try {
      const snap = await getDoc(doc(db, "user", u.uid));
      const tipo = snap.get("type");
      return typeof tipo === "string" && tipo.toUpperCase() === "ADMIN";
    } catch {
      return false;
    }
  }

  // ---------- Lista en tiempo real ----------
  function escuchar(): void {
    const q = query(collection(db, "products"), where("categoria", "==", "Comida"));
    dejarDeEscuchar = onSnapshot(
      q,
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
    const apagados = lista.filter((p) => !p.disponible).length;
    const resumen = $("#resumen");
    resumen.classList.toggle("hay", apagados > 0);
    resumen.innerHTML =
      apagados === 0 ? "Todo está disponible" : `<b>${apagados} ${apagados === 1 ? "producto no disponible" : "productos no disponibles"}</b>`;

    const grupos = agrupar(lista, buscar.value);
    $("#lista").innerHTML = grupos.length
      ? grupos
          .map(([g, ps]) => {
            const no = ps.filter((p) => !p.disponible).length;
            return `<section class="adm-grupo"><h2>${escapar(nombreGrupo(g))}${no ? ` <small>${no} no disponible${no > 1 ? "s" : ""}</small>` : ""}</h2>
              <div class="adm-filas">${ps.map(fila).join("")}</div></section>`;
          })
          .join("")
      : `<p class="adm-sub" style="margin-top:20px">No hay productos con ese nombre.</p>`;
  }

  function fila(p: ProductoFirestore): string {
    const web = nombreEnWeb(p.id, productos);
    const unidad = p.unidad ? ` / ${escapar(p.unidad)}` : "";
    return `<label class="adm-fila${p.disponible ? "" : " apagado"}${pendientes.has(p.id) ? " pendiente" : ""}">
      <span class="adm-info">
        <span class="adm-nombre">${escapar(p.nombre)}</span>
        <span class="adm-det"><span class="adm-precio">${dinero(p.precio)}${unidad}</span>${p.disponible ? "" : `<span class="adm-no">No disponible</span>`}${web ? "" : "<span>No aparece en la web</span>"}</span>
      </span>
      <input type="checkbox" role="switch" data-id="${escapar(p.id)}"${p.disponible ? " checked" : ""} aria-label="${escapar(p.nombre)} disponible">
      <span class="adm-switch" aria-hidden="true"></span>
    </label>`;
  }

  $("#lista").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const id = input.dataset.id;
    if (!id || pendientes.has(id)) return;
    const p = lista.find((x) => x.id === id);
    const disponible = input.checked;
    pendientes.add(id);
    pintar();
    try {
      await updateDoc(doc(db, "products", id), { estaDisponible: disponible });
      aviso(disponible ? `${p?.nombre ?? id} ya está disponible` : `${p?.nombre ?? id} quedó como no disponible`);
    } catch {
      aviso(`No se pudo cambiar ${p?.nombre ?? id}. Revisa tu conexión o tus permisos.`, true);
    } finally {
      pendientes.delete(id);
      pintar();
    }
  });
}
