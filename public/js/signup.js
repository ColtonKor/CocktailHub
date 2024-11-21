document.querySelector("#signupForm").addEventListener("submit", checkInput);

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