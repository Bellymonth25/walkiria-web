# La Walkiria · Página de precios

Página estática con la lista de precios de las cenas de fin de año y un pedido que se arma
y se manda por WhatsApp. Hecha con **Vite + TypeScript**, sin framework.

## Cada temporada

Solo hay que tocar dos archivos:

| Archivo | Qué tiene |
|---|---|
| `src/data/productos.ts` | Productos, descripciones y precios. No cambies los `id`. |
| `src/data/temporada.ts` | Año, día límite, día de pedidos tardíos, anticipo, días de entrega, zonas de envío, teléfonos, dirección y horario. |

Los días de la semana se calculan solos a partir del año.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas de la lógica del pedido
npm run build      # revisa tipos y genera dist/
```

## Estructura

```
src/
  data/       productos y datos de la temporada (lo que se edita)
  lib/        lógica pura: formato, fechas, pedido y mensaje de WhatsApp
  ui/         pintar el menú y el pedido en el DOM
  main.ts     estado y eventos
tests/        pruebas con Vitest
public/CNAME  dominio propio para GitHub Pages
```

## Publicación (GitHub Pages)

1. En el repo: **Settings → Pages → Source: GitHub Actions**.
2. Cada push a `main` corre pruebas, compila y publica (`.github/workflows/deploy.yml`).
3. Dominio propio: `public/CNAME` tiene `www.lawalkiria.com.mx`. En el DNS del dominio:
   - `www` → registro **CNAME** a `bellymonth25.github.io`
   - raíz `lawalkiria.com.mx` → registros **A** a `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
4. En **Settings → Pages** escribe el dominio y activa **Enforce HTTPS** cuando GitHub termine de emitir el certificado.

Antes de mover el DNS, quita el dominio de Wix para que no choquen.
