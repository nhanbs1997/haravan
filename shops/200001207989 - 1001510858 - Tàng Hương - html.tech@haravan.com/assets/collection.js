var abortController = null;

subscribe("EGA:facet-update", async (event) => {
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
  const url = event.url;
  const container = document.querySelector(event.container);
  const facet = event.facet;
  container.classList.add("loading");
  fetch(url.href, { signal: abortController.signal })
    .then((response) => response.text())
    .then((res) => {
      container.classList.remove("loading");

      container.querySelector(".product-list .grid").innerHTML = res;

      document
        .querySelectorAll(`${event.container} .page-link`)
        .forEach((link) => {
          link.addEventListener("click", (e) => {
            e.preventDefault();
            let page = e.currentTarget.dataset.page;
            if (page) {
              facet.page = page;
              facet.submit();
            }
          });
        });
      let header = document.querySelector(".header");
      let offset = container.offsetTop - header.offsetHeight - 50;

      window.scrollTo({
        top: offset,
        behavior: "smooth",
      });
      publish(window.themeConfigs.productLoaded);
    });
});

class FacetDrawer extends HTMLElement {
  constructor() {
    super();
  this.filterKeys = {
      price_min: "price",
      vendor: "vendor",
      type: "product_type",
      tag: "tag",
    };
    this.searchURL = window.location.origin + "/search";
    this.searchView = "filter";
    this.form = this.querySelector("form");
    this.page = 1;
    this.sort = "";
    this.addEventListener("change", this.onChange);
  }
  connectedCallback() {
    document
      .querySelectorAll("[data-toggle-facet]")
      .forEach((el) =>
        el.addEventListener("click", this.toggleFilter.bind(this))
      );

    this.init();
    if (window.themeConfigs.xlBreakpoint.matches) {
      this.querySelectorAll("details").forEach((el) => {
        el.setAttribute("open", true);
      });
    } else {
      document.addEventListener("click", (e) => {
        this.querySelectorAll("details").forEach((el) => {
          if (!el.contains(e.target)) {
            el.removeAttribute("open");
          }
        });
      });
    }
  }

  init() {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.forEach((value, key) => {
      let values = value.split(",");
      values.forEach((val) => {
        let checkbox = this.querySelector(`[name="${key}"][value="${val}"]`);
        if (checkbox) {
          checkbox.checked = true;
          this.shouldRender = true;
        }
      });
      if (key == "page") {
        this.page = value;
      }
      if (key == "sortby") {
        this.sort = value;
        this.shouldRender = true;
      }
    });

    if (this.shouldRender) {
      this.submit();
    }
  }
  handlePriceValue(value) {
    value = value.replace(":max", "");
    let valueArr = value.split(":");
    console.log(value);
    if (valueArr.length > 1) {
      value = `>=${valueArr[0]} AND <=${valueArr[1]}`;
    } else {
      value = `>=${valueArr[0]}`;
    }
    return value;
  }
  buildSearchURL() {
    const searchParams = new URLSearchParams(new FormData(this.form)),
      url = new URL(this.searchURL);
    url.search = "";
    let groups = {};

    searchParams.forEach((value, key) => {
      let val = decodeURI(value);
      if (key != "price_min") {
        val = `${val}`;
      } else {
        val = this.handlePriceValue(val);
      }
      if (groups[key]) {
        groups[key].push(`${val}`);
      } else {
        groups[key] = [`${val}`];
      }
    });
    let query = Object.keys(groups).map((key) => {
      let value = groups[key][0]
      if (groups[key].length > 1) {
        let q = groups[key].map((v)=>{
            return `(${this.filterKeys[key]}:product=${v})`
         })
        return q.join('||')
      }
      if(key == 'price_min'){
      let queryString =   value.split('AND').map(price => {
          return `(price:product${price})`
        })
        return `(${queryString.join('&&')})`
      }
      return `(${this.filterKeys[key]}:product=${value})`;
    });
    if (this.dataset.collection != 0) {
      query = [`(collectionid:product=${this.dataset.collection})`].concat(query);
    }
    let filterPram = query.join(" && ")
     url.searchParams.append("q", `filter=(${filterPram})`);
    console.log(`filter=(${filterPram})`)
    
    if (this.sort) {
      url.searchParams.append("sortby", this.sort);
    }

    url.searchParams.append("page", this.page);
    url.searchParams.append("view", this.searchView);
    return url;
  }

