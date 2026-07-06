// Validación y formateo de RUT chileno (dígito verificador módulo 11).

export function limpiarRut(rutInput: string): string {
  return rutInput.replace(/[.\-\s]/g, "").toUpperCase();
}

function calcularDigitoVerificador(cuerpo: string): string {
  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

/**
 * Valida un RUT chileno (cuerpo de 7-8 dígitos + dígito verificador 0-9 o K).
 */
export function validarRut(rutInput: string): boolean {
  const rut = limpiarRut(rutInput);
  if (!/^\d{7,8}[0-9K]$/.test(rut)) return false;

  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1);
  return calcularDigitoVerificador(cuerpo) === dv;
}

/**
 * Formatea un RUT limpio como "12.345.678-9".
 */
export function formatearRut(rutInput: string): string {
  const rut = limpiarRut(rutInput);
  if (rut.length < 2) return rut;

  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1);
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpoFormateado}-${dv}`;
}
