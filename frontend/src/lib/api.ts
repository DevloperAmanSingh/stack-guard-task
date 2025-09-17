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
  resolved?: number;
  duplicates?: number;
  issues: { id: string; type: string }[];
  errors: string[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

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

export async function ignoreIssue(
  id: string,
  body?: { reason?: string; ttlDays?: number }
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/ignore/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`Failed to ignore: ${res.status}`);
  return res.json();
}

export async function bulkTicketsAction(
  action: "resolve" | "ignore",
  ids: string[]
): Promise<{ success: boolean; updated: number }> {
  const res = await fetch(`${API_BASE}/tickets/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ids }),
  });
  if (!res.ok) throw new Error(`Failed bulk action: ${res.status}`);
  return res.json();
}

export async function bulkScan(
  items: Array<{
    content?: string;
    text?: string;
    repo?: string;
    commit?: string;
    channel?: string;
    file?: string;
  }>
): Promise<{
  results: Array<{
    index: number;
    created: number;
    resolved: number;
    duplicates: number;
    error?: string;
  }>;
}> {
  const res = await fetch(`${API_BASE}/scan/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`Failed bulk scan: ${res.status}`);
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
