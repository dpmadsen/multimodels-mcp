import { z } from "zod";

export const EsquemaConfiguracao = z.object({
  nome: z.string().min(3, "nome muito curto").max(80),
  email: z.email("email inválido"),
  servidorIp: z.ipv4("endereço IPv4 inválido"),
  faixaLiberada: z.cidrv4("faixa CIDR inválida"),
  porta: z
    .number({ error: "porta deve ser um número" })
    .int("porta fora da faixa")
    .min(1, "porta fora da faixa")
    .max(65535, "porta fora da faixa"),
  precosPorServico: z.record(z.string(), z.int().positive()),
  contato: z.object({ telefone: z.string().min(8).max(20) }).optional(),
});

export function validarConfiguracao(dados) {
  const r = EsquemaConfiguracao.safeParse(dados);
  if (r.success) return { ok: true, dados: r.data };
  return {
    ok: false,
    erros: r.error.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message })),
  };
}
