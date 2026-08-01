// Escolha do esforço de raciocínio padrão de UM modelo: quanto ele "pensa"
// antes de responder quando a delegação não pede nada. Os níveis aparecem
// com o nome cru de cada fabricante (é o que a API dele entende).
import { cn } from "@/lib/utils";

interface Props {
  // Modelo a que este seletor pertence (usado só pra descrever o campo).
  model: string;
  // Níveis que o fabricante aceita, na ordem em que devem aparecer.
  options: string[];
  // Esforço salvo hoje; vazio = segue o padrão do fabricante.
  value: string;
  // Salva a escolha; string vazia significa voltar ao padrão do fabricante.
  onChange: (effort: string) => void;
  disabled?: boolean;
}

// Mesmas classes do campo de texto (ui/input.tsx), pra o seletor ficar
// idêntico ao resto do painel — sem depender de biblioteca nova.
const CLASSES_DO_CAMPO =
  "h-8 w-auto min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80";

export function EffortSelect({ model, options, value, onChange, disabled }: Props) {
  return (
    <select
      className={cn(CLASSES_DO_CAMPO, "font-mono")}
      value={value}
      disabled={disabled}
      aria-label={`Esforço de raciocínio de ${model}`}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">padrão do fabricante</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
