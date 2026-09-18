"use client";

import { useEffect, useState } from "react";
import MissingGenresDashboard from "./missing-genres-dashboard";
import Passport from "./passport";

export default function AppShell() {
  const [view, setView] = useState<"passport" | "missing-genres">("passport");
  useEffect(() => {
    const update = () => setView(process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("view") === "missing-genres" ? "missing-genres" : "passport");
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return view === "missing-genres" ? <MissingGenresDashboard /> : <Passport />;
}
