import { useEffect, useRef, useState } from "react";
import { LOGO_URL, SOURCE_NOTE } from "./config";
import { t, uiDir } from "./i18n";
import { loadMaalam } from "./loader";

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function Backdrop() {
  return (
    <>
      <div className="host__aurora" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="host__grid" aria-hidden="true" />
    </>
  );
}

export default function App() {
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "closing" | "done">("loading");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // The static splash baked into index.html is on screen from the first
    // paint. Our live splash is identical, so swap the static one out only
    // after this component has painted — no flash, no blank frame.
    const boot = document.getElementById("boot");
    if (boot) {
      requestAnimationFrame(() => boot.remove());
    }

    loadMaalam(() => undefined)
      .then(() => {
        // Fade the splash out so the app is revealed underneath it.
        setPhase("closing");
        window.setTimeout(() => setPhase("done"), 400);
      })
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  if (phase === "done") return null;

  const dir = uiDir();

  if (error) {
    return (
      <div className="host" dir={dir}>
        <Backdrop />
        <div className="host__stage host__stage--error">
          <div className="host__card">
            <div className="host__badge">
              <AlertIcon />
            </div>
            <h1 className="host__title">{t("errTitle")}</h1>
            <p className="host__text">{t("errText")}</p>
            <pre className="host__error" dir="ltr">{error}</pre>
            <div className="host__actions">
              <button type="button" className="host__btn host__btn--primary" onClick={() => window.location.reload()}>
                {t("errRetry")}
              </button>
            </div>
            <p className="host__note" dir="ltr">{SOURCE_NOTE}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`host host--splash${phase === "closing" ? " is-closing" : ""}`} dir={dir} role="status" aria-live="polite">
      <Backdrop />
      <div className="host__splash">
        <div className="host__mascot">
          <div className="host__mascot-frame">
            <img className="host__mascot-img" src={LOGO_URL} alt="Maalam" fetchPriority="high" />
          </div>
        </div>
        <div className="host__splash-foot">
          <h1 className="host__splash-name" dir="ltr">
            <span className="host__splash-latin">maalam</span>{" "}
            <span className="host__splash-ar" lang="ar">معلم</span>
          </h1>
          <span className="host__beta">{t("betaChip")}</span>
        </div>
      </div>
    </div>
  );
}
