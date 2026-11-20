import { fotosPlatillos } from "../data/galeria";
import { productos } from "../data/productos";
import { firebase } from "../data/temporada";
import { aplicarCatalogo } from "../lib/catalogo";
import { disponibilidadGuardada, estaAgotado, estaOculto, leerDisponibilidad, type Disponibilidad } from "../lib/disponibilidad";
import { armarGaleria, firmaGaleria, type FotoVista } from "../lib/galeria";

/** Para probar en local: ?agotados=PROD_009 y ?ocultos=PROD_001 (igual que en el pedido). */
const prueba = (nombre: "agotados" | "ocultos"): string[] =>
  (new URLSearchParams(location.search).get(nombre) ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function armar(d: Disponibilidad | null): FotoVista[] {
  const agotados = new Set([...(d?.agotados ?? []), ...prueba("agotados")]);
  const ocultos = new Set([...(d?.ocultos ?? []), ...prueba("ocultos")]);
  return armarGaleria(fotosPlatillos, aplicarCatalogo(productos, d?.catalogo ?? new Map()), {
    agotado: (p) => estaAgotado(p, agotados),
    oculto: (p) => estaOculto(p, ocultos),
  });
}

/**
 * Galería que sigue al súper panel: pinta enseguida con lo último que se leyó (o con la lista de la
 * página en la primera visita) y, cuando llega Firestore, vuelve a pintar solo si algo cambió
 * (un producto oculto, agotado o con fotos nuevas).
 */
export function galeriaViva(pintar: (fotos: FotoVista[], primeraVez: boolean) => void): void {
  const inicial = armar(disponibilidadGuardada());
  let firma = firmaGaleria(inicial);
  pintar(inicial, true);
  void leerDisponibilidad(firebase.proyecto, firebase.documento).then((d) => {
    if (!d) return;
    const nuevas = armar(d);
    const f = firmaGaleria(nuevas);
    if (f === firma) return;
    firma = f;
    pintar(nuevas, false);
  });
}
