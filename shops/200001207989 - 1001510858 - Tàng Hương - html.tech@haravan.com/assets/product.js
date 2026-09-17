function initReview() {
  if (typeof ProductReviews != "undefined") {
    ProductReviews.init();
  }
  $(document)
    .find(".starbaprv-preview-badge")
    .each(function (a) {
      $(this).find(".starbap-prev-badge").length == 0 &&
        $(this).append(
          '<div class="starbap-prev-badge" data-average-rating="0" data-number-of-reviews="0"><a class="starbap-star starbap--off"><i class="fa fa-star fa-fw"></i></a><a class="starbap-star starbap--off"><i class="fa fa-star fa-fw"></i></a><a class="starbap-star starbap--off"><i class="fa fa-star fa-fw"></i></a><a class="starbap-star starbap--off"><i class="fa fa-star fa-fw"></i></a><a class="starbap-star starbap--off"><i class="fa fa-star fa-fw"></i></a><span class="starbap-prev-badgetext">0 đánh giá</span></div>'
        );
    });
}
subscribe(window.themeConfigs.productLoaded, () => {
  initReview();
});


subscribe(window.themeConfigs.firstInteraction, () => {

	class RelatedProducts extends HTMLElement{
		constructor(){
			super();
			this.getProducts()
		}
		renderEmpty(){
			let productList = this.querySelector('.product-list');
			if(this.dataset.emptyContent){
					productList.innerHTML = `<div class="w-full bg-background p-4">${this.dataset.emptyContent}</div>`
			}else{
				this.classList.add('hidden', 'no-products')
				if(this.closest('.section-products')) this.closest('.section-products').classList.add('hidden')
			}
		}
		getProducts(){
			let query = this.dataset.query;
			let productList = this.querySelector('.product-list');
			if(!query){
				this.renderEmpty()
				return;
			}
			let url = `/search?q=filter=${query}&view=product`
			if(this.dataset.productType == 'row'){
			 url = `/search?q=filter=${query}&view=product-row`
			}
			fetch(url).then(response => response.text())
			.then(res => {
				 let html = new DOMParser().parseFromString(res, "text/html");
				let limit = this.dataset.limit || 4;
	
				if(html.querySelector('card-product')){
					let carousel = this.querySelector('ega-carousel')
					productList.innerHTML = ''
					 Array.from(html.querySelectorAll('card-product')).slice(0, limit).forEach( el =>{
						let item = document.createElement("div"); 
						item.appendChild(el)
						if(carousel){
							item.classList.add('swiper-slide','h-inherit')
						} 
						productList.appendChild(item)
					})
					this.classList.remove('hidden', 'no-products')
				if(this.closest('.section-products')) this.closest('.section-products').classList.remove('hidden')
					if(carousel) carousel.start()
					publish(window.themeConfigs.productLoaded)
	
				}else{
					this.renderEmpty()
				}
			})
		
		}
	
	} 
	  defineElement("related-products", RelatedProducts);
	  class RecentviewProducts extends RelatedProducts {
		constructor() {
		  super();
		  this.dataset.query = this.getQueryStorage();
		  this.getProducts();
		}
		getQueryStorage() {
		  let query = "";
		  let storage = JSON.parse(localStorage.getItem(window.themeConfigs.recentStorage)) || [];
	
		  if (storage && storage.length && Array.isArray(storage)) {
			let productId = this.dataset.product;
			if (productId) {
			  storage = storage.filter((item) => item !== productId);
			}
			query = "(id:product=" + storage.join(")||(id:product=") + ")";
		  }
		  return query;
		}
	  }
	  defineElement("recentview-products", RecentviewProducts);
	
	class MediaGallery extends HTMLElement {
    constructor() {
      super();
      this.elements = {
        thumbnails: this.querySelector('[id^="GalleryThumbnails"]'),
        mainGallery: this.querySelector('[id^="GalleryMain"]'),
      };
      this.mql = window.themeConfigs.mbBreakpoint
    }
    connectedCallback() {
      this.init(this.mql);
      this.mql.addEventListener("change", this.init.bind(this));
	  this.querySelectorAll('img').forEach(el => el.removeAttribute('loading'))
	  if(this.querySelector('.swiper-spotlight')){
		  	this.querySelectorAll('.swiper-spotlight').forEach(el => el.addEventListener('click', ()=>{
			this.lightBox(el)
		}))
	}

    }
    disconnectedCallback() {
      this.mainGallery &&
        this.mainGallery.destroy &&
        this.mainGallery.destroy(true);
    }
    slideTo(index) {
      this.mainGallery && this.mainGallery.slideTo(index);
    }
	lightBox(el){
		 let index = parseInt(el.dataset.swiperSlideIndex) + 1
		if(!Spotlight) return;
		let imageList = Array.from(this.querySelectorAll('.swiper-spotlight')).map(el =>{
			let src =  el.dataset.src;
			if (el.dataset.video) {
				let src = el.dataset.video;
				return {
			   	 media: "node",
				 src: (function(){
					const video = document.createElement("video");
					video.classList.add("aspect-video", "container");
					video.src = src;
					video.dataset.src = video.src;
					video.width = 560;
					video.height = 315;
					video.controls = true;
					video.autoplay = true;
					video.autoplay = true;
					return video;
				}())	
			}
		}
			if(src.includes('youtube')){
			 	return {
			   	 media: "node",
				 src: (function(){
					const iframe = document.createElement("iframe");
					 iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					 iframe.classList.add("aspect-video", "iframe", "container")
					 iframe.src= src
					 iframe.dataset.src =  iframe.src 
					 iframe.wdith = 560
					 iframe.height = 315
					 iframe.frameborder="0"
					 iframe.allowfullscreen = true
	
					return iframe;
				}())
			   }  
			 }
			return {
				src : el.dataset.src
			}
		})
		Spotlight.show(imageList, {
			onchange: function(index, options){
				let slide = index - 1;
				 if(options.media == "node" && options.src.classList.contains("iframe")){
					options.src.src = options.src.dataset.src
				  }
				},
		});
 		Spotlight.goto(index)
	}
    init() {
	   let { thumbnails, mainGallery } = this.elements
      if (thumbnails) {
        const thumbnailParams = {
          freeMode: true,
          spaceBetween: 12,
          watchSlidesProgress: true,
          slidesPerView: 6.5,
          centerInsufficientSlides: true,
          pagination: false,
        };
        this.thumbnail = new Swiper(thumbnails, thumbnailParams);
      }
  	  const nextEl = mainGallery.querySelector(".swiper-button-next");
      const prevEl = mainGallery.querySelector(".swiper-button-prev");
      const mainGalleryParams = {
        spaceBetween: 5,
        watchSlidesProgress: true,
        speed: 800,
        slidesPerView: 1,
        autoplay: false,
        loop: true,
		  
        thumbs: {
          swiper: thumbnails,
        },
		  navigation: {
		  	  nextEl: nextEl,
        		prevEl: prevEl,
		  }
      };
      this.mainGallery = new Swiper(
       mainGallery,
        mainGalleryParams
      );
      this.mainGallery.on("slideChange", (swiper) => {
        let activeIndex = swiper.activeIndex;
        let activeItem = mainGallery.querySelectorAll(
          ".product__media-item"
        )[activeIndex];
        if (activeItem) {
        }
      });
    }
  }
defineElement("media-gallery",MediaGallery);
	class ProductForm extends HTMLElement {
	  constructor() {
		super();
		this.form = this.querySelector('[action="/cart/add"]');
		this.checkoutButton = this.querySelector('[name="buynow"]');
		this.addToCartButton = this.querySelector('[name="addtocart"]');
		this.checkoutButton &&
		  this.checkoutButton.addEventListener("click", () => {
			this.checkout = true;
		  });
		this.addToCartButton &&
		  this.addToCartButton.addEventListener("click", () => {
			this.checkout = false;
		  });
		this.form.addEventListener("submit", this.onSubmit.bind(this));
	  }
	  toggleLoading(loading) {
		const button = this.checkout ? this.checkoutButton : this.addToCartButton;

		if (loading) {
		  button.classList.add("loading");
		} else {
		  button.classList.remove("loading");
		}
	  }
	  onSubmit(e) {
		e.preventDefault();
		this.toggleLoading(true);
		const data = serializeForm(this.form);
		const dataObject = serializeFormToObject(this.form);
		const url = this.form.action;
		const { addToCartAction, productAddEvent } = window.themeConfigs;
		 fetch("/cart/add.js", {
		  method: "POST",
		  headers: {
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
		  },
		  body: data,
		})
		  .then((response) => {
			if (!response.ok) {
			  throw new Error("Đã có lỗi xảy ra");
			}
			publish(productAddEvent, {
			  data: dataObject,
			  action: this.checkout ? "buynow" : addToCartAction,
			});
			this.toggleLoading(false);
		  })
		  .catch((err) => {
			this.toggleLoading(false);
			publish(window.themeConfigs.error, {
			  error: err,
			});
		  });
	  }
	}
	defineElement("product-form", ProductForm);

	class VariantPicker extends HTMLElement {
	  constructor() {
		super();
		this.addEventListener("change", this.onVariantChange);
		this.section = this.closest(`#main-product-${this.dataset.id}`);
		let productData = this.section.querySelector(
		  '[data-type="product-json"]'
		).textContent;
		this.productData = JSON.parse(productData);
		this.variantData = this.productData.variants;
		this.updateOptions()
		this.updateCurrentVariant();
		this.updateOptionStatus()
		
		this.querySelectorAll('label').forEach(el => el.addEventListener('click',this.updateGallery.bind(this)))
		
	  }
	  connectedCallback() {
		subscribe(window.themeConfigs.quickViewShow,()=>{
		let otherVariants = document.querySelectorAll(`variant-picker[data-id="${this.dataset.id}"]`)
		if(otherVariants && otherVariants.length > 1){
		  otherVariants.forEach((variantPicker) => {
			this.syncOptions(variantPicker, this);
		  });
		}
		})
		this.abortController = new AbortController();
	  }
	  disconnectedCallback() {
		this.abortController.abort();
	  }
	  onVariantChange(e) {
		this.updateOptions(e);
		this.updateCurrentVariant();
		this.updateOptionStatus()
		
		if (!this.currentVariant) {
		  this.updateButtons(true, true);
		  this.updatePrice(
			`  <span class="price-contact text-h4 text-error"> Liên hệ </span>`
		  );
		} else {
			document
		  .querySelectorAll(
			`variant-picker:not(#${this.id})[data-id="${this.dataset.id}"]`
		  )
		  .forEach((variantPicker) => {
			this.syncOptions(this, variantPicker);
		  });
		  this.updateVariantInput();
		  this.updateProductInfo();
		  this.updateGallery();
		}
	  }
	  updateButtons(disabled, hide, soldout) {
		let productCtaGroup = this.section.querySelector(".product-cta");
		let form = this.section.querySelector('[action="/cart/add"]');
			 if(soldout){
				productCtaGroup
				  .querySelector(".btn--soldout")
				  .classList.add("hidden");
			}else{
			   productCtaGroup
				  .querySelector(".btn--soldout")
				  .classList.remove("hidden");
			}
		if (disabled) {
		  form.classList.add("hidden");
		 
		} else {
		  form.classList.remove("hidden");
		  
		}

		if (hide) {
		  productCtaGroup.classList.add("hidden");
		} else {
		  productCtaGroup.classList.remove("hidden");
		}
	  }
	  updatePrice(priceBox) {
		this.section.querySelector(".price-box").innerHTML = priceBox;
	  }
	  updateProductInfo() {
		if (this.abortController) {
		  this.abortController.abort();
		}
		this.abortController = new AbortController();
		this.section.classList.add("loading");
		fetch(
		  `/products/${this.productData.handle}?variant=${this.currentVariant.id}&view=quickview`,
		  { signal: this.abortController.signal }
		)
		  .then((response) => response.text())
		  .then((res) => {
			setTimeout(()=>  this.section.classList.remove("loading") ,300)

			let html = new DOMParser().parseFromString(res, "text/html");
			let replaceSelectors = [
			  ".group-status",
			  ".price-box",
			  ".inventory-status",
			];
			let quantityInput = this.section.querySelector(
			  ".product-quantity input"
			);
			let soldout = html.querySelector(".btn--soldout")
			let productCtaGroup = html.querySelector(".product-cta");
			let form = html.querySelector('[action="/cart/add"]');
			let installment = html.querySelector('.installment-button')

			replaceSelectors.forEach((el) => {
			  if (!this.section.querySelector(el)) return;
			  this.section.querySelector(el).innerHTML =
				html.querySelector(el).innerHTML;
			});

			this.updateButtons(
			  form.classList.contains("hidden"),
			  productCtaGroup.classList.contains("hidden"),
				soldout.classList.contains("hidden")
			);
			quantityInput.max = html
			  .querySelector(".product-quantity input")
			  .getAttribute("max");
			if (installment) {
			  const installmentButton = this.section.querySelector('.installment-button');
			  installmentButton.classList.toggle('hidden', installment.classList.contains('hidden'));
			}
			publish(window.themeConfigs.variantChanged,{
				target: this,
				data: html
			})
		  })
		  .catch((err) => {
			this.section.classList.remove("loading");
			publish(window.themeConfigs.error, {
				error:  err
			})
		  });
	  }
	  updateGallery() {
		let gallery = this.section.querySelector("media-gallery");
		if (this.currentVariant && this.currentVariant.featured_image && gallery) {
		  let src = this.currentVariant.featured_image.src;
		  let image = gallery.querySelector(`[data-href="${src}"]`);
		  if (!image) return;
		  let index = image.dataset.swiperSlideIndex;
		  gallery.slideTo && gallery.slideTo(index);
		}
	  }
	  updateVariantInput() {
		let form = this.section.querySelector('[ action="/cart/add"]');
		let input = form.querySelector('[name="id"]');
		input.value = this.currentVariant.id;
	  }
	  updateCurrentVariant() {
		this.currentVariant = this.variantData.find((variant) => {
		  return !variant.options
			.map((option, index) => {
			  return this.options[index] === option;
			})
			.includes(false);
		});
	  }
	  syncOptions(variantPicker, variantPickerUpdate) {
		const fieldsets = Array.from(variantPicker.querySelectorAll(".fieldset"));
		const _this = variantPickerUpdate;
		if (
		  variantPicker.currentVariant &&
		  _this.currentVariant &&
		  _this.currentVariant.id == variantPicker.currentVariant.id
		)
		  return;
		fieldsets.map((fieldset) => {
		  let radio = fieldset.querySelector("input:checked");
		  let name = fieldset.dataset.option;
		  if (radio && radio.value) {
			let checkbox = _this.querySelector(
			  `.fieldset[data-option="${name}"] input[value="${radio.value}"]`
			);
			if (checkbox) checkbox.checked = true;
		  }
		});
		_this.onVariantChange();
	  }
	  updateOptions(e) {
		const fieldsets = Array.from(this.querySelectorAll(".fieldset"));
		this.options = fieldsets.map((fieldset) => {
		  if (fieldset.querySelector("input:checked")) {
			fieldset.classList.add("selected");
			return Array.from(fieldset.querySelectorAll("input")).find(
			  (radio) => radio.checked
			).value;
		  } else {
			fieldset.classList.remove("selected");
		  }
		});
	  }
	  updateOptionStatus() {
		// lấy tất cả variant có giá trị như option1 đang được chọn
		const option1Selected = this.querySelector(":checked").value;
		const variantOption1 = this.variantData.filter((variant) => {
		  return variant.option1 == option1Selected;
		});
		const inputWrappers = [...this.querySelectorAll(".variant-picker__input")];
		// loop qua các option khác option1
		inputWrappers.forEach((option, index) => {
		  if (index === 0) return;
		  // lấy các  option trong đó
		  const optionInputs = [...option.querySelectorAll('input[type="radio"]')];
		  // lấy giá trị của option trước đó đang được chọn
		  let previousOption =
			inputWrappers[index - 1].querySelector(":checked").value;
		  // lấy ra danh sách những giá trị có variant còn hàng từ danh sách option1
		  const availableOptions = variantOption1
			.filter(
			  (variant) =>
				variant.available && variant[`option${index}`] === previousOption
			)
			.map((variantOption) => variantOption[`option${index + 1}`]);
		  optionInputs.forEach((input) => {
			if (availableOptions.includes(input.value)) {
			  input.classList.remove("disabled");
			} else {
			  input.classList.add("disabled");
			}
		  });
		});
	  }
	}


	defineElement("variant-picker", VariantPicker);

	class CardProduct extends HTMLElement {
	  constructor() {
		super();
		this.form = this.querySelector("form");
		this.addToCartBtn = this.querySelector(".add_to_cart");
		if (this.addToCartBtn) {
		  this.addToCartBtn.addEventListener("click", this.onClick.bind(this));
		}
		this.addEventListener("click", e =>  {
			 e.stopPropagation();
		})
		
		this.form.addEventListener("submit", (e) => e.preventDefault());
		this.querySelectorAll('.card-product__option').forEach(el =>{
		 el.addEventListener("click",this.onVariantClick.bind(this))
		} )
		
	  }

	  onVariantClick(e){
		e.preventDefault();
		e.stopPropagation();
		let image = e.currentTarget.dataset.image;
		if(image){
				this.querySelector('.card-product__image').src = image
			//this.querySelector('.card-product__image').srcset = image
			this.querySelector('.card-product__image').closest('picture').querySelector('source').srcset = image
		}
	  }
	  onClick(e) {
		 e.preventDefault();
		let button = e.currentTarget;
		let action = button.dataset.action;
		switch (action) {
		  case "quickview":
			this.openQuickview(button);
			break;
		  case "detail":
			window.location.href = button.dataset.product;
			break;
		  case "addtocart":
			this.addToCart(e);
			break;
		}
	  }
	  openQuickview(button) {
		const portal = document.querySelector(button.getAttribute("data-portal"));
		if (portal) portal.show(button);
	  }
	  addToCart(e) {
		e.preventDefault();
		const data = serializeForm(this.form);
		const productData = serializeFormToObject(this.form);
		const { addToCartAction, productAddEvent } = window.themeConfigs;
		fetch("/cart/add.js", {
		  method: "POST",
		  headers: {
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
		  },
		  body: data,
		})
		  .then((response) => {
			if (!response.ok) {
			  throw new Error("Đã có lỗi xảy ra");
			}
			publish(productAddEvent, {
			  data: productData,
			  action: addToCartAction,
			});
		  })
		  .catch((err) => {
			publish(window.themeConfigs.error, {
			  error: err,
			});
		  });
	  }
	}
	defineElement("card-product", CardProduct);

	class QuickView extends PortalComponent {
	  constructor() {
		super();
		  this.mql =  window.themeConfigs.mbBreakpoint
		  this.mql.addEventListener("change", (media)=>this.changAnimationType(media));
		  this.changAnimationType(this.mql)
	  }
		changAnimationType(media){
			this.dataset.animation = media.matches ? 'slide-in-bottom' : 'scale-in-hor-left' 
		}
	  loadProduct() {
		if (!this.url) return;
		const inner = this.querySelector(".portal-inner");
		  inner.classList.add('loading')
		fetch(this.url)
		  .then((response) => response.text())
		  .then((res) => {
			inner.classList.remove('loading')
			let html = new DOMParser().parseFromString(res, "text/html");
			this.querySelector(".portal-inner .product-wrapper").innerHTML =
			html.querySelector("product-form").outerHTML;
			publish(window.themeConfigs.productLoaded)
			publish(window.themeConfigs.quickViewShow)
		
		  }).catch((err)=>{
				inner.classList.remove('loading')
				publish(window.themeConfigs.error, {
				error:  err
			})
		})
	  }
	  show(opener) {

		let url = opener.dataset.product + "/?view=quickview";
		if(this.url != url){
			this.url = url
			this.querySelector(".portal-inner .product-wrapper").innerHTML = "";
			this.loadProduct();
		}

		super.show(opener);
	  }
	  hide() {

		 super.hide();
	  }
	}

		defineElement("quick-view", QuickView);			
	



})


