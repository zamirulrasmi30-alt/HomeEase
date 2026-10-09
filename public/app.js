(function () {
  "use strict";

  const API = {
    services: "/api/services",
    workers: "/api/workers",
    reviews: "/api/reviews",
    bookings: "/api/bookings",
  };

  // Replace with your key from https://web3forms.com after signing up.
  const WEB3FORMS_ACCESS_KEY = "1c53e5db-669b-42a6-ab83-7a092e5c3f01";

  // ── Pricing model ──
  const VISITING_FEE = 199;
  // Categories that keep a fixed published price; everything else is inspection-based.
  const FIXED_PRICE_CATEGORIES = ["cleaning"];

  // ── Local booking store ──
  const BOOKINGS_KEY = "homeEaseBookings";
  const CUSTOMER_PROFILE_KEY = "homeEaseCustomerProfile";

  function isInspectionService(service) {
    if (!service) return false;
    return FIXED_PRICE_CATEGORIES.indexOf(String(service.category || "").toLowerCase()) === -1;
  }

  // Price/type overrides taken from a clicked Book Now button's data attributes.
  const PRICE_OVERRIDES = {};

  function setServicePriceOverride(serviceId, amount, bookingType) {
    if (!serviceId || !Number.isFinite(Number(amount))) return;
    PRICE_OVERRIDES[String(serviceId)] = {
      amount: Number(amount),
      bookingType: bookingType === "inspection" ? "inspection" : "fixed",
    };
  }

  function servicePricing(service) {
    const override = service && PRICE_OVERRIDES[String(service.id)];
    if (override) {
      const base = override.bookingType === "inspection"
        ? {
            bookingType: "inspection",
            amount: VISITING_FEE,
            visitingFee: VISITING_FEE,
            label: "Starts from ₹199",
            tag: "(Visiting Fee)",
          }
        : {
            bookingType: "fixed",
            amount: override.amount,
            visitingFee: 0,
            label: "₹" + override.amount,
            tag: "(Final Price)",
          };
      base.note = base.bookingType === "inspection"
        ? "Visiting & Inspection Fee: ₹" + VISITING_FEE +
          ". Final repair cost will be quoted on-site after inspection."
        : "";
      return base;
    }
    if (isInspectionService(service)) {
      return {
        bookingType: "inspection",
        amount: VISITING_FEE,
        visitingFee: VISITING_FEE,
        label: "Starts from ₹" + VISITING_FEE,
        tag: "(Visiting Fee)",
        note: "Visiting & Inspection Fee: ₹" + VISITING_FEE +
          ". Final repair cost will be quoted on-site after inspection.",
      };
    }
    const fixed = Number(service && service.price) || 0;
    return {
      bookingType: "fixed",
      amount: fixed,
      visitingFee: 0,
      label: "₹" + fixed,
      tag: "(Final Price)",
      note: "",
    };
  }

  // ── Service lookup: API records plus ad-hoc entries (carousel / cards whose
  //    service has not been loaded yet) so name + price prefill always works. ──
  const ADHOC_SERVICES = {};

  function adhocIdFor(title) {
    return "adhoc-" + String(title || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function registerAdhocService(title, price, bookingType) {
    const name = String(title || "").trim();
    if (!name) return null;
    const type = bookingType === "inspection" ? "inspection" : "fixed";
    const id = adhocIdFor(name);
    const amount = Number(price);
    const prev = ADHOC_SERVICES[id];
    ADHOC_SERVICES[id] = {
      id: id,
      title: name,
      category: type === "inspection" ? "ac-mechanic" : "cleaning",
      price: Number.isFinite(amount) && amount > 0 ? amount : (prev ? prev.price : 0),
      __adhoc: true,
    };
    return ADHOC_SERVICES[id];
  }

  function findService(key) {
    if (key === undefined || key === null || key === "") return null;
    const id = String(key);
    const byId = state.services.find((s) => String(s.id) === id);
    if (byId) return byId;
    if (ADHOC_SERVICES[id]) return ADHOC_SERVICES[id];
    const lower = id.toLowerCase();
    const byTitle = state.services.find((s) => String(s.title).toLowerCase() === lower);
    if (byTitle) return byTitle;
    return ADHOC_SERVICES[adhocIdFor(id)] || null;
  }

  // ── UPI (100% Free · Zero Commission) ──
  const UPI_CONFIG = {
    upiId: "zamirulrasmi03@okhdfcbank",
    payeeName: "Zamirul Rasmi",
  };

  let pendingBookingRef = "";

  const FALLBACK_ICONS = {
    cleaning: "fa-broom",
    "ac-mechanic": "fa-snowflake",
    "vehicle-mechanic": "fa-car",
    plumber: "fa-faucet",
    electrician: "fa-bolt",
    painting: "fa-paint-roller",
    "appliance-repair": "fa-tools",
  };

  // ── Ultra-realistic high-res hero photography per category ──
  const UW = "https://images.unsplash.com";

  const heroCategoryImages = {
    "Home / Default": UW + "/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    "Home Cleaning": UW + "/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
    "AC Mechanic": UW + "/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80",
    "Plumbing": UW + "/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1200&q=80",
    "Electrician": UW + "/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80",
    "Vehicle Repair / Mechanic": UW + "/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1200&q=80",
    "Painting": UW + "/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=1200&q=80",
    "Appliance Repair": UW + "/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1200&q=80",
  };

  const defaultHeroImage = heroCategoryImages["Home / Default"];

  const CATEGORY_HERO_ALIASES = {
    home: "Home / Default",
    Home: "Home / Default",
    cleaning: "Home Cleaning",
    "ac-mechanic": "AC Mechanic",
    plumber: "Plumbing",
    Plumber: "Plumbing",
    Plumbing: "Plumbing",
    electrician: "Electrician",
    painting: "Painting",
    "vehicle-mechanic": "Vehicle Repair / Mechanic",
    "Vehicle Mechanic": "Vehicle Repair / Mechanic",
    "appliance-repair": "Appliance Repair",
  };

  function changeHeroImage(categoryName) {
    const key = heroCategoryImages[categoryName]
      ? categoryName
      : CATEGORY_HERO_ALIASES[categoryName] || "Home / Default";
    const src = heroCategoryImages[key] || defaultHeroImage;

    const imgEl =
      document.getElementById("hero-banner-img") ||
      document.querySelector(".hero-visual img");
    if (imgEl) {
      imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = defaultHeroImage; };
      imgEl.src = src;
      imgEl.alt = (categoryName || "Home") + " service visual";
    }

    const catEl =
      document.getElementById("categoryImage") ||
      document.querySelector(".category-model img");
    if (catEl) {
      catEl.onerror = () => { catEl.onerror = null; catEl.src = defaultHeroImage; };
      catEl.src = src;
      catEl.alt = (categoryName || "Home") + " service visual";
    }
  }

  window.heroCategoryImages = heroCategoryImages;
  window.defaultHeroImage = defaultHeroImage;
  window.changeHeroImage = changeHeroImage;

  // ── Orbit carousel services (mirrors the #bookService dropdown) ──
  const ORBIT_SERVICES = [
    {
      service: "Home Cleaning",
      title: "Deep Home Cleaning",
      tag: "Home Cleaning",
      icon: "fa-broom",
      image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80",
      thumb: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=80",
      pro: "Priya Sharma",
      addons: ["Kitchen deep clean", "Sofa shampoo"],
      price: "Starts from ₹199",
    },
    {
      service: "AC Mechanic",
      title: "AC Repair & Service",
      tag: "AC Mechanic",
      icon: "fa-snowflake",
      image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=900&q=80",
      thumb: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=80",
      pro: "Rajesh Kumar",
      addons: ["Powerful AC wash", "Gas top-up"],
    },
    {
      service: "Vehicle Mechanic",
      title: "Vehicle Repair & Service",
      tag: "Vehicle Mechanic",
      icon: "fa-car",
      image: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=900&q=80",
      thumb: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=400&q=80",
      pro: "Vikram Patel",
      addons: ["Engine diagnostic", "Brake inspection"],
    },
    {
      service: "Plumber",
      title: "Plumbing Experts",
      tag: "Plumber",
      icon: "fa-faucet",
      image: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=900&q=80",
      thumb: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=400&q=80",
      pro: "Suresh Reddy",
      addons: ["Leak detection", "Pipe replacement"],
    },
    {
      service: "Electrician",
      title: "Electrical Repairs",
      tag: "Electrician",
      icon: "fa-bolt",
      image: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=80",
      thumb: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=400&q=80",
      pro: "Anil Mehta",
      addons: ["Wiring check", "Switchboard repair"],
    },
  ];
  // ── Hero 3D Circular Orbit Carousel ──
  const ORBIT_INTERVAL = 4000;

  function initOrbitCarousel() {
    const root = $("#orbitCarousel");
    const stage = $("#orbitStage");
    const ring = $("#orbitRing");
    const core = $("#orbitCore");
    if (!root || !stage || !ring) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const unescape = (s) => String(s || "").replace(/&amp;/g, "&");
    // esc() escapes & < > but not quotes, so quote-escape for attribute values.
    const escAttr = (s) => esc(s).replace(/"/g, "&quot;");

    // Build the orbiting nodes from ORBIT_SERVICES so the carousel and the
    // #bookService dropdown stay in sync from a single source of truth.
    if (!ring.childElementCount) {
      ring.innerHTML = ORBIT_SERVICES.map(function (s, i) {
        return (
          '<button type="button" class="orbit-node" data-index="' + i + '"' +
          ' data-service="' + escAttr(s.service) + '"' +
          ' data-title="' + escAttr(s.title) + '"' +
          ' data-tag="' + escAttr(s.tag) + '"' +
          ' data-icon="' + escAttr(s.icon) + '"' +
          ' data-pro="' + escAttr(s.pro) + '"' +
          ' data-addons="' + escAttr(s.addons.join(",")) + '"' +
          ' data-image="' + escAttr(s.image) + '"' +
          ' aria-label="Show ' + escAttr(s.title) + '">' +
          '<img src="' + escAttr(s.thumb) + '" alt="" aria-hidden="true" loading="' + (i === 0 ? "eager" : "lazy") + '">' +
          '<span class="orbit-node-shade"></span>' +
          '<span class="orbit-node-icon"><i class="fas ' + escAttr(s.icon) + '"></i></span>' +
          '<span class="orbit-node-label">' + esc(s.tag) + "</span>" +
          "</button>"
        );
      }).join("");
    }

    // $$ returns a real Array and is scoped to root, so .map() is safe here.
    const nodes = $$(".orbit-node", root);
    if (!Array.isArray(nodes) || nodes.length < 2) return;

    // Presentation mode (?present=1 or #present): strip every interactive
    // affordance so a screenshot/mock-up shows a completely clean view.
    const PRESENT = new URLSearchParams(location.search).has("present") || location.hash === "#present";
    if (PRESENT) document.documentElement.classList.add("is-present");

    // "Book Now" for the active carousel item. Injected from JS so the static
    // markup in index.html and the theme CSS in style.css stay untouched.
    const orbitBookBtn = injectOrbitBookButton(PRESENT);

    function injectOrbitBookButton(present) {
      if (present || !core) return null;
      let btn = document.getElementById("orbitBookBtn");
      if (btn) return btn;
      const overlay = core.querySelector(".orbit-core-overlay");
      if (!overlay) return null;
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "orbitBookBtn";
      btn.className = "btn btn-primary btn-sm";
      btn.setAttribute("data-book-service", "");
      // .orbit-core-overlay is pointer-events:none so the glass stays inert.
      btn.style.pointerEvents = "auto";
      btn.style.marginTop = "14px";
      btn.innerHTML = '<i class="fas fa-calendar-check"></i> Book Now';
      btn.addEventListener("mousedown", (e) => e.stopPropagation());
      btn.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
      overlay.appendChild(btn);
      return btn;
    }

    // Point the injected button at whichever service the slide represents.
    function syncBookButton(d) {
      if (!orbitBookBtn) return;
      const wanted = [d.service, d.title, d.tag].filter(Boolean);
      let svc = null;
      for (let i = 0; i < wanted.length && !svc; i++) {
        const needle = String(wanted[i]).toLowerCase();
        svc = state.services.find((s) => String(s.title).toLowerCase() === needle);
      }
      const name = svc ? svc.title : (wanted[0] || "");
      orbitBookBtn.dataset.serviceId = svc ? String(svc.id) : "";
      orbitBookBtn.dataset.serviceName = name;
      if (svc) {
        const p = servicePricing(svc);
        orbitBookBtn.dataset.price = String(p.amount);
        orbitBookBtn.dataset.bookingType = p.bookingType;
      } else {
        delete orbitBookBtn.dataset.price;
        delete orbitBookBtn.dataset.bookingType;
      }
    }

    // Re-sync once the services list finishes loading (first paint runs earlier).
    window.syncOrbitBookButton = function () { syncBookButton(readNode(active)); };

    const STEP = 360 / nodes.length;
    // With an odd node count, rotate the ring by half a step so one node sits
    // dead centre-bottom and the other four mirror evenly left/right.
    const START_OFFSET = nodes.length % 2 ? STEP / 2 : 0;

    // Ellipse geometry derived from the live stage size.
    function metrics() {
      const w = stage.clientWidth || 560;
      const h = stage.clientHeight || 500;
      const nodeSize = nodes[0] && nodes[0].offsetWidth ? nodes[0].offsetWidth : 120;
      const rx = Math.max(nodeSize * 0.95, Math.min(w * 0.35, h * 0.5));
      const ry = Math.max(nodeSize * 0.5, Math.min(h * 0.28, rx * 0.6));
      return { rx: rx, ry: ry, cx: w / 2, cy: h / 2 };
    }

    let active = 0;
    let timer = null;

    function readNode(i) {
      const n = nodes[i];
      const img = n ? n.querySelector("img") : null;
      return {
        service: unescape(n && n.dataset.service),
        title: unescape(n && n.dataset.title),
        tag: unescape(n && n.dataset.tag),
        icon: (n && n.dataset.icon) || "fa-tools",
        image: (n && n.dataset.image) || (img ? img.src : ""),
        pro: unescape(n && n.dataset.pro) || "Any Available Pro",
        addons: (unescape(n && n.dataset.addons) || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    }

    // Place nodes on the ellipse and rotate the whole ring in 3D via rotateY().
    // Node i sits at angle i*STEP inside the ring; the ring is rotated so the
    // active node always faces the viewer (cos of its world angle = 1).
    function layout() {
      const m = metrics();

      nodes.forEach((node, i) => {
        const base = i * STEP + START_OFFSET;
        const rad = (base * Math.PI) / 180;
        const size = node.offsetWidth || 120;
        node.style.left = (m.cx + Math.cos(rad) * m.rx - size / 2) + "px";
        node.style.top = (m.cy + Math.sin(rad) * m.ry - size / 2) + "px";
      });

      // The 3D spin the arrows drive. Both the nodes and the ring include
      // START_OFFSET, so the active node's world angle is always 0 (front).
      ring.style.transform = "rotateY(" + (-active * STEP - START_OFFSET) + "deg)";
    }

    // Depth cue for every node, based on where it lands after the rotation.
    function depthPass() {
      const m = metrics();
      nodes.forEach((node, i) => {
        const world = ((i - active) * STEP * Math.PI) / 180;
        const cos = Math.cos(world);
        const sin = Math.sin(world);
        const isActive = i === active;

        node.style.opacity = isActive ? "0.2" : cos < -0.15 ? "0" : "1";
        node.style.filter = isActive ? "blur(5px)" : cos > 0.3 ? "blur(1.8px) saturate(0.8)" : "none";
        node.style.transform = "scale(" + (isActive ? 0.6 : 1 - Math.abs(sin) * 0.12).toFixed(3) + ")";
        node.style.zIndex = String(isActive ? 1 : Math.round(20 - (cos + 1) * 8));
        node.classList.toggle("is-active", isActive);
        void m;
      });
    }

    // Swap the core image, curved banner and title on one shared timer.
    function paint(swapImage) {
      const d = readNode(active);
      const delay = reduceMotion ? 0 : 260;

      if (core && d.image) {
        const img = $("#orbitCoreImg");
        if (swapImage && img && img.getAttribute("src") !== d.image) {
          const title = $("#orbitCoreTitle");
          core.classList.add("is-swapping");
          if (title) title.classList.add("is-fading");
          setTimeout(() => {
            img.src = d.image;
            img.alt = d.title;
            core.classList.remove("is-swapping");
            if (title) title.classList.remove("is-fading");
          }, delay);
        }
      }

      const banner = $("#orbitCoreBanner");
      if (banner) banner.textContent = (d.tag || "").toUpperCase();
      const coreTag = $("#orbitCoreTag");
      if (coreTag) coreTag.textContent = d.tag;
      const coreIcon = $("#orbitCoreIcon");
      if (coreIcon) coreIcon.className = "fas " + d.icon;
      const coreTitle = $("#orbitCoreTitle");
      if (coreTitle) coreTitle.textContent = d.title;

      syncBookButton(d);

      if (typeof window.changeHeroImage === "function") window.changeHeroImage(d.tag);

      dots.forEach((dot, i) => {
        const on = i === active;
        dot.classList.toggle("is-active", on);
        dot.setAttribute("aria-selected", on ? "true" : "false");
      });
      nodes.forEach((n, i) => n.setAttribute("aria-current", i === active ? "true" : "false"));
    }

    function goTo(i, userInitiated) {
      active = ((i % nodes.length) + nodes.length) % nodes.length;
      layout();
      depthPass();
      paint(true);
      if (userInitiated) restart();
    }

    function start() {
      if (reduceMotion || timer) return;
      timer = setInterval(() => goTo(active + 1, false), ORBIT_INTERVAL);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    function restart() { stop(); start(); }

    const dotsWrap = $("#orbitDots");
    const dots = nodes.map(function (node, i) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "orbit-dot";
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", "Show " + (unescape(node.dataset.tag) || "service " + (i + 1)));
      if (!PRESENT) dot.addEventListener("click", function () { goTo(i, true); });
      if (dotsWrap) dotsWrap.appendChild(dot);
      return dot;
    });

    const prevBtn = $("#orbitPrev");
    const nextBtn = $("#orbitNext");
    if (prevBtn && !PRESENT) prevBtn.addEventListener("click", function () { goTo(active - 1, true); });
    if (nextBtn && !PRESENT) nextBtn.addEventListener("click", function () { goTo(active + 1, true); });

    if (!PRESENT) {
      nodes.forEach(function (node, i) {
        node.addEventListener("click", function (e) {
          e.stopPropagation();
          goTo(i, true);
        });
      });
    }

    // Drag / swipe horizontally. Axis lock keeps vertical page scrolling intact.
    var dragging = false, startX = 0, startY = 0, deltaX = 0, locked = null;

    function onStart(x, y) {
      dragging = true; startX = x; startY = y; deltaX = 0; locked = null;
      stage.classList.add("is-dragging");
      stop();
    }
    function onMove(x, y, e) {
      if (!dragging) return;
      var dx = x - startX, dy = y - startY;
      if (locked === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (locked === "y") { stopDrag(); return; }
      }
      if (locked !== "x") return;
      if (e && e.cancelable) e.preventDefault();
      deltaX = dx;
    }
    function stopDrag() {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove("is-dragging");
      var steps = Math.round(deltaX / 110);
      if (steps !== 0) goTo(active + steps, true);
      else restart();
      deltaX = 0;
    }

    // Presentation mode skips every pointer/keyboard/drag handler, so nothing
    // can move the carousel while a mock-up is being captured.
    if (!PRESENT) {
      stage.addEventListener("mousedown", function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        onStart(e.clientX, e.clientY);
      });
      window.addEventListener("mousemove", function (e) { onMove(e.clientX, e.clientY, e); });
      window.addEventListener("mouseup", stopDrag);
      stage.addEventListener("touchstart", function (e) {
        onStart(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
      stage.addEventListener("touchmove", function (e) {
        onMove(e.touches[0].clientX, e.touches[0].clientY, e.cancelable ? e : null);
      }, { passive: false });
      stage.addEventListener("touchend", stopDrag);
      stage.addEventListener("touchcancel", stopDrag);

      root.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1, true); }
        if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1, true); }
      });

      root.addEventListener("mouseenter", stop);
      root.addEventListener("mouseleave", start);
      root.addEventListener("focusin", stop);
      root.addEventListener("focusout", start);
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop(); else start();
      });
    }

    var onResize = function () { layout(); depthPass(); };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.addEventListener("load", onResize);

    layout();
    depthPass();
    // Present mode pins the first service (Deep Home Cleaning) and never
    // auto-rotates, so the captured frame is identical on every reload.
    paint(PRESENT);
    if (PRESENT) { goTo(0, false); stop(); } else { start(); }
  }

  window.initOrbitCarousel = initOrbitCarousel;
  const DEFAULT_AVATAR_COLORS = [
    "linear-gradient(135deg, #6c5ce7, #a855f7)",
    "linear-gradient(135deg, #00d2ff, #00f5a0)",
    "linear-gradient(135deg, #fd79a8, #e17055)",
    "linear-gradient(135deg, #feca57, #ff6b6b)",
    "linear-gradient(135deg, #00b894, #00d2ff)",
  ];

  let state = {
    services: [],
    currentCategory: null,
    currentService: null,
    currentWorkers: [],
    currentWorker: null,
    allWorkersMap: {},
    bookingWorker: null,
  };

  const workerMap = {};

  const $ = (sel, root) => (root || document).querySelector(sel);
  // Returns a real Array (so .map/.filter work) and accepts an optional scope root.
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  // ── Utility ──
  const esc = (s) => {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  };

  let toastTimer = null;
  function showToast(message, icon) {
    const toast = $("#toast");
    const text = $("#toastText");
    if (!toast || !text) return;
    const cls = icon || "fa-check-circle";
    toast.classList.remove("is-success", "is-error", "is-info");
    if (/exclamation|times|xmark|ban|triangle|heartbreak/.test(cls)) toast.classList.add("is-error");
    else if (/cloud|qrcode|info|spinner|clock|satellite/.test(cls)) toast.classList.add("is-info");
    else toast.classList.add("is-success");
    const glyph = toast.querySelector(".toast-icon i");
    if (glyph) glyph.className = "fas " + cls;
    text.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
    toast.onclick = () => {
      clearTimeout(toastTimer);
      toast.classList.remove("show");
    };
  }

  function openModal(id) {
    const m = $("#" + id);
    if (!m) return;
    m.classList.remove("closing");
    m.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeModal(id) {
    const m = $("#" + id);
    if (!m) return;
    m.classList.remove("open");
    m.classList.add("closing");
    clearTimeout(m._closeTimer);
    m._closeTimer = setTimeout(() => m.classList.remove("closing"), 320);
    if (!document.querySelector(".modal.open")) document.body.style.overflow = "";
  }

  // ── Admin unread-booking badge ──
  const UNREAD_KEY = "homeease_unread";
  const SEEN_KEY = "homeease_seen_pending";

  function readLocalInt(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? def : (parseInt(v, 10) || 0);
    } catch (e) { return def; }
  }

  function updateAdminBadge(count) {
    const shown = Math.max(0, count || 0);
    try { localStorage.setItem(UNREAD_KEY, String(shown)); } catch (e) { /* ignore */ }
    $$(".admin-notification-badge").forEach((el) => {
      el.textContent = shown > 99 ? "99+" : String(shown);
      el.classList.toggle("hidden", shown <= 0);
    });
  }

  async function refreshAdminBadge() {
    try {
      const res = await fetch(API.bookings + "?status=pending");
      if (!res.ok) return;
      const pending = await res.json();
      const pendingCount = Array.isArray(pending) ? pending.length : 0;
      const seen = readLocalInt(SEEN_KEY, 0);
      updateAdminBadge(pendingCount - seen);
    } catch (e) { /* keep last known badge */ }
  }

  function markBookingCreated() {
    updateAdminBadge(readLocalInt(UNREAD_KEY, 0) + 1);
  }

  function starsHTML(rating, size) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const rounded = Math.round(r * 2) / 2;
    let html = "";
    for (let i = 1; i <= 5; i++) {
      const full = rounded >= i;
      const half = !full && rounded >= i - 0.5;
      html += `<i class="${full ? "fas" : half ? "fas fa-star-half-alt" : "far"} fa-star${half && !full ? " fa-star-half-alt" : ""}"${size ? ` style="font-size:${size}px"` : ""}></i>`;
    }
    return html;
  }

  function avatarHTML(worker, size) {
    if (worker.photo_url) {
      return `<img src="${worker.photo_url}" alt="${esc(worker.name)}" class="worker-photo" style="${size ? `width:${size}px;height:${size}px` : ""}">`;
    }
    const initials = (worker.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    const color = DEFAULT_AVATAR_COLORS[(worker.name || "A").charCodeAt(0) % DEFAULT_AVATAR_COLORS.length];
    return `<div class="worker-photo-placeholder" style="background:${color};${size ? `width:${size}px;height:${size}px;font-size:${size * 0.36}px` : ""}">${esc(initials)}</div>`;
  }

  // ── Navigation ──
  function initNavigation() {
    const navbar = $("#navbar");
    const hamburger = $("#hamburger");
    const mobileMenu = $("#mobileMenu");

    window.addEventListener("scroll", () => {
      navbar.classList.toggle("scrolled", window.scrollY > 40);
    });

    hamburger.addEventListener("click", () => mobileMenu.classList.toggle("open"));

    // Delegated so dynamically-injected dropdown / mobile category links also work.
    document.addEventListener("click", (e) => {
      const link = e.target.closest("[data-nav]");
      if (!link) return;
      e.preventDefault();
      if (link.classList.contains("brand")) {
        changeHeroImage("home");
        navigateTo("home");
        return;
      }
      mobileMenu.classList.remove("open");
      const nav = link.dataset.nav;
      if (nav === "admin") {
        window.location.href = "/admin";
        return;
      }
      navigateTo(nav);
    });

    $("#bookNowBtn").addEventListener("click", () => openBookingModal());
    $("#heroBookBtn").addEventListener("click", () => openBookingModal());
    $("#heroExploreBtn").addEventListener("click", () => {
      navigateTo("services");
    });
  }

  async function navigateTo(navName) {
    if (navName === "home" || navName === "services" || navName === "about" || navName === "contact") {
      state = { ...state, currentCategory: null, currentService: null };
      showMainSection(navName);
      updateNav(navName);
      if (navName === "home") changeHeroImage("home");
      const target = document.getElementById(navName);
      if (target && navName !== "home") target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (navName && navName.startsWith("category-")) {
      const category = navName.replace("category-", "");
      changeHeroImage(category);
      openCategoryPage(category);
      return;
    }
  }

  function showMainSection(id) {
    ["home", "services", "about", "contact", "categoryPage"].forEach((s) => {
      const el = document.getElementById(s);
      if (el) el.classList.toggle("hidden", s !== id);
    });
    const experts = document.getElementById("fieldExperts");
    if (experts) experts.classList.toggle("hidden", !(id === "home" || id === "services"));
  }

  function updateNav(active) {
    $$("[data-nav]").forEach((l) => {
      if (l.classList.contains("brand")) return;
      let on = false;
      if (l.dataset.nav === "admin") on = active === "admin";
      else if (active === "services" || (active && active.indexOf("category-") === 0)) {
        on = l.dataset.nav === "services" || l.dataset.nav === active;
      } else {
        on = l.dataset.nav === active;
      }
      l.classList.toggle("active", on);
    });
  }

  // ── Data Loading ──
  async function fetchServices() {
    const res = await fetch(API.services);
    if (!res.ok) throw new Error("Failed to fetch services");
    state.services = await res.json();
    return state.services;
  }

  async function fetchWorkers(serviceId) {
    let url = API.workers;
    if (serviceId) url += "?service_id=" + encodeURIComponent(serviceId);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch workers");
    return res.json();
  }

  async function fetchReviewCount(workerId) {
    const res = await fetch(API.reviews + "/" + workerId);
    if (!res.ok) return 0;
    const reviews = await res.json();
    return Array.isArray(reviews) ? reviews.length : 0;
  }

  // ── Category Nav (dedicated view router links) ──
  function renderCategoryNav() {
    const desktop = $("#navServicesDropdown");
    const mobile = $("#mobileCategoryNav");
    if (!desktop && !mobile || !state.services.length) return;
    const entries = state.services.map((s) => ({
      nav: "category-" + s.category,
      title: s.title,
      icon: s.icon || FALLBACK_ICONS[s.category] || "fa-wrench",
    }));
    if (desktop) {
      desktop.innerHTML = entries.map((e) =>
        `<a href="#" data-nav="${esc(e.nav)}"><i class="fas ${esc(e.icon)}"></i> ${esc(e.title)}</a>`
      ).join("");
    }
    if (mobile) {
      mobile.innerHTML = entries.map((e) =>
        `<a href="#" data-nav="${esc(e.nav)}">${esc(e.title)}</a>`
      ).join("");
    }
  }

  // ── Render Services ──
  async function renderServices() {
    const grid = $("#servicesGrid");
    grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
      await fetchServices();
      renderCategoryNav();
      if (typeof window.syncOrbitBookButton === "function") window.syncOrbitBookButton();
      grid.innerHTML = "";
      state.services.forEach((service, i) => {
        const icon = service.icon || FALLBACK_ICONS[service.category] || "fa-wrench";
        const pricing = servicePricing(service);
        const card = document.createElement("div");
        card.className = "glass-card service-card";
        card.dataset.category = service.category;
        card.style.animationDelay = (i * 0.08) + "s";
        card.innerHTML = `
          <div class="service-icon"><i class="fas ${esc(icon)}"></i></div>
          <h3 class="service-title">${esc(service.title)}</h3>
          <p class="service-desc">${esc(service.description)}</p>
          <div class="service-footer">
            <span class="service-price">${esc(pricing.label)} <span class="price-tag-inline">${esc(pricing.tag)}</span></span>
            <button type="button" class="service-link-btn service-link" data-category="${esc(service.category)}">View Experts <i class="fas fa-arrow-right"></i></button>
          </div>
          <button type="button"
            class="btn btn-primary btn-sm btn-book-service"
            data-book-service
            data-service-id="${esc(service.id)}"
            data-service-name="${esc(service.title)}"
            data-price="${esc(pricing.amount)}"
            data-booking-type="${esc(pricing.bookingType)}">
            <i class="fas fa-calendar-check"></i> Book Now
          </button>
        `;
        card.addEventListener("click", (e) => {
          // "Book Now" is handled by the delegated modal trigger, not navigation.
          if (e.target.closest("[data-book-service]")) return;
          changeHeroImage(service.title || service.category);
          openCategoryPage(card.dataset.category);
        });
        grid.appendChild(card);
      });
    } catch (err) {
      grid.innerHTML = `<div class="error-msg"><i class="fas fa-exclamation-triangle"></i> ${esc(err.message)}<br><button class="btn btn-primary btn-sm" onclick="location.reload()">Retry</button></div>`;
    }
  }

  // ── Category Page (dedicated service view) ──
  async function openCategoryPage(category, skipScroll) {
    try {
      const service = await (category
        ? fetch(API.services + "/" + encodeURIComponent(category)).then((r) => (r.ok ? r.json() : null))
        : Promise.resolve(null));
      if (!service) throw new Error("Service not found");
      state.currentCategory = category;
      state.currentService = service;

      $("#categoryTitle").textContent = service.title;
      $("#categoryDesc").textContent = service.description;
      const catPricing = servicePricing(service);
      $("#categoryPrice").textContent = catPricing.label;
      const catNote = $("#categoryVisitingNote");
      if (catNote) catNote.classList.toggle("hidden", catPricing.bookingType !== "inspection");

      // Keep the category page "Book Now" button in sync with the displayed service.
      const catBookBtn = $("#categoryPage [data-book-service]");
      if (catBookBtn) {
        catBookBtn.dataset.serviceId = service.id;
        catBookBtn.dataset.serviceName = service.title || "";
        catBookBtn.dataset.price = catPricing.amount;
        catBookBtn.dataset.bookingType = catPricing.bookingType;
      }

      showMainSection("categoryPage");
      updateNav("category-" + category);

      const workers = (await fetchWorkers(service.id))
        .filter((w) => String(w.service_id) === String(service.id));
      state.currentWorkers = workers;
      workerMap[service.id] = workers;
      renderWorkers(workers);
      $("#workerSearch").value = "";
      $("#experienceFilter").value = "";

      changeHeroImage(service.title || category);
      animateCounters();

      const page = $("#categoryPage");
      if (!skipScroll && page) page.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      showToast(err.message, "fa-exclamation-circle");
    }
  }

  // ── Workers ──
  function rateLabel(rate) {
    const n = Number(rate);
    return isFinite(n) && n > 0 ? "$" + n + "/hr" : "—";
  }

  function renderWorkers(workers) {
    const grid = $("#workersGrid");
    grid.innerHTML = "";
    if (!workers.length) {
      grid.innerHTML = `<div class="glass-card empty-state"><i class="fas fa-user-slash" style="font-size:34px;color:var(--text-dim);"></i><p>No workers available yet for this service.</p></div>`;
      return;
    }
    workers.forEach((worker, i) => {
      const card = document.createElement("div");
      card.className = "glass-card worker-card";
      card.style.animationDelay = (i * 0.06) + "s";
      card.innerHTML = `
        <div class="worker-photo-wrap">
          ${avatarHTML(worker)}
          <div class="worker-online"></div>
        </div>
        <h3 class="worker-name">${esc(worker.name)}</h3>
        <div class="worker-phone"><i class="fas fa-phone-alt"></i> <a href="tel:${esc(worker.phone)}">${esc(worker.phone)}</a></div>
        <span class="worker-exp"><i class="fas fa-briefcase"></i> ${esc(worker.experience)} Years Experience</span>
        ${worker.skill ? `<span class="worker-skill"><i class="fas fa-award"></i> ${esc(worker.skill)} · Level ${esc(worker.skill_level)}</span>` : ""}
        <span class="worker-rate"><i class="fas fa-tag"></i> ${rateLabel(worker.hourly_rate)}</span>
        <div class="rating-display">
          <span class="stars">${starsHTML(worker.rating)}</span>
          <span class="rating-value">${Number(worker.rating).toFixed(1)}</span>
          <span class="rating-count" data-worker-id="${worker.id}"></span>
        </div>
        <div class="worker-actions">
          <button class="btn btn-primary btn-sm book-worker" data-worker-id="${worker.id}"><i class="fas fa-calendar-check"></i> Book Worker</button>
          <button class="btn btn-glass btn-sm view-worker" data-worker-id="${worker.id}"><i class="fas fa-user"></i> Details</button>
          <button class="btn btn-glass btn-sm view-id-card" data-worker-id="${worker.id}"><i class="fas fa-id-card"></i> ID Card</button>
        </div>
      `;
      const ratingCount = card.querySelector(".rating-count");
      fetchReviewCount(worker.id).then((n) => {
        ratingCount.textContent = `(${n} reviews)`;
      }).catch(() => { ratingCount.textContent = ""; });
      card.querySelector(".book-worker").addEventListener("click", () => openBookingModal(worker));
      card.querySelector(".view-worker").addEventListener("click", () => openWorkerModal(worker));
      card.querySelector(".view-id-card").addEventListener("click", () => openIdCard(worker));
      grid.appendChild(card);
    });
  }

  function applyWorkerFilters() {
    if (!state.currentWorkers) return;
    const term = $("#workerSearch").value.trim().toLowerCase();
    const expFilter = $("#experienceFilter").value;
    let filtered = [...state.currentWorkers];
    if (term) filtered = filtered.filter((w) => w.name.toLowerCase().includes(term));
    if (expFilter === "high") filtered = filtered.filter((w) => w.experience >= 5);
    if (expFilter === "low") filtered = filtered.filter((w) => w.experience < 5);
    renderWorkers(filtered);
  }

  // ── Homepage Field Experts ──
  async function renderHomeExperts() {
    const grid = $("#homeWorkersGrid");
    if (!grid) return;
    grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
      if (!state.services.length) await fetchServices();
      const workers = (await fetchWorkers()).filter((w) => w.status !== "inactive");
      const byService = {};
      workers.forEach((w) => {
        if (String(w.service_id)) {
          const svc = state.services.find((s) => String(s.id) === String(w.service_id));
          if (svc) {
            (byService[svc.id] = byService[svc.id] || { service: svc, workers: [] }).workers.push(w);
          }
        }
      });
      grid.innerHTML = "";
      const groups = Object.values(byService);
      if (!groups.length) {
        grid.innerHTML = `<div class="glass-card empty-state" style="text-align:center;padding:40px;"><i class="fas fa-user-slash" style="font-size:34px;color:var(--text-dim);"></i><p>No experts available yet. Check back soon!</p></div>`;
        return;
      }
      groups.forEach((group) => {
        const svc = group.service;
        const groupEl = document.createElement("div");
        groupEl.className = "experts-group";
        const head = document.createElement("div");
        head.className = "experts-group-head";
        head.innerHTML = `
          <div>
            <span class="experts-group-title"><i class="fas fa-tools"></i> ${esc(svc.title)}</span>
            <span class="experts-group-count">${group.workers.length} ${group.workers.length === 1 ? "expert" : "experts"}</span>
          </div>
          <button class="btn btn-glass btn-sm experts-group-link" data-category="${esc(svc.category)}"><i class="fas fa-arrow-right"></i> View ${esc(svc.title)}</button>
          <button type="button"
            class="btn btn-primary btn-sm btn-book-service"
            data-book-service
            data-service-id="${esc(svc.id)}"
            data-service-name="${esc(svc.title)}"
            data-price="${esc(servicePricing(svc).amount)}"
            data-booking-type="${esc(servicePricing(svc).bookingType)}">
            <i class="fas fa-calendar-check"></i> Book Now
          </button>
        `;
        const inner = document.createElement("div");
        inner.className = "workers-grid";
        group.workers.forEach((worker, i) => {
          const card = document.createElement("div");
          card.className = "glass-card worker-card";
          card.style.animationDelay = (i * 0.06) + "s";
          card.innerHTML = `
            <div class="worker-photo-wrap">
              ${avatarHTML(worker)}
              <div class="worker-online"></div>
            </div>
            <h3 class="worker-name">${esc(worker.name)}</h3>
            <div class="worker-phone"><i class="fas fa-phone-alt"></i> <a href="tel:${esc(worker.phone)}">${esc(worker.phone)}</a></div>
            <span class="worker-exp"><i class="fas fa-briefcase"></i> ${esc(worker.experience)} Years Experience</span>
            ${worker.skill ? `<span class="worker-skill"><i class="fas fa-award"></i> ${esc(worker.skill)} · Level ${esc(worker.skill_level)}</span>` : ""}
            <span class="worker-rate"><i class="fas fa-tag"></i> ${rateLabel(worker.hourly_rate)}</span>
            <div class="rating-display">
              <span class="stars">${starsHTML(worker.rating)}</span>
              <span class="rating-value">${Number(worker.rating).toFixed(1)}</span>
            </div>
            <div class="worker-actions">
              <button class="btn btn-primary btn-sm book-home-worker" data-worker-id="${worker.id}"><i class="fas fa-calendar-check"></i> Book Worker</button>
              <button class="btn btn-glass btn-sm view-home-worker" data-worker-id="${worker.id}"><i class="fas fa-user"></i> View Details</button>
            </div>
          `;
          card.querySelector(".book-home-worker").addEventListener("click", () => openBookingModal(worker));
          card.querySelector(".view-home-worker").addEventListener("click", () => {
            state.currentService = svc;
            openWorkerModal(worker);
          });
          inner.appendChild(card);
        });
        head.querySelector(".experts-group-link").addEventListener("click", () => openCategoryPage(svc.category));
        groupEl.appendChild(head);
        groupEl.appendChild(inner);
        grid.appendChild(groupEl);
      });
    } catch (err) {
      grid.innerHTML = `<div class="error-msg"><i class="fas fa-exclamation-triangle"></i> ${esc(err.message)}<br><button class="btn btn-primary btn-sm" onclick="location.reload()">Retry</button></div>`;
    }
  }

  // ── Worker Modal ──
  async function openWorkerModal(worker) {
    state.currentWorker = worker;
    if (!state.currentService || String(state.currentService.id) !== String(worker.service_id)) {
      state.currentService = state.services.find((s) => String(s.id) === worker.service_id) || state.currentService;
    }
    const detail = $("#workerDetail");
    detail.innerHTML = `
      ${avatarHTML(worker, 100)}
      <div class="worker-detail-info">
        <h3>${esc(worker.name)}</h3>
        <p><i class="fas fa-phone-alt"></i> ${esc(worker.phone)}</p>
        <p><i class="fas fa-briefcase"></i> ${esc(worker.experience)} Years Experience</p>
        <div class="rating-display" style="justify-content:flex-start;margin:8px 0 0;">
          <span class="stars">${starsHTML(worker.rating)}</span>
          <span class="rating-value">${Number(worker.rating).toFixed(1)}</span>
        </div>
      </div>
    `;
    openModal("workerModal");
    loadReviews(worker.id);
    setupStarInput();
  }

  async function loadReviews(workerId) {
    const list = $("#reviewList");
    list.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
      const res = await fetch(API.reviews + "/" + workerId);
      const reviews = await res.json();
      list.innerHTML = "";
      if (!Array.isArray(reviews) || !reviews.length) {
        list.innerHTML = `<p style="color:var(--text-dim);font-size:13px;text-align:center;">No reviews yet. Be the first to review!</p>`;
        return;
      }
      reviews.forEach((review) => {
        const item = document.createElement("div");
        item.className = "review-item";
        item.innerHTML = `
          <div class="review-item-head">
            <span class="review-item-name">${esc(review.user_name)}</span>
            <span class="review-item-stars">${starsHTML(review.rating, 12)}</span>
          </div>
          ${review.comment ? `<p class="review-item-text">${esc(review.comment)}</p>` : ""}
        `;
        list.appendChild(item);
      });
    } catch (err) {
      list.innerHTML = `<p style="color:var(--danger);font-size:13px;">Failed to load reviews.</p>`;
    }
  }

  function setupStarInput() {
    const stars = $$("#starInput .star");
    const hidden = $("#reviewRating");
    stars.forEach((s) => {
      s.addEventListener("mouseenter", () => {
        const val = Number(s.dataset.val);
        stars.forEach((x) => x.classList.toggle("active", Number(x.dataset.val) <= val));
      });
      s.addEventListener("click", () => {
        const val = Number(s.dataset.val);
        hidden.value = val;
        stars.forEach((x) => x.classList.toggle("active", Number(x.dataset.val) <= val));
      });
    });
  }

  // ── ID Card ──
  function openIdCard(worker) {
    const content = $("#idCardContent");
    const role = state.currentService?.title || "Service Professional";
    const initials = (worker.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    const photoHTML = worker.photo_url
      ? `<img src="${worker.photo_url}" alt="${esc(worker.name)}" class="id-card-photo">`
      : `<div class="id-card-photo-placeholder">${esc(initials)}</div>`;
    const idCardHTML = `
      <div class="id-card">
        <div class="id-card-top">
          <div class="id-card-brand"><i class="fas fa-hand-sparkles"></i> HomeEase</div>
          <div class="id-card-chip"></div>
        </div>
        <div class="id-card-body">
          ${photoHTML}
          <div class="id-card-info">
            <div class="id-card-name">${esc(worker.name)}</div>
            <div class="id-card-role">${esc(role)}</div>
            <div class="id-card-info-row"><i class="fas fa-id-badge"></i> <span>ID:</span> ${esc(String(worker.id).slice(0, 8).toUpperCase())}</div>
            <div class="id-card-info-row"><i class="fas fa-phone-alt"></i> <span>${esc(worker.phone)}</span></div>
            <div class="id-card-info-row"><i class="fas fa-briefcase"></i> <span>${esc(worker.experience)} years exp.</span></div>
            <div class="id-card-info-row"><i class="fas fa-star"></i> <span>${Number(worker.rating).toFixed(1)} / 5.0</span></div>
          </div>
        </div>
        <div class="id-card-bottom">
          <div class="id-card-barcode">
            <svg viewBox="0 0 160 44" width="160" height="44">
              <g fill="#b8c4d8" opacity="0.6" transform="scale(0.5)">
                ${Array.from({ length: 40 }, (_, i) => {
                  const col = i % 3 === 0 ? 6 : i % 3 === 1 ? 3 : 8;
                  return `<rect x="${i * 8}" y="0" width="${col}" height="88" rx="1"/>`;
                }).join("")}
              </g>
            </svg>
          </div>
          <div class="id-card-verified">
            <i class="fas fa-shield-alt"></i>
            <span>VERIFIED PRO</span>
          </div>
        </div>
      </div>
    `;
    content.innerHTML = idCardHTML;
    openModal("idCardModal");
  }

  // ── Booking ──
  function buildUpiUri(totalAmount, bookingId) {
    return (
      "upi://pay?pa=" + UPI_CONFIG.upiId +
      "&pn=" + encodeURIComponent(UPI_CONFIG.payeeName) +
      "&am=" + String(totalAmount) +
      "&cu=INR" +
      "&tn=" + encodeURIComponent("Booking #" + (bookingId || pendingBookingRef))
    );
  }

  let currentUpiUri = "";
  let currentUpiAmount = 0;

  function openCheckoutModal(serviceName, totalAmount, bookingId) {
    const upiUri = buildUpiUri(totalAmount, bookingId);
    currentUpiUri = upiUri;
    currentUpiAmount = Number(totalAmount) || 0;

    const intentBtn = document.getElementById("upi-intent-btn");
    if (intentBtn) intentBtn.href = upiUri;

    const priceEl = document.getElementById("summary-total-price");
    if (priceEl) priceEl.textContent = totalAmount;

    const pickerAmount = document.getElementById("app-picker-amount");
    if (pickerAmount) pickerAmount.textContent = totalAmount;

    const qrImg = document.getElementById("upi-qr-code");
    if (qrImg) {
      qrImg.src = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" +
        encodeURIComponent(upiUri);
      qrImg.alt = "Scan & Pay UPI QR";
      qrImg.onerror = () => { qrImg.onerror = null; qrImg.alt = "UPI QR unavailable"; };
    }
  }
  window.openCheckoutModal = openCheckoutModal;

  function currentPaymentMethod() {
    const el = document.querySelector('input[name="payment-method"]:checked');
    return el ? el.value : "upi";
  }

  function syncPaymentMethod() {
    const isUpi = currentPaymentMethod() === "upi";
    $$(".upi-online-only").forEach((el) => el.classList.toggle("upi-hidden", !isUpi));
    const utr = $("#upi-utr-number");
    if (utr) {
      // required ONLY while the field is visible; cleared entirely for Hand Cash
      utr.required = isUpi;
      utr.setAttribute("aria-required", isUpi ? "true" : "false");
      if (!isUpi) utr.value = "";
    }
  }
  window.syncPaymentMethod = syncPaymentMethod;

  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  window.isMobileDevice = isMobileDevice;

  function mobileUpiUri() {
    return (
      "upi://pay?pa=" + UPI_CONFIG.upiId +
      "&pn=" + encodeURIComponent(UPI_CONFIG.payeeName) +
      "&am=" + String(currentUpiAmount || 0) +
      "&cu=INR"
    );
  }

  function updateBookingSummary() {
    const select = $("#bookService");
    const service = select ? findService(select.value) : null;
    const pricing = servicePricing(service);
    const servicePrice = service ? Number(pricing.amount) || 0 : 0;
    const isInspection = !!(service && pricing.bookingType === "inspection");
    const workerName = state.bookingWorker && state.bookingWorker.name
      ? state.bookingWorker.name
      : "Any Available / Unassigned";
    const priceSuffix = isInspection ? " Visiting Fee" : "";

    $("#summaryServiceValue").textContent = service
      ? service.title + " (₹" + servicePrice + priceSuffix + ")"
      : "—";
    $("#summaryDate").textContent = $("#bookDate").value || "—";
    $("#summaryTime").textContent = $("#bookTime").value || "—";
    $("#summaryTotal").textContent = "₹" + servicePrice;
    const workerEl = $("#summaryWorker");
    if (workerEl) workerEl.textContent = service ? "Assigned Pro: " + workerName : "";
    const feeNote = $("#visitingFeeNote");
    if (feeNote) feeNote.classList.toggle("hidden", !isInspection);
    openCheckoutModal(service ? service.title : "", servicePrice, pendingBookingRef);
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function collectBookingPayload() {
    const serviceId = $("#bookService").value;
    const service = findService(serviceId);
    if (!service) { showToast("Please select a service.", "fa-exclamation-circle"); return null; }
    const date = $("#bookDate").value;
    const time = $("#bookTime").value;
    const name = $("#bookName").value.trim();
    const email = $("#bookEmail").value.trim();
    const phone = $("#bookPhone").value.trim();
    const address = $("#bookAddress").value.trim();
    const notes = $("#bookNotes").value.trim();
    if (!date) { showToast("Please choose a date.", "fa-exclamation-circle"); return null; }
    if (date < todayISO()) { showToast("Please choose a date from today onwards.", "fa-exclamation-circle"); return null; }
    if (!time) { showToast("Please choose a time slot.", "fa-exclamation-circle"); return null; }
    if (!name) { showToast("Please enter your name.", "fa-exclamation-circle"); return null; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("Please enter a valid email address.", "fa-exclamation-circle"); return null;
    }
    if (!phone) { showToast("Please enter your phone number.", "fa-exclamation-circle"); return null; }
    if ((phone.match(/\d/g) || []).length < 10) {
      showToast("Please enter a valid 10-digit phone number.", "fa-exclamation-circle"); return null;
    }
    if (!address) { showToast("Please enter your address.", "fa-exclamation-circle"); return null; }
    const bkWorker = state.bookingWorker || null;
    const pricing = servicePricing(service);
    return {
      service_id: service.id,
      worker_id: bkWorker ? bkWorker.id : null,
      worker_name: bkWorker && bkWorker.name ? bkWorker.name : "Any Available / Unassigned",
      booking_date: date,
      booking_time: time,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      address: address,
      notes: notes,
      amount: pricing.amount,
      service_name: service.title,
      visiting_fee: pricing.visitingFee,
      booking_type: pricing.bookingType,
      status: "pending",
    };
  }

  function readLocalBookings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  window.getHomeEaseBookings = readLocalBookings;

  function saveCustomerProfile(booking) {
    try {
      localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify({
        customer_name: booking.customer_name || "",
        customer_email: booking.customer_email || "",
        customer_phone: booking.customer_phone || "",
        address: booking.address || "",
      }));
    } catch (e) { /* profile is a convenience only */ }
  }

  // Re-fills name / email / phone / address for returning customers.
  function prefillCustomerFields() {
    let profile = null;
    try { profile = JSON.parse(localStorage.getItem(CUSTOMER_PROFILE_KEY) || "null"); } catch (e) { profile = null; }
    if (!profile) return;
    const fill = (sel, val) => {
      const el = $(sel);
      if (el && !el.value && val) el.value = val;
    };
    fill("#bookName", profile.customer_name);
    fill("#bookEmail", profile.customer_email);
    fill("#bookPhone", profile.customer_phone);
    fill("#bookAddress", profile.address);
  }

  // Writes the booking details object to LocalStorage under 'homeEaseBookings'.
  // Re-submitting the same booking ref updates the record instead of duplicating it.
  function saveBookingToLocalStorage(booking) {
    try {
      const existing = readLocalBookings();
      const record = Object.assign({
        id: Date.now(),
        booking_ref: booking.booking_ref || pendingBookingRef || ("HOME-" + Date.now().toString().slice(-6)),
        createdAt: new Date().toISOString(),
      }, booking);
      const idx = existing.findIndex((b) => b && b.booking_ref && b.booking_ref === record.booking_ref);
      if (idx >= 0) existing[idx] = Object.assign({}, existing[idx], record);
      else existing.push(record);
      localStorage.setItem(BOOKINGS_KEY, JSON.stringify(existing));
      saveCustomerProfile(booking);
      return record;
    } catch (e) {
      console.warn("Failed to save booking to localStorage:", e);
      return null;
    }
  }

  async function saveBooking(payload) {
    const res = await fetch(API.bookings, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to save booking. Please try again.");
    return res.json();
  }

  function dispatchWeb3Forms(payload) {
    if (!WEB3FORMS_ACCESS_KEY || WEB3FORMS_ACCESS_KEY.indexOf("REPLACE") === 0) return Promise.resolve();
    const placedAt = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).replace(",", ",");
    const body = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: "New HomeEase Booking Request",
      from_name: "HomeEase",
      type: "Booking Request",
      customer_name: payload.customer_name,
      customer_email: payload.customer_email || "",
      customer_phone: payload.customer_phone,
      service: payload.service_name,
      technician: payload.worker_name || "Any Available / Unassigned",
      booking_date: payload.booking_date,
      booking_time: payload.booking_time,
      booking_slot: payload.booking_date + " " + payload.booking_time,
      address: payload.address || "—",
      notes: payload.notes || "—",
      amount: "₹" + payload.amount,
      currency: "INR",
      booking_type: payload.booking_type || "fixed",
      visiting_fee: "₹" + (payload.visiting_fee || 0),
      utr_number: payload.utr_number || "—",
      payment_status: payload.payment_status || "Pending UTR Verification",
      payment_method: payload.payment_method || "UPI",
      booking_ref: payload.booking_ref || pendingBookingRef,
      booking_placed_at: placedAt,
    };
    return fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()).then((data) => {
      if (!data.success) throw new Error(data.message || "Email delivery failed.");
    }).catch(() => { /* Non-blocking: booking is already saved locally. */ });
  }

  function showBookingSuccess(ref, payload) {
    const refEl = $("#successRef");
    if (refEl) refEl.textContent = "REF: " + (ref || pendingBookingRef || "HOME-0000");
    const msg = $("#successMsg");
    if (msg) {
      msg.textContent = payload
        ? payload.service_name + " scheduled for " + payload.booking_date + " at " + payload.booking_time + "."
        : "Your booking is placed.";
    }
    $("#bookingForm").classList.add("hidden");
    $("#bookingSuccess").classList.remove("hidden");
  }

  async function submitBooking(e) {
    e.preventDefault();
    const payload = collectBookingPayload();
    if (!payload) return;

    const isUpi = currentPaymentMethod() === "upi";
    const utrInput = $("#upi-utr-number");
    const utr = isUpi && utrInput ? utrInput.value.trim() : "";
    if (isUpi && !/^\d{12}$/.test(utr)) {
      showToast("Please enter a valid 12-digit UPI Ref / UTR number.", "fa-exclamation-circle");
      if (utrInput) utrInput.focus();
      return;
    }
    payload.utr_number = utr || "—";
    payload.payment_method = isUpi ? "UPI" : "Cash on Delivery";
    payload.payment_status = isUpi ? "Pending UTR Verification" : "Pending Payment";
    payload.booking_ref = pendingBookingRef || ("HOME-" + Date.now().toString().slice(-6));
    payload.placed_at = new Date().toISOString();

    // 1) Always persist locally first so the booking survives an offline API.
    const saved = saveBookingToLocalStorage(payload);
    const ref = (saved && saved.booking_ref) || payload.booking_ref;
    payload.booking_ref = ref;
    pendingBookingRef = ref;

    const btn = $("#confirm-booking-btn");
    const btnIdleHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add("is-loading");
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...';
    setBookingStatus("Saving your booking…");
    let serverSaved = false;
    try {
      // 2) Server copy (admin dashboard).
      await saveBooking(payload);
      serverSaved = true;
      setBookingStatus("Sending confirmation…");
    } catch (err) {
      showToast("Booking saved on this device — we will sync it shortly.", "fa-cloud");
    }
    try {
      await dispatchWeb3Forms(payload);
    } catch (err) { /* email is non-blocking */ }

    if (serverSaved) markBookingCreated();
    showBookingSuccess(ref, payload);
    e.target.reset();
    $("#bookDate").min = todayISO();
    syncPaymentMethod();
    updateBookingSummary();
    setBookingStatus("");
    btn.disabled = false;
    btn.classList.remove("is-loading");
    btn.innerHTML = btnIdleHtml;
  }

  // Small inline status pill above the confirm button while a booking is
  // being saved / confirmed. Empty message hides it.
  function setBookingStatus(msg) {
    const el = $("#bookingStatus");
    if (!el) return;
    if (!msg) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    el.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${esc(msg)}</span>`;
    el.classList.remove("hidden");
  }


  // Normalises whatever the caller passes (service id string, trigger object
  // from a Book Now button, or nothing) into one shape.
  function normalizeTrigger(trigger) {
    if (!trigger) return {};
    if (typeof trigger === "string") return { serviceId: trigger };
    return {
      serviceId: trigger.serviceId || trigger.service_id || "",
      serviceName: trigger.serviceName || trigger.service_name || "",
      price: trigger.price,
      bookingType: trigger.bookingType || trigger.booking_type || "",
    };
  }

  // Reads a Book Now button (service card, experts group, category page or
  // carousel item) into a trigger object for the booking modal.
  function readBookTrigger(btn) {
    const data = (btn && btn.dataset) || {};
    const trigger = {
      serviceId: data.serviceId || "",
      serviceName: data.serviceName || "",
      price: data.price !== undefined && data.price !== "" ? Number(data.price) : NaN,
      bookingType: data.bookingType === "inspection" ? "inspection" : (data.bookingType === "fixed" ? "fixed" : ""),
    };
    if (!trigger.serviceId && !trigger.serviceName) {
      if (state.currentService) trigger.serviceId = state.currentService.id;
      else return null;
    }
    return trigger;
  }

  async function openBookingModal(worker, trigger) {
    const opts = normalizeTrigger(trigger);
    state.bookingWorker = worker
      ? { id: worker.id, name: worker.name || "", service_id: worker.service_id }
      : null;
    pendingBookingRef = "HOME-" + Date.now().toString().slice(-6);

    // Reset payment state for every fresh modal open.
    const utrInput = $("#upi-utr-number");
    if (utrInput) utrInput.value = "";
    const upiRadio = $$('input[name="payment-method"]').find((r) => r.value === "upi");
    if (upiRadio) upiRadio.checked = true;
    syncPaymentMethod();

    // Rebuild the service dropdown, then pre-select the clicked service.
    const select = $("#bookService");
    select.innerHTML = '<option value="">Select a service...</option>';
    $("#bookingForm").classList.remove("hidden");
    $("#bookingSuccess").classList.add("hidden");
    try {
      const services = state.services.length ? state.services : await fetchServices();
      Array.isArray(services) && services.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.title;
        select.appendChild(opt);
      });
    } catch (err) {
      showToast(err.message, "fa-exclamation-circle");
    }

    // Resolution order: explicit id → clicked label → worker's service →
    // offline ad-hoc entry → service currently on screen.
    const hasTrigger = !!(opts.serviceId || opts.serviceName);
    let service = null;
    if (opts.serviceId) service = findService(opts.serviceId);
    if (!service && opts.serviceName) service = findService(opts.serviceName);
    if (!service && worker && worker.service_id) service = findService(worker.service_id);
    if (!service && opts.serviceName) service = registerAdhocService(opts.serviceName, opts.price, opts.bookingType);
    if (!service && hasTrigger && state.currentService) service = findService(state.currentService.id) || state.currentService;

    if (service) {
      if (!Array.prototype.some.call(select.options, (o) => String(o.value) === String(service.id))) {
        const opt = document.createElement("option");
        opt.value = service.id;
        opt.textContent = service.title;
        select.appendChild(opt);
      }
      select.value = service.id;
      if (!service.__adhoc) state.currentService = service;

      const price = Number(opts.price);
      if (Number.isFinite(price) && price > 0) {
        const current = servicePricing(service);
        const type = opts.bookingType === "inspection" || opts.bookingType === "fixed"
          ? opts.bookingType
          : (current.amount === price ? current.bookingType : "fixed");
        setServicePriceOverride(service.id, price, type);
      }
    } else {
      select.value = "";
    }

    // Date field: no past bookings, and drop anything stale.
    const dateInput = $("#bookDate");
    const today = todayISO();
    dateInput.min = today;
    if (dateInput.value && dateInput.value < today) dateInput.value = "";

    prefillCustomerFields();
    updateBookingSummary();
    openModal("bookingModal");
  }
  window.openBookingModal = openBookingModal;

  // ── Init Event Listeners ──
  function initEvents() {
    $$(".modal-close").forEach((btn) => btn.addEventListener("click", () => closeModal(btn.dataset.close)));
    $$(".modal-backdrop").forEach((bd) => bd.addEventListener("click", () => {
      const modal = bd.closest(".modal");
      if (modal) closeModal(modal.id);
    }));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $$(".modal.open").forEach((m) => closeModal(m.id));
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      if (state.currentCategory) {
        openCategoryPage(state.currentCategory, true);
      } else {
        renderHomeExperts();
      }
    });

    $("#backBtn").addEventListener("click", () => {
      navigateTo("services");
    });

    $("#workerSearch").addEventListener("input", applyWorkerFilters);
    $("#experienceFilter").addEventListener("change", applyWorkerFilters);

    $("#bookingForm").addEventListener("submit", submitBooking);

    $("#bookService").addEventListener("change", updateBookingSummary);

    // ── Form input management ──
    // Live Order Summary while typing/selecting, plus light input sanitising.
    const phoneInput = $("#bookPhone");
    if (phoneInput) {
      phoneInput.addEventListener("input", () => {
        const cleaned = phoneInput.value.replace(/[^\d+\-() ]/g, "");
        if (cleaned !== phoneInput.value) phoneInput.value = cleaned;
      });
    }
    const emailInput = $("#bookEmail");
    if (emailInput) {
      emailInput.addEventListener("blur", () => {
        const trimmed = emailInput.value.trim();
        if (trimmed !== emailInput.value) emailInput.value = trimmed;
      });
    }

    // ── Delegated "Book Now" handler: service cards, experts groups,
    //    category page and carousel items all share one trigger path. ──
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-book-service]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const trigger = readBookTrigger(btn);
      if (!trigger) {
        showToast("Please pick a service from the list.", "fa-exclamation-circle");
        return;
      }
      openBookingModal(null, trigger);
    });

    $$('input[name="payment-method"]').forEach((r) => r.addEventListener("change", syncPaymentMethod));

    $("#upi-intent-btn").addEventListener("click", (e) => {
      e.preventDefault();
      if (!currentUpiUri) {
        showToast("Please select a service to see payment options.", "fa-exclamation-circle");
        return;
      }
      openModal("upiAppModal");
    });

    function launchUpiApp() {
      closeModal("upiAppModal");
      if (!currentUpiUri) {
        showToast("Please select a service to see payment options.", "fa-exclamation-circle");
        return;
      }
      if (!isMobileDevice()) {
        showToast("Please scan the QR Code on the left using your Google Pay / PhonePe app to complete payment.", "fa-qrcode");
        return;
      }
      window.location.href = mobileUpiUri();
    }
    $("#app-gpay").addEventListener("click", launchUpiApp);
    $("#app-phonepe").addEventListener("click", launchUpiApp);

    $("#bookDate").addEventListener("change", updateBookingSummary);
    $("#bookTime").addEventListener("change", updateBookingSummary);

    $("#bookingSuccessDone").addEventListener("click", () => {
      state.bookingWorker = null;
      closeModal("bookingModal");
      $("#bookingSuccess").classList.add("hidden");
      $("#bookingForm").classList.remove("hidden");
      const utr = $("#upi-utr-number");
      if (utr) utr.value = "";
      syncPaymentMethod();
      updateBookingSummary();
    });

    $("#reviewForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.currentWorker) return;
      const rating = parseInt($("#reviewRating").value || 0, 10);
      const userName = $("#reviewName").value;
      const comment = $("#reviewComment").value;
      if (!rating) {
        showToast("Please select a star rating first!", "fa-exclamation-circle");
        return;
      }
      try {
        const res = await fetch(API.reviews, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ worker_id: state.currentWorker.id, user_name: userName, rating, comment }),
        });
        if (!res.ok) throw new Error("Failed to submit review");
        showToast("Thanks for your review!", "fa-star");
        e.target.reset();
        $("#reviewRating").value = 0;
        $$("#starInput .star").forEach((s) => s.classList.remove("active"));
        loadReviews(state.currentWorker.id);
        // Refresh worker rating display
        openWorkerModal(await (await fetch(API.workers + "/" + state.currentWorker.id)).json());
        renderWorkers(state.currentWorkers);
      } catch (err) {
        showToast(err.message, "fa-exclamation-circle");
      }
    });
  }

  // ── Counters ──
  function animateCounters() {
    $$(".stat-num").forEach((el) => {
      if (el.dataset.animated) return;
      el.dataset.animated = "1";
      const target = Number(el.dataset.count);
      const decimals = Number(el.dataset.decimals || 0);
      const duration = 1600;
      const start = performance.now();
      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = (target * eased).toFixed(decimals);
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  // Expoze admin renderer hook
  window.renderMainApp = async function () {
    showMainSection("home");
    updateNav("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderServices();
    renderHomeExperts();
    changeHeroImage("home");
    animateCounters();
  };

  // ── Boot ──
  document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initEvents();
    renderServices();
    renderHomeExperts();
    changeHeroImage("home");
    initOrbitCarousel();
    animateCounters();

    refreshAdminBadge();
    window.addEventListener("storage", (e) => {
      if (e.key === UNREAD_KEY) updateAdminBadge(parseInt(e.newValue, 10) || 0);
      if (e.key === SEEN_KEY) refreshAdminBadge();
    });
    setInterval(refreshAdminBadge, 30000);
  });
})();
