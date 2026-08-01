// Prazo de execução em minutos: quanto tempo esperar antes de desistir de
// uma delegação. Usado em dois lugares — no cartão do padrão geral e no
// cartão de cada provedor (onde o campo vazio significa "segue o padrão").
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  // Texto à esquerda do campo (ex.: "Prazo de execução").
  title: string;
  // Prazo salvo hoje; null = não tem prazo próprio.
  minutes: number | null;
  // O que mostrar quando não há prazo próprio (ex.: "usando o padrão (10 min)").
  emptyHint: string;
  // Se o campo pode ficar vazio (só o prazo de cada provedor pode).
  allowEmpty: boolean;
  // Salva no servidor; null significa apagar o prazo próprio.
  onSave: (minutes: number | null) => Promise<void>;
  onError: (message: string) => void;
}

const MINIMO = 1;
const MAXIMO = 120;

export function TimeoutField({ title, minutes, emptyHint, allowEmpty, onSave, onError }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(minutes === null ? "" : String(minutes));
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setValue(minutes === null ? "" : String(minutes));
    setEditing(true);
  }

  async function handleSave() {
    const bruto = value.trim();

    // Campo vazio: só o prazo de um provedor pode voltar a seguir o padrão.
    if (bruto === "") {
      if (!allowEmpty) {
        onError("O prazo padrão não pode ficar vazio. Digite um número de 1 a 120 minutos.");
        return;
      }
      if (minutes === null) {
        setEditing(false);
        return;
      }
      await enviar(null);
      return;
    }

    const numero = Number(bruto);
    if (!Number.isInteger(numero) || numero < MINIMO || numero > MAXIMO) {
      onError(
        `Digite um número inteiro de minutos entre ${MINIMO} e ${MAXIMO} (você digitou "${bruto}").`
      );
      return;
    }
    if (numero === minutes) {
      setEditing(false);
      return;
    }
    await enviar(numero);
  }

  async function enviar(novo: number | null) {
    setSaving(true);
    try {
      await onSave(novo);
      setEditing(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{title}</span>
      {editing ? (
        <>
          <Input
            autoFocus
            type="number"
            inputMode="numeric"
            min={MINIMO}
            max={MAXIMO}
            value={value}
            placeholder={allowEmpty ? "vazio = segue o padrão" : "minutos"}
            className="h-8 max-w-40 font-mono"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label={`${title} em minutos`}
          />
          <Button variant="outline" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
            Cancelar
          </Button>
        </>
      ) : (
        <>
          {minutes === null ? (
            <span className="text-muted-foreground">{emptyHint}</span>
          ) : (
            <code className="rounded bg-muted px-2 py-0.5 font-mono">{minutes} min</code>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="px-2 text-muted-foreground"
            aria-label={`Editar ${title.toLowerCase()}`}
            title="Editar prazo"
            onClick={startEditing}
          >
            ✎
          </Button>
        </>
      )}
    </div>
  );
}
