/* ============================================
   Wishlist — Public App Logic (3D Carousel)
   ============================================ */

(() => {
  'use strict';

  // --- State ---
  let settings = { title: '', people: [] };
  let selectedPerson = '';
  let wishes = [];
  let photos = [];
  let carouselIndex = 0;
  let carouselInterval = null;
  let pendingWishId = null;

  // --- DOM ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const siteTitle = $('#site-title');
  const chooserContainer = $('#person-chooser');
  const wishesList = $('#wishes-list');
  const modalOverlay = $('#modal-overlay');
  const modalWishName = $('#modal-wish-name');
  const modalYes = $('#modal-yes');
  const modalNo = $('#modal-no');

  // --- API ---
  const api = {
    async getSettings() {
      const res = await fetch('/api/settings');
      return res.json();
    },
    async getWishes(person) {
      const res = await fetch(`/api/wishes?person=${person}`);
      return res.json();
    },
    async getPhotos(person) {
      const res = await fetch(`/api/photos?person=${person}`);
      return res.json();
    },
    async toggleWish(id) {
      const res = await fetch(`/api/wishes/${id}/toggle`, { method: 'PATCH' });
      return res.json();
    },
  };

  // --- Settings & Chooser ---
  function renderSettings() {
    siteTitle.textContent = settings.title;
    document.title = 'wishlist';

    chooserContainer.innerHTML = '';
    settings.people.forEach((person) => {
      const btn = document.createElement('button');
      btn.className = `chooser-btn${person.id === selectedPerson ? ' active' : ''}`;
      btn.dataset.person = person.id;
      btn.textContent = person.name;
      btn.addEventListener('click', () => {
        if (person.id === selectedPerson) return;
        selectedPerson = person.id;
        chooserContainer.querySelectorAll('.chooser-btn').forEach((b) =>
          b.classList.toggle('active', b.dataset.person === person.id)
        );
        loadData();
      });
      chooserContainer.appendChild(btn);
    });
  }

  // --- 3D Continuous Conveyor Carousel ---
  const carouselScene = $('#carousel-scene');
  const carouselSection = $('#carousel-section');
  let animationFrameId = null;
  let isPaused = false;
  let tickerOffset = 0;
  let isDragging = false;
  let startX = 0;
  let lastCarouselWidth = 0;

  if (carouselSection) {
    carouselSection.addEventListener('mouseenter', () => { isPaused = true; });
    carouselSection.addEventListener('mouseleave', () => { if (!isDragging) isPaused = false; });

    // Touch & Pointer drag gestures for mobile/desktop
    const handleDragStart = (e) => {
      isDragging = true;
      isPaused = true;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
    };

    const handleDragMove = (e) => {
      if (!isDragging) return;
      const currentX = e.touches ? e.touches[0].clientX : e.clientX;
      const diff = currentX - startX;
      startX = currentX;
      tickerOffset += diff * 1.2;
    };

    const handleDragEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      isPaused = false;
    };

    carouselSection.addEventListener('touchstart', handleDragStart, { passive: true });
    carouselSection.addEventListener('touchmove', handleDragMove, { passive: true });
    carouselSection.addEventListener('touchend', handleDragEnd, { passive: true });

    carouselSection.addEventListener('mousedown', handleDragStart);
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
  }

  function renderCarousel() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (!carouselScene) return;
    carouselScene.innerHTML = '';

    if (photos.length === 0) {
      carouselScene.innerHTML = `
        <div class="carousel-empty-state">
          <div style="text-align:center">
            <i class="bi bi-image" style="font-size:48px;color:var(--beige-400);display:block;margin-bottom:12px"></i>
            <p>No hay fotos aún</p>
          </div>
        </div>`;
      return;
    }

    // Build enough cards for seamless 3D loop
    let listToRender = [...photos];
    while (listToRender.length < 8) {
      listToRender = [...listToRender, ...photos];
    }

    const vw = window.innerWidth;
    lastCarouselWidth = vw;
    const isMobile = vw < 640;
    // Fluid sizing: cards scale smoothly with viewport width, keeping a 3:2 ratio.
    const cardWidth = Math.round(Math.min(360, Math.max(200, vw * 0.6)));
    const cardHeight = Math.round(cardWidth * (2 / 3));
    const cardGap = Math.round(Math.min(60, Math.max(16, vw * 0.05)));
    const cardSpacing = cardWidth + cardGap;
    const totalTrackWidth = listToRender.length * cardSpacing;

    const cardsDOM = listToRender.map((photo, i) => {
      const card = document.createElement('div');
      card.className = 'carousel-card';
      card.style.width = `${cardWidth}px`;
      card.style.height = `${cardHeight}px`;
      card.innerHTML = `<img src="${photo.url}" alt="Foto ${(i % photos.length) + 1}" loading="lazy">`;
      carouselScene.appendChild(card);
      return card;
    });

    const speed = 0.7; // Constant slow smooth speed (pixels per frame)

    function tick() {
      if (!isPaused && !isDragging) {
        tickerOffset += speed;
      }

      // Keep offset within track bounds smoothly
      if (tickerOffset >= totalTrackWidth) {
        tickerOffset -= totalTrackWidth;
      } else if (tickerOffset < 0) {
        tickerOffset += totalTrackWidth;
      }

      const viewportWidth = carouselScene.offsetWidth || window.innerWidth;
      const centerX = viewportWidth / 2;

      cardsDOM.forEach((card, i) => {
        let posX = ((i * cardSpacing + tickerOffset) % totalTrackWidth);
        
        if (posX > viewportWidth + cardWidth) {
          posX -= totalTrackWidth;
        }

        const cardCenterX = posX + cardWidth / 2;
        const normPos = (cardCenterX - centerX) / (viewportWidth * (isMobile ? 0.45 : 0.4));

        const rotateY = Math.min(45, Math.max(-45, -normPos * 35));
        const translateZ = Math.max(-280, (1 - Math.abs(normPos)) * (isMobile ? 60 : 90));
        const scale = Math.max(0.65, 1 - Math.abs(normPos) * 0.22);
        const brightness = Math.max(0.6, 1 - Math.abs(normPos) * 0.3);
        const zIndex = Math.round(100 - Math.abs(normPos) * 40);

        let opacity = 1;
        const absNorm = Math.abs(normPos);
        if (absNorm > 1.4) {
          opacity = Math.max(0, 1 - (absNorm - 1.4) * 1.5);
        }

        card.style.transform = `translate3d(${posX - cardWidth / 2}px, -50%, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
        card.style.zIndex = zIndex;
        card.style.filter = `brightness(${brightness})`;
        card.style.opacity = opacity;
      });

      animationFrameId = requestAnimationFrame(tick);
    }

    tick();
  }

  // Re-render the carousel when the viewport WIDTH changes (rotation / resize).
  // Width-only check ignores the iOS URL-bar show/hide, which changes height only.
  let resizeTimer = null;
  const handleViewportResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (photos.length > 0 && window.innerWidth !== lastCarouselWidth) {
        renderCarousel();
      }
    }, 150);
  };
  window.addEventListener('resize', handleViewportResize);
  window.addEventListener('orientationchange', () => {
    setTimeout(() => { if (photos.length > 0) renderCarousel(); }, 300);
  });

  // --- Wishes ---
  const wishIcons = ['bi-gift', 'bi-stars', 'bi-star', 'bi-heart', 'bi-balloon', 'bi-gem', 'bi-flower1', 'bi-emoji-smile', 'bi-rocket', 'bi-trophy'];

  function renderWishes() {
    wishesList.innerHTML = '';
    const personName = settings.people.find((p) => p.id === selectedPerson)?.name || selectedPerson;

    if (wishes.length === 0) {
      wishesList.innerHTML = `<div class="wishes-empty">No hay wishes aún para ${escapeHtml(personName)}</div>`;
      return;
    }

    wishes.forEach((wish, i) => {
      const card = document.createElement('div');
      card.className = `wish-card${wish.completed ? ' completed' : ''}`;
      card.dataset.id = wish.id;

      const icon = wishIcons[i % wishIcons.length];

      card.innerHTML = `
        <div class="wish-icon"><i class="bi ${icon}"></i></div>
        <span class="wish-text">${escapeHtml(wish.text)}</span>
        <span class="wish-badge"><i class="bi bi-check-circle"></i> dado</span>
      `;

      card.addEventListener('click', () => {
        if (!wish.completed) {
          openModal(wish);
        }
      });

      wishesList.appendChild(card);
    });
  }

  // --- Modal ---
  function openModal(wish) {
    pendingWishId = wish.id;
    modalWishName.textContent = `"${wish.text}"`;
    modalOverlay.classList.add('active');
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    pendingWishId = null;
  }

  modalNo.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  modalYes.addEventListener('click', async () => {
    if (!pendingWishId) return;
    try {
      await api.toggleWish(pendingWishId);
      closeModal();
      await loadWishes();
    } catch (err) {
      console.error('Error toggling wish:', err);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // --- Data Loading ---
  async function loadWishes() {
    try {
      wishes = await api.getWishes(selectedPerson);
      renderWishes();
    } catch (err) {
      console.error('Error loading wishes:', err);
    }
  }

  async function loadPhotos() {
    try {
      photos = await api.getPhotos(selectedPerson);
      renderCarousel();
    } catch (err) {
      console.error('Error loading photos:', err);
    }
  }

  async function loadData() {
    await Promise.all([loadWishes(), loadPhotos()]);
  }

  // --- Utility ---
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // --- Init ---
  async function init() {
    try {
      settings = await api.getSettings();
      if (settings.people.length > 0) {
        selectedPerson = settings.people[0].id;
      }
      renderSettings();
      await loadData();
    } catch (err) {
      console.error('Error initializing:', err);
    }
  }

  init();
})();
