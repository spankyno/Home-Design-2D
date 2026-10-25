/**
 * The exporters pull in jsPDF (and, on demand, html2canvas), which together are
 * the heaviest part of the app. They are only needed when the user exports or
 * imports a file, so they are loaded on demand to keep the first load small.
 */
type Exporters = typeof import("./exporters");

export function withExporters<T>(fn: (m: Exporters) => T | Promise<T>): Promise<T> {
  return import("./exporters").then(fn);
}

export function reportExportError(e: unknown): void {
  console.error(e);
  alert("No se pudo completar la operación. Comprueba tu conexión e inténtalo de nuevo.");
}
