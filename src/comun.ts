import "./styles.css";
import "./encabezados.css";
import { maquila, negocio, temporada } from "./data/temporada";
import { dinero } from "./lib/formato";
import { enlaceWhatsApp } from "./lib/pedido";
import { $, llenar } from "./ui/dom";
import { iniciarLuces } from "./ui/luces";
import { iniciarNieve } from "./ui/nieve";
import { iniciarTema } from "./ui/tema";

/** Lo que comparten todas las páginas: barra de arriba, tema, luces, nieve y los datos de la temporada. */
export function iniciarComun(): void {
  iniciarTema($<HTMLButtonElement>("#themeToggle"));
  iniciarLuces($(".lights"));
  const lienzo = document.querySelector<HTMLCanvasElement>("#snow");
  const nieve = document.querySelector<HTMLButtonElement>("#snowToggle");
  if (lienzo && nieve) iniciarNieve(lienzo, nieve);

  llenar("anio", String(temporada.anio));
  llenar(
    "cortes",
    temporada.cortes
      .map((c) => `Para ${c.para}, hasta el ${c.limite} de diciembre; el ${c.tardio} se reciben sujetos a disponibilidad.`)
      .join(" "),
  );
  // En "Antes de pedir" cada corte va en su propio renglón para que no se vea cargado.
  document.querySelectorAll<HTMLElement>('[data-cfg="cortesLineas"]').forEach((el) => {
    el.innerHTML = temporada.cortes
      .map((c) => `<span class="corte">Para ${c.para}, hasta el <b>${c.limite} de diciembre</b>; el ${c.tardio} se reciben sujetos a disponibilidad.</span>`)
      .join("");
  });
  llenar("anticipo", temporada.anticipo);
  llenar("notaPrecios", temporada.notaPrecios);
  llenar("whatsapp", negocio.whatsappVisible);
  llenar("telefonos", negocio.telefonos);
  document.querySelectorAll<HTMLElement>('[data-cfg="telLinks"]').forEach((el) => {
    el.innerHTML = negocio.telefonosMarcar
      .map((n) => `<a class="tel" href="tel:+52${n}">${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}</a>`)
      .join(" / ");
  });
  llenar("direccion", negocio.direccion);
  llenar("horario", negocio.horario);
  llenar("precioCocinar", dinero(maquila.precioCocinarKg));
  llenar("precioRelleno", dinero(maquila.precioRellenoKg));
  llenar("diasAnticipacion", String(maquila.diasAnticipacion));
  llenar("diasAviso", String(temporada.diasAvisoDomicilio));
  llenar("diasPedido", String(temporada.diasAnticipacionPedido));

  $<HTMLAnchorElement>("#topWa").href = enlaceWhatsApp(negocio.whatsapp, "Hola, quiero información de las cenas navideñas.");

  // Lo que mide la barra de arriba (con luces), para que lo que se pega al hacer scroll quede justo debajo.
  const barra = $("header.top");
  new ResizeObserver(() => {
    document.documentElement.style.setProperty("--alto-top", `${barra.getBoundingClientRect().bottom}px`);
  }).observe(barra);
}
