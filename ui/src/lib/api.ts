// Conversa do painel com o servidor local (só no seu Mac).
export interface KeyStatus {
  envKey: string;
  set: boolean;
  last4: string | null;
}

export interface ProviderState {
  id: string;
  label: string;
  type: "openai-compat" | "codex-cli" | "gemini-cli" | "claude-cli";
  enabled: boolean;
  models: string[];
  baseUrl: string | null;
  key: KeyStatus | null;
}

export interface AppState {
  providers: ProviderState[];
}

export interface CatalogModel {
  id: string;
  name: string;
  context: number | null;
  promptPrice: string | null;
  completionPrice: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? `Erro ${response.status}`);
  }
  return body as T;
}

export function getState(): Promise<AppState> {
  return request<AppState>("/api/state");
}

export function saveKey(envKey: string, value: string): Promise<{ ok: boolean; last4: string }> {
  return request("/api/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envKey, value }),
  });
}

export function updateProvider(
  id: string,
  change: { enabled?: boolean; label?: string; baseUrl?: string; models?: string[] }
): Promise<{ ok: boolean }> {
  return request("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providers: { [id]: change } }),
  });
}

export function getOpenRouterCatalog(): Promise<{ models: CatalogModel[] }> {
  return request("/api/catalog/openrouter");
}

export function getLmStudioModels(
  providerId: string
): Promise<{ available: boolean; models: string[] }> {
  return request(`/api/catalog/lmstudio/${encodeURIComponent(providerId)}`);
}

// Instância do LM Studio (local ou em outra máquina da rede): é o provedor
// compatível com OpenAI que não usa chave de API.
export function isLmStudio(provider: ProviderState): boolean {
  return provider.type === "openai-compat" && provider.key === null;
}

// A instância roda neste próprio Mac?
export function isLocalInstance(provider: ProviderState): boolean {
  return Boolean(
    provider.baseUrl &&
      (provider.baseUrl.includes("localhost") || provider.baseUrl.includes("127.0.0.1"))
  );
}
