gsap.registerPlugin(ScrollTrigger);

const FRAME_COUNT = 193;
const FRAME_SPEED = 3.3;   // video finishes around 30% of the scroll
const IMAGE_SCALE = 1.12;  // slight over-scale to crop the fisheye rim
const framePath = i => `frame_${String(i + 1).padStart(4, "0")}.webp`;

if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

/* ---------- Lenis ---------- */
const lenis = new Lenis({
  duration: 1.2,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true
});
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

/* ---------- Elements ---------- */
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const loader = document.getElementById("loader");
const loaderBar = document.getElementById("loader-bar");
const loaderPct = document.getElementById("loader-pct");
const scrollContainer = document.getElementById("scroll-container");
const heroSection = document.getElementById("hero");
const veil = document.getElementById("dark-overlay");
const header = document.getElementById("site-header");
const marquees = [...document.querySelectorAll(".marquee-wrap")];
const sections = [...document.querySelectorAll(".scroll-section")];

/* ---------- Canvas renderer ---------- */
const frames = new Array(FRAME_COUNT);
let currentFrame = 0;
let bgColor = "#ffffff";

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  drawFrame(currentFrame);
}

function drawFrame(index) {
  const img = frames[index];
  if (!img || !img.naturalWidth) return;
  const cw = canvas.width, ch = canvas.height;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
  const dw = iw * scale, dh = ih * scale;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

function sampleBgColor(img) {
  if (!img || !img.naturalWidth) return;
  const c = document.createElement("canvas");
  c.width = 10; c.height = 10;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0, img.naturalWidth * 0.05, img.naturalHeight, 0, 0, 10, 10);
  const d = x.getImageData(0, 0, 10, 10).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  r /= n; g /= n; b /= n;
  if ((r + g + b) / 3 > 215) bgColor = `rgb(${r | 0},${g | 0},${b | 0})`;
}

/* ---------- Two-phase preloader ---------- */
let loaded = 0;
function loadFrame(i) {
  return new Promise(resolve => {
    const img = new Image();
    img.decoding = "async";
    const done = () => {
      loaded++;
      const pct = Math.round(loaded / FRAME_COUNT * 100);
      loaderBar.style.width = pct + "%";
      loaderPct.textContent = pct + "%";
      resolve();
    };
    img.onload = done;
    img.onerror = done;
    img.src = framePath(i);
    frames[i] = img;
  });
}

async function preload() {
  const firstBatch = [];
  for (let i = 0; i < 10; i++) firstBatch.push(loadFrame(i));
  await Promise.all(firstBatch);
  sampleBgColor(frames[0]);
  resizeCanvas();
  const rest = [];
  for (let i = 10; i < FRAME_COUNT; i++) rest.push(loadFrame(i));
  await Promise.all(rest);
  resizeCanvas();
  loader.classList.add("hidden");
  ScrollTrigger.refresh();
}
preload();
addEventListener("resize", () => { resizeCanvas(); ScrollTrigger.refresh(); });

/* ---------- Section engine ---------- */
const ENTRANCES = {
  "fade-up":     { y: 50, opacity: 0, duration: .9, ease: "power3.out" },
  "slide-left":  { x: -80, opacity: 0, duration: .9, ease: "power3.out" },
  "slide-right": { x: 80, opacity: 0, duration: .9, ease: "power3.out" },
  "scale-up":    { scale: .85, opacity: 0, duration: 1.0, ease: "power2.out" },
  "rotate-in":   { y: 40, rotation: 3, opacity: 0, duration: .9, ease: "power3.out" },
  "stagger-up":  { y: 60, opacity: 0, duration: .8, ease: "power3.out" },
  "clip-reveal": { clipPath: "inset(100% 0 0 0)", opacity: 0, duration: 1.0, ease: "power4.inOut" }
};
const CHILD_SELECTOR = ".section-label,.section-heading,.section-body,.section-note,.cta-button,.stat,.jewel-card,.product-img,.product-meta > *";

const engines = sections.map(section => {
  const enter = parseFloat(section.dataset.enter) / 100;
  const leave = parseFloat(section.dataset.leave) / 100;
  const persist = section.dataset.persist === "true";
  const mid = (enter + leave) / 2;
  section.style.top = `calc(${mid} * (100% - 100vh) + 50vh)`;

  const kids = [...section.querySelectorAll(CHILD_SELECTOR)];
  const from = ENTRANCES[section.dataset.animation] || ENTRANCES["fade-up"];
  const tl = gsap.timeline({ paused: true });
  tl.from(kids, { ...from, stagger: 0.12 });
  return { section, enter, leave, persist, tl, active: false };
});

/* ---------- Counters ---------- */
const statsSection = document.querySelector(".section-stats");
const statsEnter = parseFloat(statsSection.dataset.enter) / 100;
const statNums = [...document.querySelectorAll(".stat-number[data-value]")];
let countersPlayed = false;

function playCounters() {
  statNums.forEach(el => {
    const target = parseFloat(el.dataset.value);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const proxy = { v: 0 };
    gsap.to(proxy, {
      v: target, duration: 2, ease: "power1.out",
      onUpdate: () => { el.textContent = proxy.v.toFixed(decimals); }
    });
  });
}
function resetCounters() {
  statNums.forEach(el => {
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    el.textContent = (0).toFixed(decimals);
  });
}

