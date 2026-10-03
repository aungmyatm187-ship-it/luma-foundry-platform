const dialog = document.querySelector('#viewing-dialog');
const openers = document.querySelectorAll('[data-open-dialog]');
const closers = document.querySelectorAll('[data-close-dialog]');
const form = document.querySelector('#viewing-form');
const success = document.querySelector('#form-success');

openers.forEach((button) => button.addEventListener('click', () => dialog.showModal()));
closers.forEach((button) => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
form.addEventListener('submit', (event) => {
  event.preventDefault();
  form.hidden = true;
  success.hidden = false;
});
