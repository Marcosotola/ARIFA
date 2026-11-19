// Notas estándar de presupuestos: orden de creación. Las recién creadas (createdAt todavía
// pendiente del servidor) van al final; las que no tienen fecha también se muestran.
export function ordenarNotas<T extends { createdAt?: any }>(notas: T[]): T[] {
  const ms = (n: T) => n.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
  return [...notas].sort((a, b) => ms(a) - ms(b));
}
