const API_URL = "https://jsonplaceholder.typicode.com/users";

const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusText = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

let users = [];

function renderUsers(list) {
  usersList.replaceChildren();

  if (list.length === 0) {
    statusText.textContent = "No users match your filter.";
    return;
  }

  list.forEach((user) => {
    const li = document.createElement("li");

    const name = document.createElement("h2");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.textContent = `Email: ${user.email}`;

    const city = document.createElement("p");
    city.textContent = `City: ${user.address.city}`;

    const company = document.createElement("p");
    company.textContent = `Company: ${user.company.name}`;

    li.appendChild(name);
    li.appendChild(email);
    li.appendChild(city);
    li.appendChild(company);

    usersList.appendChild(li);
  });
}

async function loadUsers() {
  statusText.textContent = "Loading users...";
  loadButton.disabled = true;

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    users = await response.json();

    renderUsers(users);

    statusText.textContent = `Loaded ${users.length} users.`;
  } catch (error) {
    statusText.textContent =
      "Could not load users. Please try again.";

    console.error(error);
  } finally {
    loadButton.disabled = false;
  }
}

loadButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  const searchTerm = filterInput.value.trim().toLowerCase();

  const filteredUsers = users.filter((user) => {
    return user.name.toLowerCase().includes(searchTerm);
  });

  renderUsers(filteredUsers);

  if (filteredUsers.length > 0) {
    statusText.textContent = `Showing ${filteredUsers.length} users.`;
  }
});