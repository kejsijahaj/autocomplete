const searchInput = document.querySelector("#search");
const fruitContainer = document.querySelector(".fruit-container");
const filterContainer = document.querySelector(".filter-container");
const chipContainer = document.querySelector("#chipContainer");

let fruitCache = []; // keep data after first fetch
let filterTokens = [];
let pendingKey = ""; // stores key for draft chip
let pendingChip = null;
let pendingMethod = "includes"; // to store comparison types

// get fruits from API
async function getFruits() {
  if (fruitCache.length) return fruitCache;
  try {
    const response = await fetch(
      "https://corsproxy.io/?https://www.fruityvice.com/api/fruit/all"
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    fruitCache = await response.json();
    return fruitCache;
  } catch (error) {
    console.error("Failed to fetch fruits:", error);
    fruitContainer.innerHTML =
      "<p>Could not load fruit data. Please try again later.</p>";
    return [];
  }
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
  const listElement = filterContainer.querySelector(".filters");
  listElement.innerHTML = "";

  if (!fruits || fruits.length === 0) {
    return;
  }

  const keys = Object.keys(fruits[0]);
  keys.forEach((key) => {
    const listItem = document.createElement("li");
    listItem.className = "filter";
    listItem.textContent = key;
    listElement.appendChild(listItem);
  });
};

// display chips
const renderChips = () => {
  chipContainer.innerHTML = "";

  filterTokens.forEach((token, index) => {
    const chip = document.createElement("div");
    chip.className = "chip";

    if (typeof token === "object" && token !== null) {
      let methodText = "";
      if(token.type === "startsWith") {
        methodText = "starts with: ";
      } else if (token.type === "endsWith") {
        methodText = "ends with: ";
      }

      chip.textContent = `${token.key}: ${methodText}${token.value}`;

      const close = document.createElement("button");
      close.className = "chip-close";
      close.textContent = "×";
      close.addEventListener("click", () => {
        filterTokens.splice(index, 1);
        filterSuggestions();
      });
      chip.appendChild(close);
    } else {
      chip.textContent = token;
      chip.classList.add("operator");
    }

    chipContainer.appendChild(chip);
  });

  if (pendingChip) {
    chipContainer.appendChild(pendingChip);
  }
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
    filterTokens.length > 0
  ) {
    e.preventDefault();
    filterTokens.pop();
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

  const commands = ["starts with:", "ends with:"];
  if (pendingChip && commands.includes(value.toLowerCase())) {
    e.preventDefault();

    pendingMethod = value.toLowerCase() === "starts with:" ? "startsWith" : "endsWith";
    pendingChip.textContent = `${pendingKey}: ${pendingMethod} `;
    searchInput.value = "";
    return;
  }

  if (e.key === "Enter" && value.includes(":") && !pendingChip) {
    e.preventDefault();
    const [key, ...valParts] = value.split(":");
    const val = valParts.join(":").trim();
    const validKeys = fruitCache.length ? Object.keys(fruitCache[0]) : [];

    if (key && val && validKeys.includes(key.trim().toLowerCase())) {
      filterTokens.push({ key: key.trim(), value: val });
      searchInput.value = "";
      filterSuggestions();
    }
    return;
  }

  if ((value === "(" || value === ")") && !pendingChip) {
    e.preventDefault();
    filterTokens.push(value);
    searchInput.value = "";
    filterSuggestions();
    return;
  }

  if ((value === "&" || value === "|") && !pendingChip) {
    e.preventDefault();
    const operator = value === "&" ? "AND" : "OR";
    filterTokens.push(operator);
    searchInput.value = "";
    filterSuggestions();
    return;
  }

  const triggers = ["Enter", "Tab"];
  if (pendingChip && triggers.includes(e.key)) {
    e.preventDefault();
    if (value) {
      filterTokens.push({ key: pendingKey, value: value, type: pendingMethod });
      pendingChip.remove();
      pendingChip = null;
      pendingKey = "";
      pendingMethod = "includes"; //reset for next chip
      searchInput.value = "";
      filterSuggestions();
    }
    return;
  }

  if (e.key === "Enter" && !pendingChip && value) {
    const potentialKey = value.toLowerCase();
    const validKeys = fruitCache.length ? Object.keys(fruitCache[0]) : [];
    if (validKeys.includes(potentialKey)) {
      e.preventDefault();
      createPendingChip(potentialKey);
    }
    return;
  }
};

// ------ filter helper functions ---------

const fruitMatchesFilter = (fruit, filter) => {
  const { key, value, type = "includes" } = filter;
  const searchValue = value.toLowerCase();
  const fruitValue = fruit[key];

  if (fruitValue === undefined || fruitValue === null) return false;
  if (typeof fruitValue === "object") {
    return Object.values(fruit[key]).some((nestedVal) =>
      String(nestedVal).toLowerCase().includes(searchValue)
    );
  }

  const fruitValueString = String(fruitValue).toLowerCase();

  //comparisons
  switch (type) {
    case "startsWith":
      return fruitValueString.startsWith(searchValue);
    case "endsWith":
      return fruitValueString.endsWith(searchValue);
    case "includes":
    default:
      return fruitValueString.includes(searchValue);
  }
};

const evaluate = (node, fruit) => {
  if (typeof node === "object" && node !== null && !Array.isArray(node)) {
    return fruitMatchesFilter(fruit, node);
  }

  if (Array.isArray(node)) {
    const [left, operator, right] = node;

    const leftResult = evaluate(left, fruit);
    const rightResult = evaluate(right, fruit);

    if (operator === "AND") {
      return leftResult && rightResult;
    }
    if (operator === "OR") {
      return leftResult || rightResult;
    }
  }
  return false;
};

const parse = (tokens) => {
  const precedence = { OR: 1, AND: 2 };
  const values = [];
  const ops = [];

  const applyOp = () => {
    const op = ops.pop();
    const right = values.pop();
    const left = values.pop();
    values.push([left, op, right]);
  };
  for (const token of tokens) {
    if (typeof token === "object") {
      values.push(token);
    } else if (token === "(") {
      ops.push(token);
    } else if (token === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") {
        applyOp();
      }
      ops.pop();
    } else {
      while (
        ops.length &&
        ops[ops.length - 1] !== "(" &&
        precedence[ops[ops.length - 1]] >= precedence[token]
      ) {
        applyOp();
      }
      ops.push(token);
    }
  }

  while (ops.length) {
    applyOp();
  }

  return values[0];
};

// --------- filter & events --------

async function filterSuggestions() {
  const all = await getFruits();
  let result;

  if (filterTokens.length > 0) {
    const logicTree = parse(filterTokens);
    if (logicTree) {
      result = all.filter((fruit) => evaluate(logicTree, fruit));
    } else {
      result = all;
    }
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

document.addEventListener("DOMContentLoaded", () => {
  filterSuggestions();
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
  console.log("Focus event fired! Attempting to show dropdown.");
  const fruits = await getFruits();
  console.log("Fruits data received:", fruits);
  renderFilters(fruits);
  filterContainer.style.display = "block";
});

// hide dropdown when out of focus
document.addEventListener("click", (e) => {
  if (e.target !== searchInput && !filterContainer.contains(e.target)) {
    console.log("Clicked outside, hiding dropdown.");
    filterContainer.style.display = "none";
  }

  if (e.target.matches(".filter")) {
    createPendingChip(e.target.textContent);
    filterContainer.style.display = "none";
  }
});

// draft chip wiring
filterContainer.addEventListener("click", (e) => {
  if (e.target.matches(".filter")) {
    createPendingChip(e.target.textContent);
  }
});

searchInput.addEventListener("keydown", completeChip);
