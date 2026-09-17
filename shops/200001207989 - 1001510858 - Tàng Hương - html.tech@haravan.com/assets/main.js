class TabsComponent extends HTMLElement {
  constructor() {
    super();
    this.tabBtns = Array.from(this.querySelectorAll(".tab-btn"));
    this.tabContent = Array.from(this.querySelectorAll(".tab-content"));
    this.tabBtns.forEach((el) => {
      el.addEventListener("click", this.onTabClick.bind(this));
    });
  }

  onTabClick(e) {
    e.preventDefault();
    const target = e.currentTarget.getAttribute("aria-controls");
    this.tabBtns.forEach((el) => {
      el.classList.remove("active");
      el.ariaSelected = false;
    });
    const activeTab = this.querySelector(`#${target}`);
    this.activeTab = activeTab;
    if (activeTab) {
      activeTab.classList.remove("hidden");
      publish("EGA:tab-update", {
        target: this,
        activeTab: activeTab,
      });
    }
    this.tabContent.forEach(
      (el) => el.id !== target && el.classList.add("hidden")
    );

    e.currentTarget.classList.add("active");
    e.currentTarget.ariaSelected = true;
  }
}
defineElement("tabs-component", TabsComponent);

class PortalComponent extends HTMLElement {
  constructor() {
    super();
    this.popup = this.querySelector("dialog");
    this.inner = this.querySelectorAll(".animation");
    this.animationTime = this.dataset.animation ? 400 : 0;
    this.querySelectorAll('[id^="PortalClose-"]').forEach((el) => {
      el.addEventListener("click", this.hide.bind(this, false));
    });
    this.addEventListener("keyup", (event) => {
      if (event.code && event.code.toUpperCase() === "ESCAPE") this.hide();
    });
    if (this.querySelector(".portal-overlay")) {
      this.querySelector(".portal-overlay").addEventListener(
        "click",
        this.hide.bind(this, false)
      );
    }
  }

  connectedCallback() {
    if (this.moved) return;
    this.moved = true;
    document.body.appendChild(this);
  }

  show(opener) {
    this.openedBy = opener;
    playAnimation({
      query: this.inner,
      animation: this.dataset.animation,
      time: this.animationTime,
    });
    document.body.classList.add("overflow-hidden");
    this.popup.setAttribute("open", "");
    this.classList.add("active");
  }

  hide() {
    playAnimation({
      query: this.inner,
      animation: this.dataset.animation,
      time: this.animationTime,
      direction: "reverse",
      callback: () => {
        document.body.dispatchEvent(new CustomEvent("PortalClosed"));
        this.popup.removeAttribute("open");
        this.classList.remove("active");
        if (!document.querySelector(".portal.active")) {
          document.body.classList.remove("overflow-hidden");
        }
      },
    });
  }
}
defineElement("portal-component", PortalComponent);

class PortalOpener extends HTMLElement {
  constructor() {
    super();

    this.button = this.querySelector("[data-portal]");

    if (!this.button) return;
    this.button.addEventListener("click", this.onClick.bind(this));
  }
  onClick(e) {
    e.preventDefault();
    const portal = document.querySelector(
      e.currentTarget.getAttribute("data-portal")
    );
    if (portal && portal.show) portal.show(this.button);
  }
}
defineElement("portal-opener", PortalOpener);

