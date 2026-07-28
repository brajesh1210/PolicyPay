// @ts-nocheck
"use client";

import { useSession, signOut } from "next-auth/react";
import { AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

import { useKillSwitch, killSwitchApi } from "../../../hooks/use-kill-switch";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { active: killSwitchActive, isLoading } = useKillSwitch();

  const handleKillSwitchChange = async (checked: boolean) => {
    if (checked) {
      if (!confirm("Are you sure you want to turn ON the Global Kill Switch? Every payment from every agent will be denied immediately.")) {
        return;
      }
    }
    try {
      await killSwitchApi.set(checked);
    } catch (error) {
      // Errors are handled by the API client, but we catch here to prevent crashes
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your profile and system emergency controls.</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full max-w-3xl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="emergency" className="data-[state=active]:text-red-600">
            Emergency
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Profile */}
        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your signed-in account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500">Name</p>
                <p className="font-medium">{session?.user?.name || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500">Email</p>
                <p className="font-medium">{session?.user?.email || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500">Role</p>
                <p className="font-medium">{session?.user?.role || "N/A"}</p>
              </div>
              <div className="pt-4 border-t">
                <Button variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>
                  Sign out
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Emergency */}
        <TabsContent value="emergency" className="mt-6">
          <Card className={killSwitchActive ? "border-red-500 shadow-sm shadow-red-100" : ""}>
            <CardHeader>
              <CardTitle className={killSwitchActive ? "text-red-600" : ""}>
                Global Kill Switch
              </CardTitle>
              <CardDescription>
                When this is ON, PolicyPay denies every payment from every agent, immediately. Use it if something goes wrong. Turning it off restores normal behaviour.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {killSwitchActive && (
                <div className="bg-red-600 text-white p-4 rounded-md flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 shrink-0" />
                  <p className="font-bold">
                    GLOBAL KILL SWITCH IS ACTIVE - all payments are being denied
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <p className="font-medium">Master Payment Control</p>
                  <p className="text-sm text-slate-500">
                    Toggle to {killSwitchActive ? "restore" : "halt"} all system payments.
                  </p>
                </div>
                <Switch
                  checked={!!killSwitchActive}
                  disabled={isLoading}
                  onCheckedChange={handleKillSwitchChange}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}