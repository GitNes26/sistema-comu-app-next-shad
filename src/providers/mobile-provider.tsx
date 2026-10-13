"use client";

import * as React from "react";

export type DeviceType = "mobile" | "tablet" | "desktop";

interface MobileContextValue {
  device: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  hasTouch: boolean;
}

const MobileContext = React.createContext<MobileContextValue | null>(null);

export function useMobile(): MobileContextValue {
  const ctx = React.useContext(MobileContext);
  if (!ctx) {
    throw new Error("useMobile debe usarse dentro de <MobileProvider>");
  }
  return ctx;
}

export function MobileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [device, setDevice] = React.useState<DeviceType>("desktop");
  const [hasTouch, setHasTouch] = React.useState(false);

  React.useEffect(() => {
    const mobileQ = window.matchMedia("(max-width: 767px)");
    const tabletQ = window.matchMedia(
      "(min-width: 768px) and (max-width: 1023px)"
    );

    const update = () => {
      if (mobileQ.matches) setDevice("mobile");
      else if (tabletQ.matches) setDevice("tablet");
      else setDevice("desktop");
    };

    update();
    mobileQ.addEventListener("change", update);
    tabletQ.addEventListener("change", update);
    setHasTouch(window.matchMedia("(pointer: coarse)").matches);

    return () => {
      mobileQ.removeEventListener("change", update);
      tabletQ.removeEventListener("change", update);
    };
  }, []);

  const value = React.useMemo<MobileContextValue>(
    () => ({
      device,
      isMobile: device === "mobile",
      isTablet: device === "tablet",
      isDesktop: device === "desktop",
      hasTouch,
    }),
    [device, hasTouch]
  );

  return (
    <MobileContext.Provider value={value}>{children}</MobileContext.Provider>
  );
}