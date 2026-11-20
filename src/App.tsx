import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Keyboard, Maximize, Minimize, NotebookText, Waves } from "lucide-react";
import { acts, slides } from "./slides";
import { MotionContext } from "./lib/hooks";
import { Backdrop } from "./three/Backdrop";

const stageW = 1920;
const stageH = 1080;

const indexFromHash = () => {
  const m = window.location.hash.match(/^#(?:\/|slide-)(\d+)/);
  const i = m ? Number(m[1]) - 1 : 0;
  return Math.max(0, Math.min(slides.length - 1, i));
};

export const App = () => {
  const [index, setIndex] = useState(indexFromHash);
  const [direction, setDirection] = useState(1);
  const [scale, setScale] = useState(1);
  const [notesOpen, setNotesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  // Fit the 1920x1080 stage to the window
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / stageW, window.innerHeight / stageH));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const go = useCallback((target: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, target));
    setIndex((current) => {
      setDirection(next >= current ? 1 : -1);
      return next;
    });
  }, []);

  // Deep links: #slide-N
  useEffect(() => {
    const hash = `#slide-${index + 1}`;
    if (window.location.hash !== hash) history.replaceState(null, "", hash);
    document.title = `OBSERV-E | ${slides[index].title}`;
  }, [index]);

  useEffect(() => {
    const onHash = () => go(indexFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [go]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Keyboard navigation; ignore keys while typing in inputs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if ((el.tagName === "INPUT" && (el as HTMLInputElement).type !== "checkbox") || el.tagName === "TEXTAREA") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          go(index + 1);
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          go(index - 1);
          break;
        case "Home":
          go(0);
          break;
        case "End":
          go(slides.length - 1);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "n":
        case "N":
          setNotesOpen((v) => !v);
          break;
        case "m":
        case "M":
          setReducedMotion((v) => !v);
          break;
        case "?":
          setHelpOpen((v) => !v);
          break;
        case "Escape":
          setHelpOpen(false);
          setNotesOpen(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, toggleFullscreen]);

  const slide = slides[index];
  const act = acts.find((a) => a.id === slide.act)!;
  const SlideComponent = slide.component;
  const transition = reducedMotion ? { duration: 0.15 } : { duration: 0.85, ease: [0.22, 1, 0.36, 1] };

  return (
    <MotionContext.Provider value={{ reducedMotion }}>
      <Backdrop accent={act.color} secondary={act.secondary} paused={reducedMotion || !!slide.own3d} />
      <div className="viewport" style={{ "--accent": act.color } as CSSProperties}>
        <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }} aria-roledescription="presentation">
          <AnimatePresence initial={false} custom={direction}>
            <motion.section
              key={slide.id}
              className="slideLayer"
              aria-label={`Slide ${index + 1}: ${slide.title}`}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * 160, rotateY: direction * -14, z: -260, filter: "blur(10px)" }}
              animate={{ opacity: 1, x: 0, rotateY: 0, z: 0, filter: "blur(0px)" }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * -120, rotateY: direction * 10, z: -200, filter: "blur(8px)" }}
              transition={transition}
            >
              <SlideComponent />
            </motion.section>
          </AnimatePresence>
          <div className="grain" />

          <nav className="chrome" aria-label="Slide navigation">
            <div className="chromeAct">
              <span className="roman">{act.roman}</span>
              <b>{act.title}</b>
            </div>
            <div className="progress">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  className={`progressTick ${i < index ? "done" : ""} ${i === index ? "current" : ""} ${i > 0 && slides[i - 1].act !== s.act ? "actStart" : ""}`}
                  onClick={() => go(i)}
                  aria-label={`Go to slide ${i + 1}: ${s.title}`}
                  aria-current={i === index ? "step" : undefined}
                  title={`${i + 1}. ${s.title}`}
                />
              ))}
            </div>
            <div className="slideCount">
              {String(index + 1).padStart(2, "0")}/{slides.length}
            </div>
            <div className="chromeButtons">
              <button className="iconButton" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous slide">
                <ChevronLeft size={20} />
              </button>
              <button className="iconButton" onClick={() => go(index + 1)} disabled={index === slides.length - 1} aria-label="Next slide">
                <ChevronRight size={20} />
              </button>
              <button className={`iconButton ${notesOpen ? "on" : ""}`} onClick={() => setNotesOpen((v) => !v)} aria-pressed={notesOpen} aria-label="Toggle presenter notes">
                <NotebookText size={18} />
              </button>
              <button className={`iconButton ${reducedMotion ? "on" : ""}`} onClick={() => setReducedMotion((v) => !v)} aria-pressed={reducedMotion} aria-label="Toggle reduced motion" title="Reduced motion (M)">
                <Waves size={18} />
              </button>
              <button className={`iconButton ${helpOpen ? "on" : ""}`} onClick={() => setHelpOpen((v) => !v)} aria-label="Keyboard shortcuts">
                <Keyboard size={18} />
              </button>
              <button className="iconButton" onClick={toggleFullscreen} aria-label="Toggle full screen">
                {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </nav>

          {notesOpen && (
            <aside className="notes" aria-label="Presenter notes">
              <h4>Presenter notes</h4>
              <p style={{ margin: 0 }}>{slide.notes}</p>
            </aside>
          )}
          {helpOpen && (
            <aside className="helpOverlay" aria-label="Keyboard shortcuts">
              <kbd>→ / Space</kbd><span>Next slide</span>
              <kbd>←</kbd><span>Previous slide</span>
              <kbd>Home / End</kbd><span>First / last slide</span>
              <kbd>F</kbd><span>Full screen</span>
              <kbd>N</kbd><span>Presenter notes</span>
              <kbd>M</kbd><span>Reduced motion</span>
              <kbd>#slide-12</kbd><span>Jump by URL</span>
            </aside>
          )}
        </div>
      </div>
    </MotionContext.Provider>
  );
};
