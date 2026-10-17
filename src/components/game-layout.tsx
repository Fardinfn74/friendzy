import { Link } from "@tanstack/react-router";
import { ArrowLeft, Coins, Home, ShoppingBag, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function GameLayout({
  children,
  title,
  back = false,
  coins,
  tab,
}: {
  children: ReactNode;
  title?: string | undefined;
  back?: boolean | undefined;
  coins?: number | undefined;
  tab?: "home" | "shop" | "profile" | undefined;
}) {
  return (
    <main className="game-table min-h-dvh text-foreground">
      <div className={`app-board ${tab ? "with-nav" : ""}`}>
        <header className="app-header grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {back ? (
              <Button asChild variant="ghost" size="icon" aria-label="Back to Home">
                <Link to="/">
                  <ArrowLeft className="size-5" />
                </Link>
              </Button>
            ) : (
              <Link
                to="/"
                className="mini-brand font-display flex items-center gap-1.5 text-2xl font-black"
              >
                <span className="text-xl">🎲</span>
                <span className="text-primary tracking-tight">[FRIENDZY]</span>
              </Link>
            )}
            {title && <h1 className="truncate font-display text-2xl">{title}</h1>}
          </div>
          <div className="flex items-center gap-2">
            {coins !== undefined && (
              <Button
                asChild
                variant="secondary"
                className="coin-pill min-h-[38px] px-3 font-display"
              >
                <Link to="/coins">
                  <Coins className="size-4 text-amber-500 fill-amber-500" />
                  <span>{coins.toLocaleString()}</span>
                </Link>
              </Button>
            )}
            <ThemeToggle />
          </div>
        </header>
        <div className="page-content">{children}</div>
        {tab && (
          <nav className="bottom-nav" aria-label="Main navigation">
            {(
              [
                { to: "/", id: "home", label: "Home", Icon: Home },
                { to: "/shop", id: "shop", label: "Shop", Icon: ShoppingBag },
                { to: "/account", id: "profile", label: "Profile", Icon: UserRound },
              ] as const
            ).map(({ to, id, label, Icon }) => (
              <Button key={id} asChild variant="ghost" className={tab === id ? "nav-active" : ""}>
                <Link to={to} aria-current={tab === id ? "page" : undefined}>
                  <Icon className="size-5" />
                  <span>{label}</span>
                </Link>
              </Button>
            ))}
          </nav>
        )}
      </div>
    </main>
  );
}

export function PageTitle({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-4xl leading-tight">{children}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
