// @ts-nocheck
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Copy, Key, Power, Trash2, Edit2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

import { useAgents, agentsApi } from "../../../hooks/use-agents";
import { usePolicies } from "../../../hooks/use-policies";
import { formatCurrency, formatRelative, copyToClipboard } from "../../../lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

// Zod schemas for forms
const agentSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().optional(),
  policyId: z.string().min(1, "Policy is required"),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const { agents, isLoading, error } = useAgents({ 
    search: search || undefined, 
    status: statusFilter === "ALL" ? undefined : statusFilter 
  });
  
  // Modals state
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [isKeysDialogOpen, setIsKeysDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-500">
        <AlertCircle className="mb-2 h-8 w-8 text-red-500" />
        <p>Failed to load agents. Please try again.</p>
      </div>
    );
  }

  const openKeysDialog = async (agent: any) => {
    setSelectedAgent(agent);
    setNewKey(null);
    setIsKeysDialogOpen(true);
    try {
      const keys = await agentsApi.listKeys(agent.id);
      setApiKeys(keys?.data || keys || []); // Adjust based on your wrapper
    } catch (err) {
      toast.error("Failed to load API keys");
    }
  };

  const generateKey = async () => {
    if (!selectedAgent) return;
    try {
      const res = await agentsApi.createKey(selectedAgent.id, { name: "New API Key" });
      setNewKey(res.data?.key || res?.key); // Depends on backend exact return shape
      const keys = await agentsApi.listKeys(selectedAgent.id);
      setApiKeys(keys?.data || keys || []);
    } catch (err) {}
  };

  const handleKillSwitch = async (agent: any, active: boolean) => {
    if (active) {
      if (!confirm("This agent will be blocked from making any payment until you turn this off. Proceed?")) return;
    }
    await agentsApi.toggleKillSwitch(agent.id, active);
  };

  const handleDelete = async (agent: any) => {
    if (confirm(`Are you sure you want to delete ${agent.name}?`)) {
      await agentsApi.remove(agent.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar Area (Assuming Layout handles the actual TopBar, we just add page content here) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">Manage your AI agents and their payment policies.</p>
        </div>
        <Button onClick={() => setIsAgentDialogOpen(true)}>Add Agent</Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Input 
          placeholder="Search agents..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : agents?.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-500 border border-dashed rounded-xl">
          <p className="mb-4">No agents found.</p>
          <Button variant="outline" onClick={() => setIsAgentDialogOpen(true)}>Add your first agent</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents?.map((agent: any) => (
            <Card key={agent.id} className="flex flex-col justify-between">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold">{agent.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <span className="truncate max-w-[120px]">{agent.id}</span>
                      <button onClick={() => copyToClipboard(agent.id)} className="hover:text-slate-900">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={agent.status === "ACTIVE" ? "default" : "secondary"}>
                      {agent.status}
                    </Badge>
                    {agent.killSwitchActive && (
                      <Badge variant="destructive" className="bg-red-600">KILL SWITCH ON</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Policy</span>
                  <Badge variant="outline">{agent.policy?.name || "None"}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total Spent</span>
                  <span className="font-medium">{formatCurrency(agent.totalSpent || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Transactions</span>
                  <span className="font-medium">{agent.totalTx || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Last Active</span>
                  <span className="font-medium">
                    {agent.lastActiveAt ? formatRelative(new Date(agent.lastActiveAt)) : "Never"}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-4">
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openKeysDialog(agent)}>
                    <Key className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(agent)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Kill Switch</span>
                  <Switch 
                    checked={agent.killSwitchActive} 
                    onCheckedChange={(val) => handleKillSwitch(agent, val)}
                  />
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* API Keys Dialog */}
      <Dialog open={isKeysDialogOpen} onOpenChange={setIsKeysDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>API Keys for {selectedAgent?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {newKey && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-amber-800 font-bold mb-2">Copy this now. You will never be able to see it again.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white p-2 rounded border">{newKey}</code>
                  <Button variant="outline" onClick={() => copyToClipboard(newKey)}>Copy</Button>
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">Active Keys</h3>
              <Button size="sm" onClick={generateKey}>Generate new key</Button>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center">No active keys.</TableCell></TableRow>
                ) : (
                  apiKeys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell><code className="bg-slate-100 px-1 rounded">{k.keyPrefix}...</code></TableCell>
                      <TableCell>{k.createdAt ? new Date(k.createdAt).toLocaleDateString() : "N/A"}</TableCell>
                      <TableCell>{k.lastUsedAt ? formatRelative(new Date(k.lastUsedAt)) : "Never"}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={async () => {
                            await agentsApi.revokeKey(selectedAgent.id, k.id);
                            setApiKeys(apiKeys.filter(key => key.id !== k.id));
                          }}
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}