export const POLITICA_CONTRASENA =
  "Mínimo 10 caracteres; incluye una mayúscula, una minúscula, un número y un símbolo. No se permiten espacios. Máximo 72 bytes UTF-8.";

export function contrasenaValida(valor) {
  return typeof valor === "string" &&
    Array.from(valor).length >= 10 &&
    new TextEncoder().encode(valor).length <= 72 &&
    !valor.includes("\0") &&
    !/\s/u.test(valor) &&
    /\p{Lu}/u.test(valor) &&
    /\p{Ll}/u.test(valor) &&
    /[0-9]/.test(valor) &&
    /[^\p{L}\p{N}\s]/u.test(valor);
}
