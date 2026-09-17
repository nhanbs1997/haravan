function initRecapchaScript(){
	!function(e,t,n){var a=t.getElementsByTagName(n)[0],c=t.createElement(n);c.async=true,c.src="https://www.google.com/recaptcha/api.js?render=6LdD18MUAAAAAHqKl3Avv8W-tREL6LangePxQLM-",a.parentNode.insertBefore(c,a)}(window,document,"script");  
}
function getScript(scriptUrl, callback) {
  var script = document.createElement('script');
    var prior = document.getElementsByTagName('script')[0];
    script.async = 1;

    script.onload = script.onreadystatechange = function( _, isAbort ) {
        if(isAbort || !script.readyState || /loaded|complete/.test(script.readyState) ) {
            script.onload = script.onreadystatechange = null;
            script = undefined;

            if(!isAbort && callback) setTimeout(callback, 0);
        }
    };

    script.src = scriptUrl;
    prior.parentNode.insertBefore(script, prior);
}
 function loadCSS(url) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      document.head.appendChild(link);
    }
 
let loaded;
function loadDefer(){
	if(loaded) return;
	loaded = true;
	loadCSS(window.themeConfigs.vendorsCssLink)
	getScript(window.themeConfigs.vendorsJSLink, (e)=>{
		//
		 publish(window.themeConfigs.firstInteraction, e)

	})


}


document.addEventListener("DOMContentLoaded", (event) => {
     let events = ['mousemove', 'touchstart', 'scroll']
		events.forEach((event)=>{
			window.addEventListener(event, () => {
				   loadDefer()
			  }, { once: true })
		})
		if(window.pageYOffset >= window.innerHeight){
			loadDefer()
		}

  });
 
function mailChimpResponse(form,resp) {
	let alert = 	form.next()
	if (resp.result === 'success') {
		if(resp.msg == 'Thank you for subscribing!'){
			alert.find('.mailchimp-success').html('Cảm ơn bạn đã đăng ký!').fadeIn(900);
		}else{
			alert.find('.mailchimp-success').html('' + resp.msg).fadeIn(900);
		}
		$('.mailchimp-error').fadeOut(100);
	} else if (resp.result === 'error') {
		if(resp.msg == '0 - Please enter a value'){
			alert.find('.mailchimp-error').html('Vui lòng nhập các trường thông tin').fadeIn(900);
		}else if(resp.msg == '0 - An email address must contain a single @'){
			alert.find('.mailchimp-error').html('Địa chỉ email phải chứa ký tự @').fadeIn(900);
		}else if(resp.msg == 'This email cannot be added to this list. Please enter a different email address.'){
			alert.find('.mailchimp-error').html('Email này không thể được thêm vào danh sách này. Vui lòng nhập một địa chỉ email khác.').fadeIn(900);
		}else if(resp.msg.includes('0 - The domain portion of the email address is invalid')){
			alert.find('.mailchimp-error').html('Phần tên miền của địa chỉ email không hợp lệ').fadeIn(900);
		}else if(resp.msg.includes('0 - The username portion of the email address is empty')){
			alert.find('.mailchimp-error').html('Phần tên người dùng của địa chỉ email trống').fadeIn(900);
		}else if(resp.msg.includes('0 - The username portion of the email address is invalid')){
			alert.find('.mailchimp-error').html('Phần tên người dùng của địa chỉ email không hợp lệ').fadeIn(900);
		}else if(resp.msg == 'Thank you for subscribing!'){
			alert.find('.mailchimp-error').html('Cảm ơn bạn đã đăng ký!').fadeIn(900);
		}else{
			alert.find('.mailchimp-error').html('' + resp.msg).fadeIn(900);
		}
	}
}
function horizontalNav () {
	return {
		wrapper: $('.navigation--horizontal .navigation-horizontal-wrapper'),
		navigation: $('.navigation--horizontal .navigation-horizontal'),
		item: $('.navigation--horizontal .navigation-horizontal .menu-item '),
		arrows: $('.navigation-arrows'),
		scrollStep: 0,
		totalStep: 0,
		transform: function(){
			return `translateY(-${this.scrollStep*100}%)` 
		},
		onCalcNavOverView: function(){
			let itemHeight = this.item.eq(0).outerHeight(),
				navHeight = this.navigation.height()
			return Math.ceil(navHeight/itemHeight)
		},
		handleArrowClick: function(e){
			this.totalStep = this.onCalcNavOverView()
			this.scrollStep = $(e.currentTarget).hasClass('prev') ? this.scrollStep - 1 : this.scrollStep + 1
			this.handleScroll()
		},
		handleScroll: function(){
			this.arrows.find('button').removeAttr('disabled')
			if(this.totalStep - 1 <= this.scrollStep ){
				this.arrows.find('.next').attr('disabled',true)
				this.scrollStep = this.totalStep - 1
			}
			if(this.scrollStep <= 0){
				this.arrows.find('.prev').attr('disabled',true)
				this.scrollStep = 0
			}
			this.item.find('.menu-item__link').css('transform', this.transform())
		},
		init:function(){
			this.totalStep = this.onCalcNavOverView()
			if(this.totalStep > 1){
				this.wrapper.addClass('overflow')
			} 
			this.handleScroll()
			this.arrows.find('button').click((e)=>this.handleArrowClick(e))
		}
	}	
}
function initStickyHeader(){
		const stickyHeader = $('.header')
		const isInputFocus = $('.header input:focus').length > 0
		let height =   isInputFocus ?  350 : 150 ;
	  
		let sticky = window.innerHeight / 2 > height ? height : window.innerHeight / 2  ;
		
	if (window.pageYOffset > sticky) {
			stickyHeader.addClass("active");
		} else {
			stickyHeader.removeClass("active")
		}
	}
