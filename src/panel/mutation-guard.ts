export type PanelHeaders = Readonly<Record<string, string | string[] | undefined>>;

export type MutationGuardResult =
  | { ok: true }
  | { ok: false; reason: "origin" | "host" | "content_type" };

export function validarMutacaoDoPainel(
  headers: PanelHeaders,
  expectedOrigin: string
): MutationGuardResult {
  if (headers.origin !== expectedOrigin) return { ok: false, reason: "origin" };
  if (headers.host !== new URL(expectedOrigin).host) return { ok: false, reason: "host" };
  const contentType = headers["content-type"];
  if (
    typeof contentType !== "string" ||
    contentType.split(";", 1)[0].trim().toLowerCase() !== "application/json"
  ) {
    return { ok: false, reason: "content_type" };
  }
  return { ok: true };
}
