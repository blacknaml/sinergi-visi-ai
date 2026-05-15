const ECOM_API_BASE = process.env.ECOM_API_BASE || "http://127.0.0.1:8001/api/mcp";
const ECOM_STORAGE_BASE = process.env.ECOM_STORAGE_BASE || "http://127.0.0.1:8001/storage/";
const MCP_TOKEN = process.env.MCP_TOKEN || "";

/**
 * Fetch order details from eCommerce system
 */
async function getOrderDetails(orderNumber) {
  try {
    const response = await fetch(`${ECOM_API_BASE}/orders/${orderNumber}`, {
      headers: {
        'X-MCP-Token': MCP_TOKEN,
        'Accept': 'application/json'
      }
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.message === "Pesanan tidak ditemukan") return null;
    return data;
  } catch (error) {
    console.error("Error fetching order:", orderNumber, error.message);
    return null;
  }
}

/**
 * Report an approved claim back to the eCommerce MCP endpoint
 */
async function reportClaimToMCP(orderNumber, reason) {
  try {
    const payload = {
      order_number: typeof orderNumber === 'string' ? orderNumber.toUpperCase() : orderNumber,
      reason: reason || "Disetujui tanpa deskripsi spesifik",
      type: "refund",
      status: "completed"
    };
    
    console.log("[MCP] Reporting claim:", payload);

    const res = await fetch(`${ECOM_API_BASE}/claims`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-MCP-Token": MCP_TOKEN
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[MCP] Request failed with status ${res.status}:`, errorText.slice(0, 500));
      return;
    }
    
    const data = await res.json();
    console.log("[MCP] Claim reported:", data);
  } catch (err) {
    console.error("[MCP] Error reporting claim:", err);
  }
}

/**
 * Fetch products catalog from eCommerce system
 */
async function getProducts() {
  try {
    const response = await fetch(`${ECOM_API_BASE}/products`, {
      headers: {
        'X-MCP-Token': MCP_TOKEN,
        'Accept': 'application/json'
      }
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.message === "Katalog produk tidak ditemukan") return null;
    return data;
  } catch (error) {
    console.error("Error fetching order:", orderNumber, error.message);
    return null;
  }
}

module.exports = {
  ECOM_API_BASE,
  ECOM_STORAGE_BASE,
  MCP_TOKEN,
  getOrderDetails,
  reportClaimToMCP,
  getProducts
};
