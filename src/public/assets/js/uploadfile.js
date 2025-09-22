document.addEventListener("DOMContentLoaded", function () {
  const uploadForm = document.getElementById("uploadForm");
  const fileInput = document.getElementById("fileInput");
  const progress = document.getElementById("progress");
  const progressBar = document.getElementById("progressBar");
  const status = document.getElementById("status");
  const fileListBody = document.getElementById("fileListBody");
  const refreshBtn = document.getElementById("refreshBtn");
  const uploadSpinner = document.getElementById("uploadSpinner");
  const uploadText = document.getElementById("uploadText");

  let deleteModal;
  let fileToDelete = null;

  // Initialize Bootstrap modal
  const modalElement = document.getElementById("deleteModal");
  if (modalElement) {
    deleteModal = new bootstrap.Modal(modalElement);
  }

  // Format file size
  function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Format date
  function formatDate(dateString) {
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  }

  // Get file icon based on mime type
  function getFileIcon(mimeType) {
    if (mimeType.startsWith("image/")) return "bi-file-image";
    if (mimeType === "application/pdf") return "bi-file-pdf";
    if (mimeType.includes("word") || mimeType.includes("document")) return "bi-file-word";
    if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "bi-file-excel";
    if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "bi-file-ppt";
    return "bi-file-earmark";
  }

  // Load files
  async function loadFiles() {
    try {
      const response = await fetch("/api/files");
      const data = await response.json();

      if (data.success) {
        renderFiles(data.files);
      } else {
        throw new Error(data.message || "Failed to load files");
      }
    } catch (error) {
      console.error("Error loading files:", error);
      fileListBody.innerHTML = `
            <tr>
              <td colspan="5" class="text-center text-danger py-4">
                Error loading files. Please try again.
              </td>
            </tr>`;
    }
  }

  // Render files in table
  function renderFiles(files) {
    if (files.length === 0) {
      fileListBody.innerHTML = `
            <tr>
              <td colspan="5" class="text-center py-4 text-muted">
                No files uploaded yet.
              </td>
            </tr>`;
      return;
    }

    fileListBody.innerHTML = files
      .map(
        (file) => `
          <tr class="file-item" data-id="${file.id}">
            <td>
              <i class="bi ${getFileIcon(file.mime_type)} me-2"></i>
              <a href="/uploads/${file.stored_name}" target="_blank" class="text-decoration-none">
                ${file.original_name}
              </a>
            </td>
            <td>${formatFileSize(file.size)}</td>
            <td>${file.uploader_email || "Unknown"}</td>
            <td>${formatDate(file.created_at)}</td>
            <td>
              <div class="btn-group btn-group-sm">
                <a href="/uploads/${file.stored_name}" 
                   class="btn btn-outline-primary" 
                   download="${file.original_name}"
                   title="Download">
                  <i class="bi bi-download"></i>
                </a>
                <button class="btn btn-outline-danger delete-btn" 
                        data-id="${file.id}"
                        data-bs-toggle="modal" 
                        data-bs-target="#deleteModal"
                        title="Delete">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");

    // Add event listeners to delete buttons
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        fileToDelete = e.currentTarget.getAttribute("data-id");
      });
    });
  }

  // Handle file upload
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    // Show progress bar
    progress.style.display = "block";
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";
    status.textContent = "Starting upload...";

    // Disable form
    uploadForm.querySelector('button[type="submit"]').disabled = true;
    uploadSpinner.classList.remove("d-none");
    uploadText.textContent = "Uploading...";

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          progressBar.style.width = percentComplete + "%";
          progressBar.textContent = percentComplete + "%";
          status.textContent = `Uploading: ${percentComplete}%`;
        }
      });

      xhr.onload = async function () {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            status.textContent = "Upload completed!";
            await loadFiles(); // Refresh file list
            uploadForm.reset(); // Reset form
          } else {
            throw new Error(response.message || "Upload failed");
          }
        } else {
          let errorMsg = "Upload failed";
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            errorMsg = errorResponse.message || errorMsg;
          } catch (e) {
            errorMsg = `Server error: ${xhr.status}`;
          }
          throw new Error(errorMsg);
        }
      };

      xhr.onerror = function () {
        throw new Error("Network error occurred");
      };

      // Call API /api/upload ,config on web.js
      xhr.open("POST", "/api/upload", true);
      xhr.send(formData);
    } catch (error) {
      console.error("Upload error:", error);
      status.textContent = `Error: ${error.message}`;
      status.classList.add("text-danger");
    } finally {
      // Hide progress bar after delay
      setTimeout(() => {
        progress.style.display = "none";
        status.classList.remove("text-danger");
      }, 3000);

      // Re-enable form
      uploadForm.querySelector('button[type="submit"]').disabled = false;
      uploadSpinner.classList.add("d-none");
      uploadText.textContent = "Upload File";
    }
  });

  // Handle file deletion
  document.getElementById("confirmDelete")?.addEventListener("click", async () => {
    if (!fileToDelete) return;

    try {
      const response = await fetch(`/api/files/${fileToDelete}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        // Remove the deleted file from the UI
        document.querySelector(`.file-item[data-id="${fileToDelete}"]`)?.remove();
        // Reload files to update the list
        await loadFiles();
      } else {
        throw new Error(data.message || "Failed to delete file");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert(`Error deleting file: ${error.message}`);
    } finally {
      deleteModal.hide();
      fileToDelete = null;
    }
  });

  // Refresh button
  refreshBtn?.addEventListener("click", loadFiles);

  // Load files on page load
  loadFiles();
});
