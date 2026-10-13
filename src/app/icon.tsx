import { ImageResponse } from "next/og";

// Ícono de la app (PWA / favicon).

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #c2410c, #0e7490)",
          borderRadius: 96,
          fontSize: 220,
          fontWeight: 800,
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        CA
      </div>
    ),
    { ...size }
  );
}
