#!/usr/bin/env node
// Porta de entrada: liga o servidor MCP quando o Claude Code chama.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, loadEnvFile } from "./config.js";
import { registerListModels } from "./tools/list-models.js";
import { registerDelegate } from "./tools/delegate.js";
import { registerCheckTask } from "./tools/check-task.js";

loadEnvFile();
// As ferramentas releem a configuração a cada chamada, pra refletir
// na hora o que for mudado no painel de controle.
const getConfig = () => loadConfig();

const server = new McpServer({ name: "multimodels-mcp", version: "0.1.0" });
registerListModels(server, getConfig);
registerDelegate(server, getConfig);
registerCheckTask(server);

const transport = new StdioServerTransport();
await server.connect(transport);
// Nada de console.log aqui: em servidores stdio, o canal de saída é do protocolo.
console.error("multimodels-mcp ligado e aguardando o Claude Code.");
