(() => {
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const next = q.get('next') || '/lobby.html';
  function setStatus(t){ $('statusLine').textContent=t; }
  async function api(path, body){
    const r = await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    return await r.json();
  }

  window.login = async () => {
    const username = $('loginUsername').value.trim();
    const password = $('loginPassword').value;
    if (!username || !password) return setStatus('아이디와 비밀번호를 입력해 주세요.');
    const r = await api('/api/auth?action=login', { username, password });
    if (!r.ok) return setStatus(`로그인 실패: ${r.error || 'error'}`);
    location.href = next;
  };

  window.register = async () => {
    const username = $('regUsername').value.trim();
    const displayName = $('regDisplayName').value.trim();
    const password = $('regPassword').value;
    if (!username || !password) return setStatus('아이디와 비밀번호를 입력해 주세요.');
    const r = await api('/api/auth?action=register', { username, displayName, password });
    if (!r.ok) return setStatus(`회원가입 실패: ${r.error || 'error'}`);
    location.href = next;
  };
})();
