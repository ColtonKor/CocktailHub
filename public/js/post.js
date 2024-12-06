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

let togglePause = document.querySelectorAll(".toggle");
for(let i of togglePause){
  i.addEventListener("click", openComments);
}

let commentVis = document.querySelectorAll(".comments-section");
for(let i of commentVis){
  i.style.display = 'none';
}

function openComments(){
  let post = event.target.closest('.post');
  let commentsSection = post.querySelector('.comments-section');
  let toggleButton = event.target;
  if (commentsSection.style.display === 'none' || commentsSection.style.display === '') {
    commentsSection.style.display = 'block';
    toggleButton.textContent = 'Close Comments';
  } else {
    commentsSection.style.display = 'none';
    toggleButton.textContent = 'Open Comments';
  }
}

async function searchCocktail(event) {
  event.preventDefault();
  const cocktailName = document.getElementById('search').value;
  if (!cocktailName) return;

  try {
      const response = await fetch(`/cocktail/${encodeURIComponent(cocktailName)}`);
      const cocktail = await response.json();
  } catch (error) {
      console.error('Error:', error);
      alert('Failed to fetch cocktail details');
  }
}