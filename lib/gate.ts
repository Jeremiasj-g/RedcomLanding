// lib/gate.ts
export const GATE_HASH: Record<string, string> = {
    // área -> hash SHA-256 en hex
    masivos: "bc1ae0999bd3c9efb60e6f316fb798363380b772bb60e4802de97eea2b2b4eea",
    refrigerados: "78da0e6c19a405c49943c8ec0e87257ef40d1754ffdf1032cad5cf383f8fd2df",
    chaco: "f5b948acefe6789c6e76b37f02e8ba360d265820b6d39b7c589797a1eabe35d1",
    misiones: "227fbf4a2c5ad2e2d6ee32ac90094ac1870df7ad941a4a1d989a4e2a824022f6",
    obera: "12d1394988d1cf02a23166a9503a9bccc8cf5d3b3f8b8840c8ea194eded78411",
    gerencia: "f4c855eb14d0307c29a4766dfd47439487c3dff300f6224774fcfd0a1cd90488",
};

export const GATE_TTL_MS = 8 * 60 * 60 * 1000; // 8h (cambiá a gusto)
/* export const GATE_TTL_MS = 60 * 1000; */ // 1 minuto durante dev

export async function sha256Hex(str: string): Promise<string> {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function gateKey(area: string) {
    return `gate:${area}`;
}

export function getSaved(area: string) {
    try {
        const raw = localStorage.getItem(gateKey(area));
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (Date.now() > obj.exp) {
            localStorage.removeItem(gateKey(area));
            return null;
        }
        return obj;
    } catch {
        return null;
    }
}
