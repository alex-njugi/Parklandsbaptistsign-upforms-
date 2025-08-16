import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useMotionValue,
  animate,
} from "framer-motion";

/* ================= Utilities ================= */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}
function safeJSONParse(s, fallback) {
  try { return JSON.parse(s); } catch (e) { void e; return fallback; }
}
function useLocalStorage(key, initial) {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") return initial;
    const raw = window.localStorage?.getItem(key);
    return raw != null ? safeJSONParse(raw, initial) : initial;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(key, JSON.stringify(state)); }
    catch (e) { void e; }
  }, [key, state]);
  return [state, setState];
}
function useScrollSpy(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (vis[0]?.target?.id) setActive(vis[0].target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

/* ================= Micro UI Bits ================= */
function AnimatedCounter({ value, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { margin: "-20% 0px -20% 0px", once: true });
  const mv = useMotionValue(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration: 1.1, ease: "easeOut" });
    return () => controls.stop();
  }, [inView, value, mv]);
  const [display, setDisplay] = useState(0);
  useEffect(() => mv.on("change", (v) => setDisplay(Math.round(v))), [mv]);
  return (
    <div ref={ref} className={className}>
      {display}{typeof value === "number" && value >= 8 ? "+" : ""}
    </div>
  );
}

function TiltCard({ children, className = "" }) {
  const innerRef = useRef(null);
  const reduced = usePrefersReducedMotion();
  function onMove(e) {
    if (reduced) return;
    const el = innerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (py - 0.5) * 8;
    const ry = (0.5 - px) * 10;
    el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
  }
  function reset() { const el = innerRef.current; if (el) el.style.transform = "rotateX(0) rotateY(0) translateZ(0)"; }
  return (
    <div className={`perspective-[1000px] ${className}`}>
      <div ref={innerRef} onMouseMove={onMove} onMouseLeave={reset}
           className="card will-change-transform transition-transform duration-150">
        {children}
      </div>
    </div>
  );
}

/* ================= Background FX ================= */
function BackgroundFX() {
  const reduced = usePrefersReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        initial={reduced ? false : { scale: 1, rotate: 0 }}
        animate={reduced ? {} : { scale: 1.15, rotate: 360 }}
        transition={{ repeat: Infinity, repeatType: "reverse", duration: 48, ease: "linear" }}
        className="absolute -top-40 left-1/2 -translate-x-1/2 h-[70vmax] w-[70vmax] rounded-full blur-3xl opacity-25"
        style={{ background: "radial-gradient(closest-side, var(--accent, #0ea5e9), transparent 70%)" }}
      />
      <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22><filter id=%22n%22 x=%220%22 y=%220%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.6%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%2240%22 height=%2240%22 filter=%22url(%23n)%22 opacity=%220.7%22/></svg>')]" />
    </div>
  );
}

/* ================= Tooltip ================= */
function Tooltip({ label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex"
          onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {children}
      {open && (
        <motion.span role="tooltip"
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap text-sm px-2.5 py-1 rounded-lg bg-black/80 text-fg border border-white/10 shadow">
          {label}
        </motion.span>
      )}
    </span>
  );
}

/* ================= Tiny Toasts ================= */
function useToasts() {
  const [items, setItems] = useState([]);
  const notify = (content, duration = 2200) => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, content }]);
    window.setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), duration);
  };
  return { items, notify };
}
function ToastViewport({ items }) {
  if (!items.length) return null;
  return createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] space-y-2">
      {items.map(({ id, content }) => (
        <motion.div key={id}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="glass rounded-xl px-4 py-2 text-sm shadow">
          {content}
        </motion.div>
      ))}
    </div>,
    document.body
  );
}

/* ================= Magnetic wrapper ================= */
function Magnetic({ strength = 16, children }) {
  const ref = useRef(null);
  const reduced = usePrefersReducedMotion();
  function onMove(e) {
    if (reduced) return;
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
  }
  function reset() { const el = ref.current; if (el) el.style.transform = "translate(0,0)"; }
  return <span ref={ref} className="inline-block" onMouseMove={onMove} onMouseLeave={reset}>{children}</span>;
}