// load after interaction
subscribe(window.themeConfigs.firstInteraction, () => {
  class EGACarousel extends HTMLElement {
    constructor() {
      super();
      this.elements = {
        swiper: this.querySelector(".swiper:not(.swiper-media)"),
        desktopSwiper: this.querySelector(".swiper-desktop"),
        mobileSwiper: this.querySelector(".swiper-mobile"),
        pagination: this.querySelector(".swiper-wrapper ~ .swiper-pagination"),
        nextEl: this.querySelector(".swiper-wrapper ~ .swiper-button-next"),
        prevEl: this.querySelector(".swiper-wrapper ~ .swiper-button-prev"),
      };
      const { nextEl, prevEl, pagination, swiper } = this.elements;
      this.defaultParams = {
        slidesPerView: "auto",
        freeScroll: true,
        speed: 1000,
      };

      this.params = this.querySelector('[data-type="swiper-params"]')
        ? JSON.parse(
            this.querySelector('[data-type="swiper-params"]').textContent
          )
        : {};
      if (nextEl && prevEl) {
        this.params.navigation = {
          nextEl: nextEl,
          prevEl: prevEl,
        };
      }
      if (pagination) {
        this.params.pagination = {
          clickable: true,
          el: pagination,
        };
      }
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const images = this.querySelectorAll("img");
            images.forEach((image) => {
              image.removeAttribute("loading");
            });
            this.observer.disconnect(); // Stop observing after attribute removal
          }
        });
      });
    }

    connectedCallback() {
      this.start();
      this.observer.observe(this);
    }
    start() {
      const media = window.themeConfigs.lgBreakpoint;
      media.addEventListener("change", this.init.bind(this));
      this.init(media);
    }
    init(media) {
      const { swiper, desktopSwiper, mobileSwiper } = this.elements;
      this.swiper && this.swiper.destroy(true);

      // cache all slides will hide
      this.hiddenSlides = this.hiddenSlides || [
        ...this.querySelectorAll(
          ".swiper-hidden,.swiper-hidden-desktop, .swiper-hidden-mobile"
        ),
      ];

      // remove all slides will hide
      this.querySelectorAll(
        ".swiper-hidden,.swiper-hidden-desktop, .swiper-hidden-mobile"
      ).forEach((el) => el.remove());
      let settings = this.params || this.defaultParams;

      // if desktop show mobile slides
      if (!media.matches) {
        // filter swiper mobile
        let mobileSlides = this.hiddenSlides.filter((slide) =>
          slide.classList.contains("swiper-hidden-mobile")
        );
        mobileSlides.forEach((slide) => {
          this.querySelector(".swiper-wrapper").appendChild(slide);
        });
      } else {
        // filter swiper desktop
        let desktopSlides = this.hiddenSlides.filter((slide) =>
          slide.classList.contains("swiper-hidden-desktop")
        );
        desktopSlides.forEach((slide) => {
          this.querySelector(".swiper-wrapper").appendChild(slide);
        });
      }

      if (swiper) {
        this.swiper = new Swiper(swiper, settings);
      }
      if (desktopSwiper && !media.matches) {
        this.swiper = new Swiper(desktopSwiper, settings);
      }
      if (mobileSwiper && media.matches) {
        this.swiper = new Swiper(mobileSwiper, settings);
      }
    }
  }
  defineElement("ega-carousel", EGACarousel);
  class SlideShow extends HTMLElement {
    constructor() {
      super();
      this.slider = this.querySelector("ega-carousel");
    }
    connectedCallback() {
      if (!this.slider) return;
      const media = window.themeConfigs.mbBreakpoint;
      media.addEventListener("change", this.onSlideChange.bind(this));
      this.onSlideChange();
      this.querySelectorAll("ega-carousel  img").forEach((img) => {
        img.removeAttribute("loading");
      });
    }

    onSlideChange() {
      if (this.slider && this.slider.swiper) {
        this.slider.swiper.on("slideChange", (swiper) => {
          let activeImg =
            swiper.slides[swiper.activeIndex].querySelector("img");
          if (activeImg) {
            // this.style.setProperty("--bg-image", `url(${activeImg.src})`);
          }
        });
      }
    }
  }
  defineElement("slideshow-component", SlideShow);
  class CopyButton extends HTMLElement {
    constructor() {
      super();
      this.copyBtn = this.querySelector(".copy-button");
      this.input = this.querySelector("input");
      this.copyBtn.addEventListener("click", this.copyToClipboard.bind(this));
    }
    copyToClipboard() {
      if (this.classList.contains("copied")) return;
      navigator.clipboard.writeText(this.input.value).then(() => {
        this.classList.add("copied");
        let textBeforeCopy = this.copyBtn.textContent;
        this.copyBtn.textContent = "Đã sao chép";
        setTimeout(() => {
          this.copyBtn.textContent = textBeforeCopy;
          this.classList.remove("copied");
        }, 3000);
      });
    }
  }
  defineElement("copy-button", CopyButton);

  class QuantityInput extends HTMLElement {
    constructor() {
      super();
      this.input = this.querySelector("input");
      this.changeEvent = new Event("change", { bubbles: true });

      this.input.addEventListener("input", this.onInputChange.bind(this));
      this.querySelectorAll("button").forEach((button) =>
        button.addEventListener("click", this.onButtonClick.bind(this))
      );
    }

    quantityUpdateUnsubscriber = undefined;

    connectedCallback() {
      this.validateQtyRules();
      this.quantityUpdateUnsubscriber = subscribe(
        window.themeConfigs.quantityUpdate,
        this.validateQtyRules.bind(this)
      );
    }

    disconnectedCallback() {
      if (this.quantityUpdateUnsubscriber) {
        this.quantityUpdateUnsubscriber();
      }
    }

    onInputChange(event) {
      this.validateQtyRules();
    }

    onButtonClick(event) {
      event.preventDefault();
      const previousValue = this.input.value;
      event.currentTarget.name === "plus"
        ? this.input.stepUp()
        : this.input.stepDown();
      if (previousValue !== this.input.value)
        this.input.dispatchEvent(this.changeEvent);
    }

    validateQtyRules() {
      const value = parseInt(this.input.value);
      if (this.input.min) {
        const min = parseInt(this.input.min);
        const buttonMinus = this.querySelector("[name='minus']");
        buttonMinus.classList.toggle("disabled", value <= min);
        if (value < min) {
          this.input.value = this.input.min;
        }
      }
      if (this.input.max) {
        const max = parseInt(this.input.max);
        const buttonPlus = this.querySelector("[name='plus']");
        buttonPlus.classList.toggle("disabled", value >= max);
        if (value > max) {
          this.input.value = max;
        }
      }

      if (this.input.value.length > 3) {
        this.input.value = this.input.value.substring(0, 2);
      }
    }
  }
  defineElement("quantity-input", QuantityInput);
  class MenuDrawer extends PortalComponent {
    constructor() {
      super();
      this.loadMenu();
    }

    async loadMenu() {
      const response = await fetch("/?view=menu");
      const res = await response.text();
      const html = new DOMParser().parseFromString(res, "text/html");
      if (html.querySelector("nav")) {
        this.querySelector("nav").innerHTML =
          html.querySelector("nav").innerHTML;

        this.querySelectorAll("[data-toggle-submenu]").forEach((el) =>
          el.addEventListener("click", this.toggleSubmenu.bind(this))
        );
      }
    }
    toggleSubmenu(e) {
      e.preventDefault();
      e.stopPropagation();

      const { currentTarget } = e;
      const menuItem = currentTarget.closest(".menu-item");
      const media = window.themeConfigs.lgBreakpoint;

      if (menuItem && media.matches) {
        const submenuElements = menuItem.querySelectorAll(".submenu");
        const isMenuActive = menuItem.classList.contains("menu-active");
        !isMenuActive && menuItem.classList.add("menu-active");
        playAnimation({
          query: submenuElements,
          animation: "slide-in-left",
          time: 400,
          direction: !isMenuActive ? "normal" : "reverse",
          callback: () => {
            if (isMenuActive) {
              menuItem.classList.remove("menu-active");
            }
          },
        });
      }
    }
  }
  defineElement("menu-drawer", MenuDrawer);

  class QuickSearch extends HTMLElement {
    constructor() {
      super();

      this.searchResult = this.querySelector(".search-result");
      this.input = this.querySelector('[name="q"]');
      this.collectionOptions = this.querySelector(".collection-options");
      this.collectionId = this.collectionOptions
        ? this.collectionOptions.value
        : "";
      this.query = "";
      this.storageKey = window.themeConfigs.searchStorage;
      this.input.addEventListener("input", (e) => {
        setTimeout(() => {
          this.onChange(e);
        }, 500);
      });
      this.collectionOptions &&
        this.collectionOptions.addEventListener(
          "change",
          this.onOptionSelect.bind(this)
        );
      this.querySelector("form").addEventListener(
        "submit",
        this.onSubmit.bind(this)
      );
      this.renderHistory();
    }
    connectedCallback() {
      this.changePosition();
    }
    changePosition() {
      let searchDrawer = document.querySelector("#search-drawer .search-bar");
      let currentPositon = document.querySelector("header .search-bar");
      if (!document.querySelector("#search-drawer .quick-search")) {
        let clone = this.cloneNode(true);
        searchDrawer.appendChild(clone);
      }
    }

    onSubmit(e) {
      if (this.collectionId) {
        e.preventDefault();
        let url = `/search?q=filter=((collectionid:product=${this.collectionId} )&&((title:product contains ${this.query})))`;
        window.location.href = url;
      }
      this.addHistory();
    }
    onOptionSelect(e) {
      this.collectionId = e.currentTarget.value;
      this.onChange(this.query);
    }
    onChange(e) {
      let value = e.target ? e.target.value.trim() : e;
      if (e.target && this.query == value) return;

      this.query = value;
      if (!this.query) {
        this.searchResult.innerHTML = "";
        this.classList.remove("loading", "loaded");
        return;
      }
      if (!this.searchResult) return;
      this.classList.add("loading");
      let url = `/search?q=${this.query}&type=product&view=quick-search`;
      if (this.collectionId) {
        url = `/search?q=filter=((collectionid:product=${this.collectionId} )&&((title:product contains ${this.query})))&view=quick-search`;
      }
      fetch(url)
        .then((response) => response.text())
        .then((res) => {
          if (this.searchResult.innerHTML != res) {
            this.searchResult.innerHTML = res.replace("[query]", this.query);
          }
          this.classList.remove("loading");
          this.classList.add("loaded");
        })
        .catch((e) => {
          this.classList.remove("loading");
        });
    }
    getHistory() {
      return JSON.parse(localStorage.getItem(this.storageKey)) || [];
    }
    removeHistory(e) {
      e.stopPropagation();
      e.preventDefault();
      let history = this.getHistory();
      let removeText = e.currentTarget.dataset.remove;
      history = history.filter((key) => key != removeText);
      if (!history.length) localStorage.removeItem(this.storageKey);
      localStorage.setItem(this.storageKey, JSON.stringify(history));
      this.renderHistory();
    }
    renderHistory() {
      let history = this.getHistory();
      let historyList = history.slice(0, 5).map((keyword) => {
        return `<a class="search-history-item cursor-pointer py-2 flex items-center gap-2 px-2 hover:bg-neutral-50 rounded-sm  " href="/search?q=${keyword}&type=product" data-text="${keyword}">
			  <i class="icon icon-search-history text-h6 text-neutral-100"></i>
			  <span>${keyword}</span>
			  <button data-remove="${keyword}" class="ml-auto opacity-50 hover:opacity-100" aria-label="Xóa"><i class="icon icon-cross text-h6 text-neutral-200"></i></button>
			</a>`;
      });
      if (!this.querySelector(".search-history-list")) return;
      this.querySelector(".search-history-list").innerHTML =
        historyList.join("");
      this.querySelectorAll("[data-remove]").forEach((el) =>
        el.addEventListener("click", this.removeHistory.bind(this))
      );
    }

    addHistory() {
      if (!this.query) return;
      let history = this.getHistory();
      history = history.filter((key) => key != this.query);
      history.unshift(this.query);
      history = history.slice(0, 5);
      localStorage.setItem(this.storageKey, JSON.stringify(history));
      this.renderHistory();
    }
  }

  defineElement("quick-search", QuickSearch);

  class TabsSection extends TabsComponent {
    constructor() {
      super();
    }
    async getContent(contentUrl, tab) {
      if (!contentUrl && !tab) return;
      if (tab.classList.contains("loaded")) return;
      tab.classList.add("loading");
      const response = await fetch(contentUrl);
      const res = await response.text();
      tab.classList.remove("loading");
      tab.classList.add("loaded");
      const html = new DOMParser().parseFromString(res, "text/html");
      const limit = parseInt(tab.dataset.limit);
      const itemSelector = this.dataset.type;
      if (itemSelector && html.querySelector(itemSelector)) {
        const cardProducts = Array.from(
          html.querySelectorAll(itemSelector)
        ).slice(0, limit);
        const tabContent = document.createElement("Div");
        cardProducts.forEach((card) => {
          tab.querySelector(".tab-content-inner").appendChild(card);
        });
        tab.querySelector(".placeholder").classList.add("hidden");
        publish("EGA:product-loaded", {
          data: html,
        });
      } else {
        tab.querySelector(".tab-content-inner").innerHTML =
          html.querySelector(".data").innerHTML;
      }
    }
    onTabClick(e) {
      super.onTabClick(e);
      const { url, contentUrl } = this.activeTab.dataset || "";
      this.querySelectorAll(".tab-url").forEach((el) => {
        el.href = url;
      });
      if (contentUrl) {
        this.getContent(contentUrl, this.activeTab);
      }
    }
  }
  defineElement("tabs-section", TabsSection);

  class PromoPopup extends PortalComponent {
    constructor() {
      super();
      this.storageKey = "egaPromoPopuptorage";
    }
    connectedCallback() {
      !sessionStorage.getItem(this.storageKey) && this.show();
      sessionStorage.setItem(this.storageKey, true);
    }
  }

  defineElement("promo-popup", PromoPopup);
        
        
  class VideoReview extends HTMLElement {
    constructor() {
      super();
      this.videos = this.querySelectorAll('.review-video__item');
      this.videos.forEach((el) => {
        el.addEventListener('click', () => {
          this.lightbox(el);
        });
      });
    }
    lightbox(el) {
      let index = parseInt(el.dataset.index) + 1;
      if (!Spotlight) return;
      let imageList = Array.from(this.videos).map((el) => {
        if (el.dataset.video) {
          let src = el.dataset.video;
          return {
            media: 'video',
            'src-webm': src,
            'src-ogg': src,
            'src-mp4': src,
            poster: el.querySelector('img').src,
            autoplay: true,
            muted: true,
            preload: true,
            controls: true,
            inline: true,
          };
        }
        if (el.dataset.videoUrl) {
          let src = el.dataset.videoUrl;
          let videoId = this.getYouTubeVideoId(src);
          if (videoId) {
            let url = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1`;
            let type = src.indexOf('youtube.com/shorts/') !== -1 ? 'sort' : 'video';
            return {
              media: 'node',
              src: (function () {
                const iframe = document.createElement('iframe');
                iframe.allow =
                  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
                if (type == 'sort') {
                  iframe.classList.add(
                    'max-w-[375px]',
                    'w-full',
                    'aspect-[9/16]',
                    'iframe',
                    'container',
                  );
                } else {
                  iframe.classList.add('aspect-video', 'iframe', 'container');
                }
                iframe.src = url;
                iframe.dataset.src = iframe.src;
                iframe.wdith = 560;
                iframe.height = 315;
                iframe.setAttribute('frameborder', '0');
                iframe.setAttribute('autoplay', '');
                iframe.setAttribute('controls', '');
                iframe.setAttribute('playsinline', '');
                iframe.setAttribute('allowfullscreen', '');
                return iframe;
              })(),
            };
          }
          videoId = this.getTikTokVideoId(src);
          if (videoId) {
            let url = `https://www.tiktok.com/embed/v2/${videoId}`;
            return {
              media: 'node',
              src: (function () {
                const iframe = document.createElement('iframe');
                iframe.allow =
                  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
                iframe.classList.add('max-w-[315px]', 'iframe');
                iframe.src = url;
                iframe.dataset.src = iframe.src;
                iframe.wdith = 560;
                iframe.height = 315;
                iframe.setAttribute('frameborder', '0');
                iframe.setAttribute('allowfullscreen', 'true');
                iframe.setAttribute('muted', 'false');
                iframe.setAttribute(
                  'sandbox',
                  'allow-popups allow-popups-to-escape-sandbox allow-scripts allow-top-navigation allow-same-origin',
                );

                return iframe;
              })(),
            };
          }
        }
      });
      Spotlight.show(imageList.filter(Boolean), {
        onchange: function (index, options) {
          let slide = index - 1;
          if (options.media == 'node' && options.src.classList.contains('iframe')) {
            options.src.src = options.src.dataset.src;
          }
        },
      });
      Spotlight.goto(index);
    }
    connectedCallback() {
      // Add your custom logic here
    }
    getTikTokVideoId(url) {
      const regex = /https?:\/\/(?:www\.)?tiktok\.com\/@[^/]+\/video\/(\d+)/;

      const match = url.match(regex);

      return match ? match[1] : null;
    }

    getYouTubeVideoId(url) {
      let videoId = '';
      // Extract video ID from different YouTube URL formats
      if (url.indexOf('youtube.com/watch?v=') !== -1) {
        // Example: https://www.youtube.com/watch?v=VIDEO_ID
        let match = url.match(/youtube\.com\/watch\?v=([^&]+)/);
        if (match) {
          videoId = match[1];
        }
      } else if (url.indexOf('youtu.be/') !== -1) {
        // Example: https://youtu.be/VIDEO_ID
        let match = url.match(/youtu\.be\/([^&]+)/);
        if (match) {
          videoId = match[1];
        }
      } else if (url.indexOf('youtube.com/embed/') !== -1) {
        // Example: https://www.youtube.com/embed/VIDEO_ID
        let match = url.match(/youtube\.com\/embed\/([^&]+)/);
        if (match) {
          videoId = match[1];
        }
      } else if (url.indexOf('youtube.com/shorts/') !== -1) {
        // Example: https://www.youtube.com/shorts/VIDEO_ID
        let match = url.match(/youtube\.com\/shorts\/([^&]+)/);
        if (match) {
          videoId = match[1];
        }
      }
      if (videoId.indexOf('?') !== -1) {
        videoId = videoId.split('?')[0];
      }

      return videoId;
    }
  }

  defineElement('video-review', VideoReview);
});
class ExpandableContent extends HTMLElement {
  constructor() {
    super();
    this.isExpanded = false;
    this.container = this.querySelector(".expandable-content");
    this.maxHeight = parseInt(this.getAttribute("max-height") || 200);
  }

