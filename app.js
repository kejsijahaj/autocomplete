const searchInput = document.querySelector("#search");
const searchBar = document.querySelector(".search-bar");
const fruitContainer = document.querySelector(".fruits");

let fruitCache = []; // keep data after first fetch

// get fruits from API

async function getFruits() {
  if (fruitCache.length) return fruitCache; // already have it
  const response = await fetch(
    "https://corsproxy.io/?https://www.fruityvice.com/api/fruit/all"
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  fruitCache = await response.json();
  renderList(fruitCache);
  return fruitCache;
}

// display the data

const renderList = (list) => {
  fruitContainer.innerHTML = "";

  list.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item.name;
    li.className = "card";
    fruitContainer.appendChild(li);
  });
};

// filter the data

async function filterSuggestions() {
  const all = await getFruits();
  const searchValue = searchInput.value.trim().toLowerCase();
  const list = searchValue
    ? all.filter((item) => item.name.toLowerCase().includes(searchValue))
    : all;

  renderList(list);
}

// debounce event

function debounce(myFunction, delay = 300) {
  let time;
  return (...args) => {
    // collects any arguments
    clearTimeout(time);
    time = setTimeout(() => myFunction.apply(this, args), delay);
  };
}

document.addEventListener("DOMContentLoaded", filterSuggestions);
searchInput.addEventListener("keyup", debounce(filterSuggestions, 300));