/* ================= Theme hook & toggle ================= */
function useTheme() {
  const [theme, setTheme] = useLocalStorage("theme", "dark");
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
  }, [theme]);
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return { theme, setTheme, toggle };
}
/* UPDATED: transparent/glassy button via .btn-ghost */
function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  return (
    <button
      onClick={onToggle}
      className="pill btn-ghost text-fg shadow-sm"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {isDark ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}

/* ================= Accent + Commands ================= */
const ACCENTS = {
  sky: "#0ea5e9", emerald: "#10b981", violet: "#8b5cf6", amber: "#f59e0b", rose: "#fb7185",
};

function CommandPalette({ open, setOpen, commands }) {
  const [q, setQ] = useState("");
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
      else if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !s ? commands : commands.filter((c) => c.label.toLowerCase().includes(s));
  }, [q, commands]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="relative w-full max-w-lg glass rounded-3xl p-3"
        role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Type: Volunteer, Groups, Baptism, Membership, Events…"
          className="w-full bg-transparent outline-none text-fg text-base px-3 py-2 border-b border-white/10"
        />
        <div className="max-h-72 overflow-auto py-2">
          {filtered.length === 0 && <div className="text-muted text-sm px-3 py-2">No results</div>}
          {filtered.map((cmd) => (
            <button key={cmd.label} onClick={() => { cmd.action(); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10">
              <div className="text-fg">{cmd.label}</div>
              {cmd.hint && <div className="text-muted-2 text-xs">{cmd.hint}</div>}
            </button>
          ))}
        </div>
        <div className="px-3 pt-1 pb-2 text-xs text-muted-2">
          Tip: Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd>
        </div>
      </motion.div>
    </div>
  );
}

/* ================= Progress Bar ================= */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div style={{ scaleX: scrollYProgress }}
      className="fixed top-0 left-0 right-0 h-1 origin-left bg-white/70 z-[60]" aria-hidden />
  );
}

