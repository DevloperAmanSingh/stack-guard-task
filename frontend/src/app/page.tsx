"use client";

import { useEffect, useState } from "react";
import { Issue, fetchIssues, startScan, bulkScan } from "@/lib/api";
import { TicketsTable } from "@/components/TicketsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function Page() {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("active");
  const [scanning, setScanning] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [scanForm, setScanForm] = useState({
    content: "",
    repo: "",
    commit: "",
    channel: "",
    file: "",
  });
  const [bulkText, setBulkText] = useState("");
  const [bulkMeta, setBulkMeta] = useState({
    repo: "",
    commit: "",
    channel: "",
    file: "",
  });
  const [bulkLoading, setBulkLoading] = useState(false);

  const [toasts, setToasts] = useState<
    { id: number; msg: string; kind: "success" | "error" }[]
  >([]);
  function notify(msg: string, kind: "success" | "error" = "success") {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }

  async function load() {
    try {
      setErr(null);
      const data = await fetchIssues();
      setIssues(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setErr(e.message || "Failed to load");
      setIssues([]);
    }
  }

  async function handleScan() {
    try {
      setScanning(true);
      setErr(null);
      await startScan(scanForm);
      // Auto refresh after scan
      await load();
      setScanModalOpen(false);
      notify("Scan completed", "success");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setErr(e.message || "Failed to scan");
      notify(e.message || "Scan failed", "error");
    } finally {
      setScanning(false);
    }
  }

  async function handleBulkScan() {
    try {
      setBulkLoading(true);
      const blocks = bulkText
        .split(/\n-{3,}\n/g)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!blocks.length) {
        notify("No items to scan", "error");
        return;
      }
      const items = blocks.map((content) => ({
        content,
        repo: bulkMeta.repo || undefined,
        commit: bulkMeta.commit || undefined,
        channel: bulkMeta.channel || undefined,
        file: bulkMeta.file || undefined,
      }));
      const res = await bulkScan(items);
      const created = res.results.reduce((a, r) => a + (r.created || 0), 0);
      const resolved = res.results.reduce((a, r) => a + (r.resolved || 0), 0);
      const duplicates = res.results.reduce(
        (a, r) => a + (r.duplicates || 0),
        0
      );
      notify(
        `Bulk scan ok: created=${created}, resolved=${resolved}, dup=${duplicates}`,
        "success"
      );
      await load();
      setBulkModalOpen(false);
      setBulkText("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      notify(e?.message || "Bulk scan failed", "error");
    } finally {
      setBulkLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const active = (issues || []).filter((i) => i.status !== "resolved");
  const resolved = (issues || []).filter((i) => i.status === "resolved");

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-white">
            Vulnerability Tickets
          </h1>
          <div className="flex gap-2">
            <Dialog open={scanModalOpen} onOpenChange={setScanModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-none border border-blue-700/40">
                  Start Scan
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-950 border-zinc-800 max-w-3xl w-[90vw]">
                <DialogHeader>
                  <DialogTitle className="text-white text-lg">
                    Start Vulnerability Scan
                  </DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Enter the content to scan and optional metadata. The system
                    will detect secrets and create Linear tickets.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 max-h-[75vh] overflow-auto pr-1">
                  <div className="space-y-2">
                    <Label htmlFor="content" className="text-zinc-300">
                      Content to Scan *
                    </Label>
                    <Textarea
                      id="content"
                      value={scanForm.content}
                      onChange={(e) =>
                        setScanForm({ ...scanForm, content: e.target.value })
                      }
                      className="bg-zinc-900 border-zinc-700 text-white min-h-[200px] max-h-[40vh]"
                      placeholder="Enter logs, code, or any text content to scan for secrets..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="repo" className="text-zinc-300">
                        Repository
                      </Label>
                      <Input
                        id="repo"
                        value={scanForm.repo}
                        onChange={(e) =>
                          setScanForm({ ...scanForm, repo: e.target.value })
                        }
                        className="bg-zinc-900 border-zinc-700 text-white"
                        placeholder="acme/payments-service"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commit" className="text-zinc-300">
                        Commit Hash
                      </Label>
                      <Input
                        id="commit"
                        value={scanForm.commit}
                        onChange={(e) =>
                          setScanForm({ ...scanForm, commit: e.target.value })
                        }
                        className="bg-zinc-900 border-zinc-700 text-white"
                        placeholder="f1a2b3c4"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="channel" className="text-zinc-300">
                        Channel
                      </Label>
                      <Input
                        id="channel"
                        value={scanForm.channel}
                        onChange={(e) =>
                          setScanForm({ ...scanForm, channel: e.target.value })
                        }
                        className="bg-zinc-900 border-zinc-700 text-white"
                        placeholder="slack:#prod-alerts"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="file" className="text-zinc-300">
                        File Path
                      </Label>
                      <Input
                        id="file"
                        value={scanForm.file}
                        onChange={(e) =>
                          setScanForm({ ...scanForm, file: e.target.value })
                        }
                        className="bg-zinc-900 border-zinc-700 text-white"
                        placeholder="cmd/api/server.go"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    variant="default"
                    onClick={() => setScanModalOpen(false)}
                    className="border-zinc-600 text-zinc-300 hover:text-white hover:bg-zinc-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleScan}
                    disabled={scanning || !scanForm.content.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {scanning ? "Scanning..." : "Start Scan"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-700 hover:bg-purple-600 text-white shadow-none border border-purple-700/40">
                  Bulk Scan
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-950 border-zinc-800 max-w-4xl w-[95vw]">
                <DialogHeader>
                  <DialogTitle className="text-white text-lg">
                    Bulk Vulnerability Scan
                  </DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Paste multiple contents separated by a line with three
                    dashes (---).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 max-h-[75vh] overflow-auto pr-1">
                  <div className="space-y-2">
                    <Label htmlFor="bulkText" className="text-zinc-300">
                      Items (--- separator)
                    </Label>
                    <Textarea
                      id="bulkText"
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white min-h-[220px]"
                      placeholder={`<content item 1>\n---\n<content item 2>\n---\n<content item 3>`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Repository</Label>
                      <Input
                        value={bulkMeta.repo}
                        onChange={(e) =>
                          setBulkMeta({ ...bulkMeta, repo: e.target.value })
                        }
                        className="bg-zinc-900 border-zinc-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Commit</Label>
                      <Input
                        value={bulkMeta.commit}
                        onChange={(e) =>
                          setBulkMeta({ ...bulkMeta, commit: e.target.value })
                        }
                        className="bg-zinc-900 border-zinc-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Channel</Label>
                      <Input
                        value={bulkMeta.channel}
                        onChange={(e) =>
                          setBulkMeta({ ...bulkMeta, channel: e.target.value })
                        }
                        className="bg-zinc-900 border-zinc-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-300">File</Label>
                      <Input
                        value={bulkMeta.file}
                        onChange={(e) =>
                          setBulkMeta({ ...bulkMeta, file: e.target.value })
                        }
                        className="bg-zinc-900 border-zinc-700 text-white"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    variant="default"
                    onClick={() => setBulkModalOpen(false)}
                    className="border-zinc-600 text-zinc-300 hover:text-white hover:bg-zinc-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleBulkScan}
                    disabled={bulkLoading || !bulkText.trim()}
                    className="bg-purple-700 hover:bg-purple-600 text-white"
                  >
                    {bulkLoading ? "Scanning..." : "Start Bulk Scan"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              onClick={load}
              variant="default"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 shadow-none"
            >
              Refresh
            </Button>
          </div>
        </div>

        {err && (
          <Card className="mb-4 border-red-800 bg-red-950/50">
            <CardHeader>
              <CardTitle className="text-red-400">Error</CardTitle>
            </CardHeader>
            <CardContent className="text-red-300">{err}</CardContent>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="bg-zinc-950 border border-zinc-800 p-1 rounded-md">
            <TabsTrigger
              value="active"
              className="px-4 data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-300"
            >
              Active ({active.length})
            </TabsTrigger>
            <TabsTrigger
              value="resolved"
              className="px-4 data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-300"
            >
              Resolved ({resolved.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="active">
            <Card className="border-zinc-800 bg-zinc-950">
              <CardHeader>
                <CardTitle className="text-white">Active Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                {issues === null ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full bg-zinc-800" />
                    <Skeleton className="h-8 w-full bg-zinc-800" />
                    <Skeleton className="h-8 w-full bg-zinc-800" />
                  </div>
                ) : (
                  <TicketsTable issues={active} onNotify={notify} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="resolved">
            <Card className="border-zinc-800 bg-zinc-950">
              <CardHeader>
                <CardTitle className="text-white">Resolved Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                {issues === null ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full bg-zinc-800" />
                    <Skeleton className="h-8 w-full bg-zinc-800" />
                  </div>
                ) : (
                  <TicketsTable issues={resolved} onNotify={notify} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        {/* Toasts */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-3 rounded-md text-sm shadow border ${
                t.kind === "success"
                  ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                  : "bg-red-950/80 border-red-800 text-red-300"
              }`}
            >
              {t.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
