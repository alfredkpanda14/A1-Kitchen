const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const loginButton = loginForm.querySelector('button[type="submit"]');

function setMessage(text) {
  loginMessage.textContent = text;
}

async function checkExistingSession() {
  const { data } = await supabaseClient.auth.getSession();

  if (data && data.session) {
    const { data: info } = await supabaseClient.rpc("my_staff_info");

    if (info) {
      window.location.href = "chef-dashboard.html";
    }
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if (email === "" || password === "") {
    setMessage("Please enter your email and password.");
    return;
  }

  loginButton.disabled = true;
  setMessage("Signing in...");

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      setMessage("The email or password is not correct.");
      loginButton.disabled = false;
      return;
    }

    const { data: info, error: infoError } =
      await supabaseClient.rpc("my_staff_info");

    if (infoError || !info) {
      await supabaseClient.auth.signOut();
      setMessage("This account does not have staff access.");
      loginButton.disabled = false;
      return;
    }

    window.location.href = "chef-dashboard.html";
  } catch (error) {
    console.error("Sign-in error:", error);
    setMessage("We could not sign you in. Please check your connection.");
    loginButton.disabled = false;
  }
});

checkExistingSession();
