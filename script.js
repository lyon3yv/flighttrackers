// script.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM cargado");

  // ===============================
  // NAVBAR (aparece tras la intro)
  // ===============================
  const navbar = document.getElementById("navbar");
  if (navbar && window.location.pathname === "/") {
    setTimeout(() => navbar.classList.add("show"), 15000); // 15s
  }
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (window.scrollY > 60) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  });
  // ===============================
  // CONTADOR EN INDEX
  // ===============================
  const target = 53;
  const el = document.getElementById('counter');
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
});

  // ===============================
  // FORMULARIO DE INSCRIPCIÓN
  // ===============================
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

  // ===============================
  // GALERÍA (solo en /galeria)
  // ===============================
  const galleryGrid = document.getElementById("galleryGrid");
  if (galleryGrid) {
    console.log("📸 Cargando galería...");

    fetch("/api/gallery")
      .then((res) => res.json())
      .then((images) => {
        if (!images || images.length === 0) {
          galleryGrid.innerHTML =
            "<p style='text-align:center;font-size:1.2em;color:#555;'>No hay fotos publicadas aún 📭</p>";
          return;
        }

        // Crear miniaturas
        galleryGrid.innerHTML = images
          .map(
            (img) => `
            <div class="gallery-item">
              <img src="${img.url}" alt="${img.name}" loading="lazy">
            </div>
          `
          )
          .join("");

        // === Lightbox ===
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
      .catch((err) => {
        console.error("❌ Error al cargar galería:", err);
        galleryGrid.innerHTML =
          "<p style='text-align:center;color:red;'>Error al cargar imágenes 😢</p>";
      });
  }

  // ===============================
  // MENÚ MÓVIL
  // ===============================
  const hamburger = document.getElementById("hamburger");
  const navMenu = document.querySelector(".nav-menu");
  hamburger?.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    navMenu.classList.toggle("active");
  });
;
