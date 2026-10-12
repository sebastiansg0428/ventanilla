import React from "react";
import { createRoot } from "react-dom/client";
import Aplicacion from "./Aplicacion";
import "../css/style.css";

// Vite monta React en el mismo elemento raíz de cada página HTML.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Aplicacion />
  </React.StrictMode>,
);