  toggleHeight() {
    this.isExpanded = !this.isExpanded;
    const buttonText = this.isExpanded
      ? 'Thu gọn <i class="icon icon-carret-up"></i>'
      : 'Xem thêm <i class="icon icon-carret-down"></i>';
    this.button.innerHTML = buttonText;

    if (this.isExpanded) {
      this.contentElement.style.maxHeight = "none";
      this.container.classList.add("show-all");
    } else {
      this.contentElement.style.maxHeight = this.maxHeight + "px";
      this.container.classList.remove("show-all");
    }
  }
  init() {
    this.contentElement = this.querySelector(".content");
    const contentHeight = this.contentElement.scrollHeight;
    const button = document.createElement("button");
    this.button = button;
    this.isExpanded = false;
    if (isNaN(this.maxHeight)) {
      this.container.classList.add("show-all");
      return;
    }
    button.innerHTML = 'Xem thêm <i class="icon icon-carret-down"></i>';
    button.addEventListener("click", this.toggleHeight.bind(this));
    button.classList.add("btn", "btn-showmore");
    if (this.querySelector(".btn-showmore")) {
      this.querySelector(".btn-showmore").remove();
    }
    this.appendChild(button);
    if (this.maxHeight < 0 || contentHeight < this.maxHeight) {
      this.button.style.display = "none";
      this.container.classList.add("show-all");
    } else {
      this.container.classList.remove("show-all");
      this.button.style.display = "flex";
      this.contentElement.style.maxHeight = this.maxHeight + "px";
    }
  }
  connectedCallback() {
    this.init();
    subscribe("EGA:tab-update", (e) => {
      if (
        e.activeTab &&
        e.activeTab.querySelector("expandable-content") == this
      ) {
        this.init();
      }
    });
  }
}
defineElement("expandable-content", ExpandableContent);

