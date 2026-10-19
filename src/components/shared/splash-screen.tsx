"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Logo } from "@/components/layout/logo";
import { HeroBackground } from "@/components/shared/hero-background";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  SplashScreen — Animated entry for the app
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Full-screen overlay con el mismo fondo del hero de la landing. Los puntos
 *  de avance reflejan etapas reales del arranque, no un timer fijo:
 *    1. React hidrató la app (primer effect tras el hidratado).
 *    2. Recursos del documento cargados (document.readyState "complete").
 *    3. Tiempo mínimo en pantalla cumplido → salida.
 *
 *  Salida: el logo vuela a la esquina superior izquierda (donde queda el
 *  logo del header de la app) mientras el resto se desvanece — el splash
 *  "entrega" la marca a la interfaz en lugar de desaparecer.
 *
 *  - Techo duro (MAX_WAIT) por si `load` tarda: nadie queda atrapado.
 *  - Respects prefers-reduced-motion (sin pulsos ni vuelo, tiempos cortos).
 *  - Flag en sessionStorage: solo se muestra una vez por sesión.
 */

const MIN_VISIBLE = 900; // ms mínimos en pantalla (reduced: 400)
const MAX_WAIT = 4000; // techo aunque `load` no llegue (reduced: 1500)
const REDUCED_MIN_VISIBLE = 400;
const REDUCED_MAX_WAIT = 1500;
const SESSION_KEY = "comu-app-splash-seen";

/** Esquina donde vive el logo del header (≈ padding 24 + tile 32 → centro 40). */
const HEADER_X = 40;
const HEADER_Y = 40;
const EXIT_SCALE = 0.5;

export function SplashScreen({ logoUrl, name }: { logoUrl?: string | null; name?: string | null }) {
  const [visible, setVisible] = useState(true);
  // Etapas reales del arranque (en orden; cada punto se enciende al cumplirse).
  const [hydrated, setHydrated] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [minDone, setMinDone] = useState(false);
  const [maxHit, setMaxHit] = useState(false);
  // Destino del logo al salir (centro del viewport → esquina del header).
  const [exitTo, setExitTo] = useState({ x: 0, y: 0, scale: 1 });
  const prefersReduced = useReducedMotion();

  // Declarado primero: si ya se vio en la sesión, los efectos siguientes no
  // programan nada (skipRef se consulta sincrónicamente dentro de cada uno).
  const skipRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!window.sessionStorage.getItem(SESSION_KEY)) return;
      skipRef.current = true;
      setVisible(false);
    } catch {
      // Safari privado, WebViews y políticas empresariales pueden bloquear
      // Storage. El splash debe continuar con sus temporizadores normales.
    }
  }, []);

  // Etapa 1: este effect corre después del hidratado de React.
  useEffect(() => {
    if (skipRef.current) return;
    setHydrated(true);
  }, []);

  // Etapa 2: recursos del documento listos.
  useEffect(() => {
    if (skipRef.current) return;
    const check = () => {
      if (document.readyState === "complete") setLoaded(true);
    };
    check();
    document.addEventListener("readystatechange", check);
    window.addEventListener("load", check);
    return () => {
      document.removeEventListener("readystatechange", check);
      window.removeEventListener("load", check);
    };
  }, []);

  // Etapa 3 + techo: tiempo mínimo en pantalla; cierre forzado si `load` tarda.
  useEffect(() => {
    if (skipRef.current) return;
    const minVisible = prefersReduced ? REDUCED_MIN_VISIBLE : MIN_VISIBLE;
    const maxWait = prefersReduced ? REDUCED_MAX_WAIT : MAX_WAIT;
    const minTimer = setTimeout(() => setMinDone(true), minVisible);
    const maxTimer = setTimeout(() => setMaxHit(true), maxWait);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, [prefersReduced]);

  // Listo = (hidratado ∧ recursos ∧ mínimo) o techo. Al iniciar la salida se
  // calcula el destino del logo (esquina del header) y se retira el splash.
  const ready = (hydrated && loaded && minDone) || maxHit;
  useEffect(() => {
    if (!ready || skipRef.current) return;
    if (typeof window !== "undefined" && !prefersReduced) {
      setExitTo({
        x: -(window.innerWidth / 2 - HEADER_X),
        y: -(window.innerHeight / 2 - HEADER_Y),
        scale: EXIT_SCALE,
      });
    }
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Recordar el splash es opcional; cerrarlo no lo es.
    }
    const timer = setTimeout(() => setVisible(false), prefersReduced ? 0 : 200);
    return () => clearTimeout(timer);
  }, [ready, prefersReduced]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          data-testid="app-splash"
          initial={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] overflow-hidden dark bg-slate-950 text-slate-50"
        >
          {/* Fondo: se desvanece mientras el logo vuela al header */}
          <motion.div
            className="absolute inset-0"
            exit={{ opacity: 0, transition: { duration: prefersReduced ? 0.15 : 0.45 } }}
          >
            <HeroBackground />
          </motion.div>

          <div className="relative flex h-full flex-col items-center justify-center gap-6 px-6">
            {/* Logo: vuela a la esquina del header al salir */}
            <motion.div
              initial={
                prefersReduced
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.6 }
              }
              animate={{ opacity: 1, scale: 1 }}
              exit={
                prefersReduced
                  ? { opacity: 0, transition: { duration: 0.15 } }
                  : {
                      x: exitTo.x,
                      y: exitTo.y,
                      scale: exitTo.scale,
                      opacity: [1, 1, 0],
                      transition: { duration: 0.55, times: [0, 0.75, 1], ease: "easeInOut" },
                    }
              }
              transition={
                prefersReduced
                  ? { duration: 0.15 }
                  : {
                      type: "spring",
                      stiffness: 200,
                      damping: 18,
                      delay: 0.1,
                    }
              }
              className="drop-shadow-[0_0_2.5rem_color-mix(in_oklab,var(--primary)_55%,transparent)]"
            >
              <Logo logoUrl={logoUrl} className="h-20 w-auto" size={48} />
            </motion.div>

            {/* Brand name — mismo tratamiento de gradiente que el hero */}
            <motion.div
              initial={
                prefersReduced
                  ? { opacity: 1 }
                  : { opacity: 0, y: 12 }
              }
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.3 } }}
              transition={{
                duration: prefersReduced ? 0.15 : 0.5,
                delay: prefersReduced ? 0.1 : 0.35,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="text-center"
            >
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-white text-balance">
                {name ?? "COMU-APP"}
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-sm text-slate-300/80 text-balance">
                Familia es lo que somos, comunidad es lo que hacemos
              </p>
            </motion.div>

            {/* Progreso real: hidratado → recursos → listo */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              transition={{ delay: prefersReduced ? 0.1 : 0.4 }}
              className="h-1 w-40 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label="Cargando"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ready ? 100 : loaded ? 66 : hydrated ? 33 : 10}
            >
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: ready ? "100%" : loaded ? "66%" : hydrated ? "33%" : "10%" }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
