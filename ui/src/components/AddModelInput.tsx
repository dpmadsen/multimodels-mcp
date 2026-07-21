// Campo pra adicionar um modelo digitando o id (usado em DeepSeek e z.ai).
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  placeholder: string;
  onAdd: (model: string) => void;
}

export function AddModelInput({ placeholder, onAdd }: Props) {
  const [value, setValue] = useState("");

  function handleAdd() {
    const model = value.trim();
    if (!model) return;
    onAdd(model);
    setValue("");
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
      />
      <Button variant="outline" onClick={handleAdd} disabled={!value.trim()}>
        Adicionar
      </Button>
    </div>
  );
}
