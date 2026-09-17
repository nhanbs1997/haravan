function getAverageLuminanceFromImage(url, callback) {
	const img = new Image();
	img.crossOrigin = "anonymous";
	img.src = url;
	img.onload = function () {
		const canvas = document.createElement("canvas");
		canvas.width = this.width;
		canvas.height = this.height;
		const ctx = canvas.getContext("2d");
		ctx.drawImage(this, 0, 0);
		const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
		let total = 0;
		const step = 10;
		for (let i = 0; i < data.length; i += 4 * step) {
			const r = data[i], g = data[i + 1], b = data[i + 2];
			const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
			total += luminance;
		}
		const avg = total / (data.length / 4 / step);
		callback(avg);
	};
}
function updateTextColorFromSwiper(swiperInstance) {
	const activeSlide = swiperInstance.slides[swiperInstance.activeIndex];
	const img = activeSlide.querySelector('img');
	const textEl = document.querySelector('.auto-text-color');
	if (img && textEl) {
		getAverageLuminanceFromImage(img.src, (luminance) => {
			const threshold = 140;
			textEl.classList.toggle('dark-text', luminance > threshold);
			textEl.classList.toggle('light-text', luminance <= threshold);
		});
	}
}
/*Slider*/
var swiper_slider = new Swiper(".section_slider", {
	slidesPerView: 1,
	mousewheel: false,
	navigation: {
		nextEl: ".section_slider .swiper-button-next",
		prevEl: ".section_slider .swiper-button-prev",
	},
	autoplay: {
		delay: 5000,
		disableOnInteraction: false
	},
	pagination: {
		el: ".section_slider .swiper-pagination",
		dynamicBullets: true
	},
	on: {
		init: function () {
			updateTextColorFromSwiper(this);
		},
		slideChangeTransitionEnd: function () {
			updateTextColorFromSwiper(this);
		}
	}
});
/*End Slider*/
/*Đếm ngược*/
document.addEventListener("DOMContentLoaded", function() {
	const countdownElement = document.getElementById("WolfCountdown");
	if (!countdownElement) {
		console.warn("Lỗi: Không tìm thấy phần tử HTML cho đồng hồ đếm ngược. Đảm bảo có ID 'simpleCountdown'.");
		return;
	}
	const targetDateString = countdownElement.dataset.targetDate;
	if (!targetDateString) {
		console.warn("Lỗi: Phần tử #simpleCountdown thiếu thuộc tính 'data-target-date'.");
		return;
	}
	const targetDate = new Date(targetDateString).getTime();
	function updateCountdown() {
		const now = new Date().getTime();
		const distance = targetDate - now;
		if (distance < 0) {
			clearInterval(countdownInterval);
			countdownElement.innerHTML = "<h4>Hết thời gian!</h4>";
			return;
		}
		const days = Math.floor(distance / (1000 * 60 * 60 * 24));
		const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((distance % (1000 * 60)) / 1000);
		const formatNumber = (num) => String(num).padStart(2, '0');
		countdownElement.innerHTML = `
<div class="countdown-number"><span class="countdown-time">${formatNumber(days)}</span><span class="countdown-text">ngày</span></div>
<div class="countdown-number"><span class="countdown-time">${formatNumber(hours)}</span><span class="countdown-text">giờ</span></div>
<div class="countdown-number"><span class="countdown-time">${formatNumber(minutes)}</span><span class="countdown-text">phút</span></div>
<div class="countdown-number"><span class="countdown-time">${formatNumber(seconds)}</span><span class="countdown-text">giây</span></div>
`;
	}
	const countdownInterval = setInterval(updateCountdown, 1000);
	updateCountdown();
});
/*End Đếm ngược*/
/*Tab Ajax*/
document.addEventListener("DOMContentLoaded", function() {
    const tabsContainer = document.querySelector('.wolf-bts-title .ajax');
    const tabContentsContainer = document.querySelector('.wolf-bts-ajax-tabs');

    if (!tabsContainer || !tabContentsContainer) {
        console.warn("Lỗi: Không tìm thấy container tab hoặc container nội dung tab. Kiểm tra lại class.");
        return;
    }

    const tabContentCache = {};

    function initializeSwiper(tabElement) {
        const swiperElement = tabElement.querySelector('.bts-swiper');
        if (swiperElement && !swiperElement.swiper) { 
            new Swiper(swiperElement, {
                slidesPerView: 2,
                spaceBetween: 10,
                navigation: {
                    nextEl: tabElement.querySelector('.swiper-button-next'),
                    prevEl: tabElement.querySelector('.swiper-button-prev'),
                },
                pagination: {
                    el: tabElement.querySelector('.swiper-pagination'),
                    type: "progressbar",
                },
                breakpoints: {
                    1: { slidesPerView: 2, spaceBetween: 8 },
                    768: { slidesPerView: 3, spaceBetween: 10 },
                    992: { slidesPerView: 3, spaceBetween: 10 },
                    1024: { slidesPerView: 3, spaceBetween: 8 }
                }
            });
        }
    }
    function initThirdPartyScripts() {
        if (window.comparison && typeof window.comparison.init === 'function') {
            window.comparison.init();
        }
        if (typeof initSwatchImageSwitcher === 'function') {
            initSwatchImageSwitcher();
        }
        var modal = $('#quick-view-product');
        var btn = $('.quick-view');
        btn.off('click').on('click', function (e) {
            e.preventDefault();
            modal.modal('show');
        });
    }

    const getSkeletonHtml = () => `<div class="row g-3 skeleton-container"><div class="col-xxl-4 col-xl-4 col-lg-4 col-md-12 col-sm-12 col-12"><div class="skeleton-image-large"></div></div><div class="col-xxl-8 col-xl-8 col-lg-8 col-md-12 col-sm-12 col-12 mt-1 mt-lg-3"><div class="row g-2"><div class="col-xxl-4 col-xl-4 col-lg-4 col-md-4 col-6"><div class="skeleton-product-card"><div class="skeleton-image"></div><div class="skeleton-text skeleton-title"></div><div class="skeleton-text skeleton-price"></div><div class="skeleton-button"></div></div></div><div class="col-xxl-4 col-xl-4 col-lg-4 col-md-4 col-6"><div class="skeleton-product-card"><div class="skeleton-image"></div><div class="skeleton-text skeleton-title"></div><div class="skeleton-text skeleton-price"></div><div class="skeleton-button"></div></div></div><div class="col-xxl-4 col-xl-4 col-lg-4 col-md-4 col-6"><div class="skeleton-product-card"><div class="skeleton-image"></div><div class="skeleton-text skeleton-title"></div><div class="skeleton-text skeleton-price"></div><div class="skeleton-button"></div></div></div></div></div></div>`;

    async function loadTabContent(tabLinkElement, tabContentElement) {
        const dataUrl = tabLinkElement.dataset.url;
        const ajaxLoadUrl = `${dataUrl}?view=ajaxload`; 
        if (tabContentCache[ajaxLoadUrl]) {
            tabContentElement.innerHTML = tabContentCache[ajaxLoadUrl];
            initializeSwiper(tabContentElement);
            initThirdPartyScripts();
            return;
        }

        tabContentElement.innerHTML = getSkeletonHtml();
        try {
            const response = await fetch(ajaxLoadUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const htmlContent = await response.text();
            tabContentCache[ajaxLoadUrl] = htmlContent;
            
            setTimeout(() => {
                tabContentElement.innerHTML = htmlContent;
                initializeSwiper(tabContentElement);
                initThirdPartyScripts();
            }, 250);

        } catch (error) {
            console.error("Lỗi tải nội dung tab:", error);
            tabContentElement.innerHTML = `<div class="alert alert-danger" role="alert">Không thể tải nội dung. Vui lòng thử lại sau.</div>`;
        }
    }

    tabsContainer.addEventListener('click', function(event) {
        const clickedTab = event.target.closest('.tab-link');
        if (!clickedTab) return;
        event.preventDefault();
        const dataUrl = clickedTab.dataset.url; 
        const ajaxLoadUrl = `${dataUrl}?view=ajaxload`;
        
        tabsContainer.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('current', 'has-content'));
        tabContentsContainer.querySelectorAll('.tab-content').forEach(content => content.classList.remove('current'));
        
        clickedTab.classList.add('current');
        const tabId = clickedTab.dataset.tab;
        const targetTabContent = tabContentsContainer.querySelector(`.${tabId}`);
        
        if (targetTabContent) {
            targetTabContent.classList.add('current');
            
            if (!tabContentCache[ajaxLoadUrl]) { 
                loadTabContent(clickedTab, targetTabContent);
                clickedTab.classList.add('has-content');
            } else {
                initializeSwiper(targetTabContent);
            }
        }
    });

    const firstTabLink = tabsContainer.querySelector('.tab-link.current');
    if (firstTabLink) {
        const firstTabId = firstTabLink.dataset.tab;
        const firstTabContent = tabContentsContainer.querySelector(`.${firstTabId}`);
        if (firstTabContent) {
            initializeSwiper(firstTabContent);
            const dataUrl = firstTabLink.dataset.url;
            const ajaxLoadUrl = `${dataUrl}?view=ajaxload`;
            tabContentCache[ajaxLoadUrl] = firstTabContent.innerHTML;
            firstTabLink.classList.add('has-content');
            initThirdPartyScripts();
        }
    }
});
/*END Tab Ajax*/
var swiper_relate = new Swiper('.wolf-product-block-2', {
	slidesPerView: 2,
	loop: false,
	roundLengths: true,
	slideToClickedSlide: false,
	spaceBetween: 10,
	autoplay: false,
	navigation: {
		nextEl: '.wolf-product-block-2 .swiper-button-next',
		prevEl: '.wolf-product-block-2 .swiper-button-prev',
	},
	pagination: {
		el: '.wolf-product-block-2 .swiper-pagination',
		type: "progressbar",
	},
	breakpoints: {
		1: {
			slidesPerView: 2,
			spaceBetween: 8
		},
		768: {
			slidesPerView: 3,
			spaceBetween: 10
		},
		992: {
			slidesPerView: 4,
			spaceBetween: 10
		},
		1024: {
			slidesPerView: 5,
			spaceBetween: 8
		}
	}
});