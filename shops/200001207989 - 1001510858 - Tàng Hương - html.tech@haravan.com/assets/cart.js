class RewardsBar extends HTMLElement {
  constructor() {
    super();

    this.init();
  }

  init() {
    this.itemsWrapper = this.querySelector(".reward-items");
    if (!this.itemsWrapper) return;
    const items = Array.from(
      this.itemsWrapper.querySelectorAll(".rewards-item")
    );
    const totalCart = parseInt(this.dataset.total);
    const sortedElements = items.sort((a, b) => {
      const amountA = parseInt(a.dataset.amount);
      const amountB = parseInt(b.dataset.amount);
      return amountA - amountB;
    });
    let nextReward = null;
    let currentReward = null;
    let maxAmount = parseInt(sortedElements[items.length - 1].dataset.amount);
    sortedElements.forEach((el) => {
      const amount = parseInt(el.dataset.amount);
      if (!nextReward && amount > totalCart) {
        nextReward = el;
        let price = amount - totalCart;
        let message = el.querySelector(".reward-message").textContent;
        this.querySelector(".rewards-messages").textContent = message;
        el.querySelectorAll(".rewards-icon").forEach((icon) =>
          icon.classList.remove("hidden")
        );
        el.querySelector(".rewards-icon-success").classList.add("hidden");
      }
      if (amount <= totalCart) {
        currentReward = el;
        el.querySelectorAll(".rewards-icon").forEach((icon) =>
          icon.classList.add("hidden")
        );
        el.querySelector(".rewards-icon-success").classList.remove("hidden");
      }
	  let position =  (amount / maxAmount) * 100 
      el.style.left = position + "%";
	  el.style.setProperty('--tooltip-position', position > 50 ? '-100px' : '0')
    });
    let percent = (totalCart / maxAmount) * 100;
    if (!nextReward) {
      this.querySelector(".rewards-messages").textContent =
        this.querySelector(".rewards-success").textContent;
      percent = 100;
    }
    if (currentReward) {
      let title = currentReward.querySelector(".reward-title").textContent;
      let coupon = currentReward.dataset.coupon;
      let copyButton = coupon
        ? `<copy-button data-copied-text="Đã sao chép"  >
                <input type="hidden" value="${coupon}" />
                <button type="button" class=" btn leading-0 inline-flex ml-1 px-1 text-neutral-400 copy-button p-0 border border-neutral-100 rounded-sm ">
  					copy <i class="icon icon-paste"></i>
      			</button>
				</copy-button>`
        : "";
      let couponHTML = `<div>Đã nhận : <span class="font-semibold">${title}</span>${copyButton}</div>`;
      this.querySelector(".rewards-coupon").innerHTML = couponHTML;
    } else {
      this.querySelector(".rewards-coupon").innerHTML = "";
    }
    percent = percent > 100 ? 100 : percent;
    this.querySelector(".rewards-percent").style.width = percent + "%";
    this.classList.remove("opacity-0");
  }
  update(cartRewards) {
    this.dataset.total = cartRewards.dataset.total;
    this.innerHTML = cartRewards.innerHTML;
    this.init();
  }
}

defineElement("rewards-bar", RewardsBar);

