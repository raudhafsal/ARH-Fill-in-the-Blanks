"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BusinessSettings, DiscountLimit, PaymentMethod, Profile, TaxSettings } from "@/types/database";
import { BusinessSettingsTab } from "./business-settings-tab";
import { TaxSettingsTab } from "./tax-settings-tab";
import { PaymentMethodsTab } from "./payment-methods-tab";
import { DiscountLimitsTab } from "./discount-limits-tab";
import { StaffTab } from "./staff-tab";
import { MiscSettingsTab } from "./misc-settings-tab";

export function SettingsClient({
  isAdmin,
  businessSettings,
  taxSettings,
  paymentMethods,
  discountLimits,
  profiles,
}: {
  isAdmin: boolean;
  businessSettings: BusinessSettings;
  taxSettings: TaxSettings;
  paymentMethods: PaymentMethod[];
  discountLimits: DiscountLimit[];
  profiles: Profile[];
}) {
  return (
    <div>
      <PageHeader
        title="Settings"
        description={isAdmin ? "Configure business, tax, payments and staff." : "View-only — only administrators can make changes here."}
      />

      <div className="p-4 sm:p-6">
        <Tabs defaultValue="business">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="tax">Tax</TabsTrigger>
            <TabsTrigger value="payments">Payment Methods</TabsTrigger>
            <TabsTrigger value="discounts">Discount Limits</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="misc">Printer &amp; Receipt</TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <BusinessSettingsTab isAdmin={isAdmin} initial={businessSettings} />
          </TabsContent>
          <TabsContent value="tax">
            <TaxSettingsTab isAdmin={isAdmin} initial={taxSettings} />
          </TabsContent>
          <TabsContent value="payments">
            <PaymentMethodsTab isAdmin={isAdmin} initial={paymentMethods} />
          </TabsContent>
          <TabsContent value="discounts">
            <DiscountLimitsTab isAdmin={isAdmin} initial={discountLimits} />
          </TabsContent>
          <TabsContent value="staff">
            <StaffTab isAdmin={isAdmin} initial={profiles} />
          </TabsContent>
          <TabsContent value="misc">
            <MiscSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
