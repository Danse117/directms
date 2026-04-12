import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-secondary/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold">
            D
          </span>
          <span className="text-sm font-medium text-foreground">
            DirectMS
          </span>
        </div>
        <Separator className="sm:hidden" />
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} DirectMS. Wholesale orders only.
        </p>
      </div>
    </footer>
  );
}
