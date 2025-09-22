class DataProcessor {
  constructor() {
    this.data = [];
    console.log("DataProcessor initialized");
  }

  process(item) {
    console.log("Processing:", item);
    this.data.push(item);
  }

  async fetchData(url) {
    console.log("Fetching from:", url);
    return fetch(url);
  }
}

function calculateTotal(items) {
  console.log("Calculating total for", items.length, "items");
  return items.reduce((sum, item) => sum + item.value, 0);
}