// Navegador do catálogo do OpenRouter: busca entre centenas de modelos
// (com preço e tamanho de contexto) e adiciona os escolhidos ao cardápio.
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getOpenRouterCatalog, type CatalogModel } from "@/lib/api";

interface Props {
  enabledModels: string[];
  onAdd: (model: string) => void;
  onError: (message: string) => void;
}

function formatPricePerMillion(perToken: string | null): string {
  if (perToken === null) return "?";
  const value = Number.parseFloat(perToken) * 1_000_000;
  if (Number.isNaN(value)) return "?";
  if (value === 0) return "grátis";
  return `$${value.toFixed(2)}/M`;
}

function formatContext(context: number | null): string {
  if (!context) return "";
  return `${Math.round(context / 1000)}k contexto`;
}

export function OpenRouterCatalog({ enabledModels, onAdd, onError }: Props) {
  const [catalog, setCatalog] = useState<CatalogModel[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getOpenRouterCatalog()
      .then((r) => setCatalog(r.models))
      .catch((err) => onError(err instanceof Error ? err.message : String(err)));
  }, [onError]);

  const results = useMemo(() => {
    if (!catalog || search.trim().length < 2) return [];
    const term = search.trim().toLowerCase();
    return catalog
      .filter((m) => m.id.toLowerCase().includes(term) || m.name.toLowerCase().includes(term))
      .slice(0, 12);
  }, [catalog, search]);

  return (
    <div className="space-y-2">
      <Input
        placeholder={
          catalog
            ? `Buscar entre ${catalog.length} modelos do catálogo…`
            : "Carregando catálogo do OpenRouter…"
        }
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={!catalog}
      />
      {results.length > 0 && (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {results.map((model) => {
            const added = enabledModels.includes(model.id);
            return (
              <li
                key={model.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{model.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {model.id} · {formatContext(model.context)} · entrada{" "}
                    {formatPricePerMillion(model.promptPrice)} · saída{" "}
                    {formatPricePerMillion(model.completionPrice)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={added}
                  onClick={() => onAdd(model.id)}
                >
                  {added ? "Adicionado" : "+ Adicionar"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {catalog && search.trim().length >= 2 && results.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum modelo encontrado com esse nome.</p>
      )}
    </div>
  );
}
