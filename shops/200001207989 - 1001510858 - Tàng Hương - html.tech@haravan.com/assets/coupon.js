class CouponItem extends HTMLElement{
	constructor(){
		super()
		this.expiredDate = this.querySelector("[data-expired-date]")
		if(this.expiredDate){
			let isExpired = this.checkExpired(this.expiredDate.dataset.expiredDate)
			let oneDay = 86400000 
			if(!isExpired && this.duration <= oneDay){
			let time = this.duration > 3600000 ? `${Math.floor(this.duration / 3600000)} giờ` : `${Math.round(this.duration / 60000)} phút`;
				this.expiredDate.innerHTML = `<span class="text-error">Hết hạn sau ${time}  </span>`
			}
			if(isExpired){
				let copyBtn = this.querySelector('.copy-button')
				copyBtn.innerHTML = 'Hết hạn'
				copyBtn.classList.add('coupon-expired')
				copyBtn.setAttribute('disabled', true)
			}
		}
		this.querySelector('[data-portal]').addEventListener('click',this.openQuickView.bind(this))
	}
	checkExpired(date){
		let time = convertTime(date) 
		let current = new Date().getTime()
		if( time > current){
			this.duration = time - current;
			return false;
		}else{
			return true
		}
			
		return false
	}
	openQuickView(e){
		let quickview = document.querySelector(e.target.dataset.portal)
		if(quickview){
			quickview.show(this)
		}
		
	}
}

defineElement("coupon-item", CouponItem);
subscribe(window.themeConfigs.firstInteraction,()=>{
class CouponDrawer extends  PortalComponent{
	constructor(){
		super()
	}
	show(opener){
		if(!this.querySelector('.coupon-item')){
			this.getCoupons()
		}
		super.show(opener)
	}
	getCoupons(){
		fetch('/?view=coupons')
			.then( response => response.text())
			.then(res => {
			  let html = new DOMParser().parseFromString(res, "text/html");
			  this.querySelector('.coupon-list').innerHTML = html.querySelector('.coupon-list').innerHTML
		
			})
	}
}	

defineElement("coupon-drawer", CouponDrawer)

class CouponModal extends PortalComponent {
	constructor(){
		super()
	}
	renderCoupon(coupon){
		if(coupon){
	 		let title = coupon.querySelector('.coupon-item__code').textContent;
			let subtitle = coupon.querySelector('.coupon-item__summary').textContent;
			let description = coupon.querySelector('.coupon-item__rules').innerHTML
			let code = coupon.querySelector('input').value
			let copy = coupon.querySelector('copy-button')
			this.querySelector('.coupon-header').innerHTML = `
				<div class="text-h5 text-secondary text-center font-semibold">${title}</div>
				<div class="text-neutral-200 mt-1 ">${subtitle}</div>
			`
			this.querySelector('.coupon-desc').innerHTML = `<div class="${description ? 'py-3' :'' }">${description}</div>` 
			this.querySelector('copy-button input').value = copy.querySelector('input').value
		}
	}
	show(opener){
		this.renderCoupon(opener)
		super.show(opener)
	}
	
}

defineElement("coupon-modal", CouponModal)
})