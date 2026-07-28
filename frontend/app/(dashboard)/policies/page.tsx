// @ts-nocheck
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Trash2, Edit2, Shield, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

import { usePolicies, useTemplates, policiesApi } from "../../../hooks/use-policies";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Zod schema for Policy
const policySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  perTxLimitUsd: z.coerce.number().positive(),
  dailyBudgetUsd: z.coerce.number().positive(),
  monthlyBudgetUsd: z.coerce.number().positive(),
  maxTxPerHour: z.coerce.number().int().min(1),
  maxTxPerDay: z.coerce.number().int().min(1),
  approvalThresholdScore: z.coerce.number().min(0).max(100),
  denyThresholdScore: z.coerce.number().min(0).max(100),
  allowedHoursStart: z.string().optional(),
  allowedHoursEnd: z.string().optional(),
  blockUnknownMerchants: z.boolean().default(true),
}).refine((data) => data.denyThresholdScore > data.approvalThresholdScore, {
  message: "Deny score must be higher than approval score",
  path: ["denyThresholdScore"],
}).refine((data) => {
  if (data.allowedHoursStart || data.allowedHoursEnd) {
    return !!(data.allowedHoursStart && data.allowedHoursEnd);
  }
  return true;
}, {
  message: "Both start and end hours must be provided if restricting time",
  path: ["allowedHoursEnd"],
});

