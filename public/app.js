/**
 * Candidate Matchmaker Client Application
 * Polished, minimal, enterprise-grade UI with Microsoft AI Foundry & Gmail API.
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("match-form");
  const jobDescriptionInput = document.getElementById("job-description");
  const submitBtn = document.getElementById("submit-btn");
  const btnText = submitBtn.querySelector(".btn-text");
  const sampleBtn = document.getElementById("sample-btn");
  const clearBtn = document.getElementById("clear-btn");
  const charCount = document.getElementById("char-count");

  const resultsSection = document.getElementById("results-section");
  const resultsCount = document.getElementById("results-count");
  const candidatesList = document.getElementById("candidates-list");
  const errorMessage = document.getElementById("error-message");
  const errorText = errorMessage.querySelector(".error-text");

  // Email Modal Elements
  const emailModal = document.getElementById("email-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const emailForm = document.getElementById("email-form");
  const emailTo = document.getElementById("email-to");
  const emailSubject = document.getElementById("email-subject");
  const emailBody = document.getElementById("email-body");
  const modalSendBtn = document.getElementById("modal-send-btn");
  const modalSendText = modalSendBtn.querySelector(".btn-text");

  // Toast
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toast-text");

  // Set of candidates who have been sent outreach emails
  const sentEmails = new Set();
  let currentTargetCard = null;

  // Upload Zone Elements
  const uploadZone = document.getElementById("upload-zone");
  const pdfUploadInput = document.getElementById("pdf-upload");
  const uploadPreview = document.getElementById("upload-preview");
  const uploadFilename = document.getElementById("upload-filename");
  const uploadRemoveBtn = document.getElementById("upload-remove-btn");
  const uploadProgress = document.getElementById("upload-progress");
  const uploadProgressBar = uploadProgress ? uploadProgress.querySelector(".upload-progress-bar") : null;
  const uploadZoneContent = uploadZone ? uploadZone.querySelector(".upload-zone-content") : null;

  // Sample job description for quick testing
  const sampleJD = `Role: Senior AI/ML Full Stack Engineer
Location: San Francisco, CA (or Remote)
Experience: 5+ years

Key Responsibilities:
- Design and deploy scalable production machine learning pipelines and LLM applications.
- Fine-tune models (LoRA/QLoRA) and implement robust RAG workflows.
- Develop clean RESTful APIs using Python / FastAPI / Node.js and modern web frontends.
- Collaborate with product and engineering teams to translate research prototypes into reliable cloud services.

Requirements:
- Strong proficiency in Python, PyTorch, TensorFlow, or Hugging Face.
- Hands-on experience with cloud deployment, Docker, and MLOps.
- Strong full-stack web development skills (APIs, UI, databases).`;

  // ==================== PDF Upload Handling ====================
  if (uploadZone && pdfUploadInput) {
    // Click to browse
    uploadZone.addEventListener("click", (e) => {
      if (uploadZone.classList.contains("has-file")) return;
      if (e.target.closest("#upload-remove-btn")) return;
      pdfUploadInput.click();
    });

    // Drag and drop events
    ["dragenter", "dragover"].forEach((evt) => {
      uploadZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!uploadZone.classList.contains("has-file")) {
          uploadZone.classList.add("drag-over");
        }
      });
    });

    ["dragleave", "drop"].forEach((evt) => {
      uploadZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove("drag-over");
      });
    });

    uploadZone.addEventListener("drop", (e) => {
      if (uploadZone.classList.contains("has-file")) return;
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handlePdfFile(files[0]);
      }
    });

    // File input change
    pdfUploadInput.addEventListener("change", () => {
      if (pdfUploadInput.files.length > 0) {
        handlePdfFile(pdfUploadInput.files[0]);
      }
    });

    // Remove file button
    if (uploadRemoveBtn) {
      uploadRemoveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        resetUploadZone();
      });
    }
  }

  function resetUploadZone() {
    if (pdfUploadInput) pdfUploadInput.value = "";
    if (uploadZone) uploadZone.classList.remove("has-file");
    if (uploadZoneContent) uploadZoneContent.style.display = "";
    if (uploadPreview) uploadPreview.style.display = "none";
    if (uploadProgress) uploadProgress.style.display = "none";
    if (uploadProgressBar) uploadProgressBar.style.width = "0%";
    // Remove any existing error messages
    const existingError = uploadZone ? uploadZone.querySelector(".upload-error") : null;
    if (existingError) existingError.remove();
  }

  async function handlePdfFile(file) {
    // Validate file type
    if (file.type !== "application/pdf") {
      showUploadError("Please upload a PDF file.");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showUploadError("File is too large. Maximum size is 10MB.");
      return;
    }

    // Clear previous errors
    const existingError = uploadZone ? uploadZone.querySelector(".upload-error") : null;
    if (existingError) existingError.remove();

    // Show progress
    if (uploadZoneContent) uploadZoneContent.style.display = "none";
    if (uploadProgress) {
      uploadProgress.style.display = "block";
      if (uploadProgressBar) uploadProgressBar.style.width = "30%";
    }

    try {
      const formData = new FormData();
      formData.append("pdfFile", file);

      // Animate progress
      if (uploadProgressBar) uploadProgressBar.style.width = "60%";

      const response = await fetch("/api/parse-pdf", {
        method: "POST",
        body: formData,
      });

      if (uploadProgressBar) uploadProgressBar.style.width = "90%";

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse PDF.");
      }

      // Success — populate textarea
      if (uploadProgressBar) uploadProgressBar.style.width = "100%";

      setTimeout(() => {
        // Show file preview
        if (uploadProgress) uploadProgress.style.display = "none";
        if (uploadPreview) {
          uploadPreview.style.display = "flex";
          if (uploadFilename) uploadFilename.textContent = file.name;
        }
        if (uploadZone) uploadZone.classList.add("has-file");

        // Fill the textarea with extracted text
        jobDescriptionInput.value = data.text;
        updateTextareaState();

        // Scroll textarea into view
        jobDescriptionInput.scrollIntoView({ behavior: "smooth", block: "center" });

        showToast(`PDF parsed — ${data.text.length.toLocaleString()} characters extracted from ${data.pages} page${data.pages === 1 ? "" : "s"}`);
      }, 300);

    } catch (err) {
      console.error("PDF upload error:", err);
      resetUploadZone();
      showUploadError(err.message || "Failed to parse the PDF file.");
    }
  }

  function showUploadError(msg) {
    // Remove any existing error
    const existingError = uploadZone ? uploadZone.querySelector(".upload-error") : null;
    if (existingError) existingError.remove();

    if (uploadZone) {
      const errorDiv = document.createElement("div");
      errorDiv.className = "upload-error";
      errorDiv.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <span>${msg}</span>
      `;
      uploadZone.appendChild(errorDiv);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (errorDiv.parentNode) errorDiv.remove();
      }, 5000);
    }
  }

  // Textarea input handlers for character count & clear button
  function updateTextareaState() {
    const len = jobDescriptionInput.value.length;
    charCount.textContent = `${len.toLocaleString()} character${len === 1 ? "" : "s"}`;
    if (clearBtn) {
      clearBtn.style.display = len > 0 ? "inline-block" : "none";
    }
  }

  jobDescriptionInput.addEventListener("input", updateTextareaState);

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      jobDescriptionInput.value = "";
      updateTextareaState();
      jobDescriptionInput.focus();
    });
  }

  // Keyboard shortcut: Ctrl + Enter / Cmd + Enter to submit
  jobDescriptionInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!submitBtn.disabled) {
        form.requestSubmit();
      }
    }
  });

  // Pre-fill sample JD
  sampleBtn.addEventListener("click", () => {
    jobDescriptionInput.value = sampleJD;
    updateTextareaState();
    jobDescriptionInput.focus();
  });

  // Handle matching request
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const jobDescription = jobDescriptionInput.value.trim();
    if (!jobDescription) {
      showError("Please enter a job description.");
      return;
    }

    setLoading(true);
    hideError();
    resultsSection.style.display = "none";
    candidatesList.innerHTML = "";

    try {
      const response = await fetch("/api/match-candidates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobDescription }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to find matching candidates.");
      }

      renderCandidates(data.candidates || []);
    } catch (err) {
      console.error("Match error:", err);
      showError(err.message || "An unexpected error occurred while communicating with the server.");
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true;
      submitBtn.classList.add("loading");
      btnText.textContent = "Finding the best matches...";
    } else {
      submitBtn.disabled = false;
      submitBtn.classList.remove("loading");
      btnText.textContent = "Find Candidates";
    }
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorMessage.style.display = "block";
  }

  function hideError() {
    errorMessage.style.display = "none";
    errorText.textContent = "";
  }

  function getInitials(name) {
    if (!name) return "CA";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function renderCandidates(candidates) {
    resultsSection.style.display = "block";

    if (!candidates || candidates.length === 0) {
      resultsCount.textContent = "0 matches";
      candidatesList.innerHTML = `
        <div class="no-candidates">
          No matching candidates found in the knowledge base for this job description.
        </div>
      `;
      return;
    }

    resultsCount.textContent = `${candidates.length} ${candidates.length === 1 ? "candidate" : "candidates"}`;

    candidatesList.innerHTML = candidates
      .map((candidate, idx) => {
        const name = escapeHtml(candidate.name || "Unknown Candidate");
        const email = candidate.email ? escapeHtml(candidate.email) : "";
        const initials = getInitials(candidate.name);

        const score = candidate.match_score !== null && candidate.match_score !== undefined
          ? `<span class="cand-score">${candidate.match_score}%</span>`
          : "";

        const emailHtml = email
          ? `<a href="mailto:${email}" style="color:var(--text-muted);text-decoration:none;">${email}</a>`
          : `<span style="color: #6b7280; font-style: italic;">Email not listed</span>`;

        const isSent = email && sentEmails.has(email.toLowerCase());
        const actionHtml = email
          ? isSent
            ? `<span class="email-sent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Sent
              </span>`
            : `<button type="button" class="btn btn-outline email-btn" data-name="${name}" data-email="${email}" data-card-id="card-${idx}">
                Send Email
              </button>`
          : "";

        const summaryText = candidate.summary || "";
        const summaryLines = summaryText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => Boolean(l) && !/^summary:?$/i.test(l))
          .map((l) => (l.startsWith("•") || l.startsWith("-") || l.startsWith("*") ? l.replace(/^[-*•]\s*/, "• ") : `• ${l}`));

        const summaryHtml = summaryLines.length > 0
          ? summaryLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")
          : `<div>• Candidate profile exhibits strong alignment with requirements in the JD.</div>`;

        return `
          <div class="candidate-card" id="card-${idx}">
            <div class="cand-info">
              <div class="cand-avatar">${initials}</div>
              <div class="cand-details">
                <h4>${name}
                  <button type="button" class="summary-dropdown-btn icon-btn" data-target="summary-${idx}" style="display:inline-flex;margin-left:8px;padding:2px;" title="Toggle Summary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                </h4>
                <p>${emailHtml}</p>
              </div>
              <div class="cand-actions" style="margin-left:auto; display:flex; gap:16px; align-items:center;">
                ${score}
                ${actionHtml}
              </div>
            </div>
            <div class="cand-summary" id="summary-${idx}">
              ${summaryHtml}
            </div>
          </div>
        `;
      })
      .join("");

    // Attach click handlers to Summary dropdown buttons
    candidatesList.querySelectorAll(".summary-dropdown-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        const panel = document.getElementById(targetId);
        if (!panel) return;

        panel.classList.toggle("active");
        const isActive = panel.classList.contains("active");
        btn.classList.toggle("active", isActive);
        btn.style.transform = isActive ? "rotate(180deg)" : "rotate(0deg)";
        btn.setAttribute("aria-expanded", isActive ? "true" : "false");
      });
    });

    // Attach click handlers to Send Email buttons
    candidatesList.querySelectorAll(".email-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-name");
        const email = btn.getAttribute("data-email");
        const cardId = btn.getAttribute("data-card-id");
        openEmailModal(name, email, cardId);
      });
    });

    // Attach click handlers to copy email buttons
    candidatesList.querySelectorAll(".copy-email-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const emailToCopy = btn.getAttribute("data-copy");
        if (emailToCopy) {
          navigator.clipboard.writeText(emailToCopy).then(() => {
            showToast(`Copied ${emailToCopy} to clipboard`);
          });
        }
      });
    });

    // Scroll smoothly to results
    resultsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Open Email Modal
  async function openEmailModal(candidateName, candidateEmail, cardId) {
    currentTargetCard = document.getElementById(cardId);
    emailTo.value = candidateEmail;

    // Detect role from job description or default
    const jd = jobDescriptionInput.value;
    let role = "Senior AI/ML Engineer";
    const roleMatch = jd.match(/Role:\s*([^\n]+)/i) || jd.match(/Title:\s*([^\n]+)/i);
    if (roleMatch) {
      role = roleMatch[1].trim();
    }

    let company = "";
    const companyMatch = jd.match(/Company:\s*([^\n]+)/i) || jd.match(/Organization:\s*([^\n]+)/i);
    if (companyMatch) {
      company = companyMatch[1].trim();
    }

    try {
      const queryParams = new URLSearchParams({
        name: candidateName,
        role: role,
        ...(company ? { company } : {}),
      });
      const res = await fetch(`/api/email-template?${queryParams.toString()}`);
      const template = await res.json();
      emailSubject.value = template.subject;
      emailBody.value = template.body;
    } catch (e) {
      const comp = company || "company name";
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 2);
      const formattedDate = targetDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      emailSubject.value = `Virtual Interview Round Invitation: ${role} - ${candidateName}`;
      emailBody.value = `Dear ${candidateName},

Congratulations!

We are pleased to inform you that you have successfully cleared the **Resume Screening Round** for the position of **${role}** at **${comp}**.

Based on your qualifications, experience, and profile, your application has been shortlisted for the **next stage of our recruitment process — the Virtual Interview Round**.

### Interview Details

**Date:** ${formattedDate}
**Time:** 10:00 AM
**Mode:** Online
**Meeting Link:** https://meet.google.com/abc-defg-hij

We kindly request you to **join the meeting at least 5 minutes before the scheduled time** to ensure that your audio, video, and internet connection are working properly.

Please keep a copy of your resume and any relevant documents readily available during the interview.

We appreciate your interest in **${comp}** and look forward to speaking with you. We wish you the very best for the upcoming round.

warm regards, 
HR , 
${comp}
companyname@gmail.com
+9999999999`;
    }

    emailModal.style.display = "flex";
  }

  function closeEmailModal() {
    emailModal.style.display = "none";
    emailForm.reset();
    currentTargetCard = null;
  }

  modalCloseBtn.addEventListener("click", closeEmailModal);
  modalCancelBtn.addEventListener("click", closeEmailModal);

  // Close modal when clicking on the backdrop
  emailModal.addEventListener("click", (e) => {
    if (e.target === emailModal) {
      closeEmailModal();
    }
  });

  // Handle Email Form Submission
  emailForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const to = emailTo.value.trim();
    const subject = emailSubject.value.trim();
    const body = emailBody.value.trim();

    if (!to || !subject || !body) return;

    modalSendBtn.disabled = true;
    modalSendBtn.classList.add("loading");
    modalSendText.textContent = "Sending...";

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to, subject, body }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to send email.");
      }

      // Mark as sent
      sentEmails.add(to.toLowerCase());

      // Update candidate card in UI
      if (currentTargetCard) {
        const sideDiv = currentTargetCard.querySelector(".cand-actions");
        const btn = currentTargetCard.querySelector(".email-btn");
        if (btn) {
          btn.remove();
        }
        const badge = document.createElement("span");
        badge.className = "email-sent";
        badge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Sent`;
        sideDiv.appendChild(badge);
      }

      closeEmailModal();
      showToast(`Outreach email sent successfully to ${to}`);
    } catch (err) {
      alert(`Error sending email: ${err.message}`);
    } finally {
      modalSendBtn.disabled = false;
      modalSendBtn.classList.remove("loading");
      modalSendText.textContent = "Send Email";
    }
  });

  function showToast(msg) {
    toastText.textContent = msg;
    toast.style.display = "flex";
    setTimeout(() => {
      toast.style.display = "none";
    }, 4000);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Scroll Animations Setup
  const observerOptions = {
    root: null,
    rootMargin: "0px",
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        // Optional: Stop observing once revealed
        // observer.unobserve(entry.target); 
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal-up').forEach(el => {
    observer.observe(el);
  });
});
