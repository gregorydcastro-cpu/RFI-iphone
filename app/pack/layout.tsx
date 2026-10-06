import type { ReactNode } from "react";
import { privatePackMetadata } from "@/lib/siteMetadata";

export const metadata = privatePackMetadata();

/** Keeps a shared pack link off the public marketing card. */
export default function PackLayout({ children }: { children: ReactNode }) {
  return children;
}
