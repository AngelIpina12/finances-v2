export const THEME_STORAGE_KEY = "theme";

export const THEME_INITIALIZATION_SCRIPT = `
(() => {
    try {
        const storedTheme = localStorage.getItem("${THEME_STORAGE_KEY}") || "system";
        const resolvedTheme = storedTheme === "system"
            ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
            : storedTheme;
        const root = document.documentElement;

        root.classList.remove("light", "dark");
        root.classList.add(resolvedTheme);
        root.style.colorScheme = resolvedTheme;
    } catch {}
})();
`;
