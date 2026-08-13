/* ============================================
   Wishlist — Dashboard Logic
   ============================================ */

(() => {
  'use strict';

  // --- State ---
  let authKey = '';
  let settings = { title: '', people: [] };
  let selectedPerson = '';
  let wishes = [];
  let photos = [];

  // --- DOM ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const loginScreen = $('#login-screen');
  const loginForm = $('#login-form');
  const loginPassword = $('#login-password');
  const loginError = $('#login-error');
  const loginTitle = $('#login-title');
  const dashboard = $('#dashboard');
  const dashTitle = $('#dash-title');
  const btnLogout = $('#btn-logout');
  const chooserContainer = $('#dash-chooser');
  const addWishForm = $('#add-wish-form');
  const newWishInput = $('#new-wish-input');
  const dashWishesList = $('#dash-wishes-list');
  const photoUploadArea = $('#photo-upload-area');
  const photoInput = $('#photo-input');
  const photoGrid = $('#photo-grid');
  const settingsTitleInput = $('#settings-title-input');
  const btnSaveTitle = $('#btn-save-title');
  const newPersonInput = $('#new-person-input');
  const btnAddPerson = $('#btn-add-person');
  const peopleList = $('#people-list');

  // --- API Helpers ---
  function headers() {
    return {
      'Content-Type': 'application/json',
      'x-auth-key': authKey,
    };
  }

  const api = {
    async auth(password) {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      return res.json();
    },

    async getSettings() {
      const res = await fetch('/api/settings');
      return res.json();
    },

    async updateTitle(title) {
      const res = await fetch('/api/settings/title', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ title }),
      });
      return res.json();
    },

    async addPerson(name) {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name }),
      });
      return res.json();
    },

    async updatePerson(id, name) {
      const res = await fetch(`/api/people/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ name }),
      });
      return res.json();
    },

    async deletePerson(id) {
      const res = await fetch(`/api/people/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      return res.json();
    },

    async getWishes(person) {
      const res = await fetch(`/api/wishes?person=${person}`);
      return res.json();
    },

    async createWish(text, person) {
      const res = await fetch('/api/wishes', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ text, person }),
      });
      return res.json();
    },

    async updateWish(id, data) {
      const res = await fetch(`/api/wishes/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(data),
      });
      return res.json();
    },

    async deleteWish(id) {
      const res = await fetch(`/api/wishes/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      return res.json();
    },

    async getPhotos(person) {
      const res = await fetch(`/api/photos?person=${person}`);
      return res.json();
    },

    async uploadPhoto(file, person) {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('person', person);
      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'x-auth-key': authKey },
        body: formData,
      });
      return res.json();
    },

    async deletePhoto(person, filename) {
      const res = await fetch(`/api/photos/${person}/${filename}`, {
        method: 'DELETE',
        headers: headers(),
      });
      return res.json();
    },
  };

  // --- Auth ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = loginPassword.value.trim();
    if (!password) return;

    try {
      const result = await api.auth(password);
      if (result.success) {
        authKey = password;
        loginScreen.style.display = 'none';
        dashboard.classList.add('active');
        await loadSettings();
        loadData();
      } else {
        loginError.classList.add('visible');
        loginPassword.classList.add('error');
        setTimeout(() => {
          loginError.classList.remove('visible');
          loginPassword.classList.remove('error');
        }, 3000);
      }
    } catch (err) {
      console.error('Auth error:', err);
    }
  });

  btnLogout.addEventListener('click', () => {
    authKey = '';
    dashboard.classList.remove('active');
    loginScreen.style.display = '';
    loginPassword.value = '';
  });

  // --- Settings ---
  async function loadSettings() {
    settings = await api.getSettings();
    selectedPerson = settings.people.length > 0 ? settings.people[0].id : '';
    renderSettingsUI();
    renderChooser();
  }

  function renderSettingsUI() {
    dashTitle.textContent = settings.title;
    loginTitle.textContent = settings.title;
    settingsTitleInput.value = settings.title;
    renderPeopleList();
  }

  btnSaveTitle.addEventListener('click', async () => {
    const title = settingsTitleInput.value.trim();
    if (!title) return;
    try {
      settings = await api.updateTitle(title);
      renderSettingsUI();
    } catch (err) {
      console.error('Error saving title:', err);
    }
  });

  settingsTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnSaveTitle.click();
    }
  });

  // --- People Management ---
  function renderPeopleList() {
    peopleList.innerHTML = '';

    settings.people.forEach((person) => {
      const row = document.createElement('div');
      row.className = 'person-row';
      row.innerHTML = `
        <span class="person-name">${escapeHtml(person.name)}</span>
        <div class="person-actions">
          <button class="btn-icon edit" title="Editar"><i class="bi bi-pencil"></i></button>
          <button class="btn-icon delete" title="Eliminar"><i class="bi bi-trash3"></i></button>
        </div>
      `;

      // Edit
      row.querySelector('.edit').addEventListener('click', () => {
        const nameEl = row.querySelector('.person-name');
        const currentName = person.name;
        nameEl.innerHTML = `<input type="text" value="${escapeAttr(currentName)}" class="edit-input person-edit-input">`;
        const input = nameEl.querySelector('input');
        input.focus();
        input.select();

        const save = async () => {
          const newName = input.value.trim();
          if (newName && newName !== currentName) {
            try {
              settings = await api.updatePerson(person.id, newName);
              renderSettingsUI();
              renderChooser();
            } catch (err) {
              console.error('Error updating person:', err);
            }
          } else {
            nameEl.textContent = currentName;
          }
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
          if (e.key === 'Escape') nameEl.textContent = currentName;
        });
      });

      // Delete
      row.querySelector('.delete').addEventListener('click', async () => {
        if (settings.people.length <= 1) {
          alert('Debe haber al menos una persona');
          return;
        }
        if (confirm(`¿Eliminar a "${person.name}"? Se borrarán sus wishes y fotos.`)) {
          try {
            settings = await api.deletePerson(person.id);
            if (selectedPerson === person.id) {
              selectedPerson = settings.people.length > 0 ? settings.people[0].id : '';
            }
            renderSettingsUI();
            renderChooser();
            loadData();
          } catch (err) {
            console.error('Error deleting person:', err);
          }
        }
      });

      peopleList.appendChild(row);
    });
  }

  btnAddPerson.addEventListener('click', async () => {
    const name = newPersonInput.value.trim();
    if (!name) return;
    try {
      settings = await api.addPerson(name);
      newPersonInput.value = '';
      renderSettingsUI();
      renderChooser();
    } catch (err) {
      console.error('Error adding person:', err);
    }
  });

  newPersonInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAddPerson.click();
    }
  });

  // --- Chooser ---
  function renderChooser() {
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

  // --- Wishes ---
  addWishForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = newWishInput.value.trim();
    if (!text || !selectedPerson) return;

    try {
      await api.createWish(text, selectedPerson);
      newWishInput.value = '';
      await loadWishes();
    } catch (err) {
      console.error('Error creating wish:', err);
    }
  });

  function renderWishes() {
    dashWishesList.innerHTML = '';
    const personName = settings.people.find((p) => p.id === selectedPerson)?.name || selectedPerson;

    if (wishes.length === 0) {
      dashWishesList.innerHTML = `<div class="wishes-empty">No hay wishes para ${escapeHtml(personName)}</div>`;
      return;
    }

    wishes.forEach((wish) => {
      const item = document.createElement('div');
      item.className = `dash-wish-item${wish.completed ? ' completed-dash' : ''}`;
      item.dataset.id = wish.id;

      item.innerHTML = `
        <div class="dash-wish-text">
          <span class="text-display">${escapeHtml(wish.text)}</span>
        </div>
        <button class="btn-icon edit" title="Editar" aria-label="Editar wish"><i class="bi bi-pencil"></i></button>
        <button class="btn-icon delete" title="Eliminar" aria-label="Eliminar wish"><i class="bi bi-trash3"></i></button>
      `;

      // Edit
      item.querySelector('.edit').addEventListener('click', () => {
        const textEl = item.querySelector('.dash-wish-text');
        const currentText = wish.text;
        textEl.innerHTML = `<input type="text" value="${escapeAttr(currentText)}" class="edit-input">`;
        const input = textEl.querySelector('input');
        input.focus();
        input.select();

        const save = async () => {
          const newText = input.value.trim();
          if (newText && newText !== currentText) {
            try {
              await api.updateWish(wish.id, { text: newText });
              await loadWishes();
            } catch (err) {
              console.error('Error updating wish:', err);
            }
          } else {
            textEl.innerHTML = `<span class="text-display">${escapeHtml(currentText)}</span>`;
          }
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
          }
          if (e.key === 'Escape') {
            textEl.innerHTML = `<span class="text-display">${escapeHtml(currentText)}</span>`;
          }
        });
      });

      // Delete
      item.querySelector('.delete').addEventListener('click', async () => {
        if (confirm('¿Eliminar este wish?')) {
          try {
            await api.deleteWish(wish.id);
            await loadWishes();
          } catch (err) {
            console.error('Error deleting wish:', err);
          }
        }
      });

      dashWishesList.appendChild(item);
    });
  }

  // --- Photos ---
  photoUploadArea.addEventListener('click', () => photoInput.click());

  photoUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    photoUploadArea.style.borderColor = 'var(--accent)';
    photoUploadArea.style.background = 'var(--accent-light)';
  });

  photoUploadArea.addEventListener('dragleave', () => {
    photoUploadArea.style.borderColor = '';
    photoUploadArea.style.background = '';
  });

  photoUploadArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    photoUploadArea.style.borderColor = '';
    photoUploadArea.style.background = '';

    const files = e.dataTransfer.files;
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        await uploadFile(file);
      }
    }
  });

  photoInput.addEventListener('change', async () => {
    if (photoInput.files.length > 0) {
      await uploadFile(photoInput.files[0]);
      photoInput.value = '';
    }
  });

  async function uploadFile(file) {
    if (!selectedPerson) return;
    try {
      await api.uploadPhoto(file, selectedPerson);
      await loadPhotos();
    } catch (err) {
      console.error('Error uploading photo:', err);
    }
  }

  function renderPhotos() {
    photoGrid.innerHTML = '';

    if (photos.length === 0) return;

    photos.forEach((photo) => {
      const thumb = document.createElement('div');
      thumb.className = 'photo-thumb';
      thumb.innerHTML = `
        <img src="${photo.url}" alt="Foto" loading="lazy">
        <button class="photo-delete" title="Eliminar foto" aria-label="Eliminar foto"><i class="bi bi-x-lg"></i></button>
      `;

      thumb.querySelector('.photo-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('¿Eliminar esta foto?')) {
          try {
            await api.deletePhoto(photo.person, photo.filename);
            await loadPhotos();
          } catch (err) {
            console.error('Error deleting photo:', err);
          }
        }
      });

      photoGrid.appendChild(thumb);
    });
  }

  // --- Data Loading ---
  async function loadWishes() {
    if (!selectedPerson) return;
    try {
      wishes = await api.getWishes(selectedPerson);
      renderWishes();
    } catch (err) {
      console.error('Error loading wishes:', err);
    }
  }

  async function loadPhotos() {
    if (!selectedPerson) return;
    try {
      photos = await api.getPhotos(selectedPerson);
      renderPhotos();
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

  function escapeAttr(text) {
    return text.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // --- Init: load settings for login title ---
  (async () => {
    try {
      settings = await api.getSettings();
      loginTitle.textContent = settings.title;
    } catch {}
  })();
})();
