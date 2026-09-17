function initMenuToggle(buttonSelector, menuSelector) {
	const button = document.querySelector(buttonSelector);
	const menu = document.querySelector(menuSelector);
	const menuCloseButton = document.querySelector('.close-menu-button');
	if (!button || !menu) {
		console.warn('Lỗi: Không tìm thấy nút mở menu hoặc menu popup. Vui lòng kiểm tra lại selector.');
		return;
	}
	let backdrop = document.querySelector(".menu-backdrop");
	if (!backdrop) {
		backdrop = document.createElement("div");
		backdrop.className = "menu-backdrop";
		document.body.appendChild(backdrop);
	}
	function openMenu() {
		menu.classList.add("show");
		backdrop.classList.add("show");
		if (menuCloseButton) {
			menuCloseButton.classList.add("actives");
		}
		document.body.style.overflow = 'hidden';
	}
	function closeMenu() {
		menu.classList.remove("show");
		backdrop.classList.remove("show");
		if (menuCloseButton) {
			menuCloseButton.classList.remove("actives");
		}
		document.body.style.overflow = '';
	}
	button.addEventListener("click", (e) => {
		e.stopPropagation();
		if (menu.classList.contains("show")) {
			closeMenu();
		} else {
			openMenu();
		}
	});
	backdrop.addEventListener("click", closeMenu);
	if (menuCloseButton) {
		menuCloseButton.addEventListener("click", (e) => {
			e.stopPropagation();
			closeMenu();
		});
	}
}
initMenuToggle('.menu-button', '#menu-popup');
initMenuToggle('.btn-search', '#search-popup');
document.addEventListener("DOMContentLoaded", function() {
	document.addEventListener("click", function(event) {
		const icon = event.target.closest('.icon-toggle');
		if (!icon) return;
		event.preventDefault();
		event.stopPropagation();
		icon.classList.toggle('active');
		const parentItem = icon.closest('.nav-item-lv2, .nav-item-lv3, .nav-root');
		if (!parentItem) return;
		const submenu = parentItem.querySelector('.dropdown-menu');
		if (!submenu) return;
		submenu.classList.toggle('show');
		parentItem.closest('.dropdown-menu, .nav-root')?.querySelectorAll('.dropdown-menu.show')
			.forEach(menu => {
		if (menu !== submenu) {
		menu.classList.remove('show');
	}
	});
	});
	});
		function initSwatchImageSwitcher(scope = document) {
		scope.querySelectorAll(".wolf-product-item-card").forEach(function(item) {
		const picture = item.querySelector(".wolf-product-main-image picture");
		const mainImg = picture?.querySelector("img");
		const mainSources = picture?.querySelectorAll("source");
		const swatches = item.querySelectorAll(".swatch-mixed");
		swatches.forEach(function(swatch) {
		swatch.addEventListener("click", function() {
		const newImgUrl = this.getAttribute("data-variant-image");
		if (newImgUrl && mainImg) {
		mainImg.setAttribute("src", newImgUrl);
		mainSources?.forEach(source => {
		const size = source.getAttribute("srcset")?.match(/\d+x/)?.[0] || '';
		const newSrcset = newImgUrl.replace(/(\d+x)?\.(jpg|png|webp)/, `${size}.$2`);
source.setAttribute("srcset", newSrcset);
});
}
swatches.forEach(el => el.classList.remove("active"));
this.classList.add("active");
});
});
});
}

document.addEventListener("DOMContentLoaded", function() {
initSwatchImageSwitcher();
});

