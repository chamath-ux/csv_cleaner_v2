"use strict";

const fileInput = document.querySelector("#csv-file");
const clearFileButton = document.querySelector("#clear-file-button");
const uploadName = document.querySelector(".upload-copy strong");
const uploadStatus = document.querySelector("#upload-status");
const selectedRows = document.querySelector("#selected-rows");
const selectedColumns = document.querySelector("#selected-columns");
const previewFrame = document.querySelector("#data-preview-frame");
const cleanedRows = document.querySelector("#cleaned-rows");
const cleanedRowsNote = document.querySelector("#cleaned-rows-note");
const cleanButton = document.querySelector("#clean-button");
const downloadButton = document.querySelector("#download-button");
const maxFileSize = 20 * 1024 * 1024;
let csvData = [];
let cleanedCsvData = [];
let removedRows = [];
let pendingCleanup = null;
let selectionVersion = 0;
let selectedFileName = "";
let previewStatus = "empty";

function updateDataPreview() {
  const previewData = previewStatus === "cleaned" ? cleanedCsvData : csvData;
  const previewRows = previewData.slice(1, 101).map((values, index) => ({
    rowNumber: index + 2,
    values
  }));
  const message = {
    type: "csv-cleaner:preview-data",
    payload: {
      status: previewStatus,
      fileName: selectedFileName,
      headers: previewData[0] || [],
      previewRows,
      previewRowCount: Math.max(previewData.length - 1, 0),
      cleanedRows: previewRows,
      cleanedRowCount: Math.max(previewData.length - 1, 0),
      removedRows: removedRows.slice(0, 100),
      removedRowCount: removedRows.length
    }
  };
  const targetOrigin = window.location.protocol === "file:" ? "*" : window.location.origin;

  if (previewFrame.contentWindow) {
    previewFrame.contentWindow.postMessage(message, targetOrigin);
  }
}

previewFrame.addEventListener("load", updateDataPreview);
updateDataPreview();

function resetCleanedData() {
  cleanedCsvData = [];
  removedRows = [];
  pendingCleanup = null;
  cleanedRows.textContent = "0";
  cleanedRowsNote.textContent = "No changes yet";
  downloadButton.disabled = true;
  document.dispatchEvent(new CustomEvent("csv-cleaner:cancel-row-removal"));
}

//reset the file selection state to its initial values
function resetFileSelection() {
  selectionVersion += 1;
  csvData = [];
  resetCleanedData();
  uploadName.textContent = "Drop your CSV file here";
  uploadStatus.textContent = "";
  uploadStatus.classList.remove("is-error");
  selectedFileName = "";
  previewStatus = "empty";
  selectedRows.textContent = "0";
  selectedColumns.textContent = "0";
  clearFileButton.disabled = true;
  updateDataPreview();
}

//display an error message when the file selection is invalid

function showFileError(message) {
  fileInput.value = "";
  resetFileSelection();
  uploadStatus.textContent = message;
  uploadStatus.classList.add("is-error");
}

async function readCsvFile(file, version) {
  const contents = await file.text();
  const result = Papa.parse(contents);
  const parseErrors = result.errors.filter(error => error.code !== "UndetectableDelimiter");

  if (parseErrors.length > 0) {
    throw new Error(parseErrors[0].message);
  }

  const parsedData = result.data;
  if (/(?:\r\n|\r|\n)$/.test(contents)) {
    const lastRecord = parsedData[parsedData.length - 1];
    if (lastRecord && lastRecord.length === 1 && lastRecord[0] === "") {
      parsedData.pop();
    }
  }

  if (version === selectionVersion) {
    csvData = parsedData;
  }

  return parsedData;
}

async function handleFileSelection() {
  const file = fileInput.files[0];

  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    showFileError("Choose a CSV file to continue.");
    return;
  }

  if (file.size > maxFileSize) {
    showFileError("The CSV file must be 20 MB or smaller.");
    return;
  }

  const version = selectionVersion + 1;
  selectionVersion = version;
  csvData = [];
  resetCleanedData();
  selectedRows.textContent = "0";
  selectedColumns.textContent = "0";
  uploadName.textContent = file.name;
  uploadStatus.textContent = "Reading CSV file...";
  uploadStatus.classList.remove("is-error");
  selectedFileName = file.name;
  previewStatus = "reading";
  updateDataPreview();

  try {
    const records = await readCsvFile(file, version);

    if (version !== selectionVersion) {
      return;
    }

    const columnCount = records.reduce((count, record) => Math.max(count, record.length), 0);
    const rowCount = Math.max(records.length - 1, 0);
    selectedRows.textContent = String(rowCount);
    selectedColumns.textContent = String(columnCount);
    uploadStatus.textContent = "Ready to clean.";
    previewStatus = "loaded";
    clearFileButton.disabled = false;
    updateDataPreview();
  } catch (error) {
    if (version !== selectionVersion) {
      return;
    }

    console.error("Could not read the selected CSV file.", error);
    showFileError(error instanceof Error ? error.message : "Could not read the selected CSV file.");
  }
}

