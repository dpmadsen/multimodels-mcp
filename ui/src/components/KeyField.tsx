// Campo de chave de API: mostra o status (nunca a chave inteira,
// só os 4 últimos caracteres) e permite colar/salvar uma nova.
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveKey, type KeyStatus } from "@/lib/api";

interface Props {
  keyStatus: KeyStatus;
  onChanged: () => void;
  onError: (message: string) => void;
}

export function KeyField({ keyStatus, onChanged, onError }: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await saveKey(keyStatus.envKey, value);
      setValue("");
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={keyStatus.envKey}>Chave de API</Label>
        {keyStatus.set ? (
          <Badge variant="secondary">configurada ····{keyStatus.last4}</Badge>
        ) : (
          <Badge variant="destructive">não configurada</Badge>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          id={keyStatus.envKey}
          type="password"
          placeholder={keyStatus.set ? "colar nova chave (substitui a atual)" : "colar a chave aqui"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button onClick={handleSave} disabled={saving || !value.trim()}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
