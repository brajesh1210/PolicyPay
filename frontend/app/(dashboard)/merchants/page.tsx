// @ts-nocheck
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Trash2, AlertCircle, Info } from "lucide-react";
import toast from "react-hot-toast";

import { useMerchants, merchantsApi } from "../../../hooks/use-merchants";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

// Zod schema for Merchant
const merchantSchema = z.object({
  name: z.string().min(2, "Name is required"),
  domain: z.string().refine(
    (val) => !val.includes("http://") && !val.includes("https://") && !val.includes("/"),
    { message: "Enter only the domain, for example trusted-api.com" }
  ),
  category: z.enum(["api", "data", "cloud", "misc"]),
  reputation: z.enum(["TRUSTED", "UNKNOWN", "BLOCKED"]).default("UNKNOWN"),
});

export default function MerchantsPage() {
  const [search, setSearch] = useState("");
  const [reputationFilter, setReputationFilter] = useState("ALL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { merchants, isLoading, error } = useMerchants({
    search: search || undefined,
    reputation: reputationFilter === "ALL" ? undefined : reputationFilter,
  });

  const form = useForm({
    resolver: zodResolver(merchantSchema),
    defaultValues: {
      name: "",
      domain: "",
      category: "api",
      reputation: "UNKNOWN",
    },
  });

  const onSubmit = async (data: any) => {
    try {
      await merchantsApi.create(data);
      setIsDialogOpen(false);
      form.reset();
    } catch (err) {}
  };

  const handleReputationChange = async (merchant: any, newReputation: string) => {
    if (newReputation === "BLOCKED") {
      if (!confirm(`Are you sure? All payments to ${merchant.name} will be denied immediately.`)) {
        return;
      }
    }
    await merchantsApi.setReputation(merchant.id, newReputation);
  };

  const handleDelete = async (merchant: any) => {
    if (confirm(`Are you sure you want to delete ${merchant.name}?`)) {
      await merchantsApi.remove(merchant.id);
    }
  };

  // Calculate counts for pills
  const merchantArray = Array.isArray(merchants) ? merchants : (merchants?.data || []);
  const counts = {
    ALL: merchantArray.length,
    TRUSTED: merchantArray.filter((m: any) => m.reputation === "TRUSTED").length,
    UNKNOWN: merchantArray.filter((m: any) => m.reputation === "UNKNOWN").length,
    BLOCKED: merchantArray.filter((m: any) => m.reputation === "BLOCKED").length,
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-500">
        <AlertCircle className="mb-2 h-8 w-8 text-red-500" />
        <p>Failed to load merchants. Please try again.</p>
      </div>
    );
  }

  const getReputationColor = (rep: string) => {
    switch (rep) {
      case "TRUSTED": return "bg-green-100 text-green-800 hover:bg-green-200";
      case "BLOCKED": return "bg-red-100 text-red-800 hover:bg-red-200";
      default: return "bg-amber-100 text-amber-800 hover:bg-amber-200";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Merchants</h1>
          <p className="text-muted-foreground">Manage vendor reputation and access.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Merchant</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Merchant</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input {...form.register("name")} placeholder="e.g. OpenAI API" />
                {form.formState.errors.name && <p className="text-red-500 text-xs">{form.formState.errors.name.message as string}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Domain</label>
                <Input {...form.register("domain")} placeholder="e.g. api.openai.com" />
                {form.formState.errors.domain && <p className="text-red-500 text-xs">{form.formState.errors.domain.message as string}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select onValueChange={(val) => form.setValue("category", val)} defaultValue={form.getValues("category")}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="data">Data</SelectItem>
                    <SelectItem value="cloud">Cloud</SelectItem>
                    <SelectItem value="misc">Misc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reputation</label>
                <Select onValueChange={(val) => form.setValue("reputation", val)} defaultValue={form.getValues("reputation")}>
                  <SelectTrigger><SelectValue placeholder="Select reputation" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRUSTED">Trusted</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                    <SelectItem value="BLOCKED">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Save Merchant</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-blue-50/50 border-blue-100">
        <CardContent className="flex gap-4 p-4 items-start">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900">
            Trusted merchants are always allowed. Unknown merchants are blocked when the agent's policy has "Block unknown merchants" turned on, and add +25 to the risk score. Blocked merchants are always denied.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <Input 
          placeholder="Search by name or domain..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {["ALL", "TRUSTED", "UNKNOWN", "BLOCKED"].map((rep) => (
            <Button
              key={rep}
              variant={reputationFilter === rep ? "default" : "outline"}
              size="sm"
              onClick={() => setReputationFilter(rep)}
              className="rounded-full"
            >
              {rep === "ALL" ? "All" : rep.charAt(0) + rep.slice(1).toLowerCase()}
              <span className="ml-2 bg-slate-100 text-slate-900 rounded-full px-2 py-0.5 text-xs">
                {counts[rep as keyof typeof counts] || 0}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <div className="border rounded-md bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Reputation</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                </TableRow>
              ))
            ) : merchantArray.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-32 text-slate-500">No merchants found.</TableCell>
              </TableRow>
            ) : (
              merchantArray.map((merchant: any) => (
                <TableRow key={merchant.id}>
                  <TableCell className="font-medium">{merchant.name}</TableCell>
                  <TableCell className="text-slate-500">{merchant.domain}</TableCell>
                  <TableCell className="capitalize">{merchant.category}</TableCell>
                  <TableCell>
                    <Select 
                      defaultValue={merchant.reputation} 
                      onValueChange={(val) => handleReputationChange(merchant, val)}
                    >
                      <SelectTrigger className={`w-[130px] h-8 text-xs font-semibold ${getReputationColor(merchant.reputation)} border-0`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRUSTED">TRUSTED</SelectItem>
                        <SelectItem value="UNKNOWN">UNKNOWN</SelectItem>
                        <SelectItem value="BLOCKED">BLOCKED</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {merchant.createdAt ? new Date(merchant.createdAt).toLocaleDateString() : "N/A"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(merchant)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}