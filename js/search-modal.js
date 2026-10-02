/* ==========================================================================
   站内搜索浮框
   - 懒加载 Pagefind Component UI（首次打开浮框时才下载）
   - 顶栏与移动端菜单注入搜索图标
   - ⌘K / Ctrl+K 唤出，Esc、点遮罩关闭（由 PagefindModal 提供）
   ========================================================================== */
(function () {
  'use strict';

  // 从本脚本地址推导站点根路径（脚本位于 <base>/js/search-modal.js，兼容子目录部署）
  var BASE = (function () {
    var script = document.currentScript;
    var src = script && script.src ? script.src : window.location.href;
    return src.replace(/js\/search-modal\.js(?:\?.*)?$/, '');
  })();

  var COMPONENT_CSS = BASE + 'pagefind/pagefind-component-ui.css';
  var COMPONENT_JS = BASE + 'pagefind/pagefind-component-ui.js';

  var SEARCH_ICON =
    '<svg class="search-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<line x1="15.8" y1="15.8" x2="20.5" y2="20.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';

  var loading = null;

  function ensurePagefind() {
    if (loading) {
      return loading;
    }

    loading = new Promise(function (resolve, reject) {
      function loadScript() {
        var script = document.createElement('script');
        script.src = COMPONENT_JS;
        script.async = true;
        script.onload = function () {
          resolve();
        };
        script.onerror = function () {
          reject(new Error('Pagefind 搜索组件加载失败'));
        };
        document.head.appendChild(script);
      }

      if (!document.querySelector('link[href="' + COMPONENT_CSS + '"]')) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = COMPONENT_CSS;
        document.head.appendChild(link);
      }

      if (window.customElements && window.customElements.get('pagefind-modal')) {
        resolve();
        return;
      }

      loadScript();
    });

    // 失败后允许重试
    loading.catch(function () {
      loading = null;
    });

    return loading;
  }

  function getModal() {
    var modal = document.querySelector('pagefind-modal');
    if (!modal) {
      modal = document.createElement('pagefind-modal');
      document.body.appendChild(modal);
    }
    return modal;
  }

  function openSearch() {
    ensurePagefind()
      .then(function () {
        var modal = getModal();
        if (typeof modal.open === 'function') {
          modal.open();
        } else if (typeof modal.showModal === 'function') {
          modal.showModal();
        } else {
          modal.setAttribute('open', '');
        }
        syncExpanded(modal);
      })
      .catch(function (error) {
        // 索引缺失或资源加载失败时只记录日志，避免 alert 阻塞页面
        console.error('[search] 搜索组件不可用：', error);
      });
  }

  // 浮框开关同步到图标按钮的 aria-expanded
  function syncExpanded(modal) {
    var dialog = modal.querySelector('dialog');
    if (!dialog) {
      return;
    }

    setExpanded(true);

    if (dialog.dataset.expandBound === '1') {
      return;
    }
    dialog.dataset.expandBound = '1';
    dialog.addEventListener('close', function () {
      setExpanded(false);
    });
  }

  function setExpanded(value) {
    var toggles = document.querySelectorAll('.search-toggle');
    for (var i = 0; i < toggles.length; i += 1) {
      toggles[i].setAttribute('aria-expanded', value ? 'true' : 'false');
    }
  }

  function prefetch() {
    ensurePagefind().catch(function () {});
  }

  // 移动端抽屉菜单：打开状态时点搜索图标需要先收起
  function closeSlideout() {
    var icon = document.querySelector('.mobile-navbar-icon');
    if (icon && icon.classList.contains('icon-click')) {
      icon.click();
    }
  }

  // variant: nav（顶栏菜单）/ bar（移动端顶栏）/ menu（移动端抽屉）
  function createToggle(variant) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-toggle';
    button.setAttribute('aria-label', '搜索本站');
    button.setAttribute('aria-expanded', 'false');
    button.title = '搜索（⌘K / Ctrl+K）';

    if (variant === 'bar') {
      button.classList.add('search-toggle--bar');
      button.innerHTML = SEARCH_ICON;
    } else if (variant === 'menu') {
      button.classList.add('search-toggle--mobile');
      button.innerHTML = SEARCH_ICON + '<span class="search-toggle-label">搜索</span>';
    } else {
      button.innerHTML = SEARCH_ICON;
    }

    button.addEventListener('click', function () {
      closeSlideout();
      openSearch();
    });
    button.addEventListener('mouseenter', prefetch);
    button.addEventListener('focus', prefetch);

    return button;
  }

  function injectToggles() {
    var menu = document.querySelector('.site-navbar .menu');
    if (menu && !menu.querySelector('.search-toggle')) {
      var item = document.createElement('li');
      item.className = 'menu-item search-nav-item';
      item.appendChild(createToggle('nav'));
      menu.appendChild(item);
    }

    // 移动端顶栏右上角（与汉堡按钮同一行）
    var mobileNavbar = document.getElementById('mobile-navbar');
    if (mobileNavbar && !mobileNavbar.querySelector('.search-toggle')) {
      var barToggle = createToggle('bar');
      barToggle.classList.add('search-toggle--bar');
      mobileNavbar.appendChild(barToggle);
    }

    var mobileMenu = document.querySelector('.mobile-menu-list');
    if (mobileMenu && !mobileMenu.querySelector('.search-toggle')) {
      var mobileItem = document.createElement('li');
      mobileItem.className = 'mobile-menu-item search-mobile-item';
      mobileItem.appendChild(createToggle('menu'));
      mobileMenu.appendChild(mobileItem);
    }
  }

  function bindShortcut() {
    document.addEventListener('keydown', function (event) {
      if (!(event.metaKey || event.ctrlKey) || event.key !== 'k') {
        return;
      }

      var target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      event.preventDefault();
      openSearch();
    });
  }

  function init() {
    injectToggles();
    bindShortcut();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
