// Đảm bảo jQuery đã được tải trước Bizweb API
// Khai báo biến toàn cục để lưu trữ ngưỡng miễn phí vận chuyển
const FREE_SHIPPING_THRESHOLD = 1000000; // 1,000,000 VND

// --- Cấu hình quà tặng ---
const GIFT_THRESHOLD_1M = 1000000;    // Ngưỡng cho quà 1
const GIFT_VARIANT_ID_1M = 1165222024; // <-- THAY THẾ BẰNG ID VARIANT CỦA QUÀ 1 (Ví dụ)
const GIFT_THRESHOLD_1M5 = 1500000;   // Ngưỡng cho quà 2
const GIFT_VARIANT_ID_1M5 = 1165222000; // <-- THAY THẾ BẰNG ID VARIANT CỦA QUÀ 2 (Ví dụ)
// -------------------------

// --- CẤU HÌNH DANH MỤC SẢN PHẨM GỢI Ý CỐ ĐỊNH ---
// URL mới trả về HTML đã định dạng sẵn cho Swiper
const FIXED_RECOMMENDED_COLLECTION_URL = '/collections/san-pham-noi-bat?view=ajaxflashsale';
// ------------------------------------------------

// Biến toàn cục để lưu trữ thông tin sản phẩm vừa thêm gần nhất
let lastAddedProduct = null;
// Biến cờ để kiểm soát việc tải lại sản phẩm gợi ý
let shouldLoadRecommendedProducts = false;

// Hàm định dạng tiền tệ
function formatMoneyBizweb(amount, format) {
  return Bizweb.formatMoney(amount, format || "");
}

// Hàm quản lý quà tặng
function manageGifts(cart) {
  const currentTotalPrice = cart.total_price;
  let giftToAdd = null;
  let giftToRemove = null;

  const hasGift1 = cart.items.some(item => item.variant_id === GIFT_VARIANT_ID_1M);
  const hasGift2 = cart.items.some(item => item.variant_id === GIFT_VARIANT_ID_1M5);

  if (currentTotalPrice >= GIFT_THRESHOLD_1M5) {
    // Đạt 1.500.000: Cần có Quà 2, không có Quà 1
    if (!hasGift2) {
      giftToAdd = GIFT_VARIANT_ID_1M5;
    }
    if (hasGift1) {
      giftToRemove = GIFT_VARIANT_ID_1M;
    }
  } else if (currentTotalPrice >= GIFT_THRESHOLD_1M) {
    // Đạt 1.000.000 nhưng dưới 1.500.000: Cần có Quà 1, không có Quà 2
    if (!hasGift1) {
      giftToAdd = GIFT_VARIANT_ID_1M;
    }
    if (hasGift2) {
      giftToRemove = GIFT_VARIANT_ID_1M5;
    }
  } else {
    // Dưới 1.000.000: Không có quà nào
    if (hasGift1) {
      giftToRemove = GIFT_VARIANT_ID_1M;
    }
    if (hasGift2) {
      giftToRemove = GIFT_VARIANT_ID_1M5;
    }
  }

  const giftActions = [];

  if (giftToRemove) {
    giftActions.push(new Promise((resolve, reject) => {
      console.log(`Xóa quà tặng: ${giftToRemove}`);
      Bizweb.changeItem(giftToRemove, 0, resolve, reject);
    }));
  }

  if (giftToAdd) {
    const existingGift = cart.items.find(item => item.variant_id === giftToAdd);
    if (!existingGift || existingGift.quantity === 0) {
        giftActions.push(new Promise((resolve, reject) => {
            console.log(`Thêm quà tặng: ${giftToAdd}`);
            Bizweb.addItem(giftToAdd, 1, resolve, reject);
        }));
    }
  }

  return Promise.all(giftActions)
    .then(() => {
      return new Promise((resolve) => {
        Bizweb.getCart(resolve);
      });
    })
    .catch(error => {
      console.error("Lỗi khi quản lý quà tặng:", error);
      return new Promise((resolve) => {
        Bizweb.getCart(resolve);
      });
    });
}

