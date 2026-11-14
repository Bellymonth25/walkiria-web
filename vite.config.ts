import { defineConfig } from "vite";

// base relativa: funciona tanto en bellymonth25.github.io/walkiria-web/ (vista previa)
// como en la raíz del dominio propio (www.lawalkiria.com.mx).
export default defineConfig({
  base: "./",
  build: { target: "es2022", rollupOptions: { input: ["index.html", "pedido.html", "gravy.html", "galeria.html", "admin.html"] } },
});
