var formRecoverPassword = $("#recover_password"),
  formLogin = $("#customer_login"),
  notiRecoverSuccess = $("#note-reset");
function toggleRecoverPasswordForm() {
  formRecoverPassword.toggleClass("d-none");
  formLogin.toggleClass("d-none");
}
if (window.location.hash == "#recover") { toggleRecoverPasswordForm() }
