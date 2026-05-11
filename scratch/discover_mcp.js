const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");

async function discoverTools() {
  const transport = new SSEClientTransport(new URL("http://127.0.0.1:8001/api/mcp"));
  const client = new Client({
    name: "Discovery-Client",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    console.log("=== DAFTAR TOOLS MCP ===");
    console.log(JSON.stringify(tools, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("Gagal terhubung ke MCP Server:", error.message);
    process.exit(1);
  }
}

discoverTools();
