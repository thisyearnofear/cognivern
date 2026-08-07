import { ImageResponse } from "next/og";
import { OG_SIZE, OG_CONTENT_TYPE, OgCard } from "./og-card";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function TwitterImage() {
  return new ImageResponse(<OgCard />, { ...size });
}
