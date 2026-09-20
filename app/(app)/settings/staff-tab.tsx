"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { toast } from "sonner";

export function StaffTab({ isAdmin, initial }: { isAdmin: boolean; initial: Profile[] }) {
  const [profiles, setProfiles] = useState(initial);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function updateProfile(id: string, patch: Partial<Profile>) {
    setSavingId(id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      toast.success("Staff member updated.");
    } catch {
      toast.error("Unable to update staff member.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Creating new staff accounts</p>
            <p className="text-muted-foreground">
              New staff accounts are created by an administrator via the{" "}
              <strong>Supabase Dashboard → Authentication → Users → &quot;Add user&quot;</strong>, setting{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">raw_user_meta_data</code> to{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{'{"full_name": "...", "role": "cashier"}'}</code>. A
              database trigger automatically creates the matching profile with that role. Use this page afterwards to
              adjust their role, discount limit or active status.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Max discount %</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Select value={p.role} onValueChange={(v) => updateProfile(p.id, { role: v as UserRole })} disabled={savingId === p.id}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cashier">Cashier</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="administrator">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="capitalize">
                        {p.role}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-24"
                      defaultValue={p.max_discount_percent}
                      disabled={!isAdmin || savingId === p.id}
                      onBlur={(e) => updateProfile(p.id, { max_discount_percent: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.active}
                      disabled={!isAdmin || savingId === p.id}
                      onCheckedChange={(v) => updateProfile(p.id, { active: v })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