// Biến để lưu instance của Swiper (để có thể destroy và khởi tạo lại)
let recommendedSwiper = null;

// Hàm Tải Sản phẩm Gợi ý
function loadRecommendedProducts(collectionUrl) {
  const $swiperContainer = $('#recommended-products-swiper');
  const $swiperWrapper = $swiperContainer.find('.swiper-wrapper');
  $swiperWrapper.empty(); // Xóa các slide cũ
  $.ajax({
    url: collectionUrl,
    type: 'GET',
    dataType: 'html', // Vẫn giữ là 'html' vì bạn nhận về HTML
    success: function(responseHtml) {
      // Bọc responseHtml vào một jQuery object để dễ dàng tìm kiếm
      const $responseContent = $('<div>').html(responseHtml); // Tạo một div tạm thời

      // Tìm tất cả các product-item bên trong .swiper-products
      const $productItems = $responseContent.find('.swiper-products .product-item');

      // Kiểm tra nếu không có sản phẩm nào
      if ($productItems.length === 0) {
        console.warn(`Không tìm thấy sản phẩm gợi ý từ URL: "${collectionUrl}".`);
        $('#recommended-products-section').hide(); // Ẩn nếu không có sản phẩm
        return;
      }
      // Lọc các sản phẩm không mong muốn và thêm vào Swiper
      let filteredProductItems = [];
      $productItems.each(function() {
        const $productItem = $(this);
        // Lấy variant ID từ nút "Add to cart" bên trong product-item.
        // Điều này giả định nút .add-to-cart-btn đã có data-variant-id từ HTML trả về.
        const currentVariantId = $productItem.find('.add-to-cart-btn').data('variant-id'); 

        // Bỏ qua nếu là sản phẩm vừa thêm hoặc là sản phẩm quà tặng
        if (lastAddedProduct && currentVariantId && currentVariantId === lastAddedProduct.variant_id) {
          return true; // continue
        }
        if (currentVariantId && (currentVariantId === GIFT_VARIANT_ID_1M || currentVariantId === GIFT_VARIANT_ID_1M5)) {
          return true; // continue
        }

        // Thêm class 'swiper-slide' và 'recommended-product-card'
        $productItem.addClass('swiper-slide recommended-product-card');
        filteredProductItems.push($productItem[0].outerHTML); // Lấy HTML của product-item đã sửa đổi
      });

      if (filteredProductItems.length > 0) {
        // Thêm tất cả các product-item đã lọc vào swiper-wrapper
        $swiperWrapper.append(filteredProductItems.join(''));

        // Khởi tạo Swiper
        if (recommendedSwiper) {
            recommendedSwiper.destroy(true, true);
        }
        recommendedSwiper = new Swiper('#recommended-products-swiper', {
          slidesPerView: 2,
          spaceBetween: 10,
          navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
          },
          pagination: {
            el: '#recommended-products-swiper .swiper-pagination',
            dynamicBullets: true
          },
          breakpoints: {
            320: { slidesPerView: 2, spaceBetween: 8 },
				768: { slidesPerView: 3, spaceBetween: 10 },
				992: { slidesPerView: 4, spaceBetween: 10 },
				1200: { slidesPerView: 4, spaceBetween: 10 },
          }
        });
        $('#recommended-products-section').show(); // Hiển thị section
		  window.comparison.init();
			initSwatchImageSwitcher();
		  $(document).ready(function () {
				var modal = $('#quick-view-product');
				var btn = $('.quick-view');
				btn.click(function () {
					modal.modal('show');
				});
			});
      } else {
        $('#recommended-products-section').hide(); // Ẩn nếu không có sản phẩm gợi ý nào để hiển thị
      }
    },
    error: function(xhr, status, error) {
      console.error(`Lỗi khi tải sản phẩm gợi ý từ URL: "${collectionUrl}":`, error);
      $('#recommended-products-section').hide();
    }
  });
}

