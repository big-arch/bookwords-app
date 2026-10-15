/* Local visual effects only. This module never reads or changes vocabulary data. */
(() => {
  const canvas = document.querySelector("#ambientStars");
  const context = canvas?.getContext("2d");
  const toggle = document.querySelector("#motionToggle");
  const label = document.querySelector("#motionLabel");
  if (!canvas || !context || !toggle || !label) return;

  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const preferenceKey = "bookwords.ambientMotion.v1";
  let preference = "on";
  try { preference = localStorage.getItem(preferenceKey) || "on"; } catch { /* Storage is optional. */ }
  let width = 0;
  let height = 0;
  let stars = [];
  let animationFrame = 0;
  let pointerFrame = 0;
  let previousPaint = 0;
  let motionTime = 0;
  let pointer = { x: 0, y: 0, target: null };

  const motionEnabled = () => preference !== "off" && !reducedMotion.matches;
  const canAnimate = () => motionEnabled() && !document.hidden && !document.body.classList.contains("is-studying");

  function sizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = width < 700 ? 20 : 52;
    // A deterministic field avoids stars jumping when the viewport is resized.
    stars = Array.from({ length: count }, (_, index) => ({
      x: ((index * 0.61803398875 + 0.17) % 1) * width,
      y: ((index * 0.41421356237 + 0.07) % 1) * height,
      radius: 0.45 + (index % 4) * 0.2,
      phase: index * 2.399,
      speed: 0.14 + (index % 5) * 0.035
    }));
    paint(motionTime);
  }

  function paint(time) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#b6e8ed";
    for (const star of stars) {
      context.globalAlpha = 0.18 + (Math.sin(time * star.speed + star.phase) + 1) * 0.18;
      const drift = Math.sin(time * 0.055 + star.phase) * 4;
      context.beginPath();
      context.arc(star.x + drift, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function tick(timestamp) {
    animationFrame = 0;
    if (!canAnimate()) return;
    if (timestamp - previousPaint >= 40) {
      const elapsed = previousPaint ? Math.min(timestamp - previousPaint, 100) : 40;
      motionTime += elapsed / 1000;
      previousPaint = timestamp;
      paint(motionTime);
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function reconcile() {
    cancelAnimationFrame(animationFrame);
    cancelAnimationFrame(pointerFrame);
    animationFrame = 0;
    pointerFrame = 0;
    previousPaint = 0;
    const enabled = motionEnabled();
    document.body.classList.toggle("motion-paused", !enabled);
    toggle.setAttribute("aria-pressed", String(enabled));
    toggle.disabled = reducedMotion.matches;
    label.textContent = reducedMotion.matches ? "Без анимации" : enabled ? "Живой фон" : "Фон на паузе";
    toggle.title = reducedMotion.matches ? "Анимация отключена системной настройкой уменьшения движения" : enabled ? "Остановить движение и подсветки фона" : "Включить движение и подсветки фона";
    if (!enabled || document.body.classList.contains("is-studying")) {
      document.body.classList.remove("pointer-active");
      root.style.removeProperty("--scene-x");
      root.style.removeProperty("--scene-y");
    }
    if (canAnimate()) animationFrame = requestAnimationFrame(tick);
    else paint(motionTime);
  }

  toggle.addEventListener("click", () => {
    preference = motionEnabled() ? "off" : "on";
    try { localStorage.setItem(preferenceKey, preference); } catch { /* Keep an in-memory preference. */ }
    reconcile();
  });

  document.addEventListener("pointermove", (event) => {
    if (!motionEnabled() || !finePointer.matches || event.pointerType === "touch" || document.body.classList.contains("is-studying")) return;
    pointer = { x: event.clientX, y: event.clientY, target: event.target };
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!motionEnabled()) return;
      const { x, y, target } = pointer;
      root.style.setProperty("--pointer-x", `${x}px`);
      root.style.setProperty("--pointer-y", `${y}px`);
      root.style.setProperty("--scene-x", `${(x / width - 0.5) * -12}px`);
      root.style.setProperty("--scene-y", `${(y / height - 0.5) * -8}px`);
      document.body.classList.add("pointer-active");
      const panel = target instanceof Element ? target.closest(".glow-panel") : null;
      if (panel) {
        const bounds = panel.getBoundingClientRect();
        panel.style.setProperty("--glow-x", `${x - bounds.left}px`);
        panel.style.setProperty("--glow-y", `${y - bounds.top}px`);
      }
    });
  }, { passive: true });

  document.documentElement.addEventListener("pointerleave", () => {
    document.body.classList.remove("pointer-active");
  });
  window.addEventListener("resize", sizeCanvas, { passive: true });
  document.addEventListener("visibilitychange", reconcile);
  document.addEventListener("bookwords:viewchange", reconcile);
  reducedMotion.addEventListener("change", reconcile);
  sizeCanvas();
  reconcile();
})();
