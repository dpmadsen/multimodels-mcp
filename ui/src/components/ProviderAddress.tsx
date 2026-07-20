// Endereço editável de uma instância do LM Studio (IP e porta da máquina).
// Mostra o endereço curto (sem http:// e sem /v1); ao salvar, completa
// esses detalhes técnicos sozinho.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProvider, type ProviderState } from "@/lib/api";

interface Props {
  provider: ProviderState;
  onChanged: () => void;
  onError: (message: string) => void;
}

// "http://192.168.0.42:1234/v1" -> "192.168.0.42:1234"
function shortAddress(baseUrl: string | null): string {
  return (baseUrl ?? "").replace(/^https?:\/\//, "").replace(/\/v1\/?$/, "");
}

// "192.168.0.42:5000" -> "http://192.168.0.42:5000/v1"
function fullAddress(raw: string): string {
  let addr = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(addr)) addr = `http://${addr}`;
  if (!addr.endsWith("/v1")) addr = `${addr}/v1`;
  return addr;
}

export function ProviderAddress({ provider, onChanged, onError }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(shortAddress(provider.baseUrl));
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setValue(shortAddress(provider.baseUrl));
    setEditing(true);
  }

  async function handleSave() {
    const baseUrl = fullAddress(value);
    if (!value.trim() || baseUrl === provider.baseUrl) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateProvider(provider.id, { baseUrl });
      setEditing(false);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">Endereço da máquina</span>
      {editing ? (
        <>
          <Input
            autoFocus
            value={value}
            maxLength={200}
            placeholder="ip:porta (ex.: 192.168.0.42:1234)"
            className="h-8 max-w-64 font-mono"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label="Novo endereço da máquina"
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
          <code className="rounded bg-muted px-2 py-0.5 font-mono">
            {shortAddress(provider.baseUrl)}
          </code>
          <Button
            variant="ghost"
            size="sm"
            className="px-2 text-muted-foreground"
            aria-label={`Editar endereço de ${provider.label}`}
            title="Editar endereço"
            onClick={startEditing}
          >
            ✎
          </Button>
        </>
      )}
    </div>
  );
}
