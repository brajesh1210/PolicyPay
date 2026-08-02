"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Icon from "@/components/Icon";
import { Switch } from "@/components/ui";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.86-.08-1.68-.22-2.48H12v4.7h6.45a5.5 5.5 0 0 1-2.39 3.62v3h3.86c2.26-2.08 3.58-5.15 3.58-8.84z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l4 3.09C6.23 6.86 8.88 4.75 12 4.75z"
      />
    </svg>
  );
}

const OAUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already registered with a password. Sign in with your password instead.",
  OAuthSignin: "Could not reach Google. Check your connection and try again.",
  OAuthCallback: "Google sign-in was cancelled or failed. Try again.",
  Callback: "Google sign-in was cancelled or failed. Try again.",
  AccessDenied: "Google sign-in was denied.",
  Configuration:
    "Sign-in is not configured on this server. Check the environment variables.",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";
  const urlError = params.get("error");

  const [email, setEmail] = useState("admin@policypay.demo");
  const [password, setPassword] = useState("Demo1234!");
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? OAUTH_ERRORS[urlError] || "Sign-in failed. Try again." : null
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!res?.ok) {
      setError("That email and password did not match. Try again.");
      setBusy(false);
      return;
    }

    // router.push() can fire before the session cookie is readable, and the
    // dashboard then bounces straight back to /login — which is why the
    // first click used to do nothing. A full navigation guarantees the
    // cookie is sent with the request for the next page.
    window.location.assign(callbackUrl);
  }

  function onGoogle() {
    setGoogleBusy(true);
    setError(null);
    signIn("google", { callbackUrl });
  }

  const anyBusy = busy || googleBusy;

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
              <Icon name="warn" style={{ width: 16, height: 16, flex: "none" }} />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="button"
            className="btn btn-s oauth-btn"
            onClick={onGoogle}
            disabled={anyBusy}
          >
            {googleBusy ? <span className="spin" /> : <GoogleMark />}
            {googleBusy ? "Opening Google…" : "Continue with Google"}
          </button>

          <div className="or-line">
            <span>or use a password</span>
          </div>

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
                disabled={anyBusy}
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
                disabled={anyBusy}
              />
            </div>

            <div
              style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 22px" }}
            >
              <Switch checked={keep} onChange={setKeep} label="Keep me signed in" />
              <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 600 }}>
                Keep me signed in
              </span>
            </div>

            <button
              className="btn btn-p"
              type="submit"
              style={{ width: "100%", minHeight: 46 }}
              disabled={anyBusy}
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

          <p className="lg-note">
            <Icon name="warn" style={{ width: 14, height: 14, flex: "none" }} />
            <span>
              If the first attempt does not go through, reload the page and sign in
              again — the session sometimes needs a moment to start.
            </span>
          </p>
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
            style={{
              marginTop: 22,
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11.5,
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
