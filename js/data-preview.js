"use strict";

const description = document.querySelector("#data-preview-description");
const tabs = document.querySelector("#data-preview-tabs");
const cleanedTab = document.querySelector("#cleaned-tab");
const removedTab = document.querySelector("#removed-tab");
const tableWrap = document.querySelector("#data-preview-table-wrap");
const rowCountLabel = document.querySelector("#data-preview-row-count");
const limitNote = document.querySelector("#data-preview-limit");
let activeView = "cleaned";

function createCell(tagName, text) {
  const cell = document.createElement(tagName);
  cell.textContent = text;
  return cell;
}

function renderTable(headers, rows, isRemoved) {
  const columnCount = Math.max(headers.length, ...rows.map(row => row.values.length));
  const columnNames = Array.from({ length: columnCount }, (_, index) => {
    const header = headers[index];
    return typeof header === "string" && header.trim() ? header : `Column ${index + 1}`;
  });
  const table = document.createElement("table");
  table.className = "data-preview-table";
  const tableHead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.append(createCell("th", "Row"));
  columnNames.forEach(name => headerRow.append(createCell("th", name)));
  tableHead.append(headerRow);
  table.append(tableHead);

  const tableBody = document.createElement("tbody");
  rows.forEach((row, index) => {
    const tableRow = document.createElement("tr");
    const rowNumber = isRemoved ? row.rowNumber : index + 2;
    tableRow.append(createCell("td", String(rowNumber)));
    columnNames.forEach((_, columnIndex) => {
      const value = row.values[columnIndex] == null ? "" : String(row.values[columnIndex]);
      tableRow.append(createCell("td", value || "—"));
    });
    tableBody.append(tableRow);
  });
  table.append(tableBody);
  tableWrap.replaceChildren(table);
}

function clearPreviewTable() {
  tableWrap.replaceChildren();
}

function renderPreview(data) {
  const status = data.status;

  if (status === "loaded") {
    tabs.hidden = true;
    const rows = data.previewRows;
    const totalRows = data.previewRowCount;
    description.textContent = "CSV data";
    rowCountLabel.textContent = `Showing ${rows.length} of ${totalRows} rows`;
    limitNote.textContent = totalRows > 100 ? "Preview limited to first 100 rows" : "";

    if (totalRows === 0) {
      clearPreviewTable();
      return;
    }

    renderTable(data.headers, rows, false);
    return;
  }

  if (status !== "cleaned") {
    tabs.hidden = true;
    rowCountLabel.textContent = "Showing 0 rows";
    limitNote.textContent = "";

    if (status === "reading") {
      description.textContent = "Reading your CSV file";
    } else {
      description.textContent = "Your cleaned data will appear here";
    }
    clearPreviewTable();
    return;
  }

  tabs.hidden = false;
  cleanedTab.textContent = `Cleaned file (${data.cleanedRowCount})`;
  removedTab.textContent = `Removed rows (${data.removedRowCount})`;
  cleanedTab.setAttribute("aria-selected", String(activeView === "cleaned"));
  removedTab.setAttribute("aria-selected", String(activeView === "removed"));

  const isRemoved = activeView === "removed";
  const rows = isRemoved ? data.removedRows : data.cleanedRows;
  const totalRows = isRemoved ? data.removedRowCount : data.cleanedRowCount;
  const displayedRows = rows.length;
  description.textContent = isRemoved ? "Rows removed during cleanup" : "Cleaned CSV data";
  rowCountLabel.textContent = `Showing ${displayedRows} of ${totalRows} ${isRemoved ? "removed" : "cleaned"} rows`;
  limitNote.textContent = totalRows > 100 ? "Preview limited to first 100 rows" : "";

  if (totalRows === 0) {
    clearPreviewTable();
    return;
  }

  renderTable(data.headers, rows, isRemoved);
}

cleanedTab.addEventListener("click", () => {
  activeView = "cleaned";
  if (lastPreviewData) {
    renderPreview(lastPreviewData);
  }
});

removedTab.addEventListener("click", () => {
  activeView = "removed";
  if (lastPreviewData) {
    renderPreview(lastPreviewData);
  }
});

let lastPreviewData = null;
window.addEventListener("message", event => {
  if (event.source !== window.parent || !event.data || event.data.type !== "csv-cleaner:preview-data") {
    return;
  }

  const data = event.data.payload;
  if (!data || !Array.isArray(data.headers) || !Array.isArray(data.previewRows) || !Array.isArray(data.cleanedRows) || !Array.isArray(data.removedRows)) {
    throw new TypeError("Preview data must include headers and row arrays.");
  }

  lastPreviewData = data;
  activeView = "cleaned";
  renderPreview(data);
});
