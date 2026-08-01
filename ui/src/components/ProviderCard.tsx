// Cartão de um provedor: liga/desliga, chave de API, modelos habilitados
// e a forma de adicionar modelos específica de cada provedor.
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { isLmStudio, isLocalInstance, updateProvider, type ProviderState } from "@/lib/api";
import { KeyField } from "./KeyField";
import { ModelList } from "./ModelList";
import { AddModelInput } from "./AddModelInput";
import { OpenRouterCatalog } from "./OpenRouterCatalog";
import { LmStudioDetect } from "./LmStudioDetect";
import { ProviderAddress } from "./ProviderAddress";
import { ProviderName } from "./ProviderName";
import { TimeoutField } from "./TimeoutField";

interface Props {
  provider: ProviderState;
  // Prazo padrão em minutos, mostrado como dica quando este motor não tem
  // prazo próprio.
  defaultTimeoutMinutes: number;
  onChanged: () => void;
  onError: (message: string) => void;
}

const DESCRIPTIONS: Record<string, string> = {
  codex: "Usa o programa codex já logado no Mac — coberto pela assinatura do ChatGPT, sem custo de API.",
  gemini: "Usa o programa agy (Antigravity) já logado na conta Google — coberto pela assinatura Google AI Pro, sem custo de API.",
  deepseek: "Modelos da DeepSeek via API. Digite o id do modelo (ex.: deepseek-chat).",
  zai: "Modelos GLM da z.ai via API. Digite o id do modelo (ex.: glm-4.6).",
  openrouter: "Um catálogo com centenas de modelos de vários fabricantes numa chave só.",
  lmstudio: "Modelos rodando de graça no seu próprio Mac, pelo LM Studio.",
  "lmstudio-rede": "Modelos rodando de graça em outra máquina da sua rede, pelo LM Studio dela.",
  "glm-maos": "O GLM pilotando um Claude Code descartável: lê o projeto e roda os testes, mas não edita nada. Usa a chave da z.ai.",
  "deepseek-maos": "O DeepSeek pilotando um Claude Code descartável: lê o projeto e roda os testes, mas não edita nada. Usa a chave oficial da DeepSeek (pago por uso).",
  "kimi-maos": "O Kimi pilotando um Claude Code descartável: lê o projeto e roda os testes, mas não edita nada. Usa a chave oficial da Moonshot (platform.kimi.ai) — não é a mesma chave da OpenRouter.",
};

export function ProviderCard({ provider, defaultTimeoutMinutes, onChanged, onError }: Props) {
  async function apply(change: {
    enabled?: boolean;
    models?: string[];
    defaultEffortByModel?: Record<string, string | null>;
  }) {
    try {
      await updateProvider(provider.id, change);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  function addModel(model: string) {
    void apply({ models: [...provider.models, model] });
  }

  function removeModel(model: string) {
    void apply({ models: provider.models.filter((m) => m !== model) });
  }

  // Esforço padrão de um modelo: opção vazia volta ao padrão do fabricante.
  function changeEffort(model: string, effort: string) {
    void apply({ defaultEffortByModel: { [model]: effort === "" ? null : effort } });
  }

  // Prazo próprio deste motor: campo vazio volta a seguir o padrão geral.
  async function saveTimeout(minutes: number | null) {
    await updateProvider(provider.id, { timeoutMinutes: minutes });
    onChanged();
  }

  // A mesma linha de prazo aparece nos dois formatos de cartão (motores de
  // API e motores de assinatura), por isso mora numa variável só.
  const linhaPrazo = (
    <>
      <Separator />
      <TimeoutField
        title="Prazo de execução"
        minutes={provider.timeoutMinutes}
        emptyHint={`usando o padrão (${defaultTimeoutMinutes} min)`}
        allowEmpty
        onSave={saveTimeout}
        onError={onError}
      />
    </>
  );

  return (
    <Card className={provider.enabled ? "" : "opacity-60"}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            {isLmStudio(provider) ? (
              <ProviderName provider={provider} onChanged={onChanged} onError={onError} />
            ) : (
              provider.label
            )}
            {(provider.type === "codex-cli" ||
              provider.type === "gemini-cli" ||
              provider.type === "claude-cli") && (
              <Badge variant="secondary">assinatura</Badge>
            )}
            {isLmStudio(provider) && (
              <Badge variant="secondary">
                {isLocalInstance(provider) ? "grátis · local" : "grátis · rede"}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {provider.enabled ? "ligado" : "desligado"}
            </span>
            <Switch
              checked={provider.enabled}
              onCheckedChange={(enabled) => void apply({ enabled })}
              aria-label={`Ligar ou desligar ${provider.label}`}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{DESCRIPTIONS[provider.id] ?? ""}</p>
      </CardHeader>
      {provider.type === "openai-compat" && (
        <CardContent className="space-y-4">
          {provider.key && (
            <KeyField keyStatus={provider.key} onChanged={onChanged} onError={onError} />
          )}
          {isLmStudio(provider) && (
            <ProviderAddress provider={provider} onChanged={onChanged} onError={onError} />
          )}
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">Modelos habilitados</p>
            {/* O seletor de esforço só existe nos motores que sabem mandar
                esse ajuste; nos outros a lista continua igual a sempre. */}
            <ModelList
              models={provider.models}
              onRemove={removeModel}
              effortOptions={provider.effortOptions ?? undefined}
              defaultEffortByModel={provider.defaultEffortByModel ?? undefined}
              onEffortChange={provider.effortOptions ? changeEffort : undefined}
            />
          </div>
          {provider.id === "openrouter" && (
            <OpenRouterCatalog
              enabledModels={provider.models}
              onAdd={addModel}
              onError={onError}
            />
          )}
          {isLmStudio(provider) && (
            <LmStudioDetect provider={provider} onAdd={addModel} onError={onError} />
          )}
          {(provider.id === "deepseek" || provider.id === "zai") && (
            <AddModelInput placeholder="id do modelo…" onAdd={addModel} />
          )}
          {linhaPrazo}
        </CardContent>
      )}
      {(provider.type === "codex-cli" ||
        provider.type === "gemini-cli" ||
        provider.type === "claude-cli") && (
        <CardContent className="space-y-4">
          {/* As raias "com mãos" usam a chave do outro fabricante; o Codex e o
              Gemini entram por assinatura e não têm chave (aí nada aparece). */}
          {provider.key && (
            <KeyField keyStatus={provider.key} onChanged={onChanged} onError={onError} />
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium">Modelos habilitados</p>
            {/* As mesmas opções de esforço do cartão de API: a raia "com mãos"
                de assinatura também aceita esse ajuste desde a 0.11.0. Sem
                repassar aqui, o seletor existia no servidor, nos testes e no
                outro formato de cartão — e era invisível justamente na raia
                pra qual foi feito. */}
            <ModelList
              models={provider.models}
              onRemove={removeModel}
              effortOptions={provider.effortOptions ?? undefined}
              defaultEffortByModel={provider.defaultEffortByModel ?? undefined}
              onEffortChange={provider.effortOptions ? changeEffort : undefined}
            />
          </div>
          <AddModelInput placeholder="id do modelo…" onAdd={addModel} />
          {linhaPrazo}
        </CardContent>
      )}
    </Card>
  );
}
