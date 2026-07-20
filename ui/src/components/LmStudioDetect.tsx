// Detecta os modelos baixados numa instância do LM Studio — a deste Mac
// ou a de outra máquina da rede — e permite adicioná-los com um clique.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getLmStudioModels, isLocalInstance, type ProviderState } from "@/lib/api";

interface Props {
  provider: ProviderState;
  onAdd: (model: string) => void;
  onError: (message: string) => void;
}

export function LmStudioDetect({ provider, onAdd, onError }: Props) {
  const [detected, setDetected] = useState<string[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const local = isLocalInstance(provider);

  async function handleDetect() {
    setLoading(true);
    setOffline(false);
    try {
      const result = await getLmStudioModels(provider.id);
      if (!result.available) {
        setOffline(true);
        setDetected(null);
      } else {
        setDetected(result.models);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={handleDetect} disabled={loading}>
        {loading ? "Procurando…" : "Detectar modelos baixados"}
      </Button>
      {offline && local && (
        <p className="text-sm text-muted-foreground">
          O LM Studio parece desligado. Abra o aplicativo LM Studio e ligue o servidor local (ou
          rode <code className="font-mono">lms server start</code> no Terminal), depois tente de
          novo.
        </p>
      )}
      {offline && !local && (
        <p className="text-sm text-muted-foreground">
          Não consegui falar com a outra máquina{" "}
          <code className="font-mono">{provider.baseUrl}</code>. Confira se ela está ligada e se o
          LM Studio dela está com o servidor ligado e a opção{" "}
          <span className="font-medium">"Serve on Local Network"</span> ativada (aba Developer),
          depois tente de novo.
        </p>
      )}
      {detected && detected.length === 0 && (
        <p className="text-sm text-muted-foreground">
          O LM Studio está ligado, mas sem nenhum modelo carregado na memória. Nos ajustes do LM
          Studio, você pode habilitar "JIT loading" pra carregar sob demanda — ou os modelos
          aparecem aqui quando você carregar um.
        </p>
      )}
      {detected && detected.length > 0 && (
        <ul className="space-y-1">
          {detected.map((model) => {
            const added = provider.models.includes(model);
            return (
              <li
                key={model}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5"
              >
                <span className="truncate font-mono text-sm">{model}</span>
                <Button variant="outline" size="sm" disabled={added} onClick={() => onAdd(model)}>
                  {added ? "Adicionado" : "+ Adicionar"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
