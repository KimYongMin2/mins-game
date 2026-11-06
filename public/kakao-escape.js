// 카카오톡 안(인앱 브라우저)에서 열리면 바깥 브라우저로 다시 연다.
// 카톡 브라우저는 마이크·기기 직접 연결(WebRTC)이 잘 안 돼서 회의방·친구 대전이 안 될 수 있다.
// - 안드로이드: 폰의 기본 브라우저로 (크롬을 지정하면 크롬이 없는 폰에서 안 열려서 지정 안 함)
// - 아이폰: 카톡에게 바깥 브라우저(사파리 등)로 열어 달라고 함
// 바깥 브라우저가 실제로 열려 화면이 넘어갔을 때만 카톡 창을 닫는다 (안 열렸는데 닫으면 아무것도 안 남으니까).
// 1.5초 안에 안 넘어가면 '다른 브라우저로 열기' 안내를 띄운다. 한 번 시도한 뒤엔(같은 창) 다시 안 넘긴다.
;(function () {
  var ua = navigator.userAgent.toLowerCase()
  if (ua.indexOf('kakaotalk') < 0) return
  var android = ua.indexOf('android') >= 0
  var KEY = 'mins-game:kakao-escape'

  function open() {
    var target = location.href
    if (android) {
      location.href = 'intent://' + target.replace(/^https?:\/\//, '') + '#Intent;scheme=' + location.protocol.replace(':', '') + ';end'
    } else {
      location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(target)
    }
  }

  function closeKakao() {
    location.href = android ? 'kakaotalk://inappbrowser/close' : 'kakaoweb://closeBrowser'
  }

  function tryOpen() {
    var left = false
    function onHide() {
      if (left || document.visibilityState !== 'hidden') return
      left = true
      document.removeEventListener('visibilitychange', onHide)
      // 바깥 브라우저로 넘어갔다 → 카톡 창은 닫는다
      setTimeout(closeKakao, 300)
    }
    document.addEventListener('visibilitychange', onHide)
    open()
    setTimeout(function () {
      if (!left) showGuide()
    }, 1500)
  }

  function showGuide() {
    if (document.getElementById('kakao-guide')) return
    var bar = document.createElement('div')
    bar.id = 'kakao-guide'
    bar.setAttribute('role', 'alert')
    bar.style.cssText =
      'position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;padding:12px 14px;border-radius:12px;' +
      'background:#1f2937;color:#fff;font:14px/1.5 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3)'
    var menu = android ? '오른쪽 위 ⋮' : '오른쪽 아래 ⋯'
    bar.innerHTML =
      '<b>카카오톡 안에서는 마이크·친구 대전이 잘 안 될 수 있어요</b><br>' +
      menu + ' 메뉴 → <b>다른 브라우저로 열기</b>를 눌러 주세요' +
      '<div style="display:flex;gap:8px;margin-top:8px">' +
      '<button type="button" data-act="retry" style="flex:1;padding:8px;border:0;border-radius:8px;background:#fee500;color:#191919;font-weight:700">바깥 브라우저로 열기</button>' +
      '<button type="button" data-act="close" style="padding:8px 12px;border:1px solid #6b7280;border-radius:8px;background:none;color:#fff">닫기</button>' +
      '</div>'
    bar.addEventListener('click', function (e) {
      var act = e.target && e.target.getAttribute && e.target.getAttribute('data-act')
      if (act === 'retry') tryOpen()
      if (act === 'close') bar.remove()
    })
    document.body.appendChild(bar)
  }

  var tried = false
  try {
    tried = sessionStorage.getItem(KEY) === '1'
    sessionStorage.setItem(KEY, '1')
  } catch {
    // 저장이 막혀 있으면 매번 시도
    tried = false
  }

  function start() {
    if (tried) showGuide()
    else tryOpen()
  }
  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start)
})()
