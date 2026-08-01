import test from "node:test";
import assert from "node:assert/strict";
import { cacheHeaderFor } from "./cache-headers.js";

test("a página principal nunca fica guardada no navegador", () => {
  assert.match(cacheHeaderFor("/qualquer/pasta/ui/dist/index.html"), /no-store/);
});

test("os arquivos de código e estilo podem ficar guardados (o nome muda a cada versão)", () => {
  for (const arquivo of ["index-B-nXvuaM.js", "index-abc123.css", "logo.svg"]) {
    const header = cacheHeaderFor(`/qualquer/pasta/ui/dist/assets/${arquivo}`);
    assert.match(header, /immutable/);
    assert.doesNotMatch(header, /no-store/);
  }
});
