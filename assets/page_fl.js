window.addEventListener('DOMContentLoaded', (event) => {
	var swiperProductSaleSlider = new Swiper('.mew_flash_page', {
		spaceBetween: 8,
		loop: false,
		speed: 1000,
		autoplay: false,
		navigation: {
			nextEl: '.mf_next',
			prevEl: '.mf_prev',
		},
		freeMode: true,
		breakpoints: {
			320: {
				slidesPerView: 2,
			},
			768: {
				slidesPerView: 3,
			},
			992: {
				slidesPerView: 4
			},
			1200: {
				slidesPerView: 5
			}
		}
	});
});
