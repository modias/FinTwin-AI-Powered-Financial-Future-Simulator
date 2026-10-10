"use client";

/**
 * "Skip to main content". Next keeps recently visited routes mounted but
 * hidden, so more than one `#main-content` can be in the document; this jumps
 * to the one that is actually showing.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      onClick={(event) => {
        const target = [...document.querySelectorAll<HTMLElement>('[id="main-content"]')].find(
          (element) => element.getClientRects().length > 0,
        );

        if (!target) return;

        event.preventDefault();
        if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
        target.focus();
        target.scrollIntoView({ block: "start" });
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
    >
      Skip to main content
    </a>
  );
}
