// Lista dos modelos habilitados de um provedor, com botão de remover e —
// nos motores que aceitam — a escolha do esforço de raciocínio de cada um.
import { Button } from "@/components/ui/button";
import { EffortSelect } from "./EffortSelect";

interface Props {
  models: string[];
  onRemove: (model: string) => void;
  // Os três campos abaixo só vêm nos motores que aceitam controle de esforço.
  // Sem eles, a lista fica exatamente como sempre foi.
  effortOptions?: string[];
  defaultEffortByModel?: Record<string, string>;
  // Recebe string vazia quando o Daniel escolhe "padrão do fabricante".
  onEffortChange?: (model: string, effort: string) => void;
}

export function ModelList({
  models,
  onRemove,
  effortOptions,
  defaultEffortByModel,
  onEffortChange,
}: Props) {
  if (models.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum modelo habilitado ainda.</p>;
  }
  const mostraEsforco = Boolean(effortOptions && effortOptions.length > 0 && onEffortChange);
  return (
    <ul className="space-y-1">
      {models.map((model) => (
        <li
          key={model}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm"
        >
          <span className="truncate font-mono">{model}</span>
          <div className="flex flex-wrap items-center gap-2">
            {mostraEsforco && (
              <EffortSelect
                model={model}
                options={effortOptions!}
                value={defaultEffortByModel?.[model] ?? ""}
                onChange={(effort) => onEffortChange!(model, effort)}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => onRemove(model)}
              aria-label={`Remover ${model}`}
            >
              ✕
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
