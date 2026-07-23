import { z } from "zod";

// Compatibilidade zod v3 / v4: usa as APIs top-level do v4 quando existirem,
// caso contrário cai nas APIs clássicas do v3 (que também funcionam no v4).
const esquemaEmail =
  typeof z.email === "function"
    ? z.email("email inválido")
    : z.string().email("email inválido");

const esquemaIpv4 =
  typeof z.ipv4 === "function"
    ? z.ipv4("endereço IPv4 inválido")
    : z.string().ip({ version: "v4", message: "endereço IPv4 inválido" });

const esquemaCidrV4 =
  typeof z.cidrv4 === "function"
    ? z.cidrv4("faixa CIDR inválida")
    : z.string().cidr({ version: "v4", message: "faixa CIDR inválida" });

const esquemaPorta = z
  .number({
    invalid_type_error: "porta deve ser um número",
    required_error: "porta deve ser um número",
    message: "porta deve ser um número",
  })
  .int("porta fora da faixa")
  .min(1, "porta fora da faixa")
  .max(65535, "porta fora da faixa");

const esquemaPrecos = z.record(
  z.string(),
  z.number().int("preço deve ser um inteiro").positive("preço deve ser positivo")
);

const esquemaContato = z
  .object({
    telefone: z
      .string()
      .min(8, "telefone muito curto")
      .max(20, "telefone muito longo"),
  })
  .optional();

export const EsquemaConfiguracao = z.object({
  nome: z.string().min(3, "nome muito curto").max(80, "nome muito longo"),
  email: esquemaEmail,
  servidorIp: esquemaIpv4,
  faixaLiberada: esquemaCidrV4,
  porta: esquemaPorta,
  precosPorServico: esquemaPrecos,
  contato: esquemaContato,
});

export function validarConfiguracao(dados) {
  const resultado = EsquemaConfiguracao.safeParse(dados);

  if (resultado.success) {
    return { ok: true, dados: resultado.data };
  }

  const erros = resultado.error.issues.map((problema) => ({
    campo: problema.path.join("."),
    mensagem: problema.message,
  }));

  return { ok: false, erros };
}
