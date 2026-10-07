/* ============================================================
   FPU Portal — Photo helper
   ------------------------------------------------------------
   Exposes:
     getMyPhoto()             -> Promise<string|null>
     renderMyAvatar(el, user) -> void  (fills .avatar/.photo elements)
     uploadAvatar(file)       -> Promise<{ url }>
   ============================================================ */

(function () {
  'use strict';

  const core = window.FPU_PORTAL || {};
  const portalFetch = core.portalFetch;

  // ----------------------------------------------------------
  // Fetch current photo URL
  // ----------------------------------------------------------
  async function getMyPhoto() {
    try {
      const res = await portalFetch('/api/portal/photo');
      return res.photoUrl || (res.data && res.data.url) || null;
    } catch {
      return null;
    }
  }

  // ----------------------------------------------------------
  // Render the avatar into a container element
  // ----------------------------------------------------------
  function renderMyAvatar(el, user) {
    if (!el) return;
    const u = user || core.getPortalUser() || {};
    const initials = core.getInitials
      ? core.getInitials(u.firstName, u.lastName)
      : ((u.firstName || '')[0] || '') + ((u.lastName || '')[0] || '') || 'U';

    // If a photo URL is set on the user object, use it immediately.
    if (u.photoUrl) {
      el.innerHTML = `<img src="${core.escapeHtml(u.photoUrl)}" alt="Photo" loading="lazy" />`;
      return;
    }
    el.textContent = initials;

    // Then try to fetch the freshest photo from the API.
    getMyPhoto().then((url) => {
      if (url) {
        el.innerHTML = `<img src="${core.escapeHtml(url)}" alt="Photo" loading="lazy" />`;
      }
    });
  }

  // ----------------------------------------------------------
  // Upload a file (as base64) to /api/portal/avatar-upload
  // ----------------------------------------------------------
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadAvatar(file) {
    if (!file) throw new Error('No file selected.');
    if (!/^image\//.test(file.type)) throw new Error('Only image files are allowed.');
    const maxMb = 5;
    if (file.size > maxMb * 1024 * 1024) throw new Error(`File must be under ${maxMb} MB.`);

    const dataUrl = await fileToDataUrl(file);
    const res = await portalFetch('/api/portal/avatar-upload', {
      method: 'POST',
      body: { dataUrl },
    });
    // Update cached user
    const u = core.getPortalUser() || {};
    u.photoUrl = res.url;
    core.setPortalSession({ user: u });
    return { url: res.url };
  }

  window.FPU_PHOTO = { getMyPhoto, renderMyAvatar, uploadAvatar };
})();