// Hàm Cập nhật Giỏ hàng và Hiển thị Slide Cart
function updateAndShowSlideCart() {
  Bizweb.getCart(function(cart) {
    // Luôn cập nhật số lượng item trên biểu tượng giỏ hàng
    $('.cart-item-count').text(cart.item_count);

    // Gọi hàm quản lý quà tặng VÀ chờ nó hoàn thành
    manageGifts(cart).then(updatedCart => {
      const cartItemsList = $('#cart-items-list');
      cartItemsList.empty(); // Xóa các mục cũ

      if (updatedCart.item_count === 0) {
        cartItemsList.html('<div class="d-flex flex-column justify-content-center align-items-center cart-empty-message"><svg width="150" height="150" class="mb-2"><use xlink:href="#icon-cart-empty"></use></svg><p>Giỏ hàng của bạn đang trống.</p></div>');
        $('#recommended-products-section').hide(); // Ẩn swiper nếu giỏ hàng trống
		$('#shipping-progress-bar').hide();
        $('#slide-cart-footer').hide();

        // Cập nhật tổng tiền và miễn phí ship ngay cả khi giỏ trống
        $('#cart-total-price').text(formatMoneyBizweb(0));
        $('#countdown-amount').text('Đơn hàng của bạn chưa đủ điều kiện miễn phí vận chuyển.');
        $('#shipping-progress').css('width', '0%');

      } else {
		$('#shipping-progress-bar').show();
        $('#slide-cart-footer').show();
        // Sắp xếp lại để sản phẩm vừa thêm nằm đầu tiên
        let sortedItems = [...updatedCart.items];
        if (lastAddedProduct) {
            const lastAddedIndex = sortedItems.findIndex(item => item.variant_id === lastAddedProduct.variant_id);
            if (lastAddedIndex > -1) {
                const item = sortedItems.splice(lastAddedIndex, 1)[0];
                sortedItems.unshift(item); // Đặt sản phẩm vừa thêm vào đầu mảng
            }
        }

        $.each(sortedItems, function(index, item) {
          const isGift = (item.variant_id === GIFT_VARIANT_ID_1M || item.variant_id === GIFT_VARIANT_ID_1M5);
			// Ẩn variant_title nếu là "Default Title"
          const displayVariantTitle = (item.variant_title === "Default Title") ? "" : `<p>${item.variant_title}</p>`;

          const itemHtml = `
            <div class="cart-item ${isGift ? 'is-gift' : ''} ${item.variant_id === (lastAddedProduct ? lastAddedProduct.variant_id : null) ? 'last-added' : ''}" data-variant-id="${item.variant_id}">
              <div class="cart-item-image">
                <img src="${Bizweb.resizeImage(item.image, 'compact')}" alt="${item.name}">
              </div>
              <div class="cart-item-details">
                <h4><a href="${item.url}" title="${item.product_name}">${item.product_name}</a></h4>
                ${displayVariantTitle}
                ${isGift ?
                  '<span class="cart-item-price gift-price">Quà tặng</span>' :
                  `<span class="cart-item-price">${formatMoneyBizweb(item.line_price)}</span>`
                }
                <div class="cart-item-actions">
                  ${isGift ?
                    '<span class="gift-quantity">SL: 1</span>' :
                    `<div class="cart-item-quantity">
                      <button class="quantity-minus" data-variant-id="${item.variant_id}" data-quantity="${item.quantity - 1}">-</button>
                      <input type="number" class="quantity-input" value="${item.quantity}" min="1" data-variant-id="${item.variant_id}">
                      <button class="quantity-plus" data-variant-id="${item.variant_id}" data-quantity="${item.quantity + 1}">+</button>
                    </div>
                    <button class="cart-item-remove" data-variant-id="${item.variant_id}" title="Xoá sản phẩm"><svg width="20" height="20"><use xlink:href="#icon-trash" /></svg></button>`
                  }
                </div>
              </div>
            </div>
          `;
          cartItemsList.append(itemHtml);
        });

        // Cập nhật tổng tiền
        $('#cart-total-price').text(formatMoneyBizweb(updatedCart.total_price));

        // Cập nhật đếm ngược miễn phí vận chuyển
        const remainingAmount = FREE_SHIPPING_THRESHOLD - updatedCart.total_price;
        const countdownAmountElement = $('#countdown-amount');
        const shippingProgress = $('#shipping-progress');

        if (remainingAmount <= 0) {
          countdownAmountElement.text('Đơn hàng của bạn đã đủ điều kiện');
          shippingProgress.css('width', '100%');
        } else {
          countdownAmountElement.text(`Thêm ${formatMoneyBizweb(remainingAmount)} nữa để được miễn phí vận chuyển!`);
          const progress = (updatedCart.total_price / FREE_SHIPPING_THRESHOLD) * 100;
          shippingProgress.css('width', `${Math.min(progress, 100)}%`);
        }

        // Tải sản phẩm gợi ý CHỈ KHI shouldLoadRecommendedProducts là true
        if (shouldLoadRecommendedProducts) {
            loadRecommendedProducts(FIXED_RECOMMENDED_COLLECTION_URL);
            shouldLoadRecommendedProducts = false; // Đặt lại cờ sau khi tải
        }
      }

      // Hiển thị slide cart
      $('#slide-cart').addClass('is-open');
      $('.slide-cart-overlay').addClass('is-visible');
    });
  });
}


