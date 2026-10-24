import { useEffect } from "react";

/** Shared reveal behavior. Each product page keeps its own visual system and only shares reduced-motion-aware viewport activation. */
export function useBatchReveal() {
  useEffect(() => {
    const main = document.querySelector<HTMLElement>("main");
    if (main && !document.querySelector("a.skip-link")) {
      if (!main.id) main.id = "template-main";
      main.tabIndex = -1;
      const skip = document.createElement("a");
      skip.className = "skip-link";
      skip.href = `#${main.id}`;
      skip.textContent = "Skip to content";
      document.body.prepend(skip);
    }
    const nodes = document.querySelectorAll<HTMLElement>("[data-batch-reveal]");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      nodes.forEach((node) => node.classList.add("is-batch-revealed"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-batch-revealed")),
      { threshold: 0.13 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}
