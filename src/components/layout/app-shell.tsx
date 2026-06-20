"use client";

import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[16rem_1fr]">
      <Sidebar />
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
