const io=new IntersectionObserver((e,t)=>{e.forEach(e=>{e.isIntersecting&&(e.target.src=e.target.dataset.src,e.target.classList.add("loaded"),t.unobserve(e.target))})}),bo=new IntersectionObserver((e,t)=>{e.forEach(e=>{if(e.isIntersecting){const r=e.target;r.style.backgroundImage=r.dataset.background,e.target.classList.add("loaded"),t.unobserve(e.target)}})});
document.addEventListener("DOMContentLoaded", function() {
	const arr = document.querySelectorAll('.lazy')
	arr.forEach((v) => {
		io.observe(v);
	})
	const arrBg = document.querySelectorAll('.lazy_bg')
	arrBg.forEach((v) => {
		bo.observe(v);
	})
})
