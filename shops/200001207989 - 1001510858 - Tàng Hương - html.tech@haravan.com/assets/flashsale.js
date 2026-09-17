window.addEventListener("DOMContentLoaded", () => {
  window.flahsaleProgrammes = window.flahsaleProgrammes || [];
  class FlashsaleSection extends HTMLElement {
    constructor() {
      super();
      this.notStartedAction = this.dataset.notStarted;
      this.endAction = this.dataset.ended;
      this.sectionId = this.dataset.id;

      this.items = this.querySelectorAll(".flashsale__item");
      this.carousel = this.querySelector("ega-carousel");
    }
    connectedCallback() {
      subscribe(window.themeConfigs.countdownUpdate, (e) => {
        if (e.id == this.sectionId && e.status) {
          switch (e.status) {
            case "not-started":
              this.onFlashSaleSNotStarted();
              break;
            case "ongoing":
              this.onFlashSaleStart();
              break;
            case "ended":
              this.onFlashSaleEnd();
              break;
          }
        }
      });
    }
    onFlashSaleSNotStarted() {
      this.toggleSection(this.notStartedAction != "hide");
    }
    onFlashSaleStart() {
      this.toggleSection(true);
    }
    onFlashSaleEnd() {
      this.toggleSection(this.endAction != "hide");
    }
    randomProductItem() {
      if (this.items) {

        this.items.forEach((el) => {
          el.style.order = this.getRandomNumber(this.items.length);
			console.log(el.style.order)
        });
      }
    }
    getRandomNumber(max) {
      return Math.floor(Math.random() * max) + 1;
    }

    toggleSection(show) {
      let section = document.querySelector(`#${this.sectionId}`);
      if (!section) return;
		console.log(show)
      if (show) {
        section.classList.remove("hidden");
        if (this.carousel && this.carousel.swiper) {
          this.carousel.swiper.destroy(true);
          if (this.dataset.random) this.randomProductItem();
          this.carousel.start();
        }else{
		          if (this.dataset.random) this.randomProductItem();
		}
      } else {
        section.classList.add("hidden");
      }
    }
  }
  defineElement("flashsale-section", FlashsaleSection);

  class CountDownTimer extends HTMLElement {
    constructor() {
      super();
      this.type = this.dataset.countdownType;
      this.startDate = this.dataset.startDate;
      this.endDate = this.dataset.endDate;
      this.startTime = this.dataset.startTime;
      this.endTime = this.dataset.endTime;
      this.dateInWeeks = this.dataset.week;
      this.sectionId = this.dataset.id;
      this.countDownState = "";
      this.timer = this.querySelector(".flashsale__countdown");
    }
    connectedCallback() {
      if (this.type == "hours") {
        this.end = convertTime(this.startDate + "-" + this.endTime);
        this.start = convertTime(this.startDate + "-" + this.startTime);
        if (this.dateInWeeks && this.checkCountDownStart()) {
          let currentDay = new Date().getDay();
          let currentDate = new Date().toLocaleString("vi-VN", {
            month: "numeric",
            day: "numeric",
            year: "numeric",
          });

          let startDate = this.dateInWeeks.includes(currentDay)
            ? currentDate
            : null;
          if (startDate) {
            startDate = startDate
              .split("/")
              .map((item) => this.padZero(item, 2))
              .join("/");
          }
          this.start = convertTime(startDate + "-" + this.startTime);
          this.end = convertTime(startDate + "-" + this.endTime);
        }
      } else {
        this.end = convertTime(this.endDate);
        this.start = convertTime(this.startDate);
      }
      this.countdown();
    }
    countdown() {
      let isStarted = this.checkCountDownStart();
      let isEnded = this.checkCountDownEnd();
      let status = "";

      if (!isStarted) {
        status = "not-started";
        let distance = this.calcDistance(this.start);
        this.renderCountDown(distance);
        this.timer.classList.remove("hidden");
        this.classList.add("active");
      }
      if (isStarted && !isEnded) {
        status = "ongoing";
        let distance = this.calcDistance(this.end);
        this.renderCountDown(distance);
        this.timer.classList.remove("hidden");

        this.classList.add("active");
      }
      if (isStarted && isEnded) {
        this.timer.innerHTML = "";
        status = "ended";
        this.classList.remove("active");
      }
      this.classList.add(status);

      if (status && status != this.countDownState) {
        this.querySelectorAll(".flashsale__countdown-label").forEach((el) =>
          el.classList.add("hidden")
        );
        this.querySelector(`[data-label="${status}"]`).classList.remove(
          "hidden"
        );
        this.countDownState = status;
        window.flahsaleProgrammes = window.flahsaleProgrammes || [];
        let countdown = {
          status,
          id: this.sectionId,
        };
        window.flahsaleProgrammes = window.flahsaleProgrammes.filter(
          (item) => item.id != this.sectionId
        );
        window.flahsaleProgrammes.push(countdown);
        publish(window.themeConfigs.countdownUpdate, {
          status,
          target: this,
          id: this.sectionId,
        });
      }
      if (isEnded) {
        return;
      }
      requestAnimationFrame(() => {
        this.countdown();
      });
    }

    checkCountDownStart() {
      let currentDate = new Date().getTime();
      return this.start && currentDate >= this.start;
    }
    checkCountDownEnd() {
      let currentDate = new Date().getTime();
      return this.end && currentDate > this.end;
    }
    getDays(times) {
      return Math.floor(times / (1000 * 60 * 60 * 24));
    }
    getHours(times) {
      return Math.floor((times % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    }
    getMinutes(times) {
      return Math.floor((times % (1000 * 60 * 60)) / (1000 * 60));
    }
    getSeconds(times) {
      return Math.floor((times % (1000 * 60)) / 1000);
    }
    padZero(number, width) {
      return number.toString().padStart(width, "0");
    }
    renderItem(times, label, animate) {
      return `<div class="ega-badge-ctd__item w-[4.4rem] md:w-[5.2rem] px-1 text-center py-1 md:py-1.5 rounded-sm ">
						  <div class=" ega-badge-ctd__h ega-badge-ctd--transition ${
                animate ? "ega-badge-ctd--animate" : ""
              } text-h5 md:text-h4 font-semibold"
						  style="--value:${!animate ? `${this.padZero(times, 2)}` : ""}"
						  ></div>
						  <span>${label}</span>
						</div>`;
    }
    renderCountDown(distance) {
      const { getDays, getHours, getMinutes, getSeconds } = this;
      let days = getDays(distance);
      let times = [
        days,
        getHours(distance),
        getMinutes(distance),
        getSeconds(distance),
      ];
      if (days <= 0) {
        times.shift();
      }
      if (this.timer.querySelector(".ega-badge-ctd__h")) {
        this.timer.querySelectorAll(".ega-badge-ctd__h").forEach((el, i) => {
          if (i >= times.length - 2) {
            el.style.setProperty("--value", times[i]);
            if (times[i] == 59) {
              el.classList.remove("ega-badge-ctd--transition");
            } else {
              el.classList.add("ega-badge-ctd--transition");
            }
          } else {
            el.innerHTML = this.padZero(times[i], 2);
          }
        });
        return;
      }
      let hours = this.renderItem(times[1], "Giờ");
      let minutes = this.renderItem(times[2], "Phút", true);
      let seconds = this.renderItem(times[3], "Giây", true);
      const html =
        days > 0
          ? [this.renderItem(times[0], "Ngày"), hours, minutes, seconds]
          : [hours, minutes, seconds];

      this.timer.innerHTML = `<div class="ega-badge-ctd flex items-center gap-2">${html.join(
        `<div class="ega-badge-dot font-semibold text-h5">:</div>`
      )}</div>`;
    }
    calcDistance(endTime) {
      let distance = 0;
      let now = new Date().getTime();
      distance = endTime - now;
      return distance;
    }
  }

  defineElement("countdown-timer", CountDownTimer);

  class StockCountdown extends HTMLElement {
    constructor() {
      super();
      this.type = this.dataset.type;
      this.realQty = parseInt(this.dataset.realQty);
      this.maxQty = parseInt(this.dataset.maxQty);
      this.available = this.dataset.available;
      this.sectionId = this.dataset.id;
    }
    connectedCallback() {
      let program = window.flahsaleProgrammes.find(
        (item) => item.id == this.sectionId
      );

      if (program) {
        this.action(program.status);
      }
      this.subscriber = subscribe(window.themeConfigs.countdownUpdate, (e) => {
        if (e.id == this.sectionId && e.status) {
          this.action(e.status);
        }
      });
    }
    disconnectedCallback() {
      this.subscriber();
    }
    action(status) {
      switch (status) {
        case "not-started":
        case "ended":
          this.hide();
          break;
        case "ongoing":
          this.init();
          break;
      }
    }
    hide() {
      this.innerHTML = "";
    }
    calcPercent() {
      if (!this.available) return null;
      let percent = 100 - (this.realQty / this.maxQty) * 100;
      if (isNaN(percent) || percent <= 0 || percent >= 100) {
        percent = 5;
      }
      return percent;
    }

    init() {
      let percent = this.calcPercent();
      console.log(percent)
      let label = "";
      let { openingText, soldText, runOutText, runOutQty } =
        window.flashsaleConfigs;
      let isStockManagement = this.dataset.stockManagement;
      runOutQty = parseInt(runOutQty);
      if (percent <= 5) {
        label = openingText;
      }

      if (percent > 5 && this.realQty > runOutQty) {
        let soldQty = this.maxQty - this.realQty;
        label = soldText.replace("[soluongdaban]", soldQty);
      }
      if (isStockManagement && percent > 5 && this.realQty < runOutQty) {
        label = runOutText.replace("[soluongtonkho]", this.realQty);
      }
      if (!this.available) {
        label = "Hết hàng";
        percent = 100;
      }
      let html = this.render(percent, label);
      this.innerHTML = html;
    }

    render(percent, label) {
      return `<div class="stock-countdown-inner">
						<div class="stock-label mb-1">${label}</div>
						<div class="stock-progressbar w-full bg-neutral-50 rounded-sm h-1">
						  <div class="stock-percent bg-primary rounded-sm h-1" style="width:${percent}%"></div>
						</div>
					</div>`;
    }
  }

  defineElement("stock-countdown", StockCountdown);

  class FlashsaleTabs extends TabsComponent {
    constructor() {
      super();
    }
    connectedCallback() {
      this.updateStatus();
      this.toggleActiveCountDown();
      this.subscriber = subscribe(window.themeConfigs.countdownUpdate, (e) => {
        this.updateStatus();
      });
    }
    toggleActiveCountDown() {
      this.querySelectorAll("countdown-timer[data-id]").forEach((e) => {
        e.classList.add("hidden");
      });
      this.activeTab &&
        this.querySelector(
          `countdown-timer[data-id="${this.activeTab.id}"]`
        ).classList.remove("hidden");
    }
    onTabClick(e) {
      super.onTabClick(e);
      this.toggleActiveCountDown();
    }
    updateStatus() {
      window.flahsaleProgrammes.forEach((item) => {
        let button = this.querySelector(`[aria-controls="${item.id}"]`);
        if (button) {
          this.updateTab(button, item.status);
        }
      });
      let activeButton =
        this.querySelector(".flashsale-tab.ongoing") ||
        this.querySelector(".flashsale-tab.not-started");
      if (activeButton) {
        activeButton.dispatchEvent(new Event("click"));
      }
      let endedButtons = this.querySelectorAll(".flashsale-tab.ended");
      if (endedButtons.length == this.tabBtns.length) {
        this.closest(".section").classList.add("flashsale-ended");
      }
    }
    updateTab(button, status) {
      let label = button.querySelector(".status");
      label.classList.remove("opacity-0");
      button.classList.remove("ended", "ongoing");
      button.removeAttribute("disabled");
      switch (status) {
        case "not-started":
          label.textContent = "Sắp diễn ra";
          button.classList.add("not-started");
          break;
        case "ended":
          label.textContent = "Đã kết thúc";
          button.classList.add("ended");
          button.setAttribute("disabled", true);
          break;
        case "ongoing":
          label.textContent = "Đang diễn ra";
          button.classList.add("ongoing");
          break;
      }
    }
  }

  defineElement("flashsale-tabs", FlashsaleTabs);
});