subscribe(window.themeConfigs.firstInteraction, () => {
  class CartForm extends HTMLElement {
    constructor() {
      super();
      this.form = this.querySelector("form");
      this.addEventListener("change", this.onChange);
      this.form.addEventListener("submit", this.onSubmit.bind(this));
    }
    onChange(e) {
      if (e.target.name === "Lines") {
        let input = e.target;
        let index = input.dataset.lineIndex;
        let quanity = input.value;
        this.quantityUpdate(index, quanity);
      }
      if (e.target.id == "vat") {
        let vatDrawer = document.querySelector("#cart-vat-drawer");
        if (e.target.checked) {
          vatDrawer.show();
        } else {
          vatDrawer.reset();
          vatDrawer.syncCartForm();
        }
      }
    }

    quantityUpdate(index, quanity) {
      let line = this.querySelector(`.cart-item[data-line-index="${index}"]`);
      this.classList.add("loading");
      line.classList.add("loading");
      fetch(`/cart/change?line=${index}&quantity=${quanity}`).then((response) => {
		  if(response.ok){
        this.updateCart();
		  }else{
		  	throw new Error('Đã có lỗi xảy ra');
 
		  }
      }).catch(err =>{
		  console.log(err)
		  this.classList.remove("loading");
      		line.classList.remove("loading");
	  		publish(window.themeConfigs.error, {
				error:  err
			})
	  })
    }
    updateCartAttribute() {
      const data = serializeForm(this.form, true);
      fetch("/cart/update.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: data,
      })
        .then((res) => res.json())
        .then((response) => {
          this.updateCart();
        })
        .catch((err) => {
          console.log(err);
		  publish(window.themeConfigs.error, {
				error:  err
			})
        });
    }
    updateCart() {
      this.classList.add("loading");
      fetch("/cart?view=data")
        .then((response) => response.text())
        .then((res) => {
          this.renderCart(res);
          setTimeout(() => this.classList.remove("loading"), 500);
        }).catch(err => {
	  this.classList.remove("loading")
	  	publish(window.themeConfigs.error, {
				error:  err
			})
	  })
    }
    renderCart(res) {
      let html = new DOMParser().parseFromString(res, "text/html");
      let replaceSelectors = [".cart-table", ".cart-empty", ".cart-summary"];
      let relatedProducts = html.querySelector(".cart-releated-products");
      let cartRewards = this.querySelector("rewards-bar");
      let cro = document.querySelector("cro-btn");
      let isEmpty = html.querySelector(".is-empty");
      replaceSelectors.forEach((el) => {
        if (!this.querySelector(el)) return;
        this.querySelector(el).innerHTML = html.querySelector(el).innerHTML;
      });

      document.querySelector(".mini-cart").innerHTML =
        html.querySelector(".mini-cart").innerHTML;
      if (isEmpty) {
        this.classList.add("is-empty");
      } else {
        this.classList.remove("is-empty");
      }
      document
        .querySelectorAll(".cart-count")
        .forEach(
          (el) => (el.innerHTML = html.querySelector(".cart-count").innerHTML)
        );
      if (relatedProducts) {
        document.querySelectorAll(".cart-releated-products").forEach((el) => {
          if (el.dataset.query != relatedProducts.dataset.query) {
            el.dataset.query = relatedProducts.dataset.query;
            el.getProducts();
          }
        });
      }
      if (cartRewards) {
        cartRewards.update(html.querySelector("rewards-bar"));
      }
      if (cro && cro.querySelector(".cart-bottom")) {
        isEmpty ? cro.classList.add("hidden") : cro.classList.remove("hidden");
        cro.querySelector(".cart-bottom").innerHTML =
          html.querySelector(".cart-bottom").innerHTML;
      }
    }
    onSubmit(e) {
      e.preventDefault();
      window.location.href = "/checkout";
    }
  }

  defineElement("cart-form", CartForm);

  class RemoveCartButton extends HTMLElement {
    constructor() {
      super();
      this.addEventListener("click", (event) => {
        event.preventDefault();
        const cartForm = this.closest("cart-form");
        cartForm.quantityUpdate(this.dataset.lineIndex, 0);
      });
    }
  }
  defineElement("remove-cart-button", RemoveCartButton);

  class CartDrawer extends PortalComponent {
    constructor() {
      super();
      this.cartForm = this.querySelector("cart-form");
    }
	changeHash(open){
	 if( window.themeConfigs.mbBreakpoint.matches){
		if(!window.location.hash == '#cart'){
      window.location.hash =  open ? "#cart" : '';
		}
	 }
	}
    connectedCallback() {
      if (
        window.location.hash == "#cart" &&
        window.themeConfigs.mbBreakpoint.matches
      ) {
        this.show();
      }
      subscribe(window.themeConfigs.productAddEvent, (e) => {
        if (
          e.action == "drawer" &&
          window.location.pathname != "/cart" &&
          !this.classList.contains("active")
        ) {
          setTimeout(
            () => this.show(),
            document.querySelector("quick-view.active")
              ? window.themeConfigs.defaultTransitionTime
              : 0
          );
        }

        if (e.action == "cart") {
          window.location.href = "/cart";
          return;
        }

        if (e.action == "buynow") {
          window.location.href = "/checkout";
          return;
        }
        document.querySelectorAll("quick-view").forEach((el) => el.hide());
        document.querySelectorAll("cart-form").forEach((el) => el.updateCart());
        if (window.location.pathname == "/cart") {
          window.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        }
      });
    }
    hide() {
	  this.changeHash(false)
      super.hide();
    }
    show(opener) {
      if (!this.inited) {
        this.cartForm.updateCart();
        this.inited = true;
      }
	  this.changeHash(true)
      super.show(opener);
    }
  }

  defineElement("cart-drawer", CartDrawer);

  class VatDrawer extends PortalComponent {
    constructor() {
      super();
      this.addEventListener("change", this.onChange.bind(this));
      this.inputElements = this.querySelectorAll("[name*=attributes]");
      this.form = this.querySelector("form");
      this.form.addEventListener("submit", this.onSubmit.bind(this));
    }
    renderError(errors, input) {}
    validate(input) {
      let errors = validateInput(input);
      if (!errors) return true;
      let wrapper = input.closest(".form-group");
      let error = wrapper.querySelector(".error");
      error.innerHTML = errors.length ? errors.join(", ") : "";
      return errors.length ? false : true;
    }
    onChange(e) {
      this.validate(e.target);
    }
    reset() {
      this.inputElements.forEach((el) => {
        el.value = "";
      });
    }
    syncCartForm() {
      const cartForm = document.querySelector("cart-form");
      if (cartForm) {
        this.inputElements.forEach((el) => {
          let name = el.name;
          let input = cartForm.querySelector(`[name="${name}"]`);
          if (input) {
            input.value = el.value;
          }
        });
        cartForm.updateCartAttribute();
      }
    }
    onSubmit(e) {
      e.preventDefault();
      let isValid = Array.from(this.inputElements).map(
        this.validate.bind(this)
      );
      if (isValid.includes(false)) return;
      let isEnabled = this.querySelector(".invoice-checkbox").checked;
      this.querySelector(".invoice").value = isEnabled ? "có" : "không";
      if (!isEnabled) {
        //this.inputElements.forEach((el) => { el.value = '' });
      }
      this.syncCartForm();
      this.hide();
    }
  }

  defineElement("cart-vat-drawer", VatDrawer);

  class CartNote extends HTMLElement {
    constructor() {
      super();
      this.form = this.querySelector("form");
      this.form.addEventListener("submit", this.onSubmit.bind(this));
      this.note = this.querySelector('[name="note"]');
    }

    syncCartForm() {
      const cartForm = document.querySelector("cart-form");
      if (cartForm) {
        let input = cartForm.querySelector(`[name="note"]`);
        if (input) {
          input.value = this.note.value;
        }
        cartForm.updateCartAttribute();
      }
    }
    onSubmit(e) {
      e.preventDefault();
      this.syncCartForm();
      document.querySelector("#cart-note-drawer").hide();
    }
  }

  defineElement("cart-note", CartNote);

  class DatepickerInput extends HTMLElement {
    constructor() {
      super();

      this.input = this.querySelector("input");
    }
    init() {
      if (typeof Datepicker == "undefined" || this.loaded) return;
      Datepicker.locales.vi = {
        days: [
          "Chủ nhật",
          "Thứ hai",
          "Thứ ba",
          "Thứ tư",
          "Thứ năm",
          "Thứ sáu",
          "Thứ bảy",
        ],
        daysShort: ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"],
        daysMin: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
        months: [
          "Tháng 1",
          "Tháng 2",
          "Tháng 3",
          "Tháng 4",
          "Tháng 5",
          "Tháng 6",
          "Tháng 7",
          "Tháng 8",
          "Tháng 9",
          "Tháng 10",
          "Tháng 11",
          "Tháng 12",
        ],
        monthsShort: [
          "Th1",
          "Th2",
          "Th3",
          "Th4",
          "Th5",
          "Th6",
          "Th7",
          "Th8",
          "Th9",
          "Th10",
          "Th11",
          "Th12",
        ],
        today: "Hôm nay",
        clear: "Xóa",
        format: "dd/mm/yyyy",
      };
      const datepicker = new Datepicker(this.input, {
        // ...options
        autohide: true,

        datesDisabled: function (date, viewId, rangeEnd) {
          let isDateDisabled = true;
          // ...your evaluation logic
          let currentDate = new Date();
          if (date >= currentDate) {
            isDateDisabled = false;
          }
          return isDateDisabled;
        },
        language: "vi",
      });
      this.loaded = true;
    }
    connectedCallback() {
      this.init();

      subscribe(window.themeConfigs.firstInteraction, (e) => {
        this.init();
      });
    }
  }

  defineElement("datepicker-input", DatepickerInput);

  class CartDelivery extends HTMLElement {
    constructor() {
      super();
      this.inputElements = this.querySelectorAll("[name*=attributes]");
      this.form = this.querySelector("form");
      this.form.addEventListener("submit", this.onSubmit.bind(this));
    }

    reset() {
      this.inputElements.forEach((el) => {
        el.value = "";
      });
    }
    syncCartForm() {
      const cartForm = document.querySelector("cart-form");
      if (cartForm) {
        this.inputElements.forEach((el) => {
          let name = el.name;
          let input = cartForm.querySelector(`[name="${name}"]`);
          if (input) {
            input.value = el.value;
          }
        });
        cartForm.updateCartAttribute();
      }
    }
    onSubmit(e) {
      e.preventDefault();
      let isEnabled = this.querySelector("#delivery-enabled").checked;
		      this.querySelector("#use-delivery").value = isEnabled ? "có" : "không";

	  if(!this.querySelector('#delivery-date-input').value){
		  this.querySelector("#use-delivery").value = "không" 
		  this.querySelector("#delivery-enabled").removeAttribute('checked')
	  }
      this.syncCartForm();
      document.querySelector("#cart-delivery-drawer").hide();
    }
  }

  defineElement("cart-delivery", CartDelivery);
});