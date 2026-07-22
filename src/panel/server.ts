#!/usr/bin/env node
// Servidor do painel de controle: uma página local (só o seu Mac acessa)
// pra gerenciar chaves de API e escolher os modelos habilitados.
// Regras de segurança: escuta apenas em 127.0.0.1 e nunca devolve
// uma chave inteira — só os 4 últimos caracteres.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { spawn } from "node:child_process";
import { loadConfig, loadEnvFile, projectRoot } from "../config.js";
import { upsertEnvKey, maskKey } from "./env-file.js";
import { applyConfigUpdate, saveConfig } from "./config-write.js";
import { fetchOpenRouterCatalog, fetchLmStudioModels, resolveLmStudioProvider } from "./catalog.js";

const HOST = "127.0.0.1";
// Porta padrão 4747; MULTIMODELS_PANEL_PORT permite trocar (ex.: pra testes).
const PORT = Number(process.env.MULTIMODELS_PANEL_PORT) || 4747;
const UI_DIST = join(projectRoot, "ui", "dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 1024 * 1024) throw new Error("Corpo da requisição grande demais.");
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function stateSnapshot(): unknown {
  const config = loadConfig();
  const providers = Object.entries(config.providers).map(([id, provider]) => ({
    id,
    label: provider.label,
    type: provider.type,
    enabled: provider.enabled,
    models: provider.type === "openai-compat" ? provider.models : [],
    baseUrl: provider.type === "openai-compat" ? provider.baseUrl : null,
    key:
      provider.type === "openai-compat" && provider.envKey
        ? { envKey: provider.envKey, ...maskKey(process.env[provider.envKey]) }
        : null,
  }));
  return { providers };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, stateSnapshot());
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/keys") {
    const body = (await readBody(req)) as { envKey?: string; value?: string };
    if (!body.envKey || typeof body.value !== "string") {
      sendJson(res, 400, { error: "Envie envKey e value." });
      return;
    }
    const config = loadConfig();
    const known = Object.values(config.providers).some(
      (p) => p.type === "openai-compat" && p.envKey === body.envKey
    );
    if (!known) {
      sendJson(res, 400, { error: `A variável "${body.envKey}" não pertence a nenhum provedor configurado.` });
      return;
    }
    upsertEnvKey(join(projectRoot, ".env"), body.envKey, body.value);
    process.env[body.envKey] = body.value.trim();
    sendJson(res, 200, { ok: true, ...maskKey(body.value) });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/config") {
    const body = await readBody(req);
    const next = applyConfigUpdate(loadConfig(), body);
    saveConfig(projectRoot, next);
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/catalog/openrouter") {
    sendJson(res, 200, { models: await fetchOpenRouterCatalog() });
    return;
  }
  // Detecção de modelos de qualquer instância do LM Studio:
  // /api/catalog/lmstudio (a do próprio Mac) ou /api/catalog/lmstudio/<id>.
  if (req.method === "GET" && url.pathname.startsWith("/api/catalog/lmstudio")) {
    const suffix = url.pathname.slice("/api/catalog/lmstudio".length);
    const providerId = suffix.startsWith("/") ? decodeURIComponent(suffix.slice(1)) : "lmstudio";
    let provider;
    try {
      provider = resolveLmStudioProvider(loadConfig(), providerId);
    } catch (err) {
      sendJson(res, 404, { error: err instanceof Error ? err.message : String(err) });
      return;
    }
    sendJson(res, 200, await fetchLmStudioModels(provider));
    return;
  }
  sendJson(res, 404, { error: "Rota não encontrada." });
}

function serveStatic(res: ServerResponse, pathname: string): void {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = normalize(join(UI_DIST, relative));
  if (!filePath.startsWith(UI_DIST)) {
    res.writeHead(403);
    res.end();
    return;
  }
  const finalPath = existsSync(filePath) ? filePath : join(UI_DIST, "index.html");
  if (!existsSync(finalPath)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      "<h1>Painel ainda não compilado</h1><p>Rode <code>npm run build:ui</code> na pasta do projeto e recarregue.</p>"
    );
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[extname(finalPath)] ?? "application/octet-stream" });
  res.end(readFileSync(finalPath));
}

loadEnvFile();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch((err) => {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    });
    return;
  }
  serveStatic(res, url.pathname);
});

// Abre a URL no navegador padrão em qualquer sistema (Mac, Linux, Windows).
// Sem navegador (ex.: servidor sem tela), falha em silêncio: o endereço já
// foi impresso no terminal, então o painel continua acessível à mão.
function openInBrowser(address: string): void {
  const [command, args]: [string, string[]] =
    process.platform === "darwin"
      ? ["open", [address]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", address]]
        : ["xdg-open", [address]];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  // O erro de "programa não existe" chega por evento, não por exceção;
  // sem este ouvinte ele derrubaria o processo do painel.
  child.on("error", () => {});
  child.unref();
}

server.listen(PORT, HOST, () => {
  const address = `http://${HOST}:${PORT}`;
  console.log(`Painel do multimodels-mcp aberto em ${address}`);
  if (process.env.MULTIMODELS_NO_OPEN !== "1") {
    openInBrowser(address);
  }
});
