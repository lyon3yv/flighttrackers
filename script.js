document.addEventListener("DOMContentLoaded", () => {
  const introEl = document.getElementById("intro");
  const navbar = document.getElementById("navbar");
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|Windows Phone/i.test(navigator.userAgent);
  const INTRO_TOTAL_MS = isMobile ? 6200 : 15000;

  const el = document.getElementById("counter");
  window.startMembersCounter = function () {
    const target = 53;
    let current = 0;
    const stepTime = 40;
    const step = () => {
      if (current < target) {
        current++;
        el.textContent = current;
        setTimeout(step, stepTime);
      } else el.textContent = target;
    };
    step();
  };

  function showNavbarAndHideIntro() {
    if (introEl) introEl.style.display = "none";
    navbar?.classList.add("show");
    if (typeof window.startMembersCounter === "function") window.startMembersCounter();
  }

  // Check if intro has been seen before
  const hasSeenIntro = localStorage.getItem('hasSeenIntro');

  if (hasSeenIntro) {
    // Skip intro, show navbar immediately
    showNavbarAndHideIntro();
  } else {
    // Show intro and set flag after it ends
    if (introEl) {
      introEl.addEventListener("animationend", (e) => {
        if (e.animationName === "fadeOut") {
          localStorage.setItem('hasSeenIntro', 'true');
          showNavbarAndHideIntro();
        }
      });
    }
    setTimeout(() => {
      localStorage.setItem('hasSeenIntro', 'true');
      showNavbarAndHideIntro();
    }, INTRO_TOTAL_MS + 800);
  }

  if (!introEl) {
    navbar?.classList.add("show");
    window.startMembersCounter();
  }

  const form = document.getElementById("joinForm");
  const status = document.getElementById("estado");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.textContent = "Enviando...";
      const formData = new FormData(form);
      const payload = {};
      formData.forEach((v, k) => (payload[k] = v));
      const edad = parseInt(payload.edad, 10);
      if (isNaN(edad) || edad < 11 || edad > 25) {
        status.textContent = "La edad debe ser entre 11 y 25 años.";
        return;
      }
      try {
        const res = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          status.textContent = "¡Solicitud enviada! Pronto recibirás respuesta.";
          form.reset();
        } else {
          status.textContent = data.message || "Error al enviar.";
        }
      } catch {
        status.textContent = "Error de conexión.";
      }
    });
  }

  const galleryGrid = document.getElementById("galleryGrid");
  if (galleryGrid) {
    fetch("/api/gallery")
      .then((res) => res.json())
      .then((images) => {
        if (!images || images.length === 0) {
          galleryGrid.innerHTML =
            "<p style='text-align:center;font-size:1.2em;color:#555;'>No hay fotos publicadas aún 📭</p>";
          return;
        }
        galleryGrid.innerHTML = images
          .map(
            (img) => `
            <div class="gallery-item">
              <img src="${img.url}" alt="${img.name}" loading="lazy">
            </div>`
          )
          .join("");
        const lightbox = document.createElement("div");
        lightbox.className = "lightbox";
        lightbox.innerHTML = `
          <span class="close">&times;</span>
          <img id="lightboxImg" src="" alt="">
        `;
        document.body.appendChild(lightbox);
        const lightboxImg = lightbox.querySelector("img");
        const closeBtn = lightbox.querySelector(".close");
        galleryGrid.querySelectorAll("img").forEach((image) => {
          image.addEventListener("click", () => {
            lightbox.style.display = "flex";
            lightboxImg.src = image.src;
          });
        });
        closeBtn.addEventListener("click", () => {
          lightbox.style.display = "none";
        });
        lightbox.addEventListener("click", (e) => {
          if (e.target === lightbox) lightbox.style.display = "none";
        });
      })
      .catch(() => {
        galleryGrid.innerHTML =
          "<p style='text-align:center;color:red;'>Error al cargar imágenes 😢</p>";
      });
  }

  const hamburger = document.getElementById("hamburger");
  const navMenu = document.querySelector(".nav-menu");
  hamburger?.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    navMenu.classList.toggle("active");
  });
});

// === MENÚ DESPLEGABLE SUPERIOR (MÓVIL) ===
const hamburger = document.getElementById("hamburger");
const mobileMenu = document.getElementById("mobileMenu");

if (hamburger && mobileMenu) {
  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    mobileMenu.classList.toggle("show");
  });

  // Cierra el menú al hacer clic en un enlace
  mobileMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      mobileMenu.classList.remove("show");
      hamburger.classList.remove("active");
    });
  });
}