/* ================= Nav ================= */
/* NOTE: theme toggle removed from navbar (we float it bottom-left) */
function Nav({ activeId, onOpenCommand }) {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = useMemo(
    () => [
      { label: "Home", href: "#home" },
      { label: "Sign-up Forms", href: "#blocks" },
      { label: "Next Steps", href: "#get-started" },
    ], []
  );

  return (
    <header className="fixed top-4 left-0 right-0 z-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:bg-white focus:text-black focus:rounded-md focus:px-3 focus:py-2">
        Skip to content
      </a>

      <div className="su-container">
        <div className={[
            "rounded-full flex items-center justify-between px-3 py-2 transition-all duration-300",
            solid ? "bg-black/50 backdrop-blur-md border border-white/15 shadow-[0_10px_30px_-12px_rgba(0,0,0,.5)]" : "glass",
          ].join(" ")}>
          {/* brand */}
          <a href="#home" className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-white/5">
            <span className="inline-block h-8 w-8 rounded-full" style={{ background: "color-mix(in oklab, var(--accent) 75%, white)" }} />
            <span className="font-semibold tracking-tight text-fg">
              Parklands Baptist Church
            </span>
          </a>

          {/* center nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((i) => {
              const active = activeId === i.href.slice(1);
              return (
                <a key={i.href} href={i.href}
                   className="pill hover:bg-white/10 text-muted hover:text-fg transition-colors"
                   aria-current={active ? "page" : undefined}
                   style={active ? { backgroundColor: "var(--active-pill)", color: "var(--fg)" } : undefined}>
                  {i.label}
                </a>
              );
            })}
          </nav>

          {/* right actions */}
          <div className="hidden sm:flex items-center gap-2">
            <Tooltip label="Command palette (Ctrl/Cmd + K)">
              <button onClick={onOpenCommand} className="pill hover:bg-white/10 text-fg" aria-label="Command palette">
                ⌘K
              </button>
            </Tooltip>
            <a className="pill hover:bg-white/10 text-muted" href="https://parklandsbaptist.org/new-here/" target="_blank" rel="noreferrer">
              Service Times
            </a>
            {/* ALWAYS WHITE */}
            <a className="pill btn-white font-semibold" href="https://parklandsbaptist.org/giving/" target="_blank" rel="noreferrer">
              Give Online
            </a>
            <a className="pill text-fg font-semibold" href="#get-started" style={{ backgroundColor: "var(--accent)" }}>
              New Here?
            </a>
          </div>

          {/* mobile */}
          <button onClick={() => setOpen((v) => !v)} className="md:hidden pill hover:bg-white/10 text-fg" aria-label="Toggle Menu">
            ☰
          </button>
        </div>

        {/* mobile drawer */}
        {open && (
          <div className="mt-2 glass rounded-3xl md:hidden p-2">
            <div className="flex flex-col">
              {navItems.map((i) => {
                const active = activeId === i.href.slice(1);
                return (
                  <a key={i.href} href={i.href}
                     className="pill hover:bg-white/10 text-fg"
                     style={active ? { backgroundColor: "var(--active-pill)" } : undefined}
                     onClick={() => setOpen(false)}>
                    {i.label}
                  </a>
                );
              })}
              <div className="h-px bg-white/10 my-2" />
              <button onClick={onOpenCommand} className="pill hover:bg-white/10 text-fg" aria-label="Command palette">⌘K</button>
              <a className="pill hover:bg-white/10 text-fg mt-2" href="https://parklandsbaptist.org/new-here/" target="_blank" rel="noreferrer">Service Times</a>
              {/* ALWAYS WHITE (mobile) */}
              <a className="pill btn-white font-semibold my-1" href="https://parklandsbaptist.org/giving/" target="_blank" rel="noreferrer">Give Online</a>
              <a className="pill text-fg font-semibold" href="#get-started" style={{ backgroundColor: "var(--accent)" }}>
                New Here?
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

/* ================= Main Page ================= */
export default function App() {
  const reduced = usePrefersReducedMotion();
  const activeId = useScrollSpy(["home", "blocks", "get-started"]);
  const [showTop, setShowTop] = useState(false);
  const [accent, setAccent] = useLocalStorage("accent", "#0ea5e9");
  const [cmdOpen, setCmdOpen] = useState(false);
  const { items: toasts, notify } = useToasts();
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
  }, [accent]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Parallax
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, reduced ? 0 : -80]);

  // Categories + links
  const featureItems = useMemo(
    () => [
      ["Volunteer & Service Teams", "Serve in Worship (Magnification), Hospitality, Membercare and more."],
      ["Community Groups", "Join a Housegroup for fellowship, Bible study, and prayer near you."],
      ["Baptism & Membership", "Take your next steps through Membercare and discipleship pathways."],
      ["Children’s Ministry", "Programs and care for children to grow in Christ."],
      ["Youth Ministry", "A place for youth to learn, serve, and grow in faith."],
      ["Events & Classes", "Conference registrations, discipleship classes, and church events."],
    ], []
  );
  const linkMap = useMemo(() => ({
    "Volunteer & Service Teams": "https://parklandsbaptist.org/our-ministries/",
    "Community Groups": "https://parklandsbaptist.org/ministries/housegroup/",
    "Baptism & Membership": "https://parklandsbaptist.org/ministries/membercare-department/",
    "Children’s Ministry": "https://parklandsbaptist.org/ministries/childrens-ministry/",
    "Youth Ministry": "https://parklandsbaptist.org/ministries/youth-ministry/",
    "Events & Classes": "https://parklandsbaptist.org/events/",
  }), []);

  const commands = useMemo(() => [
    { label: "Go to Home", hint: "#home", action: () => document.getElementById("home")?.scrollIntoView({ behavior: "smooth" }) },
    { label: "Go to Sign-up Forms", hint: "#blocks", action: () => document.getElementById("blocks")?.scrollIntoView({ behavior: "smooth" }) },
    { label: "Go to Next Steps", hint: "#get-started", action: () => document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" }) },

    { label: "Volunteer & Service Teams", hint: "Open ministries", action: () => window.open(linkMap["Volunteer & Service Teams"], "_blank") },
    { label: "Community Groups", hint: "Housegroups", action: () => window.open(linkMap["Community Groups"], "_blank") },
    { label: "Baptism & Membership", hint: "Membercare", action: () => window.open(linkMap["Baptism & Membership"], "_blank") },
    { label: "Children’s Ministry", hint: "Programs", action: () => window.open(linkMap["Children’s Ministry"], "_blank") },
    { label: "Youth Ministry", hint: "Programs", action: () => window.open(linkMap["Youth Ministry"], "_blank") },
    { label: "Events & Classes", hint: "Church calendar", action: () => window.open(linkMap["Events & Classes"], "_blank") },

    { label: "Service Times", hint: "New Here page", action: () => window.open("https://parklandsbaptist.org/new-here/", "_blank") },
    { label: "Give Online", hint: "Giving page", action: () => window.open("https://parklandsbaptist.org/giving/", "_blank") },
    { label: "Online Bulletin", hint: "Weekly info", action: () => window.open("https://parklandsbaptist.org/online-bulletin/", "_blank") },

    { label: "Accent → Sky", action: () => { setAccent(ACCENTS.sky); notify("🎨 Accent → Sky"); } },
    { label: "Accent → Emerald", action: () => { setAccent(ACCENTS.emerald); notify("🎨 Accent → Emerald"); } },
    { label: "Accent → Violet", action: () => { setAccent(ACCENTS.violet); notify("🎨 Accent → Violet"); } },
    { label: "Accent → Amber", action: () => { setAccent(ACCENTS.amber); notify("🎨 Accent → Amber"); } },
    { label: "Accent → Rose", action: () => { setAccent(ACCENTS.rose); notify("🎨 Accent → Rose"); } },
  ], [setAccent, notify, linkMap]);

  return (
    <main id="main" className="min-h-screen theme-root">
      <BackgroundFX />
      <ScrollProgress />

      <Nav
        activeId={activeId}
        onOpenCommand={() => setCmdOpen(true)}
      />

      {/* Floating Theme Toggle (bottom-left) */}
      <div
        className="fixed left-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-[70]"
        role="region"
        aria-label="Theme switcher"
      >
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      {/* HERO */}
      <section
        id="home"
        data-fixed-bg
        className="relative pt-28 md:pt-32 pb-16 md:pb-24 overflow-hidden hero-gradient"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1880&auto=format&fit=crop)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          /* lock image look for both themes */
          filter: "none",
          backgroundBlendMode: "normal",
        }}
      >
        <div className="absolute inset-0 hero-overlay" />
        <motion.div aria-hidden style={{ y }} className="absolute inset-0 pointer-events-none" />

        <div className="relative su-container">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 20 }}
            whileInView={reduced ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight drop-shadow text-fg">
              Parklands Baptist Church <span className="text-muted">Sign-Ups</span>
            </h1>
            <p className="mt-4 text-lg md:text-xl text-muted leading-relaxed">
              Find your place to serve, grow, and connect. Explore open sign-ups for
              ministries, housegroups, classes, and upcoming events.
            </p>

            <div className="mt-6 flex items-center gap-3 flex-wrap">
              {/* ALWAYS WHITE */}
              <Magnetic>
                <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
                  href="#blocks" className="pill btn-white font-semibold"
                  onClick={() => notify("📋 Browse sign-up categories")}>
                  Browse Sign-ups
                </motion.a>
              </Magnetic>
              <Magnetic>
                <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
                  href="https://parklandsbaptist.org/new-here/" target="_blank" rel="noreferrer"
                  className="pill glass text-fg hover:bg-white/15"
                  onClick={() => notify("🕊️ Service times & info")}>
                  Service Times
                </motion.a>
              </Magnetic>
              <span className="text-muted-2 text-sm">Westlands • Northgate • Eastgate</span>
            </div>
          </motion.div>

          {/* quick stats */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 20 }}
            whileInView={reduced ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <div className="card text-center">
              <AnimatedCounter value={20} className="text-4xl md:text-5xl font-extrabold tracking-tight text-fg" />
              <div className="mt-2 text-muted font-semibold">Ministries & Departments</div>
              <p className="mt-2 text-sm text-muted-2">Explore ways to serve and grow.</p>
            </div>
            <div className="card text-center">
              <AnimatedCounter value={10} className="text-4xl md:text-5xl font-extrabold tracking-tight text-fg" />
              <div className="mt-2 text-muted font-semibold">Monthly Events</div>
              <p className="mt-2 text-sm text-muted-2">See what’s happening at PBC.</p>
            </div>
            <div className="card text-center">
              <AnimatedCounter value={3} className="text-4xl md:text-5xl font-extrabold tracking-tight text-fg" />
              <div className="mt-2 text-muted font-semibold">Campuses</div>
              <p className="mt-2 text-sm text-muted-2">Westlands, Northgate & Eastgate.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SIGN-UP CATEGORIES */}
      <section id="blocks" className="py-20">
        <div className="su-container">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 18 }}
            whileInView={reduced ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-fg">Explore Sign-up Forms</h2>
            <p className="mt-3 text-muted">
              Choose a category to open the form or ministry page. You can select your campus and preferred times where applicable.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featureItems.map(([title, desc]) => (
              <motion.div key={title}
                initial={reduced ? false : { opacity: 0, y: 16 }}
                whileInView={reduced ? {} : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }}
                transition={{ duration: 0.45 }}
              >
                <TiltCard>
                  <div className="h-10 w-10 rounded-2xl bg-white/15 flex items-center justify-center text-xl">✚</div>
                  <h3 className="mt-4 text-xl font-semibold text-fg">{title}</h3>
                  <p className="mt-2 text-muted-2 text-sm">{desc}</p>
                  <a href={linkMap[title] || "#"} target="_blank" rel="noreferrer"
                     className="mt-4 inline-block pill btn-primary font-semibold"
                     onClick={() => notify(`Opening: ${title}`)}>
                    Open Form
                  </a>
                </TiltCard>
              </motion.div>
            ))}
          </div>

          {/* Accent color picker */}
          <div className="mt-10 hidden sm:flex items-center gap-3">
            <span className="text-muted-2 text-sm">Accent</span>
            <div className="glass rounded-full px-3 py-2 flex items-center gap-2">
              {Object.entries(ACCENTS).map(([name, val]) => (
                <button key={name} aria-label={`Set accent ${name}`}
                        onClick={() => { setAccent(val); document.documentElement.style.setProperty("--accent", val); notify(`🎨 Accent → ${name}`); }}
                        className="h-6 w-6 rounded-full border border-white/30"
                        style={{ backgroundColor: val, boxShadow: accent === val ? "0 0 0 3px rgba(255,255,255,.4)" : undefined }}
                        title={name} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA / NEXT STEPS */}
      <section id="get-started" className="py-20">
        <div className="su-container">
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.98 }}
            whileInView={reduced ? {} : { opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="glass rounded-3xl px-6 py-10 md:py-14 md:px-10 text-center"
          >
            <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight text-fg">Ready to Sign Up?</h3>
            <p className="mt-3 text-muted">Start with a category above, or jump to key links below.</p>
            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              {/* ALWAYS WHITE */}
              <Magnetic>
                <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
                  className="pill btn-white font-semibold" href="#blocks"
                  onClick={() => notify("📋 Browse all sign-ups")}>
                  Browse Sign-up Forms
                </motion.a>
              </Magnetic>
              <Magnetic>
                <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
                  className="pill hover:bg-white/10 text-fg" href="https://parklandsbaptist.org/online-bulletin/"
                  target="_blank" rel="noreferrer">
                  Online Bulletin
                </motion.a>
              </Magnetic>
              <Magnetic>
                <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
                  className="pill text-fg font-semibold" href="https://parklandsbaptist.org/events/"
                  target="_blank" rel="noreferrer" style={{ backgroundColor: "var(--accent)" }}>
                  Upcoming Events
                </motion.a>
              </Magnetic>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pb-10">
        <div className="su-container text-center text-muted-2">
          <div className="h-px bg-white/10 mb-6" />
          <p>© {new Date().getFullYear()} Parklands Baptist Church • Prof. Saitoti Ave (off Ring Road Westlands) • (+254) 111 023 000 • reception@parklandsbaptist.org</p>
        </div>
      </footer>

      {/* Back to Top */}
      {showTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="fixed bottom-6 right-6 pill btn-primary font-semibold shadow-[0_10px_30px_-12px_rgba(0,0,0,.6)]"
                aria-label="Back to top">
          ↑ Top
        </button>
      )}

      {/* Command Palette + Toasts */}
      <CommandPalette open={cmdOpen} setOpen={setCmdOpen} commands={commands} />
      <ToastViewport items={toasts} />
    </main>
  );
}
