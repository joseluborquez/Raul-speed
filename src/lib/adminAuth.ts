// "Ser admin" no es solo "tener sesión de Supabase" — sin esto, cualquiera
// que se registre en el proyecto de Supabase (si el signup está abierto)
// entraría al panel y vería RUT/dirección/teléfono de todos los clientes.
// ADMIN_EMAILS es una lista separada por comas de los únicos correos con
// acceso al panel /admin y a las rutas /api/admin/*.

function listaAdmins(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function esEmailAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return listaAdmins().includes(email.toLowerCase());
}
