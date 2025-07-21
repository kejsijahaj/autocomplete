const searchInput = document.querySelector("#search");
const searchBar = document.querySelector(".search-bar");
const fruitContainer = document.querySelector(".fruits");
const filterContainer = document.querySelector(".filters");
const chipContainer = document.querySelector("#chipContainer");
const operatorContainer = document.querySelector(".operator-buttons");

let fruitCache = []; // keep data after first fetch
let activeFilters = [{ filters: [], operator: null }];
let pendingKey = ""; // stores key for draft chip
let pendingChip = null;

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
    const div = document.createElement("div");
    div.className = "card";
    const label = document.createElement("h4");
    label.textContent = fruit.name;
    div.appendChild(label);

    div.innerHTML += Object.entries(fruit)
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

    fruitContainer.appendChild(div);
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

const createPendingChip = (key) => {
  if (pendingChip) pendingChip.remove();
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
  const value = searchInput.value.trim();

  if (
    e.key === "Backspace" &&
    value === "" &&
    !pendingChip &&
    activeFilters[0].filters.length > 0
  ) {
    e.preventDefault();
    const lastGroupIndex = activeFilters.length - 1;
    const lastGroup = activeFilters[lastGroupIndex];

    lastGroup.filters.pop();

    if (lastGroup.filters.length === 0 && activeFilters.length > 1) {
      activeFilters.pop();
      activeFilters[activeFilters.length - 1].operator = null;
    }

    filterSuggestions();
    return;
  }

  if (e.key === "Backspace" && value === "" && pendingChip) {
    e.preventDefault();
    pendingChip.remove();
    pendingChip = null;
    pendingKey = "";
    filterSuggestions();
    return;
  }

  if (e.key === "Enter" && value.includes(":") && !pendingChip) {
    e.preventDefault();
    const [key, ...valParts] = value.split(":");
    const val = valParts.join(":").trim();
    const validKeys = Object.keys(fruitCache[0] || {});

    if (key && val && validKeys.includes(key.trim().toLowerCase())) {
      const currentGroup = activeFilters[activeFilters.length - 1];
      currentGroup.filters.push({ key: key.trim(), value: val });
      searchInput.value = "";
      filterSuggestions();
    }
    return;
  }

  if ((value === "&" || value === "|") && !pendingChip) {
    e.preventDefault();
    const operator = value === "&" ? "AND" : "OR";
    const lastGroup = activeFilters[activeFilters.length - 1];

    if (lastGroup.filters.length > 0) {
      lastGroup.operator = operator;
      activeFilters.push({ filters: [], operator: null }); 
      searchInput.value = "";
      filterSuggestions();
    }
    return;
  }

  const triggers = ["Enter", "Tab"];
  if (pendingChip && triggers.includes(e.key)) {
    e.preventDefault();
    if (value) {
      const currentGroup = activeFilters[activeFilters.length - 1];
      currentGroup.filters.push({ key: pendingKey, value });
      pendingChip = null;
      pendingKey = "";
      searchInput.value = "";
      filterSuggestions();
    }
    return;
  }

  if (e.key === "Enter" && !pendingChip) {
    const potentialKey = value.toLowerCase();
    const validKeys = Object.keys(fruitCache[0] || {});
    if (validKeys.includes(potentialKey)) {
      e.preventDefault();
      createPendingChip(potentialKey);
    }
    return;
  }
};

const renderChips = () => {
  chipContainer.innerHTML = "";

  activeFilters.forEach((group, groupIndex) => {
    group.filters.forEach((filter, filterIndex) => {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.textContent = `${filter.key}: ${filter.value}`;

      const close = document.createElement("button");
      close.className = "chip-close";
      close.textContent = "x";
      close.addEventListener("click", () => {
        activeFilters[groupIndex].filters.splice(filterIndex, 1);

        if (
          activeFilters[groupIndex].filters.length === 0 &&
          activeFilters.length > 1
        ) {
          activeFilters.splice(groupIndex, 1);
          if (groupIndex > 0) {
            activeFilters[groupIndex - 1].operator = null;
          }
        }

        filterSuggestions();
        searchInput.focus();
      });

      chip.appendChild(close);
      chipContainer.appendChild(chip);
    });

    // Render the operator after the group, if it exists
    if (group.operator) {
      const operatorChip = document.createElement("div");
      operatorChip.className = "chip operator";
      operatorChip.textContent = group.operator;
      chipContainer.appendChild(operatorChip);
    }
  });

  // Re-add the pending chip if it exists
  if (pendingChip) {
    chipContainer.appendChild(pendingChip);
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

  if (activeFilters.some((group) => group.filters.length > 0)) {
    result = all.filter((fruit) => {
      for (let i = 0; i < activeFilters.length; i++) {
        const group = activeFilters[i];
        if (group.filters.length === 0) continue;

        const matchesThisGroup = group.filters.every((filter) =>
          fruitMatchesFilter(fruit, filter)
        );

        // --- Logic to combine groups ---
        const nextOperator = group.operator;

        if (matchesThisGroup && nextOperator === "OR") {
          return true;
        }
        if (!matchesThisGroup && nextOperator === "AND") {
          return false;
        }
        if (
          matchesThisGroup &&
          (nextOperator === "AND" || nextOperator === null)
        ) {
          if (i === activeFilters.length - 1) return true;
        }
        if (
          !matchesThisGroup &&
          (nextOperator === "OR" || nextOperator === null)
        ) {
          if (i === activeFilters.length - 1) return false;
        }
      }
      return false;
    });
  } else {
    result = all;
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
  renderChips();
}
// -------- event listeners ---------

// suggestion blocks show once page is loaded

document.addEventListener("DOMContentLoaded", async () => {
  const list = await getFruits();
  renderList(list);
  renderChips();
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
    createPendingChip(e.target.textContent);;
  }
});

searchInput.addEventListener("keydown", completeChip);