  buildCollectionURL() {
    const searchParams = new URLSearchParams(new FormData(this.form)),
      url = new URL(window.location.href);
    url.search = "";
    let groups = {};

    searchParams.forEach((value, key) => {
      let val = decodeURI(value);
      if (groups[key]) {
        groups[key].push(`${val}`);
      } else {
        groups[key] = [`${val}`];
      }
    });
    let query = Object.keys(groups).map((key) => {
      let value = groups[key].join(",");
      if (groups[key].length > 1) {
        value = `${value}`;
      }
      url.searchParams.append(key, value);
    });

    if (this.sort) {
      url.searchParams.append("sortby", this.sort);
    }

    url.searchParams.append("page", this.page);
    window.history.pushState({}, "", url.href);

    return url;
  }

  buildFilterItems() {
    const searchParams = new URLSearchParams(new FormData(this.form));
    let items = [];
    searchParams.forEach((value, key) => {
      let val = decodeURI(value);
      let title = this.querySelector(`[name="${key}"][value="${val}"]`).dataset
        .value;
      items.push(`   <div class="filter-item bg-background inline-flex font-semibold  items-center justify-center  whitespace-nowrap border rounded-sm py-1.5 px-3  gap-2 relative  border-secondary text-secondary">
				${title}
				<span class="js-remove-fitler cursor-pointer" data-key="${key}" data-value="${value}" > <i class="icon icon-cross" ></i> </span>
			 </div>`);
    });
    if (items.length == 0) return "";

    items.push(`<div key class="js-reset-filter filter-item inline-flex font-semibold  items-center justify-center py-1.5 px-3 relative  text-error cursor-pointer   whitespace-nowrap ">
				Xóa tất cả
			 </div>`);

    return `<div class="flex gap-2 items-center flex-nowrap md:flex-wrap overflow-auto"> ${items.join(
      ""
    )}</div>`;
  }

  onChange() {
    this.dirty = true;
    this.page = 1;
    this.submit();
  }
  removeFilterItem(e) {
    let value = e.currentTarget.dataset.value;
    let key = e.currentTarget.dataset.key;
    let checkbox = this.querySelector(`[name="${key}"][value="${value}"]`);
    if (checkbox) {
      checkbox.checked = false;
      this.onChange();
    }
  }
  resetAll() {
    this.form.reset();
    this.onChange();
  }
  submit(e) {
    let url = this.buildSearchURL();
    let container = `#product-list-${this.dataset.collection}`;

    if (this.dirty) {
      this.buildCollectionURL();
    }
    document.querySelector(`${container} .filter-items`).innerHTML =
      this.buildFilterItems();
    document.querySelectorAll(".js-remove-fitler").forEach((element) => {
      element.addEventListener("click", this.removeFilterItem.bind(this));
    });
    document.querySelectorAll(".js-reset-filter").forEach((element) => {
      element.addEventListener("click", this.resetAll.bind(this));
    });
document.querySelectorAll(".filter-count").forEach((el)=>{
		el.textContent =
      document.querySelectorAll(".js-remove-fitler").length;
	})
    publish("EGA:facet-update", {
      url,
      container,
      facet: this,
    });
  }
  toggleFilter() {
    const isHidden = this.querySelector(".collection-filter.hidden");
    const animationElement = this.querySelectorAll(".facet-inner");
    if (isHidden)
      this.querySelector(".collection-filter").classList.remove("hidden");
    playAnimation({
      query: animationElement,
      animation: "slide-in-right",
      time: 400,
      direction: isHidden ? "normal" : "reverse",
      callback: () => {
        if (!isHidden) {
          this.querySelector(".collection-filter").classList.add("hidden");
        }
      },
    });
  }
}
defineElement("facet-drawer", FacetDrawer);

class SortBy extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("change", this.onChange);
    this.init();
  }
  init() {
    const searchParams = new URLSearchParams(window.location.search);
    let value = searchParams.get("sortby");
    let checkbox = this.querySelector(`[value="${value}"]`);
    if (checkbox) {
      checkbox.checked = true;
      checkbox.selected = true;
    }
  }
  onChange(e) {
    let id = this.dataset.collection;
    let facet = document.querySelector(`facet-drawer[data-collection="${id}"]`);
    if (facet) {
      facet.sort = e.target.value;
      facet.onChange();
    }
  }
}
defineElement("sort-by", SortBy);

$(".filter-item-toggle").click(function () {
  $(this).toggleClass("show");
  let overflowItem = $(this).parent().find(".overflow-item");
  overflowItem.toggle();
  let text = !$(this).hasClass("show")
    ? ' Xem thêm <i class="icon icon-carret-down"></i> '
    : 'Thu gọn  <i class="icon icon-carret-up"></i>';
  $(this).html(text);
});