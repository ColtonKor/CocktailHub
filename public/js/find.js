async function searchCocktail(event) {
    event.preventDefault();
    const cocktailName = document.getElementById('search').value;
    if (!cocktailName) return;

    try {
        const response = await fetch(`/cocktail/${encodeURIComponent(cocktailName)}`);
        const cocktail = await response.json();
        
        if (cocktail) {
            // Create HTML content for the modal
            let ingredientsList = '';
            for (let i = 1; i <= 15; i++) {
                const ingredient = cocktail[`strIngredient${i}`];
                const measure = cocktail[`strMeasure${i}`];
                if (ingredient) {
                    ingredientsList += `<li>${measure || ''} ${ingredient}</li>`;
                }
            }

            const modalContent = `
                <h2>${cocktail.strDrink}</h2>
                <img src="${cocktail.strDrinkThumb}" alt="${cocktail.strDrink}" style="max-width: 300px;">
                <h3>Instructions:</h3>
                <p>${cocktail.strInstructions}</p>
                <h3>Ingredients:</h3>
                <ul>${ingredientsList}</ul>
                <p><strong>Glass:</strong> ${cocktail.strGlass}</p>
            `;

            document.getElementById('cocktailDetails').innerHTML = modalContent;
            document.getElementById('cocktailModal').style.display = 'block';
        } else {
            alert('Cocktail not found');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to fetch cocktail details');
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('cocktailModal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}