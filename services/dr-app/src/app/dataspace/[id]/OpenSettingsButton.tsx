"use client";

import { useEffect } from "react";

type Props = {
  className?: string;
};

export function OpenSettingsButton({ className }: Props) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#settings") {
      const el = document.getElementById("settings");
      if (el && !el.hasAttribute("open")) {
        el.setAttribute("open", "true");
      }
    }
  }, []);

  function openSettings() {
    const el = document.getElementById("settings");
    if (el && !el.hasAttribute("open")) {
      el.setAttribute("open", "true");
    }
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <button type="button" onClick={openSettings} className={className}>
      Edit dataspace
    </button>
  );
}
