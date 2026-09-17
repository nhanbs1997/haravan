initQuickView();
var product = {};
var currentLinkQuickView = '';
var option1 = '';
var option2 = '';
function setButtonNavQuickview() {
	$("#quickview-nav-button a").hide();
	$("#quickview-nav-button a").attr("data-index", "");
	var listProducts = $(currentLinkQuickView).closest(".slide").find("a.quick-view");
	if(listProducts.length > 0) {
		var currentPosition = 0;
		for(var i = 0; i < listProducts.length; i++) {
			if($(listProducts[i]).data("handle") == $(currentLinkQuickView).data("handle")) {
				currentPosition = i;
				break;
			}
		}
		if(currentPosition < listProducts.length - 1) {
			$("#quickview-nav-button .btn-next-product").show();
			$("#quickview-nav-button .btn-next-product").attr("data-index", currentPosition + 1);
		}
		if(currentPosition > 0) {
			$("#quickview-nav-button .btn-previous-product").show();
			$("#quickview-nav-button .btn-previous-product").attr("data-index", currentPosition - 1);
		}
	}
	$("#quickview-nav-button a").click(function() {
		$("#quickview-nav-button a").hide();
		var indexLink = parseInt($(this).data("index"));
		if(!isNaN(indexLink) && indexLink >= 0) {
			var listProducts = $(currentLinkQuickView).closest(".slide").find("a.quick-view");
			if(listProducts.length > 0 && indexLink < listProducts.length) {
				$(listProducts[indexLink]).trigger("click");
			}
		}
	});
}
function initQuickView(){
    $(document).on("click", "#thumblist_quickview li", function() {        
        changeImageQuickView($(this).find("img:first-child"), ".product-featured-image-quickview");
        $('#thumblist_quickview li').removeClass('active');
        $(this).addClass('active');
    });    
    $(document).on('click', '.quick-view', function(e) {
        e.preventDefault();
        var producthandle = $(this).data("handle");
        currentLinkQuickView = $(this);
        
        Haravan.getProduct(producthandle, function(product) {
            var qvhtml = $("#quickview-modal").html();
            $(".quick-view-product").html(qvhtml);
            var quickview = $(".quick-view-product");
            
            // --- 1. XỬ LÝ NỘI DUNG MÔ TẢ ---
            var rawDes = product.summary || product.description || "";
            var cleanDes = rawDes.replace(/(<([^>]+)>)/ig, ""); 
            var productdes = "";
            if (cleanDes.length > 300) {
                productdes = cleanDes.substring(0, 300) + "...";
            } else {
                productdes = cleanDes;
            }

            var $descContent = quickview.find(".form_product_content .rte");
            if ($descContent.length === 0) $descContent = quickview.find(".rte");

            if(productdes != null && productdes !=""){
                $descContent.html(productdes);
            } else {
                $descContent.html('Thông tin sản phẩm đang cập nhật');
            }
            
            // --- XỬ LÝ ẢNH ---
            var featured_image = Haravan.resizeImage(product.featured_image, "large");
            if(featured_image == null){
                featured_image = 'https://cdn.hstatic.net/themes/200001127691/1001446790/14/noimage.jpg?v=232'; 
            }
            setButtonNavQuickview();
            if(featured_image != null){
                quickview.find(".view_full_size img").attr("src",featured_image);
            }

            // --- XỬ LÝ GIÁ & FORM HIỂN THỊ ---
            if(product.price < 1 && product.variants.length < 2){            
                quickview.find(".price").html('Liên hệ');
                quickview.find("del").html('');
                quickview.find("#quick-view-product form").hide();
                quickview.find(".prices").html('<span class="price product-price">Liên hệ</span>');
                quickview.find(".add_to_cart_detail span").html('Liên hệ');
            } else {
                quickview.find("#quick-view-product form").show();
                
                quickview.find(".price").html(Haravan.formatMoney(product.price, "{{amount_no_decimals_with_comma_separator}}₫" ));
                
            }

            quickview.find(".product-item").attr("id", "product-" + product.id);
            quickview.find(".qv-link").attr("href",product.url);
            quickview.find(".variants").attr("id", "product-actions-" + product.id);
            quickview.find(".variants select").attr("id", "product-select-" + product.id);
            
            var pName = product.title || product.name;
            quickview.find(".quick-names").html('Xem nhanh: '+ pName); 
            quickview.find(".qwp-name").html('<a class="text2line" href="'+ product.url +'" title="'+ pName +'">'+ pName +'</a>');
            quickview.find(".reviews_qv .text_revi").html('<a href="'+ product.url +'" title="Đánh giá '+ pName +'"><i class="fa fa-edit"></i>&nbsp;Đánh giá</a>');
            $('.soluong1').show();
            
            if(product.vendor) quickview.find(".vend-qv .vendor_").append(product.vendor);
            else quickview.find(".vend-qv .vendor_").append("<span>Đang cập nhật</span>");
            
            if(product.variants[0].sku) quickview.find(".vend-qv .sku_").append(product.variants[0].sku);
            else quickview.find(".vend-qv .sku_").append("<span>Đang cập nhật</span>");
            
            if(product.available){
                quickview.find(".vend-qv .soluong").html('Còn hàng');
            } else {
                quickview.find(".vend-qv .soluong").html('Hết hàng');
                $('.soluong1').hide();
            }
            
            quickview.find(".view-more").attr('href',product.url);
            
            if (product.compare_at_price_max > product.price) {
                
                quickview.find(".old-price").html(Haravan.formatMoney(product.compare_at_price_max, "{{amount_no_decimals_with_comma_separator}}₫" )).show();
                
                quickview.find(".price").addClass("sale-price")
            } else {
                quickview.find(".old-price").html("");
                quickview.find(".price").removeClass("sale-price")
            }
            
            // --- 2. TẠO SWATCH (BIẾN THỂ) ---
            if (!product.available) {
                $(".quick-view-product form").show();
                $(".quick-view-product .quantity_wanted_p").show();
                
                quickViewVariantsSwatch(product, quickview); 
                
                if(product.price < 1) $('#quick-view-product form').hide();
                else $('#quick-view-product form').show();
                
                $(".soluong_qv").hide();
                $('.soluong1').hide();
                quickview.find(".add_to_cart_detail").text("Hết hàng").addClass("disabled").attr("disabled", "disabled");                
                
                if(product.variants.length > 1) quickview.find("select, .dec, .inc, .variants label").show();
                else quickview.find("select, .dec, .inc, .variants label").hide();
            } else {
                quickViewVariantsSwatch(product, quickview); 
                
                $(".quick-view-product .quantity_wanted_p").show();
                if(product.variants.length > 1) $('#quick-view-product form').show();
                else {
                    if(product.price < 1) $('#quick-view-product form').hide();
                    else $('#quick-view-product form').show();
                }
            }

            // --- 3. DI CHUYỂN form_product_content (SỬA LỖI HierarchyRequestError) ---
            
            var $desc = quickview.find(".form_product_content");
            if ($desc.length === 0) {
                $desc = quickview.find(".product-description");
            }

            // Tìm khối Swatch cuối cùng
            var $lastSwatch = quickview.find("form.variants .swatch").last();
            
            if ($desc.length > 0) {
                if ($lastSwatch.length > 0) {
                    // CÓ SWATCH: Chuyển xuống dưới swatch
                    $desc.insertAfter($lastSwatch);
                } else {
                    // KHÔNG CÓ SWATCH (1 Variant):
                    var $qtyBlock = quickview.find(".quantity_wanted_p");
                    
                    // !!! SỬA LỖI Ở ĐÂY !!!
                    // Kiểm tra: Chỉ di chuyển nếu $qtyBlock KHÔNG nằm bên trong $desc
                    if ($qtyBlock.length > 0 && !$.contains($desc[0], $qtyBlock[0])) {
                        $desc.insertBefore($qtyBlock);
                    } else {
                        // Nếu bị lỗi hierarchy hoặc không tìm thấy qtyBlock:
                        // Chèn vào đầu form variants để an toàn (ngay dưới giá)
                        $desc.prependTo(quickview.find("form.variants"));
                    }
                }
                
                // CSS
                $desc.css({
                    'margin-top': '15px', 
                    'margin-bottom': '15px', 
                    'clear': 'both', 
                    'width': '100%',
                    'display': 'block'
                });
            }
            // -----------------------------------------------------------
            
            quickview.find('.more_info_block .page-product-heading li:first, .more_info_block .tab-content section:first').addClass('active');
            $(".view_scroll_spacer").removeClass("d-none");
            loadQuickViewSlider(product, quickview);
            
            setTimeout(function(){                    
                var thumbLargeimg = $('.view_full_size .img-product #product-featured-image-quickview').attr('src');
                var thumMedium = $('#thumbs_list_quickview .owl-item li').find('img').attr('src');
                if (thumbLargeimg == thumMedium) {
                    $( "#thumbs_list_quickview .owl-item li" ).first().addClass( "active" );
                }
            },2000);
            
            if ($(".quick-view .total-price").length > 0) {
                $(".quick-view input[name=quantity]").on("change", updatePricingQuickView)
            }            
            updatePricingQuickView();
            
            $(".js-qty__adjust").off('click').on("click", function() {
                var el = $(this),
                    id = el.data("id"),
                    qtySelector = el.siblings(".js-qty__num"),
                    qty = parseInt(qtySelector.val().replace(/\D/g, ''));
                var qty = validateQty(qty);
                if (el.hasClass("js-qty__adjust--plus")) qty = qty + 1;
                else {
                    qty = qty - 1;
                    if (qty <= 1) qty = 1;
                }
                qtySelector.val(qty);
                updatePricingQuickView();
            });
            
            $(document).on('input', '.quantity_wanted_p input', function(){
                var num = this.value.match(/^\d+$/);
                if (num === null) this.value = "";
                if (num == 0) this.value = 1;
            });
        });

        return false;
    });
}
		function loadQuickViewSlider(n, r) {
			productImage();
			var loadingImgQuickView = $('.loading-imgquickview');
			var s = Haravan.resizeImage(n.featured_image, "grande");
			r.find(".quickview-featured-image").append('<a href="' + n.url + '"><img src="' + s + '" title="Ảnh sản phẩm"/><div style="height: 100%; width: 100%; top:0; left:0 z-index: 2000; position: absolute; display: none; background: url(' + window.loading_url + ') 50% 50% no-repeat;"></div></a>');
			if (n.images.length > 1) {
				$('.thumbs_quickview').addClass('thumbs_list_quickview');
				var o = r.find(".more-view-wrapper ul");
				for (i in n.images) {
					var u = Haravan.resizeImage(n.images[i], "large");
					var a = Haravan.resizeImage(n.images[i], "large");
					var f = '<li class="swiper-slide"><a href="javascript:void(0)" data-imageid="' + n.id + '"" data-zoom-image="' + u + '"  ><img src="' + u + '" alt="Ảnh sản phẩm" /></a></li>';
					o.append(f)
				}
				o.find("a").click(function() {
					var t = r.find("#product-featured-image-quickview");
					if (t.attr("src") != $(this).attr("data-image")) {
						t.attr("src", $(this).attr("data-image"));
						loadingImgQuickView.show();
						t.load(function(t) {
							loadingImgQuickView.hide();
							$(this).unbind("load");
							loadingImgQuickView.hide()
						})
					}
				});
				var swiper = new Swiper('#thumbs_list_quickview', {
					slidesPerView: 4,
					spaceBetween: 8,
					slidesPerGroup: 2,
					pagination: {
						el: '#thumbs_list_quickview .swiper-pagination',
						clickable: true,
					},
					navigation: {
						nextEl: '#thumbs_list_quickview .swiper-button-next',
						prevEl: '#thumbs_list_quickview .swiper-button-prev',
					},
					breakpoints: {
						300: {
							slidesPerView: 'auto',
							spaceBetween: 5
						},
						640: {
							slidesPerView: 3,
							spaceBetween: 5
						},
						768: {
							slidesPerView: 2,
							spaceBetween: 8
						},
						1024: {
							slidesPerView: 3,
							spaceBetween: 8
						},
						1200: {
							slidesPerView: 4,
							spaceBetween: 8
						}
					}
				});
				$('.more-view-wrapper').removeClass('d-none');
			} else {  
				$('.more-view-wrapper').addClass('d-none');
			}
		}
		function quickViewVariantsSwatch(t, quickview) {
    quickview.find("form.variants").find('input[name="id"], select[name="id"]').remove();

    if (t.variants.length > 1) {
        var selectHtml = '<select name="id" id="product-select-' + t.id + '"></select>';
        quickview.find("form.variants").append(selectHtml);
        for (var r = 0; r < t.variants.length; r++) {
            var i = t.variants[r];
            var s = '<option value="' + i.id + '">' + i.title + "</option>";
            quickview.find("form.variants > select").append(s)
        }
        var ps = "product-select-" + t.id;
        new Haravan.OptionSelectors(ps, {
            product: t,
            onVariantSelected: selectCallbackQuickView
        });
        if (t.options.length == 1) {
            quickview.find(".selector-wrapper:eq(0)").prepend("<label>" + t.options[0].name + "</label>")
        }

        var options = "";
        for (var i = 0; i < t.options.length; i++) {
            options += '<div class="swatch mb-3" data-option-index="' + i + '">';
            options += '<div class="header fw-semibold">' + t.options[i].name + ': </div><div class="swatch-list-element d-flex flex-row flex-wrap gap-2">';
            var is_color = false;
            if (/Color|Colour|Màu/i.test(t.options[i].name)) {
                is_color = true;
            }
            var optionValues = new Array();
            for (var j = 0; j < t.variants.length; j++) {
                var variant = t.variants[j];
                var value = variant.options[i];
                var valueHandle = (typeof wolf_convertVietnamese === 'function') ? wolf_convertVietnamese(value) : value;
                var forText = 'wolf-swatch-' + i + '-' + valueHandle;
                if (optionValues.indexOf(value) < 0) {
                    if (variant.featured_image != null) {
                        options += '<div title="' + value + '" data-image="' + variant.featured_image.src + '" data-value="' + value + '" class="swatch-element position-relative ' + (is_color ? "color " : " ") + valueHandle + (variant.available ? ' available ' : ' soldout ') + '">';
                    } else {
                        options += '<div title="' + value + '"  data-value="' + value + '" class="swatch-element position-relative ' + (is_color ? "color " : " ") + valueHandle + (variant.available ? ' available ' : ' soldout ') + '">';
                    }
                    options += '<input id="' + forText + '" type="radio" name="option-' + i + '" value="' + value + '" ' + (j == 0 ? ' checked ' : '') + ' />';
                    if (is_color) {
                        if (variant.featured_image) {
                            options += '<label for="' + forText + '" class="' + valueHandle + ' has-imgs"></label>';
                        } else {
                            options += '<label for="' + forText + '" class="' + valueHandle + '"></label>';
                        }
                    } else {
                        options += '<label for="' + forText + '">' + value + '</label>';
                    }
                    options += '</div>';
                    optionValues.push(value);
                }
            }
            options += '</div></div>';
        }
        quickview.find('form.variants > select').after(options);
        quickview.find('.swatch :radio').change(function() {
            var optionIndex = $(this).closest('.swatch').attr('data-option-index');
            var optionValue = $(this).val();
            $(this)
                .closest('form')
                .find('.single-option-selector')
                .eq(optionIndex)
                .val(optionValue)
                .trigger('change');
        });
        
        quickview.find("form.variants .selector-wrapper label").each(function(n, r) {
            $(this).html(t.options[n].name)
        });

    } else {
        quickview.find("form.variants > select").remove();
        var q = '<input type="hidden" name="id" value="' + t.variants[0].id + '">';
        quickview.find("form.variants").append(q);
    }
}
		function productImage() {
			var swiper = new Swiper('.thumbs_list_quickview', {
				slidesPerView: 3,
				spaceBetween: 43,
				slidesPerGroup: 2,
				pagination: {
					el: '.thumbs_list_quickview .swiper-pagination',
					clickable: true,
				},
				breakpoints: {
					300: {
						slidesPerView: 'auto',
						spaceBetween: 15
					},
					640: {
						slidesPerView: 3,
						spaceBetween: 15
					},
					768: {
						slidesPerView: 2,
						spaceBetween: 30
					},
					1024: {
						slidesPerView: 3,
						spaceBetween: 30
					},
					1200: {
						slidesPerView: 3,
						spaceBetween: 43
					}
				}
			});
			if (!!$.prototype.fancybox){
				$('li:visible .fancybox, .fancybox.shown').fancybox({
					'hideOnContentClick': true,
					'openEffect'	: 'elastic',
					'closeEffect'	: 'elastic'
				});
			}
		}
		/* Quick View ADD TO CART */
		function updatePricingQuickView() {
			//Currency.convertAll(window.shop_currency, $("#currencies a.selected").data("currency"), "span.money", "money_format")
		}
		function validate(evt) {
			var theEvent = evt || window.event;
			var key = theEvent.keyCode || theEvent.which;
			key = String.fromCharCode( key );
			var regex = /[0-9]|\./;
			if( !regex.test(key) ) {
				theEvent.returnValue = false;
				if(theEvent.preventDefault) theEvent.preventDefault();
			}
		}
		/*$(document).on('click', '.quickview-close, #quick-view-product .quickview-overlay, .fancybox-overlay', function(e){
			e.preventDefault();
			$('#quick-view-product').modal('hide');
		});*/
		function runQuickView() {
			var modal = $('#quick-view-product');
			var btn = $('.quick-view');
			btn.click(function () {
				modal.modal('show');
			});
		};
		runQuickView();