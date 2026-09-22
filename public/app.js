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
          ? `<span class="candidate-score">${candidate.match_score}% Match</span>`
          : "";

        const emailHtml = email
          ? `<a href="mailto:${email}" class="candidate-email">${email}</a>`
          : `<span class="candidate-email" style="color: #94a3b8; font-style: italic;">Email not listed</span>`;

        const copyBtnHtml = email
          ? `<button type="button" class="copy-email-btn" data-copy="${email}" title="Copy email address">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>`
          : "";

        const isSent = email && sentEmails.has(email.toLowerCase());
        const actionHtml = email
          ? isSent
            ? `<span class="email-sent-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 3px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Email Sent
              </span>`
            : `<button type="button" class="email-btn" data-name="${name}" data-email="${email}" data-card-id="card-${idx}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
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
          ? summaryLines
              .map((line) => `<div class="summary-bullet-item">${escapeHtml(line)}</div>`)
              .join("")
          : `<div class="summary-bullet-item">• Candidate profile exhibits strong alignment with requirements in the JD.</div>`;

        return `
          <div class="candidate-item-wrapper" id="card-${idx}">
            <div class="candidate-card">
              <div class="candidate-left-group">
                <div class="candidate-avatar">${initials}</div>
                <div class="candidate-info">
                  <div class="candidate-name-row">
                    <span class="candidate-name">${name}</span>
                    <button type="button" class="summary-dropdown-btn" data-target="summary-${idx}" aria-expanded="false" title="Click to view 5-line summary">
                      <span>Summary</span> <span class="summary-chevron">&#9662;</span>
                    </button>
                  </div>
                  <div class="candidate-email-row">
                    ${emailHtml}
                    ${copyBtnHtml}
                  </div>
                </div>
              </div>
              <div class="candidate-side">
                ${score}
                ${actionHtml}
              </div>
            </div>
            <div class="candidate-summary-panel" id="summary-${idx}" style="display: none;">
              <div class="summary-panel-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                Interview & Resume Summary
              </div>
              <div class="summary-bullets">
                ${summaryHtml}
              </div>
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

        const isHidden = panel.style.display === "none";
        panel.style.display = isHidden ? "block" : "none";
        btn.classList.toggle("active", isHidden);
        btn.setAttribute("aria-expanded", isHidden ? "true" : "false");
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
        const sideDiv = currentTargetCard.querySelector(".candidate-side");
        const btn = currentTargetCard.querySelector(".email-btn");
        if (btn) {
          btn.remove();
        }
        const badge = document.createElement("span");
        badge.className = "email-sent-badge";
        badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 3px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Email Sent`;
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
});
