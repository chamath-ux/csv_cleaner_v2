"use strict";

const removedRowsDialog = document.querySelector("#removed-rows-dialog");
const removedRowsTitle = document.querySelector("#removed-rows-title");
const removedRowsKicker = document.querySelector("#removed-rows-kicker");
const removedRowsSummary = document.querySelector("#removed-rows-summary");
const duplicateColumns = document.querySelector("#duplicate-columns");
const removedRowsContent = document.querySelector("#removed-rows-content");
const closeRemovedRowsButton = document.querySelector("#close-removed-rows");
const cancelRemovedRowsButton = document.querySelector("#cancel-removed-rows");
const confirmRemoveRowsButton = document.querySelector("#confirm-remove-rows");
let confirmationOpen = false;
let confirmationType = "";

function createTableCell(tagName, text) {
  const cell = document.createElement(tagName);
  cell.textContent = text;
  return cell;
}

function renderRows(headers, rows, showReason, caption = "") {
  const visibleRows = rows.slice(0, 100);
  const columnCount = Math.max(headers.length, ...visibleRows.map(row => row.values.length));
  const columnNames = Array.from({ length: columnCount }, (_, index) => {
    const header = headers[index];
    return typeof header === "string" && header.trim() ? header : `Column ${index + 1}`;
  });

  const tableWrapper = document.createElement("div");
  tableWrapper.className = "removed-rows-table-wrap";
  const table = document.createElement("table");
  table.className = "removed-rows-table";
  if (caption) {
    table.append(createTableCell("caption", caption));
  }
  const tableHead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.append(createTableCell("th", "CSV row"));
  columnNames.forEach(name => headerRow.append(createTableCell("th", name)));
  if (showReason) {
    headerRow.append(createTableCell("th", "Removal reason"));
  }
  tableHead.append(headerRow);
  table.append(tableHead);

  const tableBody = document.createElement("tbody");
  visibleRows.forEach(row => {
    const tableRow = document.createElement("tr");
    tableRow.append(createTableCell("td", String(row.rowNumber)));
    columnNames.forEach((_, index) => {
      const value = row.values[index] == null ? "" : String(row.values[index]);
      tableRow.append(createTableCell("td", value || "—"));
    });
    if (showReason) {
      tableRow.append(createTableCell("td", row.reason));
    }
    tableBody.append(tableRow);
  });
  table.append(tableBody);
  tableWrapper.append(table);
  removedRowsContent.replaceChildren(tableWrapper);
}

function getSelectedColumns() {
  return Array.from(duplicateColumns.querySelectorAll("input:checked"))
    .map(input => Number(input.value));
}

function showEmptyRowConfirmation(detail) {
  confirmationType = "empty-rows";
  removedRowsTitle.textContent = "Remove empty rows?";
  removedRowsKicker.textContent = "Confirm cleanup";
  confirmRemoveRowsButton.textContent = "Remove rows";
  duplicateColumns.hidden = true;
  duplicateColumns.replaceChildren();
  removedRowsSummary.textContent = `${detail.rows.length} empty ${
    detail.rows.length === 1 ? "row will" : "rows will"
  } be removed. This cannot be undone. Continue?${
    detail.rows.length > 100 ? " Showing the first 100 rows below." : ""
  }`;
  renderRows(detail.headers, detail.rows, false, "Empty rows selected for removal");
  confirmationOpen = true;
  removedRowsDialog.showModal();
}

