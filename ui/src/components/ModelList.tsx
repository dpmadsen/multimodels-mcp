// Lista dos modelos habilitados de um provedor, com botão de remover.
import { Button } from "@/components/ui/button";

interface Props {
  models: string[];
  onRemove: (model: string) => void;
}

export function ModelList({ models, onRemove }: Props) {
  if (models.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum modelo habilitado ainda.</p>;
  }
  return (
    <ul className="space-y-1">
      {models.map((model) => (
        <li
          key={model}
          className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
        >
          <span className="truncate font-mono">{model}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onRemove(model)}
            aria-label={`Remover ${model}`}
          >
            ✕
          </Button>
        </li>
      ))}
    </ul>
  );
}