// --- CÁC HÀM XỬ LÝ SỰ KIỆN CHÍNH ---
$(document).ready(function() {
  // Mở giỏ hàng trượt ngang khi click vào biểu tượng giỏ hàng (ví dụ: một link có class .open-slide-cart)
  $(document).on('click', '.open-slide-cart', function(e) {
    e.preventDefault();
    // Luôn tải lại sản phẩm gợi ý khi mở giỏ hàng nếu chưa được tải hoặc giỏ hàng trống
    Bizweb.getCart(function(cart) {
        if (!recommendedSwiper || cart.item_count === 0) {
            shouldLoadRecommendedProducts = true;
        }
        updateAndShowSlideCart();
    });
  });

  // Đóng giỏ hàng trượt ngang và ẩn luôn sản phẩm gợi ý
  $(document).on('click', '.slide-cart-close, .slide-cart-overlay', function() {
    $('#slide-cart').removeClass('is-open');
    $('.slide-cart-overlay').removeClass('is-visible');
    $('#recommended-products-section').hide(); // Ẩn ngay cả khi không có lớp 'is-open'
  });

  // Xử lý thêm sản phẩm vào giỏ hàng từ product card hoặc trang chi tiết
  $(document).on('click', '.add-to-cart-btn', function(e) {
    e.preventDefault();
    const $this = $(this);
    
    // Đặt cờ để tải lại sản phẩm gợi ý sau khi thêm sản phẩm thành công
    shouldLoadRecommendedProducts = true; 

    $this.prop('disabled', true).text('Đang thêm...');

    let postData;
    const $form = $this.closest('form');
    if ($form.length > 0) {
      // Nút nằm trong form -> lấy dữ liệu từ form
      postData = $form.serialize();
    } else {
      // Cảnh báo: Nút này không nằm trong form và không có data-variant-id.
      // Cần đảm bảo nếu có nút .add-to-cart-btn không nằm trong form,
      // thì nó phải có data-variant-id để lấy thông tin sản phẩm.
      console.error("Lỗi: Nút 'Thêm vào giỏ' không nằm trong form và không thể lấy thông tin sản phẩm.");
      alert("Có lỗi xảy ra: Không thể thêm sản phẩm vào giỏ hàng. Vui lòng thử lại.");
      $this.prop('disabled', false).text('Thêm vào giỏ');
      shouldLoadRecommendedProducts = false; // Đặt lại cờ nếu không thêm được
      return;
    }

    $.ajax({
      type: 'POST',
      url: '/cart/add.js',
      data: postData, // Dữ liệu từ form đã serialize
      dataType: 'json',
      success: function(item) {
        lastAddedProduct = item; // Lưu lại sản phẩm vừa thêm
        updateAndShowSlideCart(); // Cập nhật giỏ hàng trượt ngang
        $this.prop('disabled', false).text('Đã thêm');
        setTimeout(() => $this.text('Thêm vào giỏ'), 2000); // Đặt lại text sau 2 giây

        // Ẩn Quickview Modal nếu thêm sản phẩm thành công từ Quickview
        if ($this.closest('#quick-view-product').length > 0) {
            $('#quick-view-product').modal('hide'); // Sử dụng hàm hide của Bootstrap modal
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        const errorMessage = jqXHR.responseJSON && jqXHR.responseJSON.description ? jqXHR.responseJSON.description : 'Có lỗi xảy ra khi thêm sản phẩm.';
        alert(errorMessage);
        console.error('Lỗi thêm sản phẩm:', textStatus, errorThrown, jqXHR.responseJSON);
        $this.prop('disabled', false).text('Thêm vào giỏ');
        shouldLoadRecommendedProducts = false; // Đặt lại cờ nếu không thêm được
      }
    });
  });

  // Xử lý thay đổi số lượng sản phẩm trong giỏ hàng (nút +/-) - Dùng chung cho cả Slide Cart và Cart Page
  $(document).on('click', '.cart-item-quantity .quantity-minus, .cart-item-quantity .quantity-plus', function() {
    const $this = $(this);
    const variantId = $this.data('variant-id');
    const newQuantity = parseInt($this.data('quantity'));

    // Không tải lại sản phẩm gợi ý khi thay đổi số lượng
    shouldLoadRecommendedProducts = false; 

    if (newQuantity < 1) { // Ngăn số lượng dưới 1
        Bizweb.removeItem(variantId, function(cart) {
            updateAndShowSlideCart(); // Sẽ kích hoạt manageGifts
        }, function(XMLHttpRequest, textStatus) {
            Bizweb.onError(XMLHttpRequest, textStatus);
            // Nếu có lỗi, cập nhật lại để đồng bộ UI
            if ($('body').hasClass('template-cart')) { // Nếu đang ở trang cart page
                location.reload();
            } else {
                updateAndShowSlideCart();
            }
        });
        return;
    }

    Bizweb.changeItem(variantId, newQuantity, function(cart) {
      // Nếu đang ở trang giỏ hàng chi tiết (/cart), reload trang để cập nhật đầy đủ
      if ($('body').hasClass('template-cart')) {
        location.reload();
      } else {
        updateAndShowSlideCart(); // Sẽ kích hoạt manageGifts
      }
    }, function(XMLHttpRequest, textStatus) {
      Bizweb.onError(XMLHttpRequest, textStatus);
      if ($('body').hasClass('template-cart')) {
        location.reload();
      } else {
        updateAndShowSlideCart();
      }
    });
  });

  // Xử lý thay đổi số lượng sản phẩm trong giỏ hàng (input text) - Dùng chung cho cả Slide Cart và Cart Page
  $(document).on('change', '.cart-item-quantity input.quantity-input', function() {
    const $this = $(this);
    const variantId = $this.data('variant-id');
    let newQuantity = parseInt($this.val());

    // Không tải lại sản phẩm gợi ý khi thay đổi số lượng
    shouldLoadRecommendedProducts = false; 

    if (isNaN(newQuantity) || newQuantity < 1) {
      newQuantity = 1;
      $this.val(newQuantity);
    }

    Bizweb.changeItem(variantId, newQuantity, function(cart) {
      if ($('body').hasClass('template-cart')) {
        location.reload();
      } else {
        updateAndShowSlideCart();
      }
    }, function(XMLHttpRequest, textStatus) {
      Bizweb.onError(XMLHttpRequest, textStatus);
      if ($('body').hasClass('template-cart')) {
        location.reload();
      } else {
        updateAndShowSlideCart();
      }
    });
  });

  // Xử lý xóa sản phẩm khỏi giỏ hàng - Dùng chung cho cả Slide Cart và Cart Page
  $(document).on('click', '.cart-item-remove', function() {
    const $this = $(this);
    const variantId = $this.data('variant-id');

    // Không tải lại sản phẩm gợi ý khi xóa item
    shouldLoadRecommendedProducts = false; 

    // Có thể thêm xác nhận ở đây: if (confirm('Bạn có chắc muốn xóa sản phẩm này?')) { ... }
    Bizweb.removeItem(variantId, function(cart) {
      if ($('body').hasClass('template-cart')) {
        location.reload();
      } else {
        updateAndShowSlideCart(); // Sẽ kích hoạt manageGifts
      }
    }, function(XMLHttpRequest, textStatus) {
      Bizweb.onError(XMLHttpRequest, textStatus);
      if ($('body').hasClass('template-cart')) {
        location.reload();
      } else {
        updateAndShowSlideCart();
      }
    });
  });

  // --- CÁC HÀM XỬ LÝ SỰ KIỆN TRANG GIỎ HÀNG RIÊNG ( /cart ) ---
  // Xử lý click nút "Áp dụng" mã giảm giá trên trang giỏ hàng
  $(document).on('click', '#apply-discount-btn', function(e) {
    e.preventDefault();
    const discountCode = $('#discount-code-input').val().trim();

    if (discountCode) {
      $('#cart-form').submit(); // Submit form
    } else {
      alert('Vui lòng nhập mã giảm giá.');
    }
  });

  // Xử lý cập nhật ghi chú giỏ hàng (chỉ cần trên trang giỏ hàng)
  $(document).on('change', '#cart-note', function() {
    const note = $(this).val();
    Bizweb.updateCartNote(note, function(cart) {
      console.log('Ghi chú giỏ hàng đã được cập nhật.');
    }, function(XMLHttpRequest, textStatus) {
      Bizweb.onError(XMLHttpRequest, textStatus);
    });
  });

  // Nút "Cập nhật giỏ hàng" (chỉ trên trang giỏ hàng)
  $(document).on('click', '.btn-update-cart', function(e) {
    e.preventDefault();

    const $form = $(this).closest('form');
    Bizweb.updateCartFromForm($form.attr('id'), function(cart) {
      location.reload(); // Reload trang để cập nhật UI và áp dụng giảm giá
    }, function(XMLHttpRequest, textStatus) {
      Bizweb.onError(XMLHttpRequest, textStatus);
      location.reload(); // Reload lại trang nếu có lỗi để đồng bộ
    });
  });
});

// Ghi đè Bizweb.onCartUpdate để luôn cập nhật slide cart và quản lý quà tặng
var originalBizwebOnCartUpdate = Bizweb.onCartUpdate;
Bizweb.onCartUpdate = function(cart) {
  if (originalBizwebOnCartUpdate) {
      originalBizwebOnCartUpdate(cart); // Gọi hàm gốc nếu có
  }
  // Luôn cập nhật số lượng item trên biểu tượng giỏ hàng ngay khi có cập nhật giỏ hàng
  $('.cart-item-count').text(cart.item_count);
  
  // Chỉ cập nhật slide cart nếu không ở trang giỏ hàng chi tiết (vì trang chi tiết sẽ reload)
  if (!$('body').hasClass('template-cart')) {
      updateAndShowSlideCart();
  }
};

var originalBizwebOnItemAdded = Bizweb.onItemAdded;
Bizweb.onItemAdded = function(item) {
  if (originalBizwebOnItemAdded) {
      originalBizwebOnItemAdded(item); // Gọi hàm gốc nếu có
  }
  // Khi sản phẩm được thêm vào qua Bizweb.addItem (không phải từ event listener của chúng ta)
  lastAddedProduct = item; // Cập nhật lastAddedProduct
  shouldLoadRecommendedProducts = true; // Đặt cờ để tải lại sản phẩm gợi ý
  if (!$('body').hasClass('template-cart')) {
      updateAndShowSlideCart();
  }
};


// Khởi tạo số lượng giỏ hàng trên biểu tượng giỏ hàng khi tải trang
$(document).ready(function() {
  Bizweb.getCart(function(cart) {
    $('.cart-item-count').text(cart.item_count);
  });
});