function showSelectedRowsConfirmation(detail) {
  confirmationType = "selected-rows";
  removedRowsTitle.textContent = "Confirm row removal";
  removedRowsKicker.textContent = "Confirm cleanup";
  confirmRemoveRowsButton.textContent = "Remove rows";
  duplicateColumns.hidden = true;
  duplicateColumns.replaceChildren();
  const emptyRowCount = detail.rows.filter(row => row.reason === "Empty row").length;
  const emptyCellRowCount = detail.rows.filter(row => row.reason === "Contains an empty cell").length;
  const emptyRowsText = emptyRowCount > 0
    ? ` ${emptyRowCount} fully empty ${emptyRowCount === 1 ? "row" : "rows"}.`
    : "";
  const emptyCellsText = emptyCellRowCount > 0
    ? ` ${emptyCellRowCount} ${emptyCellRowCount === 1 ? "row contains" : "rows contain"} empty cells.`
    : "";
  removedRowsSummary.textContent = `${detail.rows.length} rows selected for removal.${emptyRowsText}${emptyCellsText} This cannot be undone. Continue?${
    detail.rows.length > 100 ? " Showing the first 100 rows below." : ""
  }`;
  renderRows(detail.headers, detail.rows, true, "Rows selected for removal");
  confirmationOpen = true;
  removedRowsDialog.showModal();
}

function showCleanupConfirmation() {
  confirmationType = "cleanup";
  removedRowsTitle.textContent = "Confirm cleanup";
  removedRowsKicker.textContent = "Cleanup review";
  confirmRemoveRowsButton.textContent = "Continue cleanup";
  duplicateColumns.hidden = true;
  duplicateColumns.replaceChildren();
  removedRowsContent.replaceChildren();
  removedRowsSummary.textContent = "No rows need removal. Continue with the selected cleanup options?";
  confirmationOpen = true;
  removedRowsDialog.showModal();
}

function showDuplicateReview(detail) {
  confirmationType = "duplicates";
  removedRowsTitle.textContent = "Review duplicate rows";
  removedRowsKicker.textContent = "Duplicate check";
  confirmRemoveRowsButton.textContent = "Continue cleanup";
  duplicateColumns.hidden = false;
  duplicateColumns.replaceChildren();

  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Match duplicates using these columns";
  fieldset.append(legend);
  const options = document.createElement("div");
  options.className = "duplicate-column-options";

  detail.headers.forEach((header, index) => {
    const label = document.createElement("label");
    label.className = "duplicate-column-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = String(index);
    input.checked = true;
    input.addEventListener("change", () => {
      document.dispatchEvent(new CustomEvent("csv-cleaner:duplicate-columns-change", {
        detail: { columns: getSelectedColumns() }
      }));
    });
    const name = document.createElement("span");
    name.textContent = typeof header === "string" && header.trim()
      ? header
      : `Column ${index + 1}`;
    label.append(input, name);
    options.append(label);
  });

  fieldset.append(options);
  duplicateColumns.append(fieldset);
  removedRowsSummary.textContent = "Checking for duplicate rows across all columns...";
  renderRows(detail.headers, [], true, "Rows selected for removal");
  confirmationOpen = true;
  removedRowsDialog.showModal();
  document.dispatchEvent(new CustomEvent("csv-cleaner:duplicate-columns-change", {
    detail: { columns: getSelectedColumns() }
  }));
}

