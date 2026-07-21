// Nome do provedor com apelido editável (usado nas instâncias do LM Studio):
// um lápis abre o campo, Enter ou "Salvar" grava, Esc cancela.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProvider, type ProviderState } from "@/lib/api";

interface Props {
  provider: ProviderState;
  onChanged: () => void;
  onError: (message: string) => void;
}

export function ProviderName({ provider, onChanged, onError }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(provider.label);
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setValue(provider.label);
    setEditing(true);
  }

  async function handleSave() {
    const label = value.trim();
    if (!label || label === provider.label) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateProvider(provider.id, { label });
      setEditing(false);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span className="flex items-center gap-1">
        {provider.label}
        <Button
          variant="ghost"
          size="sm"
          className="px-2 text-muted-foreground"
          aria-label={`Renomear ${provider.label}`}
          title="Renomear"
          onClick={startEditing}
        >
          ✎
        </Button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <Input
        autoFocus
        value={value}
        maxLength={60}
        className="h-8 max-w-56"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        aria-label="Novo apelido"
      />
      <Button variant="outline" size="sm" onClick={() => void handleSave()} disabled={saving}>
        {saving ? "Salvando…" : "Salvar"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
        Cancelar
      </Button>
    </span>
  );
}
