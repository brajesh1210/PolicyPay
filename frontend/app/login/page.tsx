"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Icon from "@/components/Icon";
import { Switch } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("admin@policypay.demo");
  const [password, setPassword] = useState("Demo1234!");
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.ok) {
      router.push(callbackUrl);
      router.refresh();
    } else {
      setError("That email and password did not match. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="lg-wrap">
      <section className="lg-left">
        <div className="lg-box">
          <div className="lg-brand">
            <Image src="/logo.png" alt="PolicyPay" width={32} height={39} priority />
            <b>
              Policy<i>Pay</i>
            </b>
          </div>

          <h1>
            Welcome back.
            <br />
            <span className="serif">Your agents are waiting.</span>
          </h1>
          <p className="lede">
            Sign in to review pending approvals, tune policies and watch every decision
            as it happens.
          </p>

          {error ? (
            <div className="err-msg" role="alert">
              <Icon name="warn" style={{ width: 16, height: 16 }} />
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit}>
            <div className="fld">
              <label htmlFor="em">Email address</label>
              <input
                className="in"
                id="em"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
              />
            </div>

            <div className="fld">
              <label htmlFor="pw">Password</label>
              <input
                className="in"
                id="pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 22px" }}>
              <Switch checked={keep} onChange={setKeep} label="Keep me signed in" />
              <span className="fs-body-sm fw-semi" style={{ color: "var(--ink-2)" }}>
                Keep me signed in
              </span>
            </div>

            <button
              className="btn btn-p"
              type="submit"
              style={{ width: "100%", minHeight: 46 }}
              disabled={busy}
            >
              {busy ? <span className="spin" /> : null}
              {busy ? "Signing in…" : "Sign in to dashboard"}
              {!busy ? <Icon name="chev" /> : null}
            </button>
          </form>

          <div className="lg-hint">
            <b>Demo credentials</b>
            <code>
              admin@policypay.demo
              <br />
              Demo1234!
            </code>
          </div>
        </div>
      </section>

      <section className="lg-right">
        <div className="lg-panel">
          <span
            className="eyebrow"
            style={{
              background: "rgba(255,255,255,.1)",
              borderColor: "rgba(255,255,255,.2)",
              color: "#93BEF8",
            }}
          >
            <i className="live" />
            Live on the x402 protocol
          </span>

          <h2 style={{ marginTop: 20 }}>
            Eighteen checks.
            <br />
            <span className="serif">One verdict.</span>
          </h2>
          <p>
            Every payment an agent tries to make passes through PolicyPay first. The
            wallet key never leaves the backend.
          </p>

          <div className="lg-mini">
            <div className="row">
              <span className="tag t-no">DENY</span>
              <span className="d">unknown-service.xyz</span>
              <span className="a">$5.00</span>
            </div>
            <div className="row">
              <span className="tag t-hold">HOLD</span>
              <span className="d">trusted-api.com</span>
              <span className="a">$45.00</span>
            </div>
            <div className="row">
              <span className="tag t-ok">ALLOW</span>
              <span className="d">trusted-api.com</span>
              <span className="a">$2.50</span>
            </div>
            <div className="row">
              <span className="tag t-ok">ALLOW</span>
              <span className="d">data-provider.xyz</span>
              <span className="a">$4.00</span>
            </div>
          </div>

          <p
            className="fs-mono-xs"
            style={{
              marginTop: 22,
              color: "rgba(255,255,255,.4)",
            }}
          >
            POST /v1/authorize-payment · 18 checks · &lt;150 ms
          </p>
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
