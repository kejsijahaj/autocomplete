const searchInput = document.querySelector("#search");
const searchBar = document.querySelector(".search-bar");
const fruitContainer = document.querySelector(".fruits");
const filterContainer = document.querySelector(".filters");
const chipContainer = document.querySelector("#chipContainer");
const operatorContainer = document.querySelector(".operator-buttons");

let fruitCache = []; // keep data after first fetch
let activeFilters = [];
let pendingKey = ""; // stores key for draft chip
let pendingChip = null;
let logicalOperator = "AND"; // AND by default

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

// debounce event

function debounce(myFunction, delay = 300) {
  let time;
  return (...args) => {
    // collects any arguments
    clearTimeout(time);
    time = setTimeout(() => myFunction.apply(this, args), delay);
  };
}

// --------- rendering ----------

// display the fruit cards

const renderList = (fruits) => {
  fruitContainer.innerHTML = "";
  if (fruits.length === 0) {
    fruitContainer.innerHTML =
      "<li class='card no-results'>No fruits found matching your criteria.</li>";
    return;
  }

  fruits.forEach((fruit) => {
    const li = document.createElement("li");
    li.className = "card";
    const label = document.createElement("h4");
    label.textContent = fruit.name;
    li.appendChild(label);

    li.innerHTML += Object.entries(fruit)
      .filter(([key]) => key !== "name")
      .map(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          return `${key}: ${Object.entries(value)
            .map(([k, v]) => `${k.substring(0, 3)}:${v}`)
            .join(", ")}`;
        }
        return `${key}: ${value}`;
      })
      .join("<br>");

    fruitContainer.appendChild(li);
  });
};

// display the filter dropdown

const renderFilters = (fruits) => {
  filterContainer.innerHTML = "";

  const keys = Object.keys(fruits[0] || {});

  keys.forEach((key) => {
    const li = document.createElement("li");
    li.textContent = key;
    li.className = "filter";
    filterContainer.appendChild(li);
  });

  filterContainer.style.display = "flex";
};

// ----------- chip handling -------------

// draft chips (half chips)

const handleKeyClick = (key) => {
  if (pendingChip) {
    pendingChip.remove();
    pendingChip = null;
    pendingKey = "";
  }

  pendingKey = key;

  pendingChip = document.createElement("div");
  pendingChip.className = "chip draft";
  pendingChip.textContent = key + ": ";
  chipContainer.appendChild(pendingChip);

  searchInput.value = "";
  searchInput.focus();
};

// complete chip

const completeChip = (e) => {
  if (e.key === "Backspace" && searchInput.value === "" && pendingChip) {
    e.preventDefault();
    pendingChip.remove();
    pendingChip = null;
    pendingKey = "";
    filterSuggestions();
    renderFilters(fruitCache);
    return;
  }

  if (
    e.key === "Backspace" &&
    searchInput.value === "" &&
    !pendingChip &&
    activeFilters.length > 0
  ) {
    e.preventDefault();

    activeFilters.pop();

    const chipElements = chipContainer.querySelectorAll(".chip:not(.draft)");
    if (chipElements.length > 0) {
      chipElements[chipElements.length - 1].remove();
    }

    filterSuggestions();
    renderFilters(fruitCache);
    return;
  }

  if (pendingChip) {
    const triggers = ["Enter", "Tab", " ", ","];
    if (!triggers.includes(e.key)) return;
    e.preventDefault();

    const value = searchInput.value.trim();
    if (!value) {
      pendingChip.remove();
      pendingChip = null;
      pendingKey = "";
      filterSuggestions();
      return;
    }

    pendingChip.classList.remove("draft");
    pendingChip.textContent = `${pendingKey}: ${value}`;

    const close = document.createElement("button");
    close.className = "chip-close";
    close.textContent = "x";

    const k = pendingKey;
    const v = value;
    const currentChipEl = pendingChip;
    close.addEventListener("click", () => {
      currentChipEl.remove();
      const i = activeFilters.findIndex((f) => f.key === k && f.value === v);
      if (i > -1) {
        activeFilters.splice(i, 1);
      }
      filterSuggestions();
      renderFilters(fruitCache);
      searchInput.focus();
    });

    pendingChip.appendChild(close);
    activeFilters.push({ key: pendingKey, value });
    pendingKey = "";
    pendingChip = null;
    searchInput.value = "";
    filterSuggestions();
    renderFilters(fruitCache);
    return;
  }

  if (!pendingChip && e.key === "Enter") {
    if (fruitCache.length === 0) return;

    const potentialKey = searchInput.value.trim().toLowerCase();
    const validKeys = Object.keys(fruitCache[0]);

    if (validKeys.includes(potentialKey)) {
      e.preventDefault();
      handleKeyClick(potentialKey);
    }
  }
};

// --------- filter & events --------

// filter the data

async function filterSuggestions() {
  const all = await getFruits();
  let result = all;

  const fruitMatchesFilter = (fruit, filter) => {
    const { key, value } = filter;
    const searchValue = value.toLowerCase();

    if (fruit[key] === undefined || fruit[key] === null) return false;
    if (typeof fruit[key] === "object") {
      return Object.values(fruit[key]).some((nestedVal) =>
        String(nestedVal).toLowerCase().includes(searchValue)
      );
    }
    return String(fruit[key]).toLowerCase().includes(searchValue);
  };

  if (activeFilters.length > 0) {
    if (logicalOperator === "AND") {
      // AND filters sequentially
      activeFilters.forEach((filter) => {
        result = result.filter((fruit) => fruitMatchesFilter(fruit, filter));
      });
    } else {
      // OR filters from the original 'all' list
      result = all.filter((fruit) => {
        return activeFilters.some((filter) =>
          fruitMatchesFilter(fruit, filter)
        );
      });
    }
  }

  const currentInput = searchInput.value.trim().toLowerCase();
  if (currentInput && !pendingKey) {
    result = result.filter((fruit) =>
      Object.values(fruit).some((val) => {
        if (val === undefined || val === null) return false;
        if (typeof val === "object") {
          return Object.values(val).some((nestedVal) =>
            String(nestedVal).toLowerCase().includes(currentInput)
          );
        }
        return String(val).toLowerCase().includes(currentInput);
      })
    );
  }

  renderList(result);
}
// -------- event listeners ---------

// suggestion blocks show once page is loaded

document.addEventListener("DOMContentLoaded", async () => {
  const list = await getFruits();
  renderList(list);
});

// when user starts typing, the suggestion blocks are filtered

searchInput.addEventListener(
  "keyup",
  debounce(() => {
    filterSuggestions();
  }, 300)
);

// filters are displayed when you click the input tag
searchInput.addEventListener("focus", async () => {
  const fruits = await getFruits();
  renderFilters(fruits);
});

// clear dropdown when out of focus

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrapper")) {
    filterContainer.style.display = "none";
  }
});

// draft chip wiring

filterContainer.addEventListener("click", (e) => {
  if (e.target.matches(".filter")) {
    handleKeyClick(e.target.textContent);
    renderFilters(fruitCache);
  }
});

// logical operator buttons

operatorContainer.addEventListener("click", (e) => {
  if (e.target.matches(".op-btn")) {
    logicalOperator = e.target.dataset.op;

    operatorContainer.querySelector(".active").classList.remove("active");
    e.target.classList.add("active");

    filterSuggestions();
  }
});

searchInput.addEventListener("keydown", completeChip);
