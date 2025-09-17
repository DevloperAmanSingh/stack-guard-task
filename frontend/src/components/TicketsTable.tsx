"use client";

import { useState } from "react";
import {
  Issue,
  resolveIssue,
  severityForType,
  ignoreIssue,
  bulkTicketsAction,
} from "@/lib/api";
import { SeverityBadge } from "./SeverityBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

type Props = {
  issues: Issue[];
  onNotify?: (msg: string, kind?: "success" | "error") => void;
};

export function TicketsTable({ issues, onNotify }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [view, setView] = useState<Issue | null>(null);
  const [ignoreId, setIgnoreId] = useState<string | null>(null);
  const [ignoreTTL, setIgnoreTTL] = useState<string>("");
  const [ignoreReason, setIgnoreReason] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  async function handleResolve(id: string) {
    try {
      setBusyId(id);
      await resolveIssue(id);
      // Optimistic remove from view
      const row = document.getElementById(`row-${id}`);
      row?.classList.add("opacity-50");
      onNotify?.("Resolved", "success");
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  async function handleIgnore(id: string) {
    try {
      setBusyId(id);
      const ttl = parseInt(ignoreTTL || "0", 10);
      await ignoreIssue(id, {
        reason: ignoreReason || undefined,
        ttlDays: isNaN(ttl) ? undefined : ttl,
      });
      const row = document.getElementById(`row-${id}`);
      row?.classList.add("opacity-50");
      onNotify?.("Ignored", "success");
    } finally {
      setBusyId(null);
      setIgnoreId(null);
      setIgnoreTTL("");
      setIgnoreReason("");
    }
  }

  async function handleBulk(action: "resolve" | "ignore") {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!ids.length) return;
    const res = await bulkTicketsAction(action, ids);
    if (res.success) {
      ids.forEach((id) =>
        document.getElementById(`row-${id}`)?.classList.add("opacity-50")
      );
      setSelected({});
      onNotify?.(`${action} ${res.updated} tickets`, "success");
    }
  }

  if (!issues.length) {
    return (
      <div className="text-sm text-zinc-400 py-8 text-center">
        No tickets found.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <div className="text-sm text-zinc-400">
          Showing {issues.length} tickets
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-600"
            onClick={() => handleBulk("resolve")}
          >
            Resolve Selected
          </Button>
          <Button
            variant="secondary"
            className="bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-600"
            onClick={() => handleBulk("ignore")}
          >
            Ignore Selected
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
            <TableHead className="w-10"></TableHead>
            <TableHead className="text-zinc-300 font-medium">ID</TableHead>
            <TableHead className="text-zinc-300 font-medium">Type</TableHead>
            <TableHead className="text-zinc-300 font-medium">
              Severity
            </TableHead>
            <TableHead className="text-zinc-300 font-medium">Status</TableHead>
            <TableHead className="text-zinc-300 font-medium">
              Location
            </TableHead>
            <TableHead className="text-zinc-300 font-medium text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((t) => {
            const sev = severityForType(t.type);
            const location =
              [t.repo, t.file].filter(Boolean).join(" / ") || "-";
            return (
              <TableRow
                key={t.id}
                id={`row-${t.id}`}
                className="border-zinc-800 hover:bg-zinc-900/30"
              >
                <TableCell>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-zinc-500"
                    checked={!!selected[t.id]}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [t.id]: e.target.checked }))
                    }
                  />
                </TableCell>
                <TableCell className="font-mono text-xs text-zinc-400 max-w-[200px] truncate">
                  {t.id}
                </TableCell>
                <TableCell className="text-white font-medium">
                  {t.type}
                </TableCell>
                <TableCell>
                  <SeverityBadge severity={sev} />
                </TableCell>
                <TableCell className="capitalize text-zinc-300">
                  {t.status}
                </TableCell>
                <TableCell className="text-zinc-300">{location}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Dialog
                      open={view?.id === t.id}
                      onOpenChange={(o) => setView(o ? t : null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 border-zinc-600 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="text-white text-lg">
                            Ticket Details
                          </DialogTitle>
                          <DialogDescription className="font-mono text-xs text-zinc-400 break-all">
                            {t.id}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex justify-between">
                              <span className="text-zinc-400">Type:</span>
                              <span className="text-white font-medium">
                                {t.type}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-zinc-400">Severity:</span>
                              <SeverityBadge severity={sev} />
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-400">Status:</span>
                              <span className="text-white capitalize">
                                {t.status}
                              </span>
                            </div>
                            <div></div>
                          </div>

                          {(t.repo || t.commit || t.channel || t.file) && (
                            <div className="border-t border-zinc-800 pt-4">
                              <h4 className="text-zinc-300 font-medium mb-3">
                                Location Details
                              </h4>
                              <div className="grid grid-cols-1 gap-3 text-sm">
                                {t.repo && (
                                  <div className="flex justify-between">
                                    <span className="text-zinc-400">
                                      Repository:
                                    </span>
                                    <span className="text-white font-mono text-xs">
                                      {t.repo}
                                    </span>
                                  </div>
                                )}
                                {t.commit && (
                                  <div className="flex justify-between">
                                    <span className="text-zinc-400">
                                      Commit:
                                    </span>
                                    <span className="text-white font-mono text-xs">
                                      {t.commit}
                                    </span>
                                  </div>
                                )}
                                {t.channel && (
                                  <div className="flex justify-between">
                                    <span className="text-zinc-400">
                                      Channel:
                                    </span>
                                    <span className="text-white">
                                      {t.channel}
                                    </span>
                                  </div>
                                )}
                                {t.file && (
                                  <div className="flex justify-between">
                                    <span className="text-zinc-400">File:</span>
                                    <span className="text-white font-mono text-xs break-all">
                                      {t.file}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {(t.createdAt || t.updatedAt) && (
                            <div className="border-t border-zinc-800 pt-4">
                              <h4 className="text-zinc-300 font-medium mb-3">
                                Timestamps
                              </h4>
                              <div className="grid grid-cols-1 gap-3 text-sm">
                                {t.createdAt && (
                                  <div className="flex justify-between">
                                    <span className="text-zinc-400">
                                      Created:
                                    </span>
                                    <span className="text-white text-xs">
                                      {new Date(t.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                                {t.updatedAt && (
                                  <div className="flex justify-between">
                                    <span className="text-zinc-400">
                                      Updated:
                                    </span>
                                    <span className="text-white text-xs">
                                      {new Date(t.updatedAt).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <DialogFooter className="gap-2 pt-4">
                          {t.status !== "resolved" && (
                            <Button
                              onClick={() => handleResolve(t.id)}
                              disabled={busyId === t.id}
                              className="bg-green-700 hover:bg-green-600 text-white"
                            >
                              {busyId === t.id ? "Resolving..." : "Resolve"}
                            </Button>
                          )}
                          <Button
                            variant="default"
                            onClick={() => setView(null)}
                            className="border-zinc-600 text-zinc-300 hover:text-white hover:bg-zinc-800"
                          >
                            Close
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {t.status !== "resolved" && (
                      <Dialog
                        open={confirmId === t.id}
                        onOpenChange={(o) => setConfirmId(o ? t.id : null)}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyId === t.id}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-600"
                          >
                            Resolve
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-950 border-zinc-800">
                          <DialogHeader>
                            <DialogTitle className="text-white">
                              Resolve Ticket
                            </DialogTitle>
                            <DialogDescription className="text-zinc-400">
                              This will close the corresponding Linear issue.
                              Continue?
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button
                              variant="default"
                              onClick={() => setConfirmId(null)}
                              className="border-zinc-600 text-zinc-300 hover:text-white hover:bg-zinc-800"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleResolve(t.id)}
                              disabled={busyId === t.id}
                              className="bg-red-700 hover:bg-red-600 text-white"
                            >
                              {busyId === t.id ? "Resolving..." : "Confirm"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                    {t.status !== "ignored" && (
                      <Dialog
                        open={ignoreId === t.id}
                        onOpenChange={(o) => setIgnoreId(o ? t.id : null)}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyId === t.id}
                            className="border-zinc-600 bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                          >
                            Ignore
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-950 border-zinc-800">
                          <DialogHeader>
                            <DialogTitle className="text-white">
                              Ignore Ticket
                            </DialogTitle>
                            <DialogDescription className="text-zinc-400">
                              Optionally set a TTL (days) and reason.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex gap-3">
                            <input
                              placeholder="TTL days"
                              className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white w-32"
                              value={ignoreTTL}
                              onChange={(e) => setIgnoreTTL(e.target.value)}
                            />
                            <input
                              placeholder="Reason (optional)"
                              className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white flex-1"
                              value={ignoreReason}
                              onChange={(e) => setIgnoreReason(e.target.value)}
                            />
                          </div>
                          <DialogFooter>
                            <Button
                              variant="default"
                              onClick={() => setIgnoreId(null)}
                              className="border-zinc-600 text-zinc-300 hover:text-white hover:bg-zinc-800"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleIgnore(t.id)}
                              disabled={busyId === t.id}
                              className="bg-yellow-700 hover:bg-yellow-600 text-white"
                            >
                              {busyId === t.id ? "Ignoring..." : "Confirm"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableCaption className="text-zinc-500 py-3"></TableCaption>
      </Table>
    </div>
  );
}
