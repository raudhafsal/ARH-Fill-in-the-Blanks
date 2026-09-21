"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share, SquarePlus, CheckCircle2, Smartphone, Monitor } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function DownloadPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true
    );

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleAndroidInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  }

  const alreadyInstalled = installed || isStandalone;

  return (
    <div className="mx-auto min-h-screen max-w-2xl space-y-8 p-6 sm:p-10">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark.png" alt="ARH Fill in the Blank" className="h-20 w-20 rounded-2xl object-contain" />
        <h1 className="text-2xl font-bold">Install ARH Fill in the Blank POS</h1>
        <p className="text-sm text-muted-foreground">
          Add the POS to your phone or computer's home screen for one-tap access, full-screen use, and offline support.
        </p>
      </div>

      {alreadyInstalled && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            <p className="text-sm font-medium">You're already using the installed app on this device.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-4 w-4" />
              Android
            </CardTitle>
            <CardDescription>One tap, using Chrome.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {deferredPrompt ? (
              <Button className="w-full gap-1.5" onClick={handleAndroidInstall}>
                <Download className="h-4 w-4" />
                Install app
              </Button>
            ) : (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Open this page in Chrome, then:</p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Tap the menu (⋮) in the top-right corner</li>
                  <li>Tap "Install app" or "Add to Home screen"</li>
                  <li>Confirm by tapping "Install"</li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Monitor className="h-4 w-4" />
              iPhone / iPad
            </CardTitle>
            <CardDescription>Using Safari (required — Chrome on iOS can't install apps).</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Share className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Tap the Share icon in Safari's toolbar</span>
              </li>
              <li className="flex items-start gap-2">
                <SquarePlus className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Scroll down and tap "Add to Home Screen"</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Tap "Add" in the top-right corner</span>
              </li>
            </ol>
            {!isIOS && <p className="mt-3 text-xs text-muted-foreground">Open this page on your iPhone or iPad to install.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desktop (Windows / Mac)</CardTitle>
          <CardDescription>Using Chrome or Edge.</CardDescription>
        </CardHeader>
        <CardContent>
          {deferredPrompt ? (
            <Button className="w-full gap-1.5 sm:w-auto" onClick={handleAndroidInstall}>
              <Download className="h-4 w-4" />
              Install app
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Look for an install icon (⊕) in the address bar, or open the browser menu and choose "Install ARH Fill in the Blank POS".
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
