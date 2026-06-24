import { BrandLogo } from "@/components/Brand";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* ambient glow background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 10%, rgba(90,166,255,0.12), transparent 70%), radial-gradient(50% 50% at 85% 90%, rgba(139,123,255,0.12), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="mb-8 flex justify-center"
          aria-label="ERD Flow home"
        >
          <BrandLogo />
        </Link>
        {children}
      </div>
    </div>
  );
}