function lazyloadSrc(){
	const elements = document.querySelectorAll('[data-lazyload]');
	const observer = new IntersectionObserver((entries) => {
	  entries.forEach(entry => {
		if (entry.isIntersecting) {
		  const element = entry.target;
		  element.src = element.dataset.src;
		  observer.unobserve(element);
		}
	  });
	}, { root: null, threshold: 0.5 });

	elements.forEach(element => observer.observe(element));


}
initStickyHeader()
if(window.matchMedia('(min-width: 992px)').matches){
		horizontalNav().init()
	}
subscribe(window.themeConfigs.firstInteraction, (e)=>{
	 
	 function awe_backtotop() { 
		if ($('.back-to-top').length) {
			var scrollTrigger = 100, // px
				backToTop = function () {
					var scrollTop = $(window).scrollTop();
					if (scrollTop > scrollTrigger) {
						$('.back-to-top').addClass('show');
					} else {
						$('.back-to-top').removeClass('show');
					}

					if (scrollTop > ($(document).height() - 700) ) {
						$('.back-to-top').addClass('end');
					} else {
						$('.back-to-top').removeClass('end');
					}
				};
			backToTop();
			$(window).on('scroll', function () {
				backToTop();
			});
			$('.back-to-top').on('click', function (e) {
				e.preventDefault();
				$('html,body').animate({
					scrollTop: 0
				}, 700);
			});
		}
	} window.awe_backtotop=awe_backtotop;
	awe_backtotop();
	
	function initNavigation(){

	$(window).scroll(initStickyHeader)
	
		

}
	 
	initNavigation()
	 document.querySelectorAll('[data-lazyload]').forEach(el =>{
	 	if(el.dataset.src){
			el.src = el.dataset.src;
			el.removeAttribute('data-lazyload')
		}
	 
	 } )
  	initRecapchaScript()
  if($('.email-subscribe').length > 0){
      $('.email-subscribe form').submit(function(e) { 
          e.preventDefault();
          alert('Cám ơn bạn đã đăng ký email theo dõi!')
          var self = $(this);
          if($(this)[0].checkValidity() == true){
              grecaptcha.ready(function() {
                  grecaptcha.execute('6LdD18MUAAAAAHqKl3Avv8W-tREL6LangePxQLM-', {action: 'submit'}).then(function(token) {
                      self.find('input[name="g-recaptcha-response"]').val(token);
                      self.unbind('submit').submit();
                  }); 
              });
          }
      });
  }
	 initFooter()
})

function initFooter(){
	const media = window.themeConfigs.mbBreakpoint;
	
	const toggleDetails = (media)=>{
		console.log(media.matches)
		if(media.matches){
			$('.footer-details').removeAttr('open')
		}else{
		   $('.footer-details').add('open',true)

		}
	}
	toggleDetails(media)
	media.addEventListener("change", toggleDetails);
	
	
	$('.footer-details summary').click((e)=>{
		if(!media.matches){
			e.preventDefault()
		}
	})
	
}