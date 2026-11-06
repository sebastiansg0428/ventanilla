export function prepararEstilosDom() {
  // jsdom carga la hoja del navegador y sus modulos CSS al consultar el primer estilo.
  window.getComputedStyle(document.body).getPropertyValue("display");
}
