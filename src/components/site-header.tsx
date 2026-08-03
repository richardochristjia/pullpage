import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/92 backdrop-blur-xl">
      <div className="mx-auto flex min-h-18 w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex min-h-11 items-center gap-3 rounded-xl font-heading focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
          <Image
            src="/pullpage_logo.png"
            width={58}
            height={58}
            priority
            alt=""
            className="size-13 object-contain"
          />
          <span className="leading-tight">
            <strong className="block text-lg font-semibold tracking-[-0.02em]">Pullpage</strong>
            <span className="hidden text-xs text-muted-foreground sm:block">Pull the art. Own the page.</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <p className="hidden text-sm text-muted-foreground md:block">Extended art for collectors · Indonesia</p>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
