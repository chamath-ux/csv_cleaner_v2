"use strict";

const emptyCellsCheckbox = document.querySelector("#show-empty-cells");
const emptyCellsDialog = document.querySelector("#empty-cells-dialog");
const emptyCellsSummary = document.querySelector("#empty-cells-summary");
const emptyCellsContent = document.querySelector("#empty-cells-content");
const closeEmptyCellsButton = document.querySelector("#close-empty-cells");
const closeEmptyCellsFooterButton = document.querySelector("#close-empty-cells-footer");
const emptyCellDefaultValue = document.querySelector("#empty-cell-default-value");
const emptyCellsActionStatus = document.querySelector("#empty-cells-action-status");
const fillEmptyCellsButton = document.querySelector("#fill-empty-cells");
const removeEmptyCellRowsButton = document.querySelector("#remove-empty-cell-rows");
let sourceData = [];
let sourceDataStatus = "empty";

function identifyEmptyColumns(data) {
  const columnCount = data.reduce((count, row) => Math.max(count, row.length), 0);
  return data.slice(1)
    .filter(row => Array.from({ length: columnCount }, (_, index) => row[index])
      .some(value => String(value ?? "").trim() === ""));
}

function createEmptyCellsCell(tagName, text) {
  const cell = document.createElement(tagName);
  cell.textContent = text;
  return cell;
}

function renderEmptyCells(rows) {
  const headers = sourceData[0] || [];
  const columnCount = Math.max(headers.length, ...rows.map(row => row.values.length));
  const columnNames = Array.from({ length: columnCount }, (_, index) => {
    const header = headers[index];
    return typeof header === "string" && header.trim() ? header : `Column ${index + 1}`;
  });
  const tableWrapper = document.createElement("div");
  tableWrapper.className = "removed-rows-table-wrap";
  const table = document.createElement("table");
  table.className = "removed-rows-table";
  const caption = createEmptyCellsCell("caption", "Rows containing at least one empty cell");
  table.append(caption);

  const tableHead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.append(createEmptyCellsCell("th", "CSV row"));
  columnNames.forEach(name => headerRow.append(createEmptyCellsCell("th", name)));
  tableHead.append(headerRow);
  table.append(tableHead);

  const tableBody = document.createElement("tbody");
  rows.slice(0, 100).forEach(row => {
    const tableRow = document.createElement("tr");
    tableRow.append(createEmptyCellsCell("td", String(row.rowNumber)));
    columnNames.forEach((_, index) => {
      const value = row.values[index] == null ? "" : String(row.values[index]);
      tableRow.append(createEmptyCellsCell("td", value.trim() ? value : "—"));
    });
    tableBody.append(tableRow);
  });
  table.append(tableBody);
  tableWrapper.append(table);
  emptyCellsContent.replaceChildren(tableWrapper);
}

function updateEmptyCellsDialog() {
  if (!emptyCellsCheckbox.checked || sourceDataStatus !== "loaded") {
    if (emptyCellsDialog.open) {
      emptyCellsDialog.close();
    }
    return;
  }

  const rows = identifyEmptyColumns(sourceData).map(values => ({
    rowNumber: sourceData.indexOf(values) + 1,
    values
  }));
  fillEmptyCellsButton.disabled = rows.length === 0;
  removeEmptyCellRowsButton.disabled = rows.length === 0;
  emptyCellsActionStatus.textContent = "";
  if (rows.length === 0) {
    emptyCellsSummary.textContent = "No rows with empty cells were found.";
    emptyCellsContent.replaceChildren();
  } else {
    emptyCellsSummary.textContent = `${rows.length} row${
      rows.length === 1 ? "" : "s"
    } contain empty cells. The rows are shown below and will not be changed.`;
    renderEmptyCells(rows);
  }

  if (!emptyCellsDialog.open) {
    emptyCellsDialog.showModal();
  }
}

document.addEventListener("csv-cleaner:source-data-change", event => {
  const detail = event.detail;
  if (!detail || !Array.isArray(detail.data)
    || !["empty", "reading", "loaded"].includes(detail.status)
    || detail.status === "loaded" && !detail.data.every(Array.isArray)) {
    throw new TypeError("Empty-cell review requires CSV source data and a valid status.");
  }

  sourceDataStatus = detail.status;
  sourceData = detail.status === "loaded" ? detail.data : [];
  updateEmptyCellsDialog();
});

fillEmptyCellsButton.addEventListener("click", () => {
  const value = emptyCellDefaultValue.value;
  if (!value.trim()) {
    emptyCellsActionStatus.textContent = "Enter a non-empty default value first.";
    emptyCellDefaultValue.focus();
    return;
  }

  document.dispatchEvent(new CustomEvent("csv-cleaner:fill-empty-cells", {
    detail: { value }
  }));
  emptyCellsActionStatus.textContent = "Default value applied to empty cells.";
});

removeEmptyCellRowsButton.addEventListener("click", () => {
  document.dispatchEvent(new CustomEvent("csv-cleaner:select-empty-cell-rows-for-removal"));
  emptyCellsActionStatus.textContent = "Rows selected. Click Clean my data to review all selected removals.";
});

emptyCellsCheckbox.addEventListener("change", updateEmptyCellsDialog);
closeEmptyCellsButton.addEventListener("click", () => emptyCellsDialog.close());
closeEmptyCellsFooterButton.addEventListener("click", () => emptyCellsDialog.close());
emptyCellsDialog.addEventListener("click", event => {
  if (event.target === emptyCellsDialog) {
    emptyCellsDialog.close();
  }
});
