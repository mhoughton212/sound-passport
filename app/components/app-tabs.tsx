"use client";

import Link from "next/link";

export default function AppTabs({ current }: { current: "passport" | "missing-genres" }) {
  const catalogAdminAvailable = process.env.NODE_ENV !== "production";
  return <nav className="app-tabs" aria-label="Sound Passport sections"><Link className={current === "passport" ? "active" : ""} href="/?view=passport">Passport</Link>{catalogAdminAvailable && <Link className={current === "missing-genres" ? "active" : ""} href="/?view=missing-genres">Missing genres</Link>}</nav>;
}