class CompareButton extends PortalOpener {
	constructor() {
	  super();
	  this.storageKey = window.themeConfigs.compareProStorage;
	  this.eventUpdate = window.themeConfigs.copmareProUpdate;
	  this.updateText();
	}
	connectedCallback() {
	  this.buttonSubsciber = subscribe(this.eventUpdate, (e) => {
		let data = e.data;
		this.updateText(data);
	  });
	}
	disconnectedCallback() {
	  if (this.buttonSubsciber) {
		this.buttonSubsciber();
	  }
	}
	getStorage() {
	  return JSON.parse(localStorage.getItem(this.storageKey)) || [];
	}
	updateText(data) {
	  let label = this.button.querySelector("span");
	  const productId = this.button.dataset.product;
	  let compareProducts = data || this.getStorage();
	  label.textContent =
		compareProducts.indexOf(productId) > -1 ? "Đã thêm so sánh" : "So sánh";
	}
	updateStorage() {
	  let compareProducts = this.getStorage();
	  const productId = this.button.dataset.product;
	  if (compareProducts.indexOf(productId) === -1) {
		if (compareProducts.length >= 3) {
		  compareProducts.pop();
		}
		compareProducts.unshift(productId);
		localStorage.setItem(this.storageKey, JSON.stringify(compareProducts));
	  }
  
	  publish(this.eventUpdate, {
		data: compareProducts,
	  });
	}
	onClick(e) {
	  const type = this.button.dataset.productType;
	  if (document.querySelector("compare-qv.loading")) return;
	  if (
		document.querySelector(".compare-product") &&
		!document.querySelector(`.compare-product[data-product-type="${type}"]`)
	  ) {
		publish(window.themeConfigs.error, {
		  error: {
			message: "Sản phẩm bạn đang so sánh không cùng loại",
		  },
		});
		return;
	  }
	  this.updateStorage();
	  super.onClick(e);
	}
  }
  
  defineElement("compare-button", CompareButton);
  
  class CompareQV extends PortalComponent {
	constructor() {
	  super();
	  this.storageKey = window.themeConfigs.compareProStorage;
	  this.eventUpdate = window.themeConfigs.copmareProUpdate;
	}
	connectedCallback() {
	  super.connectedCallback();
	  subscribe(this.eventUpdate, (e) => {
		this.getProductCompare();
	  });
	  this.getProductCompare();
	}
	getStorage() {
	  return JSON.parse(localStorage.getItem(this.storageKey)) || [];
	}
	getProductCompare() {
	  let compareProducts = this.getStorage();
	  if (compareProducts && compareProducts.length) {
		const searchTerm =
		  "(id:product=" + compareProducts.join(")||(id:product=") + ")";
		this.classList.add("loading");
		fetch(`/search?q=filter=${searchTerm}&view=compare-item`)
		  .then((resposne) => resposne.text())
		  .then((res) => {
			this.classList.remove("loading");
			let html = new DOMParser().parseFromString(res, "text/html");
			if (html.querySelector(".compare-product__qv-item")) {
			  this.querySelector(".compare-product-list").innerHTML = res;
			  this.initEvent();
			  let numberPro = html.querySelectorAll(".compare-product").length;
			  document.querySelector(".compare-count").textContent =
				"(" + numberPro + ")";
			  this.toggelFloatButn(true);
			} else {
			  this.hide();
			  this.toggelFloatButn(false);
			}
		  })
		  .catch((err) => {
			this.classList.remove("loading");
			publish(window.themeConfigs.error, {
			  error: err,
			});
		  });
	  } else {
		this.hide();
		this.toggelFloatButn(false);
		this.querySelector(".compare-product-list").innerHTML = "";
	  }
	}
	toggelFloatButn(show) {
	  if (!document.querySelector(".compare-opener")) return;
	  if (show) {
		document.querySelector(".compare-opener").classList.remove("hidden");
	  } else {
		document.querySelector(".compare-opener").classList.add("hidden");
		document.querySelector(".compare-count").textContent = 0;
	  }
	}
	initEvent() {
	  this.querySelectorAll(".compare-product__qv-remove").forEach((el) => {
		el.addEventListener("click", this.removeItem.bind(this));
	  });
	  this.querySelector(".js-compare-product-remove-all").addEventListener(
		"click",
		this.removeAll.bind(this)
	  );
	}
  
	removeItem(e) {
	  const id = e.currentTarget.dataset.id;
	  const newCompareList = this.getStorage();
	  if (newCompareList.indexOf(id) > -1) {
		newCompareList.splice(newCompareList.indexOf(id), 1);
		localStorage.setItem(this.storageKey, JSON.stringify(newCompareList));
  
		publish(this.eventUpdate, {
		  data: newCompareList,
		});
	  }
	}
	removeAll() {
	  localStorage.setItem(this.storageKey, JSON.stringify([]));
	  publish(this.eventUpdate, {
		data: [],
	  });
	}
  
	show() {
	  this.getProductCompare();
	  super.show();
	}
  }
  
  defineElement("compare-qv", CompareQV);