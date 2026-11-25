/** Мобайл-фёрст, breakpoints по ТЗ 4.3. Цвета и шрифты — из CSS-переменных в src/index.css. */
const rgb = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    screens: { sm: "320px", md: "768px", lg: "1200px" },
    extend: {
      colors: {
        void: rgb("void"),
        space: rgb("space"),
        panel: rgb("panel"),
        raised: rgb("raised"),
        line: rgb("line"),
        ink: { DEFAULT: rgb("ink"), soft: rgb("ink-soft"), mute: rgb("ink-mute") },
        crawl: rgb("crawl"),
        holo: rgb("holo"),
        good: rgb("good"),
        bad: rgb("bad"),
        warn: rgb("warn"),
      },
      fontFamily: {
        sans: ["Onest Variable", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["Exo 2 Variable", "Onest Variable", "Arial", "sans-serif"],
      },
      fontSize: {
        // подписи HUD: короткие строки капсом
        hud: ["0.8125rem", { lineHeight: "1.2", letterSpacing: "0.1em" }],
      },
      borderRadius: { ctl: "8px" },
      boxShadow: {
        holo: "0 0 0 1px rgb(var(--c-holo) / 0.35), 0 0 18px -6px rgb(var(--c-holo) / 0.55)",
        saber: "0 0 10px -1px var(--saber, rgb(var(--c-holo) / 0.7))",
      },
      transitionTimingFunction: { out: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
      keyframes: {
        "crawl-rise": {
          from: { opacity: "0", transform: "translateY(38%)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        ignite: { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
        orbit: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "crawl-rise": "crawl-rise 4.5s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        ignite: "ignite 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        orbit: "orbit 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};
