"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Icon from "./Icon";
import { useCounts } from "@/lib/hooks";

type NavItem = { href: string; label: string; icon: string; badge?: "approvals" | "alerts" };
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "grid" },
      { href: "/transactions", label: "Transactions", icon: "swap" },
      { href: "/approvals", label: "Approvals", icon: "check", badge: "approvals" },
    ],
  },
  {
    group: "Control",
    items: [
      { href: "/agents", label: "Agents", icon: "bot" },
      { href: "/connect", label: "Connect", icon: "key" },
      { href: "/policies", label: "Policies", icon: "shield" },
      { href: "/merchants", label: "Merchants", icon: "store" },
    ],
  },
  {
    group: "Insight",
    items: [
      { href: "/alerts", label: "Alerts", icon: "bell", badge: "alerts" },
      { href: "/audit-logs", label: "Audit Logs", icon: "file" },
      { href: "/simulation", label: "Simulation", icon: "flask" },
    ],
  },
  {
    group: "Account",
    items: [{ href: "/settings", label: "Settings", icon: "cog" }],
  },
];

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || "PP").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function AppShell({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const counts = useCounts();

  function leave() {
    signOut({ callbackUrl: "/landing" });
  }

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
    setMenu(false);
  }, [pathname, close]);

  useEffect(() => {
    if (!menu) return;
    function onDown(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest(".kebab-wrap")) setMenu(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const lock = open && window.innerWidth <= 1024;
    document.body.style.overflow = lock ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const until = session?.stayUntil;
    if (!until) return;
    const ms = Number(until) - Date.now();
    if (ms <= 0) {
      signOut({ callbackUrl: "/login" });
      return;
    }
    const t = window.setTimeout(() => {
      fetch("/api/auth/remember", { method: "DELETE" }).catch(() => null);
      signOut({ callbackUrl: "/login" });
    }, ms);
    return () => window.clearTimeout(t);
  }, [session?.stayUntil]);

  const badgeFor = (b?: "approvals" | "alerts") => {
    if (!b) return null;
    const n = b === "approvals" ? counts.approvals : counts.alerts;
    if (!n) return null;
    return <span className="pill">{n}</span>;
  };

  return (
    <>
      <aside className={`sb${open ? " open" : ""}`} id="sb">
        <Link className="sb-top" href="/dashboard">
          <Image src="/logo.png" alt="PolicyPay" width={28} height={35} priority />
          <b className="brand-word">
            Policy<i>Pay</i>
          </b>
        </Link>

        <nav className="sb-nav" aria-label="Main">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="sb-lab">{g.group}</div>
              {g.items.map((it) => {
                const on = pathname === it.href;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={on ? "on" : ""}
                    aria-current={on ? "page" : undefined}
                  >
                    <Icon name={it.icon} />
                    <span>{it.label}</span>
                    {badgeFor(it.badge)}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sb-foot">
          <Link className="who" href="/settings">
            <span className="av">
              {initials(session?.user?.name, session?.user?.email)}
            </span>
            <span className="who-t">
              <b>{session?.user?.name || "Signed in"}</b>
              <span>{session?.user?.email || "—"}</span>
            </span>
          </Link>
        </div>
      </aside>

      <div
        className={`scrim${open ? " on" : ""}`}
        onClick={close}
        aria-hidden="true"
      />

      <div className="main">
        <header className="tb">
          <button
            className="burger"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="sb"
            onClick={() => setOpen((v) => !v)}
          >
            <i />
            <i />
          </button>

          <div className="tb-h">
            <h1>{title}</h1>
            {sub ? <p>{sub}</p> : null}
          </div>

          <div className="tb-r">
            <Link className="icb wide-only" href="/alerts" aria-label="Alerts">
              <Icon name="bell" />
              {counts.alerts > 0 ? <span className="dot" /> : null}
            </Link>
            <Link className="icb wide-only" href="/settings" aria-label="Settings">
              <Icon name="cog" />
            </Link>
            <button className="icb wide-only" aria-label="Sign out" onClick={leave}>
              <Icon name="logout" />
            </button>

            <div className="kebab-wrap narrow-only">
              <button
                className="icb"
                aria-label="More"
                aria-haspopup="true"
                aria-expanded={menu}
                onClick={() => setMenu((v) => !v)}
              >
                <Icon name="dots" />
                {counts.alerts > 0 && !menu ? <span className="dot" /> : null}
              </button>

              {menu ? (
                <div className="kebab" role="menu">
                  <Link href="/alerts" role="menuitem" onClick={() => setMenu(false)}>
                    <Icon name="bell" />
                    <span>Alerts</span>
                    {counts.alerts > 0 ? (
                      <span className="pill">{counts.alerts}</span>
                    ) : null}
                  </Link>
                  <Link href="/settings" role="menuitem" onClick={() => setMenu(false)}>
                    <Icon name="cog" />
                    <span>Settings</span>
                  </Link>
                  <button
                    role="menuitem"
                    className="out"
                    onClick={() => {
                      setMenu(false);
                      leave();
                    }}
                  >
                    <Icon name="logout" />
                    <span>Sign out</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="body">{children}</main>
      </div>
    </>
  );
}