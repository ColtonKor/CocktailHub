console.log("I reached here");
let cocktail = document.querySelector("#drink").value;
console.log(cocktail);
let ingredientsList = '';
for (let i = 1; i <= 15; i++) {
    let ingredient = cocktail[`strIngredient${i}`];
    let measure = cocktail[`strMeasure${i}`];
    if (ingredient) {
        ingredientsList += `<li>${measure || ''} ${ingredient}</li>`;
    }
}
console.log(ingredientsList);
document.querySelector("#Ingredients").innerText = ingredientsList;