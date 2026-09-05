type Evento =
  | { event: "task.created" | "task.finished"; taskId: string; modelId: string; outcome?: "success" | "error" }
  | { event: "provider.start" | "provider.finish"; providerId: string; modelId: string; elapsedMs?: number; outcome?: "success" | "error" | "timeout" }
  | { event: "provider.retry"; providerId: string; modelId: string; attempt: 2; reason: "network" | "http_429" | "http_5xx" }
  | { event: "provider.reject"; providerId: string; modelId: string; reason: "redirect" | "response_bytes"; status?: number; observedBytes?: number; limitBytes?: number }
  | { event: "panel.reject"; reason: "origin" | "host" | "content_type" };

function eventoValido(evento: unknown): evento is Evento {
  if (!evento || typeof evento !== "object" || Array.isArray(evento)) return false;
  const valor = evento as Record<string, unknown>;
  const campos = Object.keys(valor);
  const permitidos: Record<string, readonly string[]> = {
    "task.created": ["event", "taskId", "modelId"],
    "task.finished": ["event", "taskId", "modelId", "outcome"],
    "provider.start": ["event", "providerId", "modelId"],
    "provider.finish": ["event", "providerId", "modelId", "elapsedMs", "outcome"],
    "provider.retry": ["event", "providerId", "modelId", "attempt", "reason"],
    "provider.reject": ["event", "providerId", "modelId", "reason", "status", "observedBytes", "limitBytes"],
    "panel.reject": ["event", "reason"],
  };
  const camposPermitidos = permitidos[String(valor.event)];
  if (!camposPermitidos || campos.some((campo) => !camposPermitidos.includes(campo))) return false;
  if (typeof valor.event !== "string") return false;
  const inteiroNaoNegativo = (valor: unknown) => typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0;
  if (valor.event.startsWith("task.")) {
    return typeof valor.taskId === "string" && typeof valor.modelId === "string" &&
      (valor.outcome === undefined || valor.outcome === "success" || valor.outcome === "error");
  }
  if (valor.event.startsWith("provider.")) {
    if (typeof valor.providerId !== "string" || typeof valor.modelId !== "string") return false;
    if (valor.event === "provider.retry") return valor.attempt === 2 && ["network", "http_429", "http_5xx"].includes(String(valor.reason));
    if (valor.event === "provider.reject") {
      return ["redirect", "response_bytes"].includes(String(valor.reason)) &&
        (valor.status === undefined || inteiroNaoNegativo(valor.status)) &&
        (valor.observedBytes === undefined || inteiroNaoNegativo(valor.observedBytes)) &&
        (valor.limitBytes === undefined || inteiroNaoNegativo(valor.limitBytes));
    }
    return (valor.outcome === undefined || ["success", "error", "timeout"].includes(String(valor.outcome))) &&
      (valor.elapsedMs === undefined || inteiroNaoNegativo(valor.elapsedMs));
  }
  return valor.event === "panel.reject" && ["origin", "host", "content_type"].includes(String(valor.reason));
}

export function registrarEvento(evento: Evento): void {
  if (!eventoValido(evento)) throw new Error("Evento invalido para observabilidade.");
  console.error(JSON.stringify({ ts: new Date().toISOString(), ...evento }));
}
