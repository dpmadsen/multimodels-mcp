```javascript
import { z } from "zod";

// Detecta a versão do zod instalada: a v4 expõe z.email/z.ipv4/z.cidrv4 no topo.
const ehZod4 = typeof z.email === "function";

const esquemaEmail = ehZod4
  ? z.email({ error: "email inválido" })
  : z.string().email({ message: "email inválido" });

const esquemaIpv4 = ehZod4
  ? z.ipv4({ error: "endereço IPv4 inválido" })
  : z.string().ip({ version: "v4", message: "endereço IPv4 inválido" });

const esquemaCidrV4 = ehZod4
  ? z.cidrv4({ error: "faixa CIDR inválida" })
  : z.string().cidr({ version: "v4", message: "faixa CIDR inválida" });

const esquemaPorta = ehZod4
  ? z
      .number({
        error: (issue) =>
          issue.code === "invalid_type"
            ? "porta deve ser um número"
            : "porta fora da faixa",
      })
      .int("porta fora da faixa")
      .min(1, "porta fora da faixa")
      .max(65535, "porta fora da faixa")
  : z
      .number({
        required_error: "porta deve ser um número",
        invalid_type_error: "porta deve ser um número",
      })
      .int("porta fora da faixa")
      .min(1, "porta fora da faixa")
      .max(65535, "porta fora da faixa");

export const EsquemaConfiguracao = z.object({
  nome: z.string().min(3, "nome muito curto").max(80),
  email: esquemaEmail,
  servidorIp: esquemaIpv4,
  faixaLiberada: esquemaCidrV4,
  porta: esquemaPorta,
  precosPorServico: z.record(z.string(), z.number().int().positive()),
  contato: z
    .object({
      telefone: z.string().min(8).max(20),
    })
    .optional(),
});

export function validarConfiguracao(dados) {
  const resultado = EsquemaConfiguracao.safeParse(dados);

  if (resultado.success) {
    return { ok: true, dados: resultado.data };
  }

  return {
    ok: false,
    erros: resultado.error.issues.map((issue) => ({
      campo: issue.path.join("."),
      mensagem: issue.message,
    })),
  };
}
```