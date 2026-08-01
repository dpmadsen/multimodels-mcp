// Cartão do prazo padrão: vale pra todos os motores que não têm um prazo
// próprio. Fica no topo do painel, antes dos cartões de cada motor.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateDefaults, type DefaultsState } from "@/lib/api";
import { TimeoutField } from "./TimeoutField";

interface Props {
  defaults: DefaultsState;
  onChanged: () => void;
  onError: (message: string) => void;
}

export function DefaultsCard({ defaults, onChanged, onError }: Props) {
  async function save(minutes: number | null) {
    // O padrão geral nunca fica vazio; o TimeoutField já barra isso antes.
    if (minutes === null) return;
    await updateDefaults({ timeoutMinutes: minutes });
    onChanged();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prazo de execução</CardTitle>
        <p className="text-sm text-muted-foreground">
          Quanto tempo esperar antes de desistir de uma delegação.
        </p>
      </CardHeader>
      <CardContent>
        <TimeoutField
          title="Padrão para todos os motores"
          minutes={defaults.timeoutMinutes}
          emptyHint=""
          allowEmpty={false}
          onSave={save}
          onError={onError}
        />
      </CardContent>
    </Card>
  );
}