class ErrorPopup extends PortalComponent {
  constructor() {
    super();
    this.errorList = [];
  }
  connectedCallback() {
    subscribe(window.themeConfigs.error, (e) => {
      if (e && e.error) {
        if (e.error.name == "AbortError") return;
        this.errorList.push(e.error);
        this.renderError();
      }
    });
  }
  renderError() {
    let errors = this.errorList.map((e, i) => {
      return `<div class="error-item inline-flex w-auto items-start gap-1 bg-background text-error font-semibold rounded-sm px-3 py-2">
				${e.message || "Đã có lỗi xảy ra"}
						<button class="btn p-0 remove-error-btn" data-index="${i}">  <i class="icon icon-cross"> </i></button>

			</div>`;
    });
    this.querySelector(".error-list").innerHTML = errors.join("");
    this.querySelectorAll(".remove-error-btn").forEach((el) =>
      el.addEventListener("click", this.removeError.bind(this))
    );

    this.show();
    setTimeout(() => this.hide(), 3000);
  }
  removeError(e) {
    let index = e.currentTarget.dataset.index;
    this.errorList.splice(index, 1);
    this.renderError();
    if (this.errorList.length == 0) {
      this.hide();
    }
  }
  hide() {
    super.hide();
    this.errorList = [];
    this.querySelector(".error-list").innerHTML = "";
  }
}

defineElement("error-popup", ErrorPopup);