/* ---------- White veil ---------- */
const WIPE_START = 0.295, WIPE_END = 0.318;
const SOLID = "rgba(255,255,255,1)";
function updateVeil(p) {
  let bg;
  if (p < WIPE_START) {
    bg = "rgba(255,255,255,0)";
  } else if (p < WIPE_END) {
    const t = (p - WIPE_START) / (WIPE_END - WIPE_START);
    const x = t * 165 - 35;
    bg = `linear-gradient(180deg, ${SOLID} ${x}%, rgba(255,255,255,0) ${x + 35}%)`;
  } else if (p < 0.445) {
    bg = SOLID;
  } else if (p < 0.585) {
    bg = "rgba(255,255,255,.93)";
  } else {
    bg = SOLID;
  }
  veil.style.background = bg;
}

/* ---------- Scroll bindings ---------- */
const trigger = { trigger: scrollContainer, start: "top top", end: "bottom bottom", scrub: true };

// frames
ScrollTrigger.create({ ...trigger, onUpdate: self => {
  const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
  const index = Math.min(Math.floor(accelerated * FRAME_COUNT), FRAME_COUNT - 1);
  if (index !== currentFrame) {
    currentFrame = index;
    if (index % 20 === 0) sampleBgColor(frames[index]);
    requestAnimationFrame(() => drawFrame(index));
  }
}});

// hero overlay
ScrollTrigger.create({ ...trigger, onUpdate: self => {
  heroSection.style.opacity = Math.max(0, 1 - self.progress * 14);
}});

// sections
ScrollTrigger.create({ ...trigger, onUpdate: self => {
  const p = self.progress;
  engines.forEach(e => {
    const near = p >= e.enter - 0.06 && (e.persist || p <= e.leave + 0.06);
    e.section.style.visibility = near ? "visible" : "hidden";
    const inside = p >= e.enter && (e.persist || p <= e.leave);
    if (inside && !e.active) { e.active = true; e.tl.play(); }
    else if (!inside && e.active) {
      e.active = false;
      if (!e.persist) e.tl.reverse();
      else if (p < e.enter) e.tl.reverse();
    }
  });
}});

// counters
ScrollTrigger.create({ ...trigger, onUpdate: self => {
  const p = self.progress;
  if (p > statsEnter + 0.01 && !countersPlayed) { countersPlayed = true; playCounters(); }
  else if (p < statsEnter - 0.02 && countersPlayed) { countersPlayed = false; resetCounters(); }
}});

// marquees
ScrollTrigger.create({ ...trigger, onUpdate: self => {
  const p = self.progress;
  marquees.forEach(m => {
    const show = parseFloat(m.dataset.show);
    const hide = parseFloat(m.dataset.hide);
    const speed = parseFloat(m.dataset.scrollSpeed || "-20");
    const fade = 0.02;
    let o = 0;
    if (p >= show && p <= hide) {
      o = Math.min(1, (p - show) / fade, (hide - p) / fade);
    }
    m.style.opacity = Math.max(0, o);
    gsap.set(m.firstElementChild, { xPercent: speed * (p - show) * 8 });
  });
}});

// veil + header
ScrollTrigger.create({ ...trigger, onUpdate: self => {
  updateVeil(self.progress);
  header.classList.toggle("on-video", self.progress < 0.29);
}});


/* ---------- Réalisations : lecture auto dans le viewport + visionneuse ---------- */
const reelVideos = [...document.querySelectorAll(".reel video")];
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    const v = en.target;
    if (en.isIntersecting) {
      if (!v.getAttribute("src")) v.src = v.dataset.src;
      v.play().catch(() => {});
    } else v.pause();
  }), { threshold: 0.35 });
  reelVideos.forEach(v => io.observe(v));
}
const lb = document.getElementById("lightbox");
const lbVideo = document.getElementById("lb-video");
const lbTitle = document.getElementById("lb-title");
const lbImg = document.getElementById("lb-img");
function openLb(src, title) {
  lenis.stop();
  lbTitle.textContent = title;
  lbImg.hidden = true; lbVideo.hidden = false;
  lbVideo.src = src;
  lb.hidden = false;
  lbVideo.play().catch(() => {});
}
function openImg(src) {
  lenis.stop();
  lbTitle.textContent = "";
  lbVideo.hidden = true; lbImg.hidden = false;
  lbImg.src = src;
  lb.hidden = false;
}
function closeLb() {
  lbVideo.pause();
  lbVideo.removeAttribute("src");
  lbVideo.load();
  lbImg.removeAttribute("src");
  lb.hidden = true;
  lenis.start();
}
document.querySelectorAll(".reel").forEach(b => b.addEventListener("click", () => openLb(b.dataset.src, b.dataset.title)));
lb.querySelector(".lb-close").addEventListener("click", closeLb);
lb.addEventListener("click", e => { if (e.target === lb) closeLb(); });
addEventListener("keydown", e => { if (e.key === "Escape" && !lb.hidden) closeLb(); });

document.querySelectorAll(".shot").forEach(b => b.addEventListener("click", () => openImg(b.dataset.img)));