/*Tìm kiếm thông minh*/
document.addEventListener("DOMContentLoaded", function() {
// 1. Khai báo các phần tử DOM
const input = document.getElementById("smartSearchInput");
const loader = document.getElementById("searchLoader");
const historyBox = document.getElementById("searchHistoryBox");
const resultsBox = document.getElementById("searchResultsBox");
const defaultModule = document.getElementById("defaultCategoryModule");
if (!input || !loader || !historyBox || !resultsBox || !defaultModule) {
console.error("Lỗi: Không tìm thấy một hoặc nhiều phần tử DOM cần thiết cho tìm kiếm thông minh. Vui lòng kiểm tra lại ID.");
return;
}
let searchDebounceTimer;
//Hàm cập nhật lịch sử tìm kiếm
function updateSearchHistory(term) {
if (!term || typeof term !== 'string') return;
let history = JSON.parse(localStorage.getItem("searchHistory") || "[]");
history = history.filter(t => t.toLowerCase() !== term.toLowerCase());
history.unshift(term);
history = history.slice(0, 5);
localStorage.setItem("searchHistory", JSON.stringify(history));
}
//Hàm hiển thị lịch sử tìm kiếm
function showSearchHistory() {
const history = JSON.parse(localStorage.getItem("searchHistory") || "[]");
if (!history.length) {
historyBox.classList.add("d-none");
return;
}
let html = `
			<div class="d-flex justify-content-between align-items-center mb-2">
			<h6 class="mb-0">Tìm kiếm gần đây</h6>
			<button class="btn btn-sm btn-link text-danger p-0 clear-history" type="button">Xoá</button>
			</div>
			<div class="d-flex flex-wrap gap-2 pt-2 pb-1 recent-keywords-wrapper">
			`;
history.forEach(term => {
html += `<button class="btn border-0 rounded-4 recent-term" data-term="${term}" type="button">${term}</button>`;
	});
		html += `</div>`;
		historyBox.innerHTML = html;
		historyBox.classList.remove("d-none");
	}
		//Hàm xóa lịch sử tìm kiếm
		function clearSearchHistory() {
		localStorage.removeItem("searchHistory");
		showSearchHistory();
	}
		//Hàm kích hoạt tìm kiếm chính
		function triggerSearch(term) {
		term = term.trim();
		if (!term) {
		resultsBox.classList.add("d-none");
		defaultModule.classList.remove("d-none");
		showSearchHistory();
		return;
	}
		loader.classList.remove("d-none");
		resultsBox.classList.add("d-none");
		historyBox.classList.add("d-none");
		defaultModule.classList.add("d-none");
		// Gọi API tìm kiếm
		fetch(`/search?q=${encodeURIComponent(term)}&view=json`)
.then(res => {
if (!res.ok) {
throw new Error(`HTTP error! status: ${res.status}`);
}
return res.text();
})
.then(htmlContent => {
let finalHtml = '';
const hasProducts = htmlContent.trim() && !htmlContent.includes('<div class="row g-2 wolf-products-block-product-product">\n</div>');
if (hasProducts) {
finalHtml += '<h5 class="text-center mb-2">Kết quả tìm kiếm</h5>';
finalHtml += htmlContent;
finalHtml += `<div class="list-group-item text-center mt-2">
	<a href="/search?q=${encodeURIComponent(term)}" class="wolf-btn btn mt-3" title="Xem tất cả kết quả">Xem tất cả kết quả</a>
		</div>`;
	} else {
							  finalHtml = `<div class="list-group-item text-muted">Không tìm thấy sản phẩm phù hợp.</div>`;
							  }
							  resultsBox.innerHTML = finalHtml;
							  resultsBox.classList.remove("d-none");
	loader.classList.add("d-none");
	updateSearchHistory(term);
})
	.catch(error => {
	console.error("Lỗi khi fetch tìm kiếm:", error);
	loader.classList.add("d-none");
	resultsBox.innerHTML = `<div class="list-group-item text-danger">Có lỗi xảy ra khi tìm kiếm. Vui lòng thử lại sau.</div>`;
	resultsBox.classList.remove("d-none");
});
}
//Gắn sự kiện cho input tìm kiếm (Debounce)
input.addEventListener("input", function() {
	clearTimeout(searchDebounceTimer);
	const term = this.value;
	searchDebounceTimer = setTimeout(() => {
		if (term.trim() === "") {
			resultsBox.classList.add("d-none");
			defaultModule.classList.remove("d-none");
			showSearchHistory();
		} else {
			triggerSearch(term);
		}
	}, 300);
});
//Gắn sự kiện cho phím Enter
input.addEventListener("keydown", function(e) {
	if (e.key === "Enter") {
		e.preventDefault();
		const term = input.value.trim();
		if (term) {
			window.location.href = `/search?q=${encodeURIComponent(term)}`;
		}
	}
});
//Gắn sự kiện click cho các nút lịch sử và xóa lịch sử (Event Delegation)
document.addEventListener("click", function(e) {
	const recentTermBtn = e.target.closest(".recent-term");
	if (recentTermBtn) {
		const term = recentTermBtn.dataset.term;
		if (term) {
			input.value = term;
			triggerSearch(term);
		}
		return;
	}
	const clearHistoryBtn = e.target.closest(".clear-history");
	if (clearHistoryBtn) {
		clearSearchHistory();
	}
});
//Khởi tạo lịch sử tìm kiếm khi trang tải xong
showSearchHistory();
});
/*End Tìm kiếm thông minh*/

function wolf_convertVietnamese(str) {
	str = str.toLowerCase();
	const vietnameseMap = {
		'à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ': 'a',
		'è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ': 'e',
		'ì|í|ị|ỉ|ĩ': 'i',
		'ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ': 'o',
		'ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ': 'u',
		'ỳ|ý|ỵ|ỷ|ỹ': 'y',
		'đ': 'd'
	};
	for (const [pattern, replacement] of Object.entries(vietnameseMap)) {
		str = str.replace(new RegExp(pattern, 'g'), replacement);
	}
	str = str.replace(/[^a-z0-9-]/g, '-');
	str = str.replace(/-+/g, '-');
	str = str.replace(/^-+|-+$/g, '');
	return str;
}
window.wolf_convertVietnamese = wolf_convertVietnamese;