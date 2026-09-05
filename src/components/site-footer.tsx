import { Link } from "@tanstack/react-router";

export function SiteFooter({ wide }: { wide?: boolean }) {
  return (
    <footer className="border-t border-border px-4 py-6 text-xs text-faint">
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${wide ? "mx-auto max-w-5xl" : ""}`}
      >
        <span>Turf Community · Gujarat</span>
        <Link to="/privacy" className="hover:text-fg">
          Privacy
        </Link>
        <Link to="/terms" className="hover:text-fg">
          Terms
        </Link>
        <Link to="/learn" className="hover:text-fg">
          Owner academy
        </Link>
      </div>
    </footer>
  );
}