fileInput.addEventListener("change", handleFileSelection);
clearFileButton.addEventListener("click", () => {
  fileInput.value = "";
  resetFileSelection();
});

cleanButton.addEventListener("click", () => {
  if (csvData.length === 0) {
    return;
  }

  const status = checkbuttonState();
  let cleanedData = csvData.map(row => row.slice());

  if (status.trimmed) {
    cleanedData = trimWhiteSpace(cleanedData);
  }

  const headers = cleanedData[0] || [];
  const dataRows = cleanedData.slice(1).map((values, index) => ({
    rowNumber: index + 2,
    values
  }));
  const emptyRows = status.removeEmptyRows
    ? dataRows.filter(row => row.values.every(value => String(value).trim() === ""))
    : [];
  const rowsToClean = status.removeEmptyRows
    ? dataRows.filter(row => !row.values.every(value => String(value).trim() === ""))
    : dataRows;

  if (status.removeDuplicates) {
    pendingCleanup = {
      type: "duplicates",
      headers,
      rows: rowsToClean,
      emptyRows,
      duplicateRows: []
    };
    document.dispatchEvent(new CustomEvent("csv-cleaner:confirm-removal", {
      detail: {
        type: "duplicates",
        headers,
        emptyRows
      }
    }));
    return;
  }

  if (emptyRows.length > 0) {
    pendingCleanup = {
      type: "empty-rows",
      data: [headers, ...rowsToClean.map(row => row.values)],
      rows: emptyRows
    };
    document.dispatchEvent(new CustomEvent("csv-cleaner:confirm-removal", {
      detail: {
        type: "empty-rows",
        headers,
        rows: emptyRows,
        rowCount: emptyRows.length
      }
    }));
    return;
  }

  applyCleanup([headers, ...rowsToClean.map(row => row.values)], []);
});

downloadButton.addEventListener("click", downloadCleanedCsv);

function downloadCleanedCsv() {
  if (cleanedCsvData.length === 0) {
    return;
  }

  const csvContent = Papa.unparse(cleanedCsvData);
  const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const baseName = selectedFileName.replace(/\.csv$/i, "") || "cleaned-data";
  link.href = downloadUrl;
  link.download = `${baseName}-cleaned.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function applyCleanup(data, rowsRemoved) {
  cleanedCsvData = data;
  removedRows = rowsRemoved;
  cleanedRows.textContent = String(removedRows.length);
  downloadButton.disabled = false;
  cleanedRowsNote.textContent = removedRows.length === 1
    ? "1 row removed"
    : removedRows.length > 1 ? "Rows removed" : "No rows removed";
  previewStatus = "cleaned";
  updateDataPreview();
  document.dispatchEvent(new CustomEvent("csv-cleaner:cleanup-complete"));
}

document.addEventListener("csv-cleaner:confirm-row-removal", () => {
  if (!pendingCleanup) {
    return;
  }

  const cleanup = pendingCleanup;
  pendingCleanup = null;
  if (cleanup.type === "duplicates") {
    const duplicateRowNumbers = new Set(cleanup.duplicateRows.map(row => row.rowNumber));
    const removed = [
      ...cleanup.emptyRows.map(row => ({ ...row, reason: "Empty row" })),
      ...cleanup.duplicateRows.map(row => ({ ...row, reason: "Duplicate" }))
    ];
    const rows = cleanup.rows
      .filter(row => !duplicateRowNumbers.has(row.rowNumber))
      .map(row => row.values);

    applyCleanup([cleanup.headers, ...rows], removed);
    return;
  }

  applyCleanup(cleanup.data, cleanup.rows);
});

document.addEventListener("csv-cleaner:cancel-row-removal", () => {
  pendingCleanup = null;
});

document.addEventListener("csv-cleaner:duplicate-columns-change", event => {
  if (!pendingCleanup || pendingCleanup.type !== "duplicates"
    || !event.detail || !Array.isArray(event.detail.columns)) {
    return;
  }

  const columns = event.detail.columns.filter(index =>
    Number.isInteger(index) && index >= 0 && index < pendingCleanup.headers.length
  );
  const seen = new Set();
  pendingCleanup.duplicateRows = columns.length === 0
    ? []
    : pendingCleanup.rows.filter(row => {
      const key = JSON.stringify(columns.map(index => row.values[index] ?? ""));
      if (seen.has(key)) {
        return true;
      }

      seen.add(key);
      return false;
    });

  document.dispatchEvent(new CustomEvent("csv-cleaner:duplicate-candidates", {
    detail: {
      headers: pendingCleanup.headers,
      duplicateRows: pendingCleanup.duplicateRows,
      emptyRows: pendingCleanup.emptyRows,
      columns
    }
  }));
});

function checkbuttonState() {
    return {
        trimmed: document.querySelector("#trim-whitespace").checked,
        removeEmptyRows: document.querySelector("#remove-empty-rows").checked,
        removeDuplicates: document.querySelector("#remove-duplicates").checked
    }
}

function trimWhiteSpace(data){
  return data.map(row => row.map(field => field.trim()));
}