function updateDuplicateCandidates(detail) {
  if (!confirmationOpen || confirmationType !== "duplicates") {
    return;
  }

  const duplicateRows = detail.duplicateRows;
  const emptyRows = detail.emptyRows.map(row => ({ ...row, reason: "Empty row" }));
  const emptyCellRows = detail.emptyCellRows.map(row => ({
    ...row,
    reason: "Contains an empty cell"
  }));
  const rows = [
    ...emptyRows,
    ...emptyCellRows,
    ...duplicateRows.map(row => ({ ...row, reason: "Duplicate" }))
  ].sort((first, second) => first.rowNumber - second.rowNumber);
  const duplicateCount = duplicateRows.length;
  const emptyCount = emptyRows.length;
  const emptyCellCount = emptyCellRows.length;
  const columnCount = detail.columns.length;
  const duplicateText = `${duplicateCount} duplicate ${
    duplicateCount === 1 ? "row matches" : "rows match"
  } across ${columnCount} selected ${columnCount === 1 ? "column" : "columns"}.`;
  const emptyText = emptyCount > 0
    ? ` ${emptyCount} empty ${emptyCount === 1 ? "row" : "rows"} will also be removed.`
    : "";
  const emptyCellText = emptyCellCount > 0
    ? ` ${emptyCellCount} ${emptyCellCount === 1 ? "row contains" : "rows contain"} empty cells and will also be removed.`
    : "";
  const noColumnsText = columnCount === 0 ? " Select at least one column to search for duplicates." : "";
  const noMatchesText = duplicateCount === 0 ? " No matching duplicate rows were found." : "";
  const limitText = rows.length > 100 ? " Showing the first 100 rows below." : "";

  removedRowsSummary.textContent = `${duplicateText}${emptyText}${emptyCellText}${noColumnsText}${noMatchesText}${limitText}`;
  confirmRemoveRowsButton.textContent = rows.length > 0 ? "Remove selected rows" : "Continue cleanup";
  renderRows(detail.headers, rows, true, "Rows selected for removal");
}

function cancelRowRemoval() {
  if (confirmationOpen) {
    document.dispatchEvent(new CustomEvent("csv-cleaner:cancel-row-removal"));
  }
}

document.addEventListener("csv-cleaner:confirm-removal", event => {
  const detail = event.detail;
  if (!detail || !Array.isArray(detail.headers)) {
    throw new TypeError("Cleanup confirmation requires column headers.");
  }

  if (detail.type === "duplicates" && Array.isArray(detail.emptyRows)
    && Array.isArray(detail.emptyCellRows)) {
    showDuplicateReview(detail);
    return;
  }

  if (detail.type === "cleanup") {
    showCleanupConfirmation();
    return;
  }

  if (detail.type === "selected-rows" && Array.isArray(detail.rows)
    && Number.isInteger(detail.rowCount) && detail.rowCount > 0
    && detail.rowCount === detail.rows.length) {
    showSelectedRowsConfirmation(detail);
    return;
  }

  if (detail.type !== "empty-rows" || !Array.isArray(detail.rows)
    || !Number.isInteger(detail.rowCount) || detail.rowCount < 1
    || detail.rowCount !== detail.rows.length) {
    throw new TypeError("Empty-row confirmation requires matching headers and rows.");
  }

  showEmptyRowConfirmation(detail);
});

document.addEventListener("csv-cleaner:duplicate-candidates", event => {
  if (!event.detail || !Array.isArray(event.detail.headers)
    || !Array.isArray(event.detail.duplicateRows) || !Array.isArray(event.detail.emptyRows)
    || !Array.isArray(event.detail.emptyCellRows) || !Array.isArray(event.detail.columns)) {
    throw new TypeError("Duplicate review requires candidate rows and selected columns.");
  }

  updateDuplicateCandidates(event.detail);
});

document.addEventListener("csv-cleaner:cancel-row-removal", () => {
  confirmationOpen = false;
  confirmationType = "";
  if (removedRowsDialog.open) {
    removedRowsDialog.close();
  }
});

document.addEventListener("csv-cleaner:cleanup-complete", () => {
  confirmationOpen = false;
  confirmationType = "";
  if (removedRowsDialog.open) {
    removedRowsDialog.close();
  }
});

closeRemovedRowsButton.addEventListener("click", cancelRowRemoval);
cancelRemovedRowsButton.addEventListener("click", cancelRowRemoval);
confirmRemoveRowsButton.addEventListener("click", () => {
  if (confirmationOpen) {
    document.dispatchEvent(new CustomEvent("csv-cleaner:confirm-row-removal"));
  }
});

removedRowsDialog.addEventListener("click", event => {
  if (event.target === removedRowsDialog) {
    cancelRowRemoval();
  }
});

removedRowsDialog.addEventListener("cancel", cancelRowRemoval);
