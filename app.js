const searchInput = document.querySelector("#search");
const searchBar = document.querySelector(".search-bar");
const fruitContainer = document.querySelector(".fruits");
const filterContainer = document.querySelector(".filters");

let fruitCache = []; // keep data after first fetch

// get fruits from API

async function getFruits() {
  if (fruitCache.length) return fruitCache; // already have it
  const response = await fetch(
    "https://corsproxy.io/?https://www.fruityvice.com/api/fruit/all"
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  fruitCache = await response.json();
  return fruitCache;
}

// display the data

const renderList = (fruits) => {
  fruitContainer.innerHTML = "";

  fruits.forEach(fruit => {
    const li = document.createElement("li");
    li.className = "card";

    li.innerHTML = Object.entries(fruit).map(([key,value]) => `${key}: ${value}`).join("<br>");

    fruitContainer.appendChild(li);
  });
};

// display the filters

const renderFilters = (fruits) => {
  filterContainer.innerHTML = "";
  
  const keys = Object.keys(fruits[0] || {});

  keys.forEach((key) => {
    const li = document.createElement("li");
    li.textContent = key;
    li.className = "filter";
    filterContainer.appendChild(li);
  })
};

// filter the data

async function filterSuggestions() {
  const all = await getFruits();
  const searchValue = searchInput.value.trim().toLowerCase();
  const list = searchValue
    ? all.filter((item) => item.name.toLowerCase().includes(searchValue))
    : all;

  // renderList(list);
  return all;
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

// suggestion blocks show once page is loaded

document.addEventListener("DOMContentLoaded", async () => {
  const list = await getFruits();
  renderList(list);
});

// when user starts typing, the suggestion blocks are filtered

searchInput.addEventListener("keyup", debounce(filterSuggestions, 300));

// filters are displayed when you click the input tag
searchInput.addEventListener("focus", async () => {
  const fruits = await getFruits();
  renderFilters(fruits);
});

// clear dropdown when out of focus

searchInput.addEventListener('blur', () => {
  filterContainer.innerHTML = '';     
});

