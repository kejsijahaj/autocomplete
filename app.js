const searchInput = document.querySelector("#search");
const pokemonContainer = document.querySelector(".pokemon-container");
const filterContainer = document.querySelector(".filter-container");
const chipContainer = document.querySelector("#chipContainer");
const searchButton = document.querySelector(".icon-button");

let pokemonCache = []; // keep data after first fetch
let filterTokens = [];
let pendingKey = ""; // stores key for draft chip
let pendingChip = null;
let pendingMethod = "includes"; // to store comparison types

// get pokemons from API
async function getPokemons() {
  if (pokemonCache.length) return pokemonCache;

  try {
    const listResponse = await fetch(
      "https://pokeapi.co/api/v2/pokemon?limit=15"
    );
    if (!listResponse.ok) throw new Error("Failed to fetch Pokémon list");
    const listData = await listResponse.json();

    const detailPromises = listData.results.map((pokemon) =>
      fetch(pokemon.url).then((res) => res.json())
    );

    const detailedPokemonList = await Promise.all(detailPromises);

    pokemonCache = detailedPokemonList;
    return pokemonCache;
  } catch (error) {
    console.error("Failed to fetch Pokémon data:", error);
    pokemonContainer.innerHTML =
      "<p>Could not load Pokémon data. Please try again later.</p>";
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

// display the pokemon cards
const renderList = (pokemonList) => {
  pokemonContainer.innerHTML = "";
  if (pokemonList.length === 0) {
    pokemonContainer.innerHTML =
      "<p class='no-results'>No Pokémon found matching your criteria.</p>";
    return;
  }

  pokemonList.forEach((pokemon) => {
    const card = document.createElement("div");
    card.className = "card";

    const holo = document.createElement("div");
    holo.className = "card-holo";
    card.appendChild(holo);

    const content = document.createElement("div");
    content.className = "card-content";

    const sprite = document.createElement("img");
    sprite.className = "card-sprite";
    sprite.src = pokemon.sprites.front_default;
    sprite.alt = pokemon.name;

    const label = document.createElement("h4");
    label.className = "card-label";
    label.textContent = pokemon.name;

    content.appendChild(sprite);
    content.appendChild(label);
    card.appendChild(content);

    pokemonContainer.appendChild(card);
  });

  // --------- hover effects -------------

  const allCards = pokemonContainer.querySelectorAll(".card");
  allCards.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      card.style.setProperty("--mx", x / rect.width);
      card.style.setProperty("--my", y / rect.height);

      const rotateX = (y / rect.height - 0.5) * -20; 
      const rotateY = (x / rect.width - 0.5) * 20; 
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.setProperty("--mx", 0);
      card.style.setProperty("--my", 0);
      card.style.transform = "perspective(1000px) rotateX(0) rotateY(0)";
    });
  });
};

// display the filter dropdown
const renderFilters = () => {
  const listElement = filterContainer.querySelector(".filters");
  listElement.innerHTML = "";

  const keys = ["name", "type", "weight", "height", "base_experience"];

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
      if (token.type === "startsWith") {
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

    pendingMethod =
      value.toLowerCase() === "starts with:" ? "startsWith" : "endsWith";
    pendingChip.textContent = `${pendingKey}: ${pendingMethod} `;
    searchInput.value = "";
    filterContainer.style.display = "none";
    return;
  }

  if (e.key === "Enter" && value.includes(":") && !pendingChip) {
    e.preventDefault();
    const [key, ...valParts] = value.split(":");
    const val = valParts.join(":").trim();
    const validKeys = pokemonCache.length ? Object.keys(pokemonCache[0]) : [];

    if (key && val && validKeys.includes(key.trim().toLowerCase())) {
      filterTokens.push({ key: key.trim(), value: val });
      searchInput.value = "";
      filterSuggestions();
    }
    filterContainer.style.display = "none";
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
      filterContainer.style.display = "none";
    }
    return;
  }

  if (e.key === "Enter" && !pendingChip && value) {
    const potentialKey = value.toLowerCase();
    const validKeys = pokemonCache.length ? Object.keys(pokemonCache[0]) : [];
    if (validKeys.includes(potentialKey)) {
      e.preventDefault();
      createPendingChip(potentialKey);
    }
    return;
  }
};

// ------ filter helper functions ---------

const pokemonMatchesFilter = (pokemon, filter) => {
  const { key, value, type = "includes" } = filter;
  const searchValue = value.toLowerCase();
  const pokemonValue = pokemon[key];

  if (pokemonValue === undefined || pokemonValue === null) return false;

  if (key === "type") {
    return pokemon.types.some((typeInfo) => {
      const typeName = typeInfo.type.name;
      switch (type) {
        case "startsWith":
          return typeName.startsWith(searchValue);
        case "endsWith":
          return typeName.endsWith(searchValue);
        default:
          return typeName.includes(searchValue);
      }
    });
  }

  const pokemonValueString = String(pokemonValue).toLowerCase();

  switch (type) {
    case "startsWith":
      return pokemonValueString.startsWith(searchValue);
    case "endsWith":
      return pokemonValueString.endsWith(searchValue);
    default:
      return pokemonValueString.includes(searchValue);
  }
};

const evaluate = (node, pokemon) => {
  if (typeof node === "object" && node !== null && !Array.isArray(node)) {
    return pokemonMatchesFilter(pokemon, node);
  }

  if (Array.isArray(node)) {
    const [left, operator, right] = node;

    const leftResult = evaluate(left, pokemon);
    const rightResult = evaluate(right, pokemon);

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
  const all = await getPokemons();
  let result;

  if (filterTokens.length > 0) {
    const logicTree = parse(filterTokens);
    if (logicTree) {
      result = all.filter((pokemon) => evaluate(logicTree, pokemon));
    } else {
      result = all;
    }
  } else {
    result = all;
  }

  const currentInput = searchInput.value.trim().toLowerCase();
  if (currentInput && !pendingKey) {
    result = result.filter((pokemon) =>
      Object.values(pokemon).some((val) => {
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

searchButton.addEventListener(
  "click",
  debounce(() => {
    filterSuggestions();
  }, 300)
);

// filters are displayed when you click the input tag
searchInput.addEventListener("focus", async () => {
  console.log("Focus event fired! Attempting to show dropdown.");
  const pokemons = await getPokemons();
  console.log("Pokemons data received:", pokemons);
  renderFilters(pokemons);
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