export default function PoliciesPage() {
  const { policies, isLoading, error } = usePolicies();
  const { templates } = useTemplates();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");

  const form = useForm({
    resolver: zodResolver(policySchema),
    defaultValues: {
      name: "",
      perTxLimitUsd: 0,
      dailyBudgetUsd: 0,
      monthlyBudgetUsd: 0,
      maxTxPerHour: 0,
      maxTxPerDay: 0,
      approvalThresholdScore: 40,
      denyThresholdScore: 80,
      allowedHoursStart: "",
      allowedHoursEnd: "",
      blockUnknownMerchants: true,
    }
  });

  const onSubmit = async (data: any) => {
    try {
      await policiesApi.create(data);
      setIsDialogOpen(false);
      form.reset();
    } catch (err) {}
  };

  const handleApplyTemplate = async (templateNameKey: string) => {
    if (!templateName.trim()) {
      toast.error("Please provide a name for the policy");
      return;
    }
    try {
      await policiesApi.createFromTemplate({ template: templateNameKey, name: templateName });
      setTemplateDialogOpen(null);
      setTemplateName("");
    } catch (err) {}
  };

  const handleToggle = async (id: string) => {
    await policiesApi.toggle(id);
  };

  const handleDelete = async (policy: any) => {
    if (policy._count?.agents > 0) return;
    if (confirm(`Are you sure you want to delete ${policy.name}?`)) {
      await policiesApi.remove(policy.id);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-500">
        <AlertCircle className="mb-2 h-8 w-8 text-red-500" />
        <p>Failed to load policies. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policies</h1>
          <p className="text-muted-foreground">Manage agent rulebooks and spending limits.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create Policy</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Custom Policy</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Tabs defaultValue="basic">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="spending">Spending</TabsTrigger>
                  <TabsTrigger value="freq">Frequency</TabsTrigger>
                  <TabsTrigger value="risk">Risk & Time</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Policy Name</label>
                    <Input {...form.register("name")} placeholder="e.g. Marketing Strict" />
                    {form.formState.errors.name && <p className="text-red-500 text-xs">{form.formState.errors.name.message as string}</p>}
                  </div>
                </TabsContent>

                <TabsContent value="spending" className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Per Transaction Limit ($)</label>
                      <Input type="number" step="0.01" {...form.register("perTxLimitUsd")} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Daily Budget ($)</label>
                      <Input type="number" step="0.01" {...form.register("dailyBudgetUsd")} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Monthly Budget ($)</label>
                      <Input type="number" step="0.01" {...form.register("monthlyBudgetUsd")} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="freq" className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max Tx / Hour</label>
                      <Input type="number" {...form.register("maxTxPerHour")} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max Tx / Day</label>
                      <Input type="number" {...form.register("maxTxPerDay")} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="risk" className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Approval Score (0-100)</label>
                      <Input type="number" {...form.register("approvalThresholdScore")} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Deny Score (0-100)</label>
                      <Input type="number" {...form.register("denyThresholdScore")} />
                      {form.formState.errors.denyThresholdScore && <p className="text-red-500 text-xs">{form.formState.errors.denyThresholdScore.message as string}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Start Time (HH:MM)</label>
                      <Input placeholder="08:00" {...form.register("allowedHoursStart")} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">End Time (HH:MM)</label>
                      <Input placeholder="20:00" {...form.register("allowedHoursEnd")} />
                      {form.formState.errors.allowedHoursEnd && <p className="text-red-500 text-xs">{form.formState.errors.allowedHoursEnd.message as string}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-4 border-t">
                    <Switch checked={form.watch("blockUnknownMerchants")} onCheckedChange={(val) => form.setValue("blockUnknownMerchants", val)} />
                    <span className="text-sm font-medium">Block unknown merchants</span>
                  </div>
                </TabsContent>
              </Tabs>
              <div className="flex justify-end pt-4 border-t">
                <Button type="submit">Save Policy</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* SECTION 1: Templates */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {["CONSERVATIVE", "MODERATE", "AGGRESSIVE"].map((tplName) => {
            const tpl = templates?.[tplName] || templates?.[tplName];
            return (
              <Card key={tplName} className="bg-slate-50 border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    {tplName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex justify-between"><span>Per Tx:</span> <span>${tpl?.perTxLimitUsd || "-"}</span></div>
                  <div className="flex justify-between"><span>Daily:</span> <span>${tpl?.dailyBudgetUsd || "-"}</span></div>
                  <div className="flex justify-between"><span>Risk (Approve/Deny):</span> <span>{tpl?.approvalThresholdScore || "-"}/{tpl?.denyThresholdScore || "-"}</span></div>
                </CardContent>
                <CardFooter>
                  <Dialog open={templateDialogOpen === tplName} onOpenChange={(open) => setTemplateDialogOpen(open ? tplName : null)}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">Apply Template</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Apply {tplName} Template</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">New Policy Name</label>
                          <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Base Policy" />
                        </div>
                        <Button className="w-full" onClick={() => handleApplyTemplate(tplName)}>Confirm & Create</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: Existing Policies */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Existing Policies</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {policies?.map((policy: any) =>(
              <Card key={policy.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{policy.name}</CardTitle>
                      <Badge variant="secondary" className="mt-2">{policy.template}</Badge>
                    </div>
                    <Switch checked={policy.enabled} onCheckedChange={() => handleToggle(policy.id)} />
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 p-3 bg-slate-50 rounded-lg">
                    <div className="flex flex-col"><span className="text-slate-500 text-xs">Per transaction</span><span className="font-medium">${policy.perTxLimitUsd}</span></div>
                    <div className="flex flex-col"><span className="text-slate-500 text-xs">Daily budget</span><span className="font-medium">${policy.dailyBudgetUsd}</span></div>
                    <div className="flex flex-col"><span className="text-slate-500 text-xs">Max tx / hour</span><span className="font-medium">{policy.maxTxPerHour}</span></div>
                    <div className="flex flex-col"><span className="text-slate-500 text-xs">Approval score</span><span className="font-medium">{policy.approvalThresholdScore}</span></div>
                    <div className="flex flex-col"><span className="text-slate-500 text-xs">Deny score</span><span className="font-medium">{policy.denyThresholdScore}</span></div>
                    <div className="flex flex-col"><span className="text-slate-500 text-xs">Allowed hours</span><span className="font-medium">{policy.allowedHoursStart ? `${policy.allowedHoursStart}-${policy.allowedHoursEnd}` : "None"}</span></div>
                  </div>
                  <p className="text-slate-600 font-medium pb-2 text-xs">Used by {policy._count?.agents || 0} agents</p>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t pt-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            disabled={policy._count?.agents > 0}
                            onClick={() => handleDelete(policy)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {policy._count?.agents > 0 && (
                        <TooltipContent><p>Cannot delete policy in use by agents</p></TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}