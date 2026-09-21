"use client";

import { useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info, Plus, Loader2, Copy, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const staffSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(150),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["administrator", "manager", "cashier"]),
  phone: z.string().trim().optional(),
  max_discount_percent: z.coerce.number().min(0).max(100),
});

type StaffForm = {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
  max_discount_percent: string;
};

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const emptyForm: StaffForm = {
  full_name: "",
  email: "",
  password: generatePassword(),
  role: "cashier",
  phone: "",
  max_discount_percent: "0",
};

export function StaffTab({ isAdmin, initial }: { isAdmin: boolean; initial: Profile[] }) {
  const [profiles, setProfiles] = useState(initial);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

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

  function openCreate() {
    setForm(emptyForm);
    setErrors({});
    setCreated(null);
    setCopied(false);
    setDialogOpen(true);
  }

  async function handleCreate() {
    const result = staffSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setCreating(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: result.data.full_name,
          email: result.data.email,
          password: result.data.password,
          role: result.data.role,
          phone: result.data.phone || undefined,
          max_discount_percent: result.data.max_discount_percent,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Unable to create staff account.");
        return;
      }
      setProfiles((prev) => [...prev, json.profile as Profile].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setCreated({ email: result.data.email, password: result.data.password });
      toast.success("Staff account created.");
    } catch {
      toast.error("Unable to create staff account. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function copyPassword() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Unable to copy — select and copy the password manually.");
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Staff accounts</p>
            <p className="text-muted-foreground">
              Administrators can add new staff logins directly below. The temporary password is shown once after
              creation — share it with the staff member and have them change it after signing in.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Staff</CardTitle>
          {isAdmin && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add staff
            </Button>
          )}
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

      <Dialog open={dialogOpen} onOpenChange={(open) => !creating && setDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{created ? "Staff account created" : "Add staff"}</DialogTitle>
          </DialogHeader>

          {created ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Share these sign-in details with {created.email}. The password is only shown this once.
              </p>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={created.email} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Temporary password</Label>
                <div className="flex gap-2">
                  <Input value={created.password} readOnly className="font-mono" />
                  <Button type="button" variant="outline" size="icon" onClick={copyPassword} aria-label="Copy password">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="s-name">Full name</Label>
                <Input id="s-name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
                {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-email">Email</Label>
                <Input id="s-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-password">Temporary password</Label>
                <div className="flex gap-2">
                  <Input
                    id="s-password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}
                    aria-label="Generate new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as UserRole }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashier">Cashier</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="administrator">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-discount">Max discount %</Label>
                  <Input
                    id="s-discount"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.max_discount_percent}
                    onChange={(e) => setForm((f) => ({ ...f, max_discount_percent: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-phone">Phone (optional)</Label>
                <Input id="s-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
          )}

          <DialogFooter>
            {created ? (
              <Button onClick={() => setDialogOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create staff account
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
