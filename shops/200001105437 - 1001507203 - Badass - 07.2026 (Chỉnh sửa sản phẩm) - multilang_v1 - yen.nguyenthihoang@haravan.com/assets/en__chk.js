/* haravan-audit:v2 */
window.BS = window.BS || {};
BS.Collection = BS.Collection || {
  activeFilters: {},
  _priceFilterVal: '',
  _priceLabelMap: {},

  init: function() {
    BS.Collection.bindFilterGroups();
    BS.Collection.bindSort();
    BS.Collection.bindClear();
    BS.Collection.bindPagination();
    BS.Collection.bindSubcats();
    BS.Collection.bindOccasionTabs();
    BS.Collection.bindSidebar();
    BS.Collection.bindPopState();
    var grid = document.getElementById('collGrid');
    if (grid) BS.Collection.activateImages(grid);
    BS.Collection.restoreFromUrl();
  },

  getBaseQuery: function() {
    var el = document.getElementById('coll-handle');
    return el ? '(' + el.value + ')' : '';
  },

  buildFilterQuery: function() {
    var base = BS.Collection.getBaseQuery();
    var af = BS.Collection.activeFilters;
    var parts = [];
    Object.keys(af).forEach(function(type) {
      var vals = af[type];
      if (!vals || !vals.length) return;
      parts.push('(' + vals.join('||') + ')');
    });
    if (parts.length) return base + '&&' + parts.join('&&');
    return base;
  },

  getSortVal: function() {
    var sel = document.querySelector('.coll__sort-select');
    return sel ? sel.value : '';
  },

  hasActiveFilter: function() {
    return Object.keys(BS.Collection.activeFilters).some(function(k) {
      return BS.Collection.activeFilters[k] && BS.Collection.activeFilters[k].length;
    });
  },

  buildSearchUrl: function(page) {
    var q = BS.Collection.buildFilterQuery();
    var sort = BS.Collection.getSortVal();
    var url = '/search?q=filter=' + encodeURIComponent(q) + '&view=filter.en&page=' + (page || 1);
    if (sort) url += '&sortby=' + encodeURIComponent(sort);
    return url;
  },

  buildCollectionUrl: function(page) {
    var handle = document.getElementById('collection-page');
    var collUrl = handle ? handle.getAttribute('data-handle') : '';
    var sort = BS.Collection.getSortVal();
    var url = collUrl + '?view=pagination.en&page=' + (page || 1);
    if (sort) url += '&sort_by=' + encodeURIComponent(sort);
    return url;
  },

  loadCollection: function(page) {
    var grid = document.getElementById('collGrid');
    var filterPagi = document.getElementById('collFilterPagi');
    var collPagi = document.getElementById('collPagi');
    if (!grid) return;

    var prevHtml = grid.innerHTML;
    grid.classList.add('is-loading');
    BS.Collection.showSkeleton(grid);

    var useSearch = BS.Collection.hasActiveFilter() || BS.Collection.getSortVal();
    var url = useSearch ? BS.Collection.buildSearchUrl(page) : BS.Collection.buildCollectionUrl(page);

    fetch(url)
      .then(function(r) { return r.text(); })
      .then(function(html) {
        if (html.indexOf('<!doctype html>') !== -1 || html.indexOf('<!DOCTYPE html>') !== -1) {
          grid.innerHTML = prevHtml;
          BS.Collection.activateImages(grid);
          grid.classList.remove('is-loading');
          return;
        }
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var products = doc.querySelector('[data-products]');
        var pagi = doc.querySelector('[data-pagi]');
        grid.innerHTML = products ? products.innerHTML : html;
        BS.Collection.activateImages(grid);
        grid.classList.remove('is-loading');
        if (useSearch) {
          if (filterPagi) filterPagi.innerHTML = pagi ? pagi.innerHTML : '';
          if (collPagi) collPagi.innerHTML = '';
        } else {
          if (collPagi) collPagi.innerHTML = pagi ? pagi.innerHTML : '';
          if (filterPagi) filterPagi.innerHTML = '';
        }
        var totalAttr = products ? products.getAttribute('data-total') : null;
        var total = totalAttr != null ? parseInt(totalAttr) : null;
        BS.Collection.updateCount(total, useSearch);
        if (typeof BS !== 'undefined' && BS.Animations) BS.Animations.scrollReveal();
      })
      .catch(function() {
        grid.innerHTML = prevHtml;
        BS.Collection.activateImages(grid);
        grid.classList.remove('is-loading');
      });
  },

  showSkeleton: function(grid) {
    if (!grid) return;
    var count = grid.querySelectorAll('.product-tile, .product-card').length || 8;
    if (count > 12) count = 12;
    if (count < 4) count = 8;
    var card = '<div class="coll__skeleton" aria-hidden="true">' +
      '<div class="coll__skeleton-img"></div>' +
      '<div class="coll__skeleton-line coll__skeleton-line--lg"></div>' +
      '<div class="coll__skeleton-line coll__skeleton-line--sm"></div>' +
      '</div>';
    var html = '';
    for (var i = 0; i < count; i++) html += card;
    grid.innerHTML = html;
  },

  activateImages: function(scope) {
    if (!scope) return;
    var imgs = scope.querySelectorAll('img.lazyload, img[data-src]');
    imgs.forEach(function(img) {
      var dataSrc = img.getAttribute('data-src');
      if (dataSrc) {
        img.setAttribute('src', dataSrc);
        img.removeAttribute('data-src');
      }
      img.classList.remove('lazyload');
      img.classList.remove('isHideTBT');
    });
  },

  updateCount: function(total, useSearch) {
    var countEl = document.getElementById('filterCount');
    if (!countEl) return;
    var collCount = document.getElementById('collCount');
    var hasFilter = BS.Collection.hasActiveFilter();

    if (total != null && !isNaN(total)) {
      // Có dữ liệu thực từ AJAX → ưu tiên dùng
      countEl.textContent = total + ' result';
      if (collCount) collCount.textContent = '(' + total + ')';
      return;
    }
    // Fallback: chưa có filter → đếm sản phẩm gốc của collection
    if (!hasFilter && collCount) {
      countEl.textContent = collCount.textContent.replace(/[()]/g, '').trim() + ' result';
    }
  },

  updateHeading: function(title, count) {
    var titleEl = document.querySelector('.coll__title');
    var filterCountEl = document.getElementById('filterCount');
    if (titleEl) {
      titleEl.innerHTML = (title || '') + ' <span class="coll__count" id="collCount">(' + (count || 0) + ')</span>';
    }
    if (filterCountEl && count != null) filterCountEl.textContent = count + ' result';
  },

  switchSubcat: function() { /* deprecated — see bindSubcats */ },

  addFilter: function(type, val, label) {
    if (!BS.Collection.activeFilters[type]) BS.Collection.activeFilters[type] = [];
    if (BS.Collection.activeFilters[type].indexOf(val) === -1) {
      BS.Collection.activeFilters[type].push(val);
    }
    if (label) BS.Collection._priceLabelMap[val] = label;
    BS.Collection.renderActiveTags();
    BS.Collection.syncInputs();
    BS.Collection.syncSubcats();
    BS.Collection.syncUrl(false);
    BS.Collection.loadCollection(1);
  },

  removeFilter: function(type, val) {
    if (!BS.Collection.activeFilters[type]) return;
    BS.Collection.activeFilters[type] = BS.Collection.activeFilters[type].filter(function(v) { return v !== val; });
    delete BS.Collection._priceLabelMap[val];
    BS.Collection.renderActiveTags();
    BS.Collection.syncInputs();
    BS.Collection.syncSubcats();
    BS.Collection.syncUrl(false);
    BS.Collection.loadCollection(1);
  },

  clearAll: function() {
    BS.Collection.activeFilters = {};
    BS.Collection._priceLabelMap = {};
    BS.Collection.renderActiveTags();
    BS.Collection.syncInputs();
    BS.Collection.syncOccasionTabs();
    BS.Collection.syncSubcats();
    var minInput = document.getElementById('priceRangeMin');
    var maxInput = document.getElementById('priceRangeMax');
    if (minInput) minInput.value = minInput.min;
    if (maxInput) maxInput.value = maxInput.max;
    BS.Collection.initPriceRange();
    BS.Collection.syncUrl(false);
    BS.Collection.loadCollection(1);
  },

  /* ── URL sync: filters + sort vào query string ngắn gọn, dễ đọc ── */
  _sortToShort: {
    '(price:product=asc)': 'gia-tang',
    '(price:product=desc)': 'gia-giam',
    '(title:product=asc)': 'ten-az',
    '(title:product=desc)': 'ten-za',
    '(sold_quantity:product=desc)': 'ban-chay'
  },
  _shortToSort: {
    'gia-tang': '(price:product=asc)',
    'gia-giam': '(price:product=desc)',
    'ten-az': '(title:product=asc)',
    'ten-za': '(title:product=desc)',
    'ban-chay': '(sold_quantity:product=desc)'
  },
  _typeKeys: ['type', 'size', 'color', 'material', 'occasion', 'vendor'],

  fmtMoney: function(v) {
    return parseInt(v).toLocaleString('vi-VN') + 'đ';
  },

  findValByLabel: function(type, label) {
    var els = document.querySelectorAll('[data-filter-type="' + type + '"]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].getAttribute('data-filter-label') === label) {
        return els[i].getAttribute('data-filter-val');
      }
    }
    return null;
  },

  syncUrl: function(replace) {
    if (!window.history || !history.replaceState) return;
    var af = BS.Collection.activeFilters;
    var sort = BS.Collection.getSortVal();
    var defaultSort = '(updated_at:product=desc)';

    var params = new URLSearchParams(window.location.search);
    BS.Collection._typeKeys.concat(['price', 'sort', 'bsf', 'bss']).forEach(function(k) {
      params.delete(k);
    });

    Object.keys(af).forEach(function(type) {
      var vals = af[type];
      if (!vals || !vals.length) return;
      if (type === 'price') {
        var m = vals[0].match(/price:product>=(\d+).*?price:product<=(\d+)/);
        if (m) params.set('price', m[1] + '-' + m[2]);
        return;
      }
      var labels = vals.map(function(v) { return BS.Collection.getLabelForVal(v); });
      params.set(type, labels.join(','));
    });

    if (sort && sort !== defaultSort) {
      params.set('sort', BS.Collection._sortToShort[sort] || sort);
    }

    var qs = params.toString();
    var newUrl = window.location.pathname + (qs ? '?' + qs : '');
    var state = { bsFilters: true };
    if (replace === false) {
      history.pushState(state, '', newUrl);
    } else {
      history.replaceState(state, '', newUrl);
    }
  },

  restoreFromUrl: function() {
    var params = new URLSearchParams(window.location.search);
    var restored = false;

    BS.Collection.activeFilters = {};
    BS.Collection._priceLabelMap = {};

    BS.Collection._typeKeys.forEach(function(type) {
      var raw = params.get(type);
      if (!raw) return;
      raw.split(',').forEach(function(label) {
        label = label.trim();
        if (!label) return;
        var val = BS.Collection.findValByLabel(type, label);
        if (!val) return;
        if (!BS.Collection.activeFilters[type]) BS.Collection.activeFilters[type] = [];
        if (BS.Collection.activeFilters[type].indexOf(val) === -1) {
          BS.Collection.activeFilters[type].push(val);
          restored = true;
        }
      });
    });

    var price = params.get('price');
    if (price) {
      var pm = price.match(/^(\d+)-(\d+)$/);
      if (pm) {
        var minV = parseInt(pm[1]);
        var maxV = parseInt(pm[2]);
        var filterVal = '((price:product>=' + minV + ')&&(price:product<=' + maxV + '))';
        BS.Collection.activeFilters['price'] = [filterVal];
        BS.Collection._priceLabelMap[filterVal] = BS.Collection.fmtMoney(minV) + ' – ' + BS.Collection.fmtMoney(maxV);
        var minInput = document.getElementById('priceRangeMin');
        var maxInput = document.getElementById('priceRangeMax');
        if (minInput) minInput.value = minV;
        if (maxInput) maxInput.value = maxV;
        restored = true;
      }
    }

    var sortShort = params.get('sort');
    if (sortShort) {
      var full = BS.Collection._shortToSort[sortShort] || sortShort;
      var sel = document.querySelector('.coll__sort-select');
      if (sel) { sel.value = full; restored = true; }
    }

    if (restored) {
      BS.Collection.renderActiveTags();
      BS.Collection.syncInputs();
      BS.Collection.syncOccasionTabs();
      BS.Collection.syncSubcats();
      BS.Collection.initPriceRange();
      BS.Collection.loadCollection(1);
    }
  },

  renderActiveTags: function() {
    var container = document.getElementById('activeTags');
    var clearBtn = document.getElementById('filterClear');
    var countEl = document.getElementById('filterCount');
    if (!container) return;

    var tags = [];
    var af = BS.Collection.activeFilters;
    Object.keys(af).forEach(function(type) {
      (af[type] || []).forEach(function(val) {
        var label = BS.Collection._priceLabelMap[val] || BS.Collection.getLabelForVal(val);
        tags.push({ type: type, val: val, label: label });
      });
    });

    container.innerHTML = tags.map(function(t) {
      var esc = function(s) {
        return (s == null ? '' : String(s))
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      };
      var label = esc(t.label);
      return '<span class="coll__active-tag">' +
        '<span>' + label + '</span>' +
        '<button type="button" class="coll__active-tag-remove" data-type="' + esc(t.type) + '" data-val="' + esc(t.val) + '" aria-label="Xóa ' + label + '">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        '</button></span>';
    }).join('');

    if (clearBtn) clearBtn.style.display = tags.length ? 'inline-flex' : 'none';
    if (countEl && tags.length) countEl.textContent = tags.length + ' filter';
  },

  getLabelForVal: function(val) {
    var el = document.querySelector('[data-filter-val="' + CSS.escape(val) + '"]');
    if (el) return el.getAttribute('data-filter-label') || val;
    return val;
  },

  syncInputs: function() {
    var af = BS.Collection.activeFilters;
    document.querySelectorAll('[data-filter-type]').forEach(function(el) {
      var type = el.getAttribute('data-filter-type');
      var val = el.getAttribute('data-filter-val');
      var active = !!(af[type] && af[type].indexOf(val) !== -1);
      if (el.tagName === 'INPUT') {
        el.checked = active;
      } else if (el.tagName === 'BUTTON') {
        el.classList.toggle('is-active', active);
      }
    });
  },

  bindFilterGroups: function() {
    BS.Collection.initPriceRange();

    document.addEventListener('change', function(e) {
      var el = e.target;
      if (el.tagName !== 'INPUT' || !el.hasAttribute('data-filter-type')) return;
      var type = el.getAttribute('data-filter-type');
      var val = el.getAttribute('data-filter-val');
      var label = el.getAttribute('data-filter-label');
      if (el.checked) {
        BS.Collection.addFilter(type, val, label);
      } else {
        BS.Collection.removeFilter(type, val);
      }
    });

    document.addEventListener('click', function(e) {
      var el = e.target.closest('[data-filter-type]');
      if (!el || el.tagName !== 'BUTTON' || el.classList.contains('coll__filter-group-head')) return;
      if (el.classList.contains('coll__filter-size') || el.classList.contains('coll__filter-color')) {
        var type = el.getAttribute('data-filter-type');
        var val = el.getAttribute('data-filter-val');
        var label = el.getAttribute('data-filter-label');
        var af = BS.Collection.activeFilters;
        if (af[type] && af[type].indexOf(val) !== -1) {
          BS.Collection.removeFilter(type, val);
        } else {
          BS.Collection.addFilter(type, val, label);
        }
      }
    });

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.coll__active-tag-remove');
      if (!btn) return;
      var type = btn.getAttribute('data-type');
      var val = btn.getAttribute('data-val');
      if (type === 'price') {
        var minInput = document.getElementById('priceRangeMin');
        var maxInput = document.getElementById('priceRangeMax');
        if (minInput) minInput.value = minInput.min;
        if (maxInput) maxInput.value = maxInput.max;
        BS.Collection.initPriceRange();
      }
      BS.Collection.removeFilter(type, val);
    });

    document.addEventListener('click', function(e) {
      var head = e.target.closest('.coll__filter-group-head');
      if (!head) return;
      var group = head.closest('.coll__filter-group');
      var body = group.querySelector('.coll__filter-body');
      var expanded = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', String(!expanded));
      if (expanded) {
        body.style.maxHeight = body.scrollHeight + 'px';
        requestAnimationFrame(function() {
          body.style.maxHeight = '0';
          group.classList.add('is-collapsed');
        });
      } else {
        group.classList.remove('is-collapsed');
        body.style.maxHeight = body.scrollHeight + 'px';
        setTimeout(function() { body.style.maxHeight = ''; }, 300);
      }
    });
  },

  bindSort: function() {
    document.addEventListener('change', function(e) {
      if (!e.target.classList.contains('coll__sort-select')) return;
      BS.Collection.syncUrl(false);
      BS.Collection.loadCollection(1);
    });
  },

  bindClear: function() {
    document.addEventListener('click', function(e) {
      if (e.target.id === 'filterClear' || e.target.id === 'emptyClearBtn') {
        e.preventDefault();
        BS.Collection.clearAll();
      }
    });
  },

  bindPagination: function() {
    document.addEventListener('click', function(e) {
      var item = e.target.closest('.pagination__item[data-link]');
      if (!item) return;
      e.preventDefault();
      var link = item.getAttribute('data-link');
      var pagi = item.closest('.pagination');
      var cur = pagi ? Number(pagi.getAttribute('data-current')) : 1;
      if (link === 'm') link = cur - 1;
      if (link === 'p') link = cur + 1;
      link = parseInt(link);
      if (link > 0) {
        BS.Collection.loadCollection(link);
        var page = document.getElementById('collection-page');
        if (page) window.scrollTo({ top: page.offsetTop - 120, behavior: 'smooth' });
      }
    });
  },

  initPriceRange: function() {
    var minInput = document.getElementById('priceRangeMin');
    var maxInput = document.getElementById('priceRangeMax');
    var fill = document.getElementById('priceRangeFill');
    var minLabel = document.getElementById('priceMin');
    var maxLabel = document.getElementById('priceMax');
    if (!minInput || !maxInput) return;

    function fmt(v) {
      return parseInt(v).toLocaleString('vi-VN') + 'đ';
    }
    function updateFill() {
      var minVal = parseInt(minInput.value);
      var maxVal = parseInt(maxInput.value);
      var total = parseInt(minInput.max);
      var leftPct = (minVal / total * 100).toFixed(2);
      var rightPct = (maxVal / total * 100).toFixed(2);
      if (fill) {
        fill.style.left = leftPct + '%';
        fill.style.width = (rightPct - leftPct) + '%';
      }
      if (minLabel) minLabel.textContent = fmt(minVal);
      if (maxLabel) maxLabel.textContent = fmt(maxVal);
    }

    var _timer = null;
    function onInput() {
      var minVal = parseInt(minInput.value);
      var maxVal = parseInt(maxInput.value);
      var gap = 50000;
      if (minVal > maxVal - gap) {
        if (this === minInput) { minInput.value = maxVal - gap; minVal = maxVal - gap; }
        else { maxInput.value = minVal + gap; maxVal = minVal + gap; }
      }
      updateFill();
      clearTimeout(_timer);
      _timer = setTimeout(function() {
        var minV = parseInt(minInput.value);
        var maxV = parseInt(maxInput.value);
        var total = parseInt(minInput.max);
        if (!BS.Collection.activeFilters['price']) BS.Collection.activeFilters['price'] = [];
        BS.Collection.activeFilters['price'] = [];
        if (minV > 0 || maxV < total) {
          var filterVal = '((price:product>=' + minV + ')&&(price:product<=' + maxV + '))';
          var lbl = fmt(minV) + ' – ' + fmt(maxV);
          BS.Collection.activeFilters['price'].push(filterVal);
          BS.Collection._priceLabelMap[filterVal] = lbl;
        }
        BS.Collection.renderActiveTags();
        BS.Collection.syncUrl(false);
        BS.Collection.loadCollection(1);
      }, 600);
    }

    minInput.removeEventListener('input', minInput._onInput);
    maxInput.removeEventListener('input', maxInput._onInput);
    minInput._onInput = onInput.bind(minInput);
    maxInput._onInput = onInput.bind(maxInput);
    minInput.addEventListener('input', minInput._onInput);
    maxInput.addEventListener('input', maxInput._onInput);
    updateFill();
  },

  bindSidebar: function() {
    var sidebar = document.getElementById('collSidebar');
    var overlay = document.getElementById('sidebarOverlay');
    var toggleBtn = document.getElementById('sidebarToggle');
    var closeBtn = document.getElementById('sidebarClose');
    var applyBtn = document.getElementById('sidebarApply');
    var resetBtn = document.getElementById('sidebarReset');
    if (!sidebar) return;

    function openSidebar() {
      sidebar.classList.add('is-open');
      if (overlay) { overlay.classList.add('is-visible'); }
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
      sidebar.classList.remove('is-open');
      if (overlay) { overlay.classList.remove('is-visible'); }
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    if (toggleBtn) toggleBtn.addEventListener('click', function() {
      if (window.innerWidth > 991) return;
      sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);
    if (applyBtn) applyBtn.addEventListener('click', closeSidebar);
    if (resetBtn) resetBtn.addEventListener('click', function() {
      BS.Collection.clearAll();
      closeSidebar();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) closeSidebar();
    });

    window.addEventListener('resize', function() {
      if (window.innerWidth > 991 && sidebar.classList.contains('is-open')) {
        closeSidebar();
      }
    });
  },

  bindSubcats: function() {
    var wrap = document.getElementById('subcatsWrap');
    var track = document.getElementById('subcatTrack');
    var prevBtn = wrap ? wrap.querySelector('[data-subcat-prev]') : null;
    var nextBtn = wrap ? wrap.querySelector('[data-subcat-next]') : null;
    if (!track) return;

    var items = track.querySelectorAll('[data-subcat]');
    if (wrap && items.length >= 6) {
      wrap.classList.add('has-many');
    }

    // Click subcat → toggle filter type inline (multi-select, đồng bộ với sidebar checkbox)
    track.addEventListener('click', function(e) {
      var el = e.target.closest('[data-subcat]');
      if (!el) return;
      e.preventDefault();

      var val = el.getAttribute('data-filter-val');
      var label = el.getAttribute('data-filter-label');
      var current = BS.Collection.activeFilters['type'] || [];
      var isOn = current.indexOf(val) !== -1;

      if (isOn) {
        BS.Collection.removeFilter('type', val);
      } else {
        BS.Collection.addFilter('type', val, label);
      }
      // addFilter/removeFilter đã tự gọi syncSubcats + syncInputs + renderActiveTags + syncUrl + loadCollection
    });

    function getStep() {
      var item = track.querySelector('[data-subcat]');
      return item ? item.offsetWidth + 12 : 242;
    }
    function update() {
      if (!prevBtn || !nextBtn) return;
      prevBtn.classList.toggle('is-hidden', track.scrollLeft <= 4);
      nextBtn.classList.toggle('is-hidden', track.scrollLeft + track.clientWidth >= track.scrollWidth - 4);
    }
    if (prevBtn) prevBtn.addEventListener('click', function() { track.scrollBy({ left: -getStep() * 6, behavior: 'smooth' }); });
    if (nextBtn) nextBtn.addEventListener('click', function() { track.scrollBy({ left: getStep() * 6, behavior: 'smooth' }); });
    track.addEventListener('scroll', update, { passive: true });
    update();

    BS.Collection.syncSubcats();
  },

  syncSubcats: function() {
    var track = document.getElementById('subcatTrack');
    if (!track) return;
    var wrap = document.getElementById('subcatsWrap');
    var active = BS.Collection.activeFilters['type'] || [];

    track.querySelectorAll('[data-subcat]').forEach(function(el) {
      var val = el.getAttribute('data-filter-val');
      var on = active.indexOf(val) !== -1;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', String(on));
    });

    if (wrap) wrap.classList.toggle('has-active', active.length > 0);

    // UX: nếu user vừa tick subcat → đảm bảo nhóm "Danh mục sản phẩm" trong sidebar đang mở
    if (active.length > 0) {
      var fgType = document.getElementById('fg-type');
      if (fgType && fgType.classList.contains('is-collapsed')) {
        var head = fgType.querySelector('.coll__filter-group-head');
        var body = fgType.querySelector('.coll__filter-body');
        if (head) head.setAttribute('aria-expanded', 'true');
        fgType.classList.remove('is-collapsed');
        if (body) body.style.maxHeight = '';
      }
    }
  },

  bindOccasionTabs: function() {
    var tabsWrap = document.getElementById('occasionTabs');
    if (!tabsWrap) return;

    // Khởi tạo has-many + nav arrows (dùng lại logic subcats)
    var wrap = document.getElementById('occasionTabsWrap');
    var prevBtn = wrap ? wrap.querySelector('[data-subcat-prev]') : null;
    var nextBtn = wrap ? wrap.querySelector('[data-subcat-next]') : null;
    if (wrap && tabsWrap.querySelectorAll('[data-occasion-tab]').length >= 6) {
      wrap.classList.add('has-many');
    }
    function getStep() {
      var item = tabsWrap.querySelector('[data-occasion-tab]');
      return item ? item.offsetWidth + 12 : 242;
    }
    function updateNav() {
      if (!prevBtn || !nextBtn) return;
      prevBtn.classList.toggle('is-hidden', tabsWrap.scrollLeft <= 4);
      nextBtn.classList.toggle('is-hidden', tabsWrap.scrollLeft + tabsWrap.clientWidth >= tabsWrap.scrollWidth - 4);
    }
    if (prevBtn) prevBtn.addEventListener('click', function() { tabsWrap.scrollBy({ left: -getStep() * 6, behavior: 'smooth' }); });
    if (nextBtn) nextBtn.addEventListener('click', function() { tabsWrap.scrollBy({ left: getStep() * 6, behavior: 'smooth' }); });
    tabsWrap.addEventListener('scroll', updateNav, { passive: true });
    updateNav();

    // Dim effect: nếu có tab active thì dim các tab khác
    if (wrap && tabsWrap.querySelector('[data-occasion-tab].is-active')) {
      wrap.classList.add('has-active');
    }

    tabsWrap.addEventListener('click', function(e) {
      var tab = e.target.closest('[data-occasion-tab]');
      if (!tab) return;
      e.preventDefault();

      var val = tab.getAttribute('data-filter-val');
      var label = tab.getAttribute('data-filter-label');
      var active = BS.Collection.activeFilters['occasion'] || [];
      var isOn = active.indexOf(val) !== -1;

      // Xóa toàn bộ occasion filter hiện tại
      BS.Collection.activeFilters['occasion'] = [];
      active.forEach(function(v) { delete BS.Collection._priceLabelMap[v]; });

      if (!isOn) {
        // Chọn tab mới
        BS.Collection.activeFilters['occasion'] = [val];
        if (label) BS.Collection._priceLabelMap[val] = label;
      }
      // Nếu isOn → click lại tab đang active → bỏ chọn (hiện tất cả)

      BS.Collection.syncOccasionTabs();
      BS.Collection.renderActiveTags();
      BS.Collection.syncInputs();
      BS.Collection.syncUrl(false);
      BS.Collection.loadCollection(1);
    });

    BS.Collection.syncOccasionTabs();
  },

  syncOccasionTabs: function() {
    var tabsWrap = document.getElementById('occasionTabs');
    if (!tabsWrap) return;
    var wrap = document.getElementById('occasionTabsWrap');
    var active = BS.Collection.activeFilters['occasion'] || [];

    tabsWrap.querySelectorAll('[data-occasion-tab]').forEach(function(tab) {
      var val = tab.getAttribute('data-filter-val');
      var on = active.indexOf(val) !== -1;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
    });

    if (wrap) wrap.classList.toggle('has-active', active.length > 0);
  },

  bindPopState: function() {
    window.addEventListener('popstate', function(e) {
      if (e.state && e.state.bsSubcat) {
        // Legacy state từ phiên bản cũ (subcat = collection link)
        window.location.reload();
        return;
      }
      // Khôi phục filter/sort từ query string của URL hiện tại
      var params = new URLSearchParams(window.location.search);
      var hasFilterParam = BS.Collection._typeKeys.some(function(k) { return params.get(k); }) || params.get('price') || params.get('sort');
      if (hasFilterParam) {
        BS.Collection.restoreFromUrl();
      } else {
        // Không còn filter trong URL → reset về trạng thái gốc
        BS.Collection.activeFilters = {};
        BS.Collection._priceLabelMap = {};
        var sel = document.querySelector('.coll__sort-select');
        if (sel) sel.value = '(updated_at:product=desc)';
        BS.Collection.renderActiveTags();
        BS.Collection.syncInputs();
        BS.Collection.syncOccasionTabs();
        BS.Collection.syncSubcats();
        var minInput = document.getElementById('priceRangeMin');
        var maxInput = document.getElementById('priceRangeMax');
        if (minInput) minInput.value = minInput.min;
        if (maxInput) maxInput.value = maxInput.max;
        BS.Collection.initPriceRange();
        BS.Collection.loadCollection(1);
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', function() {
  if (typeof BS !== 'undefined' && BS.Collection) {
    BS.Collection.init();
  }

  var descBtn = document.getElementById('collDescBtn');
  var descInner = document.getElementById('collDescInner');
  if (descBtn && descInner) {
    descBtn.addEventListener('click', function() {
      var expanded = descInner.classList.toggle('is-expanded');
      descBtn.classList.toggle('is-expanded', expanded);
      descBtn.textContent = expanded ? 'COLLAPSE CONTENT' : 'CAN NOT OPEN MESSAGE';
      descBtn.setAttribute('aria-expanded', String(expanded));
    });
  }
});
