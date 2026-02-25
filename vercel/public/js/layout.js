(async function initLayout() {
  function shouldShowBrandSplash() {
    return location.pathname === '/index.html' || location.pathname === '/';
  }

  function ensureLoadingLayer() {
    let root = document.getElementById('bpLoading');
    if (root) return root;

    root = document.createElement('div');
    root.id = 'bpLoading';
    root.className = 'bp-loading hidden';
    root.innerHTML = `
      <div class="bp-loading__box" role="status" aria-live="polite">
        <div class="bp-loading__spinner" aria-hidden="true"></div>
        <div class="bp-loading__percent" aria-hidden="true">0%</div>
        <div class="bp-loading__text">불러오는 중</div>
      </div>`;
    document.body.appendChild(root);
    return root;
  }

  function createLoadingApi() {
    const root = ensureLoadingLayer();
    const spinner = root.querySelector('.bp-loading__spinner');
    const percent = root.querySelector('.bp-loading__percent');
    const text = root.querySelector('.bp-loading__text');
    let timer = null;

    function stopTimer() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    return {
      show(message = '불러오는 중', opts = {}) {
        const mode = opts.mode === 'spinner' ? 'spinner' : 'percent';
        root.classList.remove('hidden');
        text.textContent = message;
        stopTimer();

        if (mode === 'percent') {
          spinner.classList.add('hidden');
          percent.classList.remove('hidden');
          let n = 0;
          percent.textContent = '0%';
          timer = setInterval(() => {
            n = Math.min(95, n + 5);
            percent.textContent = `${n}%`;
          }, 80);
        } else {
          percent.classList.add('hidden');
          spinner.classList.remove('hidden');
        }
      },
      hide() {
        stopTimer();
        root.classList.add('hidden');
      }
    };
  }

  async function showBrandSplashOnce() {
    if (!shouldShowBrandSplash()) return;
    const key = 'bp_intro_seen_v1';
    if (sessionStorage.getItem(key) === '1') return;

    const root = document.createElement('div');
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:99999',
      'display:grid',
      'place-items:center',
      'background:#000',
      'opacity:1',
      'transition:opacity 320ms ease'
    ].join(';');

    const logo = document.createElement('div');
    logo.style.cssText = [
      'color:#fff',
      'font-family:"Oxanium","Pretendard",sans-serif',
      'font-weight:1000',
      'letter-spacing:.08em',
      'line-height:.88',
      'text-align:center',
      'font-size:clamp(38px,9vw,116px)',
      'user-select:none'
    ].join(';');
    logo.innerHTML = 'NULSIGHT';

    root.appendChild(logo);
    document.body.appendChild(root);

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    await new Promise((r) => setTimeout(r, reduce ? 120 : 520));
    root.style.opacity = '0';
    await new Promise((r) => setTimeout(r, reduce ? 80 : 320));
    root.remove();
    sessionStorage.setItem(key, '1');
  }

  async function inject(selector, url) {
    const host = document.querySelector(selector);
    if (!host) return;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      host.innerHTML = await res.text();
    } catch (_) {
      // noop
    }
  }

  async function api(path, method = 'GET', body) {
    if (method === 'GET' && !body) {
      const r = await fetch(path);
      return await r.json();
    }
    const opt = { method, headers: { 'content-type': 'application/json' } };
    if (body) opt.body = JSON.stringify(body);
    const r = await fetch(path, opt);
    return await r.json();
  }

  function isLiveGamePage() {
    return location.pathname === '/game.html';
  }

  async function ensureSwal() {
    if (globalThis.Swal) return globalThis.Swal;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return globalThis.Swal;
  }

  function createAlertApi() {
    return {
      async confirm(text, title = '확인', opts = {}) {
        try {
          const Swal = await ensureSwal();
          const { customClass: customClassOverride = {}, ...swalOpts } = opts || {};
          const r = await Swal.fire({
            title,
            text,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '확인',
            cancelButtonText: '취소',
            reverseButtons: false,
            customClass: {
              popup: 'bp-swal-popup bp-swal-popup--logout',
              title: 'bp-swal-title',
              htmlContainer: 'bp-swal-text',
              actions: 'bp-swal-actions bp-swal-actions--logout',
              confirmButton: 'bp-swal-confirm',
              cancelButton: 'bp-swal-cancel',
              ...customClassOverride
            },
            ...swalOpts,
            buttonsStyling: false
          });
          return !!r.isConfirmed;
        } catch {
          return confirm(text);
        }
      },
      async alert(text, title = '알림', opts = {}) {
        try {
          const Swal = await ensureSwal();
          const { customClass: customClassOverride = {}, ...swalOpts } = opts || {};
          await Swal.fire({
            title,
            text,
            icon: 'info',
            confirmButtonText: '확인',
            customClass: {
              popup: 'bp-swal-popup bp-swal-popup--logout',
              title: 'bp-swal-title',
              htmlContainer: 'bp-swal-text',
              actions: 'bp-swal-actions bp-swal-actions--logout',
              confirmButton: 'bp-swal-confirm',
              ...customClassOverride
            },
            ...swalOpts,
            buttonsStyling: false
          });
        } catch {
          alert(text);
        }
      },
      async info(text, title = '알림', opts = {}) {
        return this.alert(text, title, opts);
      },
      async prompt(text, title = '입력', opts = {}) {
        try {
          const Swal = await ensureSwal();
          const {
            customClass: customClassOverride = {},
            inputValue = '',
            inputPlaceholder = '',
            inputValidator,
            ...swalOpts
          } = opts || {};
          const r = await Swal.fire({
            title,
            text,
            icon: 'question',
            input: 'text',
            inputValue,
            inputPlaceholder,
            inputValidator,
            showCancelButton: true,
            confirmButtonText: '확인',
            cancelButtonText: '취소',
            customClass: {
              popup: 'bp-swal-popup bp-swal-popup--logout',
              title: 'bp-swal-title',
              htmlContainer: 'bp-swal-text',
              actions: 'bp-swal-actions bp-swal-actions--logout',
              confirmButton: 'bp-swal-confirm',
              cancelButton: 'bp-swal-cancel',
              ...customClassOverride
            },
            ...swalOpts,
            buttonsStyling: false
          });
          return r.isConfirmed ? String(r.value || '') : null;
        } catch {
          const v = prompt(text, String((opts && opts.inputValue) || ''));
          return (v == null) ? null : String(v);
        }
      }
    };
  }

  window.BP_LOADING = createLoadingApi();
  window.BP_ALERT = createAlertApi();

  await showBrandSplashOnce();

  await Promise.all([
    inject('#site-header', '/header.html'),
    inject('#site-footer', '/footer.html')
  ]);

  const authHost = document.getElementById('headerAuthAction');
  if (!authHost) return;

  try {
    const me = await api('/api/auth?action=me');
    const btn = document.createElement('button');
    btn.className = 'bp-header-btn';

    if (me.ok) {
      if (location.pathname === '/login.html') {
        btn.textContent = '로비로';
        btn.onclick = () => { location.href = '/lobby.html'; };
      } else {
        btn.textContent = '로그아웃';
        btn.onclick = async () => {
          if (isLiveGamePage()) {
            const ok = await (window.BP_ALERT?.confirm('진행 중인 매치를 종료하고 로그아웃할까요?', '로그아웃 확인', {
              customClass: {
                popup: 'bp-swal-popup bp-swal-popup--logout',
                actions: 'bp-swal-actions bp-swal-actions--logout'
              }
            }) ?? Promise.resolve(confirm('진행 중인 매치를 종료하고 로그아웃할까요?')));
            if (!ok) return;
          }
          await api('/api/auth?action=logout', 'POST', {});
          location.href = '/login.html';
        };
      }
    } else {
      btn.textContent = '로그인';
      btn.onclick = () => {
        const next = encodeURIComponent(location.pathname + location.search);
        location.href = `/login.html?next=${next}`;
      };
    }

    authHost.appendChild(btn);
  } catch (_) {
    // noop
  }
})();
