document.querySelector("#signupForm").addEventListener("submit", checkInput);
document.querySelector("#password").addEventListener("focus", suggestPassword);
document.querySelector("#copySuggested").addEventListener("click", fillPasswords);

function checkInput(event) {
    let isValid = true;
    if (document.querySelector("#password").value != document.querySelector("#confirmPassword").value) {
        document.querySelector("#errorMsg").innerText = "Passwords must match";
        document.querySelector("#errorMsg").style.color = "red";
        document.querySelector("#errorMsg").style.fontWeight = "bold";
        isValid = false;
    } else {
        document.querySelector("#errorMsg").innerText = "";
    }
    if (!isValid) {
        event.preventDefault();
    }
}

async function suggestPassword() {
    let url = `https://csumb.space/api/suggestedPassword.php?length=12`;
    let response = await fetch(url);
    let data = await response.json();

    document.querySelector("#suggest").innerText = `Suggested Password: ${data.password}`;
    document.querySelector("#suggest").value = `${data.password}`;

    document.querySelector("#copySuggested").style.display = "inline";
}

function fillPasswords(event) {
    event.preventDefault();

    let password = document.querySelector("#suggest").value;
    document.querySelector("#password").value = password;
    document.querySelector("#confirmPassword").value = password;
    console.log(document.querySelector("#confirmPassword").value);
}