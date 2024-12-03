document.querySelector('.btn-close').addEventListener('click', function () {
    var modalElement = document.getElementById('newPostModal');
    var modalInstance = bootstrap.Modal.getInstance(modalElement);
    modalInstance.hide();
});


document.querySelector('#newPost').addEventListener('click', openModal);


function openModal() {
  const myModal = new bootstrap.Modal('#newPostModal');
  myModal.show();
}
  