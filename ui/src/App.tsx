// Painel de controle do multimodels-mcp: gerencia chaves e modelos.
// O que for mudado aqui vale na hora pro Claude Code (o servidor
// relê a configuração a cada chamada).
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProviderCard } from "@/components/ProviderCard";
import { getState, type AppState } from "@/lib/api";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getState()
      .then((s) => {
        setState(s);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleError = useCallback((message: string) => setError(message), []);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 sm:p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">multimodels — painel de controle</h1>
        <p className="text-sm text-muted-foreground">
          Escolha quais modelos o Claude Code pode usar e gerencie as chaves de API. As mudanças
          valem imediatamente, sem reiniciar nada.
        </p>
      </header>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm">
          <span>Algo deu errado: {error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            fechar
          </Button>
        </div>
      )}

      {!state && !error && <p className="text-muted-foreground">Carregando…</p>}

      {state?.providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          onChanged={refresh}
          onError={handleError}
        />
      ))}

      <footer className="pt-2 text-xs text-muted-foreground">
        As chaves ficam guardadas só no seu Mac (arquivo .env do projeto) e nunca aparecem inteiras
        aqui. Este painel só aceita conexões do próprio computador.
      </footer>
    </main>
  );
}
