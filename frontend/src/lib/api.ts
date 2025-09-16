export type Issue = {
  id: string;
  type: string;
  status: string;
  repo?: string;
  commit?: string;
  channel?: string;
  file?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ScanResponse = {
  success: boolean;
  created: number;
  issues: { id: string; type: string }[];
  errors: string[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function fetchIssues(): Promise<Issue[]> {
  const res = await fetch(`${API_BASE}/tickets`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch tickets: ${res.status}`);
  return res.json();
}

export async function resolveIssue(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/resolve/${id}`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to resolve: ${res.status}`);
  return res.json();
}

export async function startScan(payload: {
  content: string;
  repo?: string;
  commit?: string;
  channel?: string;
  file?: string;
}): Promise<ScanResponse> {
  const res = await fetch(`${API_BASE}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to scan: ${res.status}`);
  return res.json();
}

export function severityForType(type: string): "high" | "medium" | "low" {
  const t = type.toLowerCase();
  if (/(awsaccesskey|awssecretkey|stripe|jwt)/.test(t)) return "high";
  if (/(github|slack|google)/.test(t)) return "medium";
  return "low";
}
